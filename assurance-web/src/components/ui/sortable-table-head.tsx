import type { ReactNode } from "react";
import { SortIcon } from "@/components/ui/sort-icon";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type TableSortDirection = "asc" | "desc";

type SortableTableHeadProps<T extends string> = {
  children: ReactNode;
  column: T;
  activeColumn: T;
  direction: TableSortDirection;
  onSort: (column: T) => void;
  align?: "left" | "right";
  className?: string;
};

export function SortableTableHead<T extends string>({
  children,
  column,
  activeColumn,
  direction,
  onSort,
  align = "left",
  className,
}: SortableTableHeadProps<T>) {
  const active = column === activeColumn;

  return (
    <TableHead
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <button
        type="button"
        className={cn(
          "inline-flex w-full items-center gap-0 font-semibold transition-colors hover:text-white/80",
          align === "right" ? "justify-end" : "justify-start",
        )}
        onClick={() => onSort(column)}
      >
        {children}
        <SortIcon isActive={active} direction={direction} />
      </button>
    </TableHead>
  );
}
