import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatMoney } from "@/features/production/utils/format";
import { compactMoney, dateOnly, formatDate } from "../dashboard-format";
import type { DashboardData } from "../types";
import { DashboardEmptyState as EmptyChart } from "./DashboardEmptyState";

const productionChartConfig = {
  primeTotale: { label: "Production TTC", theme: { light: "#059669", dark: "#34d399" } },
  primeNette: { label: "Prime nette", theme: { light: "#2563eb", dark: "#60a5fa" } },
} satisfies ChartConfig;

export function ProductionTrendChart({ rows: monthlyData, dateFrom, dateTo }: {
  rows: DashboardData["productionEvolution"];
  dateFrom: string;
  dateTo: string;
}) {
  const hasProduction = monthlyData.some(item => item.primeTotale !== 0 || item.primeNette !== 0);
  return (
    <section className="min-w-0 border-y border-emerald-200 bg-card dark:border-emerald-900/60">
      <div className="border-b border-emerald-200/70 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <h2 className="text-base font-semibold text-emerald-950 dark:text-emerald-100">Évolution de la production</h2>
        <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">Du {formatDate(dateFrom)} au {formatDate(dateTo)} · {monthlyData[0]?.granularite === "DAY" ? "par jour" : "par mois"} · MAD</p>
      </div>
      <div className="p-4">
          <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <span className="flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2 border-emerald-600 dark:border-emerald-400" />Production TTC</span>
            <span className="flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2 border-dashed border-blue-600 dark:border-blue-400" />Prime nette</span>
          </div>
          {hasProduction ? (
            <ChartContainer config={productionChartConfig} className="h-[310px] w-full aspect-auto">
              <AreaChart data={monthlyData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="date" tickFormatter={(value: string) => format(dateOnly(value), monthlyData[0]?.granularite === "DAY" ? "dd MMM" : "MMM yy", { locale: fr })}
                  tickLine={false} axisLine={false} minTickGap={28} tickMargin={10} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  tickFormatter={(value) => compactMoney(Number(value))}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value: unknown) => formatDate(String(value))}
                      formatter={(value: unknown, name: unknown) => (
                        <div className="flex min-w-44 items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {productionChartConfig[String(name) as keyof typeof productionChartConfig]?.label}
                          </span>
                          <span className="font-medium tabular-nums">{formatMoney(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="primeTotale"
                  type="linear"
                  fill="var(--color-primeTotale)"
                  fillOpacity={0.07}
                  stroke="var(--color-primeTotale)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="primeNette"
                  type="linear"
                  fill="transparent"
                  stroke="var(--color-primeNette)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <EmptyChart />
          )}
      </div>
    </section>
  );
}
