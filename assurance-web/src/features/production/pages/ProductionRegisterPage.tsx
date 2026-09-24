import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, RotateCcw, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FilterField, ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTableHead, type TableSortDirection } from "@/components/ui/sortable-table-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadBlob } from "@/lib/download";
import { contractKeys, referenceKeys } from "@/lib/query-keys";
import { contractApi, type ProductionRegisterParams } from "../api/contracts";
import { referenceApi } from "../api/references";
import { toDateOnly } from "../date";
import type { ProductionRegisterRow, TypeContrat } from "../types";
import { moneyAmount } from "../utils/format";

type RegisterFilters = {
  typeDate: "EFFET" | "VALIDATION";
  dateDu: string;
  dateAu: string;
  brancheId: string;
  compagnieId: string;
  categorie: string;
  typeContrat: string;
  statut: string;
  search: string;
};

type SortColumn = "DATE" | "DATE_VALIDATION" | "DATE_EFFET" | "DOSSIER" | "POLICE" | "MOUVEMENT" | "COMPAGNIE" | "PRIME_NETTE" | "TTC";

const PAGE_SIZE = 25;

export default function ProductionRegisterPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromUrl(urlParams));
  const [appliedFilters, setAppliedFilters] = useState(() => filtersFromUrl(urlParams));
  const [page, setPage] = useState(() => readPage(urlParams.get("page")));
  const [sort, setSort] = useState<{ column: SortColumn; direction: TableSortDirection }>({
    column: readSortColumn(urlParams.get("sortBy")),
    direction: urlParams.get("sortDirection") === "asc" ? "asc" : "desc",
  });
  const [exporting, setExporting] = useState(false);

  const branches = useQuery({
    queryKey: referenceKeys.list("branches-assurance"),
    queryFn: () => referenceApi.list("branches-assurance"),
  });
  const companies = useQuery({
    queryKey: referenceKeys.list("compagnies-assurance"),
    queryFn: () => referenceApi.list("compagnies-assurance"),
  });

  const params = useMemo<ProductionRegisterParams>(() => ({
    ...toApiFilters(appliedFilters),
    sortBy: sort.column,
    sortDirection: sort.direction,
    page,
    size: PAGE_SIZE,
  }), [appliedFilters, page, sort]);

  const register = useQuery({
    queryKey: contractKeys.productionRegister(params),
    queryFn: () => contractApi.searchProductionRegister(params),
  });

  const invalidPeriod = filters.dateDu > filters.dateAu;
  const rows = register.data?.items ?? [];
  const totals = register.data?.totaux;

  function applyFilters() {
    if (invalidPeriod) return;
    setAppliedFilters(filters);
    setPage(0);
    setUrlParams(toUrlParams(filters, sort, 0), { replace: true });
  }

  function resetFilters() {
    const defaults = defaultFilters();
    const defaultSort = { column: "DATE" as const, direction: "desc" as const };
    setFilters(defaults);
    setAppliedFilters(defaults);
    setSort(defaultSort);
    setPage(0);
    setUrlParams(toUrlParams(defaults, defaultSort, 0), { replace: true });
  }

  function changeSort(column: SortColumn) {
    const next = {
      column,
      direction: sort.column === column && sort.direction === "asc" ? "desc" as const : "asc" as const,
    };
    setSort(next);
    setPage(0);
    setUrlParams(toUrlParams(appliedFilters, next, 0), { replace: true });
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    setUrlParams(toUrlParams(appliedFilters, sort, nextPage), { replace: true });
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const blob = await contractApi.exportProductionRegister({
        ...toApiFilters(appliedFilters),
        sortBy: sort.column,
        sortDirection: sort.direction,
      });
      downloadBlob(blob, `registre-production-${appliedFilters.dateDu}-${appliedFilters.dateAu}.xlsx`);
    } catch {
      toast.error("L'export du registre a échoué.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid w-full min-w-0 gap-4">
      <header>
        <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Production</div>
        <h1 className="mt-1 text-xl font-semibold">Registre de production</h1>
        <p className="text-sm text-muted-foreground">Historique des mouvements validés et annulés.</p>
      </header>

      <Card className="border-border/70 shadow-none">
        <CardContent className="grid gap-4 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FilterField label="Date de référence" tone="emerald">
              <Select value={filters.typeDate} onValueChange={(value) => setFilters((current) => ({ ...current, typeDate: value as RegisterFilters["typeDate"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFFET">Date d'effet</SelectItem>
                  <SelectItem value="VALIDATION">Date de validation</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Du" tone="emerald">
              <DatePicker date={filters.dateDu} onSelect={(date) => { const value = toDateOnly(date); if (value) setFilters((current) => ({ ...current, dateDu: value })); }} />
            </FilterField>
            <FilterField label="Au" tone="emerald">
              <DatePicker date={filters.dateAu} onSelect={(date) => { const value = toDateOnly(date); if (value) setFilters((current) => ({ ...current, dateAu: value })); }} />
            </FilterField>
            <ReferenceSelect label="Branche" value={filters.brancheId} allLabel="Toutes les branches" items={branches.data ?? []} onChange={(value) => setFilters((current) => ({ ...current, brancheId: value }))} />
            <ReferenceSelect label="Compagnie" value={filters.compagnieId} allLabel="Toutes les compagnies" items={companies.data ?? []} onChange={(value) => setFilters((current) => ({ ...current, compagnieId: value }))} />
            <FilterField label="Catégorie" tone="emerald">
              <Select value={filters.categorie} onValueChange={(value) => setFilters((current) => ({ ...current, categorie: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les catégories</SelectItem>
                  <SelectItem value="AFFAIRE_NOUVELLE">Affaire nouvelle</SelectItem>
                  <SelectItem value="AVENANT">Avenant</SelectItem>
                  <SelectItem value="RENOUVELLEMENT">Renouvellement</SelectItem>
                  <SelectItem value="DOCUMENT">Document</SelectItem>
                  <SelectItem value="SERVICE">Service</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Type de contrat" tone="emerald">
              <Select value={filters.typeContrat} onValueChange={(value) => setFilters((current) => ({ ...current, typeContrat: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les types</SelectItem>
                  <SelectItem value="PARTICULIER">Mono</SelectItem>
                  <SelectItem value="CONVENTION">Convention</SelectItem>
                  <SelectItem value="FLOTTE">Flotte</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Statut" tone="emerald">
              <Select value={filters.statut} onValueChange={(value) => setFilters((current) => ({ ...current, statut: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Validés et annulés</SelectItem>
                  <SelectItem value="VALIDE">Validés</SelectItem>
                  <SelectItem value="ANNULE">Annulés</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Client, dossier, police ou mouvement" tone="emerald" className="xl:col-span-2">
              <Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }} placeholder="Rechercher..." />
            </FilterField>
          </div>
          {invalidPeriod ? <p className="text-sm font-medium text-red-600">La date de début doit précéder la date de fin.</p> : null}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={resetFilters}><RotateCcw className="size-4" />Réinitialiser</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={invalidPeriod} onClick={applyFilters}><Search className="size-4" />Rechercher</Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9">
        <Metric label="Mouvements" value={String(totals?.mouvements ?? 0)} tone="blue" />
        <Metric label="Annulés" value={String(totals?.annules ?? 0)} tone="red" />
        <Metric label="Affaires nouvelles" value={String(totals?.affairesNouvelles ?? 0)} tone="green" />
        <Metric label="Avenants" value={String(totals?.avenants ?? 0)} tone="amber" />
        <Metric label="Renouvellements" value={String(totals?.renouvellements ?? 0)} tone="cyan" />
        <Metric label="Prime nette" value={moneyAmount(totals?.primeNette)} money tone="blue" />
        <Metric label="Taxes et frais" value={moneyAmount(totals?.taxesEtFrais)} money tone="amber" />
        <Metric label="TTC assurance" value={moneyAmount(totals?.primeTotale)} money tone="green" />
        <Metric label="TTC assistance" value={moneyAmount(totals?.assistanceTtc)} money tone="cyan" />
      </section>

      <Card className="min-w-0 overflow-hidden border-border/70 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Mouvements de production</h2>
            <p className="text-xs text-muted-foreground">Montants issus des instantanés validés. L'assistance reste séparée.</p>
          </div>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={!rows.length || exporting} onClick={exportExcel}>
            <Download className="size-4" />{exporting ? "Export..." : "Exporter Excel"}
          </Button>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1680px] text-[13px]">
              <TableHeader className="bg-emerald-700 text-white">
                <TableRow className="hover:bg-emerald-700">
                  <SortableTableHead column="POLICE" activeColumn={sort.column} direction={sort.direction} onSort={changeSort} className="text-white">Police</SortableTableHead>
                  <SortableTableHead column="DOSSIER" activeColumn={sort.column} direction={sort.direction} onSort={changeSort} className="text-white">Dossier</SortableTableHead>
                  <TableHead className="text-white">Souscripteur / assuré</TableHead>
                  <SortableTableHead column="MOUVEMENT" activeColumn={sort.column} direction={sort.direction} onSort={changeSort} className="text-white">Nature</SortableTableHead>
                  <SortableTableHead column="DATE_VALIDATION" activeColumn={sort.column} direction={sort.direction} onSort={changeSort} className="text-white">Validation</SortableTableHead>
                  <SortableTableHead column="DATE_EFFET" activeColumn={sort.column} direction={sort.direction} onSort={changeSort} className="text-white">Effet</SortableTableHead>
                  <SortableTableHead column="COMPAGNIE" activeColumn={sort.column} direction={sort.direction} onSort={changeSort} className="text-white">Compagnie</SortableTableHead>
                  <TableHead className="text-white">Branche</TableHead>
                  <TableHead className="text-white">Contrat</TableHead>
                  <SortableTableHead column="PRIME_NETTE" activeColumn={sort.column} direction={sort.direction} onSort={changeSort} align="right" className="text-white">Prime nette</SortableTableHead>
                  <TableHead className="text-right text-white">Taxes et frais</TableHead>
                  <SortableTableHead column="TTC" activeColumn={sort.column} direction={sort.direction} onSort={changeSort} align="right" className="text-white">TTC assurance</SortableTableHead>
                  <TableHead className="text-right text-white">TTC assistance</TableHead>
                  <TableHead className="text-center text-white">Statut</TableHead>
                  <TableHead className="text-center text-white">Détail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {register.isLoading ? <TableRowsSkeleton rows={8} colSpan={15} /> : null}
                {register.isError ? <TableRow><TableCell colSpan={15} className="h-24 text-center text-red-600">Impossible de charger le registre de production.</TableCell></TableRow> : null}
                {!register.isLoading && !register.isError && !rows.length ? <TableRow><TableCell colSpan={15} className="h-24 text-center text-muted-foreground">Aucun mouvement ne correspond aux filtres.</TableCell></TableRow> : null}
                {!register.isLoading && !register.isError ? rows.map((row) => <RegisterRow key={row.mouvementId} row={row} />) : null}
              </TableBody>
            </Table>
          </div>
          <ServerPagination page={register.data?.page.number ?? page} totalPages={register.data?.page.totalPages ?? 1} totalElements={register.data?.page.totalElements} loading={register.isLoading} showCurrentPage className="border-t px-4 py-3" onPageChange={changePage} />
        </CardContent>
      </Card>
    </div>
  );
}

function RegisterRow({ row }: { row: ProductionRegisterRow }) {
  return (
    <TableRow className={row.statut === "ANNULE" ? "bg-red-50/50 text-muted-foreground dark:bg-red-950/10" : undefined}>
      <TableCell>{row.numeroPolice || "-"}</TableCell>
      <TableCell className="font-medium">{row.numeroDossier || "-"}</TableCell>
      <TableCell><div>{row.souscripteur || "-"}</div>{row.assure && row.assure !== row.souscripteur ? <div className="text-xs text-muted-foreground">Assuré : {row.assure}</div> : null}</TableCell>
      <TableCell>
        <div className="font-medium">{row.mouvementLibelle}</div>
        {row.numeroMouvement ? <div className="text-xs text-muted-foreground">Mvt n° {row.numeroMouvement}</div> : row.mouvementCode ? <div className="text-xs text-muted-foreground">{row.mouvementCode}</div> : null}
      </TableCell>
      <TableCell>{formatDate(row.dateValidation)}</TableCell>
      <TableCell>{formatDate(row.dateEffet)}</TableCell>
      <TableCell>{row.compagnie || "-"}</TableCell>
      <TableCell>{row.branche || "-"}</TableCell>
      <TableCell>{contractTypeLabel(row.typeContrat)}</TableCell>
      <TableCell className="text-right tabular-nums">{moneyAmount(row.primeNette)}</TableCell>
      <TableCell className="text-right tabular-nums">{moneyAmount(row.taxesEtFrais)}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{moneyAmount(row.primeTotale)}</TableCell>
      <TableCell className="text-right tabular-nums">{row.assistanceTtc ? moneyAmount(row.assistanceTtc) : "-"}</TableCell>
      <TableCell className="text-center"><Badge variant={row.statut === "VALIDE" ? "success" : "red"}>{row.statut === "VALIDE" ? "Validé" : "Annulé"}</Badge></TableCell>
      <TableCell className="text-center">
        <Button asChild variant="ghost" size="icon" title="Voir le mouvement">
          <Link to={`/app/production/contrats/${row.contratId}?mouvementId=${row.mouvementId}`} target="_blank" rel="noopener noreferrer"><Eye className="size-4" /></Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ReferenceSelect({ label, value, allLabel, items, onChange }: { label: string; value: string; allLabel: string; items: Array<{ id: string; libelle: string; code?: string | null }>; onChange: (value: string) => void }) {
  return <FilterField label={label} tone="emerald"><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{allLabel}</SelectItem>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} - ` : ""}{item.libelle}</SelectItem>)}</SelectContent></Select></FilterField>;
}

function Metric({ label, value, money = false, tone }: { label: string; value: string; money?: boolean; tone: "blue" | "red" | "green" | "amber" | "cyan" }) {
  const styles = {
    blue: "border-t-blue-500 bg-blue-50/40 text-blue-800 dark:bg-blue-950/15 dark:text-blue-300",
    red: "border-t-red-500 bg-red-50/40 text-red-700 dark:bg-red-950/15 dark:text-red-300",
    green: "border-t-emerald-500 bg-emerald-50/40 text-emerald-800 dark:bg-emerald-950/15 dark:text-emerald-300",
    amber: "border-t-amber-500 bg-amber-50/40 text-amber-800 dark:bg-amber-950/15 dark:text-amber-300",
    cyan: "border-t-cyan-500 bg-cyan-50/40 text-cyan-800 dark:bg-cyan-950/15 dark:text-cyan-300",
  };
  return <div className={`min-w-0 border-b border-r border-t-2 px-4 py-3 last:border-r-0 ${styles[tone]}`}><div className="truncate text-[11px] font-medium uppercase text-muted-foreground">{label}</div><div className="mt-1 truncate text-base font-semibold tabular-nums">{value}{money ? " MAD" : ""}</div></div>;
}

function defaultFilters(): RegisterFilters {
  const now = new Date();
  return {
    typeDate: "EFFET",
    dateDu: toDateOnly(new Date(now.getFullYear(), now.getMonth(), 1)) ?? "",
    dateAu: toDateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0)) ?? "",
    brancheId: "ALL",
    compagnieId: "ALL",
    categorie: "ALL",
    typeContrat: "ALL",
    statut: "ALL",
    search: "",
  };
}

function filtersFromUrl(params: URLSearchParams): RegisterFilters {
  const defaults = defaultFilters();
  return {
    typeDate: params.get("typeDate") === "VALIDATION" ? "VALIDATION" : "EFFET",
    dateDu: params.get("dateDu") || defaults.dateDu,
    dateAu: params.get("dateAu") || defaults.dateAu,
    brancheId: params.get("brancheId") || "ALL",
    compagnieId: params.get("compagnieId") || "ALL",
    categorie: params.get("categorie") || "ALL",
    typeContrat: params.get("typeContrat") || "ALL",
    statut: params.get("statut") || "ALL",
    search: params.get("search") || "",
  };
}

function toApiFilters(filters: RegisterFilters): Omit<ProductionRegisterParams, "page" | "size" | "sortBy" | "sortDirection"> {
  return {
    typeDate: filters.typeDate,
    dateDu: filters.dateDu,
    dateAu: filters.dateAu,
    brancheId: filters.brancheId === "ALL" ? undefined : filters.brancheId,
    compagnieId: filters.compagnieId === "ALL" ? undefined : filters.compagnieId,
    categorie: filters.categorie === "ALL" ? undefined : filters.categorie,
    typeContrat: filters.typeContrat === "ALL" ? undefined : filters.typeContrat as TypeContrat,
    statut: filters.statut === "ALL" ? undefined : filters.statut as "VALIDE" | "ANNULE",
    search: filters.search.trim() || undefined,
  };
}

function toUrlParams(filters: RegisterFilters, sort: { column: SortColumn; direction: TableSortDirection }, page: number) {
  const params = new URLSearchParams();
  Object.entries(toApiFilters(filters)).forEach(([key, value]) => { if (value) params.set(key, String(value)); });
  params.set("sortBy", sort.column);
  params.set("sortDirection", sort.direction);
  if (page) params.set("page", String(page));
  return params;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function contractTypeLabel(value: TypeContrat) {
  return value === "PARTICULIER" ? "Mono" : value === "FLOTTE" ? "Flotte" : "Convention";
}

function readPage(value: string | null) {
  const page = Number(value ?? 0);
  return Number.isInteger(page) && page >= 0 ? page : 0;
}

function readSortColumn(value: string | null): SortColumn {
  const columns: SortColumn[] = ["DATE", "DATE_VALIDATION", "DATE_EFFET", "DOSSIER", "POLICE", "MOUVEMENT", "COMPAGNIE", "PRIME_NETTE", "TTC"];
  return columns.includes(value as SortColumn) ? value as SortColumn : "DATE";
}
