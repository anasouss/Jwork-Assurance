import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FilterFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  tone?: "default" | "emerald";
  container?: "label" | "div";
};

export function FilterField({
  label,
  children,
  className,
  labelClassName,
  tone = "default",
  container = "label",
}: FilterFieldProps) {
  const Container = container;
  return (
    <Container className={cn("grid min-w-0 gap-1.5", className)}>
      <span
        className={cn(
          "text-xs font-medium uppercase",
          tone === "emerald" && "font-semibold text-emerald-950 dark:text-emerald-100",
          labelClassName
        )}
      >
        {label}
      </span>
      {children}
    </Container>
  );
}
