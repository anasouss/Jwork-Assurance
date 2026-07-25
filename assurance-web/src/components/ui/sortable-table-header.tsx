import { memo } from "react"
import { TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SortIcon } from "@/components/ui/sort-icon"

export interface SortableColumn {
  key: string
  label: string
  sortable?: boolean
  className?: string
}

interface SortableTableHeaderProps {
  columns: SortableColumn[]
  sortField: string
  sortDirection: "asc" | "desc"
  onSort: (field: string) => void
}

export const SortableTableHeader = memo(function SortableTableHeader({
  columns,
  sortField,
  sortDirection,
  onSort,
}: SortableTableHeaderProps) {
  return (
    <TableHeader>
      <TableRow className="bg-muted/50">
        {columns.map((column) => (
          <TableHead key={column.key} className={column.className || "font-medium"}>
            {column.sortable !== false ? (
              <button
                onClick={() => onSort(column.key)}
                className="flex items-center hover:text-foreground transition-colors"
              >
                {column.label}
                <SortIcon isActive={sortField === column.key} direction={sortDirection} />
              </button>
            ) : (
              column.label
            )}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
})
