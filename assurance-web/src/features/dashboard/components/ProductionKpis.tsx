import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/features/production/utils/format";
import { formatDate } from "../dashboard-format";
import type { DashboardData } from "../types";

export function ProductionKpis({ data, isFetching }: { data: DashboardData; isFetching: boolean }) {
  return (
      <section aria-labelledby="production-summary-title" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="production-summary-title" className="text-base font-semibold">Production</h2>
          <p className="text-xs text-muted-foreground" role="status">
            {isFetching ? "Actualisation… · " : ""}Du {formatDate(data.dateDu)} au {formatDate(data.dateAu)} · date d’effet
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Production TTC"
          value={formatMoney(data.kpis.primeTotale)}
          detail={`${data.kpis.quittances.toLocaleString("fr-FR")} quittance(s) d’assurance · ${data.kpis.assistancesProduites.toLocaleString("fr-FR")} assistance(s)`}
          primary
          comparison={data.comparaison.variationTtcPourcent}
          previousPeriod={data.comparaison}
        />
        <Metric
          label="Prime nette"
          value={formatMoney(data.kpis.primeNette)}
          detail={`${formatMoney(data.kpis.taxes)} de taxes et TPF`}
          comparison={data.comparaison.variationNettePourcent}
          previousPeriod={data.comparaison}
        />
        <Metric
          label="Mouvements validés"
          value={data.kpis.mouvements.toLocaleString("fr-FR")}
          detail="Tous types de mouvements validés"
        />
        <Metric
          label="Assistances produites"
          value={data.kpis.assistancesProduites.toLocaleString("fr-FR")}
          detail="Incluses dans les montants de production"
        />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Variations par rapport au {formatDate(data.comparaison.dateDu)} – {formatDate(data.comparaison.dateAu)}.</p>
      </section>
  );
}

function Metric({
  label,
  value,
  detail,
  primary = false,
  comparison,
  previousPeriod,
}: {
  label: string;
  value: string;
  detail: string;
  primary?: boolean;
  comparison?: number | null;
  previousPeriod?: { dateDu: string; dateAu: string };
}) {
  const surfaceClass = primary
    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
    : "border-border bg-card";
  const valueClass = primary ? "text-emerald-950 dark:text-emerald-100" : "text-foreground";
  const secondaryClass = primary ? "text-emerald-800/80 dark:text-emerald-200/80" : "text-muted-foreground";
  const ChangeIcon = comparison != null && comparison > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cn("min-w-0 rounded-md border p-4", surfaceClass)}>
      <p className={cn("text-sm font-medium", primary ? valueClass : secondaryClass)}>{label}</p>
      <p className={cn("mt-2 break-words text-2xl font-semibold leading-tight tabular-nums", valueClass)}>{value}</p>
      <p className={cn("mt-2 text-xs leading-5", secondaryClass)}>{detail}</p>
      {previousPeriod && <p className={cn("mt-2 flex flex-wrap items-center gap-1 text-xs", valueClass)} title={`Comparaison du ${formatDate(previousPeriod.dateDu)} au ${formatDate(previousPeriod.dateAu)}`}>
        {comparison == null ? <span className={secondaryClass}>Aucune base de comparaison</span> : <>
          {comparison !== 0 && <ChangeIcon aria-hidden="true" className={cn("size-3.5", comparison > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")} />}
          <span className="whitespace-nowrap font-medium tabular-nums">{comparison > 0 ? "+" : ""}{comparison.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</span>
          <span className={secondaryClass}>sur la période précédente</span>
        </>}
      </p>}
    </div>
  );
}
