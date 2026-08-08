import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  FileText,
  History,
  ReceiptText,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TypeContrat,
} from "../types";

const PAGE_SIZE = 25;

type ReceivableKind = "DIRECT" | "INVOICE";
type PayerScope = "ALL" | "CLIENT" | "GROUPE";

export default function ReglementsClientsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreate = permissions.includes("reglement-client:create")
    || permissions.includes("reglement-client:manage");
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [receivableKind, setReceivableKind] = useState<ReceivableKind>("DIRECT");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [payerScope, setPayerScope] = useState<PayerScope>("ALL");
  const [selectedPayer, setSelectedPayer] = useState<PayerSelection>();
  const [brancheId, setBrancheId] = useState("ALL");
  const [contractType, setContractType] = useState<"ALL" | TypeContrat>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    brancheId: "ALL",
    contractType: "ALL" as "ALL" | TypeContrat,
    dateFrom: "",
    dateTo: "",
  });
  const [selected, setSelected] = useState<Record<string, ClientReceivable>>({});

  const payerSearch = usePayerSearch(
    payerScope === "ALL" ? undefined : payerScope,
    selectedPayer
  );
  const branches = useQuery({
    queryKey: ["compta", "insurance-branches"],
    queryFn: comptaApi.insuranceBranches,
    enabled: receivableKind === "DIRECT",
    staleTime: 60_000,
  });
  const queryFilters = {
    payeurType: selectedPayer?.type,
    payeurId: selectedPayer?.id,
    dateDu: appliedFilters.dateFrom || undefined,
    dateAu: appliedFilters.dateTo || undefined,
    search: appliedSearch || undefined,
    page,
    size: PAGE_SIZE,
  };
  const receivables = useQuery({
    queryKey: [
      "compta",
      "client-receivables",
      receivableKind,
      selectedPayer,
      appliedSearch,
      appliedFilters,
      page,
    ],
    queryFn: () => receivableKind === "INVOICE"
      ? comptaApi.clientInvoiceReceivables(queryFilters)
      : comptaApi.clientReceivables({
        ...queryFilters,
        brancheId: appliedFilters.brancheId === "ALL"
          ? undefined
          : appliedFilters.brancheId,
        typeContrat: appliedFilters.contractType === "ALL"
          ? undefined
          : appliedFilters.contractType,
      }),
  });
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
    setAppliedSearch(search.trim());
    setAppliedFilters({ brancheId, contractType, dateFrom, dateTo });
    setPage(0);
  }

  function resetFilters() {
    setSearch("");
    setAppliedSearch("");
    setPayerScope("ALL");
    payerSearch.clearQuery();
    setSelectedPayer(undefined);
    setBrancheId("ALL");
    setContractType("ALL");
    setDateFrom("");
    setDateTo("");
    setAppliedFilters({
      brancheId: "ALL",
      contractType: "ALL",
      dateFrom: "",
      dateTo: "",
    });
    setPage(0);
  }

  function selectPayer(value: string) {
    setSelectedPayer(payerSearch.resolve(value));
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
        <Tabs
          value={receivableKind}
          onValueChange={(value) => {
            setReceivableKind(value as ReceivableKind);
            setPage(0);
          }}
        >
          <TabsList aria-label="Origine des montants à encaisser">
            <TabsTrigger value="DIRECT">
              <ReceiptText className="size-4" />
              Écritures directes
            </TabsTrigger>
            <TabsTrigger value="INVOICE">
              <FileText className="size-4" />
              Factures émises
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="grid gap-2">
            <Label>Cible</Label>
            <Select
              value={payerScope}
              onValueChange={(value) => {
                setPayerScope(value as PayerScope);
                payerSearch.clearQuery();
                setSelectedPayer(undefined);
                setPage(0);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les payeurs</SelectItem>
                <SelectItem value="CLIENT">Client</SelectItem>
                <SelectItem value="GROUPE">Groupe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 md:col-span-1 xl:col-span-2">
            <Label>{payerScope === "GROUPE" ? "Rechercher un groupe" : "Rechercher un client"}</Label>
            {payerScope === "ALL" ? (
              <div className="flex h-9 items-center rounded-md border bg-muted/35 px-3 text-sm text-muted-foreground">
                Toutes les cibles
              </div>
            ) : (
              <AutocompleteSelect
                options={payerSearch.options}
                value={selectedPayer?.type === payerScope ? selectedPayer.id : ""}
                onValueChange={selectPayer}
                onQueryChange={payerScope === "CLIENT" ? payerSearch.setQuery : undefined}
                placeholder={payerScope === "CLIENT"
                  ? "Nom, RC, CIN, ICE ou code"
                  : "Code, groupe ou membre"}
                emptyText={payerSearch.loading
                  ? "Chargement..."
                  : "Aucun résultat"}
              />
            )}
          </div>
          {receivableKind === "DIRECT" && (
            <>
              <div className="grid gap-2">
                <Label>Branche</Label>
                <Select value={brancheId} onValueChange={setBrancheId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes</SelectItem>
                    {(branches.data ?? []).map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Type de contrat</Label>
                <Select
                  value={contractType}
                  onValueChange={(value) => setContractType(value as "ALL" | TypeContrat)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous</SelectItem>
                    <SelectItem value="PARTICULIER">Mono</SelectItem>
                    <SelectItem value="CONVENTION">Convention</SelectItem>
                    <SelectItem value="FLOTTE">Flotte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="grid gap-2">
            <Label>{receivableKind === "INVOICE" ? "Émission du" : "Date d’effet du"}</Label>
            <DatePicker
              date={dateFrom}
              onSelect={(value) => setDateFrom(toDateOnly(value) ?? "")}
            />
          </div>
          <div className="grid gap-2">
            <Label>{receivableKind === "INVOICE" ? "Émission au" : "Date d’effet au"}</Label>
            <DatePicker
              date={dateTo}
              onSelect={(value) => setDateTo(toDateOnly(value) ?? "")}
            />
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid min-w-72 flex-1 gap-2">
            <Label htmlFor="receivable-search">
              {receivableKind === "INVOICE"
                ? "N° de facture"
                : "Police, référence ou assistance"}
            </Label>
            <Input
              id="receivable-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyFilters();
                }
              }}
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
            Vous pouvez changer d’onglet pour compléter ce règlement avec la même cible.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <h2 className="font-semibold">Éléments à encaisser</h2>
                <p className="text-sm text-muted-foreground">
                  Solde ouvert de la page: {money(receivables.data?.summary.soldeOuvert ?? 0)}
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
              <SummaryCell label="Éléments" value={String(receivables.data?.summary.total ?? 0)} />
              <SummaryCell
                label="Montant initial"
                value={money(receivables.data?.summary.montantInitial ?? 0)}
              />
              <SummaryCell
                label="Déjà confirmé"
                value={money(receivables.data?.summary.montantConfirme ?? 0)}
              />
              <SummaryCell
                label="En attente"
                value={money(receivables.data?.summary.montantEnAttente ?? 0)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-orange-600 text-xs uppercase text-white">
                  <tr>
                    <th className="w-12 px-3 py-3" />
                    <th className="px-3 py-3 text-left">Payeur</th>
                    <th className="px-3 py-3 text-left">Police</th>
                    <th className="px-3 py-3 text-left">Nature</th>
                    <th className="px-3 py-3 text-left">Date</th>
                    <th className="px-3 py-3 text-right">TTC</th>
                    <th className="px-3 py-3 text-right">Confirmé</th>
                    <th className="px-3 py-3 text-right">En attente</th>
                    <th className="px-3 py-3 text-right">Solde</th>
                    <th className="px-3 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receivables.isLoading ? <TableRowsSkeleton colSpan={10} rows={8} /> :
                    (receivables.data?.rows ?? []).map((row) => (
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
                  {!receivables.isLoading && (receivables.data?.rows.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                        Aucun montant à encaisser ne correspond à la recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {receivables.data && (
              <ServerPagination
                page={receivables.data.page.number}
                totalPages={receivables.data.page.totalPages}
                totalElements={receivables.data.page.totalElements}
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
