import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Building2,
  CircleAlert,
  Download,
  Eye,
  FileCheck2,
  FileClock,
  FileDown,
  FilePlus2,
  FileText,
  MoreHorizontal,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
  Users,
  WalletCards,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { SortIcon } from "@/components/ui/sort-icon";
import { Textarea } from "@/components/ui/textarea";
import { clientApi } from "@/features/production/api/clients";
import { toDateOnly } from "@/features/production/date";
import { downloadBlob } from "@/lib/download";
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
  const [invoiceFromStatementId, setInvoiceFromStatementId] = useState<string>();
  const [cancelTarget, setCancelTarget] = useState<ClientDocument>();
  const [deleteTarget, setDeleteTarget] = useState<ClientDocument>();
  const [exporting, setExporting] = useState(false);
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
    souscripteurId: urlState.souscripteurId || undefined,
    contratId: urlState.contratId || undefined,
    brancheId: urlState.sourceFilters.brancheId === "ALL" ? undefined : urlState.sourceFilters.brancheId,
    compagnieId: urlState.sourceFilters.compagnieId === "ALL" ? undefined : urlState.sourceFilters.compagnieId,
    typeContrat: urlState.sourceFilters.typeContrat === "ALL" ? undefined : urlState.sourceFilters.typeContrat,
    documentState: urlState.sourceFilters.documentState === "ALL"
      ? undefined
      : urlState.sourceFilters.documentState,
    dateDu: urlState.sourceFilters.dateDu || undefined,
    dateAu: urlState.sourceFilters.dateAu || undefined,
    search: urlState.sourceFilters.search.trim() || undefined,
    sortBy: urlState.sourceSortBy,
    sortDirection: urlState.sourceSortDirection,
    page: urlState.sourcePage,
    size: PAGE_SIZE,
  }), [selectedPayer, urlState.souscripteurId, urlState.contratId, urlState.sourceFilters, urlState.sourcePage, urlState.sourceSortBy, urlState.sourceSortDirection]);
  const documentParams = useMemo(() => ({
    payeurType: selectedPayer?.type,
    payeurId: selectedPayer?.id,
    souscripteurId: urlState.souscripteurId || undefined,
    contratId: urlState.contratId || undefined,
    brancheId: urlState.sourceFilters.brancheId === "ALL" ? undefined : urlState.sourceFilters.brancheId,
    type: urlState.documentFilters.type === "ALL" ? undefined : urlState.documentFilters.type,
    statut: urlState.documentFilters.statut === "ALL" ? undefined : urlState.documentFilters.statut,
    dateDu: urlState.documentFilters.dateDu || undefined,
    dateAu: urlState.documentFilters.dateAu || undefined,
    search: urlState.documentFilters.search.trim() || undefined,
    sortBy: urlState.documentSortBy,
    sortDirection: urlState.documentSortDirection,
    page: urlState.documentPage,
    size: PAGE_SIZE,
  }), [selectedPayer, urlState.souscripteurId, urlState.contratId, urlState.sourceFilters.brancheId, urlState.documentFilters, urlState.documentPage, urlState.documentSortBy, urlState.documentSortDirection]);

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

  function sortSources(column: ReleveSearchState["sourceSortBy"]) {
    updateUrl({ sourceSortBy: column,
      sourceSortDirection: urlState.sourceSortBy === column && urlState.sourceSortDirection === "desc" ? "asc" : "desc",
      sourcePage: 0 });
  }

  function sortDocuments(column: ReleveSearchState["documentSortBy"]) {
    updateUrl({ documentSortBy: column,
      documentSortDirection: urlState.documentSortBy === column && urlState.documentSortDirection === "desc" ? "asc" : "desc",
      documentPage: 0 });
  }

  function changePayer(payer?: PayerSelection, scope: PayerScope = payer?.type ?? payerScope) {
    setSelectedPayer(payer);
    setSelected({});
    updateUrl({
      payerScope: scope,
      payerType: scope === "GROUPE" ? "GROUPE" : "CLIENT",
      payerId: payer?.id ?? "",
      souscripteurId: "",
      contratId: "",
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

  async function exportSources() {
    if (!sources.data?.page.totalElements || exporting) return;
    setExporting(true);
    try {
      const blob = await comptaApi.exportClientDocumentSources({
        payeurType: sourceParams.payeurType,
        payeurId: sourceParams.payeurId,
        souscripteurId: sourceParams.souscripteurId,
        contratId: sourceParams.contratId,
        brancheId: sourceParams.brancheId,
        compagnieId: sourceParams.compagnieId,
        typeContrat: sourceParams.typeContrat,
        documentState: sourceParams.documentState,
        dateDu: sourceParams.dateDu,
        dateAu: sourceParams.dateAu,
        search: sourceParams.search,
        sortBy: sourceParams.sortBy,
        sortDirection: sourceParams.sortDirection,
      });
      downloadBlob(blob, `releves-factures-${toDateOnly(new Date())}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export Excel impossible");
    } finally {
      setExporting(false);
    }
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

      {urlState.souscripteurId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <span>Écritures du portefeuille client{urlState.contratId ? " · contrat sélectionné" : ""}</span>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost"><Link to={`/app/production/portefeuille-clients/${urlState.souscripteurId}`}>Retour au portefeuille</Link></Button>
            <Button size="sm" variant="ghost" onClick={() => updateUrl({ souscripteurId: "", contratId: "", sourcePage: 0, documentPage: 0 })}>Tout afficher</Button>
          </div>
        </div>
      ) : null}

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
            <CardHeader className="gap-3 pb-3">
              <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center">
                <div className="grid min-w-0 flex-1 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-4">
                  <SourceSummaryMetric
                    label="Solde impayé"
                    value={sources.data?.summary.soldeImpaye}
                    icon={<WalletCards className="size-4" />}
                    tone="amber"
                  />
                  <SourceSummaryMetric
                    label="Montant facturé"
                    value={sources.data?.summary.montantFacture}
                    icon={<FileCheck2 className="size-4" />}
                    tone="blue"
                  />
                  <SourceSummaryMetric
                    label="Impayé facturé"
                    value={sources.data?.summary.impayeFacture}
                    icon={<CircleAlert className="size-4" />}
                    tone="red"
                  />
                  <SourceSummaryMetric
                    label="Impayé non facturé"
                    value={sources.data?.summary.impayeNonFacture}
                    icon={<FileClock className="size-4" />}
                    tone="orange"
                  />
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={!sources.data?.page.totalElements || sources.isLoading || exporting}
                    onClick={() => void exportSources()}
                  >
                    <Download className="size-4" />
                    {exporting ? "Export..." : "Exporter Excel"}
                  </Button>
                  {canIssue ? (
                    <Button disabled={!selectedRows.length} onClick={() => setIssueOpen(true)}>
                      <FilePlus2 className="size-4" />
                      Créer un document{selectedRows.length ? ` (${selectedRows.length})` : ""}
                    </Button>
                  ) : null}
                </div>
              </div>
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
                      <SortHeader column="dateDebut" activeColumn={urlState.sourceSortBy} direction={urlState.sourceSortDirection} onSort={sortSources}>Date d'effet</SortHeader>
                      <Header align="right">Prime nette</Header>
                      <Header align="right">Taxes et frais</Header>
                      <SortHeader column="primeTotale" activeColumn={urlState.sourceSortBy} direction={urlState.sourceSortDirection} onSort={sortSources} align="right">TTC</SortHeader>
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
                            <Link
                              to={`/app/production/contrats/${row.contratId}${row.mouvementId ? `?mouvementId=${row.mouvementId}` : ""}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
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
            sortBy={urlState.documentSortBy}
            sortDirection={urlState.documentSortDirection}
            onSort={sortDocuments}
            loading={documents.isLoading}
            rows={documents.data?.rows ?? []}
            page={documents.data?.page}
            onPrevious={() => updateUrl({ documentPage: Math.max(0, urlState.documentPage - 1) })}
            onNext={() => updateUrl({ documentPage: urlState.documentPage + 1 })}
            onDetail={setDetailId}
            onInvoice={canIssue ? setInvoiceFromStatementId : undefined}
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
      <DocumentDetailDialog
        id={detailId}
        onOpenChange={(open) => !open && setDetailId(undefined)}
        onInvoice={canIssue ? (documentId) => {
          setDetailId(undefined);
          setInvoiceFromStatementId(documentId);
        } : undefined}
      />
      <StatementInvoiceDialog
        statementId={invoiceFromStatementId}
        onOpenChange={(open) => !open && setInvoiceFromStatementId(undefined)}
        onIssued={(invoice) => {
          setInvoiceFromStatementId(undefined);
          setDetailId(invoice.id);
        }}
      />
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
  sortBy: ReleveSearchState["documentSortBy"];
  sortDirection: "asc" | "desc";
  onSort: (column: ReleveSearchState["documentSortBy"]) => void;
  loading: boolean;
  rows: ClientDocument[];
  page?: { number: number; totalElements: number; totalPages: number; first: boolean; last: boolean };
  onPrevious: () => void;
  onNext: () => void;
  onDetail: (id: string) => void;
  onInvoice?: (id: string) => void;
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
                <SortHeader column="numero" activeColumn={props.sortBy} direction={props.sortDirection} onSort={props.onSort}>N° document</SortHeader>
                <Header>Type</Header>
                <SortHeader column="dateEmission" activeColumn={props.sortBy} direction={props.sortDirection} onSort={props.onSort}>Émission</SortHeader>
                <Header>Période</Header>
                <SortHeader column="totalDocument" activeColumn={props.sortBy} direction={props.sortDirection} onSort={props.onSort} align="right">Montant</SortHeader>
                <SortHeader column="statut" activeColumn={props.sortBy} direction={props.sortDirection} onSort={props.onSort}>Statut</SortHeader>
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
                    <div className="flex justify-center">
                      <DocumentActionsMenu
                        document={document}
                        onDetail={() => props.onDetail(document.id)}
                        onInvoice={props.onInvoice
                          && document.typeDocument === "RELEVE"
                          && document.statut === "EMIS"
                          ? () => props.onInvoice?.(document.id)
                          : undefined}
                        onCancel={props.onCancel && document.statut === "EMIS"
                          ? () => props.onCancel?.(document)
                          : undefined}
                        onDelete={props.onDelete ? () => props.onDelete?.(document) : undefined}
                      />
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

function DocumentActionsMenu(props: {
  document: ClientDocument;
  onDetail: () => void;
  onInvoice?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const pdf = useDocumentPdfPreview(props.document);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Actions" aria-label={`Actions pour ${props.document.numero}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onSelect={props.onDetail}>
            <Eye className="size-4" />
            Voir le détail
          </DropdownMenuItem>
          <DropdownMenuItem disabled={pdf.loading} onSelect={pdf.open}>
            <FileDown className="size-4 text-sky-700 dark:text-sky-400" />
            {pdf.loading ? "Ouverture..." : "Prévisualiser le PDF"}
          </DropdownMenuItem>
          {props.onInvoice ? (
            <DropdownMenuItem
              className="bg-emerald-50 font-medium text-emerald-900 focus:bg-emerald-100 focus:text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-200 dark:focus:bg-emerald-950/60 dark:focus:text-emerald-100"
              onSelect={props.onInvoice}
            >
              <ReceiptText className="size-4 text-emerald-700 dark:text-emerald-400" />
              Créer une facture
            </DropdownMenuItem>
          ) : null}
          {props.onCancel || props.onDelete ? <DropdownMenuSeparator /> : null}
          {props.onCancel ? (
            <DropdownMenuItem onSelect={props.onCancel}>
              <Ban className="size-4 text-amber-700 dark:text-amber-400" />
              Rectifier le document
            </DropdownMenuItem>
          ) : null}
          {props.onDelete ? (
            <DropdownMenuItem variant="destructive" onSelect={props.onDelete}>
              <Trash2 className="size-4" />
              Supprimer le document
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {props.document.typeDocument === "RELEVE" ? (
        <RelevePdfOptionsDialog
          open={pdf.optionsOpen}
          loading={pdf.loading}
          signatureAvailable={props.document.signatureDisponible}
          onOpenChange={pdf.setOptionsOpen}
          onOpenPdf={(withSignature) => void pdf.preview(withSignature)}
        />
      ) : null}
    </>
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
  const hasPaymentCondition = dueDateProposal.data?.delaiJours != null;

  useEffect(() => {
    if (!props.open || !props.rows.length) return;
    setType("RELEVE");
    setDueDate("");
    setNotes("");
  }, [props.open, sourceKey, invoiceEligible]);

  const issue = useMutation({
    mutationFn: () => comptaApi.createClientDocument({
      typeDocument: type,
      elementFacturableIds: sourceIds,
      dateEcheance: type === "FACTURE" && dueDate ? dueDate : undefined,
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
    && (!invoiceEligible
      || dueDateProposal.isLoading
      || dueDateProposal.isError
      || (hasPaymentCondition && !dueDate));

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
          <div className="grid max-w-md grid-cols-2 rounded-md border bg-slate-100/80 p-1 dark:bg-slate-900/60">
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
                    : "bg-background/60 text-slate-600 hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
              {dueDateProposal.isLoading ? (
                <p className="mt-1 text-xs text-muted-foreground">Calcul de l’échéance applicable...</p>
              ) : dueDateProposal.isError ? (
                <p className="mt-1 text-xs text-destructive">
                  Impossible de déterminer le délai applicable. Réessayez avant d’émettre la facture.
                </p>
              ) : dueDateProposal.data ? (
                <>
                  <FilterField label={`Échéance de paiement${hasPaymentCondition ? " *" : ""}`}>
                    <DatePicker
                      date={dueDate}
                      onSelect={(date) => setDueDate(toDateOnly(date) ?? "")}
                      minDate={today}
                      maxDate={hasPaymentCondition ? maximumDueDate : undefined}
                    />
                  </FilterField>
                  {hasPaymentCondition ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dueDateProposal.data.origine === "CONDITION_GROUPE"
                        ? "Condition du groupe"
                        : "Condition du client"}
                      {` : ${dueDateProposal.data.delaiJours} jours maximum.`}
                      {!dueDateProposal.data.justificatifPresent ? " Justificatif non joint." : ""}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-100/90 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
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
              <SummaryLine label="Total débit" value={debit} tone="debit" />
              {type === "RELEVE" ? <SummaryLine label="Total crédit" value={credit} tone="credit" /> : null}
              <SummaryLine
                label={type === "RELEVE" ? "Solde" : "Total à payer"}
                value={debit - credit}
                tone="balance"
                strong
              />
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

function DocumentDetailDialog(props: {
  id?: string;
  onOpenChange: (open: boolean) => void;
  onInvoice?: (documentId: string) => void;
}) {
  const detail = useQuery({
    queryKey: ["compta", "client-document", props.id],
    queryFn: () => comptaApi.clientDocument(props.id as string),
    enabled: Boolean(props.id),
  });
  const document = detail.data;
  return (
    <Dialog open={Boolean(props.id)} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                {document?.typeDocument === "RELEVE"
                  ? <FileText className="size-5" />
                  : <ReceiptText className="size-5" />}
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle>{document?.numero ?? "Chargement du document"}</DialogTitle>
                <DialogDescription className="mt-1">
                  {document
                    ? `${document.typeDocument === "RELEVE" ? "Relevé" : "Facture"} · ${document.payeurNom}`
                    : ""}
                </DialogDescription>
              </div>
            </div>
            {document ? (
              document.statut === "EMIS" ? (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300">
                  Émis
                </Badge>
              ) : (
                <Badge variant="destructive">Annulé</Badge>
              )
            ) : null}
          </div>
        </DialogHeader>
        {detail.isLoading ? <div className="grid gap-3"><Skeleton className="h-20" /><Skeleton className="h-56" /></div> : null}
        {document ? (
          <div className="grid gap-4">
            <div className="grid overflow-hidden rounded-md border bg-muted/10 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
              <DocumentInfo label="Payeur" value={document.payeurNom} />
              <DocumentInfo label="Identifiant" value={document.payeurIdentifiant || "-"} />
              <DocumentInfo label="Période" value={`${formatDate(document.periodeDebut)} au ${formatDate(document.periodeFin)}`} />
              <DocumentInfo label="Montant" value={formatMoney(document.totalDocument)} tone="amount" />
            </div>
            {document.statut === "ANNULE" ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <div className="font-medium text-destructive">Document annulé</div>
                <div className="mt-1 text-sm">{document.motifAnnulation || "-"}</div>
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b bg-slate-100/80 text-xs uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
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
                    <tr key={line.id} className="border-t hover:bg-muted/25">
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
                      <td className="px-3 py-2">
                        <div className="font-medium">{line.mouvement}</div>
                        <div className={`mt-0.5 text-xs font-medium ${
                          line.nature === "ASSISTANCE"
                            ? "text-sky-700 dark:text-sky-300"
                            : "text-emerald-700 dark:text-emerald-300"
                        }`}>
                          {line.nature === "ASSISTANCE" ? "Assistance" : "Assurance"}
                        </div>
                      </td>
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
          {document
            && props.onInvoice
            && document.typeDocument === "RELEVE"
            && document.statut === "EMIS" ? (
            <Button onClick={() => props.onInvoice?.(document.id)}>
              <ReceiptText className="size-4" />
              Créer une facture
            </Button>
          ) : null}
          {document ? <PdfButton document={document} withLabel /> : null}
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatementInvoiceDialog(props: {
  statementId?: string;
  onOpenChange: (open: boolean) => void;
  onIssued: (invoice: ClientDocument) => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const detail = useQuery({
    queryKey: ["compta", "client-document", props.statementId],
    queryFn: () => comptaApi.clientDocument(props.statementId as string),
    enabled: Boolean(props.statementId),
  });
  const statement = detail.data;
  const eligibleLines = useMemo(
    () => (statement?.lignes ?? []).filter(
      (line) => Boolean(line.elementFacturableId) && line.facturable
    ),
    [statement?.lignes]
  );
  useEffect(() => {
    if (!props.statementId) return;
    setSelected(Object.fromEntries(
      eligibleLines.map((line) => [line.elementFacturableId as string, true])
    ));
    setDueDate("");
    setNotes("");
  }, [props.statementId, eligibleLines]);

  const selectedLines = eligibleLines.filter(
    (line) => line.elementFacturableId && selected[line.elementFacturableId]
  );
  const selectedIds = selectedLines.map((line) => line.elementFacturableId as string);
  const selectedKey = selectedIds.join(",");
  const allEligibleSelected = eligibleLines.length > 0
    && selectedLines.length === eligibleLines.length;
  const dueDateProposal = useQuery({
    queryKey: ["compta", "client-document-due-date", selectedIds],
    queryFn: () => comptaApi.proposeClientDocumentDueDate(selectedIds),
    enabled: Boolean(props.statementId) && selectedIds.length > 0,
  });
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const maximumDueDate = dueDateProposal.data?.dateEcheanceProposee
    ? parseLocalDate(dueDateProposal.data.dateEcheanceProposee)
    : undefined;
  const hasPaymentCondition = dueDateProposal.data?.delaiJours != null;
  const selectedTotal = selectedLines.reduce((sum, line) => sum + line.montantTtc, 0);

  useEffect(() => {
    setDueDate("");
  }, [selectedKey]);

  const issue = useMutation({
    mutationFn: () => comptaApi.createInvoiceFromStatement(props.statementId as string, {
      elementFacturableIds: selectedIds,
      dateEcheance: dueDate || undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: async (invoice) => {
      toast.success(`Facture ${invoice.numero} émise.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "client-document-sources"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-document"] }),
      ]);
      props.onIssued(invoice);
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Émission de la facture impossible"
    ),
  });
  const invalid = !selectedIds.length
    || dueDateProposal.isLoading
    || dueDateProposal.isError
    || (hasPaymentCondition && !dueDate);
  const validStatement = statement?.typeDocument === "RELEVE" && statement.statut === "EMIS";

  function toggleAll(checked: boolean) {
    setSelected(Object.fromEntries(
      eligibleLines.map((line) => [line.elementFacturableId as string, checked])
    ));
  }

  return (
    <Dialog open={Boolean(props.statementId)} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {statement ? `Facturer le relevé ${statement.numero}` : "Préparation de la facture"}
          </DialogTitle>
          <DialogDescription>
            Sélectionnez uniquement les écritures à reprendre dans la facture.
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="grid gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-56" />
          </div>
        ) : null}

        {detail.isError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Impossible de charger le relevé.
          </div>
        ) : null}

        {statement && !validStatement ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Seul un relevé émis peut servir à préparer une facture.
          </div>
        ) : null}

        {statement && validStatement ? (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3">
              <Info label="Payeur" value={statement.payeurNom} />
              <Info label="Période" value={`${formatDate(statement.periodeDebut)} au ${formatDate(statement.periodeFin)}`} />
              <Info label="Sélection" value={`${selectedLines.length} sur ${statement.lignes.length} écriture(s)`} />
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[940px] text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="w-12 px-3 py-3 text-left">
                      <Checkbox
                        checked={allEligibleSelected
                          ? true
                          : selectedLines.length > 0
                            ? "indeterminate"
                            : false}
                        disabled={!eligibleLines.length}
                        onCheckedChange={(checked) => toggleAll(checked === true)}
                        aria-label="Sélectionner toutes les écritures facturables"
                      />
                    </th>
                    <Header>Police / référence</Header>
                    <Header>Mouvement</Header>
                    <Header>Date</Header>
                    <Header>État</Header>
                    <Header align="right">Prime nette</Header>
                    <Header align="right">Taxes et frais</Header>
                    <Header align="right">TTC</Header>
                  </tr>
                </thead>
                <tbody>
                  {statement.lignes.map((line) => {
                    const lineId = line.elementFacturableId;
                    const disabled = !lineId || !line.facturable;
                    return (
                      <tr key={line.id} className={`border-t ${disabled ? "bg-muted/25 text-muted-foreground" : "hover:bg-muted/20"}`}>
                        <td className="px-3 py-3">
                          <Checkbox
                            checked={Boolean(lineId && selected[lineId])}
                            disabled={disabled}
                            onCheckedChange={(checked) => {
                              if (!lineId) return;
                              setSelected((current) => ({ ...current, [lineId]: checked === true }));
                            }}
                            aria-label={`Sélectionner ${line.numeroPolice || line.numeroQuittance || line.mouvement}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{line.numeroPolice || line.numeroQuittance || "-"}</div>
                          {line.nature === "ASSISTANCE" ? (
                            <div className="text-xs text-muted-foreground">Contrat d'assistance</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">{line.mouvement}</td>
                        <td className="whitespace-nowrap px-3 py-3">{formatDate(line.dateOperation)}</td>
                        <td className="px-3 py-3">
                          {line.dejaFacturee ? (
                            <Badge variant="outline">Déjà facturée</Badge>
                          ) : line.reglementDirectActif ? (
                            <Badge variant="outline">Règlement existant</Badge>
                          ) : line.facturable ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Disponible</Badge>
                          ) : (
                            <Badge variant="outline">Non facturable</Badge>
                          )}
                        </td>
                        <MoneyCell value={line.primeNette} />
                        <MoneyCell value={taxesAndFees(line)} />
                        <MoneyCell value={line.montantTtc} strong />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!eligibleLines.length ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Ce relevé ne contient plus aucune écriture facturable.
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid content-start gap-4">
                <FilterField label="Notes">
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={1000}
                  />
                </FilterField>
                {selectedIds.length ? (
                  <div className="max-w-sm">
                    {dueDateProposal.isLoading ? (
                      <p className="text-xs text-muted-foreground">Calcul de l’échéance applicable...</p>
                    ) : dueDateProposal.isError ? (
                      <p className="text-xs text-destructive">
                        Impossible de déterminer le délai applicable.
                      </p>
                    ) : (
                      <>
                        <FilterField label={`Échéance de paiement${hasPaymentCondition ? " *" : ""}`}>
                          <DatePicker
                            date={dueDate}
                            onSelect={(date) => setDueDate(toDateOnly(date) ?? "")}
                            minDate={today}
                            maxDate={hasPaymentCondition ? maximumDueDate : undefined}
                          />
                        </FilterField>
                        {hasPaymentCondition ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {`Délai applicable : ${dueDateProposal.data?.delaiJours} jours maximum.`}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="self-end rounded-md border">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <span>Écritures sélectionnées</span>
                  <span className="font-semibold tabular-nums">{selectedLines.length}</span>
                </div>
                <SummaryLine label="Total à facturer" value={selectedTotal} strong />
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Annuler</Button>
          {validStatement ? (
            <Button disabled={invalid || issue.isPending} onClick={() => issue.mutate()}>
              <ReceiptText className="size-4" />
              {issue.isPending ? "Émission..." : "Émettre la facture"}
            </Button>
          ) : null}
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

function useDocumentPdfPreview(document: ClientDocument) {
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
      const blob = await comptaApi.clientDocumentPdf(document.id, withSignature);
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

  function open() {
    if (document.typeDocument === "RELEVE") {
      setOptionsOpen(true);
      return;
    }
    void preview(false);
  }

  return { loading, open, optionsOpen, preview, setOptionsOpen };
}

function PdfButton(props: { document: ClientDocument; withLabel?: boolean }) {
  const pdf = useDocumentPdfPreview(props.document);

  return (
    <>
      <Button
        variant="ghost"
        size={props.withLabel ? "default" : "icon"}
        onClick={pdf.open}
        disabled={pdf.loading}
        title="Prévisualiser le PDF"
      >
        <FileDown className="size-4" />
        {props.withLabel ? (pdf.loading ? "Ouverture..." : "Prévisualiser le PDF") : null}
      </Button>
      {props.document.typeDocument === "RELEVE" ? (
        <RelevePdfOptionsDialog
          open={pdf.optionsOpen}
          loading={pdf.loading}
          signatureAvailable={props.document.signatureDisponible}
          onOpenChange={pdf.setOptionsOpen}
          onOpenPdf={(withSignature) => void pdf.preview(withSignature)}
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

function SortHeader<T extends string>(props: {
  children: ReactNode;
  column: T;
  activeColumn: T;
  direction: "asc" | "desc";
  onSort: (column: T) => void;
  align?: "left" | "right";
}) {
  const active = props.column === props.activeColumn;
  return (
    <th
      aria-sort={active ? props.direction === "asc" ? "ascending" : "descending" : "none"}
      className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase"
    >
      <button
        type="button"
        className={`inline-flex w-full items-center gap-1 hover:text-white/80 ${props.align === "right" ? "justify-end" : "justify-start"}`}
        onClick={() => props.onSort(props.column)}
      >
        {props.children}<SortIcon isActive={active} direction={props.direction} />
      </button>
    </th>
  );
}

function MoneyCell({ value, strong }: { value: number; strong?: boolean }) {
  return <td className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{formatAmount(value)}</td>;
}

function SourceSummaryMetric(props: {
  label: string;
  value?: number;
  icon: ReactNode;
  tone: "amber" | "blue" | "red" | "orange";
}) {
  const tones = {
    amber: {
      icon: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
      value: "text-amber-800 dark:text-amber-300",
    },
    blue: {
      icon: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
      value: "text-sky-800 dark:text-sky-300",
    },
    red: {
      icon: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
      value: "text-red-800 dark:text-red-300",
    },
    orange: {
      icon: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
      value: "text-orange-800 dark:text-orange-300",
    },
  };
  const tone = tones[props.tone];
  return (
    <div className="flex min-w-0 items-center gap-3 bg-background p-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-md ${tone.icon}`}>
        {props.icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{props.label}</div>
        {props.value == null ? (
          <Skeleton className="mt-1 h-6 w-24" />
        ) : (
          <div className={`mt-0.5 whitespace-nowrap text-lg font-semibold tabular-nums ${tone.value}`}>
            {formatAmount(props.value)}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong,
  tone = "default",
}: {
  label: string;
  value: number;
  strong?: boolean;
  tone?: "default" | "debit" | "credit" | "balance";
}) {
  const toneClasses = {
    default: "",
    debit: "bg-sky-50/80 text-sky-950 dark:bg-sky-950/25 dark:text-sky-100",
    credit: "bg-emerald-50/80 text-emerald-950 dark:bg-emerald-950/25 dark:text-emerald-100",
    balance: "bg-amber-50/80 text-amber-950 dark:bg-amber-950/25 dark:text-amber-100",
  }[tone];
  return (
    <div className={`flex items-center justify-between border-b px-4 py-3 last:border-b-0 ${toneClasses} ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs uppercase text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value}</div></div>;
}

function DocumentInfo(props: {
  label: string;
  value: string;
  tone?: "default" | "amount";
}) {
  return (
    <div className={props.tone === "amount"
      ? "border-b bg-amber-50/70 px-4 py-3 last:border-b-0 sm:border-b lg:border-b-0 dark:bg-amber-950/20"
      : "border-b px-4 py-3 last:border-b-0 sm:border-b lg:border-b-0"}
    >
      <div className="text-xs uppercase text-muted-foreground">{props.label}</div>
      <div className={props.tone === "amount"
        ? "mt-1 font-semibold tabular-nums text-amber-800 dark:text-amber-300"
        : "mt-1 font-medium"}
      >
        {props.value}
      </div>
    </div>
  );
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
