import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  ChevronDown,
  ChevronRight,
  Eye,
  Landmark,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SortIcon } from "@/components/ui/sort-icon";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { clientApi } from "@/features/production/api/clients";
import { toDateOnly } from "@/features/production/date";
import { referenceApi } from "@/features/production/api/references";
import { referenceKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { ClientPaymentsWorkspaceHeader } from "../components/ClientPaymentsWorkspaceHeader";
import {
  usePayerSearch,
  type PayerSelection,
} from "../components/use-payer-search";
import { formatAccountingAmount } from "../format";
import {
  receivableCoverageReference,
  receivableDocumentReference,
  receivableTypeLabel,
} from "../receivable-display";
import type {
  ClientReceivable,
  ClientReceivablePage,
} from "../types";

const PAGE_SIZE = 25;

type PayerScope = "CLIENT" | "GROUPE";
type ReceivableDateType = "SAISIE" | "EFFET";
type SortKey = "PAYER" | "POLICE" | "DATE" | "TTC" | "BALANCE";
type SortDirection = "ASC" | "DESC";

export default function ReglementsClientsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreate = permissions.includes("reglement-client:create")
    || permissions.includes("reglement-client:manage");
  const navigate = useNavigate();
  const location = useLocation();
  const multiClientDeposit = location.pathname.endsWith("/versement-multi-clients");
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultDateType: ReceivableDateType = multiClientDeposit ? "SAISIE" : "EFFET";
  const requestedPayerId = searchParams.get("payeurId") || "";
  const requestedPayerType: PayerScope = searchParams.get("cible") === "GROUPE"
    ? "GROUPE"
    : "CLIENT";
  const [page, setPage] = useState(() => urlPage(searchParams.get("page")));
  const [reference, setReference] = useState(() => searchParams.get("search") || "");
  const [appliedReference, setAppliedReference] = useState(() => searchParams.get("search") || "");
  const [payerScope, setPayerScope] = useState<PayerScope>(requestedPayerType);
  const [selectedPayer, setSelectedPayer] = useState<PayerSelection>();
  const [branchId, setBranchId] = useState(() => searchParams.get("brancheId") || "ALL");
  const [companyId, setCompanyId] = useState(() => searchParams.get("compagnieId") || "ALL");
  const [dateType, setDateType] = useState<ReceivableDateType>(
    () => urlDateType(searchParams.get("typeDate"), defaultDateType)
  );
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("dateDu") || "");
  const [dateTo, setDateTo] = useState(() => searchParams.get("dateAu") || "");
  const [appliedFilters, setAppliedFilters] = useState({
    branchId: searchParams.get("brancheId") || "ALL",
    companyId: searchParams.get("compagnieId") || "ALL",
    dateType: urlDateType(searchParams.get("typeDate"), defaultDateType),
    dateFrom: searchParams.get("dateDu") || "",
    dateTo: searchParams.get("dateAu") || "",
  });
  const [selected, setSelected] = useState<Record<string, ClientReceivable>>({});
  const [sortKey, setSortKey] = useState<SortKey>(() => urlSortKey(searchParams.get("tri")));
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    () => searchParams.get("ordre") === "ASC" ? "ASC" : "DESC"
  );
  const [detailDocumentId, setDetailDocumentId] = useState<string>();
  const selectedDraft = useQuery({
    queryKey: [
      "compta",
      "multi-client-deposit-draft",
      searchParams.getAll("selectionElement"),
      searchParams.getAll("selectionDocument"),
    ],
    queryFn: () => comptaApi.selectedClientReceivables({
      elementFacturableIds: searchParams.getAll("selectionElement"),
      documentClientIds: searchParams.getAll("selectionDocument"),
      multiPayeur: true,
    }),
    enabled: multiClientDeposit && (
      searchParams.has("selectionElement") || searchParams.has("selectionDocument")
    ),
    staleTime: 0,
  });

  useEffect(() => {
    if (!multiClientDeposit || !selectedDraft.data) return;
    setSelected((current) => {
      const next = { ...current };
      selectedDraft.data.forEach((row) => {
        next[receivableTargetKey(row)] = row;
      });
      return next;
    });
  }, [multiClientDeposit, selectedDraft.data]);
  useEffect(() => {
    setPage(urlPage(searchParams.get("page")));
    setReference(searchParams.get("search") || "");
    setAppliedReference(searchParams.get("search") || "");
    setPayerScope(searchParams.get("cible") === "GROUPE" ? "GROUPE" : "CLIENT");
    setBranchId(searchParams.get("brancheId") || "ALL");
    setCompanyId(searchParams.get("compagnieId") || "ALL");
    setDateType(urlDateType(searchParams.get("typeDate"), defaultDateType));
    setDateFrom(searchParams.get("dateDu") || "");
    setDateTo(searchParams.get("dateAu") || "");
    setAppliedFilters({
      branchId: searchParams.get("brancheId") || "ALL",
      companyId: searchParams.get("compagnieId") || "ALL",
      dateType: urlDateType(searchParams.get("typeDate"), defaultDateType),
      dateFrom: searchParams.get("dateDu") || "",
      dateTo: searchParams.get("dateAu") || "",
    });
    setSortKey(urlSortKey(searchParams.get("tri")));
    setSortDirection(searchParams.get("ordre") === "ASC" ? "ASC" : "DESC");
    if (!searchParams.get("payeurId")) setSelectedPayer(undefined);
  }, [defaultDateType, searchParams]);

  const payerSearch = usePayerSearch(
    payerScope,
    selectedPayer
  );
  const branches = useQuery({
    queryKey: referenceKeys.list("branches-assurance"),
    queryFn: () => referenceApi.list("branches-assurance"),
    enabled: multiClientDeposit,
  });
  const selectedBranch = (branches.data ?? []).find((branch) => branch.id === branchId);
  const assistanceBranch = normalizeCode(selectedBranch?.code) === "ASSISTANCE";
  const insuranceCompanies = useQuery({
    queryKey: referenceKeys.list("compagnies-assurance"),
    queryFn: () => referenceApi.list("compagnies-assurance"),
    enabled: multiClientDeposit && branchId !== "ALL" && !assistanceBranch,
  });
  const assistanceCompanies = useQuery({
    queryKey: referenceKeys.list("compagnies-assistance"),
    queryFn: () => referenceApi.list("compagnies-assistance"),
    enabled: multiClientDeposit && branchId !== "ALL" && assistanceBranch,
  });
  const appliedAssistanceBranch = isAssistanceBranch(branches.data, appliedFilters.branchId);
  const appliedBranchReady = !multiClientDeposit
    || appliedFilters.branchId === "ALL"
    || !branches.isLoading;
  const requestedClient = useQuery({
    queryKey: ["crm-client", requestedPayerId],
    queryFn: () => clientApi.getClientCrm(requestedPayerId),
    enabled: Boolean(requestedPayerId) && requestedPayerType === "CLIENT",
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!requestedPayerId) return;
    if (selectedPayer?.id === requestedPayerId && selectedPayer.type === requestedPayerType) return;
    if (requestedPayerType === "CLIENT" && requestedClient.data?.client) {
      const client = requestedClient.data.client;
      setSelectedPayer({
        type: "CLIENT",
        id: client.id,
        name: client.nomAffichage || "Client",
        identifier: client.codeClient || client.rc || client.cin || client.ice || "",
        groupName: client.groupe?.libelle || undefined,
      });
      return;
    }
    if (requestedPayerType === "GROUPE") {
      const group = payerSearch.groups.find((item) => item.id === requestedPayerId);
      if (!group) return;
      setSelectedPayer({
        type: "GROUPE",
        id: group.id,
        name: group.libelle,
        identifier: group.code,
        treasuryName: group.clientTresorerieNom || undefined,
        memberCount: group.membres.length,
      });
    }
  }, [
    payerSearch.groups,
    requestedClient.data,
    requestedPayerId,
    requestedPayerType,
    selectedPayer?.id,
    selectedPayer?.type,
  ]);
  const queryFilters = {
    payeurType: selectedPayer?.type,
    payeurId: selectedPayer?.id,
    brancheId: multiClientDeposit && appliedFilters.branchId !== "ALL"
      ? appliedFilters.branchId
      : undefined,
    compagnieId: multiClientDeposit
      && appliedFilters.branchId !== "ALL"
      && !appliedAssistanceBranch
      && appliedFilters.companyId !== "ALL" ? appliedFilters.companyId : undefined,
    compagnieAssistanceId: multiClientDeposit
      && appliedAssistanceBranch
      && appliedFilters.companyId !== "ALL" ? appliedFilters.companyId : undefined,
    typeDate: multiClientDeposit ? appliedFilters.dateType : "EFFET" as const,
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
      appliedAssistanceBranch,
      sortKey,
      sortDirection,
      page,
    ],
    queryFn: () => loadCombinedReceivables(queryFilters, page, sortKey, sortDirection),
    enabled: appliedBranchReady && Boolean(
      selectedPayer
      || appliedReference
      || (multiClientDeposit && (
        appliedFilters.dateFrom
        || appliedFilters.dateTo
        || appliedFilters.branchId !== "ALL"
      ))
    ),
  });
  const showResults = Boolean(
    selectedPayer
    || appliedReference
    || (multiClientDeposit && (
      appliedFilters.dateFrom
      || appliedFilters.dateTo
      || appliedFilters.branchId !== "ALL"
    ))
  );
  const result = showResults ? receivables.data : undefined;
  const selectedRows = Object.values(selected);
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.soldeOuvert, 0);
  const payerKey = !multiClientDeposit && selectedRows[0] ? sourcePayerKey(selectedRows[0]) : null;
  const pageRows = result?.rows ?? [];
  const eligiblePageRows = pageRows.filter(isSelectableReceivable);
  const pagePayerKeys = new Set(eligiblePageRows.map(sourcePayerKey));
  const selectablePageRows = multiClientDeposit
    ? eligiblePageRows
    : payerKey
    ? eligiblePageRows.filter((row) => sourcePayerKey(row) === payerKey)
    : pagePayerKeys.size === 1 ? eligiblePageRows : [];
  const selectedOnPage = selectablePageRows.filter(
    (row) => Boolean(selected[receivableTargetKey(row)])
  ).length;
  const allPageSelected = selectablePageRows.length > 0
    && selectedOnPage === selectablePageRows.length;

  function toggle(row: ClientReceivable, checked: boolean) {
    if (checked && !isSelectableReceivable(row)) {
      return;
    }
    if (!multiClientDeposit && checked && payerKey && sourcePayerKey(row) !== payerKey) {
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

  function togglePage(checked: boolean) {
    if (!multiClientDeposit && checked && selectablePageRows.length === 0) {
      toast.error("Les éléments visibles appartiennent à plusieurs payeurs");
      return;
    }
    setSelected((current) => {
      const next = { ...current };
      const rows = checked ? selectablePageRows : pageRows;
      rows.forEach((row) => {
        const key = receivableTargetKey(row);
        if (checked) next[key] = row;
        else delete next[key];
      });
      return next;
    });
  }

  function applyFilters() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error("La date de début doit précéder la date de fin");
      return;
    }
    const nextReference = reference.trim();
    setAppliedReference(nextReference);
    setAppliedFilters({
      branchId: multiClientDeposit ? branchId : "ALL",
      companyId: multiClientDeposit ? companyId : "ALL",
      dateType: multiClientDeposit ? dateType : "EFFET",
      dateFrom,
      dateTo,
    });
    setPage(0);
    updateUrl({
      search: nextReference,
      brancheId: multiClientDeposit && branchId !== "ALL" ? branchId : undefined,
      compagnieId: multiClientDeposit && companyId !== "ALL" ? companyId : undefined,
      typeDate: multiClientDeposit && dateType !== defaultDateType ? dateType : undefined,
      dateDu: dateFrom,
      dateAu: dateTo,
      page: undefined,
    });
  }

  function resetFilters() {
    setReference("");
    setAppliedReference("");
    setPayerScope("CLIENT");
    payerSearch.clearQuery();
    setSelectedPayer(undefined);
    setBranchId("ALL");
    setCompanyId("ALL");
    setDateType(defaultDateType);
    setDateFrom("");
    setDateTo("");
    setAppliedFilters({
      branchId: "ALL",
      companyId: "ALL",
      dateType: defaultDateType,
      dateFrom: "",
      dateTo: "",
    });
    setPage(0);
    if (!multiClientDeposit) setSelected({});
    setSearchParams(
      multiClientDeposit ? selectionSearchParams(selectedRows) : new URLSearchParams(),
      { replace: true }
    );
  }

  function selectPayer(value: string) {
    const payer = payerSearch.resolve(value);
    const payerChanged = payer?.id !== selectedPayer?.id || payer?.type !== selectedPayer?.type;
    if (!payerChanged) {
      return;
    }
    setSelectedPayer(payer);
    if (!multiClientDeposit) setSelected({});
    setPage(0);
    updateUrl({
      cible: payerScope,
      payeurId: payer?.id,
      page: undefined,
    });
  }

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "ASC" ? "DESC" : "ASC");
    } else {
      setSortKey(nextKey);
      setSortDirection(nextKey === "PAYER" || nextKey === "POLICE" ? "ASC" : "DESC");
    }
    setPage(0);
    const nextDirection = sortKey === nextKey
      ? sortDirection === "ASC" ? "DESC" : "ASC"
      : nextKey === "PAYER" || nextKey === "POLICE" ? "ASC" : "DESC";
    updateUrl({ tri: nextKey, ordre: nextDirection, page: undefined });
  }

  function updateUrl(patch: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    updateUrl({ page: nextPage > 0 ? nextPage : undefined });
  }

  useEffect(() => {
    if (!multiClientDeposit) return;
    if (selectedDraft.isLoading || selectedDraft.isError) return;
    const next = new URLSearchParams(searchParams);
    const currentElements = next.getAll("selectionElement").sort().join(",");
    const currentDocuments = next.getAll("selectionDocument").sort().join(",");
    const selectedElements = selectedRows
      .flatMap((row) => row.source.documentClientId ? [] : row.source.elementFacturableId ?? [])
      .sort();
    const selectedDocuments = selectedRows
      .flatMap((row) => row.source.documentClientId ?? [])
      .sort();
    if (currentElements === selectedElements.join(",")
      && currentDocuments === selectedDocuments.join(",")) return;
    next.delete("selectionElement");
    next.delete("selectionDocument");
    selectedElements.forEach((id) => next.append("selectionElement", id));
    selectedDocuments.forEach((id) => next.append("selectionDocument", id));
    setSearchParams(next, { replace: true });
  }, [multiClientDeposit, searchParams, selectedDraft.isError, selectedDraft.isLoading, selectedRows, setSearchParams]);

  return (
    <div className="grid gap-5">
      <ClientPaymentsWorkspaceHeader
        title={multiClientDeposit ? "Nouveau versement multi-clients" : "Primes à encaisser"}
        description={multiClientDeposit
          ? "Recherchez plusieurs clients, conservez leurs créances dans la sélection puis enregistrez le bordereau bancaire."
          : "Primes restant à encaisser, paiements partiels et moyens de règlement."}
        canCreate={canCreate && !multiClientDeposit}
        showViewSelector={!multiClientDeposit}
        actions={multiClientDeposit ? (
          <Button asChild variant="outline">
            <Link to="/app/compta/reglements">
              <ArrowLeft className="size-4" />
              Retour aux encaissements
            </Link>
          </Button>
        ) : undefined}
      />

      <section className="grid gap-4 rounded-md border bg-card p-4">
        <div className={`grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:items-end ${
          multiClientDeposit ? "xl:grid-cols-4 2xl:grid-cols-6" : "xl:grid-cols-[220px_minmax(280px,1.4fr)_minmax(240px,1fr)_170px_170px_auto]"
        }`}>
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
                    if (!multiClientDeposit) setSelected({});
                    setPage(0);
                    updateUrl({ cible: mode, payeurId: undefined, page: undefined });
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
          {multiClientDeposit ? (
            <>
              <div className="grid gap-2">
                <Label>Branche</Label>
                <Select
                  value={branchId}
                  onValueChange={(value) => {
                    setBranchId(value);
                    setCompanyId("ALL");
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes les branches</SelectItem>
                    {(branches.data ?? []).map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{assistanceBranch ? "Compagnie d’assistance" : "Compagnie"}</Label>
                <Select value={companyId} disabled={branchId === "ALL"} onValueChange={setCompanyId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">
                      {branchId === "ALL" ? "Sélectionnez une branche" : "Toutes les compagnies"}
                    </SelectItem>
                    {(assistanceBranch ? assistanceCompanies.data ?? [] : insuranceCompanies.data ?? [])
                      .map((company) => (
                        <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Date filtrée</Label>
                <Select value={dateType} onValueChange={(value) => setDateType(value as ReceivableDateType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAISIE">Date de saisie</SelectItem>
                    <SelectItem value="EFFET">Date d’effet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
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
            {multiClientDeposit
              ? " Le versement peut être réparti entre plusieurs clients."
              : " La sélection reste limitée à une même cible."}
          </p>
        )}
      </section>

      {multiClientDeposit ? (
        <MultiClientSelection
          rows={selectedRows}
          total={selectedTotal}
          onRemove={(row) => toggle(row, false)}
          onContinue={() => navigate(paymentPath(selectedRows, true))}
          canContinue={canCreate && selectedRows.length > 0}
        />
      ) : null}

      <section className="overflow-hidden rounded-md border bg-card">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <h2 className="font-semibold">Primes à encaisser</h2>
                <p className="text-sm text-muted-foreground">
                  {showResults
                    ? `Solde ouvert: ${money(result?.summary.soldeOuvert ?? 0)}`
                    : multiClientDeposit
                      ? "Sélectionnez un client, une référence ou une période de saisie."
                      : "Sélectionnez un client ou recherchez une référence."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {!multiClientDeposit ? (
                <Button
                  disabled={!canCreate || !selectedRows.length}
                  onClick={() => navigate(paymentPath(selectedRows, false))}
                >
                  <Banknote className="size-4" />
                  Encaisser ({selectedRows.length})
                </Button>
                ) : null}
              </div>
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
                    <th className="w-12 px-3 py-3 text-center">
                      <Checkbox
                        aria-label="Sélectionner les éléments de cette page"
                        checked={allPageSelected
                          ? true
                          : selectedOnPage > 0 ? "indeterminate" : false}
                        disabled={pageRows.length === 0 || selectablePageRows.length === 0}
                        onCheckedChange={(value) => togglePage(value === true)}
                        className="border-white data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-orange-600 data-[state=indeterminate]:border-white data-[state=indeterminate]:bg-white data-[state=indeterminate]:text-orange-600"
                      />
                    </th>
                    <th className="px-3 py-3 text-left">
                      {multiClientDeposit ? "Payeur" : "Assuré"}
                    </th>
                    <th className="px-3 py-3 text-left">Référence</th>
                    <th className="px-3 py-3 text-left">Type</th>
                    <SortableHeader label="Police / contrat" column="POLICE" active={sortKey} direction={sortDirection} onSort={changeSort} />
                    <th className="px-3 py-3 text-left">Nature</th>
                    <SortableHeader
                      label={multiClientDeposit && appliedFilters.dateType === "SAISIE"
                        ? "Date saisie"
                        : "Date effet"}
                      column="DATE"
                      active={sortKey}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    <SortableHeader label="TTC" column="TTC" active={sortKey} direction={sortDirection} onSort={changeSort} align="right" />
                    <SortableHeader label="Reste à affecter" column="BALANCE" active={sortKey} direction={sortDirection} onSort={changeSort} align="right" />
                    <th className="px-3 py-3 text-center">Statut</th>
                    <th className="w-16 px-3 py-3 text-center">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {showResults && receivables.isLoading ? <TableRowsSkeleton colSpan={11} rows={8} /> :
                    (result?.rows ?? []).map((row) => {
                      const selectable = isSelectableReceivable(row);
                      return (
                        <tr key={receivableTargetKey(row)} className="hover:bg-muted/30">
                          <td className="px-3 py-3 text-center">
                            <Checkbox
                              checked={Boolean(selected[receivableTargetKey(row)])}
                              disabled={!selectable}
                              aria-label={selectable
                                ? "Sélectionner cet élément"
                                : "Élément entièrement affecté à un règlement en cours"}
                              onCheckedChange={(value) => toggle(row, value === true)}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <strong>
                              {multiClientDeposit
                                ? row.source.payeurNom
                                : row.source.assureNom
                                  || row.source.souscripteurNom
                                  || row.source.payeurNom}
                            </strong>
                            {multiClientDeposit
                              && row.source.assureNom
                              && row.source.assureNom !== row.source.payeurNom ? (
                                <div className="text-xs text-muted-foreground">
                                  Assuré: {row.source.assureNom}
                                </div>
                              ) : null}
                          </td>
                          <td className="px-3 py-3 font-medium">{receivableDocumentReference(row)}</td>
                          <td className="px-3 py-3">{receivableTypeLabel(row)}</td>
                          <td className="px-3 py-3"><strong>{receivableCoverageReference(row)}</strong></td>
                          <td className="px-3 py-3">
                            <strong>{row.source.mouvement}</strong>
                          </td>
                          <td className="px-3 py-3">
                            {date(multiClientDeposit && appliedFilters.dateType === "SAISIE"
                              ? row.source.dateSaisie
                              : row.source.dateEffet)}
                          </td>
                          <td className="px-3 py-3 text-right">{money(row.source.montantTtc)}</td>
                          <td className="px-3 py-3 text-right font-semibold">{money(row.soldeOuvert)}</td>
                          <td className="px-3 py-3 text-center"><StatusBadge value={row.statut} /></td>
                          <td className="px-2 py-2 text-center">
                            {row.source.documentClientId ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Voir les lignes de la facture"
                                aria-label={`Voir le détail de ${row.source.reference || "la facture"}`}
                                onClick={() => setDetailDocumentId(row.source.documentClientId ?? undefined)}
                              >
                                <Eye className="size-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {!showResults && (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                        Sélectionnez un client ou saisissez un numéro de facture ou de relevé.
                      </td>
                    </tr>
                  )}
                  {showResults && !receivables.isLoading && (result?.rows.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
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
                onPageChange={changePage}
              />
            )}
      </section>

      <InvoiceDetailDialog
        id={detailDocumentId}
        onOpenChange={(open) => !open && setDetailDocumentId(undefined)}
      />

    </div>
  );
}

function MultiClientSelection({
  rows,
  total,
  onRemove,
  onContinue,
  canContinue,
}: {
  rows: ClientReceivable[];
  total: number;
  onRemove: (row: ClientReceivable) => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const groups = groupSelectedReceivables(rows);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <div>
          <h2 className="font-semibold">Sélection du versement</h2>
          <p className="text-xs text-muted-foreground">Conservée pendant la recherche d’autres clients.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs uppercase text-muted-foreground">Total sélectionné</div>
            <div className="font-semibold tabular-nums">{money(total)}</div>
          </div>
          <Button disabled={!canContinue} onClick={onContinue}>
            <Landmark className="size-4" />
            Renseigner le versement ({rows.length})
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-5 text-center text-sm text-muted-foreground">
          Recherchez un client puis cochez les créances couvertes par le bordereau bancaire.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2" aria-label="Afficher le détail" />
                <th className="px-3 py-2 text-left">Payeur</th>
                <th className="px-3 py-2 text-left">Éléments</th>
                <th className="px-3 py-2 text-right">Sous-total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
          {groups.map((group) => (
            <SelectedPayerGroup
              key={group.key}
              group={group}
              expanded={expandedGroups.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
              onRemove={onRemove}
            />
          ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SelectedPayerGroup({
  group,
  expanded,
  onToggle,
  onRemove,
}: {
  group: ReturnType<typeof groupSelectedReceivables>[number];
  expanded: boolean;
  onToggle: () => void;
  onRemove: (row: ClientReceivable) => void;
}) {
  return (
    <>
      <tr className="hover:bg-muted/25">
        <td className="px-3 py-1.5 text-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Masquer" : "Afficher"} les créances de ${group.name}`}
            onClick={onToggle}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </td>
        <td className="px-3 py-2 font-semibold">{group.name}</td>
        <td className="px-3 py-2 text-muted-foreground">{selectedItemCount(group.rows.length)}</td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(group.total)}</td>
      </tr>
      {expanded ? group.rows.map((row) => (
        <tr key={receivableTargetKey(row)} className="bg-muted/20">
          <td />
          <td className="px-3 py-1.5 pl-6 text-muted-foreground">
            {receivableDocumentReference(row)}
          </td>
          <td className="px-3 py-1.5">{receivableCoverageReference(row)}</td>
          <td className="px-3 py-1.5">
            <div className="flex items-center justify-end gap-2">
              <span className="font-medium tabular-nums">{money(row.soldeOuvert)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Retirer de la sélection"
                aria-label={`Retirer ${receivableDocumentReference(row)} de la sélection`}
                onClick={() => onRemove(row)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </td>
        </tr>
      )) : null}
    </>
  );
}

function groupSelectedReceivables(rows: ClientReceivable[]) {
  const groups = new Map<string, { key: string; name: string; rows: ClientReceivable[]; total: number }>();
  rows.forEach((row) => {
    const key = sourcePayerKey(row);
    const existing = groups.get(key) ?? {
      key,
      name: row.source.payeurNom,
      rows: [],
      total: 0,
    };
    existing.rows.push(row);
    existing.total += row.soldeOuvert;
    groups.set(key, existing);
  });
  return Array.from(groups.values());
}

function InvoiceDetailDialog(props: {
  id?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useQuery({
    queryKey: ["compta", "client-document", props.id],
    queryFn: () => comptaApi.clientDocument(props.id as string),
    enabled: Boolean(props.id),
  });
  const document = detail.data;

  return (
    <Dialog open={Boolean(props.id)} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{document?.numero ?? "Détail de la facture"}</DialogTitle>
          <DialogDescription>
            {document
              ? `${document.payeurNom} · ${document.lignes.length} ligne${document.lignes.length > 1 ? "s" : ""}`
              : "Chargement des lignes de la facture."}
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="grid gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-40" />
          </div>
        ) : null}

        {document ? (
          <div className="grid gap-3">
            <div className="grid rounded-md border sm:grid-cols-3">
              <InvoiceInfo label="Date" value={date(document.dateEmission)} />
              <InvoiceInfo label="Montant" value={money(document.totalDocument)} />
              <InvoiceInfo label="Statut" value={document.statut} />
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Référence</th>
                    <th className="px-3 py-2 text-left">Police</th>
                    <th className="px-3 py-2 text-left">Nature</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {document.lignes.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 font-medium">{line.numeroQuittance || "-"}</td>
                      <td className="px-3 py-2">{line.numeroPolice || "-"}</td>
                      <td className="px-3 py-2">{line.mouvement || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{date(line.dateOperation)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {money(line.montantTtc)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
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
    COUVERTE_EN_ATTENTE: "Encaissement en cours",
    PAYEE: "Payée",
  };
  const styles: Record<ClientReceivable["statut"], string> = {
    IMPAYEE: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
    PARTIELLEMENT_REGLEE: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
    COUVERTE_EN_ATTENTE: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
    PAYEE: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  };
  return (
    <Badge variant="outline" className={styles[value]}>
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
  return (
    <th
      aria-sort={active ? (props.direction === "ASC" ? "ascending" : "descending") : "none"}
      className={`px-3 py-3 ${props.align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        className={`inline-flex items-center font-semibold transition-colors hover:text-white/80 ${
          props.align === "right" ? "w-full justify-end" : ""
        }`}
        onClick={() => props.onSort(props.column)}
      >
        {props.label}
        <SortIcon
          isActive={active}
          direction={props.direction === "ASC" ? "asc" : "desc"}
        />
      </button>
    </th>
  );
}

type ReceivableSearchFilters = {
  payeurType?: "CLIENT" | "GROUPE";
  payeurId?: string;
  brancheId?: string;
  compagnieId?: string;
  compagnieAssistanceId?: string;
  typeDate: ReceivableDateType;
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
  const rows = sortReceivables(
    [...directRows, ...invoiceRows],
    sortKey,
    sortDirection,
    filters.typeDate
  );
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

function sortReceivables(
  rows: ClientReceivable[],
  key: SortKey,
  direction: SortDirection,
  dateType: ReceivableDateType
) {
  const factor = direction === "ASC" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const comparison = key === "TTC"
      ? left.source.montantTtc - right.source.montantTtc
      : key === "BALANCE"
        ? left.soldeOuvert - right.soldeOuvert
        : key === "DATE"
          ? String(dateType === "SAISIE" ? left.source.dateSaisie : left.source.dateEffet)
            .localeCompare(String(dateType === "SAISIE" ? right.source.dateSaisie : right.source.dateEffet))
          : key === "POLICE"
            ? receivableCoverageReference(left).localeCompare(
              receivableCoverageReference(right),
              "fr",
              { numeric: true }
            )
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

function isSelectableReceivable(row: ClientReceivable) {
  return row.soldeOuvert > 0 && row.statut !== "PAYEE";
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

function urlPage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function urlSortKey(value: string | null): SortKey {
  return value === "PAYER"
    || value === "POLICE"
    || value === "TTC"
    || value === "BALANCE"
    ? value
    : "DATE";
}

function urlDateType(
  value: string | null,
  fallback: ReceivableDateType
): ReceivableDateType {
  return value === "SAISIE" || value === "EFFET" ? value : fallback;
}

function normalizeCode(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

function isAssistanceBranch(
  branches: Array<{ id: string; code?: string | null }> | undefined,
  branchId: string
) {
  return normalizeCode(branches?.find((branch) => branch.id === branchId)?.code) === "ASSISTANCE";
}

function paymentPath(rows: ClientReceivable[], multiClientDeposit = false) {
  const params = new URLSearchParams();
  if (multiClientDeposit) params.set("multi", "1");
  rows.forEach((row) => {
    if (row.source.documentClientId) {
      params.append("document", row.source.documentClientId);
    } else if (row.source.elementFacturableId) {
      params.append("element", row.source.elementFacturableId);
    }
  });
  return `/app/compta/reglements/nouveau?${params.toString()}`;
}

function selectionSearchParams(rows: ClientReceivable[]) {
  const params = new URLSearchParams();
  rows.forEach((row) => {
    if (row.source.documentClientId) {
      params.append("selectionDocument", row.source.documentClientId);
    } else if (row.source.elementFacturableId) {
      params.append("selectionElement", row.source.elementFacturableId);
    }
  });
  return params;
}
