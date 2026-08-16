import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export type DashboardStats = {
  totals: { cost: number; tokens: number; requests: number; successRate: number };
  today: { cost: number; tokens: number; requests: number };
  byModel: { name: string; requests: number; tokens: number; cost: number }[];
  byProvider: { name: string; requests: number; tokens: number; cost: number }[];
  recent: {
    ts: string; model: string; provider: string; input: number; output: number;
    total: number; cost: number; latency: number; success: boolean;
  }[];
  keys: { total: number; active: number; balance: number };
};

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardStats> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ data: allEv }, { data: todayEv }, { data: recentEv }, { data: keys }] = await Promise.all([
      supabaseAdmin.from("usage_events").select("cost,total_tokens,success"),
      supabaseAdmin.from("usage_events").select("cost,total_tokens").gte("ts", dayAgo),
      supabaseAdmin.from("usage_events").select("*").order("ts", { ascending: false }).limit(200),
      supabaseAdmin.from("api_keys").select("balance,enabled"),
    ]);

    const totals = (allEv ?? []).reduce(
      (a: any, e: any) => {
        a.cost += Number(e.cost || 0);
        a.tokens += Number(e.total_tokens || 0);
        a.requests += 1;
        if (e.success) a.ok += 1;
        return a;
      },
      { cost: 0, tokens: 0, requests: 0, ok: 0 },
    );
    const today = (todayEv ?? []).reduce(
      (a: any, e: any) => {
        a.cost += Number(e.cost || 0);
        a.tokens += Number(e.total_tokens || 0);
        a.requests += 1;
        return a;
      },
      { cost: 0, tokens: 0, requests: 0 },
    );

    const groupBy = (rows: any[], key: string) => {
      const m = new Map<string, { name: string; requests: number; tokens: number; cost: number }>();
      for (const r of rows) {
        const name = r[key] ?? "unknown";
        const cur = m.get(name) ?? { name, requests: 0, tokens: 0, cost: 0 };
        cur.requests += 1;
        cur.tokens += Number(r.total_tokens || 0);
        cur.cost += Number(r.cost || 0);
        m.set(name, cur);
      }
      return [...m.values()].sort((a, b) => b.requests - a.requests).slice(0, 8);
    };

    return {
      totals: {
        cost: totals.cost,
        tokens: totals.tokens,
        requests: totals.requests,
        successRate: totals.requests ? (totals.ok / totals.requests) * 100 : 0,
      },
      today,
      byModel: groupBy(recentEv ?? [], "model_name"),
      byProvider: groupBy(recentEv ?? [], "provider_name"),
      recent: (recentEv ?? []).map((r: any) => ({
        ts: r.ts, model: r.model_name ?? "—", provider: r.provider_name ?? "—",
        input: r.input_tokens ?? 0, output: r.output_tokens ?? 0,
        total: r.total_tokens ?? 0, cost: Number(r.cost || 0),
        latency: r.latency_ms ?? 0, success: !!r.success,
      })),
      keys: {
        total: (keys ?? []).length,
        active: (keys ?? []).filter((k: any) => k.enabled).length,
        balance: (keys ?? []).reduce((s: number, k: any) => s + Number(k.balance || 0), 0),
      },
    };
  });
