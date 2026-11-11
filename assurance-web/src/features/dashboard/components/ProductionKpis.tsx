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
          accent="emerald"
          comparison={data.comparaison.variationTtcPourcent}
          previousPeriod={data.comparaison}
        />
        <Metric
          label="Prime nette"
          value={formatMoney(data.kpis.primeNette)}
          detail={`${formatMoney(data.kpis.taxes)} de taxes et TPF`}
          accent="blue"
          comparison={data.comparaison.variationNettePourcent}
          previousPeriod={data.comparaison}
        />
        <Metric
          label="Mouvements validés"
          value={data.kpis.mouvements.toLocaleString("fr-FR")}
          detail="Tous types de mouvements validés"
          accent="violet"
        />
        <Metric
          label="Assistances produites"
          value={data.kpis.assistancesProduites.toLocaleString("fr-FR")}
          detail="Incluses dans les montants de production"
          accent="amber"
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
  accent,
  comparison,
  previousPeriod,
}: {
  label: string;
  value: string;
  detail: string;
  accent: "emerald" | "blue" | "violet" | "amber";
  comparison?: number | null;
  previousPeriod?: { dateDu: string; dateAu: string };
}) {
  const tones = {
    emerald: { surface: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30", value: "text-emerald-900 dark:text-emerald-200", muted: "text-emerald-800/80 dark:text-emerald-200/80" },
    blue: { surface: "border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30", value: "text-blue-900 dark:text-blue-200", muted: "text-blue-800/80 dark:text-blue-200/80" },
    violet: { surface: "border-violet-200 bg-violet-50 dark:border-violet-900/60 dark:bg-violet-950/30", value: "text-violet-900 dark:text-violet-200", muted: "text-violet-800/80 dark:text-violet-200/80" },
    amber: { surface: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30", value: "text-amber-900 dark:text-amber-200", muted: "text-amber-800/80 dark:text-amber-200/80" },
  }[accent];
  const markerClass = {
    emerald: "bg-emerald-600 dark:bg-emerald-400",
    blue: "bg-blue-600 dark:bg-blue-400",
    violet: "bg-violet-600 dark:bg-violet-400",
    amber: "bg-amber-600 dark:bg-amber-400",
  }[accent];
  const ChangeIcon = comparison != null && comparison > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cn("min-w-0 rounded-md border p-4", tones.surface)}>
      <p className={cn("flex items-center gap-2 text-sm font-medium", tones.value)}><span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-sm", markerClass)} />{label}</p>
      <p className={cn("mt-2 break-words text-2xl font-semibold leading-tight tabular-nums", tones.value)}>{value}</p>
      <p className={cn("mt-2 text-xs leading-5", tones.muted)}>{detail}</p>
      {previousPeriod && <p className={cn("mt-2 flex flex-wrap items-center gap-1 text-xs", tones.value)} title={`Comparaison du ${formatDate(previousPeriod.dateDu)} au ${formatDate(previousPeriod.dateAu)}`}>
        {comparison == null ? <span className={tones.muted}>Aucune base de comparaison</span> : <>
          {comparison !== 0 && <ChangeIcon aria-hidden="true" className={cn("size-3.5", comparison > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")} />}
          <span className="whitespace-nowrap font-medium tabular-nums">{comparison > 0 ? "+" : ""}{comparison.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</span>
          <span className={tones.muted}>sur la période précédente</span>
        </>}
      </p>}
    </div>
  );
}
