import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapFirstAdmin } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { issueLoginChallenge, verifyLoginChallenge, preLoginCheck, recordLoginResult, bindSession } from "@/lib/security.functions";
import { startAttestation, computeFingerprint } from "@/lib/client-attest";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Silence API" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const router = useRouter();
  const bootstrap = useServerFn(bootstrapFirstAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const issue = useServerFn(issueLoginChallenge);
  const verify = useServerFn(verifyLoginChallenge);
  const pre = useServerFn(preLoginCheck);
  const record = useServerFn(recordLoginResult);
  const bind = useServerFn(bindSession);
  const challengeRef = useRef<string | null>(null);
  const attestRef = useRef<null | (() => ReturnType<ReturnType<typeof startAttestation>>)>(null);

  useEffect(() => { bootstrap().catch(() => {}); }, [bootstrap]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/admin/dashboard", replace: true });
    });
  }, [router]);

  useEffect(() => {
    attestRef.current = startAttestation();
    issue().then((r) => { challengeRef.current = r.token; }).catch(() => {});
  }, [issue]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const token = challengeRef.current;
      if (!token) throw new Error("Not ready. Reload the page.");
      const att = attestRef.current?.() ?? { webdriver: false, interactions: 0, dwellMs: 0, ua: "" };
      await verify({ data: { token, ...att } });
      await pre({ data: { email: email.trim() } });
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { await record({ data: { email: email.trim(), success: false } }).catch(() => {}); throw error; }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No session");
      const { data: role, error: rerr } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
      if (rerr) throw rerr;
      if (!role) { await supabase.auth.signOut(); throw new Error("Not an admin"); }
      const fp = await computeFingerprint();
      await bind({ data: { fingerprint: fp } });
      await record({ data: { email: email.trim(), success: true } }).catch(() => {});
      router.navigate({ to: "/admin/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Sign in failed");
      issue().then((r) => { challengeRef.current = r.token; }).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 hero-grid" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl btn-primary text-white">
            <span className="text-lg font-bold">S</span>
          </div>
          <span className="text-xl font-semibold tracking-tight">Silence<span className="text-[color:var(--brand)]">API</span></span>
        </Link>
        <div className="rounded-2xl border border-[color:var(--hairline)] bg-white p-7 shadow-[var(--shadow-glow)]">
          <div className="mb-5">
            <span className="brand-chip inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium">Admin only</span>
            <h1 className="mt-3 text-xl font-bold tracking-tight">Sign in to console</h1>
            <p className="mt-1 text-sm text-muted-foreground">Encrypted, rate-limited and monitored access.</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</span>
              <input type="email" autoComplete="username" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[color:var(--hairline)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/25" />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</span>
              <input type="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[color:var(--hairline)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/25" />
            </label>
            <button type="submit" disabled={busy}
              className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in securely
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">Brute-force protected · IP strikes enforced</p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" /> Bot &amp; session-hijack protected
        </p>
      </div>
    </div>
  );
}