import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatDate } from "../dashboard-format";
import type { DashboardBreakdown } from "../types";
import { DashboardEmptyState as EmptyChart } from "./DashboardEmptyState";

const portfolioColors: Record<string, string> = {
  PARTICULIER: "#2563eb",
  CONVENTION: "#7c3aed",
  FLOTTE: "#059669",
  AUTOMOBILE: "#059669",
  ASSISTANCE: "#0284c7",
  RISQUES_DIVERS: "#7c3aed",
};

export function DashboardPortfolio({ rows, contractTypes, total, activeAssistances, date }: {
  rows: DashboardBreakdown[];
  contractTypes: DashboardBreakdown[];
  total: number;
  activeAssistances: number;
  date: string;
}) {
  return (
    <section className="min-w-0 border-y bg-card">
      <div className="border-b bg-foreground/[0.04] px-4 py-3">
        <h2 className="text-base font-semibold">Portefeuille en vigueur</h2>
        <p className="mt-1 text-xs text-muted-foreground">Contrats actuellement actifs couvrant le {formatDate(date)}</p>
      </div>
      <div className="p-4">
        <PortfolioChart rows={rows} contractTypes={contractTypes} total={total} />
        <dl className="mt-4 border-t pt-3"><div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Assistances rattachées en vigueur</dt>
          <dd className="font-semibold tabular-nums">{activeAssistances.toLocaleString("fr-FR")}</dd>
        </div></dl>
      </div>
    </section>
  );
}

function PortfolioChart({
  rows,
  contractTypes,
  total,
}: {
  rows: DashboardBreakdown[];
  contractTypes: DashboardBreakdown[];
  total: number;
}) {
  if (!rows.length || total === 0) return <EmptyChart message="Aucun contrat en vigueur à cette date." />;

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[144px_minmax(0,1fr)]">
      <div className="relative h-36 w-36 justify-self-center">
        <ChartContainer config={{ contrats: { label: "Contrats" } }} className="h-full w-full aspect-auto">
          <PieChart>
            <Pie
              data={rows}
              dataKey="nombre"
              nameKey="libelle"
              innerRadius={48}
              outerRadius={66}
              paddingAngle={3}
              strokeWidth={0}
            >
              {rows.map((row) => (
                <Cell key={row.code} fill={portfolioColors[row.code] ?? "#64748b"} />
              ))}
            </Pie>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel formatter={(value: unknown) => `${Number(value).toLocaleString("fr-FR")} contrat(s)`} />}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-2xl font-semibold">{total.toLocaleString("fr-FR")}</span>
          <span className="text-xs text-muted-foreground">contrats</span>
        </div>
      </div>
      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={row.code} className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
            <span className="flex items-center gap-2 text-sm">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: portfolioColors[row.code] ?? "#64748b" }} />
              {row.code === "ASSISTANCE" ? `Branche ${row.libelle}` : row.libelle}
            </span>
            <span className="font-semibold tabular-nums">{row.nombre.toLocaleString("fr-FR")}</span>
          </div>
        ))}
        {contractTypes.length ? (
          <div className="mt-2 border-t pt-3">
            <div className="text-xs text-muted-foreground">Par type de contrat</div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {contractTypes.map((row) => (
                <span key={row.code} className="whitespace-nowrap">
                  {row.libelle} <strong>{row.nombre.toLocaleString("fr-FR")}</strong>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
