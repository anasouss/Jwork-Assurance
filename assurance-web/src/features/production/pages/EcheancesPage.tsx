import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownAZ,
  Download,
  Eye,
  FilePenLine,
  FileText,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterField, ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/download";
import { contractKeys, referenceKeys } from "@/lib/query-keys";
import { contractApi } from "../api/contracts";
import { referenceApi } from "../api/references";
import { FinalizeRenewalDialog, PreTermePdfDialog } from "../components/echeances/PreTermeDialogs";
import { usePreTermeActions } from "../components/echeances/usePreTermeActions";
import { toDateOnly } from "../date";
import type { EcheanceAutomobileRow, TypeContrat } from "../types";
import { useAuthStore } from "@/store/auth-store";

type EcheanceFilters = {
  dateDu?: string;
  dateAu?: string;
  compagnieId: "ALL" | string;
  typeContrat: "ALL" | TypeContrat;
  search: string;
};

type EcheanceSearchParams = {
  dateDu: string;
  dateAu: string;
  compagnieId?: string;
  typeContrat?: TypeContrat;
  search?: string;
};

type SortKey = keyof Pick<
  EcheanceAutomobileRow,
  "dossier" | "client" | "police" | "marque" | "matricule" | "dateEcheance" | "typeContratLabel" | "compagnie" | "telephone" | "observation"
>;

const DEFAULT_FILTERS: EcheanceFilters = {
  compagnieId: "ALL",
  typeContrat: "ALL",
  search: "",
};
const PAGE_SIZE = 25;

export default function EcheancesPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const initialState = useMemo(() => initialEcheanceState(urlParams), [urlParams]);
  const [filters, setFilters] = useState<EcheanceFilters>(initialState.filters);
  const [appliedFilters, setAppliedFilters] = useState<EcheanceFilters>(initialState.filters);
  const [searched, setSearched] = useState(initialState.searched);
  const [page, setPage] = useState(initialState.page);
  const [exporting, setExporting] = useState(false);
  const [pdfDraftId, setPdfDraftId] = useState<string | null>(null);
  const [renewalRow, setRenewalRow] = useState<EcheanceAutomobileRow | null>(null);
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canRenew = permissions.includes("contrat:renew") || permissions.includes("contrat:update");
  const preTermeActions = usePreTermeActions();
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "dateEcheance",
    direction: "asc",
  });

  const companies = useQuery({
    queryKey: referenceKeys.list("compagnies-assurance"),
    queryFn: () => referenceApi.list("compagnies-assurance"),
  });

  const searchParams = useMemo(() => {
    if (!searched || !appliedFilters.dateDu || !appliedFilters.dateAu) {
      return null;
    }
    return { ...toSearchParams(appliedFilters), page, size: PAGE_SIZE };
  }, [appliedFilters, page, searched]);

  const echeances = useQuery({
    queryKey: contractKeys.dueDates(searchParams),
    queryFn: () => {
      if (!searchParams) {
        throw new Error("Parametres echeances manquants");
      }
      return contractApi.searchEcheancesAutomobile(searchParams);
    },
    enabled: Boolean(searchParams),
  });

  const rows = useMemo(() => sortRows(echeances.data?.rows ?? [], sort), [echeances.data?.rows, sort]);
  const canSearch = Boolean(filters.dateDu && filters.dateAu);
  const hasDateError = Boolean(filters.dateDu && filters.dateAu && filters.dateDu > filters.dateAu);

  function applySearch() {
    if (!canSearch || hasDateError) {
      return;
    }
    setAppliedFilters(filters);
    setPage(0);
    setSearched(true);
    setUrlParams(toUrlParams(filters, 0), { replace: true });
  }

  function resetSearch() {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
    setSearched(false);
    setUrlParams(new URLSearchParams(), { replace: true });
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    setUrlParams(toUrlParams(appliedFilters, nextPage), { replace: true });
  }

  function updateSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  async function exportRows() {
    if (!searchParams) {
      return;
    }
    setExporting(true);
    try {
      const blob = await contractApi.exportEcheancesAutomobile(toSearchParams(appliedFilters));
      downloadBlob(blob, `echeances-automobile-${searchParams.dateDu}-${searchParams.dateAu}.xls`);
    } catch (error) {
      console.error("Export des echeances impossible", error);
    } finally {
      setExporting(false);
    }
  }

  const pageInfo = echeances.data?.page;
  const totalPages = Math.max(1, pageInfo?.totalPages ?? 1);
  const currentPage = Math.min(pageInfo?.number ?? page, totalPages - 1);

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden border-border/70 shadow-none">
        <div className="bg-emerald-600 px-5 py-4 text-center text-sm font-bold uppercase text-white">
          Gestion des échéances
        </div>
        <CardContent className="grid gap-4 p-5">
          <div className="grid gap-3 rounded-md border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.3fr_auto_auto]">
            <FilterField label="Date du" tone="emerald">
              <DatePicker
                date={filters.dateDu}
                onSelect={(date) => setFilters((current) => ({ ...current, dateDu: toDateOnly(date) }))}
              />
            </FilterField>
            <FilterField label="Date au" tone="emerald">
              <DatePicker
                date={filters.dateAu}
                onSelect={(date) => setFilters((current) => ({ ...current, dateAu: toDateOnly(date) }))}
              />
            </FilterField>
            <FilterField label="Compagnie" tone="emerald">
              <Select
                value={filters.compagnieId}
                onValueChange={(value) => setFilters((current) => ({ ...current, compagnieId: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les compagnies</SelectItem>
                  {(companies.data ?? []).map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Type contrat" tone="emerald">
              <Select
                value={filters.typeContrat}
                onValueChange={(value) => setFilters((current) => ({ ...current, typeContrat: value as EcheanceFilters["typeContrat"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les types</SelectItem>
                  <SelectItem value="PARTICULIER">Mono</SelectItem>
                  <SelectItem value="CONVENTION">Convention</SelectItem>
                  <SelectItem value="FLOTTE">Flotte</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="RC / CIN / Nom" tone="emerald">
              <Input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Rechercher par RC, CIN ou nom"
              />
            </FilterField>
            <div className="flex items-end">
              <Button
                type="button"
                className="h-10 w-full bg-green-600 hover:bg-green-700"
                disabled={!canSearch || hasDateError}
                onClick={applySearch}
              >
                <Search className="size-4" />
                Lancer la recherche
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="h-10 w-full" onClick={resetSearch}>
                <RotateCcw className="size-4" />
                Réinitialiser
              </Button>
            </div>
            {hasDateError ? (
              <p className="text-sm font-medium text-red-600 md:col-span-2 xl:col-span-7">
                La date du doit être inférieure ou égale à la date au.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {searched ? (
        <Card className="border-border/70 shadow-none">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-emerald-950 dark:text-emerald-100">
                  Tableau des échéances automobile
                </h2>
                <p className="text-sm text-muted-foreground">
                  Période : <strong>{formatDateIso(appliedFilters.dateDu)}</strong> →{" "}
                  <strong>{formatDateIso(appliedFilters.dateAu)}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!rows.length || exporting}
                  onClick={exportRows}
                >
                  <Download className="size-4" />
                  {exporting ? "Export..." : "Exporter Excel"}
                </Button>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {echeances.data?.summary.contratCount ?? rows.length} contrat(s)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[1260px] border-collapse text-sm">
                <thead className="bg-emerald-700 text-xs uppercase text-white">
                  <tr>
                    <SortableTh label="Dossier" column="dossier" sort={sort} onSort={updateSort} />
                    <SortableTh label="Client" column="client" sort={sort} onSort={updateSort} />
                    <SortableTh label="Police" column="police" sort={sort} onSort={updateSort} />
                    <SortableTh label="Marque" column="marque" sort={sort} onSort={updateSort} />
                    <SortableTh label="Matricule" column="matricule" sort={sort} onSort={updateSort} />
                    <SortableTh label="Date Ech" column="dateEcheance" sort={sort} onSort={updateSort} />
                    <SortableTh label="Contrat" column="typeContratLabel" sort={sort} onSort={updateSort} />
                    <SortableTh label="Compagnie" column="compagnie" sort={sort} onSort={updateSort} />
                    <SortableTh label="Téléphone" column="telephone" sort={sort} onSort={updateSort} />
                    <SortableTh label="Observation" column="observation" sort={sort} onSort={updateSort} />
                    <th className="px-3 py-3 text-center font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {echeances.isLoading ? (
                    <TableRowsSkeleton rows={8} colSpan={11} />
                  ) : echeances.isError ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-red-600">
                        Impossible de charger les échéances.
                      </td>
                    </tr>
                  ) : rows.length ? (
                    rows.map((row) => (
                      <EcheanceTableRow
                        key={row.contratId}
                        row={row}
                        canRenew={canRenew}
                        preparing={preTermeActions.prepareMutation.isPending && preTermeActions.prepareMutation.variables === row.contratId}
                        onEditPreTerme={() => preTermeActions.edit(row)}
                        onPdf={() => setPdfDraftId(row.preTermeDraftId ?? null)}
                        onRenew={() => setRenewalRow(row)}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                        Aucun contrat automobile ne correspond aux filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <ServerPagination
              page={currentPage}
              totalPages={totalPages}
              loading={echeances.isLoading}
              showCurrentPage
              className="border-t px-4 py-3"
              labelClassName="text-xs"
              onPageChange={goToPage}
            />
          </CardContent>
        </Card>
      ) : null}
      <PreTermePdfDialog
        draftId={pdfDraftId}
        open={Boolean(pdfDraftId)}
        onOpenChange={(open) => { if (!open) setPdfDraftId(null); }}
      />
      <FinalizeRenewalDialog
        open={Boolean(renewalRow)}
        companyTermEligible={Boolean(renewalRow?.renouvellementTermeCompagnieEligible)}
        pending={preTermeActions.finalizeMutation.isPending}
        onOpenChange={(open) => { if (!open) setRenewalRow(null); }}
        onConfirm={(mode) => {
          if (!renewalRow?.preTermeDraftId) return;
          preTermeActions.finalizeMutation.mutate(
            { draftId: renewalRow.preTermeDraftId, mode },
            { onSuccess: () => setRenewalRow(null) }
          );
        }}
      />
    </div>
  );
}

function SortableTh({ label, column, sort, onSort }: { label: string; column: SortKey; sort: { key: SortKey; direction: "asc" | "desc" }; onSort: (column: SortKey) => void }) {
  const active = sort.key === column;
  return (
    <th className="px-3 py-3 text-left font-bold">
      <button type="button" className="inline-flex items-center gap-1" onClick={() => onSort(column)}>
        {label}
        <ArrowDownAZ className={cn("size-3 opacity-45", active && "opacity-100", active && sort.direction === "desc" && "rotate-180")} />
      </button>
    </th>
  );
}

function EcheanceTableRow({
  row,
  canRenew,
  preparing,
  onEditPreTerme,
  onPdf,
  onRenew,
}: {
  row: EcheanceAutomobileRow;
  canRenew: boolean;
  preparing: boolean;
  onEditPreTerme: () => void;
  onPdf: () => void;
  onRenew: () => void;
}) {
  const fleetRenewal = row.typeContrat === "FLOTTE" && canRenew;
  return (
    <tr className="border-b transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/25">
      <td className="px-3 py-2 align-middle">{text(row.dossier)}</td>
      <td className="px-3 py-2 align-middle">
        <div className="font-semibold uppercase">{text(row.client)}</div>
        <div className="text-xs text-muted-foreground">Code : {text(row.codeClient)}</div>
      </td>
      <td className="px-3 py-2 align-middle">{text(row.police)}</td>
      <td className="px-3 py-2 align-middle">{text(row.marque)}</td>
      <td className="px-3 py-2 align-middle">{text(row.matricule)}</td>
      <td className="px-3 py-2 align-middle">{formatDate(row.dateEcheance)}</td>
      <td className="px-3 py-2 align-middle font-semibold">{text(row.typeContratLabel)}</td>
      <td className="px-3 py-2 align-middle">{text(row.compagnie)}</td>
      <td className="px-3 py-2 align-middle">{text(row.telephone)}</td>
      <td className="w-48 px-3 py-2 align-middle">
        <ObservationStatus row={row} />
      </td>
      <td className="px-3 py-2 align-middle">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" variant="outline" className="size-8 border-blue-500 text-blue-600">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={editContratPath(row)}>
                <Eye className="size-4" />
                Ouvrir le dossier
              </Link>
            </DropdownMenuItem>
            {fleetRenewal ? (
              <>
                <DropdownMenuItem onSelect={onEditPreTerme} disabled={preparing}>
                  <FilePenLine className="size-4" />
                  Modifier pré-terme
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onPdf} disabled={!row.preTermeDraftId}>
                  <FileText className="size-4" />
                  Éditer pré-terme
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onRenew} disabled={!row.preTermeDraftId}>
                  <RefreshCw className="size-4" />
                  Renouveler
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function ObservationStatus({ row }: { row: EcheanceAutomobileRow }) {
  const message = text(row.observation);
  const normalizedMessage = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  const level = row.observationNiveau
    ?? (message !== "-" && normalizedMessage !== "a jour" ? "BLOQUANT" : "AUCUNE");

  if (level === "AUCUNE") {
    return null;
  }

  const alerts = message
    .split("·")
    .map((alert) => alert.trim())
    .filter(Boolean);
  const blocking = level === "BLOQUANT";
  const compactLabel = `${alerts.length} document${alerts.length > 1 ? "s" : ""} à vérifier`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold",
            blocking
              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
              : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
          )}
          aria-label={`${compactLabel}. Afficher le détail`}
        >
          <TriangleAlert className="size-3.5 shrink-0" />
          {compactLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div
          className={cn(
            "flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold",
            blocking ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
          )}
        >
          <TriangleAlert className="size-4" />
          {blocking ? "Documents expirés" : "Documents à vérifier"}
        </div>
        <ul className="grid gap-2 p-4 text-sm">
          {alerts.map((alert, index) => (
            <li key={`${index}-${alert}`} className="flex gap-2 leading-5">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
              <span>{alert}</span>
            </li>
          ))}
        </ul>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          Échéance du contrat : {formatDate(row.dateEcheance)}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function toSearchParams(filters: EcheanceFilters): EcheanceSearchParams {
  return {
    dateDu: filters.dateDu ?? "",
    dateAu: filters.dateAu ?? "",
    compagnieId: filters.compagnieId === "ALL" ? undefined : filters.compagnieId,
    typeContrat: filters.typeContrat === "ALL" ? undefined : filters.typeContrat,
    search: filters.search.trim() || undefined,
  };
}

function initialEcheanceState(params: URLSearchParams): {
  filters: EcheanceFilters;
  searched: boolean;
  page: number;
} {
  const filters: EcheanceFilters = {
    dateDu: params.get("dateDu") ?? undefined,
    dateAu: params.get("dateAu") ?? undefined,
    compagnieId: params.get("compagnieId") || "ALL",
    typeContrat: toTypeContratFilter(params.get("typeContrat")),
    search: params.get("search") ?? "",
  };
  return {
    filters,
    searched: Boolean(filters.dateDu && filters.dateAu),
    page: positivePageIndex(params.get("page")),
  };
}

function toUrlParams(filters: EcheanceFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.dateDu) params.set("dateDu", filters.dateDu);
  if (filters.dateAu) params.set("dateAu", filters.dateAu);
  if (filters.compagnieId !== "ALL") params.set("compagnieId", filters.compagnieId);
  if (filters.typeContrat !== "ALL") params.set("typeContrat", filters.typeContrat);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (page > 0) params.set("page", String(page + 1));
  return params;
}

function positivePageIndex(value: string | null) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page - 1 : 0;
}

function toTypeContratFilter(value: string | null): EcheanceFilters["typeContrat"] {
  return value === "PARTICULIER" || value === "CONVENTION" || value === "FLOTTE" ? value : "ALL";
}

function sortRows(rows: EcheanceAutomobileRow[], sort: { key: SortKey; direction: "asc" | "desc" }) {
  return [...rows].sort((a, b) => {
    const left = String(a[sort.key] ?? "");
    const right = String(b[sort.key] ?? "");
    const result = left.localeCompare(right, "fr", { numeric: true, sensitivity: "base" });
    return sort.direction === "asc" ? result : -result;
  });
}

function editContratPath(row: EcheanceAutomobileRow) {
  if (row.typeContrat === "FLOTTE") return `/app/production/ajouter-dossier/flotte/${row.contratId}`;
  if (row.typeContrat === "CONVENTION") return `/app/production/ajouter-dossier/convention/${row.contratId}`;
  return `/app/production/ajouter-dossier/particulier/${row.contratId}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateIso(value?: string | null) {
  return value || "-";
}

function text(value?: string | null) {
  return value?.trim() || "-";
}
