import { createFileRoute } from "@tanstack/react-router";
import { AdminGuard } from "@/components/silence/AdminGuard";
import { AdminShell } from "@/components/silence/AdminShell";
import { Placeholder } from "@/components/silence/Placeholder";

export const Route = createFileRoute("/admin/fallbacks")({
  head: () => ({ meta: [{ title: "Fallbacks — Silence API" }] }),
  component: () => (
    <AdminGuard><AdminShell><Placeholder title="Fallbacks" note="Coming next phase — per-model, per-provider, and global fallback chains." /></AdminShell></AdminGuard>
  ),
});