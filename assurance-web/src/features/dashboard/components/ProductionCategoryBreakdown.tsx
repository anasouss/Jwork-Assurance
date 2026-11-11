import { cn } from "@/lib/utils";
import { moneyAmount } from "@/features/production/utils/format";
import type { DashboardBreakdown } from "../types";
import { DashboardEmptyState as EmptyChart } from "./DashboardEmptyState";

const categoryColors: Record<string, string> = {
  AUTOMOBILE: "#059669",
  ASSISTANCE: "#0284c7",
  CORPOREL: "#7c3aed",
  EVCAT: "#ea580c",
};

export function ProductionCategoryBreakdown({ rows }: { rows: DashboardBreakdown[] }) {
  return (
    <section className="min-w-0 border-y bg-card">
      <div className="border-b bg-foreground/[0.06] px-4 py-3">
        <h2 className="text-base font-semibold">Répartition par catégorie</h2>
        <p className="mt-1 text-xs text-muted-foreground">Production TTC sur la même période · MAD</p>
      </div>
      <div className="p-4"><CategoryChart rows={rows} /></div>
    </section>
  );
}

function CategoryChart({ rows }: { rows: DashboardBreakdown[] }) {
  if (!rows.length || rows.every(row => row.montant === 0)) return <EmptyChart />;
  const largestAmount = Math.max(...rows.map(row => Math.abs(row.montant)));

  return (
    <dl className="divide-y">
      {rows.map(row => (
        <div key={row.code} className="grid grid-cols-1 items-baseline gap-x-3 gap-y-2 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto]">
          <dt className="flex min-w-0 items-center gap-2 text-sm"><span aria-hidden="true" className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: categoryColors[row.code] ?? "#64748b" }} />{row.libelle}</dt>
          <dd className={cn("break-words text-sm font-semibold tabular-nums sm:text-right", row.montant < 0 && "text-destructive")}>{moneyAmount(row.montant)}</dd>
          <dd aria-hidden="true" className="h-1.5 overflow-hidden rounded-sm bg-muted sm:col-span-2">
            <div className="h-full rounded-sm" style={{ width: `${Math.abs(row.montant) / largestAmount * 100}%`, backgroundColor: row.montant < 0 ? "var(--destructive)" : categoryColors[row.code] ?? "#64748b" }} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
