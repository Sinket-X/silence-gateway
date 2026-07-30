import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { UserGuard } from "@/components/silence/UserGuard";
import { getMyProfile, getMyUsage, listPublicModels } from "@/lib/users.functions";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Wallet, Activity, Cpu, KeyRound, LogOut, Copy, Check, Loader2, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/user/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Silence API" }] }),
  component: () => (<UserGuard><Inner /></UserGuard>),
});

function Inner() {
  const router = useRouter();
  const profileFn = useServerFn(getMyProfile);
  const usageFn = useServerFn(getMyUsage);
  const modelsFn = useServerFn(listPublicModels);

  const p = useQuery({ queryKey: ["me", "profile"], queryFn: () => profileFn() });
  const u = useQuery({ queryKey: ["me", "usage"], queryFn: () => usageFn() });
  const m = useQuery({ queryKey: ["me", "models"], queryFn: () => modelsFn() });

  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "keys" | "usage" | "models">("overview");
  const [modelSearch, setModelSearch] = useState("");

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/user", replace: true });
  }

  const totals = p.data?.totals ?? { balance: 0, cost: 0, requests: 0 };
  const email = p.data?.profile?.email ?? "";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 hero-grid opacity-60" />
      <div aria-hidden className="glow-orb h-[420px] w-[420px] -top-32 -left-24" style={{ background: "radial-gradient(circle, oklch(0.62 0.19 258 / 55%), transparent 70%)" }} />
      <div aria-hidden className="glow-orb h-[360px] w-[360px] top-40 -right-24" style={{ background: "radial-gradient(circle, oklch(0.72 0.16 210 / 40%), transparent 70%)" }} />
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl btn-primary text-white"><span className="text-base font-bold">S</span></div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Silence<span className="text-[color:var(--brand)]">API</span></div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">User portal</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
            <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--hairline)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-red-50 hover:text-red-600">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-6">
        {/* Hero KPIs */}
        <div className="glass-panel mb-6 rounded-2xl p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="brand-chip inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium">Welcome back</span>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">{email.split("@")[0]}</h1>
              <p className="text-sm text-muted-foreground">Your gateway usage at a glance.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 md:min-w-[420px]">
              <KPI label="Balance" value={`$${totals.balance.toFixed(2)}`} icon={Wallet} accent />
              <KPI label="Spent" value={`$${totals.cost.toFixed(4)}`} icon={TrendingUp} />
              <KPI label="Requests" value={String(totals.requests)} icon={Activity} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 inline-flex rounded-xl border border-[color:var(--hairline)] bg-white p-1 text-sm">
          {(["overview", "keys", "usage", "models"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${tab === t ? "bg-[color:var(--brand-soft)] text-[color:var(--brand-strong)]" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Getting started" icon={KeyRound}>
              <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted-foreground">
                <li>Copy an API key from the <button className="text-[color:var(--brand)] underline" onClick={() => setTab("keys")}>Keys</button> tab.</li>
                <li>Point your OpenAI SDK at <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">https://silence-api.lovable.app/v1</code>.</li>
                <li>Use any model from <button className="text-[color:var(--brand)] underline" onClick={() => setTab("models")}>Models</button>.</li>
              </ol>
            </Card>
            <Card title="Recent activity" icon={Activity}>
              {(u.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(u.data ?? []).slice(0, 5).map((e: any) => (
                    <li key={e.id} className="flex items-center justify-between rounded-lg bg-[color:var(--brand-soft)]/40 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{e.model_name}</div>
                        <div className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div>{e.total_tokens} tok</div>
                        <div className="text-muted-foreground">${Number(e.cost).toFixed(4)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {tab === "keys" && (
          <Card title="Your API keys" icon={KeyRound}>
            {(p.data?.keys?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No keys yet. Ask your admin.</p>
            ) : (
              <div className="space-y-2">
                {(p.data?.keys ?? []).map((k: any) => (
                  <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--hairline)] bg-white px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{k.owner_label}</div>
                      <code className="font-mono text-xs text-muted-foreground">{k.key_prefix}••••••••</code>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${k.enabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{k.enabled ? "ACTIVE" : "DISABLED"}</span>
                      <span>${Number(k.balance).toFixed(2)}</span>
                      <button onClick={async () => { try { await navigator.clipboard.writeText(k.key_prefix); setCopied(k.id); toast.success("Prefix copied"); setTimeout(() => setCopied(null), 1200); } catch {} }}
                        className="inline-flex items-center gap-1 rounded-md border border-[color:var(--hairline)] px-2 py-1 hover:bg-[color:var(--brand-soft)]">
                        {copied === k.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Prefix
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">Full keys are only shown once, at creation. Ask your admin if you lost yours.</p>
              </div>
            )}
          </Card>
        )}

        {tab === "usage" && (
          <Card title="Usage — last 50 requests" icon={Activity}>
            {u.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
              (u.data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="border-b border-[color:var(--hairline)] text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr><th className="py-2">When</th><th>Model</th><th>Tokens</th><th>Cost</th><th>Latency</th><th>OK</th></tr>
                  </thead>
                  <tbody>
                    {(u.data ?? []).map((e: any) => (
                      <tr key={e.id} className="border-b border-[color:var(--hairline)]/60">
                        <td className="py-2 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                        <td className="text-xs font-medium">{e.model_name}</td>
                        <td className="text-xs">{e.total_tokens}</td>
                        <td className="text-xs">${Number(e.cost).toFixed(4)}</td>
                        <td className="text-xs text-muted-foreground">{e.latency_ms}ms</td>
                        <td>{e.success ? <span className="text-emerald-600">✓</span> : <span className="text-red-600">✗</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === "models" && (
          <Card title="Available models" icon={Cpu}>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-[color:var(--hairline)] bg-white px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="Search models"
                className="w-full bg-transparent text-sm outline-none" />
            </div>
            {m.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {(m.data ?? []).filter((x: any) => !modelSearch || x.display_name.toLowerCase().includes(modelSearch.toLowerCase())).map((mm: any) => (
                  <div key={mm.id} className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--hairline)] bg-white px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{mm.display_name}</div>
                      <div className="text-[11px] text-muted-foreground">${Number(mm.user_cost_per_1m ?? 0).toFixed(2)} / 1M tokens</div>
                    </div>
                    <button onClick={async () => { try { await navigator.clipboard.writeText(mm.display_name); toast.success("Copied"); } catch {} }}
                      className="rounded-md border border-[color:var(--hairline)] p-1.5 hover:bg-[color:var(--brand-soft)]"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

function KPI({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-[color:var(--brand)]/30 bg-[color:var(--brand-soft)]" : "border-[color:var(--hairline)] bg-white"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><Icon className="h-3 w-3" /> {label}</div>
      <div className="mt-1 text-lg font-bold tracking-tight">{value}</div>
    </div>
  );
}
function Card({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[color:var(--hairline)] bg-white p-5 shadow-[var(--shadow-elegant)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-[color:var(--brand)]" /> {title}</div>
      {children}
    </div>
  );
}