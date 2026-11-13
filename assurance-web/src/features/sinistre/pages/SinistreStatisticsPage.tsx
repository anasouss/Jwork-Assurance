import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Banknote, ChartColumn, CircleCheck, Clock3, FileCheck2, FolderOpen, Receipt, RefreshCw, ShieldCheck, Undo2, type LucideIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sinistreApi, sinistreKeys } from "../api";
import { formatDate } from "../format";
import { moneyAmount } from "@/features/production/utils/format";
import type { SinistreStatistics } from "../types";

const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const STAGE_COLORS: Record<string, string> = {
  OUVERTURE: "#0284c7", EXPERTISE_AVANT: "#0891b2", INSTANCE_CLIENT: "#d97706",
  EXPERTISE_APRES: "#6366f1", COMPAGNIE: "#2563eb", CLOTURE: "#059669",
};
const METRIC_TONES = {
  blue: { icon: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300", value: "text-sky-800 dark:text-sky-300" },
  amber: { icon: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", value: "text-amber-800 dark:text-amber-300" },
  green: { icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", value: "text-emerald-800 dark:text-emerald-300" },
  teal: { icon: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300", value: "text-teal-800 dark:text-teal-300" },
  neutral: { icon: "bg-muted text-muted-foreground", value: "text-foreground" },
};
const SECTION_TONES = {
  blue: "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40",
  amber: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
  teal: "border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/30",
};
const count = (value: number) => value.toLocaleString("fr-MA").replace(/[\u00a0\u202f]/g, " ");

export default function SinistreStatisticsPage() {
  const [params, setParams] = useSearchParams();
  const currentYear = new Date().getFullYear();
  const requestedYear = Number(params.get("annee"));
  const year = Number.isInteger(requestedYear) && requestedYear >= 1900 && requestedYear <= currentYear ? requestedYear : currentYear;
  const statistics = useQuery({ queryKey: sinistreKeys.statistics(year), queryFn: () => sinistreApi.statistics(year) });
  const data = statistics.data;
  const years = data?.anneesDisponibles ?? [...new Set([currentYear, year])];

  return <div className="grid min-w-0 gap-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-xl font-semibold">Statistiques des sinistres</h1>
        <p className="mt-1 text-sm text-muted-foreground">Déclarations {year}{data ? ` · situation au ${formatDate(data.dateSituation)}` : ""}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1.5 text-xs font-medium">Année de déclaration
          <Select value={String(year)} onValueChange={(value) => setParams({ annee: value })}>
            <SelectTrigger className="w-32" aria-label="Année de déclaration"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <Button variant="outline" size="icon" title="Actualiser les statistiques" aria-label="Actualiser les statistiques" disabled={statistics.isFetching} onClick={() => statistics.refetch()}><RefreshCw className={`size-4 ${statistics.isFetching ? "animate-spin" : ""}`} /></Button>
        <Button asChild variant="outline"><Link to="/app/sinistre"><ArrowLeft className="size-4" />Module sinistres</Link></Button>
      </div>
    </header>

    {statistics.isError ? <div role="alert" className="border-y border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {statistics.error instanceof Error ? statistics.error.message : "Chargement des statistiques impossible."}
    </div> : statistics.isPending ? <div aria-label="Chargement des statistiques" className="grid gap-4">
      <Skeleton className="h-24 w-full" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
    </div> : data ? <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Hors brouillons et dossiers annulés</span>
        <div className="flex flex-wrap gap-4"><span>{count(data.rejetes)} rejeté(s)</span><span className={data.actionsEnRetard ? "font-semibold text-red-700 dark:text-red-300" : ""}>{count(data.actionsEnRetard)} action(s) en retard</span></div>
      </div>
      <dl className="grid grid-cols-2 border-y bg-card md:grid-cols-4">
        <Metric label="Dossiers déclarés" value={count(data.declares)} icon={FileCheck2} tone="blue" />
        <Metric label="Encore ouverts" value={count(data.ouverts)} icon={FolderOpen} tone="amber" />
        <Metric label="Clôturés" value={count(data.clotures)} icon={CircleCheck} tone="green" />
        <Metric label="Délai moyen de clôture" value={data.delaiMoyenClotureJours == null ? "-" : `${count(data.delaiMoyenClotureJours)} jours`} icon={Clock3} />
      </dl>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ChartSection title="Déclarations par mois" subtitle="Date de déclaration" empty={data.declares === 0} tone="blue">
          <ChartContainer config={{ declarations: { label: "Déclarations", color: "#0284c7" } }} className="h-[260px] w-full aspect-auto">
            <BarChart data={data.evolution} accessibilityLayer margin={{ left: -12, right: 12, top: 10 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 4" />
              <XAxis dataKey="mois" tickFormatter={(value: number) => MONTHS[value - 1]} axisLine={false} tickLine={false} minTickGap={18} tickMargin={10} />
              <YAxis allowDecimals={false} tickFormatter={count} axisLine={false} tickLine={false} width={48} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(value: unknown) => MONTHS[Number(value) - 1]} />} />
              <Bar dataKey="declarations" fill="var(--color-declarations)" maxBarSize={36} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </ChartSection>
        <Distribution title="Étapes de suivi" subtitle="Étape actuelle des dossiers de l’année" rows={data.parEtape} colors={STAGE_COLORS} empty={data.declares === 0} tone="amber" />
      </div>
      <section className="min-w-0 border-y bg-card">
        <SectionHeader title="Situation financière" subtitle="Cumul des opérations non annulées de ces dossiers · MAD" tone="teal" />
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          <Metric label="Provisions ouvertes" value={moneyAmount(data.provisionsOuvertes)} icon={ShieldCheck} tone="amber" />
          <Metric label="Règlements cumulés" value={moneyAmount(data.reglementsCumules)} icon={Banknote} tone="blue" />
          <Metric label="Recours cumulés" value={moneyAmount(data.recoursCumules)} icon={Undo2} tone="teal" />
          <Metric label="Frais cumulés" value={moneyAmount(data.fraisCumules)} icon={Receipt} />
        </dl>
      </section>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Distribution title="Répartition par branche" subtitle="Dossiers déclarés" rows={data.parBranche} empty={data.declares === 0} tone="teal" />
        <section className="min-w-0 border-y bg-card">
          <SectionHeader title="Situation par compagnie" subtitle="Dossiers et montants cumulés · MAD" tone="blue" />
          <div className="overflow-x-auto"><Table className="min-w-[680px]">
            <TableHeader className="bg-muted/50"><TableRow><TableHead>Compagnie</TableHead><TableHead className="text-right">Dossiers</TableHead><TableHead className="text-right">Provisions</TableHead><TableHead className="text-right">Règlements</TableHead><TableHead className="text-right">Recours</TableHead><TableHead className="text-right">Frais</TableHead></TableRow></TableHeader>
            <TableBody>{data.parCompagnie.map((company) => <TableRow key={company.id}>
              <TableCell className="font-medium">{company.nom}</TableCell><TableCell className="text-right tabular-nums">{count(company.dossiers)}</TableCell>
              {[company.provisions, company.reglements, company.recours, company.frais].map((amount, index) => <TableCell key={index} className="text-right tabular-nums">{moneyAmount(amount)}</TableCell>)}
            </TableRow>)}
              {!data.parCompagnie.length ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Aucun dossier déclaré sur cette année.</TableCell></TableRow> : null}
            </TableBody>
          </Table></div>
        </section>
      </div>
    </> : null}
  </div>;
}

function Metric({ label, value, icon: Icon, tone = "neutral" }: { label: string; value: string; icon: LucideIcon; tone?: keyof typeof METRIC_TONES }) {
  const colors = METRIC_TONES[tone];
  return <div className="flex min-w-0 items-start gap-3 border-r border-border px-4 py-4 last:border-r-0">
    <span className={`grid size-8 shrink-0 place-items-center rounded-md ${colors.icon}`}><Icon aria-hidden="true" className="size-4" /></span>
    <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={`mt-1 break-words text-lg font-semibold tabular-nums ${colors.value}`}>{value}</dd></div>
  </div>;
}

function SectionHeader({ title, subtitle, tone }: { title: string; subtitle: string; tone?: keyof typeof SECTION_TONES }) {
  return <div className={`border-b px-4 py-3 ${tone ? SECTION_TONES[tone] : "bg-muted/50"}`}><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>;
}

function ChartSection({ title, subtitle, children, empty, tone }: { title: string; subtitle: string; children: React.ReactNode; empty: boolean; tone?: keyof typeof SECTION_TONES }) {
  return <section className="min-w-0 border-y bg-card"><SectionHeader title={title} subtitle={subtitle} tone={tone} />
    <div className="p-4">{empty ? <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-3 py-6 text-center text-sm text-muted-foreground"><ChartColumn aria-hidden="true" className="size-6 opacity-60" /><p>Aucun dossier déclaré sur cette année.</p></div> : children}</div>
  </section>;
}

function Distribution({ title, subtitle, rows, empty, colors, tone }: {
  title: string; subtitle: string; rows: SinistreStatistics["parEtape"]; empty: boolean; colors?: Record<string, string>; tone?: keyof typeof SECTION_TONES;
}) {
  return <ChartSection title={title} subtitle={subtitle} empty={empty} tone={tone}>
    <ChartContainer config={{ nombre: { label: "Dossiers", color: "#059669" } }} className="h-[260px] w-full aspect-auto">
      <BarChart data={rows} layout="vertical" accessibilityLayer margin={{ left: 0, right: 18, top: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 4" />
        <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tickFormatter={count} />
        <YAxis dataKey="libelle" type="category" width={114} axisLine={false} tickLine={false} tickFormatter={(value: string) => value.length > 20 ? `${value.slice(0, 19)}…` : value} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="nombre" fill="var(--color-nombre)" maxBarSize={22} radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {rows.map((row) => <Cell key={row.code} fill={colors?.[row.code] ?? "var(--color-nombre)"} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  </ChartSection>;
}
