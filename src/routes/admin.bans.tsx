import { createFileRoute } from "@tanstack/react-router";
import { AdminGuard } from "@/components/silence/AdminGuard";
import { AdminShell } from "@/components/silence/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBannedIps, listRecentStrikes, unbanIp, manualBanIp } from "@/lib/bans.functions";
import { useState, type HTMLAttributes, type ReactNode } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bans")({
  head: () => ({ meta: [{ title: "Banned IPs — Silence API" }] }),
  component: BansPage,
});

function BansPage() {
  const qc = useQueryClient();
  const bannedFn = useServerFn(listBannedIps);
  const strikesFn = useServerFn(listRecentStrikes);
  const unbanFn = useServerFn(unbanIp);
  const banFn = useServerFn(manualBanIp);

  const banned = useQuery({ queryKey: ["banned-ips"], queryFn: () => bannedFn() });
  const strikes = useQuery({ queryKey: ["ip-strikes"], queryFn: () => strikesFn() });

  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState(24);

  const doUnban = useMutation({
    mutationFn: (ipVal: string) => unbanFn({ data: { ip: ipVal } }),
    onSuccess: (_r, ipVal) => {
      toast.success(`Unbanned ${ipVal}`);
      qc.invalidateQueries({ queryKey: ["banned-ips"] });
      qc.invalidateQueries({ queryKey: ["ip-strikes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "unban failed"),
  });

  const doBan = useMutation({
    mutationFn: () => banFn({ data: { ip: ip.trim(), reason: reason.trim() || undefined, hours } }),
    onSuccess: () => {
      toast.success(`Banned ${ip} for ${hours}h`);
      setIp(""); setReason("");
      qc.invalidateQueries({ queryKey: ["banned-ips"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "ban failed"),
  });

  return (
    <AdminGuard>
      <AdminShell>
        <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-6">
          <header>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Banned IPs</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Auto-ban: 20 invalid-auth strikes in 10 min → 1h block. Valid API keys are never counted.
            </p>
          </header>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Active bans" value={banned.data?.filter((b: any) => b.active).length ?? 0} />
            <Kpi label="Total on record" value={banned.data?.length ?? 0} />
            <Kpi label="IPs with strikes" value={strikes.data?.length ?? 0} />
            <Kpi label="Threshold" value="20 / 10min" />
          </div>

          {/* Manual ban form */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-4 md:p-5">
            <h2 className="font-medium mb-3">Manual ban</h2>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_120px_auto]">
              <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="IP (e.g. 1.2.3.4)"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input type="number" min={1} max={720} value={hours} onChange={(e) => setHours(Number(e.target.value) || 1)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <button disabled={!ip.trim() || doBan.isPending}
                onClick={() => doBan.mutate()}
                className="rounded-md bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">
                {doBan.isPending ? "Banning…" : "Ban"}
              </button>
            </div>
          </div>

          {/* Banned table */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur overflow-hidden">
            <div className="p-4 md:p-5 border-b border-border/60 font-medium">Active & recent bans</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted/30">
                  <tr>
                    <Th>IP</Th><Th>Reason</Th><Th>Strikes</Th><Th>Banned</Th><Th>Expires</Th><Th>Status</Th><Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {banned.isLoading && <tr><td colSpan={7} className="p-4 text-muted-foreground">Loading…</td></tr>}
                  {banned.data?.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No bans on record.</td></tr>}
                  {banned.data?.map((b: any) => (
                    <tr key={b.ip} className="border-t border-border/40">
                      <Td className="font-mono">{b.ip}</Td>
                      <Td className="max-w-xs truncate" title={b.reason}>{b.reason}</Td>
                      <Td>{b.strikes ?? 0}</Td>
                      <Td>{fmt(b.banned_at)}</Td>
                      <Td>{b.expires_at ? fmt(b.expires_at) : "—"}</Td>
                      <Td>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${b.active ? "bg-red-500/15 text-red-500" : "bg-muted text-muted-foreground"}`}>
                          {b.active ? "active" : "expired"}
                        </span>
                      </Td>
                      <Td>
                        <button
                          onClick={() => { if (confirm(`Unban ${b.ip}?`)) doUnban.mutate(b.ip); }}
                          className="rounded-md border border-border bg-background hover:bg-accent px-3 py-1 text-xs">
                          Unban
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Strikes table */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur overflow-hidden">
            <div className="p-4 md:p-5 border-b border-border/60 font-medium">Strike log (last 200)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted/30">
                  <tr><Th>IP</Th><Th>Count</Th><Th>Reason</Th><Th>Last</Th></tr>
                </thead>
                <tbody>
                  {strikes.data?.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No strikes recorded.</td></tr>}
                  {strikes.data?.map((s: any) => (
                    <tr key={s.ip} className="border-t border-border/40">
                      <Td className="font-mono">{s.ip}</Td>
                      <Td>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${s.count >= 20 ? "bg-red-500/15 text-red-500" : s.count >= 10 ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                          {s.count}
                        </span>
                      </Td>
                      <Td>{s.last_reason}</Td>
                      <Td>{fmt(s.last_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}

function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
const Th = ({ children, className = "" }: { children?: ReactNode; className?: string }) => <th className={`text-left px-4 py-2 font-medium ${className}`}>{children}</th>;
const Td = ({ children, className = "", ...props }: HTMLAttributes<HTMLTableCellElement>) => <td className={`px-4 py-2 ${className}`} {...props}>{children}</td>;
const fmt = (v?: string) => v ? new Date(v).toLocaleString() : "—";
