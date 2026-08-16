import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role check failed");
  if (!data) throw new Error("Forbidden");
}

export type UserRow = {
  id: string;
  email: string;
  suspended: boolean;
  suspended_reason: string | null;
  suspended_at: string | null;
  created_at: string;
  total_balance: number;
  total_cost: number;
  total_requests: number;
  key_count: number;
};

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin.from("profiles")
      .select("id,email,suspended,suspended_reason,suspended_at,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: keys } = await supabaseAdmin.from("api_keys")
      .select("user_id,balance,total_cost,total_requests");
    const agg = new Map<string, { total_balance: number; total_cost: number; total_requests: number; key_count: number }>();
    for (const k of keys ?? []) {
      if (!k.user_id) continue;
      const a = agg.get(k.user_id) ?? { total_balance: 0, total_cost: 0, total_requests: 0, key_count: 0 };
      a.total_balance += Number(k.balance);
      a.total_cost += Number(k.total_cost);
      a.total_requests += Number(k.total_requests);
      a.key_count += 1;
      agg.set(k.user_id, a);
    }
    return (profiles ?? []).map((p: any) => ({
      ...p,
      total_balance: agg.get(p.id)?.total_balance ?? 0,
      total_cost: agg.get(p.id)?.total_cost ?? 0,
      total_requests: agg.get(p.id)?.total_requests ?? 0,
      key_count: agg.get(p.id)?.key_count ?? 0,
    })) as UserRow[];
  });

const CreateUserInput = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
  initial_balance: z.number().min(0).max(1_000_000).default(0),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateUserInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Refuse if email already belongs to any admin (avoid role confusion)
    const { data: existingAdmin } = await supabaseAdmin.from("admins").select("id").eq("email", data.email).maybeSingle();
    if (existingAdmin) throw new Error("Email is already an admin account");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
    });
    if (error || !created?.user) throw new Error(error?.message ?? "create failed");
    const uid = created.user.id;
    // Insert profile + user role atomically-ish
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: uid, email: data.email, created_by: context.userId,
    } as any);
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      throw new Error(pErr.message);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "user" });
    // Auto-create a starter API key with the initial balance
    if (data.initial_balance > 0) {
      const { newApiKey } = await import("./crypto.server");
      const k = newApiKey();
      await supabaseAdmin.from("api_keys").insert({
        owner_label: data.email, balance: data.initial_balance,
        key_hash: k.hash, key_prefix: k.prefix, user_id: uid,
      } as any);
    }
    return { id: uid };
  });

const UpdateUserInput = z.object({
  id: z.string().uuid(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(8).max(200).optional(),
  suspended: z.boolean().optional(),
  suspended_reason: z.string().max(500).optional(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateUserInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only allow editing existing profile rows (prevents admins editing arbitrary auth users)
    const { data: target } = await supabaseAdmin.from("profiles").select("id").eq("id", data.id).maybeSingle();
    if (!target) throw new Error("user not found");
    const authPatch: Record<string, string> = {};
    if (data.email) authPatch.email = data.email;
    if (data.password) authPatch.password = data.password;
    if (Object.keys(authPatch).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, authPatch);
      if (error) throw new Error(error.message);
    }
    const profilePatch: Record<string, any> = {};
    if (data.email) profilePatch.email = data.email;
    if (data.suspended !== undefined) {
      profilePatch.suspended = data.suspended;
      profilePatch.suspended_at = data.suspended ? new Date().toISOString() : null;
      profilePatch.suspended_reason = data.suspended ? (data.suspended_reason ?? "suspended by admin") : null;
    }
    if (Object.keys(profilePatch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(profilePatch as any).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    // If suspending, revoke all sessions immediately
    if (data.suspended === true) {
      await supabaseAdmin.auth.admin.signOut(data.id).catch(() => {});
    }
    return { ok: true };
  });

export const adjustUserBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), delta: z.number().min(-1_000_000).max(1_000_000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.from("profiles").select("id").eq("id", data.id).maybeSingle();
    if (!target) throw new Error("user not found");
    // Distribute delta: if user has keys, apply to the first (oldest) key; else create one
    const { data: keys } = await supabaseAdmin.from("api_keys")
      .select("id,balance").eq("user_id", data.id).order("created_at", { ascending: true }).limit(1);
    if (keys && keys.length) {
      const next = Math.max(0, Number(keys[0].balance) + data.delta);
      const { error } = await supabaseAdmin.from("api_keys").update({ balance: next } as any).eq("id", keys[0].id);
      if (error) throw new Error(error.message);
    } else if (data.delta > 0) {
      const { newApiKey } = await import("./crypto.server");
      const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("id", data.id).single();
      const k = newApiKey();
      await supabaseAdmin.from("api_keys").insert({
        owner_label: prof?.email ?? "user", balance: data.delta,
        key_hash: k.hash, key_prefix: k.prefix, user_id: data.id,
      } as any);
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.from("profiles").select("id").eq("id", data.id).maybeSingle();
    if (!target) throw new Error("user not found");
    // Cascade: delete api_keys, profile, role, auth user
    await supabaseAdmin.from("api_keys").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- User-facing (self) endpoints ----------

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles").select("id,email,suspended,suspended_reason,created_at")
      .eq("id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("no profile");
    const { data: keys } = await context.supabase
      .from("api_keys")
      .select("id,owner_label,key_prefix,enabled,balance,total_cost,total_requests,last_used_at,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    const totals = (keys ?? []).reduce((acc, k: any) => ({
      balance: acc.balance + Number(k.balance),
      cost: acc.cost + Number(k.total_cost),
      requests: acc.requests + Number(k.total_requests),
    }), { balance: 0, cost: 0, requests: 0 });
    return { profile, keys: keys ?? [], totals };
  });

export const getMyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("usage_events")
      // NOTE: the column is `ts`, not `created_at`. Also `provider_name` is
      // deliberately NOT selected — end users must never learn which upstream
      // vendor served their request.
      .select("id,ts,model_name,input_tokens,output_tokens,total_tokens,cost,latency_ms,success")
      .order("ts", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPublicModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Users only need public metadata — display name and pricing
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify caller is a real profile user (not just any signed-in id)
    const { data: profile } = await context.supabase.from("profiles").select("suspended").eq("id", context.userId).maybeSingle();
    if (!profile) throw new Error("Forbidden");
    if (profile.suspended) throw new Error("Account suspended");
    const { data, error } = await supabaseAdmin.from("models")
      // `upstream_model` and `provider_id` are internal routing details — a user
      // knowing them could go straight to the upstream vendor. Never expose.
      .select("id,display_name,enabled,user_cost_per_1m,output_cost_per_1m,request_cost")
      .eq("enabled", true)
      .order("display_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });