import { GlassCard } from "./GlassCard";

export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="space-y-4">
      <h1 className="metallic-text text-2xl font-semibold">{title}</h1>
      <GlassCard className="p-6 text-sm text-muted-foreground">{note}</GlassCard>
    </div>
  );
}