import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminGuard } from "@/components/silence/AdminGuard";
import { AdminShell } from "@/components/silence/AdminShell";
import { GlassCard } from "@/components/silence/GlassCard";
import { listUsers, createUser, updateUser, adjustUserBalance, deleteUser, type UserRow } from "@/lib/users.functions";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, X, Search, Wallet, PauseCircle, PlayCircle, User as UserIcon, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — Silence API" }] }),
  component: () => (<AdminGuard><AdminShell><Inner /></AdminShell></AdminGuard>),
});

function Inner() {
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const update = useServerFn(updateUser);
  const adjust = useServerFn(adjustUserBalance);
  const del = useServerFn(deleteUser);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: () => list() });

  const [open, setOpen] = useState<null | { mode: "create" | "edit"; row?: UserRow }>(null);
  const [form, setForm] = useState({ email: "", password: "", initial_balance: 10 });
  const [confirmDel, setConfirmDel] = useState<UserRow | null>(null);
  const [balanceFor, setBalanceFor] = useState<UserRow | null>(null);
  const [balanceDelta, setBalanceDelta] = useState<number>(0);
  const [query, setQuery] = useState("");

  const createM = useMutation({
    mutationFn: () => create({ data: { email: form.email.trim(), password: form.password, initial_balance: Number(form.initial_balance) } }),
    onSuccess: () => { toast.success("User created"); setOpen(null); setForm({ email: "", password: "", initial_balance: 10 }); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const updateM = useMutation({
    mutationFn: (v: any) => update({ data: v }),
    onSuccess: () => { toast.success("Saved"); setOpen(null); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const suspendM = useMutation({
    mutationFn: (v: { id: string; suspended: boolean }) => update({ data: v }),
    onSuccess: (_, v) => { toast.success(v.suspended ? "Account suspended" : "Account reactivated"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const adjustM = useMutation({
    mutationFn: (v: { id: string; delta: number }) => adjust({ data: v }),
    onSuccess: () => { toast.success("Balance updated"); setBalanceFor(null); setBalanceDelta(0); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("User permanently deleted"); setConfirmDel(null); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => { toast.error(e?.message ?? "Failed"); setConfirmDel(null); },
  });

  const rows = q.data ?? [];
  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const s = query.toLowerCase();
    return rows.filter((r) => r.email.toLowerCase().includes(s));
  }, [rows, query]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    users: a.users + 1,
    suspended: a.suspended + (r.suspended ? 1 : 0),
    balance: a.balance + Number(r.total_balance),
    cost: a.cost + Number(r.total_cost),
  }), { users: 0, suspended: 0, balance: 0, cost: 0 }), [rows]);

  function openCreate() { setForm({ email: "", password: "", initial_balance: 10 }); setOpen({ mode: "create" }); }
  function openEdit(r: UserRow) { setForm({ email: r.email, password: "", initial_balance: 0 }); setOpen({ mode: "edit", row: r }); }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Create end-user accounts, allocate balance, suspend or permanently delete.</p>
        </div>
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> New user
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Users" value={String(totals.users)} icon={UserIcon} />
        <KPI label="Suspended" value={String(totals.suspended)} icon={PauseCircle} />
        <KPI label="Total balance" value={`$${totals.balance.toFixed(2)}`} icon={Wallet} />
        <KPI label="Total spend" value={`$${totals.cost.toFixed(4)}`} icon={ShieldAlert} />
      </div>

      <GlassCard className="p-4">
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[color:var(--hairline)] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by email"
            className="w-full bg-transparent text-sm outline-none" />
        </div>

        {q.isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center gap-2 py-16 text-center">
            <UserIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No users yet. Create the first one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => (
              <div key={r.id} className={`rounded-xl border p-4 transition ${r.suspended ? "border-red-200 bg-red-50/40" : "border-[color:var(--hairline)] bg-white"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--brand-soft)] text-[color:var(--brand-strong)] text-xs font-semibold">
                        {r.email.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{r.email}</div>
                        <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                  {r.suspended ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">SUSPENDED</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">ACTIVE</span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Balance" value={`$${Number(r.total_balance).toFixed(2)}`} />
                  <Stat label="Spent" value={`$${Number(r.total_cost).toFixed(4)}`} />
                  <Stat label="Requests" value={String(r.total_requests)} />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{r.key_count} API key{r.key_count === 1 ? "" : "s"}</div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button onClick={() => setBalanceFor(r)} title="Adjust balance"
                    className="inline-flex items-center gap-1 rounded-md border border-[color:var(--hairline)] bg-white px-2 py-1 text-xs hover:bg-[color:var(--brand-soft)]">
                    <Wallet className="h-3 w-3" /> Balance
                  </button>
                  <button onClick={() => openEdit(r)} title="Edit"
                    className="inline-flex items-center gap-1 rounded-md border border-[color:var(--hairline)] bg-white px-2 py-1 text-xs hover:bg-[color:var(--brand-soft)]">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button onClick={() => suspendM.mutate({ id: r.id, suspended: !r.suspended })}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${r.suspended ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}>
                    {r.suspended ? <><PlayCircle className="h-3 w-3" /> Reactivate</> : <><PauseCircle className="h-3 w-3" /> Suspend</>}
                  </button>
                  <button onClick={() => setConfirmDel(r)} title="Delete"
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {open && (
        <Modal onClose={() => setOpen(null)} title={open.mode === "create" ? "Create user" : "Edit user"}>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (open.mode === "create") {
              if (!form.email || form.password.length < 8) return toast.error("Email + 8-char password required");
              createM.mutate();
            } else {
              updateM.mutate({ id: open.row!.id, email: form.email || undefined, password: form.password || undefined });
            }
          }} className="space-y-3">
            <Field label="Email">
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-[color:var(--hairline)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/25" />
            </Field>
            <Field label={open.mode === "edit" ? "New password (leave blank to keep)" : "Password (min 8)"}>
              <input type="password" minLength={open.mode === "create" ? 8 : 0} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-[color:var(--hairline)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/25" />
            </Field>
            {open.mode === "create" && (
              <Field label="Initial balance (USD)">
                <input type="number" min={0} step="0.01" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: Number(e.target.value) })}
                  className="w-full rounded-lg border border-[color:var(--hairline)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/25" />
                <p className="mt-1 text-[11px] text-muted-foreground">A starter API key is auto-generated with this balance.</p>
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(null)} className="rounded-lg border border-[color:var(--hairline)] px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={createM.isPending || updateM.isPending}
                className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {(createM.isPending || updateM.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                {open.mode === "create" ? "Create user" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {balanceFor && (
        <Modal onClose={() => { setBalanceFor(null); setBalanceDelta(0); }} title={`Adjust balance — ${balanceFor.email}`}>
          <div className="space-y-3">
            <div className="rounded-lg bg-[color:var(--brand-soft)] p-3 text-sm">
              Current balance: <span className="font-semibold">${Number(balanceFor.total_balance).toFixed(2)}</span>
            </div>
            <Field label="Amount to add (use negative to deduct)">
              <input type="number" step="0.01" value={balanceDelta} onChange={(e) => setBalanceDelta(Number(e.target.value))}
                className="w-full rounded-lg border border-[color:var(--hairline)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/25" />
            </Field>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setBalanceFor(null); setBalanceDelta(0); }} className="rounded-lg border border-[color:var(--hairline)] px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => adjustM.mutate({ id: balanceFor.id, delta: balanceDelta })} disabled={adjustM.isPending || balanceDelta === 0}
                className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {adjustM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Apply
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)} title="Permanently delete user?">
          <div className="space-y-3">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              This will PERMANENTLY delete <b>{confirmDel.email}</b>, all their API keys, and their auth account. This cannot be undone.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} className="rounded-lg border border-[color:var(--hairline)] px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => delM.mutate(confirmDel.id)} disabled={delM.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {delM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete permanently
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KPI({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl border border-[color:var(--hairline)] bg-white p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[color:var(--brand-soft)]/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--hairline)] bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg border border-[color:var(--hairline)] p-1.5"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}