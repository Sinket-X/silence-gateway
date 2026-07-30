import { createFileRoute } from "@tanstack/react-router";
import { AdminGuard } from "@/components/silence/AdminGuard";
import { AdminShell } from "@/components/silence/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listErrorEvents, resolveErrorEvent, resolveAllErrorEvents } from "@/lib/errors.functions";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ChevronDown, AlertTriangle, ShieldAlert, Search } from "lucide-react";

export const Route = createFileRoute("/admin/errors")({
  head: () => ({
    meta: [
      { title: "Provider errors — Silence API" },
      { name: "description", content: "Exact upstream provider and token errors captured by the Silence API gateway." },
      { property: "og:title", content: "Provider errors — Silence API" },
      { property: "og:description", content: "Exact upstream provider and token errors captured by the Silence API gateway." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ErrorsPage,
});

function statusTone(status: number | null) {
  if (status === null) return "bg-muted text-muted-foreground";
  if (status === 429) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (status >= 500) return "bg-red-500/15 text-red-600 dark:text-red-400";
  if (status === 404) return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
  return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
}

function ErrorsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listErrorEvents);
  const resolveFn = useServerFn(resolveErrorEvent);
  const resolveAllFn = useServerFn(resolveAllErrorEvents);

  const q = useQuery({ queryKey: ["error-events"], queryFn: () => listFn(), refetchInterval: 20000 });
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const rows = useMemo(() => {
    const all = (q.data ?? []) as any[];
    const f = filter.trim().toLowerCase();
    if (!f) return all;
    return all.filter((r) =>
      [r.provider_name, r.model, r.token_label, r.key_fingerprint, r.message, String(r.http_status)]
        .filter(Boolean).join(" ").toLowerCase().includes(f)
    );
  }, [q.data, filter]);

  const resolve = useMutation({
    mutationFn: (id: number) => resolveFn({ data: { id } }),
    onSuccess: () => { toast.success("Marked resolved"); qc.invalidateQueries({ queryKey: ["error-events"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const resolveAll = useMutation({
    mutationFn: () => resolveAllFn(),
    onSuccess: () => { toast.success("All errors cleared"); qc.invalidateQueries({ queryKey: ["error-events"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copied"); }
    catch { toast.error("Copy failed"); }
  };

  const failover = rows.filter((r: any) => r.final_result === "failover").length;
  const returned = rows.filter((r: any) => r.final_result !== "failover").length;

  return (
    <AdminGuard>
      <AdminShell>
        <div className="mx-auto w-full max-w-6xl p-4 md:p-8 space-y-6">
          <header className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Errors &amp; fallbacks</h1>
            <p className="text-muted-foreground text-sm">
              Exactly what each provider token returned. Read-only log — tick an entry once you've handled it and it's removed; if it happens again it reappears.
            </p>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="glass-panel rounded-2xl p-4">
              <div className="text-xs text-muted-foreground">Open events</div>
              <div className="text-2xl font-semibold tabular-nums">{rows.length}</div>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="size-3" /> Failed over</div>
              <div className="text-2xl font-semibold tabular-nums">{failover}</div>
            </div>
            <div className="glass-panel rounded-2xl p-4 col-span-2 md:col-span-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><ShieldAlert className="size-3" /> Sent to client</div>
              <div className="text-2xl font-semibold tabular-nums">{returned}</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by provider, token, model, status…"
                className="w-full rounded-xl border border-border bg-background/60 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              onClick={() => resolveAll.mutate()}
              disabled={!rows.length || resolveAll.isPending}
              className="btn-primary rounded-xl px-4 py-2 text-sm disabled:opacity-50 shrink-0"
            >
              Resolve all
            </button>
          </div>

          {q.isLoading ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center">
              <div className="text-base font-medium">No provider errors 🎉</div>
              <p className="text-sm text-muted-foreground mt-1">Every upstream call is going through cleanly.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((r: any) => {
                const isOpen = open === r.id;
                const full = [
                  `time: ${new Date(r.ts).toISOString()}`,
                  `provider: ${r.provider_name ?? "-"}`,
                  `token: ${r.token_label ?? "-"} (${r.key_fingerprint ?? "-"})`,
                  `model: ${r.model ?? "-"}`,
                  `status: ${r.http_status ?? "network"}`,
                  `result: ${r.final_result}`,
                  `latency_ms: ${r.latency_ms ?? "-"}`,
                  `message: ${r.message ?? "-"}`,
                  `provider_response: ${r.provider_response ?? "-"}`,
                ].join("\n");
                return (
                  <li key={r.id} className="glass-panel rounded-2xl overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums ${statusTone(r.http_status)}`}>
                          {r.http_status ?? "NET"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium break-words">{r.message}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="rounded-md bg-muted px-1.5 py-0.5">{r.provider_name ?? "unknown provider"}</span>
                            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono">
                              {r.token_label ?? "token"} · {r.key_fingerprint ?? "-"}
                            </span>
                            {r.model && <span className="rounded-md bg-muted px-1.5 py-0.5">{r.model}</span>}
                            <span>{r.final_result === "failover" ? "failed over to next token" : "returned to client"}</span>
                            <span>· {r.latency_ms ?? 0} ms</span>
                            <span>· {new Date(r.ts).toLocaleString()}</span>
                          </div>
                        </div>
                        <button
                          title="Mark resolved"
                          aria-label="Mark resolved"
                          onClick={() => resolve.mutate(r.id)}
                          disabled={resolve.isPending}
                          className="shrink-0 grid place-items-center size-9 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                        >
                          <Check className="size-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setOpen(isOpen ? null : r.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted transition"
                        >
                          <ChevronDown className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          {isOpen ? "Hide" : "Raw provider response"}
                        </button>
                        <button
                          onClick={() => copy(full)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted transition"
                        >
                          <Copy className="size-3.5" /> Copy details
                        </button>
                      </div>

                      {isOpen && (
                        <pre className="max-w-full overflow-x-auto rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all">
{r.provider_response?.trim() ? r.provider_response : "(empty body from provider)"}
                        </pre>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
