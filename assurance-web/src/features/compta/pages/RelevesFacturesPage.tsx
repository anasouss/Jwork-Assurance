import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Building2,
  Eye,
  FileDown,
  FilePlus2,
  FileText,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  AutocompleteSelect,
  type AutocompleteOption,
} from "@/components/ui/autocomplete-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  FilterField as SharedFilterField,
  ServerPagination,
  TableRowsSkeleton,
} from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { clientApi } from "@/features/production/api/clients";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { RelevePdfOptionsDialog } from "../components/RelevePdfOptionsDialog";
import {
  usePayerSearch,
  type PayerSelection,
} from "../components/use-payer-search";
import {
  DOCUMENT_DEFAULTS,
  SOURCE_DEFAULTS,
  releveSearchParams,
  releveSearchStateFromParams,
  type DocumentFilters,
  type ReleveSearchState,
  type SourceFilters,
} from "../releve-filters";
import type {
  ClientDocument,
  ClientDocumentSource,
  ClientDocumentType,
  ReferenceOption,
} from "../types";

type PayerScope = PayerSelection["type"];

const PAGE_SIZE = 25;

export default function RelevesFacturesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => releveSearchStateFromParams(searchParams), [searchParams]);
  const requestedPayerType = urlState.payerType;
  const requestedPayerId = urlState.payerId;
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canIssue = permissions.includes("quittance:create") || permissions.includes("quittance:manage");
  const canDelete = permissions.includes("quittance:manage");
  const [sourceFilters, setSourceFilters] = useState(urlState.sourceFilters);
  const [documentFilters, setDocumentFilters] = useState(urlState.documentFilters);
  const [selected, setSelected] = useState<Record<string, ClientDocumentSource>>({});
  const [issueOpen, setIssueOpen] = useState(false);
  const [detailId, setDetailId] = useState<string>();
  const [cancelTarget, setCancelTarget] = useState<ClientDocument>();
  const [deleteTarget, setDeleteTarget] = useState<ClientDocument>();
  const payerScope = urlState.payerScope;
  const [selectedPayer, setSelectedPayer] = useState<PayerSelection>();
  const payerSearch = usePayerSearch(payerScope, selectedPayer);

  useEffect(() => {
    setSourceFilters(urlState.sourceFilters);
    setDocumentFilters(urlState.documentFilters);
  }, [urlState]);

  const requestedClient = useQuery({
    queryKey: ["crm-client", requestedPayerId],
    queryFn: () => clientApi.getClientCrm(requestedPayerId),
    enabled: Boolean(requestedPayerId) && requestedPayerType === "CLIENT",
    staleTime: 30_000,
  });
  const branches = useQuery({
    queryKey: ["compta", "insurance-branches"],
    queryFn: comptaApi.insuranceBranches,
    staleTime: 60_000,
  });
  const companies = useQuery({
    queryKey: ["compta", "insurance-companies"],
    queryFn: comptaApi.companies,
    staleTime: 60_000,
  });

  const sourceParams = useMemo(() => ({
    payeurType: selectedPayer?.type,
    payeurId: selectedPayer?.id,
    brancheId: urlState.sourceFilters.brancheId === "ALL" ? undefined : urlState.sourceFilters.brancheId,
    compagnieId: urlState.sourceFilters.compagnieId === "ALL" ? undefined : urlState.sourceFilters.compagnieId,
    typeContrat: urlState.sourceFilters.typeContrat === "ALL" ? undefined : urlState.sourceFilters.typeContrat,
    documentState: urlState.sourceFilters.documentState === "ALL"
      ? undefined
      : urlState.sourceFilters.documentState,
    dateDu: urlState.sourceFilters.dateDu || undefined,
    dateAu: urlState.sourceFilters.dateAu || undefined,
    search: urlState.sourceFilters.search.trim() || undefined,
    page: urlState.sourcePage,
    size: PAGE_SIZE,
  }), [selectedPayer, urlState.sourceFilters, urlState.sourcePage]);
  const documentParams = useMemo(() => ({
    payeurType: selectedPayer?.type,
    payeurId: selectedPayer?.id,
    type: urlState.documentFilters.type === "ALL" ? undefined : urlState.documentFilters.type,
    statut: urlState.documentFilters.statut === "ALL" ? undefined : urlState.documentFilters.statut,
    dateDu: urlState.documentFilters.dateDu || undefined,
    dateAu: urlState.documentFilters.dateAu || undefined,
    search: urlState.documentFilters.search.trim() || undefined,
    page: urlState.documentPage,
    size: PAGE_SIZE,
  }), [selectedPayer, urlState.documentFilters, urlState.documentPage]);

  const sources = useQuery({
    queryKey: ["compta", "client-document-sources", sourceParams],
    queryFn: () => comptaApi.searchClientDocumentSources(sourceParams),
  });
  const documents = useQuery({
    queryKey: ["compta", "client-documents", documentParams],
    queryFn: () => comptaApi.searchClientDocuments(documentParams),
    enabled: urlState.tab === "documents",
  });

  useEffect(() => {
    setSelected({});
  }, [sourceParams]);

  function updateUrl(patch: Partial<ReleveSearchState>) {
    setSearchParams(releveSearchParams({ ...urlState, ...patch }), { replace: true });
  }

  function changePayer(payer?: PayerSelection, scope: PayerScope = payer?.type ?? payerScope) {
    setSelectedPayer(payer);
    setSelected({});
    updateUrl({
      payerScope: scope,
      payerType: scope === "GROUPE" ? "GROUPE" : "CLIENT",
      payerId: payer?.id ?? "",
      sourcePage: 0,
      documentPage: 0,
    });
  }

  useEffect(() => {
    if (!requestedPayerId) {
      if (selectedPayer) setSelectedPayer(undefined);
      return;
    }
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

  const selectedRows = useMemo(() => Object.values(selected), [selected]);
  const selectedPayerKey = selectedRows.length
    ? `${selectedRows[0].payeurType}:${selectedRows[0].payeurId}`
    : undefined;
  const pageRows = sources.data?.rows ?? [];
  const eligiblePageRows = pageRows.filter((row) => Boolean(row.elementFacturableId));
  const eligiblePayerKeys = new Set(
    eligiblePageRows.map((row) => `${row.payeurType}:${row.payeurId}`)
  );
  const bulkPayerKey = selectedPayerKey
    ?? (selectedPayer
      ? `${selectedPayer.type}:${selectedPayer.id}`
      : eligiblePayerKeys.size === 1
        ? eligiblePayerKeys.values().next().value
        : undefined);
  const bulkSelectableRows = bulkPayerKey
    ? eligiblePageRows.filter((row) => `${row.payeurType}:${row.payeurId}` === bulkPayerKey)
    : [];
  const allPageRowsSelected = bulkSelectableRows.length > 0
    && bulkSelectableRows.every((row) => Boolean(selected[row.elementFacturableId!]));
  const somePageRowsSelected = bulkSelectableRows.some((row) => Boolean(selected[row.elementFacturableId!]));

  function toggleSource(row: ClientDocumentSource, checked: boolean) {
    const elementFacturableId = row.elementFacturableId;
    if (!elementFacturableId) {
      toast.error("Cette écriture ne peut pas être ajoutée à un document client.");
      return;
    }
    const payerKey = `${row.payeurType}:${row.payeurId}`;
    if (checked && selectedPayerKey && selectedPayerKey !== payerKey) {
      toast.error("Sélectionnez uniquement des écritures du même payeur.");
      return;
    }
    setSelected((current) => {
      const next = { ...current };
      if (checked) next[elementFacturableId] = row;
      else delete next[elementFacturableId];
      return next;
    });
  }

  function togglePageSources(checked: boolean) {
    setSelected((current) => {
      const next = { ...current };
      for (const row of bulkSelectableRows) {
        const id = row.elementFacturableId;
        if (!id) continue;
        if (checked) next[id] = row;
        else delete next[id];
      }
      return next;
    });
  }

  function applySourceFilters() {
    updateUrl({ sourceFilters, sourcePage: 0 });
  }

  function resetSourceFilters() {
    setSourceFilters(SOURCE_DEFAULTS);
    updateUrl({ sourceFilters: SOURCE_DEFAULTS, sourcePage: 0 });
  }

  function applyDocumentFilters() {
    updateUrl({ documentFilters, documentPage: 0 });
  }

  function resetDocumentFilters() {
    setDocumentFilters(DOCUMENT_DEFAULTS);
    updateUrl({ documentFilters: DOCUMENT_DEFAULTS, documentPage: 0 });
  }

  return (
    <div className="grid min-w-0 gap-4 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-amber-700">Comptabilité client</div>
          <h1 className="text-2xl font-semibold">Relevés et factures</h1>
          <p className="text-sm text-muted-foreground">
            Relevés et factures à partir des écritures d'assurance et d'assistance validées.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {urlState.tab === "documents" ? (
            <Button variant="outline" onClick={() => updateUrl({ tab: "sources" })}>
              <ReceiptText className="size-4" />
              Retour aux écritures
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
              onClick={() => updateUrl({ tab: "documents", documentPage: 0 })}
            >
              <FileText className="size-4" />
              Documents émis
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/app/compta">Retour au tableau de bord</Link>
          </Button>
        </div>
      </div>

      {urlState.tab === "sources" ? (
        <>
          <SourceWorkspaceFilters
            filters={sourceFilters}
            branches={branches.data ?? []}
            companies={companies.data ?? []}
            payerMode={payerScope}
            selectedPayer={selectedPayer}
            payerOptions={payerSearch.options}
            payerLoading={payerSearch.loading}
            onPayerQueryChange={payerSearch.setQuery}
            onPayerModeChange={(mode) => {
              payerSearch.clearQuery();
              changePayer(undefined, mode);
            }}
            onPayerSelect={(value) => changePayer(payerSearch.resolve(value))}
            onChange={setSourceFilters}
            onApply={applySourceFilters}
            onReset={resetSourceFilters}
          />
          <Card className="min-w-0 shadow-none">
            <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">Écritures disponibles</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedRows.length
                    ? `${selectedRows.length} écriture(s) sélectionnée(s).`
                    : "Sélectionnez les écritures du même payeur à inclure dans un document."}
                </p>
              </div>
              {canIssue ? (
                <Button disabled={!selectedRows.length} onClick={() => setIssueOpen(true)}>
                  <FilePlus2 className="size-4" />
                  Créer un document{selectedRows.length ? ` (${selectedRows.length})` : ""}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1540px] border-collapse text-sm [&_td:not(:last-child)]:border-r [&_th:not(:last-child)]:border-r [&_th:not(:last-child)]:border-white/35">
                  <thead className="border-y bg-amber-600 text-white">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left">
                        <Checkbox
                          checked={allPageRowsSelected ? true : somePageRowsSelected ? "indeterminate" : false}
                          disabled={sources.isLoading || bulkSelectableRows.length === 0}
                          onCheckedChange={(checked) => togglePageSources(checked === true)}
                          aria-label="Sélectionner toutes les écritures éligibles de ce payeur"
                          title={!bulkPayerKey && eligiblePageRows.length
                            ? "Sélectionnez d'abord un client ou un groupe"
                            : "Sélectionner toutes les écritures éligibles"}
                          className="border-white/80 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-orange-700 data-[state=indeterminate]:border-white data-[state=indeterminate]:bg-white data-[state=indeterminate]:text-orange-700"
                        />
                      </th>
                      <Header>Souscripteur</Header>
                      <Header>Assuré</Header>
                      <Header>Police</Header>
                      <Header>Mouvement</Header>
                      <Header>Compagnie</Header>
                      <Header>Date d'effet</Header>
                      <Header align="right">Prime nette</Header>
                      <Header align="right">Taxes et frais</Header>
                      <Header align="right">TTC</Header>
                      <Header>FC/RL</Header>
                      <Header>Référence document</Header>
                      <Header align="center">Détail</Header>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.isLoading ? <LoadingRows columns={13} /> : null}
                    {!sources.isLoading && !(sources.data?.rows.length) ? (
                      <tr><td colSpan={13} className="h-32 text-center text-muted-foreground">Aucune écriture trouvée.</td></tr>
                    ) : null}
                    {pageRows.map((row) => (
                      <tr key={row.elementFacturableId} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={Boolean(selected[row.elementFacturableId])}
                            onCheckedChange={(checked) => toggleSource(row, checked === true)}
                            aria-label={`Sélectionner ${row.police || row.reference || row.dossier}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{row.souscripteurNom || "-"}</div>
                        </td>
                        <td className="px-3 py-3 font-medium">{row.assureNom || "-"}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium">
                            {row.nature === "ASSISTANCE" ? row.reference || "-" : row.police || row.reference || "-"}
                          </div>
                          {row.nature === "ASSISTANCE" ? (
                            <div className="text-xs text-muted-foreground">Contrat d'assistance</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">{row.mouvement}</td>
                        <td className="px-3 py-3">{row.compagnie}</td>
                        <td className="whitespace-nowrap px-3 py-3">{formatDate(row.dateEffet)}</td>
                        <MoneyCell value={row.primeNette} />
                        <MoneyCell value={taxesAndFees(row)} />
                        <MoneyCell value={row.montantTtc} strong />
                        <td className="px-3 py-3">
                          <DocumentTypeBadges documents={row.documents} />
                        </td>
                        <td className="px-3 py-3">
                          <DocumentReferences documents={row.documents} onOpen={setDetailId} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Button asChild variant="ghost" size="icon" title="Voir le contrat">
                            <Link to={`/app/production/contrats/${row.contratId}${row.mouvementId ? `?mouvementId=${row.mouvementId}` : ""}`}>
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PageFooter
                page={sources.data?.page}
                onPrevious={() => updateUrl({ sourcePage: Math.max(0, urlState.sourcePage - 1) })}
                onNext={() => updateUrl({ sourcePage: urlState.sourcePage + 1 })}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="grid gap-4">
          <DocumentSearch
            filters={documentFilters}
            onChange={setDocumentFilters}
            onApply={applyDocumentFilters}
            onReset={resetDocumentFilters}
          />
          <DocumentTable
            loading={documents.isLoading}
            rows={documents.data?.rows ?? []}
            page={documents.data?.page}
            onPrevious={() => updateUrl({ documentPage: Math.max(0, urlState.documentPage - 1) })}
            onNext={() => updateUrl({ documentPage: urlState.documentPage + 1 })}
            onDetail={setDetailId}
            onCancel={canIssue ? setCancelTarget : undefined}
            onDelete={canDelete ? setDeleteTarget : undefined}
          />
        </div>
      )}

      <IssueDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        rows={selectedRows}
        onIssued={() => {
          setSelected({});
          setIssueOpen(false);
          updateUrl({ tab: "sources", sourcePage: 0, documentPage: 0 });
        }}
      />
      <DocumentDetailDialog id={detailId} onOpenChange={(open) => !open && setDetailId(undefined)} />
      <CancelDocumentDialog
        target={cancelTarget}
        onClose={() => setCancelTarget(undefined)}
        onCancelled={() => updateUrl({ tab: "sources", sourcePage: 0, documentPage: 0 })}
      />
      <DeleteDocumentDialog target={deleteTarget} onClose={() => setDeleteTarget(undefined)} />
    </div>
  );
}

function SourceWorkspaceFilters(props: {
  filters: SourceFilters;
  branches: ReferenceOption[];
  companies: ReferenceOption[];
  payerMode: PayerScope;
  selectedPayer?: PayerSelection;
  payerOptions: AutocompleteOption[];
  payerLoading: boolean;
  onPayerModeChange: (mode: PayerScope) => void;
  onPayerQueryChange: (query: string) => void;
  onPayerSelect: (value: string) => void;
  onChange: (value: SourceFilters) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const { filters, onChange } = props;
  const PayerIcon = props.payerMode === "GROUPE" ? Building2 : Users;
  return (
    <section className="overflow-visible rounded-md border bg-card">
      <div className="border-b bg-muted/30 px-4 py-3 font-semibold">Recherche des écritures</div>
      <div className="grid gap-4 p-4">
        <div className="grid gap-3 lg:grid-cols-[240px_minmax(300px,520px)_1fr] lg:items-end">
          <FilterField label="Cible">
            <div className="grid grid-cols-2 rounded-md border bg-muted p-1">
              {(["CLIENT", "GROUPE"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`h-8 rounded-sm px-3 text-sm font-medium ${
                    props.payerMode === mode
                      ? "bg-amber-100 text-amber-950 shadow-sm ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                  onClick={() => props.onPayerModeChange(mode)}
                >
                  {mode === "CLIENT" ? "Client" : "Groupe"}
                </button>
              ))}
            </div>
          </FilterField>
          <FilterField label={props.payerMode === "CLIENT" ? "Client" : "Groupe"}>
            <AutocompleteSelect
              options={props.payerOptions}
              value={props.selectedPayer?.type === props.payerMode ? props.selectedPayer.id : ""}
              onValueChange={props.onPayerSelect}
              onQueryChange={props.payerMode === "CLIENT" ? props.onPayerQueryChange : undefined}
              placeholder={props.payerMode === "CLIENT" ? "Nom, RC, CIN, ICE ou code" : "Code, groupe ou membre"}
              emptyText={props.payerLoading ? "Chargement..." : "Aucun résultat"}
            />
          </FilterField>
          {props.selectedPayer ? (
            <div className="flex min-w-0 items-center gap-3 rounded-md border bg-amber-50/60 px-3 py-2 dark:bg-amber-950/20">
              <PayerIcon className="size-5 shrink-0 text-amber-700" />
              <div className="min-w-0">
                <div className="truncate font-semibold">{props.selectedPayer.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[props.selectedPayer.identifier, props.selectedPayer.groupName].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
          ) : <div />}
        </div>

        <div className="grid gap-3 border-t pt-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <FilterField label="Branche">
          <Select value={filters.brancheId} onValueChange={(value) => onChange({ ...filters, brancheId: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes</SelectItem>
              {props.branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>{branch.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Compagnie">
          <Select value={filters.compagnieId} onValueChange={(value) => onChange({ ...filters, compagnieId: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes</SelectItem>
              {props.companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Type de contrat">
          <Select value={filters.typeContrat} onValueChange={(value) => onChange({ ...filters, typeContrat: value as SourceFilters["typeContrat"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              <SelectItem value="PARTICULIER">Mono</SelectItem>
              <SelectItem value="CONVENTION">Convention</SelectItem>
              <SelectItem value="FLOTTE">Flotte</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="État">
          <Select value={filters.documentState} onValueChange={(value) => onChange({ ...filters, documentState: value as SourceFilters["documentState"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les impayés</SelectItem>
              <SelectItem value="SANS_DOCUMENT">Sans document</SelectItem>
              <SelectItem value="RELEVE">Relevé</SelectItem>
              <SelectItem value="FACTURE">Facture</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Date d'effet du">
          <DatePicker date={filters.dateDu} onSelect={(date) => onChange({ ...filters, dateDu: toDateOnly(date) ?? "" })} />
        </FilterField>
        <FilterField label="Date d'effet au">
          <DatePicker date={filters.dateAu} onSelect={(date) => onChange({ ...filters, dateAu: toDateOnly(date) ?? "" })} />
        </FilterField>
        <FilterField label="Référence">
          <Input value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} />
        </FilterField>
        <SearchActions onApply={props.onApply} onReset={props.onReset} />
        </div>
      </div>
    </section>
  );
}

function DocumentSearch(props: {
  filters: DocumentFilters;
  onChange: (value: DocumentFilters) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const { filters, onChange } = props;
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3"><CardTitle className="text-base">Recherche des documents</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.5fr_auto]">
        <FilterField label="Type">
          <Select value={filters.type} onValueChange={(value) => onChange({ ...filters, type: value as DocumentFilters["type"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              <SelectItem value="RELEVE">Relevé</SelectItem>
              <SelectItem value="FACTURE">Facture</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Statut">
          <Select value={filters.statut} onValueChange={(value) => onChange({ ...filters, statut: value as DocumentFilters["statut"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              <SelectItem value="EMIS">Émis</SelectItem>
              <SelectItem value="ANNULE">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Émis du">
          <DatePicker date={filters.dateDu} onSelect={(date) => onChange({ ...filters, dateDu: toDateOnly(date) ?? "" })} />
        </FilterField>
        <FilterField label="Émis au">
          <DatePicker date={filters.dateAu} onSelect={(date) => onChange({ ...filters, dateAu: toDateOnly(date) ?? "" })} />
        </FilterField>
        <FilterField label="N° document">
          <Input value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} />
        </FilterField>
        <SearchActions onApply={props.onApply} onReset={props.onReset} />
      </CardContent>
    </Card>
  );
}

function DocumentTable(props: {
  loading: boolean;
  rows: ClientDocument[];
  page?: { number: number; totalElements: number; totalPages: number; first: boolean; last: boolean };
  onPrevious: () => void;
  onNext: () => void;
  onDetail: (id: string) => void;
  onCancel?: (document: ClientDocument) => void;
  onDelete?: (document: ClientDocument) => void;
}) {
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Documents émis</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-y bg-amber-600 text-white">
              <tr>
                <Header>N° document</Header>
                <Header>Type</Header>
                <Header>Émission</Header>
                <Header>Période</Header>
                <Header align="right">Montant</Header>
                <Header>Statut</Header>
                <Header align="center">Actions</Header>
              </tr>
            </thead>
            <tbody>
              {props.loading ? <LoadingRows columns={7} /> : null}
              {!props.loading && !props.rows.length ? (
                <tr><td colSpan={7} className="h-32 text-center text-muted-foreground">Aucun document émis.</td></tr>
              ) : null}
              {props.rows.map((document) => (
                <tr key={document.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{document.numero}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline">
                      {document.typeDocument === "FACTURE" ? "FC" : "RL"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{formatDate(document.dateEmission)}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatDate(document.periodeDebut)} au {formatDate(document.periodeFin)}
                  </td>
                  <MoneyCell value={document.totalDocument} strong />
                  <td className="px-3 py-3">
                    {document.statut === "EMIS"
                      ? <Badge className="bg-emerald-100 text-emerald-800">Émis</Badge>
                      : <Badge variant="destructive">Annulé</Badge>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" title="Voir le détail" onClick={() => props.onDetail(document.id)}>
                        <Eye className="size-4" />
                      </Button>
                      <PdfButton document={document} />
                      {props.onCancel && document.statut === "EMIS" ? (
                        <Button variant="ghost" size="icon" title="Rectifier le document" onClick={() => props.onCancel?.(document)}>
                          <Ban className="size-4 text-destructive" />
                        </Button>
                      ) : null}
                      {props.onDelete ? (
                        <Button variant="ghost" size="icon" title="Supprimer le document" onClick={() => props.onDelete?.(document)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PageFooter page={props.page} onPrevious={props.onPrevious} onNext={props.onNext} />
      </CardContent>
    </Card>
  );
}

function IssueDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ClientDocumentSource[];
  onIssued: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<ClientDocumentType>("RELEVE");
  const [dueDate, setDueDate] = useState("");
  const [dueDateInitialized, setDueDateInitialized] = useState(false);
  const [notes, setNotes] = useState("");
  const sourceIds = useMemo(
    () => props.rows
      .map((row) => row.elementFacturableId)
      .filter((id): id is string => Boolean(id)),
    [props.rows]
  );
  const sourceKey = sourceIds.join(",");
  const dueDateProposal = useQuery({
    queryKey: ["compta", "client-document-due-date", sourceIds],
    queryFn: () => comptaApi.proposeClientDocumentDueDate(sourceIds),
    enabled: props.open && type === "FACTURE" && sourceIds.length > 0,
  });
  const invoiceEligible = props.rows.every((row) => row.facturable);
  const debit = props.rows.reduce((sum, row) => sum + Math.max(row.montantTtc, 0), 0);
  const credit = props.rows.reduce((sum, row) => sum + Math.abs(Math.min(row.montantTtc, 0)), 0);
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const maximumDueDate = dueDateProposal.data?.dateEcheanceProposee
    ? parseLocalDate(dueDateProposal.data.dateEcheanceProposee)
    : undefined;

  useEffect(() => {
    if (!props.open || !props.rows.length) return;
    setType("RELEVE");
    setDueDate("");
    setDueDateInitialized(false);
    setNotes("");
  }, [props.open, sourceKey, invoiceEligible]);

  useEffect(() => {
    if (!dueDateInitialized && dueDateProposal.data?.dateEcheanceProposee) {
      setDueDate(dueDateProposal.data.dateEcheanceProposee);
      setDueDateInitialized(true);
    }
  }, [dueDateInitialized, dueDateProposal.data]);

  const issue = useMutation({
    mutationFn: () => comptaApi.createClientDocument({
      typeDocument: type,
      elementFacturableIds: sourceIds,
      dateEcheance: type === "FACTURE" ? dueDate : undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: async (document) => {
      toast.success(`${document.typeDocument === "RELEVE" ? "Relevé" : "Facture"} ${document.numero} émis.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "client-document-sources"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-documents"] }),
      ]);
      props.onIssued();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Émission impossible"),
  });
  const invalid = type === "FACTURE"
    && (!dueDate || !invoiceEligible || dueDateProposal.isLoading || dueDateProposal.isError);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Créer un document client
          </DialogTitle>
          <DialogDescription>
            {props.rows.length} écriture(s) pour {props.rows[0]?.payeurNom ?? "-"}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid max-w-md grid-cols-2 rounded-md border bg-muted p-1">
            {([
              { value: "RELEVE" as const, label: "Relevé", Icon: FileText },
              { value: "FACTURE" as const, label: "Facture", Icon: ReceiptText },
            ]).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className={`flex h-10 items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium ${
                  type === value
                    ? "bg-amber-100 text-amber-950 shadow-sm ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                }`}
                onClick={() => setType(value)}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
          {type === "FACTURE" && !invoiceEligible ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              La sélection contient une écriture déjà facturée ou non facturable.
            </div>
          ) : null}
          {type === "FACTURE" ? (
            <div className="max-w-sm">
              <FilterField label="Échéance de paiement *">
                <DatePicker
                  date={dueDate}
                  onSelect={(date) => {
                    setDueDate(toDateOnly(date) ?? "");
                    setDueDateInitialized(true);
                  }}
                  minDate={today}
                  maxDate={maximumDueDate}
                />
              </FilterField>
              {dueDateProposal.isLoading ? (
                <p className="mt-1 text-xs text-muted-foreground">Calcul de l’échéance applicable...</p>
              ) : dueDateProposal.isError ? (
                <p className="mt-1 text-xs text-destructive">
                  Impossible de déterminer le délai applicable. Réessayez avant d’émettre la facture.
                </p>
              ) : dueDateProposal.data ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {dueDateProposal.data.origine === "DEFAUT_60_JOURS"
                    ? "Délai par défaut"
                    : dueDateProposal.data.origine === "CONDITION_GROUPE"
                      ? "Condition du groupe"
                      : "Condition du client"}
                  {` : ${dueDateProposal.data.delaiJours} jours maximum.`}
                  {!dueDateProposal.data.justificatifPresent
                    && dueDateProposal.data.origine !== "DEFAUT_60_JOURS"
                    ? " Justificatif non joint."
                    : ""}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <Header>Police / référence</Header>
                  <Header>Mouvement</Header>
                  <Header>Date</Header>
                  <Header align="right">Prime nette</Header>
                  <Header align="right">Taxes et frais</Header>
                  <Header align="right">TTC</Header>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((row) => (
                  <tr key={row.elementFacturableId} className="border-t">
                    <td className="px-3 py-2">
                      <div>{row.nature === "ASSISTANCE" ? row.reference || "-" : row.police || row.reference || "-"}</div>
                      {row.nature === "ASSISTANCE" ? (
                        <div className="text-xs text-muted-foreground">Contrat d'assistance</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{row.mouvement}</td>
                    <td className="px-3 py-2">{formatDate(row.dateEffet)}</td>
                    <MoneyCell value={row.primeNette} />
                    <MoneyCell value={taxesAndFees(row)} />
                    <MoneyCell value={row.montantTtc} strong />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_320px]">
            <FilterField label="Notes">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} />
            </FilterField>
            <div className="rounded-md border">
              <SummaryLine label="Total débit" value={debit} />
              {type === "RELEVE" ? <SummaryLine label="Total crédit" value={credit} /> : null}
              <SummaryLine label={type === "RELEVE" ? "Solde" : "Total à payer"} value={debit - credit} strong />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Annuler</Button>
          <Button disabled={invalid || issue.isPending} onClick={() => issue.mutate()}>
            <FilePlus2 className="size-4" />
            {issue.isPending
              ? "Traitement..."
              : type === "RELEVE"
                ? "Créer le relevé"
                : "Émettre la facture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentDetailDialog(props: { id?: string; onOpenChange: (open: boolean) => void }) {
  const detail = useQuery({
    queryKey: ["compta", "client-document", props.id],
    queryFn: () => comptaApi.clientDocument(props.id as string),
    enabled: Boolean(props.id),
  });
  const document = detail.data;
  return (
    <Dialog open={Boolean(props.id)} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{document?.numero ?? "Chargement du document"}</DialogTitle>
          <DialogDescription>
            {document ? `${document.typeDocument === "RELEVE" ? "Relevé" : "Facture"} · ${document.payeurNom}` : ""}
          </DialogDescription>
        </DialogHeader>
        {detail.isLoading ? <div className="grid gap-3"><Skeleton className="h-20" /><Skeleton className="h-56" /></div> : null}
        {document ? (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-md border p-4 md:grid-cols-4">
              <Info label="Payeur" value={document.payeurNom} />
              <Info label="Identifiant" value={document.payeurIdentifiant || "-"} />
              <Info label="Période" value={`${formatDate(document.periodeDebut)} au ${formatDate(document.periodeFin)}`} />
              <Info label="Montant" value={formatMoney(document.totalDocument)} />
            </div>
            {document.statut === "ANNULE" ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <div className="font-medium text-destructive">Document annulé</div>
                <div className="mt-1 text-sm">{document.motifAnnulation || "-"}</div>
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted">
                  <tr>
                    <Header>Date</Header>
                    <Header>Police / référence</Header>
                    <Header>Mouvement</Header>
                    <Header align="right">Prime nette</Header>
                    <Header align="right">Taxes et frais</Header>
                    <Header align="right">Débit</Header>
                    <Header align="right">Crédit</Header>
                  </tr>
                </thead>
                <tbody>
                  {document.lignes.map((line) => (
                    <tr key={line.id} className="border-t">
                      <td className="px-3 py-2">{formatDate(line.dateOperation)}</td>
                      <td className="px-3 py-2">
                        <div>
                          {line.nature === "ASSISTANCE"
                            ? line.numeroQuittance || "-"
                            : line.numeroPolice || line.numeroQuittance || "-"}
                        </div>
                        {line.nature !== "ASSISTANCE" && line.numeroQuittance && line.numeroQuittance !== line.numeroPolice ? (
                          <div className="text-xs text-muted-foreground">{line.numeroQuittance}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{line.mouvement}</td>
                      <MoneyCell value={line.primeNette} />
                      <MoneyCell value={taxesAndFees(line)} />
                      <MoneyCell value={line.debit} />
                      <MoneyCell value={line.credit} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          {document ? <PdfButton document={document} withLabel /> : null}
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDocumentDialog(props: {
  target?: ClientDocument;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (props.target) setReason("");
  }, [props.target]);

  const cancel = useMutation({
    mutationFn: () => comptaApi.cancelClientDocument(props.target?.id as string, reason.trim()),
    onSuccess: async () => {
      toast.success("Document annulé.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "client-document-sources"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-documents"] }),
      ]);
      props.onClose();
      props.onCancelled();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Annulation impossible"),
  });
  return (
    <AlertDialog open={Boolean(props.target)} onOpenChange={(open) => !open && props.onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rectifier {props.target?.numero} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le document émis restera inchangé dans l'historique avec le statut annulé. Ses écritures
            redeviendront disponibles pour composer et émettre un nouveau document.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FilterField label="Motif d'annulation *">
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Indiquez la raison de l'annulation"
          />
        </FilterField>
        <AlertDialogFooter>
          <AlertDialogCancel>Fermer</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground"
            disabled={!reason.trim() || cancel.isPending}
            onClick={(event) => {
              event.preventDefault();
              cancel.mutate();
            }}
          >
            {cancel.isPending ? "Annulation..." : "Annuler et recomposer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteDocumentDialog(props: { target?: ClientDocument; onClose: () => void }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => comptaApi.deleteClientDocument(props.target?.id as string),
    onSuccess: async () => {
      toast.success("Document supprimé.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "client-document-sources"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-documents"] }),
      ]);
      props.onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Suppression impossible"),
  });

  return (
    <AlertDialog open={Boolean(props.target)} onOpenChange={(open) => !open && props.onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {props.target?.numero} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette suppression est définitive. Les écritures liées redeviendront disponibles pour un nouveau document.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Fermer</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground"
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              remove.mutate();
            }}
          >
            <Trash2 className="size-4" />
            {remove.isPending ? "Suppression..." : "Supprimer définitivement"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PdfButton(props: { document: ClientDocument; withLabel?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  async function preview(withSignature: boolean) {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Autorisez les fenêtres contextuelles pour prévisualiser le PDF");
      return;
    }
    previewWindow.opener = null;
    setLoading(true);
    try {
      const blob = await comptaApi.clientDocumentPdf(props.document.id, withSignature);
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      setOptionsOpen(false);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow.close();
      toast.error(error instanceof Error ? error.message : "Prévisualisation impossible");
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    if (props.document.typeDocument === "RELEVE") {
      setOptionsOpen(true);
      return;
    }
    void preview(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size={props.withLabel ? "default" : "icon"}
        onClick={handleClick}
        disabled={loading}
        title="Prévisualiser le PDF"
      >
        <FileDown className="size-4" />
        {props.withLabel ? (loading ? "Ouverture..." : "Prévisualiser le PDF") : null}
      </Button>
      {props.document.typeDocument === "RELEVE" ? (
        <RelevePdfOptionsDialog
          open={optionsOpen}
          loading={loading}
          signatureAvailable={props.document.signatureDisponible}
          onOpenChange={setOptionsOpen}
          onOpenPdf={(withSignature) => void preview(withSignature)}
        />
      ) : null}
    </>
  );
}

function DocumentTypeBadges(props: { documents: ClientDocumentSource["documents"] }) {
  const hasInvoice = props.documents.some((document) => document.type === "FACTURE");
  const hasStatement = props.documents.some((document) => document.type === "RELEVE");
  if (!hasInvoice && !hasStatement) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {hasInvoice ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">FC</Badge> : null}
      {hasStatement ? <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">RL</Badge> : null}
    </div>
  );
}

function DocumentReferences(props: {
  documents: ClientDocumentSource["documents"];
  onOpen: (id: string) => void;
}) {
  if (!props.documents.length) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="grid justify-items-start gap-1">
      {props.documents.map((document) => (
        <div key={document.id} className="grid gap-0.5">
          <button
            type="button"
            className="text-left text-xs font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
            onClick={() => props.onOpen(document.id)}
          >
            {document.numero}
          </button>
          <span className="text-xs text-muted-foreground">
            {formatDate(document.dateEmission)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <SharedFilterField
      container="div"
      label={label}
      labelClassName="text-sm font-medium normal-case"
    >
      {children}
    </SharedFilterField>
  );
}

function SearchActions(props: { onApply: () => void; onReset: () => void }) {
  return (
    <div className="flex items-end gap-2">
      <Button size="icon" title="Rechercher" onClick={props.onApply}><Search className="size-4" /></Button>
      <Button size="icon" variant="outline" title="Réinitialiser" onClick={props.onReset}><RotateCcw className="size-4" /></Button>
    </div>
  );
}

function Header(props: { children?: ReactNode; align?: "left" | "right" | "center" }) {
  const alignment = props.align === "right" ? "text-right" : props.align === "center" ? "text-center" : "text-left";
  return <th className={`whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase ${alignment}`}>{props.children}</th>;
}

function MoneyCell({ value, strong }: { value: number; strong?: boolean }) {
  return <td className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{formatAmount(value)}</td>;
}

function SummaryLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b px-4 py-3 last:border-b-0 ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs uppercase text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value}</div></div>;
}

function LoadingRows({ columns }: { columns: number }) {
  return <TableRowsSkeleton colSpan={columns} rows={5} />;
}

function PageFooter(props: {
  page?: { number: number; totalElements: number; totalPages: number; first: boolean; last: boolean };
  onPrevious: () => void;
  onNext: () => void;
}) {
  const page = props.page?.number ?? 0;
  return (
    <ServerPagination
      className="border-t px-4 py-3"
      page={page}
      totalPages={props.page?.totalPages ?? 1}
      totalElements={props.page?.totalElements ?? 0}
      onPageChange={(nextPage) => {
        if (nextPage < page) props.onPrevious();
        if (nextPage > page) props.onNext();
      }}
    />
  );
}

function formatMoney(value: number) {
  return `${formatAmount(value)} MAD`;
}

function formatAmount(value: number) {
  const amount = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0).replace(/[\u00a0\u202f]/g, " ");
  return amount;
}

function taxesAndFees(value: { taxes: number; accessoires: number }) {
  return value.taxes + value.accessoires;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
