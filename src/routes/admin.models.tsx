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
import { Loader2, Plus, Trash2, Pencil, X, Search, Cpu, Boxes, Zap, Copy, Check, AlertCircle } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/silence/ConfirmDeleteModal";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 py-4">
          {filtered.map((m) => (
            <div key={m.id} className="card-3d group relative">
              {/* Glossy top sheen */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[60%] rounded-[26px] bg-gradient-to-b from-white/20 to-transparent z-20" />
              
              {/* Circuit Trace Watermark (simplified as CSS mask/overlay) */}
              <div className="pointer-events-none absolute inset-0 opacity-10 z-0" 
                style={{ 
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)`,
                  backgroundSize: '26px 26px',
                  maskImage: 'radial-gradient(circle 320px at 88% -8%, black, transparent 70%)',
                  WebkitMaskImage: 'radial-gradient(circle 320px at 88% -8%, black, transparent 70%)'
                }} 
              />

              <div className="card-3d-content relative z-10 flex flex-col p-[30px_26px_26px]">
                <div className="flex items-start justify-between gap-3.5">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* 3D Glassy Chip */}
                    <div className="relative flex-shrink-0">
                      <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[16px] border border-white/90 bg-gradient-to-br from-white to-[#dfe8f9] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-3px_6px_rgba(160,180,220,0.35),0_10px_18px_-8px_rgba(47,111,237,0.45),0_3px_6px_-2px_rgba(40,60,110,0.15)] transition-transform duration-300 group-hover:scale-105">
                        <Cpu className="h-[27px] w-[27px] text-[#1650c9]" />
                      </div>
                      {m.enabled && (
                        <div className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-[2.5px] border-white bg-gradient-to-br from-[#4fe0ae] to-[#14996f] shadow-[0_0_0_0_rgba(20,153,111,0.5),0_2px_4px_rgba(20,153,111,0.4)] animate-pulse" />
                      )}
                    </div>
                    
                    <div className="min-w-0 pt-0.5">
                      <h3 className="font-['Space_Grotesk'] text-[20px] font-bold leading-[1.3] tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {m.display_name}
                      </h3>
                      <div className="mt-2.5">
                        <span className="inline-block font-['JetBrains_Mono'] text-[10.5px] font-semibold tracking-[0.09em] text-[#1650c9] bg-gradient-to-br from-white/90 to-[#dbe8ff]/70 border border-[#2f6fed]/25 px-[9px] py-1 rounded-[7px] shadow-[0_1px_2px_rgba(47,111,237,0.15)]">
                          {m.provider_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3D Glassy Toggle */}
                  <button
                    onClick={() => togM.mutate({ id: m.id, enabled: !m.enabled })}
                    className={`relative h-7 w-12 flex-shrink-0 rounded-full border border-white/50 transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(20,60,150,0.3),0_6px_14px_-4px_rgba(47,111,237,0.6)] ${
                      m.enabled ? "bg-gradient-to-b from-[#4a8bff] to-[#2f6fed]" : "bg-gradient-to-b from-[#dbe0ea] to-[#c7cedb] shadow-[inset_0_-2px_4px_rgba(120,130,150,0.3)]"
                    }`}
                  >
                    <div className={`absolute top-[3px] h-5 w-5 rounded-full bg-gradient-to-b from-white to-[#e8edf7] shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 ${
                      m.enabled ? "left-[23px]" : "left-[3px]"
                    }`} />
                  </button>
                </div>

                {/* Upstream ID - Raised Inset */}
                <div className="card-3d-sub-content mt-[22px] flex items-center justify-between gap-3 rounded-[15px] border border-white/80 bg-gradient-to-br from-white/55 to-white/25 p-[13px_14px] shadow-[inset_0_2px_5px_rgba(90,110,150,0.14),0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/60 mb-1">Upstream ID</div>
                    <div className="truncate font-mono text-[13.5px] text-foreground leading-normal">
                      {m.upstream_model}
                    </div>
                  </div>
                  <button
                    onClick={() => copyId(m.id, m.upstream_model)}
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-white/90 bg-gradient-to-br from-white to-[#eef2f9] transition-all hover:scale-105 active:scale-95 shadow-[0_2px_5px_-1px_rgba(40,60,110,0.18),inset_0_1px_0_rgba(255,255,255,0.8)] ${
                      copiedId === m.id ? "text-emerald-500 border-emerald-500/40 bg-emerald-50" : "text-muted-foreground hover:text-primary hover:border-primary/35"
                    }`}
                  >
                    {copiedId === m.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>

                {/* Stats Grid - Raised Glass Tiles */}
                <div className="stats mt-3 grid grid-cols-3 gap-2.5">
                  <StatTile label="Input / 1M" value={`$${m.user_cost_per_1m.toFixed(2)}`} />
                  <StatTile label="Output / 1M" value={`$${m.output_cost_per_1m.toFixed(2)}`} />
                  <StatTile label="Request" value={`$${m.request_cost.toFixed(4)}`} />
                </div>

                <div className="my-[20px] h-px w-full bg-gradient-to-r from-transparent via-border/40 to-transparent" />

                {/* Internal Cost - Raised Amber Glass Plate */}
                <div className="flex items-center justify-between rounded-[15px] border border-white/85 bg-gradient-to-br from-[rgba(255,247,235,0.75)] to-[rgba(255,240,215,0.35)] p-[14px_15px] shadow-[0_6px_16px_-10px_rgba(180,120,20,0.3),inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/60 mb-1">Internal Cost</div>
                    <div className="font-mono text-[18px] font-bold text-[#b9720f]">
                      {m.internal_cost_per_1m > 0 ? `$${m.internal_cost_per_1m.toFixed(2)}` : "N/A"}<span className="text-[11px] font-medium text-muted-foreground ml-1">/ 1M</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => beginEdit(m)}
                      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/90 bg-gradient-to-br from-white to-[#eef2f9] text-muted-foreground transition-all hover:scale-105 hover:text-[#b9720f] hover:border-[#b9720f]/35 shadow-[0_2px_5px_-1px_rgba(40,60,110,0.18),inset_0_1px_0_rgba(255,255,255,0.8)]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingId(m.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/90 bg-gradient-to-br from-white to-[#eef2f9] text-destructive transition-all hover:scale-105 hover:bg-destructive/10 shadow-[0_2px_5px_-1px_rgba(40,60,110,0.18),inset_0_1px_0_rgba(255,255,255,0.8)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
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

      {deletingId && (
        <ConfirmDeleteModal
          title="Delete Model"
          description={`Are you sure you want to delete "${filtered.find(m => m.id === deletingId)?.display_name}"? This action cannot be undone.`}
          onConfirm={() => {
            delM.mutate(deletingId);
            setDeletingId(null);
          }}
          onCancel={() => setDeletingId(null)}
          isLoading={delM.isPending}
        />
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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-white/85 bg-gradient-to-br from-white/85 to-white/45 p-[13px_6px_12px] text-center shadow-[0_6px_14px_-8px_rgba(40,60,110,0.2),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-200 hover:scale-[1.03]">
      <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">{label}</div>
      <div className="mt-1.5 font-mono text-[14px] font-bold text-foreground">{value}</div>
    </div>
  );
}

function Modal({ form, setForm, providers, onClose, onSave, saving }: {
  form: Form; setForm: (f: Form) => void; providers: { id: string; name: string }[];
  onClose: () => void; onSave: () => void; saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="modal animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="modal-header">
          <h1>{form.id ? "Edit Model" : "Add Model"}</h1>
          <button onClick={onClose} className="close-btn">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="header-divider" />

        {/* Body */}
        <div className="modal-body">
          <form id="model-form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
            <div className="field">
              <div className="field-label">Provider</div>
              <div className="select-wrap">
                <select 
                  value={form.provider_id} 
                  onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
                  className="select"
                >
                  <option value="">— select —</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="field">
              <div className="field-label">Display name</div>
              <input 
                value={form.display_name} 
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="input" 
                placeholder="gpt-4o-mini" 
              />
            </div>

            <div className="field">
              <div className="field-label">
                Upstream model id <span className="hint">(sent to provider)</span>
              </div>
              <input 
                value={form.upstream_model} 
                onChange={(e) => setForm({ ...form, upstream_model: e.target.value })}
                className="input" 
                placeholder="gpt-4o-mini-2024-07-18" 
              />
            </div>

            {/* User Pricing Panel */}
            <div className="panel blue">
              <div className="panel-title">User pricing (charged to customer API keys)</div>
              <div className="field-row">
                <NumField label="$ / 1M input tokens" value={form.user_cost_per_1m} onChange={(v) => setForm({ ...form, user_cost_per_1m: v })} />
                <NumField label="$ / 1M output tokens" value={form.output_cost_per_1m} onChange={(v) => setForm({ ...form, output_cost_per_1m: v })} />
              </div>
              <div className="field mt-3">
                <NumField label="$ per request (flat)" step="0.0001" value={form.request_cost} onChange={(v) => setForm({ ...form, request_cost: v })} />
              </div>
            </div>

            {/* Internal Cost Panel */}
            <div className="panel amber">
              <div className="panel-title">Internal cost (what provider charges you)</div>
              <div className="field-row">
                <NumField label="$ / 1M input" value={form.input_cost_per_1m} onChange={(v) => setForm({ ...form, input_cost_per_1m: v })} />
                <NumField label="$ / 1M internal all-in" value={form.internal_cost_per_1m} onChange={(v) => setForm({ ...form, internal_cost_per_1m: v })} />
              </div>
            </div>

            <div className="enabled-row">
              <div 
                className={`checkbox ${form.enabled ? "bg-primary" : "bg-muted"}`}
                onClick={() => setForm({ ...form, enabled: !form.enabled })}
              >
                {form.enabled && <Check className="h-3.5 w-3.5" />}
              </div>
              <div className="enabled-label" onClick={() => setForm({ ...form, enabled: !form.enabled })}>
                Enabled
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-cancel">Cancel</button>
          <button 
            type="submit" 
            form="model-form"
            disabled={saving} 
            className="btn btn-save inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step = "0.01" }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <input 
        type="number" 
        min="0" 
        step={step} 
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input" 
      />
    </div>
  );
}