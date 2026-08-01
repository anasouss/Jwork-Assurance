import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, RotateCcw, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { AffectationQuittanceDialog } from "../components/AffectationQuittanceDialog";
import { QuittanceRulesDialog } from "../components/QuittanceRulesDialog";
import type {
  CategorieMouvement,
  QuittanceAllocation,
  Rule,
  StatutAffectation,
  TypeContrat,
} from "../types";

type QuittancePresence = "AVEC_QUITTANCE" | "SANS_QUITTANCE";

type Filters = {
  compagnieId: "ALL" | string;
  typeContrat: "ALL" | TypeContrat;
  nature: "ALL" | QuittancePresence;
  dateDu: string;
  dateAu: string;
  search: string;
};

const DEFAULT_FILTERS: Filters = {
  compagnieId: "ALL",
  typeContrat: "ALL",
  nature: "ALL",
  dateDu: "",
  dateAu: "",
  search: "",
};
const PAGE_SIZE = 25;

export default function QuittanceAffectationPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canAffect = permissions.includes("quittance:create") || permissions.includes("quittance:manage");
  const canConfigure = permissions.includes("quittance:manage") || permissions.includes("config:manage");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [searched, setSearched] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedQuittanceId, setSelectedQuittanceId] = useState<string>();
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleTarget, setRuleTarget] = useState<{
    compagnieId?: string | null;
    typeContrat: TypeContrat;
    rule?: Rule | null;
  }>();

  const companies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance", "compta"],
    queryFn: comptaApi.companies,
  });
  const params = useMemo(
    () => !searched ? null : ({
      compagnieId: appliedFilters.compagnieId === "ALL" ? undefined : appliedFilters.compagnieId,
      typeContrat: appliedFilters.typeContrat === "ALL" ? undefined : appliedFilters.typeContrat,
      avecQuittance: appliedFilters.nature === "ALL"
        ? undefined
        : appliedFilters.nature === "AVEC_QUITTANCE",
      dateDu: appliedFilters.dateDu || undefined,
      dateAu: appliedFilters.dateAu || undefined,
      search: appliedFilters.search.trim() || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [appliedFilters, page, searched]
  );
  const quittances = useQuery({
    queryKey: ["compta", "affectation-quittances", params],
    queryFn: () => {
      if (!params) throw new Error("Critères de recherche manquants");
      return comptaApi.searchQuittances(params);
    },
    enabled: Boolean(params),
  });

  const rows = quittances.data?.rows ?? [];
  const pageInfo = quittances.data?.page;
  const totalPages = Math.max(1, pageInfo?.totalPages ?? 1);
  const currentPage = Math.min(pageInfo?.number ?? page, totalPages - 1);
  const missingRules = rows.filter((row) => !row.regle).length;
  const canSearch = hasMeaningfulFilter(filters);
  const hasDateError = Boolean(filters.dateDu && filters.dateAu && filters.dateDu > filters.dateAu);

  function applyFilters() {
    if (!canSearch || hasDateError) return;
    setPage(0);
    setAppliedFilters(filters);
    setSearched(true);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
    setSearched(false);
  }

  async function exportRows() {
    if (!searched || !pageInfo?.totalElements) return;
    setExporting(true);
    try {
      const blob = await comptaApi.exportQuittances(toApiFilters(appliedFilters));
      downloadBlob(blob, `affectation-quittances-${toDateOnly(new Date())}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export Excel impossible");
    } finally {
      setExporting(false);
    }
  }

  function openAllocation(row: QuittanceAllocation) {
    if (!row.regle) {
      if (!canConfigure) return;
      setRuleTarget({ compagnieId: row.compagnieId, typeContrat: row.typeContrat });
      setRulesOpen(true);
      return;
    }
    setSelectedQuittanceId(row.quittanceId);
    setAllocationOpen(true);
  }

  return (
    <div className="grid min-w-0 gap-4 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-amber-700">Comptabilité</div>
          <h1 className="text-2xl font-semibold">Affectation des quittances</h1>
          <p className="text-sm text-muted-foreground">
            Rapprochement des quittances de production avec les références et montants compagnie.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!searched || !pageInfo?.totalElements || exporting}
            onClick={exportRows}
          >
            <Download className="size-4" />
            {exporting ? "Export..." : "Exporter Excel"}
          </Button>
          {canConfigure ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRuleTarget(undefined);
                setRulesOpen(true);
              }}
            >
              <Settings2 className="size-4" />
              Configuration
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="min-w-0 border-border/70 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1.4fr_auto]">
            <FilterField label="Compagnie">
              <Select value={filters.compagnieId} onValueChange={(value) => setFilters((current) => ({ ...current, compagnieId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes</SelectItem>
                  {(companies.data ?? []).map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Branche">
              <Input readOnly value="Automobile" />
            </FilterField>
            <FilterField label="Type de contrat">
              <Select
                value={filters.typeContrat}
                onValueChange={(value) => setFilters((current) => ({ ...current, typeContrat: value as Filters["typeContrat"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous</SelectItem>
                  <SelectItem value="PARTICULIER">Mono</SelectItem>
                  <SelectItem value="CONVENTION">Convention</SelectItem>
                  <SelectItem value="FLOTTE">Flotte</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Date effet du">
              <DatePicker
                date={filters.dateDu}
                onSelect={(date) => setFilters((current) => ({ ...current, dateDu: toDateOnly(date) ?? "" }))}
              />
            </FilterField>
            <FilterField label="Date effet au">
              <DatePicker
                date={filters.dateAu}
                onSelect={(date) => setFilters((current) => ({ ...current, dateAu: toDateOnly(date) ?? "" }))}
              />
            </FilterField>
            <FilterField label="Nature">
              <Select
                value={filters.nature}
                onValueChange={(value) => setFilters((current) => ({ ...current, nature: value as Filters["nature"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes</SelectItem>
                  <SelectItem value="AVEC_QUITTANCE">Primes avec quittances</SelectItem>
                  <SelectItem value="SANS_QUITTANCE">Primes sans quittances</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <div className="flex items-end gap-2">
              <Button type="button" size="icon" title="Afficher" disabled={!canSearch || hasDateError} onClick={applyFilters}>
                <Search className="size-4" />
              </Button>
              <Button type="button" size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}>
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <FilterField label="Dossier, police, client, immatriculation ou quittance">
              <Input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => event.key === "Enter" && applyFilters()}
                placeholder="Rechercher..."
              />
            </FilterField>
          </div>
          {hasDateError ? (
            <p className="mt-2 text-sm font-medium text-destructive">
              La date effet du doit être antérieure ou égale à la date effet au.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {quittances.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Chargement impossible</AlertTitle>
          <AlertDescription>
            {quittances.error instanceof Error ? quittances.error.message : "Une erreur est survenue"}
          </AlertDescription>
        </Alert>
      ) : null}

      {searched ? (
        <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Quittances trouvées" value={String(pageInfo?.totalElements ?? 0)} />
          <Metric label="TTC de la page" value={money(quittances.data?.summary.montantTtc ?? 0)} />
          <Metric label="Montant affecté de la page" value={money(quittances.data?.summary.montantAffecte ?? 0)} />
          <Metric label="Configuration manquante sur la page" value={String(missingRules)} warning={missingRules > 0} />
        </div>
      ) : null}

      <Card className="min-w-0 border-border/70 shadow-none">
        <CardContent className="min-w-0 p-0">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[1480px] border-collapse text-sm">
              <thead className="bg-amber-600 text-xs uppercase text-white dark:bg-amber-700">
                <tr>
                  <Header>Produit</Header>
                  <Header>Mouvement</Header>
                  <Header>Souscripteur</Header>
                  <Header>Police</Header>
                  <Header>Date effet</Header>
                  <Header>Date échéance</Header>
                  <Header className="text-right">Prime nette</Header>
                  <Header className="text-right">Taxes</Header>
                  <Header className="text-right">Montant TTC</Header>
                  <Header>N° quittance compagnie</Header>
                  <Header>Statut</Header>
                  <Header className="text-right">Action</Header>
                </tr>
              </thead>
              <tbody>
                {!searched ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-12 text-center text-muted-foreground">
                      Renseignez au moins un critère puis lancez la recherche.
                    </td>
                  </tr>
                ) : quittances.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="border-b">
                      <td colSpan={12} className="px-3 py-3"><Skeleton className="h-9 w-full" /></td>
                    </tr>
                  ))
                ) : rows.length ? (
                  rows.map((row) => (
                    <tr key={row.quittanceId} className="border-b transition-colors hover:bg-muted/40">
                      <Cell>
                        <div className="font-medium">{productLabel(row)}</div>
                        <div className="text-xs text-muted-foreground">{row.dossier}</div>
                      </Cell>
                      <Cell>
                        <div className="font-medium">{row.mouvement}</div>
                        <div className="text-xs text-muted-foreground">{natureLabel(row.nature)}</div>
                      </Cell>
                      <Cell>{row.souscripteur || "—"}</Cell>
                      <Cell>{row.police || "—"}</Cell>
                      <Cell>{dateLabel(row.dateEffet)}</Cell>
                      <Cell>{dateLabel(row.dateEcheance)}</Cell>
                      <Cell className="text-right">{money(row.primeNette)}</Cell>
                      <Cell className="text-right">{money(row.montantTaxes)}</Cell>
                      <Cell className="text-right font-medium">{money(row.montantTtc)}</Cell>
                      <Cell>
                        {row.numerosQuittanceCompagnie ? (
                          <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                            {row.numerosQuittanceCompagnie}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {!row.regle ? (
                          <div className="mt-1 text-xs font-medium text-destructive">Configuration manquante</div>
                        ) : null}
                      </Cell>
                      <Cell><StatusBadge status={row.statutAffectation} /></Cell>
                      <Cell className="text-right">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <Button asChild type="button" size="icon" variant="ghost" title="Voir le détail">
                            <Link
                              aria-label={`Voir le détail de ${row.mouvement}`}
                              to={`/app/production/contrats/${row.contratId}${row.mouvementId ? `?mouvementId=${row.mouvementId}` : ""}`}
                            >
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={row.regle ? "outline" : "default"}
                            disabled={!row.regle && !canConfigure}
                            onClick={() => openAllocation(row)}
                          >
                            {row.regle
                              ? canAffect
                                ? row.statutAffectation === "NON_AFFECTEE" ? "Affecter" : "Modifier"
                                : "Consulter"
                              : canConfigure ? "Configurer" : "Configuration requise"}
                          </Button>
                        </div>
                      </Cell>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={12} className="px-3 py-12 text-center text-muted-foreground">Aucune quittance trouvée.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {searched ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <div className="text-sm text-muted-foreground">
                Page {currentPage + 1} / {totalPages} · {pageInfo?.totalElements ?? 0} résultat(s)
              </div>
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={currentPage <= 0 || quittances.isLoading}
                      className={currentPage <= 0 || quittances.isLoading ? "pointer-events-none opacity-50" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        setPage((current) => Math.max(0, current - 1));
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={currentPage >= totalPages - 1 || quittances.isLoading}
                      className={currentPage >= totalPages - 1 || quittances.isLoading ? "pointer-events-none opacity-50" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        setPage((current) => Math.min(totalPages - 1, current + 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AffectationQuittanceDialog
        quittanceId={selectedQuittanceId}
        open={allocationOpen}
        readOnly={!canAffect}
        onConfigureRule={(data) => {
          setAllocationOpen(false);
          setSelectedQuittanceId(undefined);
          setRuleTarget({
            compagnieId: data.compagnieId,
            typeContrat: data.typeContrat,
            rule: data.regle,
          });
          setRulesOpen(true);
        }}
        onOpenChange={(value) => {
          setAllocationOpen(value);
          if (!value) setSelectedQuittanceId(undefined);
        }}
      />
      <QuittanceRulesDialog
        open={rulesOpen}
        onOpenChange={(value) => {
          setRulesOpen(value);
          if (!value) setRuleTarget(undefined);
        }}
        initialCompanyId={ruleTarget?.compagnieId ?? undefined}
        initialTypeContrat={ruleTarget?.typeContrat}
        initialRule={ruleTarget?.rule}
      />
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label className="text-xs uppercase">{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={warning ? "mt-1 text-lg font-semibold text-destructive" : "mt-1 text-lg font-semibold"}>{value}</div>
    </div>
  );
}

function Header({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-3 py-3 text-left font-semibold ${className}`}>{children}</th>;
}

function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-3 align-middle ${className}`}>{children}</td>;
}

function StatusBadge({ status }: { status: StatutAffectation }) {
  const variants: Record<StatutAffectation, BadgeProps["variant"]> = {
    NON_AFFECTEE: "gray",
    PARTIELLEMENT_AFFECTEE: "warning",
    AFFECTEE: "success",
    AVEC_ECART: "destructive",
  };
  const labels: Record<StatutAffectation, string> = {
    NON_AFFECTEE: "Non affectée",
    PARTIELLEMENT_AFFECTEE: "Partielle",
    AFFECTEE: "Affectée",
    AVEC_ECART: "Avec écart",
  };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function productLabel(row: QuittanceAllocation) {
  if (row.typeContrat === "PARTICULIER") return "Mono";
  if (row.typeContrat === "CONVENTION") return row.produit || "Convention";
  return "Flotte";
}

function natureLabel(nature?: CategorieMouvement | null) {
  if (nature === "AFFAIRE_NOUVELLE") return "Affaire nouvelle";
  if (nature === "RENOUVELLEMENT") return "Renouvellement";
  if (nature === "AVENANT") return "Avenant";
  if (nature === "CARTE_VERTE") return "Carte verte";
  return "";
}

function dateLabel(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function money(value: number) {
  return `${new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} MAD`;
}

function hasMeaningfulFilter(filters: Filters) {
  return filters.compagnieId !== "ALL"
    || filters.typeContrat !== "ALL"
    || filters.nature !== "ALL"
    || Boolean(filters.dateDu)
    || Boolean(filters.dateAu)
    || Boolean(filters.search.trim());
}

function toApiFilters(filters: Filters) {
  return {
    compagnieId: filters.compagnieId === "ALL" ? undefined : filters.compagnieId,
    typeContrat: filters.typeContrat === "ALL" ? undefined : filters.typeContrat,
    avecQuittance: filters.nature === "ALL" ? undefined : filters.nature === "AVEC_QUITTANCE",
    dateDu: filters.dateDu || undefined,
    dateAu: filters.dateAu || undefined,
    search: filters.search.trim() || undefined,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
