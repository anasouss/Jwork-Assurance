import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type TableRowsSkeletonProps = {
  rows?: number;
  colSpan: number;
  cellClassName?: string;
};

export function TableRowsSkeleton({ rows = 6, colSpan, cellClassName = "px-3 py-3" }: TableRowsSkeletonProps) {
  return Array.from({ length: rows }, (_, index) => (
    <TableRow key={index} aria-hidden="true">
      <TableCell colSpan={colSpan} className={cellClassName}>
        <Skeleton className="h-9 w-full" />
      </TableCell>
    </TableRow>
  ));
}
