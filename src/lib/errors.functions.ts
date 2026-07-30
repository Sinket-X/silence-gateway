import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const listErrorEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("error_events")
      .select("id, ts, provider_name, key_fingerprint, token_label, model, http_status, message, provider_response, final_result, latency_ms")
      .order("ts", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const IdInput = z.object({ id: z.number().int().positive() });
export const resolveErrorEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("error_events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveAllErrorEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("error_events").delete().gt("id", 0);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
