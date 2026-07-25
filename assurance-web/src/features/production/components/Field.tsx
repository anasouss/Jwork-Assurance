import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  hint,
  error,
  className,
  required = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <label
      className={cn(
        "grid gap-1.5 text-sm",
        "[&_[data-slot=input]]:border-slate-300 [&_[data-slot=input]]:bg-slate-50/70 [&_[data-slot=input]]:shadow-none",
        "[&_[data-slot=select-trigger]]:border-slate-300 [&_[data-slot=select-trigger]]:bg-slate-50/70 [&_[data-slot=select-trigger]]:shadow-none",
        "[&_[data-slot=date-trigger]]:border-slate-300 [&_[data-slot=date-trigger]]:bg-slate-50/70 [&_[data-slot=date-trigger]]:shadow-none",
        "[&_[data-slot=input]:disabled]:border-slate-200 [&_[data-slot=input]:disabled]:bg-slate-100",
        error ? "[&_[data-slot=input]]:border-red-500 [&_[data-slot=input]]:ring-1 [&_[data-slot=input]]:ring-red-500/20 [&_[data-slot=date-trigger]]:border-red-500" : "",
        "dark:[&_[data-slot=input]]:border-slate-600 dark:[&_[data-slot=input]]:bg-slate-900",
        "dark:[&_[data-slot=select-trigger]]:border-slate-600 dark:[&_[data-slot=select-trigger]]:bg-slate-900",
        "dark:[&_[data-slot=date-trigger]]:border-slate-600 dark:[&_[data-slot=date-trigger]]:bg-slate-900",
        className
      )}
    >
      <span className="font-medium">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
