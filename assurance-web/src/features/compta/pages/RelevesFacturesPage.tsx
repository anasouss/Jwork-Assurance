import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { clientApi } from "@/features/production/api/clients";
import { toDateOnly } from "@/features/production/date";
import type { ClientResponse, GroupeClient } from "@/features/production/types";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { RelevePdfOptionsDialog } from "../components/RelevePdfOptionsDialog";
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
} from "../types";

type SelectedPayer = {
  type: "CLIENT" | "GROUPE";
  id: string;
  name: string;
  identifier: string;
  groupName?: string;
  treasuryName?: string;
  memberCount?: number;
};

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
  const [payerMode, setPayerMode] = useState<SelectedPayer["type"]>(requestedPayerType);
  const [payerSearch, setPayerSearch] = useState("");
  const deferredPayerSearch = useDeferredValue(payerSearch.trim());
  const [selectedPayer, setSelectedPayer] = useState<SelectedPayer>();

  useEffect(() => {
    setSourceFilters(urlState.sourceFilters);
    setDocumentFilters(urlState.documentFilters);
    setPayerMode(urlState.payerType);
  }, [urlState]);

  const clients = useQuery({
    queryKey: ["compta", "document-payers", "clients", deferredPayerSearch],
    queryFn: () => clientApi.listClients({
      query: deferredPayerSearch || undefined,
      page: 0,
      size: 30,
    }),
    enabled: payerMode === "CLIENT",
    staleTime: 30_000,
  });
  const groups = useQuery({
    queryKey: ["groupes-clients"],
    queryFn: clientApi.listGroupesClients,
    enabled: payerMode === "GROUPE",
    staleTime: 60_000,
  });
  const requestedClient = useQuery({
    queryKey: ["crm-client", requestedPayerId],
    queryFn: () => clientApi.getClientCrm(requestedPayerId),
    enabled: Boolean(requestedPayerId) && requestedPayerType === "CLIENT",
    staleTime: 30_000,
  });

  const sourceParams = useMemo(() => ({
    payeurType: selectedPayer?.type,
    payeurId: selectedPayer?.id,
    typeContrat: urlState.sourceFilters.typeContrat === "ALL" ? undefined : urlState.sourceFilters.typeContrat,
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

  function changePayer(payer?: SelectedPayer, mode = payer?.type ?? payerMode) {
    setPayerMode(mode);
    setSelectedPayer(payer);
    setSelected({});
    updateUrl({
      payerType: mode,
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
      setPayerMode("CLIENT");
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
      const group = groups.data?.find((item) => item.id === requestedPayerId);
      if (!group) return;
      setPayerMode("GROUPE");
      setSelectedPayer({
        type: "GROUPE",
        id: group.id,
        name: group.libelle,
        identifier: group.code,
        treasuryName: group.clientTresorerieNom || undefined,
        memberCount: group.membres.length,
      });
    }
  }, [groups.data, requestedClient.data, requestedPayerId, requestedPayerType, selectedPayer?.id]);

  const selectedRows = useMemo(() => Object.values(selected), [selected]);
  const selectedPayerKey = selectedRows.length
    ? `${selectedRows[0].payeurType}:${selectedRows[0].payeurId}`
    : undefined;

  function toggleSource(row: ClientDocumentSource, checked: boolean) {
    const payerKey = `${row.payeurType}:${row.payeurId}`;
    if (checked && selectedPayerKey && selectedPayerKey !== payerKey) {
      toast.error("Sélectionnez uniquement des quittances du même payeur.");
      return;
    }
    setSelected((current) => {
      const next = { ...current };
      if (checked) next[row.quittanceId] = row;
      else delete next[row.quittanceId];
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
            Émission de documents client à partir des quittances validées, avec historique PDF immuable.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/compta">Retour au tableau de bord</Link>
        </Button>
      </div>

      <PayerAccountSelector
        mode={payerMode}
        selected={selectedPayer}
        clients={clients.data?.items ?? []}
        groups={groups.data ?? []}
        loading={clients.isFetching || groups.isFetching}
        onQueryChange={setPayerSearch}
        onModeChange={(mode) => {
          setPayerSearch("");
          changePayer(undefined, mode);
        }}
        onSelect={changePayer}
      />

      <Tabs
          value={urlState.tab}
          onValueChange={(value) => updateUrl({ tab: value === "documents" ? "documents" : "sources" })}
        >
        <TabsList>
          <TabsTrigger value="sources">
            <ReceiptText className="size-4" />
            Quittances à documenter
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="size-4" />
            Documents émis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="grid gap-4">
          <SourceSearch
            filters={sourceFilters}
            onChange={setSourceFilters}
            onApply={applySourceFilters}
            onReset={resetSourceFilters}
          />
          <Card className="min-w-0 shadow-none">
            <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">Quittances validées</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedRows.length
                    ? `${selectedRows.length} quittance(s) sélectionnée(s).`
                    : "Sélectionnez les quittances à regrouper dans le document."}
                </p>
              </div>
              {canIssue ? (
                <Button disabled={!selectedRows.length} onClick={() => setIssueOpen(true)}>
                  <FilePlus2 className="size-4" />
                  Émettre un document
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead className="border-y bg-amber-600 text-white">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left" aria-label="Sélection" />
                      <Header>Cible / souscripteur</Header>
                      <Header>Dossier / police</Header>
                      <Header>Mouvement</Header>
                      <Header>Compagnie</Header>
                      <Header>Date d'effet</Header>
                      <Header align="right">Prime nette</Header>
                      <Header align="right">Taxes</Header>
                      <Header align="right">TTC</Header>
                      <Header>Facture</Header>
                      <Header align="center">Détail</Header>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.isLoading ? <LoadingRows columns={11} /> : null}
                    {!sources.isLoading && !(sources.data?.rows.length) ? (
                      <tr><td colSpan={11} className="h-32 text-center text-muted-foreground">Aucune quittance trouvée.</td></tr>
                    ) : null}
                    {(sources.data?.rows ?? []).map((row) => (
                      <tr key={row.quittanceId} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={Boolean(selected[row.quittanceId])}
                            onCheckedChange={(checked) => toggleSource(row, checked === true)}
                            disabled={!row.affectee}
                            aria-label={`Sélectionner ${row.dossier}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{row.souscripteurNom || row.payeurNom}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.payeurType === "GROUPE" ? `Groupe : ${row.payeurNom}` : row.payeurNom}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{row.dossier || "-"}</div>
                          <div className="text-xs text-muted-foreground">{row.police || "-"}</div>
                        </td>
                        <td className="px-3 py-3">{row.mouvement}</td>
                        <td className="px-3 py-3">{row.compagnie}</td>
                        <td className="whitespace-nowrap px-3 py-3">{formatDate(row.dateEffet)}</td>
                        <MoneyCell value={row.primeNette} />
                        <MoneyCell value={row.taxes} />
                        <MoneyCell value={row.montantTtc} strong />
                        <td className="px-3 py-3">
                          {!row.affectee ? <Badge variant="secondary">Non affectée</Badge>
                            : row.dejaFacturee ? <Badge className="bg-emerald-100 text-emerald-800">Émise</Badge>
                            : row.facturable ? <Badge variant="outline">Disponible</Badge>
                              : <Badge variant="secondary">Crédit</Badge>}
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
        </TabsContent>

        <TabsContent value="documents" className="grid gap-4">
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
        </TabsContent>
      </Tabs>

      <IssueDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        rows={selectedRows}
        onIssued={() => {
          setSelected({});
          setIssueOpen(false);
          updateUrl({ tab: "documents", documentPage: 0 });
        }}
      />
      <DocumentDetailDialog id={detailId} onOpenChange={(open) => !open && setDetailId(undefined)} />
      <CancelDocumentDialog target={cancelTarget} onClose={() => setCancelTarget(undefined)} />
      <DeleteDocumentDialog target={deleteTarget} onClose={() => setDeleteTarget(undefined)} />
    </div>
  );
}

function PayerAccountSelector(props: {
  mode: SelectedPayer["type"];
  selected?: SelectedPayer;
  clients: ClientResponse[];
  groups: GroupeClient[];
  loading: boolean;
  onModeChange: (mode: SelectedPayer["type"]) => void;
  onQueryChange: (query: string) => void;
  onSelect: (payer?: SelectedPayer) => void;
}) {
  const clientOptions = useMemo(() => {
    const options = props.clients.map((client) => {
      const identifier = client.codeClient || client.rc || client.cin || client.ice || "";
      return {
        value: client.id,
        label: [client.nomAffichage || "Client", identifier].filter(Boolean).join(" · "),
        keywords: [client.codeClient, client.rc, client.cin, client.ice, client.email].filter(Boolean).join(" "),
      };
    });
    if (props.selected?.type === "CLIENT" && !options.some((option) => option.value === props.selected?.id)) {
      options.unshift({
        value: props.selected.id,
        label: [props.selected.name, props.selected.identifier].filter(Boolean).join(" · "),
        keywords: props.selected.identifier,
      });
    }
    return options;
  }, [props.clients, props.selected]);

  const groupOptions = useMemo(() => {
    const options = props.groups.map((group) => ({
      value: group.id,
      label: `${group.code} · ${group.libelle}`,
      keywords: [group.clientTeteNom, group.clientTresorerieNom, ...group.membres.map((member) => member.clientNom)]
        .filter(Boolean)
        .join(" "),
    }));
    if (props.selected?.type === "GROUPE" && !options.some((option) => option.value === props.selected?.id)) {
      options.unshift({
        value: props.selected.id,
        label: [props.selected.identifier, props.selected.name].filter(Boolean).join(" · "),
        keywords: props.selected.treasuryName ?? "",
      });
    }
    return options;
  }, [props.groups, props.selected]);

  function select(value: string) {
    if (!value) {
      props.onSelect();
      return;
    }
    if (props.mode === "CLIENT") {
      const client = props.clients.find((item) => item.id === value);
      if (!client) return;
      props.onSelect({
        type: "CLIENT",
        id: client.id,
        name: client.nomAffichage || "Client",
        identifier: client.codeClient || client.rc || client.cin || client.ice || "",
        groupName: client.groupe?.libelle || undefined,
      });
      return;
    }
    const group = props.groups.find((item) => item.id === value);
    if (!group) return;
    props.onSelect({
      type: "GROUPE",
      id: group.id,
      name: group.libelle,
      identifier: group.code,
      treasuryName: group.clientTresorerieNom || undefined,
      memberCount: group.membres.length,
    });
  }

  const Icon = props.mode === "GROUPE" ? Building2 : Users;
  return (
    <section className="overflow-visible rounded-md border bg-card">
      <div className="grid gap-4 p-4 lg:grid-cols-[220px_minmax(320px,620px)_1fr] lg:items-end">
        <FilterField label="Compte payeur">
          <div className="grid grid-cols-2 rounded-md border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900">
            {(["CLIENT", "GROUPE"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`h-8 rounded-sm px-3 text-sm font-medium ${
                  props.mode === mode
                    ? "bg-amber-100 text-amber-950 shadow-sm ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
                onClick={() => props.onModeChange(mode)}
              >
                {mode === "CLIENT" ? "Client" : "Groupe"}
              </button>
            ))}
          </div>
        </FilterField>
        <FilterField label={props.mode === "CLIENT" ? "Rechercher un client" : "Rechercher un groupe"}>
          <AutocompleteSelect
            options={props.mode === "CLIENT" ? clientOptions : groupOptions}
            value={props.selected?.type === props.mode ? props.selected.id : ""}
            onValueChange={select}
            onQueryChange={props.mode === "CLIENT" ? props.onQueryChange : undefined}
            placeholder={props.mode === "CLIENT" ? "Nom, RC, CIN, ICE ou code" : "Code, groupe ou membre"}
            emptyText={props.loading ? "Chargement..." : "Aucun résultat"}
          />
        </FilterField>
        {props.selected ? (
          <div className="flex min-w-0 items-center gap-3 rounded-md border-l-4 border-l-amber-500 bg-amber-50/60 px-4 py-2.5">
            <Icon className="size-5 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <div className="truncate font-semibold">{props.selected.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {[
                  props.selected.identifier,
                  props.selected.type === "GROUPE"
                    ? `${props.selected.memberCount ?? 0} membre(s)`
                    : props.selected.groupName || "Client indépendant",
                  props.selected.treasuryName ? `Trésorerie : ${props.selected.treasuryName}` : null,
                ].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        ) : (
          <p className="pb-2 text-sm text-muted-foreground">
            Toutes les cibles sont affichées. Sélectionnez un payeur pour limiter les résultats.
          </p>
        )}
      </div>
    </section>
  );
}

function SourceSearch(props: {
  filters: SourceFilters;
  onChange: (value: SourceFilters) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const { filters, onChange } = props;
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3"><CardTitle className="text-base">Recherche</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.5fr_auto]">
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
        <FilterField label="Date d'effet du">
          <DatePicker date={filters.dateDu} onSelect={(date) => onChange({ ...filters, dateDu: toDateOnly(date) ?? "" })} />
        </FilterField>
        <FilterField label="Date d'effet au">
          <DatePicker date={filters.dateAu} onSelect={(date) => onChange({ ...filters, dateAu: toDateOnly(date) ?? "" })} />
        </FilterField>
        <FilterField label="Dossier, police ou quittance">
          <Input value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} />
        </FilterField>
        <SearchActions onApply={props.onApply} onReset={props.onReset} />
      </CardContent>
    </Card>
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
        <FilterField label="Document">
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
      <CardHeader className="pb-3"><CardTitle className="text-base">Historique émis</CardTitle></CardHeader>
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
                  <td className="px-3 py-3">{document.typeDocument === "RELEVE" ? "Relevé" : "Facture"}</td>
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
                        <Button variant="ghost" size="icon" title="Annuler le document" onClick={() => props.onCancel?.(document)}>
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
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const invoiceEligible = props.rows.every((row) => row.facturable);
  const debit = props.rows.reduce((sum, row) => sum + Math.max(row.montantTtc, 0), 0);
  const credit = props.rows.reduce((sum, row) => sum + Math.abs(Math.min(row.montantTtc, 0)), 0);

  useEffect(() => {
    if (!props.open || !props.rows.length) return;
    const startDates = props.rows.map((row) => row.dateEffet).filter(Boolean).sort();
    const endDates = props.rows.map((row) => row.dateEcheance || row.dateEffet).filter(Boolean).sort();
    setPeriodStart(startDates[0] ?? "");
    setPeriodEnd(endDates[endDates.length - 1] ?? "");
    setDueDate("");
    setNotes("");
    setType(invoiceEligible ? "FACTURE" : "RELEVE");
  }, [props.open, props.rows, invoiceEligible]);

  const issue = useMutation({
    mutationFn: () => comptaApi.createClientDocument({
      typeDocument: type,
      quittanceIds: props.rows.map((row) => row.quittanceId),
      periodeDebut: periodStart,
      periodeFin: periodEnd,
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
  const invalid = !periodStart || !periodEnd || (type === "FACTURE" && !dueDate);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Émettre un document client</DialogTitle>
          <DialogDescription>
            {props.rows.length} quittance(s) pour {props.rows[0]?.payeurNom ?? "-"}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <FilterField label="Type de document">
              <Select value={type} onValueChange={(value) => setType(value as ClientDocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RELEVE">Relevé</SelectItem>
                  <SelectItem value="FACTURE" disabled={!invoiceEligible}>Facture</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Période du">
              <DatePicker date={periodStart} onSelect={(date) => setPeriodStart(toDateOnly(date) ?? "")} />
            </FilterField>
            <FilterField label="Période au">
              <DatePicker date={periodEnd} onSelect={(date) => setPeriodEnd(toDateOnly(date) ?? "")} />
            </FilterField>
            <FilterField label={type === "FACTURE" ? "Échéance de paiement *" : "Échéance de paiement"}>
              <DatePicker
                date={dueDate}
                onSelect={(date) => setDueDate(toDateOnly(date) ?? "")}
                disabled={type !== "FACTURE"}
                minDate={new Date()}
              />
            </FilterField>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted">
                <tr>
                  <Header>Dossier</Header>
                  <Header>Mouvement</Header>
                  <Header>Date</Header>
                  <Header align="right">Prime nette</Header>
                  <Header align="right">Taxes</Header>
                  <Header align="right">TTC</Header>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((row) => (
                  <tr key={row.quittanceId} className="border-t">
                    <td className="px-3 py-2">{row.dossier}</td>
                    <td className="px-3 py-2">{row.mouvement}</td>
                    <td className="px-3 py-2">{formatDate(row.dateEffet)}</td>
                    <MoneyCell value={row.primeNette} />
                    <MoneyCell value={row.taxes} />
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
            {issue.isPending ? "Émission..." : "Émettre"}
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
                    <Header>Dossier / police</Header>
                    <Header>Mouvement</Header>
                    <Header align="right">Prime nette</Header>
                    <Header align="right">Taxes</Header>
                    <Header align="right">Débit</Header>
                    <Header align="right">Crédit</Header>
                  </tr>
                </thead>
                <tbody>
                  {document.lignes.map((line) => (
                    <tr key={line.id} className="border-t">
                      <td className="px-3 py-2">{formatDate(line.dateOperation)}</td>
                      <td className="px-3 py-2">{line.numeroDossier}<div className="text-xs text-muted-foreground">{line.numeroPolice}</div></td>
                      <td className="px-3 py-2">{line.mouvement}</td>
                      <MoneyCell value={line.primeNette} />
                      <MoneyCell value={line.taxes} />
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

function CancelDocumentDialog(props: { target?: ClientDocument; onClose: () => void }) {
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
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Annulation impossible"),
  });
  return (
    <AlertDialog open={Boolean(props.target)} onOpenChange={(open) => !open && props.onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Annuler {props.target?.numero} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le document restera dans l'historique avec le statut annulé. Les quittances d'une facture annulée pourront être refacturées.
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
            Annuler le document
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
            Cette suppression est définitive. Les quittances liées redeviendront disponibles pour un nouveau document.
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
  return <td className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{formatMoney(value)}</td>;
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
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
