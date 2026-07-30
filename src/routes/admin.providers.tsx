import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminGuard } from "@/components/silence/AdminGuard";
import { AdminShell } from "@/components/silence/AdminShell";
import { GlassCard } from "@/components/silence/GlassCard";
import {
  listProviders, upsertProvider, deleteProvider, toggleProvider, getProviderSecrets,
  type ProviderRow,
} from "@/lib/providers.functions";
import {
  listTokens, upsertToken, deleteToken, toggleToken, testToken, getTokenSecret,
  type ProviderTokenRow,
} from "@/lib/provider-tokens.functions";
import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, Pencil, Zap, X, CheckCircle2, XCircle, Eye, EyeOff,
  ChevronDown, ChevronRight, KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/admin/providers")({
  head: () => ({ meta: [{ title: "Providers — Silence API" }] }),
  component: () => (<AdminGuard><AdminShell><ProvidersPage /></AdminShell></AdminGuard>),
});

type ProviderForm = {
  id?: string; name: string; base_url: string; headers_json: string;
  enabled: boolean; priority: number; notes: string;
  rpm_limit: number; rps_limit: number; hourly_limit: number;
  daily_limit: number; monthly_limit: number;
  requires_auth: boolean;
};
const emptyProvider: ProviderForm = {
  name: "", base_url: "", headers_json: "", enabled: true, priority: 100, notes: "",
  rpm_limit: 0, rps_limit: 0, hourly_limit: 0, daily_limit: 0, monthly_limit: 0,
  requires_auth: true,
};

function ProvidersPage() {
  const list = useServerFn(listProviders);
  const upsert = useServerFn(upsertProvider);
  const del = useServerFn(deleteProvider);
  const toggle = useServerFn(toggleProvider);
  const getSecrets = useServerFn(getProviderSecrets);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["providers"], queryFn: () => list() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProviderForm>(emptyProvider);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const saveM = useMutation({
    mutationFn: () => upsert({ data: {
      id: form.id, name: form.name, base_url: form.base_url || undefined,
      headers_json: form.headers_json || null,
      enabled: form.enabled, priority: Number(form.priority),
      rpm_limit: Number(form.rpm_limit) || 0,
      rps_limit: Number(form.rps_limit) || 0,
      hourly_limit: Number(form.hourly_limit) || 0,
      daily_limit: Number(form.daily_limit) || 0,
      monthly_limit: Number(form.monthly_limit) || 0,
      notes: form.notes || null,
      requires_auth: form.requires_auth,
    } }),
    onSuccess: (r: any) => {
      toast.success(form.id ? "Provider updated" : "Provider added");
      qc.invalidateQueries({ queryKey: ["providers"] });
      // After creating, keep modal open and switch to edit mode so tokens can be added.
      if (!form.id && r?.id) setForm((f) => ({ ...f, id: r.id }));
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["providers"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const toggleM = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  async function beginEdit(p: ProviderRow) {
    try {
      const s = await getSecrets({ data: { id: p.id } });
      setForm({
        id: p.id, name: p.name, base_url: s.base_url,
        headers_json: s.headers_json, enabled: p.enabled,
        priority: p.priority, notes: p.notes ?? "",
        rpm_limit: p.rpm_limit, rps_limit: p.rps_limit,
        hourly_limit: (p as any).hourly_limit ?? 0,
        daily_limit: p.daily_limit, monthly_limit: p.monthly_limit,
        requires_auth: (p as any).requires_auth !== false,
      });
      setOpen(true);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="metallic-text text-2xl font-semibold tracking-tight">Providers</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Upstream services with auto-rotating tokens.</p>
        </div>
        <button onClick={() => { setForm(emptyProvider); setOpen(true); }}
          className="btn-primary inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> Add<span className="hidden sm:inline"> provider</span>
        </button>
      </div>

      <div className="space-y-3">
        {q.isLoading && <GlassCard className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></GlassCard>}
        {q.data && q.data.length === 0 && (
          <div className="relative overflow-hidden rounded-2xl border border-dashed border-[color:var(--border)] bg-gradient-to-b from-[color:var(--brand-soft)]/40 to-transparent p-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 ring-1 ring-inset ring-primary/20">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold">No providers yet</h3>
            <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted-foreground">
              Add your first upstream service like OpenAI, Anthropic, or Groq. You can attach multiple API tokens per provider — the gateway rotates them by priority, RPM/RPS, and balance.
            </p>
            <button onClick={() => { setForm(emptyProvider); setOpen(true); }}
              className="btn-primary mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Add your first provider
            </button>
          </div>
        )}
        {q.data?.map((p) => {
          const isOpen = expanded[p.id] ?? true;
          return (
            <GlassCard key={p.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <button onClick={() => setExpanded((s) => ({ ...s, [p.id]: !isOpen }))} className="rounded-md p-1 hover:bg-[color:var(--brand-soft)]">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="min-w-[140px] font-semibold">{p.name}</div>
                <code className="hidden truncate font-mono text-xs text-muted-foreground sm:inline">{p.base_url_masked}</code>
                <div className="flex-1" />
                <div className="text-xs text-muted-foreground">priority {p.priority}</div>
                <button onClick={() => toggleM.mutate({ id: p.id, enabled: !p.enabled })}
                  className={"relative inline-flex h-5 w-9 items-center rounded-full transition " + (p.enabled ? "bg-primary" : "bg-slate-300")}>
                  <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition " + (p.enabled ? "translate-x-4" : "translate-x-0.5")} />
                </button>
                <button onClick={() => beginEdit(p)} className="rounded-md glass ring-metallic p-2 hover:bg-[color:var(--brand-soft)]" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => { if (confirm(`Delete provider ${p.name}? All its tokens will be removed.`)) deleteM.mutate(p.id); }}
                  className="rounded-md glass ring-metallic p-2 text-destructive hover:bg-[color:var(--brand-soft)]" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {isOpen && <TokensSection providerId={p.id} />}
            </GlassCard>
          );
        })}
      </div>

      {open && <ProviderModal form={form} setForm={setForm} onClose={() => setOpen(false)} onSave={() => saveM.mutate()} saving={saveM.isPending} />}
    </div>
  );
}

function ProviderModal({ form, setForm, onClose, onSave, saving }: { form: ProviderForm; setForm: (f: ProviderForm) => void; onClose: () => void; onSave: () => void; saving: boolean; }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4">
      <div className="my-8 w-full max-w-3xl rounded-2xl border border-border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-card/95 backdrop-blur px-5 py-3">
          <div className="font-semibold">{form.id ? "Edit provider" : "Add provider"}</div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-[color:var(--brand-soft)]"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return toast.error("Name required"); if (!form.id && !form.base_url) return toast.error("Base URL required"); onSave(); }}
          className="space-y-6 p-5">

          <Section title="Basics" subtitle="Provider identity and upstream endpoint.">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Presets:</span>
              <button type="button" onClick={() => setForm({
                ...form,
                name: form.name || "General Compute",
                base_url: "https://api.generalcompute.com/v1",
                rpm_limit: 100, rps_limit: 0, hourly_limit: 0,
                daily_limit: 50000, monthly_limit: 0,
              })} className="rounded-full glass ring-metallic px-3 py-1 text-xs hover:bg-[color:var(--brand-soft)]">General Compute (100 rpm · 50k/day)</button>
              <button type="button" onClick={() => setForm({ ...form, name: form.name || "OpenAI", base_url: "https://api.openai.com/v1" })}
                className="rounded-full glass ring-metallic px-3 py-1 text-xs hover:bg-[color:var(--brand-soft)]">OpenAI</button>
              <button type="button" onClick={() => setForm({ ...form, name: form.name || "Groq", base_url: "https://api.groq.com/openai/v1" })}
                className="rounded-full glass ring-metallic px-3 py-1 text-xs hover:bg-[color:var(--brand-soft)]">Groq</button>
            </div>
            <Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} placeholder="OpenAI, Groq, Together…" /></Field>
            <Field label="Base URL" hint="OpenAI-compatible base, e.g. https://api.openai.com/v1"><input required={!form.id} value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} className={inp} placeholder="https://api.openai.com/v1" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority" hint="Lower = tried first"><input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className={inp} /></Field>
              <Field label="Enabled">
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Route traffic through this provider
                </label>
              </Field>
            </div>
            <Field label="Extra headers (JSON)" hint='Optional. e.g. {"X-Org":"acme"}'>
              <textarea rows={2} value={form.headers_json} onChange={(e) => setForm({ ...form, headers_json: e.target.value })} className={inp + " font-mono text-xs"} />
            </Field>
            <Field label="Authentication">
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={!form.requires_auth} onChange={(e) => setForm({ ...form, requires_auth: !e.target.checked })} />
                <span>
                  <span className="font-medium">Keyless provider</span>
                  <span className="block text-xs text-muted-foreground">Upstream doesn't need an API key. Gateway will call it without an Authorization header — no tokens required.</span>
                </span>
              </label>
            </Field>
          </Section>

          <Section title="Provider limits" subtitle="Caps applied across ALL tokens of this provider. 0 = unlimited.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="RPM" hint="requests/min"><input type="number" value={form.rpm_limit} onChange={(e) => setForm({ ...form, rpm_limit: Number(e.target.value) })} className={inp} /></Field>
              <Field label="RPS" hint="requests/sec"><input type="number" value={form.rps_limit} onChange={(e) => setForm({ ...form, rps_limit: Number(e.target.value) })} className={inp} /></Field>
              <Field label="RPH" hint="requests/hour"><input type="number" value={form.hourly_limit} onChange={(e) => setForm({ ...form, hourly_limit: Number(e.target.value) })} className={inp} /></Field>
              <Field label="Daily" hint="requests/day"><input type="number" value={form.daily_limit} onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })} className={inp} /></Field>
              <Field label="Monthly" hint="requests/month"><input type="number" value={form.monthly_limit} onChange={(e) => setForm({ ...form, monthly_limit: Number(e.target.value) })} className={inp} /></Field>
            </div>
          </Section>

          <Field label="Notes"><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inp} /></Field>

          <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-end gap-2 rounded-b-2xl border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
            <button type="button" onClick={onClose} className="rounded-lg glass ring-metallic px-4 py-2 text-sm">Close</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {form.id ? "Save changes" : "Create provider"}
            </button>
          </div>
        </form>

        <div className="border-t border-border px-5 py-5">
          <Section title="API tokens" subtitle="Add as many keys as you want. Gateway rotates by priority + RPM/RPS + balance. When one hits its limit, the next takes over automatically.">
            {form.requires_auth === false ? (
              <div className="rounded-xl border border-dashed border-border bg-[color:var(--brand-soft)]/30 p-4 text-center text-xs text-muted-foreground">
                This provider is marked <b>keyless</b> — no tokens needed. Uncheck "Keyless provider" above to manage tokens.
              </div>
            ) : form.id ? (
              <TokensSection providerId={form.id} />
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-[color:var(--brand-soft)]/30 p-4 text-center text-xs text-muted-foreground">
                Create the provider first — then add tokens with their own balance and rate limits here.
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type TokenForm = {
  id?: string; provider_id: string; label: string; api_key: string;
  enabled: boolean; priority: number; balance: number;
  notes: string;
};
function emptyToken(pid: string): TokenForm {
  return { provider_id: pid, label: "token", api_key: "", enabled: true, priority: 100, balance: 100, notes: "" };
}

function TokensSection({ providerId }: { providerId: string }) {
  const list = useServerFn(listTokens);
  const upsert = useServerFn(upsertToken);
  const del = useServerFn(deleteToken);
  const toggle = useServerFn(toggleToken);
  const test = useServerFn(testToken);
  const getSecret = useServerFn(getTokenSecret);
  const qc = useQueryClient();
  const key = ["provider-tokens", providerId];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { provider_id: providerId } }) });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TokenForm>(emptyToken(providerId));
  const [testingId, setTestingId] = useState<string | null>(null);

  const saveM = useMutation({
    mutationFn: () => upsert({ data: { ...form, api_key: form.api_key || undefined } as any }),
    onSuccess: () => { toast.success(form.id ? "Token updated" : "Token added"); setOpen(false); setForm(emptyToken(providerId)); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Token deleted"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const toggleM = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const testM = useMutation({
    mutationFn: (id: string) => test({ data: { id } }),
    onMutate: (id) => setTestingId(id),
    onSettled: () => setTestingId(null),
    onSuccess: (r: any) => {
      if (r.ok) toast.success(`Healthy · ${r.status} · ${r.latency_ms}ms`);
      else toast.error(`Unhealthy · ${r.status || "err"} · ${(r.detail ?? "").slice(0, 120)}`);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e?.message ?? "Test failed"),
  });

  async function beginEdit(t: ProviderTokenRow) {
    try {
      const s = await getSecret({ data: { id: t.id } });
      setForm({
        id: t.id, provider_id: providerId, label: t.label, api_key: s.api_key,
        enabled: t.enabled, priority: t.priority, balance: Number(t.balance),
        notes: t.notes ?? "",
      });
      setOpen(true);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div className="border-t border-border/60 bg-[color:var(--brand-soft)]/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" /> Tokens ({q.data?.length ?? 0})
        </div>
        <button onClick={() => { if (open && !form.id) { setOpen(false); return; } setForm(emptyToken(providerId)); setOpen(true); }}
          className="btn-primary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white">
          <Plus className={"h-3.5 w-3.5 transition-transform " + (open && !form.id ? "rotate-45" : "")} /> {open && !form.id ? "Close" : "Add token"}
        </button>
      </div>
      {open && (
        <div className="mb-3 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300">
          <InlineTokenForm form={form} setForm={setForm} onClose={() => { setOpen(false); setForm(emptyToken(providerId)); }} onSave={() => saveM.mutate()} saving={saveM.isPending} />
        </div>
      )}
      {q.isLoading && <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
      {q.data && q.data.length === 0 && <div className="py-4 text-center text-xs text-muted-foreground">No tokens yet. Add one so the gateway can call this provider.</div>}
      {q.data && q.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="text-left uppercase tracking-wider text-muted-foreground/80">
              <tr>
                <th className="px-2 py-2">Label</th>
                <th className="px-2 py-2">Key</th>
                <th className="px-2 py-2">Balance</th>
                <th className="px-2 py-2">Used today</th>
                <th className="px-2 py-2">Health</th>
                <th className="px-2 py-2">On</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((t) => (
                <tr key={t.id} className="border-t border-border/40">
                  <td className="px-2 py-2 font-medium">{t.label}</td>
                  <td className="px-2 py-2 font-mono text-muted-foreground">{t.api_key_masked}</td>
                  <td className="px-2 py-2 font-mono">${t.balance.toFixed(2)}</td>
                  <td className="px-2 py-2 font-mono">{t.requests_today}</td>
                  <td className="px-2 py-2">
                    <span className={
                      t.health === "healthy" ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 ring-1 ring-emerald-500/30"
                      : t.health === "unhealthy" ? "inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-red-600 ring-1 ring-red-500/30"
                      : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-muted-foreground ring-1 ring-slate-200"
                    }>
                      {t.health === "healthy" ? <CheckCircle2 className="h-3 w-3" /> : t.health === "unhealthy" ? <XCircle className="h-3 w-3" /> : null}
                      {t.health}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <button onClick={() => toggleM.mutate({ id: t.id, enabled: !t.enabled })}
                      className={"relative inline-flex h-4 w-8 items-center rounded-full transition " + (t.enabled ? "bg-primary" : "bg-slate-300")}>
                      <span className={"inline-block h-3 w-3 transform rounded-full bg-white transition " + (t.enabled ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => testM.mutate(t.id)} disabled={testingId === t.id} className="rounded-md p-1.5 hover:bg-white/60" title="Test">
                        {testingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => beginEdit(t)} className="rounded-md p-1.5 hover:bg-white/60" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm(`Delete token "${t.label}"?`)) delM.mutate(t.id); }} className="rounded-md p-1.5 text-destructive hover:bg-white/60" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

function InlineTokenForm({ form, setForm, onClose, onSave, saving }: { form: TokenForm; setForm: (f: TokenForm) => void; onClose: () => void; onSave: () => void; saving: boolean; }) {
  const [showKey, setShowKey] = useState(false);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!form.label.trim()) return toast.error("Label required"); if (!form.id && !form.api_key) return toast.error("API key required"); onSave(); }}
      className="rounded-xl border border-border bg-card/80 backdrop-blur p-4 shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--primary)_25%,transparent)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-primary" /> {form.id ? "Edit token" : "New token"}</div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-[color:var(--brand-soft)]"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_120px]">
        <Field label="Label"><input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={inp} placeholder="key #1" /></Field>
        <Field label="Balance ($)"><input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })} className={inp} placeholder="0.00" /></Field>
        <Field label="Priority" hint="lower first"><input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className={inp} /></Field>
      </div>
      <div className="mt-3">
        <Field label="API key" hint={form.id ? "leave blank to keep existing" : "paste provider secret — encrypted at rest"}>
          <div className="relative">
            <input type={showKey ? "text" : "password"} value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} className={inp + " pr-10 font-mono"} placeholder="sk-..." autoFocus />
            <button type="button" onClick={() => setShowKey((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-[color:var(--brand-soft)]">{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled — include in rotation
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="rounded-lg glass ring-metallic px-3 py-1.5 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {form.id ? "Save" : "Add token"}
          </button>
        </div>
      </div>
    </form>
  );
}

const inp = "w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}{hint && <span className="ml-2 font-normal opacity-70">{hint}</span>}</div>
      {children}
    </div>
  );
}