import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  badge,
  children,
  action,
  defaultOpen = true,
  tone = "default",
}: {
  title: string;
  badge?: string;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  tone?: "default" | "production";
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader
        className={cn(
          "flex cursor-pointer flex-row items-center justify-between gap-3 space-y-0 py-3",
          tone === "production" && "bg-emerald-600 text-white"
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} />
          <CardTitle className="text-base">{title}</CardTitle>
          {badge ? <Badge variant={tone === "production" ? "outline" : "secondary"} className={tone === "production" ? "border-white/40 text-white" : ""}>{badge}</Badge> : null}
        </div>
        <div onClick={(event) => event.stopPropagation()}>{action}</div>
      </CardHeader>
      {open ? <CardContent className="pt-4">{children}</CardContent> : null}
    </Card>
  );
}
