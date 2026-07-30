import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role check failed");
  if (!data) throw new Error("Forbidden");
}

// Bootstrap first admin from BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD.
// Idempotent no-op if any admin already exists. Public (no auth) — safe because
// it refuses to run once even one admin exists.
export const bootstrapFirstAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error: countErr } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if (countErr) throw new Error("count failed");
  if ((count ?? 0) > 0) return { created: false };

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("bootstrap secrets missing");

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    // Maybe user already exists in auth but no role — fetch and grant role
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === email);
    if (!existing) throw new Error("failed to create bootstrap admin");
    await supabaseAdmin.from("user_roles").insert({ user_id: existing.id, role: "admin" });
    await supabaseAdmin.from("admins").upsert({ id: existing.id, email });
    return { created: true };
  }
  await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
  await supabaseAdmin.from("admins").upsert({ id: created.user.id, email });
  return { created: true };
});

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("admins")
      .select("id,email,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error("list failed");
    return data ?? [];
  });

const CreateAdminInput = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(200),
});

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateAdminInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created?.user) throw new Error(error?.message ?? "create failed");
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    await supabaseAdmin.from("admins").insert({ id: created.user.id, email: data.email });
    return { id: created.user.id };
  });

const UpdateAdminInput = z.object({
  id: z.string().uuid(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(12).max(200).optional(),
});

export const updateAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateAdminInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Restrict target to existing admins — prevents password reset of arbitrary auth users.
    const { data: target } = await supabaseAdmin.from("admins").select("id").eq("id", data.id).maybeSingle();
    if (!target) throw new Error("target is not an admin");
    const patch: Record<string, string> = {};
    if (data.email) patch.email = data.email;
    if (data.password) patch.password = data.password;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, patch);
    if (error) throw new Error(error.message);
    if (data.email) {
      await supabaseAdmin.from("admins").update({ email: data.email }).eq("id", data.id);
    }
    return { ok: true };
  });

const DeleteAdminInput = z.object({ id: z.string().uuid() });

export const deleteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeleteAdminInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("cannot delete yourself");
    // Ensure at least one admin remains after delete
    const { count } = await context.supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) throw new Error("cannot delete the last admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admins").delete().eq("id", data.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    return { ok: true };
  });