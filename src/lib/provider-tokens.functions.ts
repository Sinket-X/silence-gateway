import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role check failed");
  if (!data) throw new Error("Forbidden");
}

function mask(v: string, keep = 4) {
  if (!v) return "";
  if (v.length <= keep * 2) return "•".repeat(Math.max(4, v.length));
  return v.slice(0, keep) + "••••" + v.slice(-keep);
}

export type ProviderTokenRow = {
  id: string;
  provider_id: string;
  label: string;
  api_key_masked: string;
  enabled: boolean;
  priority: number;
  balance: number;
  daily_limit: number;
  monthly_limit: number;
  rpm_limit: number;
  rps_limit: number;
  hourly_limit: number;
  max_input_tokens: number;
  max_output_tokens: number;
  health: string;
  last_health_at: string | null;
  last_used_at: string | null;
  requests_today: number;
  requests_this_month: number;
  cooldown_until: string | null;
  notes: string | null;
  created_at: string;
};

export const listTokens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ provider_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ProviderTokenRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("./crypto.server");
    const { data: rows, error } = await supabaseAdmin
      .from("provider_tokens").select("*")
      .eq("provider_id", data.provider_id)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((t: any) => {
      let key = "";
      try { key = t.api_key_enc ? decryptSecret(t.api_key_enc) : ""; } catch {}
      return {
        id: t.id, provider_id: t.provider_id, label: t.label,
        api_key_masked: key ? mask(key, 4) : "",
        enabled: t.enabled, priority: t.priority,
        balance: Number(t.balance),
        daily_limit: t.daily_limit, monthly_limit: t.monthly_limit,
        rpm_limit: t.rpm_limit, rps_limit: t.rps_limit,
        hourly_limit: t.hourly_limit ?? 0,
        max_input_tokens: t.max_input_tokens, max_output_tokens: t.max_output_tokens,
        health: t.health, last_health_at: t.last_health_at, last_used_at: t.last_used_at,
        requests_today: t.requests_today, requests_this_month: t.requests_this_month,
        cooldown_until: t.cooldown_until, notes: t.notes,
        created_at: t.created_at,
      };
    });
  });

const UpsertToken = z.object({
  id: z.string().uuid().optional(),
  provider_id: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  api_key: z.string().trim().min(1).max(2000).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(9999).optional(),
  balance: z.number().min(0).optional(),
  daily_limit: z.number().int().min(0).optional(),
  monthly_limit: z.number().int().min(0).optional(),
  rpm_limit: z.number().int().min(0).optional(),
  rps_limit: z.number().int().min(0).optional(),
  hourly_limit: z.number().int().min(0).optional(),
  max_input_tokens: z.number().int().min(0).optional(),
  max_output_tokens: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const upsertToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertToken.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("./crypto.server");
    const patch: Record<string, any> = { provider_id: data.provider_id, label: data.label };
    if (data.api_key) patch.api_key_enc = encryptSecret(data.api_key);
    for (const k of ["enabled","priority","balance","daily_limit","monthly_limit","rpm_limit","rps_limit","hourly_limit","max_input_tokens","max_output_tokens","notes"] as const) {
      if (data[k] !== undefined) patch[k] = data[k] as any;
    }
    if (data.id) {
      const { error } = await supabaseAdmin.from("provider_tokens").update(patch as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    if (!data.api_key) throw new Error("api_key required");
    const { data: created, error } = await supabaseAdmin.from("provider_tokens").insert(patch as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("provider_tokens").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("provider_tokens").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("./crypto.server");
    const { data: t, error } = await supabaseAdmin.from("provider_tokens").select("id,api_key_enc,provider_id").eq("id", data.id).single();
    if (error || !t) throw new Error("not found");
    const { data: p, error: pe } = await supabaseAdmin.from("providers").select("base_url_enc,headers_enc").eq("id", t.provider_id).single();
    if (pe || !p) throw new Error("provider missing");
    const baseUrl = decryptSecret(p.base_url_enc);
    const apiKey = decryptSecret(t.api_key_enc);
    const extra: Record<string, string> = p.headers_enc ? JSON.parse(decryptSecret(p.headers_enc)) : {};
    const started = Date.now();
    let ok = false, status = 0, detail = "";
    try {
      const res = await fetch(baseUrl.replace(/\/$/, "") + "/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...extra },
      });
      status = res.status; ok = res.ok;
      if (!ok) detail = (await res.text()).slice(0, 300);
    } catch (e: any) { detail = e?.message ?? "network error"; }
    const health = ok ? "healthy" : "unhealthy";
    await supabaseAdmin.from("provider_tokens").update({ health, last_health_at: new Date().toISOString() }).eq("id", data.id);
    return { ok, status, latency_ms: Date.now() - started, detail, health };
  });

export const getTokenSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("./crypto.server");
    const { data: t, error } = await supabaseAdmin.from("provider_tokens").select("api_key_enc").eq("id", data.id).single();
    if (error || !t) throw new Error("not found");
    return { api_key: t.api_key_enc ? decryptSecret(t.api_key_enc) : "" };
  });