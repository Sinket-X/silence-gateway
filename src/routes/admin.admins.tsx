import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminGuard } from "@/components/silence/AdminGuard";
import { AdminShell } from "@/components/silence/AdminShell";
import { GlassCard } from "@/components/silence/GlassCard";
import { listAdmins, createAdmin, updateAdmin, deleteAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, ShieldCheck, Users, Crown, Mail, KeyRound, X, Search, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/admin/admins")({
  head: () => ({ meta: [{ title: "Admins — Silence API" }] }),
  component: AdminsPage,
});

function AdminsPage() {
  return (
    <AdminGuard>
      <AdminShell><Inner /></AdminShell>
    </AdminGuard>
  );
}

function Inner() {
  const list = useServerFn(listAdmins);
  const create = useServerFn(createAdmin);
  const update = useServerFn(updateAdmin);
  const del = useServerFn(deleteAdmin);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admins"], queryFn: () => list() });

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null)); }, []);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<{ id?: string; email: string; password: string }>({ email: "", password: "" });

  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const createM = useMutation({
    mutationFn: () => create({ data: { email: form.email, password: form.password } }),
    onSuccess: () => { toast.success("Admin created"); closeModal(); qc.invalidateQueries({ queryKey: ["admins"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const updateM = useMutation({
    mutationFn: () => update({ data: { id: form.id!, email: form.email || undefined, password: form.password || undefined } }),
    onSuccess: () => { toast.success("Admin updated"); closeModal(); qc.invalidateQueries({ queryKey: ["admins"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Admin deleted"); setConfirmId(null); qc.invalidateQueries({ queryKey: ["admins"] }); },
    onError: (e: any) => { toast.error(e?.message ?? "Failed"); setConfirmId(null); },
  });

  function openCreate() { setMode("create"); setForm({ email: "", password: "" }); setOpen(true); }
  function openEdit(a: { id: string; email: string }) { setMode("edit"); setForm({ id: a.id, email: a.email, password: "" }); setOpen(true); }
  function closeModal() { setOpen(false); setForm({ email: "", password: "" }); }

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    if (!query.trim()) return rows;
    const s = query.toLowerCase();
    return rows.filter((a) => a.email.toLowerCase().includes(s));
  }, [q.data, query]);

  async function copyEmail(email: string) {
    try { await navigator.clipboard.writeText(email); setCopied(email); setTimeout(() => setCopied(null), 1200); } catch {}
  }

  const total = q.data?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="metallic-text text-2xl font-semibold sm:text-3xl">Admins</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage admin accounts with full dashboard access. At least one admin must always exist — you can't delete yourself.
          </p>
        </div>
        <button onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:shadow-primary/30">
          <Plus className="h-4 w-4" /> Add admin
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard icon={<Users className="h-4 w-4" />} label="Total Admins" value={total.toString()} sub="with full access" />
        <KpiCard icon={<ShieldCheck className="h-4 w-4" />} label="Your Role" value="Admin" sub="you are signed in" />
        <KpiCard icon={<Crown className="h-4 w-4" />} label="Owner" value={q.data?.[q.data.length - 1]?.email.split("@")[0] ?? "—"} sub="bootstrap account" />
      </div>

      {/* Toolbar */}
      <GlassCard className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search admins by email…"
            className="w-full rounded-lg border border-border bg-background/60 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </GlassCard>

      {/* Grid */}
      {q.isLoading && (
        <GlassCard className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></GlassCard>
      )}
      {q.data && q.data.length > 0 && filtered.length === 0 && (
        <GlassCard className="p-10 text-center text-sm text-muted-foreground">No admins match "{query}".</GlassCard>
      )}
      {q.data && q.data.length === 0 && (
        <GlassCard className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--brand-soft)]"><ShieldCheck className="h-6 w-6 text-primary" /></div>
          <div className="text-base font-medium">No admins yet</div>
          <div className="max-w-sm text-sm text-muted-foreground">Add your first admin — they'll get full access to the Silence dashboard.</div>
        </GlassCard>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a, i) => {
            const isMe = meId === a.id;
            const isOwner = i === filtered.length - 1; // oldest = bootstrap
            const initials = a.email.slice(0, 2).toUpperCase();
            return (
              <div key={a.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5">
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-70" />
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/80 to-primary text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate font-semibold leading-tight">{a.email.split("@")[0]}</div>
                      {isMe && <span className="inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">you</span>}
                      {isOwner && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"><Crown className="h-2.5 w-2.5" />owner</span>}
                    </div>
                    <button onClick={() => copyEmail(a.email)} className="mt-0.5 flex max-w-full items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground">
                      <span className="truncate">{a.email}</span>
                      {copied === a.email ? <Check className="h-3 w-3 shrink-0 text-emerald-500" /> : <Copy className="h-3 w-3 shrink-0 opacity-60" />}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Joined {new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> active
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/60 pt-3">
                  <button onClick={() => openEdit(a)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-[color:var(--brand-soft)] hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setConfirmId(a.id)}
                    disabled={isMe}
                    title={isMe ? "You can't delete yourself" : "Delete admin"}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in" onClick={closeModal}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 font-semibold">
                {mode === "create" ? <Plus className="h-4 w-4 text-primary" /> : <Pencil className="h-4 w-4 text-primary" />}
                {mode === "create" ? "Add admin" : "Edit admin"}
              </div>
              <button onClick={closeModal} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (mode === "create") { if (!form.email || form.password.length < 12) return toast.error("Email & password (min 12) required"); createM.mutate(); } else { updateM.mutate(); } }} className="space-y-4 p-5">
              <label className="block space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-muted-foreground"><Mail className="h-3 w-3" /> Email</div>
                <input type="email" required={mode === "create"} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@example.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
              <label className="block space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-muted-foreground"><KeyRound className="h-3 w-3" /> Password {mode === "edit" && <span className="opacity-60">(leave blank to keep current)</span>}</div>
                <input type="password" minLength={12} required={mode === "create"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="min 12 characters"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={closeModal} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={createM.isPending || updateM.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                  {(createM.isPending || updateM.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "create" ? "Create admin" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in" onClick={() => setConfirmId(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></div>
              <div>
                <div className="font-semibold">Delete admin?</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  This permanently removes <span className="font-mono text-foreground">{q.data?.find((a) => a.id === confirmId)?.email}</span> and revokes all access. This cannot be undone.
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmId(null)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => deleteM.mutate(confirmId)} disabled={deleteM.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60">
                {deleteM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <GlassCard className="relative overflow-hidden p-4">
      <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-[color:var(--brand-soft)] text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </GlassCard>
  );
}