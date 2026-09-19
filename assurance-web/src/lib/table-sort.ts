import type { TableSortDirection } from "@/components/ui/sortable-table-head";

export function compareTableValues(
  left: string | number | boolean | null | undefined,
  right: string | number | boolean | null | undefined,
  direction: TableSortDirection,
) {
  if (left == null || left === "") return right == null || right === "" ? 0 : 1;
  if (right == null || right === "") return -1;

  const result = typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right), "fr", { numeric: true, sensitivity: "base" });

  return direction === "asc" ? result : -result;
}

export function nextTableSort<T extends string>(
  current: { column: T; direction: TableSortDirection },
  column: T,
) {
  return {
    column,
    direction: current.column === column && current.direction === "asc" ? "desc" as const : "asc" as const,
  };
}
