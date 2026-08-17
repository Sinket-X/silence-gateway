import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminGuard } from "@/components/silence/AdminGuard";
import { AdminShell } from "@/components/silence/AdminShell";
import { GlassCard } from "@/components/silence/GlassCard";
import { listApiKeys, createApiKey, updateApiKey, adjustBalance, deleteApiKey } from "@/lib/api-keys.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Copy, Check, KeyRound, Power, Wallet, AlertCircle } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/silence/ConfirmDeleteModal";

export const Route = createFileRoute("/admin/api-keys")({
  head: () => ({ meta: [{ title: "API Keys — Silence API" }] }),
  component: () => (<AdminGuard><AdminShell><Inner /></AdminShell></AdminGuard>),
});

function Inner() {
  const list = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const update = useServerFn(updateApiKey);
  const adjust = useServerFn(adjustBalance);
  const del = useServerFn(deleteApiKey);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["api-keys"], queryFn: () => list() });

  const [label, setLabel] = useState("");
  const [balance, setBalance] = useState(0);
  const [revealed, setRevealed] = useState<{ id: string; raw: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const createM = useMutation({
    mutationFn: () => create({ data: { owner_label: label, balance: Number(balance) } }),
    onSuccess: (r: any) => {
      toast.success("API key created");
      setRevealed({ id: r.id, raw: r.raw_key });
      setLabel(""); setBalance(0);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const toggleM = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => update({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const adjustM = useMutation({
    mutationFn: (v: { id: string; delta: number }) => adjust({ data: v }),
    onSuccess: () => { toast.success("Balance updated"); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="metallic-text text-2xl font-semibold">API Keys</h1>
        <p className="text-sm text-muted-foreground">Issue keys for your customers. Only shown once at creation — store it safely.</p>
      </div>

      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Plus className="h-4 w-4" /> Create key</div>
        <form onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return toast.error("Label required"); createM.mutate(); }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto]">
          <input required placeholder="Owner label (e.g. user@x.com)" value={label} onChange={(e) => setLabel(e.target.value)}
            className="rounded-lg border border-border bg-input/40 px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
          <input type="number" min={0} step="0.01" placeholder="Starting balance" value={balance}
            onChange={(e) => setBalance(Number(e.target.value))}
            className="rounded-lg border border-border bg-input/40 px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
          <button type="submit" disabled={createM.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {createM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create
          </button>
        </form>
      </GlassCard>

      {revealed && (
        <GlassCard className="p-5 ring-2 ring-primary/40">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><KeyRound className="h-4 w-4" /> Save this key now — you won't see it again</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-input/60 px-3 py-2 font-mono text-xs">{revealed.raw}</code>
            <button onClick={() => { navigator.clipboard.writeText(revealed.raw); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={() => setRevealed(null)} className="rounded-md glass ring-metallic px-3 py-2 text-xs">Dismiss</button>
          </div>
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Requests</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (<tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>)}
              {q.data?.map((k) => (
                <tr key={k.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-medium">{k.owner_label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{k.key_prefix}…</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="font-mono">${Number(k.balance).toFixed(4)}</span>
                      <button onClick={() => { const v = prompt("Add balance (use negative to deduct)", "10"); if (v != null && !isNaN(Number(v))) adjustM.mutate({ id: k.id, delta: Number(v) }); }}
                        className="rounded-md glass ring-metallic p-1 hover:bg-[color:var(--brand-soft)]" title="Adjust"><Wallet className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{k.total_requests}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleM.mutate({ id: k.id, enabled: !k.enabled })}
                      className={"relative inline-flex h-5 w-9 items-center rounded-full transition " + (k.enabled ? "bg-primary" : "bg-slate-300")}>
                      <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition " + (k.enabled ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => toggleM.mutate({ id: k.id, enabled: !k.enabled })} className="rounded-md glass ring-metallic p-2 hover:bg-[color:var(--brand-soft)]" title="Toggle"><Power className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDeletingId(k.id)}
                        className="rounded-md glass ring-metallic p-2 text-destructive hover:bg-destructive/10" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {q.data && q.data.length === 0 && (<tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No API keys yet.</td></tr>)}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {deletingId && (
        <ConfirmDeleteModal
          title="Delete API Key"
          description="Are you sure you want to delete this API key? Any applications using this key will immediately lose access to the gateway."
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