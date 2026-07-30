import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const listBannedIps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("banned_ips")
      .select("ip, reason, strikes, banned_at, expires_at")
      .order("banned_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const now = Date.now();
    return (data ?? []).map((r: any) => ({
      ...r,
      active: !r.expires_at || new Date(r.expires_at).getTime() > now,
    }));
  });

export const listRecentStrikes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("ip_strikes")
      .select("ip, count, last_at, last_reason")
      .order("last_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const IpInput = z.object({ ip: z.string().trim().min(3).max(64) });
export const unbanIp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IpInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("gw_unban_ip", { _ip: data.ip });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ManualBanInput = z.object({
  ip: z.string().trim().min(3).max(64),
  reason: z.string().trim().max(300).optional(),
  hours: z.number().int().min(1).max(24 * 30).default(24),
});
export const manualBanIp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ManualBanInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("gw_manual_ban_ip", {
      _ip: data.ip, _reason: data.reason ?? "manual admin ban", _hours: data.hours,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
