import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Building2,
  CalendarClock,
  CircleDollarSign,
  ClipboardPenLine,
  FileText,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authApi } from "@/lib/api/auth";
import { moneyAmount } from "@/features/production/utils/format";
import { useDashboardDateRange, type DatePreset } from "@/hooks/use-dashboard-date-range";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { platformDashboardApi } from "../api";
import type { PlatformAgencyRow, PlatformProductionTrendPoint } from "../types";

const presets: Array<{ value: DatePreset; label: string }> = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "thisMonth", label: "Ce mois" },
  { value: "3m", label: "3 mois" },
];

const productionChartConfig = {
  primeNette: { label: "Prime nette", color: "#2563eb" },
  primeTotale: { label: "Production TTC", color: "#059669" },
} satisfies ChartConfig;

const portfolioChartConfig = {
  activeContracts: { label: "Contrats actifs", color: "#059669" },
  draftContracts: { label: "Brouillons", color: "#d97706" },
  prospects: { label: "Prospections", color: "#7c3aed" },
} satisfies ChartConfig;

export default function PlatformDashboardPage() {
  const navigate = useNavigate();
  const range = useDashboardDateRange("30d");
  const [agencyId, setAgencyId] = useState("ALL");
  const enterAgencyContext = useAuthStore((state) => state.enterAgencyContext);
  const switching = useAuthStore((state) => state.isSwitchingContext);
  const agencies = useQuery({
    queryKey: ["agency-context-options"],
    queryFn: authApi.agencyContextOptions,
    staleTime: 5 * 60_000,
  });
  const dashboard = useQuery({
    queryKey: ["platform-dashboard", range.fromStr, range.toStr, agencyId],
    queryFn: () => platformDashboardApi.get({
      dateDu: range.fromStr,
      dateAu: range.toStr,
      agenceId: agencyId === "ALL" ? undefined : agencyId,
    }),
    staleTime: 60_000,
  });

  async function openAgency(row: PlatformAgencyRow) {
    if (row.statut !== "ACTIVE") {
      toast.error("Seule une agence active peut être ouverte");
      return;
    }
    try {
      await enterAgencyContext(row.id);
      navigate("/app", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Agence impossible à ouvrir");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1700px] gap-5">
      <header className="grid gap-4 border-b pb-5">
        <div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Administration plateforme</p>
          <h1 className="mt-1 text-2xl font-semibold">Vue des agences</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Production consolidée et activité opérationnelle par agence.
          </p>
        </div>
        <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Agence</span>
            <Select value={agencyId} onValueChange={setAgencyId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les agences</SelectItem>
                {(agencies.data ?? []).map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>{agency.code} · {agency.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Date du</span>
            <DatePicker
              date={range.fromStr}
              maxDate={dateOnly(range.toStr)}
              onSelect={(date) => {
                if (date) range.setCustomRange(date, range.to);
              }}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Date au</span>
            <DatePicker
              date={range.toStr}
              minDate={dateOnly(range.fromStr)}
              onSelect={(date) => {
                if (date) range.setCustomRange(range.from, date);
              }}
            />
          </label>
          <div className="grid gap-1.5 text-sm md:col-span-2 xl:col-span-1">
            <span className="font-medium">Période rapide</span>
            <div className="flex h-9 items-center gap-1 rounded-md border bg-muted/30 p-1">
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  size="sm"
                  variant={range.activePreset === preset.value ? "default" : "ghost"}
                  className={cn("h-7 flex-1", range.activePreset === preset.value && "bg-blue-600 hover:bg-blue-700")}
                  onClick={() => range.setPreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {dashboard.isLoading ? (
        <div className="grid min-h-80 place-items-center text-sm text-muted-foreground">
          <LoaderCircle className="mb-2 size-6 animate-spin" />
          Chargement des indicateurs
        </div>
      ) : dashboard.isError || !dashboard.data ? (
        <div className="grid min-h-80 place-items-center text-center">
          <div>
            <p className="font-medium">Indicateurs indisponibles</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {dashboard.error instanceof Error ? dashboard.error.message : "La vue plateforme n'a pas pu être chargée."}
            </p>
            <Button className="mt-3" variant="outline" onClick={() => dashboard.refetch()}>
              <RefreshCw className="size-4" /> Réessayer
            </Button>
          </div>
        </div>
      ) : (
        <>
          <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Building2} label="Agences actives" value={`${dashboard.data.summary.activeAgencies}`} detail={`${dashboard.data.summary.totalAgencies} au total`} />
            <Metric icon={Users} label="Utilisateurs actifs" value={`${dashboard.data.summary.activeUsers}`} detail={`${dashboard.data.summary.totalUsers} compte(s) au total`} />
            <Metric icon={FileText} label="Contrats actifs" value={`${dashboard.data.summary.activeContracts}`} detail="Portefeuille en cours" />
            <Metric icon={CalendarClock} label="Échéances à 30 jours" value={`${dashboard.data.summary.upcomingExpiries}`} detail="À traiter dès aujourd'hui" />
            <Metric icon={ClipboardPenLine} label="Dossiers en préparation" value={`${dashboard.data.summary.draftContracts}`} detail={`${dashboard.data.summary.prospects} prospection(s)`} />
            <Metric icon={ReceiptText} label="Quittances émises" value={`${dashboard.data.summary.quittances}`} detail="Sur la période sélectionnée" />
            <Metric icon={CircleDollarSign} label="Prime nette" value={moneyAmount(dashboard.data.summary.primeNette)} detail="Sur la période sélectionnée" />
            <Metric icon={CircleDollarSign} label="Production TTC" value={moneyAmount(dashboard.data.summary.primeTotale)} detail={`${moneyAmount(dashboard.data.summary.taxes)} taxes et frais`} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <DashboardPanel
              title="Évolution de la production"
              description="Prime nette et montant TTC dans le temps sur la période sélectionnée."
            >
              <ProductionTrendChart rows={dashboard.data.productionTrend} />
            </DashboardPanel>
            <DashboardPanel
              title="Portefeuille par agence"
              description="Contrats actifs, brouillons et prospections actuellement enregistrés."
            >
              <AgencyPortfolioChart rows={dashboard.data.agencies} />
            </DashboardPanel>
          </section>

          <section className="overflow-hidden rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">Agences</h2>
                <p className="text-sm text-muted-foreground">Montants calculés sur la période sélectionnée.</p>
              </div>
              <Badge variant="info">{dashboard.data.summary.displayedAgencies} affichée(s)</Badge>
            </div>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Agence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Utilisateurs</TableHead>
                  <TableHead className="text-right">Portefeuille</TableHead>
                  <TableHead className="text-right">Échéances 30 j</TableHead>
                  <TableHead className="text-right">Quittances</TableHead>
                  <TableHead className="text-right">Prime nette</TableHead>
                  <TableHead className="text-right">Taxes et frais</TableHead>
                  <TableHead className="text-right">TTC</TableHead>
                  <TableHead className="w-28 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.data.agencies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                      Aucune agence ne correspond à la sélection.
                    </TableCell>
                  </TableRow>
                ) : dashboard.data.agencies.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.nom}</div>
                      <div className="text-xs text-muted-foreground">{row.code}{row.ville ? ` · ${row.ville}` : ""}</div>
                    </TableCell>
                    <TableCell><AgencyStatus status={row.statut} /></TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="font-medium">{row.activeUsers} actifs</div>
                      <div className="text-xs text-muted-foreground">{row.totalUsers} au total</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="font-medium">{row.activeContracts} actifs</div>
                      <div className="text-xs text-muted-foreground">{row.draftContracts} brouillon(s) · {row.prospects} prospection(s)</div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{row.upcomingExpiries}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.quittances}</TableCell>
                    <TableCell className="text-right tabular-nums">{moneyAmount(row.primeNette)}</TableCell>
                    <TableCell className="text-right tabular-nums">{moneyAmount(row.taxes)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{moneyAmount(row.primeTotale)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={switching || row.statut !== "ACTIVE"} onClick={() => void openAgency(row)}>
                        Ouvrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 border-b p-4 last:border-b-0 sm:border-r xl:border-b-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4 text-blue-600" />{label}</div>
      <div className="mt-2 truncate text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function AgencyStatus({ status }: { status: PlatformAgencyRow["statut"] }) {
  if (status === "ACTIVE") return <Badge variant="success">Active</Badge>;
  if (status === "SUSPENDED") return <Badge variant="warning">Suspendue</Badge>;
  return <Badge variant="gray">Archivée</Badge>;
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

function ProductionTrendChart({ rows }: { rows: PlatformProductionTrendPoint[] }) {
  const hasProduction = rows.some((row) => row.primeTotale > 0);
  if (!rows.length || !hasProduction) return <EmptyChart message="Aucune production sur cette période." />;
  const monthly = rows[0]?.granularite === "MONTH";
  const chartRows = rows.map((row) => ({
    ...row,
    label: format(dateOnly(row.date), monthly ? "MMM yy" : "dd MMM", { locale: fr }),
  }));

  return (
    <ChartContainer config={productionChartConfig} className="h-[300px] w-full aspect-auto">
      <LineChart data={chartRows} margin={{ left: 4, right: 12, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} width={72} tickFormatter={(value) => compactMoney(Number(value))} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent formatter={(value: unknown) => moneyAmount(Number(value))} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="primeTotale" type="monotone" stroke="var(--color-primeTotale)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        <Line dataKey="primeNette" type="monotone" stroke="var(--color-primeNette)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ChartContainer>
  );
}

function AgencyPortfolioChart({ rows }: { rows: PlatformAgencyRow[] }) {
  const chartRows = [...rows]
    .filter((row) => row.activeContracts + row.draftContracts + row.prospects > 0)
    .sort((left, right) => right.activeContracts - left.activeContracts)
    .slice(0, 10);
  if (!chartRows.length) return <EmptyChart message="Aucun dossier enregistré." />;

  return (
    <ChartContainer config={portfolioChartConfig} className="h-[300px] w-full aspect-auto">
      <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 14 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="code" tickLine={false} axisLine={false} width={92} />
        <ChartTooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.10)" }}
          content={<ChartTooltipContent formatter={(value: unknown) => `${Number(value).toLocaleString("fr-FR")} dossier(s)`} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="activeContracts" stackId="portfolio" fill="var(--color-activeContracts)" radius={[3, 0, 0, 3]} />
        <Bar dataKey="draftContracts" stackId="portfolio" fill="var(--color-draftContracts)" />
        <Bar dataKey="prospects" stackId="portfolio" fill="var(--color-prospects)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="grid min-h-[300px] place-items-center text-sm text-muted-foreground">{message}</div>;
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${moneyAmount(value / 1_000_000)} M`;
  if (Math.abs(value) >= 1_000) return `${moneyAmount(value / 1_000)} k`;
  return moneyAmount(value);
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}
