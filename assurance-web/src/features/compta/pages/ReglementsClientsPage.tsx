import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  History,
  ArrowDown,
  ArrowUp,
  RotateCcw,
  Search,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import {
  usePayerSearch,
  type PayerSelection,
} from "../components/use-payer-search";
import { formatAccountingAmount } from "../format";
import type {
  ClientReceivable,
  ClientReceivablePage,
} from "../types";

const PAGE_SIZE = 25;

type PayerScope = "CLIENT" | "GROUPE";
type SortKey = "PAYER" | "POLICE" | "DATE" | "TTC" | "BALANCE";
type SortDirection = "ASC" | "DESC";

export default function ReglementsClientsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreate = permissions.includes("reglement-client:create")
    || permissions.includes("reglement-client:manage");
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [reference, setReference] = useState("");
  const [appliedReference, setAppliedReference] = useState("");
  const [payerScope, setPayerScope] = useState<PayerScope>("CLIENT");
  const [selectedPayer, setSelectedPayer] = useState<PayerSelection>();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: "",
    dateTo: "",
  });
  const [selected, setSelected] = useState<Record<string, ClientReceivable>>({});
  const [sortKey, setSortKey] = useState<SortKey>("DATE");
  const [sortDirection, setSortDirection] = useState<SortDirection>("DESC");

  const payerSearch = usePayerSearch(
    payerScope,
    selectedPayer
  );
  const queryFilters = {
    payeurType: selectedPayer?.type,
    payeurId: selectedPayer?.id,
    dateDu: appliedFilters.dateFrom || undefined,
    dateAu: appliedFilters.dateTo || undefined,
    search: appliedReference || undefined,
    sortBy: sortKey === "TTC" ? "TTC" as const : "DATE" as const,
    sortDirection,
  };
  const receivables = useQuery({
    queryKey: [
      "compta",
      "client-receivables",
      selectedPayer,
      appliedReference,
      appliedFilters,
      sortKey,
      sortDirection,
      page,
    ],
    queryFn: () => loadCombinedReceivables(queryFilters, page, sortKey, sortDirection),
    enabled: Boolean(selectedPayer || appliedReference),
  });
  const showResults = Boolean(selectedPayer || appliedReference);
  const result = showResults ? receivables.data : undefined;
  const selectedRows = Object.values(selected);
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.soldeOuvert, 0);
  const payerKey = selectedRows[0] ? sourcePayerKey(selectedRows[0]) : null;

  function toggle(row: ClientReceivable, checked: boolean) {
    if (checked && payerKey && sourcePayerKey(row) !== payerKey) {
      toast.error("Sélectionnez uniquement les éléments d’un même payeur");
      return;
    }
    setSelected((current) => {
      const next = { ...current };
      const key = receivableTargetKey(row);
      if (checked) {
        next[key] = row;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  function applyFilters() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error("La date de début doit précéder la date de fin");
      return;
    }
    setAppliedReference(reference.trim());
    setAppliedFilters({ dateFrom, dateTo });
    setPage(0);
  }

  function resetFilters() {
    setReference("");
    setAppliedReference("");
    setPayerScope("CLIENT");
    payerSearch.clearQuery();
    setSelectedPayer(undefined);
    setDateFrom("");
    setDateTo("");
    setAppliedFilters({
      dateFrom: "",
      dateTo: "",
    });
    setPage(0);
  }

  function selectPayer(value: string) {
    setSelectedPayer(payerSearch.resolve(value));
    setPage(0);
  }

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "ASC" ? "DESC" : "ASC");
    } else {
      setSortKey(nextKey);
      setSortDirection(nextKey === "PAYER" || nextKey === "POLICE" ? "ASC" : "DESC");
    }
    setPage(0);
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">
            Comptabilité
          </div>
          <h1 className="mt-1 text-xl font-semibold">Règlements clients</h1>
          <p className="text-sm text-muted-foreground">
            Montants à encaisser, paiements partiels et moyens de règlement.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/compta/reglements/historique">
            <History className="size-4" />
            Règlements enregistrés
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 rounded-md border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_minmax(280px,1.4fr)_minmax(240px,1fr)_170px_170px_auto] xl:items-end">
          <div className="grid gap-2">
            <Label>Cible</Label>
            <div className="grid grid-cols-2 rounded-md border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900">
              {(["CLIENT", "GROUPE"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`h-8 rounded-sm px-3 text-sm font-medium ${
                    payerScope === mode
                      ? "bg-amber-100 text-amber-950 shadow-sm ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700"
                      : "text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => {
                    setPayerScope(mode);
                    payerSearch.clearQuery();
                    setSelectedPayer(undefined);
                    setPage(0);
                  }}
                >
                  {mode === "CLIENT" ? "Client" : "Groupe"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{payerScope === "GROUPE" ? "Rechercher un groupe" : "Rechercher un client"}</Label>
            <AutocompleteSelect
              options={payerSearch.options}
              value={selectedPayer?.type === payerScope ? selectedPayer.id : ""}
              onValueChange={selectPayer}
              onQueryChange={payerScope === "CLIENT" ? payerSearch.setQuery : undefined}
              placeholder={payerScope === "CLIENT"
                ? "Nom, RC, CIN, ICE ou code"
                : "Code, groupe ou membre"}
              emptyText={payerSearch.loading ? "Chargement..." : "Aucun résultat"}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="receivable-reference">N° facture / relevé</Label>
            <Input
              id="receivable-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
              placeholder="Numéro du document"
            />
          </div>
          <div className="grid gap-2">
            <Label>Date du</Label>
            <DatePicker
              date={dateFrom}
              onSelect={(value) => setDateFrom(toDateOnly(value) ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label>Date au</Label>
            <DatePicker
              date={dateTo}
              onSelect={(value) => setDateTo(toDateOnly(value) ?? "")}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={applyFilters}
            >
              <Search className="size-4" /> Rechercher
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={resetFilters}
              title="Réinitialiser"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
        {selectedRows.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {selectedItemCount(selectedRows.length)}, pour {money(selectedTotal)}.
            La sélection reste limitée à une même cible.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <h2 className="font-semibold">Éléments à encaisser</h2>
                <p className="text-sm text-muted-foreground">
                  {showResults
                    ? `Solde ouvert: ${money(result?.summary.soldeOuvert ?? 0)}`
                    : "Sélectionnez un client ou recherchez une référence."}
                </p>
              </div>
              <Button
                disabled={!canCreate || !selectedRows.length}
                onClick={() => navigate(paymentPath(selectedRows))}
              >
                <Banknote className="size-4" /> Encaisser ({selectedRows.length})
              </Button>
            </div>
            <div className="grid border-y bg-muted/25 sm:grid-cols-4">
              <SummaryCell label="Éléments" value={String(result?.summary.total ?? 0)} />
              <SummaryCell
                label="Montant initial"
                value={money(result?.summary.montantInitial ?? 0)}
              />
              <SummaryCell
                label="Déjà confirmé"
                value={money(result?.summary.montantConfirme ?? 0)}
              />
              <SummaryCell
                label="En attente"
                value={money(result?.summary.montantEnAttente ?? 0)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-orange-600 text-xs uppercase text-white">
                  <tr>
                    <th className="w-12 px-3 py-3" />
                    <SortableHeader label="Payeur" column="PAYER" active={sortKey} direction={sortDirection} onSort={changeSort} />
                    <SortableHeader label="Police" column="POLICE" active={sortKey} direction={sortDirection} onSort={changeSort} />
                    <th className="px-3 py-3 text-left">Nature</th>
                    <SortableHeader label="Date" column="DATE" active={sortKey} direction={sortDirection} onSort={changeSort} />
                    <SortableHeader label="TTC" column="TTC" active={sortKey} direction={sortDirection} onSort={changeSort} align="right" />
                    <th className="px-3 py-3 text-right">Confirmé</th>
                    <th className="px-3 py-3 text-right">En attente</th>
                    <SortableHeader label="Solde" column="BALANCE" active={sortKey} direction={sortDirection} onSort={changeSort} align="right" />
                    <th className="px-3 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {showResults && receivables.isLoading ? <TableRowsSkeleton colSpan={10} rows={8} /> :
                    (result?.rows ?? []).map((row) => (
                      <tr key={receivableTargetKey(row)} className="hover:bg-muted/30">
                        <td className="px-3 py-3 text-center">
                          <Checkbox
                            checked={Boolean(selected[receivableTargetKey(row)])}
                            onCheckedChange={(value) => toggle(row, value === true)}
                          />
                        </td>
                        <td className="px-3 py-3"><strong>{row.source.payeurNom}</strong></td>
                        <td className="px-3 py-3"><strong>{row.source.police || "-"}</strong></td>
                        <td className="px-3 py-3">
                          <strong>{row.source.mouvement}</strong>
                          <div className="text-xs text-muted-foreground">{row.source.reference || row.source.nature}</div>
                        </td>
                        <td className="px-3 py-3">{date(row.source.dateEffet)}</td>
                        <td className="px-3 py-3 text-right">{money(row.source.montantTtc)}</td>
                        <td className="px-3 py-3 text-right">{money(row.montantConfirme)}</td>
                        <td className="px-3 py-3 text-right">{money(row.montantEnAttente)}</td>
                        <td className="px-3 py-3 text-right font-semibold">{money(row.soldeOuvert)}</td>
                        <td className="px-3 py-3 text-center"><StatusBadge value={row.statut} /></td>
                      </tr>
                    ))}
                  {!showResults && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                        Sélectionnez un client ou saisissez un numéro de facture ou de relevé.
                      </td>
                    </tr>
                  )}
                  {showResults && !receivables.isLoading && (result?.rows.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                        Aucun montant à encaisser ne correspond à la recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {showResults && result && (
              <ServerPagination
                page={result.page.number}
                totalPages={result.page.totalPages}
                totalElements={result.page.totalElements}
                loading={receivables.isFetching}
                onPageChange={setPage}
              />
            )}
      </section>

    </div>
  );
}

type SummaryCellProps = {
  label: string;
  value: string;
  tone?: "default" | "danger";
};

function SummaryCell({ label, value, tone = "default" }: SummaryCellProps) {
  return (
    <div className="border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={tone === "danger" ? "mt-1 font-semibold text-red-600" : "mt-1 font-semibold"}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: ClientReceivable["statut"] }) {
  const labels: Record<ClientReceivable["statut"], string> = {
    IMPAYEE: "Impayée",
    PARTIELLEMENT_REGLEE: "Partielle",
    COUVERTE_EN_ATTENTE: "En attente",
    PAYEE: "Payée",
  };
  return (
    <Badge variant={value === "IMPAYEE" ? "secondary" : "outline"}>
      {labels[value]}
    </Badge>
  );
}

function SortableHeader(props: {
  label: string;
  column: SortKey;
  active: SortKey;
  direction: SortDirection;
  onSort: (column: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = props.active === props.column;
  const Icon = active && props.direction === "ASC" ? ArrowUp : ArrowDown;
  return (
    <th className={`px-3 py-3 ${props.align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold"
        onClick={() => props.onSort(props.column)}
      >
        {props.label}
        <Icon className={`size-3.5 ${active ? "opacity-100" : "opacity-45"}`} />
      </button>
    </th>
  );
}

type ReceivableSearchFilters = {
  payeurType?: "CLIENT" | "GROUPE";
  payeurId?: string;
  dateDu?: string;
  dateAu?: string;
  search?: string;
  sortBy: "DATE" | "TTC";
  sortDirection: SortDirection;
};

async function loadCombinedReceivables(
  filters: ReceivableSearchFilters,
  page: number,
  sortKey: SortKey,
  sortDirection: SortDirection
): Promise<ClientReceivablePage> {
  const [directRows, invoiceRows] = await Promise.all([
    loadAllReceivables((nextPage, size) => comptaApi.clientReceivables({
      ...filters,
      page: nextPage,
      size,
    })),
    loadAllReceivables((nextPage, size) => comptaApi.clientInvoiceReceivables({
      ...filters,
      page: nextPage,
      size,
    })),
  ]);
  const rows = sortReceivables([...directRows, ...invoiceRows], sortKey, sortDirection);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const visibleRows = rows.slice(start, start + PAGE_SIZE);

  return {
    summary: {
      total: rows.length,
      montantInitial: sumReceivables(rows, (row) => row.source.montantTtc),
      montantConfirme: sumReceivables(rows, (row) => row.montantConfirme),
      montantEnAttente: sumReceivables(rows, (row) => row.montantEnAttente),
      soldeOuvert: sumReceivables(rows, (row) => row.soldeOuvert),
    },
    page: {
      number: page,
      size: PAGE_SIZE,
      totalElements: rows.length,
      totalPages,
      first: page === 0,
      last: totalPages === 0 || page >= totalPages - 1,
    },
    rows: visibleRows,
  };
}

async function loadAllReceivables(
  fetchPage: (page: number, size: number) => Promise<ClientReceivablePage>
) {
  const size = 100;
  const first = await fetchPage(0, size);
  if (first.page.totalPages <= 1) return first.rows;

  const remaining = await Promise.all(
    Array.from({ length: first.page.totalPages - 1 }, (_, index) => fetchPage(index + 1, size))
  );
  return [first, ...remaining].flatMap((result) => result.rows);
}

function sortReceivables(rows: ClientReceivable[], key: SortKey, direction: SortDirection) {
  const factor = direction === "ASC" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const comparison = key === "TTC"
      ? left.source.montantTtc - right.source.montantTtc
      : key === "BALANCE"
        ? left.soldeOuvert - right.soldeOuvert
        : key === "DATE"
          ? String(left.source.dateEffet ?? "").localeCompare(String(right.source.dateEffet ?? ""))
          : key === "POLICE"
            ? String(left.source.police ?? "").localeCompare(String(right.source.police ?? ""), "fr", { numeric: true })
            : String(left.source.payeurNom ?? "").localeCompare(String(right.source.payeurNom ?? ""), "fr");
    return comparison * factor;
  });
}

function sumReceivables(rows: ClientReceivable[], value: (row: ClientReceivable) => number) {
  return rows.reduce((sum, row) => sum + value(row), 0);
}

function sourcePayerKey(row: ClientReceivable) {
  return `${row.source.payeurType}:${row.source.payeurId}`;
}

function receivableTargetKey(row: ClientReceivable) {
  if (row.source.documentClientId) {
    return `D:${row.source.documentClientId}`;
  }
  if (row.source.elementFacturableId) {
    return `E:${row.source.elementFacturableId}`;
  }
  throw new Error("Créance sans cible de règlement");
}

function money(value: number) {
  return formatAccountingAmount(value);
}

function date(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}

function selectedItemCount(count: number) {
  return count === 1 ? "1 élément sélectionné" : `${count} éléments sélectionnés`;
}

function paymentPath(rows: ClientReceivable[]) {
  const params = new URLSearchParams();
  rows.forEach((row) => {
    if (row.source.documentClientId) {
      params.append("document", row.source.documentClientId);
    } else if (row.source.elementFacturableId) {
      params.append("element", row.source.elementFacturableId);
    }
  });
  return `/app/compta/reglements/nouveau?${params.toString()}`;
}
