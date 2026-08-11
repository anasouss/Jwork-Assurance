import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CircleDollarSign, FileText, LoaderCircle, RefreshCw, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authApi } from "@/lib/api/auth";
import { moneyAmount } from "@/features/production/utils/format";
import { useDashboardDateRange, type DatePreset } from "@/hooks/use-dashboard-date-range";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { platformDashboardApi } from "../api";
import type { PlatformAgencyRow } from "../types";

const presets: Array<{ value: DatePreset; label: string }> = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "thisMonth", label: "Ce mois" },
  { value: "3m", label: "3 mois" },
];

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
      <header className="flex flex-col gap-4 border-b pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Administration plateforme</p>
          <h1 className="mt-1 text-2xl font-semibold">Vue des agences</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Production consolidée et activité opérationnelle par agence.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-64 gap-1.5 text-sm">
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
            <span className="font-medium">Du</span>
            <Input
              type="date"
              value={range.fromStr}
              onChange={(event) => {
                if (event.target.value) {
                  range.setCustomRange(new Date(`${event.target.value}T12:00:00`), range.to);
                }
              }}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Au</span>
            <Input
              type="date"
              value={range.toStr}
              onChange={(event) => {
                if (event.target.value) {
                  range.setCustomRange(range.from, new Date(`${event.target.value}T12:00:00`));
                }
              }}
            />
          </label>
          <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-1">
            {presets.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                size="sm"
                variant={range.activePreset === preset.value ? "default" : "ghost"}
                className={cn("h-8", range.activePreset === preset.value && "bg-blue-600 hover:bg-blue-700")}
                onClick={() => range.setPreset(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
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
            <Metric icon={Users} label="Utilisateurs actifs" value={`${dashboard.data.summary.activeUsers}`} detail="Sur la sélection" />
            <Metric icon={FileText} label="Contrats actifs" value={`${dashboard.data.summary.activeContracts}`} detail={`${dashboard.data.summary.quittances} quittance(s)`} />
            <Metric icon={CircleDollarSign} label="Production TTC" value={moneyAmount(dashboard.data.summary.primeTotale)} detail={`${moneyAmount(dashboard.data.summary.taxes)} taxes et frais`} />
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
                  <TableHead className="text-right">Contrats actifs</TableHead>
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
                    <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
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
                    <TableCell className="text-right tabular-nums">{row.activeUsers}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.activeContracts}</TableCell>
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
