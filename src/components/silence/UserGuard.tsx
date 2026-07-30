import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { verifySessionFingerprint } from "@/lib/security.functions";
import { computeFingerprint } from "@/lib/client-attest";

export function UserGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (alive) router.navigate({ to: "/user", replace: true });
        return;
      }
      // Must have a profile row (i.e. is an app user, not an admin-only)
      const { data: profile } = await supabase
        .from("profiles").select("id,suspended")
        .eq("id", userData.user.id).maybeSingle();
      if (!profile) {
        await supabase.auth.signOut();
        if (alive) router.navigate({ to: "/user", replace: true });
        return;
      }
      // Device-fingerprint check: kick if this session came from a different device
      try {
        const fp = await computeFingerprint();
        const res = await verifySessionFingerprint({ data: { fingerprint: fp } });
        if (res.bound && !res.ok) {
          await supabase.auth.signOut();
          if (alive) router.navigate({ to: "/user", replace: true });
          return;
        }
      } catch { /* fingerprint check best-effort */ }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [router]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}