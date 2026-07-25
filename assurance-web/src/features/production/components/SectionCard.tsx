import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SectionCard({
  title,
  badge,
  children,
  action,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
