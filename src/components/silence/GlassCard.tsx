import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div className={cn("glass card-3d rounded-2xl", className)} {...rest}>
      {children}
    </div>
  );
}