import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role check failed");
  if (!data) throw new Error("Forbidden");
}

export type ProviderRow = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  status: string;
  health: string;
  balance: number;
  daily_limit: number;
  monthly_limit: number;
  rpm_limit: number;
  rps_limit: number;
  hourly_limit: number;
  max_input_tokens: number;
  max_output_tokens: number;
  notes: string | null;
  base_url_masked: string;
  api_key_masked: string;
  has_headers: boolean;
  requires_auth: boolean;
  last_health_at: string | null;
  created_at: string;
  updated_at: string;
};

function mask(value: string, keep = 4): string {
  if (!value) return "";
  if (value.length <= keep * 2) return "•".repeat(Math.max(4, value.length));
  return value.slice(0, keep) + "••••" + value.slice(-keep);
}

export const listProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProviderRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("./crypto.server");
    const { data, error } = await supabaseAdmin
      .from("providers")
      .select("*")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => {
      let baseUrl = "";
      let apiKey = "";
      try { baseUrl = p.base_url_enc ? decryptSecret(p.base_url_enc) : ""; } catch {}
      try { apiKey = p.api_key_enc ? decryptSecret(p.api_key_enc) : ""; } catch {}
      return {
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        priority: p.priority,
        status: p.status,
        health: p.health,
        balance: Number(p.balance),
        daily_limit: p.daily_limit,
        monthly_limit: p.monthly_limit,
        rpm_limit: p.rpm_limit,
        rps_limit: p.rps_limit,
        hourly_limit: p.hourly_limit ?? 0,
        max_input_tokens: p.max_input_tokens,
        max_output_tokens: p.max_output_tokens,
        notes: p.notes,
        base_url_masked: baseUrl ? mask(baseUrl, 20) : "",
        api_key_masked: apiKey ? mask(apiKey, 4) : "",
        has_headers: !!p.headers_enc,
        requires_auth: p.requires_auth !== false,
        last_health_at: p.last_health_at,
        created_at: p.created_at,
        updated_at: p.updated_at,
      };
    });
  });

export const getProviderSecrets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("./crypto.server");
    const { data: p, error } = await supabaseAdmin
      .from("providers")
      .select("base_url_enc,api_key_enc,headers_enc")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return { base_url: "", api_key: "", headers_json: "" };
    return {
      base_url: (() => { try { return p.base_url_enc ? decryptSecret(p.base_url_enc) : ""; } catch { return ""; } })(),
      api_key: (() => { try { return p.api_key_enc ? decryptSecret(p.api_key_enc) : ""; } catch { return ""; } })(),
      headers_json: (() => { try { return p.headers_enc ? decryptSecret(p.headers_enc) : ""; } catch { return ""; } })(),
    };
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  base_url: z.string().trim().url().max(500).optional(),
  api_key: z.string().trim().min(1).max(1000).optional(),
  headers_json: z.string().trim().max(4000).optional().nullable(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(9999).optional(),
  daily_limit: z.number().int().min(0).optional(),
  monthly_limit: z.number().int().min(0).optional(),
  rpm_limit: z.number().int().min(0).optional(),
  rps_limit: z.number().int().min(0).optional(),
  hourly_limit: z.number().int().min(0).optional(),
  max_input_tokens: z.number().int().min(0).optional(),
  max_output_tokens: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional().nullable(),
  requires_auth: z.boolean().optional(),
});

// SSRF guard: block base_urls that would let the gateway pivot to internal
// networks or metadata services. Only https, only public hostnames.
function assertPublicHttpsUrl(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("base_url must be a valid URL"); }
  if (u.protocol !== "https:") throw new Error("base_url must use https://");
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host) ||          // link-local / AWS metadata
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) || // CGNAT
    host === "::1" ||
    host.startsWith("fc") || host.startsWith("fd") ||         // ULA
    host.startsWith("fe80")                                    // link-local v6
  ) {
    throw new Error("base_url points to a private/internal address");
  }
}

export const upsertProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("./crypto.server");

    if (data.base_url) assertPublicHttpsUrl(data.base_url);

    if (data.headers_json) {
      try {
        const p = JSON.parse(data.headers_json);
        if (typeof p !== "object" || Array.isArray(p) || p === null) throw new Error();
      } catch {
        throw new Error("headers_json must be a JSON object");
      }
    }

    const patch: Record<string, any> = { name: data.name };
    if (data.base_url !== undefined && data.base_url !== "") patch.base_url_enc = encryptSecret(data.base_url);
    if (data.api_key !== undefined && data.api_key !== "") patch.api_key_enc = encryptSecret(data.api_key);
    if (data.headers_json !== undefined) patch.headers_enc = data.headers_json ? encryptSecret(data.headers_json) : null;
    for (const k of ["enabled","priority","daily_limit","monthly_limit","rpm_limit","rps_limit","hourly_limit","max_input_tokens","max_output_tokens","notes","requires_auth"] as const) {
      if (data[k] !== undefined) patch[k] = data[k] as any;
    }

    if (data.id) {
      const { error } = await supabaseAdmin.from("providers").update(patch as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    if (!data.base_url) throw new Error("base_url is required");
    const { data: created, error } = await supabaseAdmin.from("providers").insert(patch as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

const IdInput = z.object({ id: z.string().uuid() });

export const deleteProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("providers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("providers").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("./crypto.server");
    const { data: p, error } = await supabaseAdmin.from("providers").select("*").eq("id", data.id).single();
    if (error || !p) throw new Error("not found");
    const baseUrl = decryptSecret(p.base_url_enc);
    const apiKey = p.api_key_enc ? decryptSecret(p.api_key_enc) : "";
    const extra: Record<string, string> = p.headers_enc ? JSON.parse(decryptSecret(p.headers_enc)) : {};
    const started = Date.now();
    let ok = false; let status = 0; let detail = "";
    try {
      const url = baseUrl.replace(/\/$/, "") + "/models";
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...extra },
      });
      status = res.status;
      ok = res.ok;
      if (!ok) detail = (await res.text()).slice(0, 300);
    } catch (e: any) {
      detail = e?.message ?? "network error";
    }
    const health = ok ? "healthy" : "unhealthy";
    await supabaseAdmin.from("providers").update({ health, last_health_at: new Date().toISOString() }).eq("id", data.id);
    return { ok, status, latency_ms: Date.now() - started, detail, health };
  });
