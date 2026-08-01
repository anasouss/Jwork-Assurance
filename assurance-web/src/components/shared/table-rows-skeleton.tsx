import { Skeleton } from "@/components/ui/skeleton";

type TableRowsSkeletonProps = {
  rows?: number;
  colSpan: number;
  cellClassName?: string;
};

export function TableRowsSkeleton({ rows = 6, colSpan, cellClassName = "px-3 py-3" }: TableRowsSkeletonProps) {
  return Array.from({ length: rows }, (_, index) => (
    <tr key={index} className="border-b" aria-hidden="true">
      <td colSpan={colSpan} className={cellClassName}>
        <Skeleton className="h-9 w-full" />
      </td>
    </tr>
  ));
}
