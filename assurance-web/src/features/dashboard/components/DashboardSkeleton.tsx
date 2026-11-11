import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-60 max-w-full" />
        </div>
        <Skeleton className="h-10 w-60 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="grid min-w-0 gap-3 rounded-md border p-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-72 rounded-md" />
    </div>
  );
}
