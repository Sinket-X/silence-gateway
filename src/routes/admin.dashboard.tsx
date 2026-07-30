import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminGuard } from "@/components/silence/AdminGuard";
import { AdminShell } from "@/components/silence/AdminShell";
import { GlassCard } from "@/components/silence/GlassCard";
import { getDashboardStats } from "@/lib/stats.functions";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Silence API" }] }),
  component: Dashboard,
});

const fmtUsd = (n: number) => `$${n.toFixed(4)}`;
const fmtInt = (n: number) => n.toLocaleString();

function Dashboard() {
  const fetchStats = useServerFn(getDashboardStats);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 10_000,
  });

  const kpis = [
    { k: "Total Cost", v: data ? fmtUsd(data.totals.cost) : "—", sub: data ? `${fmtUsd(data.today.cost)} today` : "" },
    { k: "Total Tokens", v: data ? fmtInt(data.totals.tokens) : "—", sub: data ? `${fmtInt(data.today.tokens)} today` : "" },
    { k: "Total Requests", v: data ? fmtInt(data.totals.requests) : "—", sub: data ? `${fmtInt(data.today.requests)} today` : "" },
    { k: "Success Rate", v: data ? `${data.totals.successRate.toFixed(1)}%` : "—", sub: data ? `${data.keys.active}/${data.keys.total} keys active` : "" },
  ];

  return (
    <AdminGuard>
      <AdminShell>
        <div className="relative">
          <div aria-hidden className="glow-orb h-[380px] w-[380px] -top-20 -left-24" style={{ background: "radial-gradient(circle, oklch(0.62 0.19 258 / 45%), transparent 70%)" }} />
          <div aria-hidden className="glow-orb h-[320px] w-[320px] top-24 -right-16" style={{ background: "radial-gradient(circle, oklch(0.72 0.16 210 / 35%), transparent 70%)" }} />
        <div className="relative mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="metallic-text text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Live overview of Silence API traffic. {isFetching && <span className="opacity-60">refreshing…</span>}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-xs backdrop-blur-xl hover:bg-white"
          >
            Refresh
          </button>
        </div>

        <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.k} className="glass-panel rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.k}</div>
              <div className="mt-1 text-xl font-semibold metallic-text">{k.v}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{k.sub || (isLoading ? "loading…" : "no data yet")}</div>
            </div>
          ))}
        </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassCard className="p-4">
            <div className="mb-2 text-sm font-medium">By Model</div>
            <BreakdownTable rows={data?.byModel ?? []} />
          </GlassCard>
          <GlassCard className="p-4">
            <div className="mb-2 text-sm font-medium">By Provider</div>
            <BreakdownTable rows={data?.byProvider ?? []} />
          </GlassCard>
        </div>

        <GlassCard className="mt-6 p-4">
          <div className="mb-2 text-sm font-medium">Recent Requests</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-3">Time</th>
                  <th className="py-1.5 pr-3">Model</th>
                  <th className="py-1.5 pr-3">Provider</th>
                  <th className="py-1.5 pr-3">In</th>
                  <th className="py-1.5 pr-3">Out</th>
                  <th className="py-1.5 pr-3">Cost</th>
                  <th className="py-1.5 pr-3">ms</th>
                  <th className="py-1.5 pr-3">OK</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent ?? []).map((r, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(r.ts).toLocaleTimeString()}</td>
                    <td className="py-1.5 pr-3">{r.model}</td>
                    <td className="py-1.5 pr-3">{r.provider}</td>
                    <td className="py-1.5 pr-3">{fmtInt(r.input)}</td>
                    <td className="py-1.5 pr-3">{fmtInt(r.output)}</td>
                    <td className="py-1.5 pr-3">{fmtUsd(r.cost)}</td>
                    <td className="py-1.5 pr-3">{r.latency}</td>
                    <td className="py-1.5 pr-3">{r.success ? "✓" : "✗"}</td>
                  </tr>
                ))}
                {!data?.recent?.length && (
                  <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No requests yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </AdminShell>
    </AdminGuard>
  );
}

function BreakdownTable({ rows }: { rows: { name: string; requests: number; tokens: number; cost: number }[] }) {
  if (!rows.length) return <div className="py-6 text-center text-xs text-muted-foreground">No data yet.</div>;
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-muted-foreground">
        <tr><th className="py-1.5 pr-3">Name</th><th className="py-1.5 pr-3">Reqs</th><th className="py-1.5 pr-3">Tokens</th><th className="py-1.5 pr-3">Cost</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-t border-border/40">
            <td className="py-1.5 pr-3">{r.name}</td>
            <td className="py-1.5 pr-3">{fmtInt(r.requests)}</td>
            <td className="py-1.5 pr-3">{fmtInt(r.tokens)}</td>
            <td className="py-1.5 pr-3">{fmtUsd(r.cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
