import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminGuard } from "@/components/silence/AdminGuard";
import { AdminShell } from "@/components/silence/AdminShell";
import { GlassCard } from "@/components/silence/GlassCard";
import { listModels, upsertModel, deleteModel, toggleModel, type ModelRow } from "@/lib/models.functions";
import { listProviders } from "@/lib/providers.functions";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, X, Search, Cpu, Boxes, Zap, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/admin/models")({
  head: () => ({ meta: [{ title: "Models — Silence API" }] }),
  component: () => (<AdminGuard><AdminShell><ModelsPage /></AdminShell></AdminGuard>),
});

type Form = {
  id?: string; provider_id: string; display_name: string; upstream_model: string;
  enabled: boolean;
  input_cost_per_1m: number; output_cost_per_1m: number; request_cost: number;
  internal_cost_per_1m: number; user_cost_per_1m: number;
};
const empty: Form = { provider_id: "", display_name: "", upstream_model: "", enabled: true,
  input_cost_per_1m: 0, output_cost_per_1m: 0, request_cost: 0, internal_cost_per_1m: 0, user_cost_per_1m: 0 };

function ModelsPage() {
  const list = useServerFn(listModels);
  const listP = useServerFn(listProviders);
  const upsert = useServerFn(upsertModel);
  const del = useServerFn(deleteModel);
  const toggle = useServerFn(toggleModel);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["models"], queryFn: () => list() });
  const qp = useQuery({ queryKey: ["providers"], queryFn: () => listP() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const saveM = useMutation({
    mutationFn: () => upsert({ data: { ...form } }),
    onSuccess: () => { toast.success(form.id ? "Model updated" : "Model added"); setOpen(false); setForm(empty); qc.invalidateQueries({ queryKey: ["models"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["models"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const togM = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["models"] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function beginEdit(m: ModelRow) {
    setForm({
      id: m.id, provider_id: m.provider_id, display_name: m.display_name, upstream_model: m.upstream_model,
      enabled: m.enabled, input_cost_per_1m: m.input_cost_per_1m, output_cost_per_1m: m.output_cost_per_1m,
      request_cost: m.request_cost, internal_cost_per_1m: m.internal_cost_per_1m, user_cost_per_1m: m.user_cost_per_1m,
    });
    setOpen(true);
  }

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    return rows.filter((m) => {
      if (providerFilter !== "all" && m.provider_id !== providerFilter) return false;
      if (!query.trim()) return true;
      const s = query.toLowerCase();
      return m.display_name.toLowerCase().includes(s) || m.upstream_model.toLowerCase().includes(s) || (m.provider_name ?? "").toLowerCase().includes(s);
    });
  }, [q.data, query, providerFilter]);

  const stats = useMemo(() => {
    const rows = q.data ?? [];
    const active = rows.filter((m) => m.enabled).length;
    const providers = new Set(rows.map((m) => m.provider_id)).size;
    return { total: rows.length, active, providers };
  }, [q.data]);

  async function copyId(id: string, upstream: string) {
    try { await navigator.clipboard.writeText(upstream); setCopiedId(id); setTimeout(() => setCopiedId(null), 1200); } catch {}
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="metallic-text text-2xl font-semibold sm:text-3xl">Models</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Catalog of models exposed by the gateway. Each model maps a public name to an upstream provider ID and defines the per-token price customers pay.
          </p>
        </div>
        <button
          onClick={() => { setForm({ ...empty, provider_id: qp.data?.[0]?.id ?? "" }); setOpen(true); }}
          disabled={!qp.data || qp.data.length === 0}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:shadow-primary/30 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add model
        </button>
      </div>

      {qp.data && qp.data.length === 0 && (
        <GlassCard className="p-6 text-sm text-muted-foreground">Add a provider first, then you can register models under it.</GlassCard>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <KpiCard icon={<Boxes className="h-4 w-4" />} label="Total" value={stats.total.toString()} sub="models" />
        <KpiCard icon={<Zap className="h-4 w-4" />} label="Active" value={stats.active.toString()} sub="live" />
        <KpiCard icon={<Cpu className="h-4 w-4" />} label="Providers" value={stats.providers.toString()} sub="upstream" />
      </div>

      {/* Toolbar */}
      <GlassCard className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, upstream id, provider…"
              className="w-full rounded-lg border border-border bg-background/60 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}
            className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All providers</option>
            {(qp.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </GlassCard>

      {/* Grid */}
      {q.isLoading && (
        <GlassCard className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></GlassCard>
      )}
      {q.data && q.data.length === 0 && (
        <GlassCard className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--brand-soft)]"><Boxes className="h-6 w-6 text-primary" /></div>
          <div className="text-base font-medium">No models yet</div>
          <div className="max-w-sm text-sm text-muted-foreground">Register your first model to expose it via the OpenAI-compatible endpoint at <code className="rounded bg-muted px-1 py-0.5 text-xs">/v1/chat/completions</code>.</div>
        </GlassCard>
      )}
      {q.data && q.data.length > 0 && filtered.length === 0 && (
        <GlassCard className="p-10 text-center text-sm text-muted-foreground">No models match your filters.</GlassCard>
      )}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <div key={m.id} className="group relative min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-card/60 p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-18px_rgba(15,42,90,0.35)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_18px_40px_-20px_rgba(59,111,160,0.45)]">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl opacity-0 transition group-hover:opacity-100" />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--brand-soft)] text-primary">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold leading-tight">{m.display_name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 font-medium">{m.provider_name}</span>
                        <span className={"inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 " + (m.enabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-slate-500/10 text-slate-500")}>
                          <span className={"h-1.5 w-1.5 rounded-full " + (m.enabled ? "bg-emerald-500" : "bg-slate-400")} />
                          {m.enabled ? "live" : "off"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => togM.mutate({ id: m.id, enabled: !m.enabled })}
                  aria-label="Toggle model"
                  className={"relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition " + (m.enabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-700")}>
                  <span className={"inline-block h-4 w-4 transform rounded-full bg-white shadow transition " + (m.enabled ? "translate-x-4" : "translate-x-0.5")} />
                </button>
              </div>

              <button
                onClick={() => copyId(m.id, m.upstream_model)}
                title="Copy upstream id"
                className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-background/60 px-2.5 py-1.5 text-left font-mono text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <span className="truncate">{m.upstream_model}</span>
                {copiedId === m.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 opacity-60" />}
              </button>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <PriceCell label="in / 1M" value={`$${m.user_cost_per_1m.toFixed(2)}`} />
                <PriceCell label="out / 1M" value={`$${m.output_cost_per_1m.toFixed(2)}`} />
                <PriceCell label="per req" value={`$${m.request_cost.toFixed(4)}`} />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.internal_cost_per_1m > 0 ? <>cost ${m.internal_cost_per_1m.toFixed(2)}/1M</> : "internal cost n/a"}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => beginEdit(m)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-[color:var(--brand-soft)] hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => { if (confirm(`Delete model ${m.display_name}?`)) delM.mutate(m.id); }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal form={form} setForm={setForm} providers={qp.data ?? []} onClose={() => setOpen(false)}
          onSave={() => {
            if (!form.provider_id) return toast.error("Pick a provider");
            if (!form.display_name.trim() || !form.upstream_model.trim()) return toast.error("Name & upstream required");
            saveM.mutate();
          }} saving={saveM.isPending} />
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <GlassCard className="relative min-w-0 overflow-hidden p-3 sm:p-4">
      <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[color:var(--brand-soft)] text-primary">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 truncate text-xl font-semibold tracking-tight sm:text-2xl">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>
    </GlassCard>
  );
}

function PriceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-xs font-semibold">{value}</div>
    </div>
  );
}

function Modal({ form, setForm, providers, onClose, onSave, saving }: {
  form: Form; setForm: (f: Form) => void; providers: { id: string; name: string }[];
  onClose: () => void; onSave: () => void; saving: boolean;
}) {
  const inp = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-card/95 backdrop-blur px-5 py-3">
          <div className="font-semibold">{form.id ? "Edit model" : "Add model"}</div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-[color:var(--brand-soft)]"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs">
              <div className="font-medium text-muted-foreground">Provider</div>
              <select value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })} className={inp}>
                <option value="">— select —</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <div className="font-medium text-muted-foreground">Display name</div>
              <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className={inp} placeholder="gpt-4o-mini" />
            </label>
          </div>
          <label className="block space-y-1 text-xs">
            <div className="font-medium text-muted-foreground">Upstream model id <span className="text-muted-foreground/70">(sent to provider)</span></div>
            <input value={form.upstream_model} onChange={(e) => setForm({ ...form, upstream_model: e.target.value })} className={inp + " font-mono"} placeholder="gpt-4o-mini-2024-07-18" />
          </label>

          <div className="rounded-xl border border-border bg-[color:var(--brand-soft)]/40 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User pricing (charged to customer API keys)</div>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="$ / 1M input tokens" value={form.user_cost_per_1m} onChange={(v) => setForm({ ...form, user_cost_per_1m: v })} />
              <NumField label="$ / 1M output tokens" value={form.output_cost_per_1m} onChange={(v) => setForm({ ...form, output_cost_per_1m: v })} />
              <NumField label="$ per request (flat)" step="0.0001" value={form.request_cost} onChange={(v) => setForm({ ...form, request_cost: v })} />
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal cost (what provider charges you — for analytics)</div>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="$ / 1M input" value={form.input_cost_per_1m} onChange={(v) => setForm({ ...form, input_cost_per_1m: v })} />
              <NumField label="$ / 1M internal all-in" value={form.internal_cost_per_1m} onChange={(v) => setForm({ ...form, internal_cost_per_1m: v })} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg glass ring-metallic px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step = "0.01" }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <label className="space-y-1 text-xs">
      <div className="font-medium text-muted-foreground">{label}</div>
      <input type="number" min="0" step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30" />
    </label>
  );
}