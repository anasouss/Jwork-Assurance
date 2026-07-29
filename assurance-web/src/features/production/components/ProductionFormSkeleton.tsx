import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ProductionFormSkeletonProps = {
  variant: "contract" | "avenant";
};

export function ProductionFormSkeleton({ variant }: ProductionFormSkeletonProps) {
  const sections = variant === "contract" ? 5 : 3;

  return (
    <div
      className="grid gap-4"
      aria-busy="true"
      aria-label="Chargement du formulaire"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-64 max-w-[70vw]" />
          <Skeleton className="h-4 w-80 max-w-[80vw]" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {Array.from({ length: sections }, (_, index) => (
        <Card key={index} className="overflow-hidden border-border/70 shadow-none">
          <CardHeader className="border-b bg-emerald-600 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-4 bg-white/45" />
              <Skeleton className="h-5 w-40 bg-white/45" />
              <Skeleton className="h-5 w-20 bg-white/30" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: index === 0 ? 6 : 3 }, (_, fieldIndex) => (
              <div key={fieldIndex} className="grid gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
