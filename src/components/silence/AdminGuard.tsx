import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { verifySessionFingerprint } from "@/lib/security.functions";
import { computeFingerprint } from "@/lib/client-attest";

export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (alive) router.navigate({ to: "/admin", replace: true });
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) {
        await supabase.auth.signOut();
        if (alive) router.navigate({ to: "/admin", replace: true });
        return;
      }
      try {
        const fp = await computeFingerprint();
        const res = await verifySessionFingerprint({ data: { fingerprint: fp } });
        if (res.bound && !res.ok) {
          await supabase.auth.signOut();
          if (alive) router.navigate({ to: "/admin", replace: true });
          return;
        }
      } catch { /* best-effort */ }
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