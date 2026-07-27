import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownAZ, Download, Eye, MoreHorizontal, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { productionApi } from "../api";
import { toDateOnly } from "../date";
import type { EcheanceAutomobileRow, TypeContrat } from "../types";

type NatureEcheance = "AUTOMOBILE" | "RISQUES_DIVERS" | "ASSISTANCE";

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

export default function EcheancesPage() {
  const [nature, setNature] = useState<NatureEcheance | null>(null);
  const [filters, setFilters] = useState<EcheanceFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<EcheanceFilters>(DEFAULT_FILTERS);
  const [searched, setSearched] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "dateEcheance",
    direction: "asc",
  });

  const companies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance", "echeances"],
    queryFn: () => productionApi.referentiel("compagnies-assurance"),
  });

  const searchParams = useMemo(() => {
    if (!searched || nature !== "AUTOMOBILE" || !appliedFilters.dateDu || !appliedFilters.dateAu) {
      return null;
    }
    return toSearchParams(appliedFilters);
  }, [appliedFilters, nature, searched]);

  const echeances = useQuery({
    queryKey: ["echeances", "automobile", searchParams],
    queryFn: () => {
      if (!searchParams) {
        throw new Error("Parametres echeances manquants");
      }
      return productionApi.searchEcheancesAutomobile(searchParams);
    },
    enabled: Boolean(searchParams),
  });

  const rows = useMemo(() => sortRows(echeances.data?.rows ?? [], sort), [echeances.data?.rows, sort]);
  const canSearch = nature === "AUTOMOBILE" && Boolean(filters.dateDu && filters.dateAu);
  const hasDateError = Boolean(filters.dateDu && filters.dateAu && filters.dateDu > filters.dateAu);

  function applySearch() {
    if (!canSearch || hasDateError) {
      return;
    }
    setAppliedFilters(filters);
    setSearched(true);
  }

  function resetSearch() {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setSearched(false);
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
      const blob = await productionApi.exportEcheancesAutomobile(searchParams);
      downloadBlob(blob, `echeances-automobile-${searchParams.dateDu}-${searchParams.dateAu}.xls`);
    } catch (error) {
      console.error("Export des echeances impossible", error);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden border-border/70 shadow-none">
        <div className="bg-emerald-600 px-5 py-4 text-center text-sm font-bold uppercase text-white">
          Gestion des échéances
        </div>
        <CardContent className="grid gap-4 p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <NatureCard
              title="Automobile"
              status="Actif"
              active={nature === "AUTOMOBILE"}
              onClick={() => setNature("AUTOMOBILE")}
            />
            <NatureCard title="Risques divers" status="À venir" disabled />
            <NatureCard title="Assistance" status="À venir" disabled />
          </div>

          {nature === "AUTOMOBILE" ? (
            <div className="grid gap-3 rounded-md border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.3fr_auto_auto]">
              <FilterField label="Date du">
                <DatePicker
                  date={filters.dateDu}
                  onSelect={(date) => setFilters((current) => ({ ...current, dateDu: toDateOnly(date) }))}
                />
              </FilterField>
              <FilterField label="Date au">
                <DatePicker
                  date={filters.dateAu}
                  onSelect={(date) => setFilters((current) => ({ ...current, dateAu: toDateOnly(date) }))}
                />
              </FilterField>
              <FilterField label="Compagnie">
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
              <FilterField label="Type contrat">
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
              <FilterField label="RC / CIN / Nom">
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
          ) : (
            <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Sélectionnez Automobile pour renseigner une période et afficher le tableau des contrats à échéance.
            </div>
          )}
        </CardContent>
      </Card>

      {searched && nature === "AUTOMOBILE" ? (
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
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                        Chargement des échéances...
                      </td>
                    </tr>
                  ) : echeances.isError ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-red-600">
                        Impossible de charger les échéances.
                      </td>
                    </tr>
                  ) : rows.length ? (
                    rows.map((row) => <EcheanceTableRow key={row.contratId} row={row} />)
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
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function NatureCard({ title, status, active, disabled, onClick }: { title: string; status: string; active?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-20 items-start justify-between rounded-md border p-4 text-left transition-colors",
        active && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
        disabled ? "cursor-not-allowed border-dashed bg-muted/20 text-muted-foreground" : "hover:border-emerald-400 hover:bg-emerald-50/70"
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn("size-3 rounded-full border", active && "border-emerald-600 bg-emerald-600")} />
        <span className="font-semibold">{title}</span>
      </span>
      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", disabled ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
        {status}
      </span>
    </button>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-emerald-950 dark:text-emerald-100">
      <span>{label}</span>
      {children}
    </label>
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

function EcheanceTableRow({ row }: { row: EcheanceAutomobileRow }) {
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
      <td className={cn("px-3 py-2 align-middle", text(row.observation) !== "-" && "font-semibold text-red-600")}>
        {text(row.observation)}
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
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
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
