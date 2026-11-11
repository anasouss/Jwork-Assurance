import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  FileClock,
  RefreshCw,
  ReceiptText,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboardDateRange, type DatePreset } from "@/hooks/use-dashboard-date-range";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { formatMoney, moneyAmount } from "@/features/production/utils/format";
import { dashboardApi } from "../api";
import { DashboardCollectionSummary } from "../components/DashboardCollectionSummary";
import type {
  DashboardBreakdown,
  DashboardData,
  DashboardRecentActivity,
} from "../types";

const productionChartConfig = {
  primeTotale: { label: "Production TTC", theme: { light: "#059669", dark: "#34d399" } },
  primeNette: { label: "Prime nette", theme: { light: "#2563eb", dark: "#60a5fa" } },
} satisfies ChartConfig;

const portfolioColors: Record<string, string> = {
  PARTICULIER: "#2563eb",
  CONVENTION: "#7c3aed",
  FLOTTE: "#059669",
  AUTOMOBILE: "#059669",
  ASSISTANCE: "#0284c7",
  RISQUES_DIVERS: "#7c3aed",
};

const categoryColors: Record<string, string> = {
  AUTOMOBILE: "#059669",
  ASSISTANCE: "#0284c7",
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
  const queryClient = useQueryClient();
  const range = useDashboardDateRange("30d");
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const agenceId = useAuthStore((state) => state.user?.agenceId);
  const dashboard = useQuery({
    queryKey: ["agency-dashboard", agenceId, range.fromStr, range.toStr],
    queryFn: () => dashboardApi.get({ dateDu: range.fromStr, dateAu: range.toStr }),
    staleTime: 60_000,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === agenceId ? previousData : undefined,
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
          {range.activePreset !== "30d" && (
            <Button variant="ghost" onClick={() => range.setPreset("30d")}>Revenir aux 30 derniers jours</Button>
          )}
        </div>
      </div>
    );
  }

  const data = dashboard.data;
  const monthlyData = data.productionEvolution;
  const hasProduction = monthlyData.some((item) => item.primeTotale !== 0 || item.primeNette !== 0);

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-7" aria-busy={dashboard.isFetching}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">Production et suivi de l’agence</p>
        </div>
        {permissions.includes("contrat:create") && (
          <Button asChild size="sm"><Link to="/app/production/ajouter-dossier"><Plus className="size-4" />Nouveau dossier</Link></Button>
        )}
      </header>

      <section aria-label="Période de production" className="flex flex-wrap items-end justify-between gap-4 border-y py-4">
        <div className="grid w-full items-end gap-3 sm:w-auto sm:grid-cols-[170px_170px]">
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
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <div role="group" aria-label="Période rapide" className="flex min-h-9 flex-1 items-center gap-1 rounded-md border bg-muted/30 p-1 sm:flex-none">
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-pressed={range.activePreset === preset.value}
                  className={cn(
                    "h-7 flex-1 px-2.5 sm:flex-none",
                    range.activePreset === preset.value && "bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                  )}
                  onClick={() => range.setPreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" disabled={dashboard.isFetching}
                  aria-label="Actualiser les indicateurs" onClick={() => void queryClient.invalidateQueries({ queryKey: ["agency-dashboard"] })}>
                  <RefreshCw className={cn("size-4", dashboard.isFetching && "animate-spin motion-reduce:animate-none")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Actualiser les indicateurs</TooltipContent>
            </Tooltip>
        </div>
      </section>

      <section aria-labelledby="production-summary-title" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="production-summary-title" className="text-base font-semibold">Production</h2>
          <p className="text-xs text-muted-foreground" role="status">
            {dashboard.isFetching ? "Actualisation… · " : ""}Du {formatDate(data.dateDu)} au {formatDate(data.dateAu)} · date d’effet
          </p>
        </div>
        <div className="grid border-y bg-muted/20 sm:grid-cols-2 xl:grid-cols-4">
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

      <WorkQueue data={data} permissions={permissions} />

      <section aria-label="Analyse de la production sur la période" className="grid items-start gap-7 border-b pb-7 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
        <DashboardPanel
          title="Évolution de la production"
          description={`Du ${formatDate(data.dateDu)} au ${formatDate(data.dateAu)} · ${monthlyData[0]?.granularite === "DAY" ? "par jour" : "par mois"} · MAD`}
        >
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
        </DashboardPanel>

        <DashboardPanel title="Répartition par catégorie" description="Production TTC sur la même période · MAD">
          <CategoryChart rows={data.productionParCategorie} />
        </DashboardPanel>
      </section>

      <section aria-label="Encaissements et portefeuille" className="grid items-start gap-7 border-b pb-7 xl:grid-cols-2">
        <div className="grid min-w-0 gap-5">
          <DashboardCollectionSummary dateReference={data.dateReference} />
          <div className="border-t pt-4">
            <h2 className="text-sm font-semibold">Clients et dossiers <span className="font-normal text-muted-foreground">· au {formatDate(data.dateReference)}</span></h2>
            <dl className="mt-2 grid grid-cols-2 gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 py-2"><dt className="text-sm text-muted-foreground">Clients actifs</dt><dd className="text-lg font-semibold tabular-nums">{data.kpis.clientsActifs.toLocaleString("fr-FR")}</dd></div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 py-2"><dt className="text-sm text-muted-foreground">Dossiers en brouillon</dt><dd className="text-lg font-semibold tabular-nums">{data.kpis.contratsBrouillon.toLocaleString("fr-FR")}</dd></div>
          </dl>
          </div>
        </div>
        <DashboardPanel title="Portefeuille en vigueur" description={`Contrats actuellement actifs couvrant le ${formatDate(data.dateAu)}`}>
          <PortfolioChart rows={data.portefeuilleParBranche} contractTypes={data.portefeuilleParType} total={data.kpis.contratsActifs} />
          <dl className="mt-4 border-t pt-3"><div className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Assistances rattachées en vigueur</dt>
            <dd className="font-semibold tabular-nums">{data.kpis.assistancesActives.toLocaleString("fr-FR")}</dd>
          </div></dl>
        </DashboardPanel>
      </section>

      <RecentActivity
        rows={data.activitesRecentes}
        canView={permissions.includes("contrat:view")}
        dateFrom={data.dateDu}
        dateTo={data.dateAu}
      />
    </div>
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
  const markerClass = {
    emerald: "bg-emerald-600 dark:bg-emerald-400",
    blue: "bg-blue-600 dark:bg-blue-400",
    violet: "bg-violet-600 dark:bg-violet-400",
    amber: "bg-amber-600 dark:bg-amber-400",
  }[accent];
  const ChangeIcon = comparison != null && comparison > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="min-w-0 border-b px-4 py-4 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0 sm:[&:nth-child(even)]:border-l xl:border-b-0 xl:[&:not(:first-child)]:border-l">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-sm", markerClass)} />{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold leading-tight tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      {previousPeriod && <p className="mt-2 flex flex-wrap items-center gap-1 text-xs" title={`Comparaison du ${formatDate(previousPeriod.dateDu)} au ${formatDate(previousPeriod.dateAu)}`}>
        {comparison == null ? <span className="text-muted-foreground">Aucune base de comparaison</span> : <>
          {comparison !== 0 && <ChangeIcon aria-hidden="true" className={cn("size-3.5", comparison > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")} />}
          <span className="whitespace-nowrap font-medium tabular-nums">{comparison > 0 ? "+" : ""}{comparison.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</span>
          <span className="text-muted-foreground">sur la période précédente</span>
        </>}
      </p>}
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
    <section className="min-w-0">
      <div className="mb-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
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

function WorkQueue({ data, permissions }: { data: DashboardData; permissions: string[] }) {
  const rows = [
    {
      label: "Dossiers à échéance · 30 jours",
      value: data.workload.echeances30Jours,
      detail: `Du ${formatDate(data.workload.echeancesDu)} au ${formatDate(data.workload.echeancesAu)}`,
      icon: CalendarClock,
      href: `/app/production/echeances?dateDu=${data.workload.echeancesDu}&dateAu=${data.workload.echeancesAu}`,
      permissions: ["contrat:view"],
      color: "text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300",
    },
    {
      label: "Quittances sans affectation compagnie",
      value: data.workload.quittancesAAffecter,
      detail: "Aucune affectation compagnie enregistrée",
      icon: ReceiptText,
      href: "/app/compta/quittances?nature=SANS_QUITTANCE",
      permissions: ["quittance:view"],
      color: "text-orange-700 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-300",
    },
    {
      label: "Créances sans document",
      value: data.workload.documentsAEmettre,
      detail: "Solde restant, sans relevé ni facture émis",
      icon: FileClock,
      href: "/app/compta/releves-factures?tab=sources&sourceDocumentState=SANS_DOCUMENT",
      permissions: ["quittance:view"],
      color: "text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300",
    },
    {
      label: "Seuils de stock atteints",
      value: data.workload.alertesStock,
      detail: data.workload.controleStockActif ? "Seuils atteints par compagnie / usage" : "Contrôle à la saisie désactivé",
      icon: ShieldCheck,
      href: "/app/production/attestations-stock",
      permissions: ["attestation-stock:view", "attestation-stock:manage"],
      color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300",
    },
  ].filter((row) => row.permissions.some(permission => permissions.includes(permission)))
    .sort((left, right) => Number(right.value > 0) - Number(left.value > 0));

  if (!rows.length) return null;

  return (
    <section aria-labelledby="work-queue-title" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="work-queue-title" className="text-base font-semibold">À traiter</h2>
        <p className="text-xs text-muted-foreground">Situation au {formatDate(data.dateReference)}</p>
      </div>
      <div className="grid border-t md:grid-cols-2 md:gap-x-8">
        {rows.map((row) => (
          <Link key={row.label} to={row.href} className="group flex items-center gap-3 border-b py-3 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", row.value > 0 ? row.color : "bg-muted text-muted-foreground")}>
              <row.icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-medium group-hover:underline", row.value === 0 && "text-muted-foreground")}>{row.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{row.detail}</span>
            </span>
            <span className={cn("text-lg font-semibold tabular-nums", row.value === 0 && "text-muted-foreground")}>{row.value.toLocaleString("fr-FR")}</span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecentActivity({
  rows,
  canView,
  dateFrom,
  dateTo,
}: {
  rows: DashboardRecentActivity[];
  canView: boolean;
  dateFrom: string;
  dateTo: string;
}) {
  if (!canView) return null;
  return (
    <section className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Derniers mouvements validés</h2>
          <p className="mt-1 text-xs text-muted-foreground">Du {formatDate(dateFrom)} au {formatDate(dateTo)} · date d’effet</p>
        </div>
        {canView ? (
          <Button asChild variant="outline" size="sm">
            <Link to={`/app/production/registre?typeDate=EFFET&statut=VALIDE&dateDu=${dateFrom}&dateAu=${dateTo}`}>
              Voir la liste
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto border-y">
          <table className="w-full min-w-[940px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Police / contrat</th>
                <th className="px-4 py-3 font-semibold">Dossier</th>
                <th className="px-4 py-3 font-semibold">Mouvement</th>
                <th className="px-4 py-3 font-semibold">Compagnie</th>
                <th className="px-4 py-3 font-semibold">Date d'effet</th>
                <th className="px-4 py-3 text-right font-semibold">TTC (MAD)</th>
                <th className="w-12 px-4 py-3"><span className="sr-only">Consulter</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.mouvementId} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-semibold">{row.numeroPolice || "-"}</div>
                    <div className="text-xs text-muted-foreground">{row.branche || row.typeContrat}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{row.numeroDossier || `Contrat #${row.contratId}`}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.mouvement}</div>
                    {row.detail ? <div className="text-xs text-muted-foreground">{row.detail}</div> : null}
                  </td>
                  <td className="max-w-64 break-words px-4 py-3">{row.compagnie || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(row.dateEffet)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                    {moneyAmount(row.primeTotale)}
                  </td>
                  <td className="px-4 py-3">
                    {canView ? (
                      <Button asChild variant="ghost" size="icon" title="Voir le mouvement" aria-label={`Voir le mouvement ${row.mouvement} · ${row.numeroDossier || row.numeroPolice || row.contratId}`}>
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

function EmptyChart({ message = "Aucune production sur cette période." }: { message?: string }) {
  return (
    <div className="grid min-h-[200px] place-items-center px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function DashboardSkeleton() {
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
      <div className="grid border-y sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="grid gap-3 border-b p-5 xl:border-b-0 xl:border-r">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-60" />
        <Skeleton className="h-60" />
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
