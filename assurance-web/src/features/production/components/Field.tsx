import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  hint,
  className,
  required = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <label
      className={cn(
        "grid gap-1.5 text-sm",
        "[&_[data-slot=input]]:border-slate-300 [&_[data-slot=input]]:bg-slate-50/70 [&_[data-slot=input]]:shadow-none",
        "[&_[data-slot=input]:disabled]:border-slate-200 [&_[data-slot=input]:disabled]:bg-slate-100",
        "dark:[&_[data-slot=input]]:border-slate-700 dark:[&_[data-slot=input]]:bg-background",
        className
      )}
    >
      <span className="font-medium">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
