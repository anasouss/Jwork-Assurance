import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type ServerPaginationProps = {
  page: number;
  totalPages: number;
  loading?: boolean;
  totalElements?: number;
  className?: string;
  labelClassName?: string;
  showCurrentPage?: boolean;
  onPageChange: (page: number) => void;
};

export function ServerPagination({
  page,
  totalPages,
  loading = false,
  totalElements,
  className,
  labelClassName,
  showCurrentPage = false,
  onPageChange,
}: ServerPaginationProps) {
  const normalizedTotalPages = Math.max(1, totalPages);
  const currentPage = Math.min(Math.max(0, page), normalizedTotalPages - 1);
  const previousDisabled = currentPage <= 0 || loading;
  const nextDisabled = currentPage >= normalizedTotalPages - 1 || loading;
  const resultText = totalElements == null ? "" : ` · ${totalElements} résultat(s)`;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className={cn("text-sm text-muted-foreground", labelClassName)}>
        Page {currentPage + 1} / {normalizedTotalPages}{resultText}
      </div>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={previousDisabled}
              className={previousDisabled ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (!previousDisabled) onPageChange(currentPage - 1);
              }}
            />
          </PaginationItem>
          {showCurrentPage ? (
            <PaginationItem>
              <span className="flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium">
                {currentPage + 1}
              </span>
            </PaginationItem>
          ) : null}
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={nextDisabled}
              className={nextDisabled ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (!nextDisabled) onPageChange(currentPage + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
