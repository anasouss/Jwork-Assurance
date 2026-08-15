import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  FileClock,
  RefreshCw,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardDateRange, type DatePreset } from "@/hooks/use-dashboard-date-range";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { formatMoney, moneyAmount } from "@/features/production/utils/format";
import { dashboardApi } from "../api";
import type {
  DashboardBreakdown,
  DashboardData,
  DashboardRecentActivity,
} from "../types";

const productionChartConfig = {
  primeTotale: { label: "Production TTC", color: "#059669" },
  primeNette: { label: "Prime nette", color: "#2563eb" },
} satisfies ChartConfig;

const portfolioColors: Record<string, string> = {
  PARTICULIER: "#2563eb",
  CONVENTION: "#7c3aed",
  FLOTTE: "#059669",
};

const categoryColors: Record<string, string> = {
  AUTOMOBILE: "#059669",
  CORPOREL: "#7c3aed",
  EVCAT: "#ea580c",
};

const presets: Array<{ value: DatePreset; label: string }> = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "thisMonth", label: "Ce mois" },
  { value: "3m", label: "3 mois" },
];

export default function AgencyDashboardPage() {
  const range = useDashboardDateRange("30d");
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const dashboard = useQuery({
    queryKey: ["agency-dashboard", range.fromStr, range.toStr],
    queryFn: () => dashboardApi.get({ dateDu: range.fromStr, dateAu: range.toStr }),
    staleTime: 60_000,
  });

  if (dashboard.isLoading) {
    return <DashboardSkeleton />;
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <div className="grid max-w-md justify-items-center gap-3 text-center">
          <AlertTriangle className="size-8 text-amber-600" />
          <div>
            <h1 className="font-semibold">Tableau de bord indisponible</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {dashboard.error instanceof Error
                ? dashboard.error.message
                : "Les indicateurs n'ont pas pu être chargés."}
            </p>
          </div>
          <Button variant="outline" onClick={() => dashboard.refetch()}>
            <RefreshCw className="size-4" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const data = dashboard.data;
  const monthlyData = data.productionMensuelle.map((item) => ({
    ...item,
    label: format(new Date(item.annee, item.mois - 1, 1), "MMM yy", { locale: fr }),
  }));

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-5">
      <header className="flex flex-col gap-4 border-b pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Pilotage de l'agence</p>
          <h1 className="mt-1 text-2xl font-semibold">Vue générale</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Production validée, portefeuille et tâches à traiter.
          </p>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[190px_190px_auto]">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Du</span>
            <DatePicker
              date={range.fromStr}
              maxDate={dateOnly(range.toStr)}
              onSelect={(date) => {
                if (date) range.setCustomRange(date, range.to);
              }}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Au</span>
            <DatePicker
              date={range.toStr}
              minDate={dateOnly(range.fromStr)}
              onSelect={(date) => {
                if (date) range.setCustomRange(range.from, date);
              }}
            />
          </label>
          <div className="grid gap-1.5 text-sm sm:col-span-2 xl:col-span-1">
            <span className="font-medium">Période rapide</span>
            <div className="flex h-9 items-center gap-1 rounded-md border bg-muted/30 p-1">
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  size="sm"
                  variant={range.activePreset === preset.value ? "default" : "ghost"}
                  className={cn(
                    "h-7 flex-1",
                    range.activePreset === preset.value && "bg-emerald-600 text-white hover:bg-emerald-700"
                  )}
                  onClick={() => range.setPreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Production TTC"
          value={formatMoney(data.kpis.primeTotale)}
          detail={`${data.kpis.quittances.toLocaleString("fr-FR")} quittance(s)`}
          accent="emerald"
        />
        <Metric
          label="Prime nette"
          value={formatMoney(data.kpis.primeNette)}
          detail={`${formatMoney(data.kpis.taxes)} de taxes et TPF`}
          accent="blue"
        />
        <Metric
          label="Mouvements validés"
          value={data.kpis.mouvements.toLocaleString("fr-FR")}
          detail={`Du ${formatDate(data.dateDu)} au ${formatDate(data.dateAu)}`}
          accent="violet"
        />
        <Metric
          label="Portefeuille actif"
          value={`${data.kpis.contratsActifs.toLocaleString("fr-FR")} contrats`}
          detail={`${data.kpis.clientsActifs.toLocaleString("fr-FR")} clients · ${data.kpis.contratsBrouillon.toLocaleString("fr-FR")} brouillons`}
          accent="amber"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <DashboardPanel
          title="Évolution de la production"
          description="Montants issus des quittances globales validées sur la période."
        >
          {monthlyData.length ? (
            <ChartContainer config={productionChartConfig} className="h-[310px] w-full aspect-auto">
              <AreaChart data={monthlyData} margin={{ left: 4, right: 12, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(value) => compactMoney(Number(value))}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value: unknown, name: unknown) => (
                        <div className="flex min-w-44 items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {productionChartConfig[String(name) as keyof typeof productionChartConfig]?.label}
                          </span>
                          <span className="font-mono font-medium">{formatMoney(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="primeTotale"
                  type="monotone"
                  fill="var(--color-primeTotale)"
                  fillOpacity={0.12}
                  stroke="var(--color-primeTotale)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="primeNette"
                  type="monotone"
                  fill="transparent"
                  stroke="var(--color-primeNette)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <EmptyChart />
          )}
        </DashboardPanel>

        <DashboardPanel title="Portefeuille actif" description="Répartition des contrats en vigueur.">
          <PortfolioChart rows={data.portefeuilleParType} />
        </DashboardPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.65fr)]">
        <DashboardPanel title="Production par catégorie" description="Montant TTC validé sur la période.">
          <CategoryChart rows={data.productionParCategorie} />
        </DashboardPanel>
        <WorkQueue data={data} permissions={permissions} />
      </section>

      <RecentActivity rows={data.activitesRecentes} canView={permissions.includes("contrat:view")} />
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: "emerald" | "blue" | "violet" | "amber";
}) {
  const accentClass = {
    emerald: "border-t-emerald-500",
    blue: "border-t-blue-500",
    violet: "border-t-violet-500",
    amber: "border-t-amber-500",
  }[accent];
  return (
    <div className={cn("min-w-0 border-t-2 p-5 sm:[&:not(:nth-child(odd))]:border-l xl:[&:not(:first-child)]:border-l", accentClass)}>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={detail}>{detail}</p>
    </div>
  );
}

function DashboardPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-md border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function PortfolioChart({ rows }: { rows: DashboardBreakdown[] }) {
  const total = rows.reduce((sum, row) => sum + row.nombre, 0);
  if (!rows.length || total === 0) return <EmptyChart />;

  return (
    <div className="grid min-h-[310px] items-center gap-4 sm:grid-cols-[180px_1fr] xl:grid-cols-1 2xl:grid-cols-[180px_1fr]">
      <div className="relative h-44">
        <ChartContainer config={{ contrats: { label: "Contrats" } }} className="h-full w-full aspect-auto">
          <PieChart>
            <Pie
              data={rows}
              dataKey="nombre"
              nameKey="libelle"
              innerRadius={54}
              outerRadius={78}
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
              {row.libelle}
            </span>
            <span className="font-semibold tabular-nums">{row.nombre.toLocaleString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryChart({ rows }: { rows: DashboardBreakdown[] }) {
  if (!rows.length) return <EmptyChart />;
  const config = Object.fromEntries(
    rows.map((row) => [row.code, { label: row.libelle, color: categoryColors[row.code] ?? "#64748b" }])
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-[260px] w-full aspect-auto">
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 14 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => compactMoney(Number(value))} />
        <YAxis type="category" dataKey="libelle" tickLine={false} axisLine={false} width={82} />
        <ChartTooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.10)" }}
          content={<ChartTooltipContent hideLabel formatter={(value: unknown) => formatMoney(Number(value))} />}
        />
        <Bar dataKey="montant" radius={[0, 3, 3, 0]}>
          {rows.map((row) => (
            <Cell key={row.code} fill={categoryColors[row.code] ?? "#64748b"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function WorkQueue({ data, permissions }: { data: DashboardData; permissions: string[] }) {
  const rows = [
    {
      label: "Échéances dans les 30 jours",
      value: data.workload.echeances30Jours,
      detail: "Contrats actifs arrivant à échéance",
      icon: CalendarClock,
      href: "/app/production/echeances",
      permission: "contrat:view",
      color: "text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300",
    },
    {
      label: "Quittances à affecter",
      value: data.workload.quittancesAAffecter,
      detail: "Numéro de quittance compagnie manquant",
      icon: ReceiptText,
      href: "/app/compta/quittances?avecQuittance=false",
      permission: "quittance:view",
      color: "text-orange-700 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-300",
    },
    {
      label: "Documents à émettre",
      value: data.workload.documentsAEmettre,
      detail: "Quittances sans relevé ou facture émis",
      icon: FileClock,
      href: "/app/compta/releves-factures",
      permission: "quittance:view",
      color: "text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300",
    },
    {
      label: "Alertes de stock",
      value: data.workload.alertesStock,
      detail: data.workload.controleStockActif ? "Seuils de stock atteints" : "Contrôle de stock désactivé",
      icon: ShieldCheck,
      href: "/app/production/attestations-stock",
      permission: "contrat:view",
      color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300",
    },
  ].filter((row) => permissions.includes(row.permission));

  return (
    <section className="min-w-0 rounded-md border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">À traiter</h2>
        <p className="mt-1 text-xs text-muted-foreground">Files opérationnelles calculées sur les données actuelles.</p>
      </div>
      <div className="divide-y">
        {rows.map((row) => (
          <Link key={row.label} to={row.href} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", row.color)}>
              <row.icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{row.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{row.detail}</span>
            </span>
            <span className="text-xl font-semibold tabular-nums">{row.value.toLocaleString("fr-FR")}</span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecentActivity({ rows, canView }: { rows: DashboardRecentActivity[]; canView: boolean }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <div>
          <h2 className="font-semibold">Activité récente</h2>
          <p className="mt-1 text-xs text-muted-foreground">Derniers mouvements validés de l'agence.</p>
        </div>
        {canView ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/app/production/contrats">
              Voir la liste
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Dossier</th>
                <th className="px-4 py-3 font-semibold">Mouvement</th>
                <th className="px-4 py-3 font-semibold">Compagnie</th>
                <th className="px-4 py-3 font-semibold">Date d'effet</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.mouvementId} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-semibold">{row.numeroDossier || `Contrat #${row.contratId}`}</div>
                    <div className="text-xs text-muted-foreground">{row.numeroPolice || row.typeContrat}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.mouvement}</div>
                    <div className="text-xs text-muted-foreground">{row.codeMouvement}</div>
                  </td>
                  <td className="max-w-64 truncate px-4 py-3">{row.compagnie || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(row.dateEffet)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                    {formatMoney(row.primeTotale)}
                  </td>
                  <td className="px-4 py-3">
                    {canView ? (
                      <Button asChild variant="ghost" size="icon" title="Voir le mouvement">
                        <Link to={`/app/production/contrats/${row.contratId}?mouvementId=${row.mouvementId}`}>
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">Aucun mouvement validé.</div>
      )}
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="grid min-h-[260px] place-items-center text-sm text-muted-foreground">
      Aucune production sur cette période.
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-5">
      <div className="flex items-end justify-between border-b pb-5">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-80" />
      </div>
      <div className="grid overflow-hidden rounded-md border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="grid gap-3 border-b p-5 xl:border-b-0 xl:border-r">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.65fr_0.75fr]">
        <Skeleton className="h-[390px] rounded-md" />
        <Skeleton className="h-[390px] rounded-md" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.65fr]">
        <Skeleton className="h-[340px] rounded-md" />
        <Skeleton className="h-[340px] rounded-md" />
      </div>
      <Skeleton className="h-72 rounded-md" />
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-").map(Number);
  return format(new Date(year, month - 1, day), "dd/MM/yyyy");
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${moneyAmount(value / 1_000_000)} M`;
  if (Math.abs(value) >= 1_000) return `${moneyAmount(value / 1_000)} k`;
  return moneyAmount(value);
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}
