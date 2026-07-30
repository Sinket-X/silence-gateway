import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role check failed");
  if (!data) throw new Error("Forbidden");
}

export type ModelRow = {
  id: string;
  provider_id: string;
  provider_name: string;
  display_name: string;
  upstream_model: string;
  enabled: boolean;
  input_cost_per_1m: number;
  output_cost_per_1m: number;
  request_cost: number;
  internal_cost_per_1m: number;
  user_cost_per_1m: number;
  created_at: string;
};

export const listModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ModelRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("models")
      .select("*, providers:provider_id(name)")
      .order("display_name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((m: any) => ({
      id: m.id, provider_id: m.provider_id,
      provider_name: m.providers?.name ?? "",
      display_name: m.display_name, upstream_model: m.upstream_model,
      enabled: m.enabled,
      input_cost_per_1m: Number(m.input_cost_per_1m),
      output_cost_per_1m: Number(m.output_cost_per_1m),
      request_cost: Number(m.request_cost),
      internal_cost_per_1m: Number(m.internal_cost_per_1m),
      user_cost_per_1m: Number(m.user_cost_per_1m),
      created_at: m.created_at,
    }));
  });

const UpsertModel = z.object({
  id: z.string().uuid().optional(),
  provider_id: z.string().uuid(),
  display_name: z.string().trim().min(1).max(120),
  upstream_model: z.string().trim().min(1).max(200),
  enabled: z.boolean().optional(),
  input_cost_per_1m: z.number().min(0).optional(),
  output_cost_per_1m: z.number().min(0).optional(),
  request_cost: z.number().min(0).optional(),
  internal_cost_per_1m: z.number().min(0).optional(),
  user_cost_per_1m: z.number().min(0).optional(),
});

export const upsertModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertModel.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, any> = {
      provider_id: data.provider_id,
      display_name: data.display_name,
      upstream_model: data.upstream_model,
    };
    for (const k of ["enabled","input_cost_per_1m","output_cost_per_1m","request_cost","internal_cost_per_1m","user_cost_per_1m"] as const) {
      if (data[k] !== undefined) patch[k] = data[k] as any;
    }
    if (data.id) {
      const { error } = await supabaseAdmin.from("models").update(patch as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabaseAdmin.from("models").insert(patch as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("models").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("models").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });