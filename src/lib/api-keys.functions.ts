import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role check failed");
  if (!data) throw new Error("Forbidden");
}

export type ApiKeyRow = {
  id: string;
  owner_label: string;
  key_prefix: string;
  enabled: boolean;
  balance: number;
  total_cost: number;
  total_requests: number;
  last_used_at: string | null;
  created_at: string;
};

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiKeyRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("api_keys")
      .select("id,owner_label,key_prefix,enabled,balance,total_cost,total_requests,last_used_at,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ApiKeyRow[];
  });

const CreateInput = z.object({
  owner_label: z.string().trim().min(1).max(120),
  balance: z.number().min(0).default(0),
});

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newApiKey } = await import("./crypto.server");
    const k = newApiKey();
    const { data: created, error } = await supabaseAdmin.from("api_keys").insert({
      owner_label: data.owner_label,
      balance: data.balance,
      key_hash: k.hash,
      key_prefix: k.prefix,
    } as any).select("id").single();
    if (error) throw new Error(error.message);
    // Return raw key ONCE — never stored, never shown again
    return { id: created.id, raw_key: k.raw };
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  owner_label: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  balance: z.number().min(0).optional(),
});

export const updateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, any> = {};
    if (data.owner_label !== undefined) patch.owner_label = data.owner_label;
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.balance !== undefined) patch.balance = data.balance;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabaseAdmin.from("api_keys").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), delta: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("api_keys").select("balance").eq("id", data.id).single();
    if (error || !row) throw new Error("not found");
    const next = Math.max(0, Number(row.balance) + data.delta);
    const { error: e2 } = await supabaseAdmin.from("api_keys").update({ balance: next } as any).eq("id", data.id);
    if (e2) throw new Error(e2.message);
    return { balance: next };
  });

export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });