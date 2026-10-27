import type { ComponentType } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TableRowAction = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  iconTone?: "neutral" | "primary" | "success" | "warning";
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

const ICON_TONE_CLASS = {
  neutral: "",
  primary: "text-blue-600 dark:text-blue-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
} as const;

export function TableRowActions({
  actions,
  label = "Actions",
}: {
  actions: TableRowAction[];
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.label}
              disabled={action.disabled}
              variant={action.destructive ? "destructive" : "default"}
              onSelect={action.onSelect}
            >
              {Icon ? (
                <Icon className={cn("size-4", ICON_TONE_CLASS[action.iconTone ?? "neutral"])} />
              ) : null}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
