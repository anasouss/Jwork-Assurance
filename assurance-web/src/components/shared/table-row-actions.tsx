import type { ComponentType } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TableRowAction = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

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
              {Icon ? <Icon className="size-4" /> : null}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
