import { Skeleton } from "@/components/ui/skeleton";

export function ProspectionDialogSkeleton() {
  return (
    <div className="grid gap-3" aria-label="Chargement du devis">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-9 w-2/3" />
    </div>
  );
}
