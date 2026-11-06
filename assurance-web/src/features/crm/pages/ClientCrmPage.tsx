import { useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FolderOpen,
  Megaphone,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { useAuthStore } from "@/store/auth-store";
import { clientApi } from "@/features/production/api/clients";
import { TelephoneList } from "@/features/production/components/ClientSection";
import { AcquisitionFields } from "@/features/crm/components/AcquisitionFields";
import { ClientSummaryDialog } from "@/features/crm/components/ClientSummaryDialog";
import { ClientProfileDetails } from "@/features/crm/components/ClientProfileDetails";
import { clientRecordDraft } from "../client-record";
import { CreateClientGroupDialog } from "@/features/crm/components/CreateClientGroupDialog";
import { ClientGroupSelect } from "@/features/crm/components/ClientGroupSelect";
import { ClientDocuments, ClientDocumentDrafts, type ClientDocumentDraft } from "@/features/crm/components/ClientDocuments";
import { attachmentApi, attachmentKeys } from "@/features/production/api/attachments";
import { referenceApi } from "@/features/production/api/references";
import { toDateOnly } from "@/features/production/date";
import { downloadBlob } from "@/lib/download";
import type {
  ClientInput,
  AcquisitionClient,
  AcquisitionOptions,
  ClientPage,
  ClientPaymentCondition,
  ClientResponse,
  GroupeClient,
  RelationGroupeClient,
  TypeClient,
} from "@/features/production/types";

export default function ClientCrmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreateClient = permissions.includes("client:create");
  const canManageClients = permissions.includes("client:manage") || canCreateClient;
  const canEditClient = permissions.includes("client:manage");
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [groupeId, setGroupeId] = useState("TOUS");
  const [origineId, setOrigineId] = useState("TOUTES");
  const [collaborateurId, setCollaborateurId] = useState("TOUS");
  const [page, setPage] = useState(0);
  const selectedClientId = searchParams.get("clientId") ?? "";
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [previewClientId, setPreviewClientId] = useState<string>();
  const [clientToEdit, setClientToEdit] = useState<ClientResponse>();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const hasClientSearch = query.trim().length > 0;
  const clientSearchReady = hasClientSearch && query.trim() === deferredQuery;

  const groupesQuery = useQuery({
    queryKey: ["groupes-clients"],
    queryFn: clientApi.listGroupesClients,
    staleTime: 60_000,
  });
  const acquisitionOptionsQuery = useQuery({
    queryKey: ["crm", "acquisition-options"],
    queryFn: clientApi.acquisitionOptions,
    staleTime: 60_000,
  });
  const clientsQuery = useQuery({
    queryKey: ["crm-clients", deferredQuery, groupeId, origineId, collaborateurId, page],
    queryFn: () => clientApi.listClients({
      query: deferredQuery || undefined,
      groupeId: groupeId === "TOUS" ? undefined : groupeId,
      origineCommercialeId: origineId === "TOUTES" ? undefined : origineId,
      collaborateurId: collaborateurId === "TOUS" ? undefined : collaborateurId,
      page,
      size: 25,
    }),
    enabled: clientSearchReady && (!selectedClientId || clientPickerOpen),
  });
  const detailQuery = useQuery({
    queryKey: ["crm-client", selectedClientId],
    queryFn: () => clientApi.getClientCrm(selectedClientId),
    enabled: Boolean(selectedClientId),
  });

  const refreshCrm = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["groupes-clients"] }),
      queryClient.invalidateQueries({ queryKey: ["crm-clients"] }),
      queryClient.invalidateQueries({ queryKey: ["crm-client"] }),
    ]);
  };

  const selectClient = (clientId: string) => {
    setPreviewClientId(clientId);
    setClientPickerOpen(false);
  };

  return (
    <div className="min-w-0 space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">CRM</p>
          <h1 className="text-2xl font-semibold">{selectedClientId ? "Fiche client" : "Clients"}</h1>
          <p className="text-sm text-muted-foreground">
            {selectedClientId
              ? "Informations, organisation, acquisition et conditions de paiement."
              : "Recherchez, consultez et créez les clients de l’agence."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageClients ? (
            <Button type="button" variant="outline" onClick={() => setGroupDialogOpen(true)}>
              <Users className="size-4" />
              Nouveau groupe
            </Button>
          ) : null}
          {selectedClientId ? (
            <Button type="button" variant="outline" onClick={() => setClientPickerOpen(true)}>
              <Search className="size-4" />
              Changer de client
            </Button>
          ) : null}
          {canCreateClient ? (
            <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setClientDialogOpen(true)}>
              <Plus className="size-4" />
              Nouveau client
            </Button>
          ) : null}
        </div>
      </header>

      {!selectedClientId ? (
        <section className="mx-auto w-full max-w-5xl rounded-lg border bg-card">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">Rechercher un client</h2>
            <p className="text-sm text-muted-foreground">Sélectionnez le client dont vous souhaitez consulter la fiche.</p>
          </div>
          <ClientPicker
            query={query}
            onQueryChange={(value) => { setQuery(value); setPage(0); }}
            groupeId={groupeId}
            onGroupChange={(value) => { setGroupeId(value); setPage(0); }}
            groupes={groupesQuery.data ?? []}
            origineId={origineId}
            onOriginChange={(value) => { setOrigineId(value); setPage(0); }}
            collaborateurId={collaborateurId}
            onCollaboratorChange={(value) => { setCollaborateurId(value); setPage(0); }}
            acquisitionOptions={acquisitionOptionsQuery.data}
            clients={clientSearchReady && !clientsQuery.isError ? clientsQuery.data?.items ?? [] : []}
            searchActive={hasClientSearch}
            loading={hasClientSearch && (!clientSearchReady || clientsQuery.isLoading)}
            error={clientSearchReady && clientsQuery.isError ? clientsQuery.error.message : undefined}
            onRetry={() => void clientsQuery.refetch()}
            page={clientSearchReady && !clientsQuery.isError ? clientsQuery.data?.page : undefined}
            onPageChange={setPage}
            onSelect={selectClient}
          />
        </section>
      ) : detailQuery.isLoading ? (
        <PortfolioSkeleton />
      ) : detailQuery.data ? (
        <ClientDetail
          detail={detailQuery.data}
          onAssignGroup={() => setAssignmentOpen(true)}
          canManageClients={canManageClients}
          onEdit={canEditClient ? setClientToEdit : undefined}
        />
      ) : (
        <section className="grid min-h-80 place-items-center rounded-lg border bg-card p-6 text-center">
          <div>
            <p className="font-medium">Client introuvable</p>
            <Button className="mt-3" variant="outline" onClick={() => setSearchParams({})}>Revenir à la recherche</Button>
          </div>
        </section>
      )}

      <Dialog open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
        <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>Changer de client</DialogTitle>
            <DialogDescription>Recherchez par nom, identifiant ou groupe.</DialogDescription>
          </DialogHeader>
          <ClientPicker
            query={query}
            onQueryChange={(value) => { setQuery(value); setPage(0); }}
            groupeId={groupeId}
            onGroupChange={(value) => { setGroupeId(value); setPage(0); }}
            groupes={groupesQuery.data ?? []}
            origineId={origineId}
            onOriginChange={(value) => { setOrigineId(value); setPage(0); }}
            collaborateurId={collaborateurId}
            onCollaboratorChange={(value) => { setCollaborateurId(value); setPage(0); }}
            acquisitionOptions={acquisitionOptionsQuery.data}
            clients={clientSearchReady && !clientsQuery.isError ? clientsQuery.data?.items ?? [] : []}
            searchActive={hasClientSearch}
            loading={hasClientSearch && (!clientSearchReady || clientsQuery.isLoading)}
            error={clientSearchReady && clientsQuery.isError ? clientsQuery.error.message : undefined}
            onRetry={() => void clientsQuery.refetch()}
            page={clientSearchReady && !clientsQuery.isError ? clientsQuery.data?.page : undefined}
            onPageChange={setPage}
            onSelect={selectClient}
          />
        </DialogContent>
      </Dialog>

      {previewClientId && <ClientSummaryDialog key={previewClientId} clientId={previewClientId}
        onClose={() => setPreviewClientId(undefined)} onEdit={canEditClient ? setClientToEdit : undefined} />}
      {clientToEdit && <ClientDialog key={clientToEdit.id} open client={clientToEdit}
        onOpenChange={open => { if (!open) setClientToEdit(undefined); }} groupes={groupesQuery.data ?? []}
        onSaved={async clientId => {
          await refreshCrm();
          await queryClient.invalidateQueries({ queryKey: attachmentKeys.client(clientId) });
          setClientToEdit(undefined);
        }} />}
      <CreateClientGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        onSaved={refreshCrm}
      />
      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        groupes={groupesQuery.data ?? []}
        onSaved={async (clientId) => {
          await refreshCrm();
          selectClient(clientId);
        }}
      />
      <AssignmentDialog
        open={assignmentOpen}
        onOpenChange={setAssignmentOpen}
        client={detailQuery.data?.client}
        groupes={groupesQuery.data ?? []}
        membershipId={principalMembershipId(detailQuery.data)}
        onSaved={async () => {
          await refreshCrm();
          toast.success("Rattachement groupe enregistré");
        }}
      />
    </div>
  );
}

function ClientPicker({
  query,
  onQueryChange,
  groupeId,
  onGroupChange,
  groupes,
  origineId,
  onOriginChange,
  collaborateurId,
  onCollaboratorChange,
  acquisitionOptions,
  clients,
  searchActive,
  loading,
  error,
  onRetry,
  page,
  onPageChange,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  groupeId: string;
  onGroupChange: (value: string) => void;
  groupes: GroupeClient[];
  origineId: string;
  onOriginChange: (value: string) => void;
  collaborateurId: string;
  onCollaboratorChange: (value: string) => void;
  acquisitionOptions?: AcquisitionOptions;
  clients: ClientResponse[];
  searchActive: boolean;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  page?: ClientPage["page"];
  onPageChange: (page: number) => void;
  onSelect: (clientId: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="grid min-w-0 gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">Client</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              className="pl-9"
              placeholder="Nom, code client, RC, CIN ou ICE"
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
        </label>
        <Field label="Groupe" className="min-w-0">
          <Combobox
            value={groupeId}
            options={[
              { value: "TOUS", label: "Tous les groupes" },
              ...groupes.map(groupe => ({ value: groupe.id, label: `${groupe.code} - ${groupe.libelle}` })),
            ]}
            onValueChange={value => onGroupChange(value ? String(value) : "TOUS")}
            placeholder="Tous les groupes"
            searchPlaceholder="Rechercher un groupe..."
            emptyText="Aucun groupe trouvé."
            className="min-w-0 [&>svg]:shrink-0"
          />
        </Field>
        <Field label="Origine" className="min-w-0">
          <Combobox
            value={origineId}
            options={[
              { value: "TOUTES", label: "Toutes les origines" },
              ...(acquisitionOptions?.origines ?? []).map(origin => ({ value: origin.id, label: origin.libelle })),
            ]}
            onValueChange={value => onOriginChange(value ? String(value) : "TOUTES")}
            placeholder="Toutes les origines"
            searchPlaceholder="Rechercher une origine..."
            emptyText="Aucune origine trouvée."
            className="min-w-0 [&>svg]:shrink-0"
          />
        </Field>
        <Field label="Collaborateur" className="min-w-0">
          <Combobox
            value={collaborateurId}
            options={[
              { value: "TOUS", label: "Toute l'équipe" },
              ...(acquisitionOptions?.collaborateurs ?? []).filter(user => user.actif).map(user => ({ value: user.id, label: user.nom })),
            ]}
            onValueChange={value => onCollaboratorChange(value ? String(value) : "TOUS")}
            placeholder="Toute l'équipe"
            searchPlaceholder="Rechercher un collaborateur..."
            emptyText="Aucun collaborateur trouvé."
            className="min-w-0 [&>svg]:shrink-0"
          />
        </Field>
      </div>
      <div className="max-h-[54vh] min-h-40 divide-y overflow-y-auto">
        {!searchActive ? <div className="p-10 text-center text-sm text-muted-foreground">Aucune recherche en cours.</div> : null}
        {loading ? Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 p-4">
            <Skeleton className="size-10 rounded-md" />
            <div className="grid flex-1 gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64 max-w-full" /></div>
          </div>
        )) : null}
        {searchActive && !loading && error ? <div role="alert" className="grid justify-items-center gap-3 p-10 text-center text-sm">
          <p className="text-destructive">{error}</p>
          <Button type="button" variant="outline" onClick={onRetry}>Réessayer</Button>
        </div> : null}
        {searchActive && !loading && !error && clients.map((client) => (
          <button
            key={client.id}
            type="button"
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none dark:hover:bg-blue-950/30"
            onClick={() => onSelect(client.id)}
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{client.nomAffichage || client.raisonSociale || client.nom}</div>
              <div className="truncate text-xs text-muted-foreground">
                {[client.codeClient || "Sans code", client.rc || client.cin || client.ice || "Identifiant non renseigné"].join(" · ")}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {client.groupe ? <Badge variant="secondary">{client.groupe.code}</Badge> : null}
              <ArrowRight className="size-4 text-muted-foreground" />
            </div>
          </button>
        ))}
        {searchActive && !loading && !error && clients.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Aucun client trouvé.</div>
        ) : null}
      </div>
      {searchActive && !loading && !error && page ? <div className="flex items-center justify-between border-t p-3 text-sm">
        <span className="text-muted-foreground">{page?.totalElements ?? 0} client(s)</span>
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="outline" aria-label="Page précédente" disabled={page?.first ?? true} onClick={() => onPageChange(Math.max((page?.number ?? 0) - 1, 0))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" aria-label="Page suivante" disabled={page?.last ?? true} onClick={() => onPageChange((page?.number ?? 0) + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div> : null}
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-4 border-b p-5"><Skeleton className="size-12 rounded-md" /><div className="grid gap-2"><Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-80" /></div></div>
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="bg-card p-4"><Skeleton className="h-3 w-24" /><Skeleton className="mt-2 h-6 w-32" /></div>)}</div>
      <div className="grid gap-4 p-5 lg:grid-cols-2"><Skeleton className="h-60" /><Skeleton className="h-60" /></div>
    </div>
  );
}

type ClientDraft = ClientInput["client"] & {
  groupeClientId?: string;
  relationGroupe?: RelationGroupeClient;
};

function ClientDialog({
  open,
  onOpenChange,
  groupes,
  onSaved,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupes: GroupeClient[];
  onSaved: (clientId: string) => Promise<void>;
  client?: ClientResponse;
}) {
  const [draft, setDraft] = useState<ClientDraft>(() => client ? clientRecordDraft(client) : emptyClientDraft());
  const [documents, setDocuments] = useState<ClientDocumentDraft[]>([]);
  const [createdClient, setCreatedClient] = useState<ClientResponse | null>(null);
  const villesQuery = useQuery({
    queryKey: ["referentiel", "villes"],
    queryFn: () => referenceApi.list("villes"),
    staleTime: 60_000,
    enabled: open,
  });
  const acquisitionOptionsQuery = useQuery({
    queryKey: ["crm", "acquisition-options"],
    queryFn: clientApi.acquisitionOptions,
    staleTime: 60_000,
    enabled: open,
  });
  const update = (patch: Partial<ClientDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const telephones = draft.telephones ?? [];
  const createMutation = useMutation({
    mutationFn: async () => {
      if (client) return clientApi.updateClient(client.id, {
        ...draft,
        prenom: clean(draft.prenom), nom: clean(draft.nom), raisonSociale: clean(draft.raisonSociale),
        cin: clean(draft.cin), rc: clean(draft.rc), ice: clean(draft.ice), adresse: clean(draft.adresse), email: clean(draft.email),
        telephone: clean((telephones.find(telephone => telephone.principal) ?? telephones[0])?.numero),
        telephones: telephones.map(telephone => ({ ...telephone, numero: telephone.numero.trim() })),
      });
      const savedClient = createdClient ?? await clientApi.createClient({
        typeClient: draft.typeClient,
        genre: draft.genre,
        prenom: clean(draft.prenom),
        nom: clean(draft.nom),
        raisonSociale: clean(draft.raisonSociale),
        cin: clean(draft.cin),
        cinValidite: draft.cinValidite,
        rc: clean(draft.rc),
        ice: clean(draft.ice),
        iff: draft.typeClient === "PERSONNE_MORALE" ? clean(draft.iff) : undefined,
        cnss: draft.typeClient === "PERSONNE_MORALE" ? clean(draft.cnss) : undefined,
        villeId: draft.villeId,
        adresse: clean(draft.adresse),
        telephone: clean((telephones.find((telephone) => telephone.principal) ?? telephones[0])?.numero),
        email: clean(draft.email),
        groupeClientId: draft.groupeClientId,
        relationGroupe: draft.relationGroupe,
        telephones: telephones.map((telephone) => ({ ...telephone, numero: telephone.numero.trim() })),
        acquisition: draft.acquisition,
      });
      setCreatedClient(savedClient);
      for (const document of documents) {
        await attachmentApi.uploadClient(savedClient.id, {
          typePieceJointeId: document.type.id, files: document.files, expiresOn: document.expiresOn,
        });
        setDocuments(current => current.filter(item => item.key !== document.key));
      }
      return savedClient;
    },
    onSuccess: async (savedClient) => {
      await onSaved(savedClient.id);
      toast.success(client ? "Fiche client mise à jour" : "Client créé");
      setDraft(emptyClientDraft());
      setDocuments([]);
      setCreatedClient(null);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });
  const physical = draft.typeClient === "PERSONNE_PHYSIQUE";
  const valid = Boolean(
    draft.villeId
      && draft.adresse?.trim()
      && telephones.length > 0 && telephones.every((telephone) => telephone.numero.trim())
      && (physical
        ? draft.genre && draft.nom?.trim() && draft.prenom?.trim() && draft.cin?.trim() && draft.cinValidite
        : draft.raisonSociale?.trim() && draft.rc?.trim())
  );
  const acquisitionValid = isAcquisitionValid(draft.acquisition, acquisitionOptionsQuery.data);

  async function closeClientDialog() {
    if (createMutation.isPending) return;
    if (createdClient) await onSaved(createdClient.id);
    setCreatedClient(null);
    setDocuments([]);
    setDraft(emptyClientDraft());
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!createMutation.isPending) {
          if (next) onOpenChange(true);
          else void closeClientDialog();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{client ? "Modifier le client" : "Nouveau client"}</DialogTitle>
          <DialogDescription>{client ? `${client.codeClient || "Client"} · ${client.nomAffichage || client.raisonSociale || client.nom}` : "Créez la fiche CRM puis rattachez-la éventuellement à un groupe."}</DialogDescription>
        </DialogHeader>
        {createdClient && <p className="text-sm text-amber-700">Le client est créé. Les pièces restantes peuvent être envoyées à nouveau.</p>}
        <fieldset disabled={createMutation.isPending || !!createdClient} className="contents">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Type de client">
            <Select
              value={draft.typeClient}
              disabled={Boolean(client)}
              onValueChange={(value) => { setDocuments([]); setDraft({
                ...emptyClientDraft(value as TypeClient),
                groupeClientId: draft.groupeClientId,
                relationGroupe: draft.relationGroupe,
              }); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PERSONNE_MORALE">Personne morale</SelectItem>
                <SelectItem value="PERSONNE_PHYSIQUE">Personne physique</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {physical ? (
            <>
              <Field label="Genre" required>
                <Select value={draft.genre ?? ""} onValueChange={(value) => update({ genre: value as NonNullable<ClientDraft["genre"]> })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOMME">Homme</SelectItem>
                    <SelectItem value="FEMME">Femme</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="CIN" required>
                <Input value={draft.cin ?? ""} onChange={(event) => update({ cin: event.target.value })} />
              </Field>
              <Field label="Validité CIN" required>
                <DatePicker date={draft.cinValidite} onSelect={(date) => update({ cinValidite: toDateOnly(date) })} />
              </Field>
              <Field label="Nom" required>
                <Input value={draft.nom ?? ""} onChange={(event) => update({ nom: event.target.value })} />
              </Field>
              <Field label="Prénom" required>
                <Input value={draft.prenom ?? ""} onChange={(event) => update({ prenom: event.target.value })} />
              </Field>
              {client && <>
                <Field label="Date de naissance"><DatePicker date={draft.dateNaissance} onSelect={date => update({ dateNaissance: toDateOnly(date) })} /></Field>
                <Field label="Nationalité"><Input value={draft.nationalite ?? ""} onChange={event => update({ nationalite: event.target.value })} /></Field>
                <Field label="Passeport"><Input value={draft.passport ?? ""} onChange={event => update({ passport: event.target.value })} /></Field>
                <Field label="Validité passeport"><DatePicker date={draft.passportValidite} onSelect={date => update({ passportValidite: toDateOnly(date) })} /></Field>
                <Field label="Carte de résidence"><Input value={draft.carteResidence ?? ""} onChange={event => update({ carteResidence: event.target.value })} /></Field>
                <h3 className="border-t pt-4 text-sm font-semibold text-blue-800 sm:col-span-2 lg:col-span-3 dark:text-blue-200">Permis de conduire</h3>
                <Field label="Numéro de permis"><Input value={draft.numeroPermis ?? ""} onChange={event => update({ numeroPermis: event.target.value })} /></Field>
                <Field label="Date de délivrance"><DatePicker date={draft.dateDelivrancePermis} onSelect={date => update({ dateDelivrancePermis: toDateOnly(date) })} /></Field>
                <Field label="Validité du permis"><DatePicker date={draft.dateValiditePermis} onSelect={date => update({ dateValiditePermis: toDateOnly(date) })} /></Field>
              </>}
            </>
          ) : (
            <>
              <Field label="Raison sociale" required>
                <Input value={draft.raisonSociale ?? ""} onChange={(event) => update({ raisonSociale: event.target.value })} />
              </Field>
              <Field label="RC" required>
                <Input value={draft.rc ?? ""} onChange={(event) => update({ rc: event.target.value })} />
              </Field>
              <Field label="ICE">
                <Input value={draft.ice ?? ""} onChange={(event) => update({ ice: event.target.value })} />
              </Field>
              <Field label="Identifiant fiscal (IF)">
                <Input value={draft.iff ?? ""} onChange={(event) => update({ iff: event.target.value })} />
              </Field>
              <Field label="N° d'affiliation CNSS">
                <Input value={draft.cnss ?? ""} onChange={(event) => update({ cnss: event.target.value })} />
              </Field>
              {client && <Field label="Patente"><Input value={draft.patente ?? ""} onChange={event => update({ patente: event.target.value })} /></Field>}
            </>
          )}
          {client && <h3 className="border-t pt-4 text-sm font-semibold text-blue-800 sm:col-span-2 lg:col-span-3 dark:text-blue-200">Coordonnées</h3>}
          <Field label="Ville" required>
            <AutocompleteSelect
              value={draft.villeId ?? ""}
              onValueChange={(value) => update({ villeId: value })}
              options={(villesQuery.data ?? []).map((ville) => ({ value: ville.id, label: ville.libelle }))}
              placeholder="Ville"
              emptyText="Aucune ville trouvée"
              invalidText="Choisissez une ville existante."
            />
          </Field>
          <Field label="Adresse" required>
            <Input value={draft.adresse ?? ""} onChange={(event) => update({ adresse: event.target.value })} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <TelephoneList client={{ role: "SOUSCRIPTEUR", principalPourRole: true, client: draft }} updateClient={update} />
          </div>
          <Field label="Email">
            <Input type="email" value={draft.email ?? ""} onChange={(event) => update({ email: event.target.value })} />
          </Field>
          {!client && <Field label="Groupe">
            <ClientGroupSelect value={draft.groupeClientId ?? "INDEPENDANT"} groups={groupes} disabled={createMutation.isPending || Boolean(createdClient)} onValueChange={(value) => update({
              groupeClientId: value === "INDEPENDANT" ? undefined : value,
              relationGroupe: value === "INDEPENDANT" ? undefined : draft.relationGroupe ?? "FILIALE",
            })} />
          </Field>}
          {draft.groupeClientId ? (
            <Field label="Relation au groupe">
              <Select value={draft.relationGroupe ?? "FILIALE"} onValueChange={(value) => update({ relationGroupe: value as RelationGroupeClient })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TETE_GROUPE">Tête de groupe</SelectItem>
                  <SelectItem value="FILIALE">Filiale</SelectItem>
                  <SelectItem value="SOCIETE_LIEE">Société liée</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>
        {!client && <section className="rounded-md border">
          <div className="border-b bg-blue-50/60 px-4 py-3 dark:bg-blue-950/20">
            <h3 className="flex items-center gap-2 font-semibold">
              <Megaphone className="size-4 text-blue-600" />
              Acquisition commerciale
            </h3>
          </div>
          <div className="p-4">
            <AcquisitionFields
              value={draft.acquisition}
              options={acquisitionOptionsQuery.data}
              onChange={(acquisition) => update({ acquisition })}
            />
          </div>
        </section>}
        </fieldset>
        {!client && <ClientDocumentDrafts typeClient={draft.typeClient} value={documents} onChange={setDocuments} disabled={createMutation.isPending} owner={draft} />}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={createMutation.isPending} onClick={() => void closeClientDialog()}>{createdClient ? "Fermer" : "Annuler"}</Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={!valid || !acquisitionValid || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Enregistrement..." : client ? "Enregistrer" : createdClient ? "Envoyer les pièces restantes" : "Créer le client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientDetail({
  detail,
  onAssignGroup,
  canManageClients,
  onEdit,
}: {
  detail: Awaited<ReturnType<typeof clientApi.getClientCrm>>;
  onAssignGroup: () => void;
  canManageClients: boolean;
  onEdit?: (client: ClientResponse) => void;
}) {
  const client = detail.client;
  const queryClient = useQueryClient();
  const [acquisitionOpen, setAcquisitionOpen] = useState(false);
  const [acquisitionDraft, setAcquisitionDraft] = useState<AcquisitionClient | undefined>();
  const [paymentConditionOpen, setPaymentConditionOpen] = useState(false);
  const [linkedClient, setLinkedClient] = useState<{ id: string; name: string }>();
  const acquisitionOptionsQuery = useQuery({
    queryKey: ["crm", "acquisition-options"],
    queryFn: clientApi.acquisitionOptions,
    staleTime: 60_000,
    enabled: acquisitionOpen,
  });
  const acquisitionMutation = useMutation({
    mutationFn: (request: AcquisitionClient) => clientApi.updateAcquisition(client.id, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm-client", client.id] });
      toast.success("Origine du client enregistrée");
      setAcquisitionOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });
  const canViewClaims = useAuthStore((state) => {
    const permissions = state.user?.permissions ?? [];
    return ["sinistre:view", "sinistre:manage", "sinistre:finance"].some(
      (permission) => permissions.includes(permission),
    );
  });
  const paymentConditionsQuery = useQuery({
    queryKey: ["crm", "payment-conditions", "CLIENT", client.id],
    queryFn: () => clientApi.listPaymentConditions("CLIENT", client.id),
  });
  const groupMembers = uniqueGroupMembers(detail.groupes, client.id);
  const accountingUrl = `/app/compta/releves-factures?payeurType=CLIENT&payeurId=${client.id}`;
  const productionUrl = `/app/production/portefeuille-clients/${client.id}`;
  const claimsUrl = `/app/sinistre/dossiers?clientId=${client.id}`;
  const activePaymentCondition = paymentConditionsQuery.data?.find((condition) => condition.statut === "ACTIVE");

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{client.nomAffichage || client.raisonSociale || client.nom}</h2>
            <Badge variant="outline">{client.typeClient === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique"}</Badge>
            <Badge className={client.actif === false ? "bg-slate-500" : "bg-emerald-600"}>{client.actif === false ? "Inactif" : "Actif"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[client.codeClient, client.rc || client.cin, client.ice].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onEdit && <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => onEdit(client)}><Pencil className="size-4" />Modifier</Button>}
          <Button asChild type="button" variant="outline" className="border-emerald-200 text-emerald-950 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-100 dark:hover:bg-emerald-950/30">
            <Link to={productionUrl}><FolderOpen className="size-4" />Portefeuille client</Link>
          </Button>
          <Button asChild type="button" variant="outline" className="border-amber-200 text-amber-950 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-100 dark:hover:bg-amber-950/30">
            <Link to={accountingUrl}><ReceiptText className="size-4" />Relevés et factures</Link>
          </Button>
          {canViewClaims && <Button asChild type="button" variant="outline"><Link to={claimsUrl}><ShieldCheck className="size-4 text-blue-700 dark:text-blue-300" />Sinistres</Link></Button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span>Contrats : <strong className="font-medium text-foreground">{detail.contrats.length}</strong></span>
        {activePaymentCondition && <span>Condition de paiement active : <strong className="font-medium text-foreground">{activePaymentCondition.delaiJours} jours</strong></span>}
      </div>

      <ClientProfileDetails client={client} className="border-b py-4 lg:grid-cols-2" />
      <div className="grid items-start gap-x-8 gap-y-6 xl:grid-cols-2">
        <PortfolioSection
            title="Acquisition commerciale"
            icon={<Megaphone className="size-4" />}
            action={canManageClients ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAcquisitionDraft(detail.acquisition ? { ...detail.acquisition } : undefined);
                  setAcquisitionOpen(true);
                }}
              >
                {detail.acquisition ? "Corriger" : "Renseigner"}
              </Button>
            ) : undefined}
          >
            {detail.acquisition ? (
              <dl className="grid gap-1 text-sm sm:grid-cols-2 sm:gap-x-6">
                <Info label="Origine" value={detail.acquisition.origineLibelle} />
                <Info label="Date d’acquisition" value={dateLabel(detail.acquisition.dateAcquisition)} />
                <Info
                  label="Recommandé par"
                  value={detail.acquisition.recommandeParUtilisateurNom || detail.acquisition.recommandeParClientNom}
                />
                <Info label="Attribution saisie par" value={detail.acquisition.saisiParNom} />
                {detail.acquisition.notes ? (
                  <div className="sm:col-span-2">
                    <Info label="Note" value={detail.acquisition.notes} />
                  </div>
                ) : null}
              </dl>
            ) : (
              <EmptyState text="L’origine commerciale de ce client n’est pas renseignée." />
            )}
        </PortfolioSection>
        <PortfolioSection
            title="Organisation et groupe"
            icon={<Building2 className="size-4" />}
            action={canManageClients ? <Button size="sm" variant="outline" onClick={onAssignGroup}>Modifier</Button> : undefined}
          >
            {detail.groupes.length ? detail.groupes.map((groupe) => (
              <div key={groupe.id} className="border-b py-3 first:pt-0 last:border-0 last:pb-0">
                <div className="font-medium">{groupe.code} - {groupe.libelle}</div>
                <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  <span>Tête de groupe : <strong className="font-medium text-foreground">{groupe.clientTeteNom || "Non définie"}</strong></span>
                  <span>Responsable des paiements : <strong className="font-medium text-foreground">{groupe.clientTresorerieNom || "Non définie"}</strong></span>
                  <span>Facturation : <strong className="font-medium text-foreground">{groupe.facturationConsolideeDefaut ? "Consolidée" : "Directe"}</strong></span>
                  <span>{groupe.membres.length} membre(s)</span>
                </div>
              </div>
            )) : <EmptyState text="Ce client n’est rattaché à aucun groupe." />}
        </PortfolioSection>
        <PortfolioSection
            title="Conditions de paiement"
            icon={<CalendarClock className="size-4" />}
            action={canManageClients ? (
              <Button size="sm" variant="outline" onClick={() => setPaymentConditionOpen(true)}>
                <Plus className="size-4" />
                Nouvelle condition
              </Button>
            ) : undefined}
          >
            {paymentConditionsQuery.isError ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
              <p>Chargement des conditions impossible.</p><Button size="sm" variant="outline" onClick={() => void paymentConditionsQuery.refetch()}>Réessayer</Button>
            </div> : <PaymentConditionHistory
              rows={paymentConditionsQuery.data ?? []}
              loading={paymentConditionsQuery.isLoading}
            />}
        </PortfolioSection>
        {groupMembers.length > 0 && <PortfolioSection title="Entités liées" icon={<Building2 className="size-4" />}>
            {groupMembers.length ? (
              <div className="divide-y">
                {groupMembers.slice(0, 8).map((member) => (
                  <button key={member.clientId} type="button" onClick={() => setLinkedClient({ id: member.clientId, name: member.clientNom })}
                    className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:text-blue-700" aria-label={`Consulter la fiche de ${member.clientNom}`}>
                    <span><strong>{member.clientNom}</strong><span className="ml-2 text-muted-foreground">{label(member.typeRelation)}</span></span>
                    <Eye className="size-4 shrink-0" />
                  </button>
                ))}
              </div>
            ) : <EmptyState text="Aucune autre entité liée." />}
        </PortfolioSection>}
        <PortfolioSection title="Documents client" icon={<Paperclip className="size-4" />}>
          <ClientDocuments clientId={client.id} typeClient={client.typeClient} owner={client} />
        </PortfolioSection>
      </div>

      <Dialog open={acquisitionOpen} onOpenChange={setAcquisitionOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Origine du client</DialogTitle>
            <DialogDescription>
              Corrigez l’attribution commerciale initiale sans modifier l’utilisateur qui a créé la fiche.
            </DialogDescription>
          </DialogHeader>
          <AcquisitionFields
            value={acquisitionDraft}
            options={acquisitionOptionsQuery.data}
            excludedClientId={client.id}
            onChange={setAcquisitionDraft}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAcquisitionOpen(false)}>Annuler</Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={
                !isAcquisitionValid(acquisitionDraft, acquisitionOptionsQuery.data)
                || acquisitionMutation.isPending
              }
              onClick={() => acquisitionDraft && acquisitionMutation.mutate(acquisitionDraft)}
            >
              {acquisitionMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PaymentConditionDialog
        open={paymentConditionOpen}
        onOpenChange={setPaymentConditionOpen}
        clientId={client.id}
        onSaved={async () => {
          await queryClient.invalidateQueries({
            queryKey: ["crm", "payment-conditions", "CLIENT", client.id],
          });
        }}
      />
      {linkedClient && <ClientSummaryDialog clientId={linkedClient.id} onEdit={onEdit} onClose={() => setLinkedClient(undefined)} />}
    </section>
  );
}

function PaymentConditionHistory({
  rows,
  loading,
}: {
  rows: ClientPaymentCondition[];
  loading: boolean;
}) {
  const download = useMutation({
    mutationFn: async (row: ClientPaymentCondition) => ({
      blob: await clientApi.downloadPaymentConditionEvidence(row.id),
      name: row.nomFichier || `condition-paiement-${row.id}`,
    }),
    onSuccess: ({ blob, name }) => downloadBlob(blob, name),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Téléchargement impossible"),
  });

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!rows.length) {
    return <p className="py-2 text-sm text-muted-foreground">Aucune condition particulière enregistrée.</p>;
  }
  return (
    <div className="divide-y rounded-md border">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-2 p-3 sm:grid-cols-[120px_1fr_auto] sm:items-center">
          <div>
            <p className="text-lg font-semibold">{row.delaiJours} jours</p>
            <Badge variant={row.statut === "ACTIVE" ? "default" : "outline"}>
              {row.statut === "ACTIVE" ? "Active" : row.statut === "A_VENIR" ? "À venir" : "Expirée"}
            </Badge>
          </div>
          <div className="min-w-0 text-sm">
            <p>{paymentConditionTypeLabel(row.typeJustification)}</p>
            <p className="text-xs text-muted-foreground">
              Du {dateLabel(row.dateDebut)} {row.dateFin ? `au ${dateLabel(row.dateFin)}` : "sans date de fin"}
            </p>
            {row.commentaire ? <p className="mt-1 text-xs text-muted-foreground">{row.commentaire}</p> : null}
          </div>
          {row.justificatifPresent ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={download.isPending}
              onClick={() => download.mutate(row)}
            >
              <Download className="size-4" />
              Justificatif
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Sans justificatif</span>
          )}
        </div>
      ))}
    </div>
  );
}

function PaymentConditionDialog({
  open,
  onOpenChange,
  clientId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSaved: () => Promise<void>;
}) {
  const [days, setDays] = useState("");
  const [type, setType] = useState<ClientPaymentCondition["typeJustification"] | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File>();

  useEffect(() => {
    if (!open) return;
    setDays("");
    setType("");
    setStartDate("");
    setEndDate("");
    setComment("");
    setFile(undefined);
  }, [open]);

  const save = useMutation({
    mutationFn: () => {
      if (!days || !type || !startDate) {
        throw new Error("Renseignez le délai, le fondement et la date de début");
      }
      return clientApi.createPaymentCondition({
        payeurType: "CLIENT",
        payeurId: clientId,
        delaiJours: Number(days),
        typeJustification: type,
        dateDebut: startDate,
        dateFin: endDate || undefined,
        commentaire: comment.trim() || undefined,
        justificatif: file,
      });
    },
    onSuccess: async () => {
      await onSaved();
      toast.success("Condition de paiement enregistrée");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle condition de paiement</DialogTitle>
          <DialogDescription>
            Cette condition s’appliquera uniquement à ce client après enregistrement.
            La version précédente reste dans l’historique.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldLabel label="Délai de paiement *">
            <Select value={days} onValueChange={(value) => {
              setDays(value);
              if (value === "180") {
                setType("DEROGATION_SECTORIELLE");
              } else if (value === "90" || value === "120") {
                setType("ACCORD_CONTRACTUEL");
              } else if (type === "DEROGATION_SECTORIELLE") {
                setType("");
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Choisir un délai" /></SelectTrigger>
              <SelectContent>
                {[30, 60, 90, 120, 180].map((value) => (
                  <SelectItem key={value} value={String(value)}>{value} jours</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldLabel>
          <FieldLabel label="Fondement *">
            <Select value={type} onValueChange={(value) => setType(value as ClientPaymentCondition["typeJustification"])}>
              <SelectTrigger><SelectValue placeholder="Choisir un fondement" /></SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="POLITIQUE_AGENCE"
                  disabled={days === "90" || days === "120" || days === "180"}
                >
                  Politique de l’agence
                </SelectItem>
                <SelectItem value="ACCORD_CONTRACTUEL" disabled={days === "180"}>
                  Accord contractuel
                </SelectItem>
                <SelectItem value="DEROGATION_SECTORIELLE" disabled={days !== "180"}>
                  Dérogation sectorielle
                </SelectItem>
              </SelectContent>
            </Select>
          </FieldLabel>
          <FieldLabel label="Valable à partir du *">
            <DatePicker
              date={startDate}
              onSelect={(date) => setStartDate(toDateOnly(date) ?? "")}
            />
          </FieldLabel>
          <FieldLabel label="Valable jusqu’au">
            <DatePicker date={endDate} onSelect={(date) => setEndDate(toDateOnly(date) ?? "")} />
          </FieldLabel>
          <div className="sm:col-span-2">
            <FieldLabel label="Justificatif (facultatif)">
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Paperclip className="size-4 text-muted-foreground" />
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={(event) => setFile(event.target.files?.[0])}
                />
              </div>
            </FieldLabel>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel label="Note interne">
              <Textarea value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} />
            </FieldLabel>
          </div>
          {days === "180" ? (
            <p className="text-xs text-amber-700 sm:col-span-2">
              Le délai de 180 jours doit correspondre à une dérogation sectorielle applicable.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            type="button"
            disabled={!days || !type || !startDate || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldLabel({ label: text, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{text}</span>
      {children}
    </label>
  );
}

function paymentConditionTypeLabel(value: ClientPaymentCondition["typeJustification"]) {
  if (value === "ACCORD_CONTRACTUEL") return "Accord contractuel";
  if (value === "DEROGATION_SECTORIELLE") return "Dérogation sectorielle";
  return "Politique de l’agence";
}

function uniqueGroupMembers(groups: GroupeClient[], currentClientId: string) {
  const members = new Map<string, GroupeClient["membres"][number]>();
  groups.forEach((group) => group.membres.forEach((member) => {
    if (member.clientId !== currentClientId) members.set(member.clientId, member);
  }));
  return [...members.values()].sort((left, right) => left.clientNom.localeCompare(right.clientNom, "fr"));
}

function PortfolioSection({ title, icon, action, children }: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 border-b pb-5">
      <header className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-200">{icon}{title}</h3>
        {action}
      </header>
      <div className="pt-3">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-2 text-sm text-muted-foreground">{text}</p>;
}

function AssignmentDialog({
  open,
  onOpenChange,
  client,
  groupes,
  membershipId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientResponse;
  groupes: GroupeClient[];
  membershipId?: string;
  onSaved: () => Promise<void>;
}) {
  const [groupId, setGroupId] = useState("");
  const [relation, setRelation] = useState<RelationGroupeClient>("FILIALE");
  useEffect(() => {
    if (!open) return;
    setGroupId(client?.groupe?.id ?? "INDEPENDANT");
    setRelation(client?.groupe?.typeRelation ?? "FILIALE");
  }, [client?.groupe?.id, client?.groupe?.typeRelation, open]);
  const mutation = useMutation({
    mutationFn: async () => {
      const clientId = client?.id ?? "";
      if (groupId === "INDEPENDANT") {
        if (membershipId) {
          await clientApi.endClientGroup(clientId, membershipId);
        }
        return;
      }
      await clientApi.assignClientGroup(clientId, {
        groupeClientId: groupId,
        typeRelation: relation,
        principal: true,
      });
    },
    onSuccess: async () => {
      await onSaved();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Rattachement impossible"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Organisation du client</DialogTitle>
          <DialogDescription>{client?.nomAffichage || "Client"}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Groupe">
            <ClientGroupSelect value={groupId} groups={groupes} onValueChange={setGroupId} disabled={mutation.isPending} />
          </Field>
          {groupId !== "INDEPENDANT" ? (
            <Field label="Relation">
              <Select value={relation} onValueChange={(value) => setRelation(value as RelationGroupeClient)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TETE_GROUPE">Tête de groupe</SelectItem>
                  <SelectItem value="FILIALE">Filiale</SelectItem>
                  <SelectItem value="SOCIETE_LIEE">Société liée</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={!groupId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label: infoLabel, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid min-w-0 gap-1 py-2">
      <dt className="text-xs text-muted-foreground">{infoLabel}</dt>
      <dd className="break-words font-medium">{value || "-"}</dd>
    </div>
  );
}

function emptyClientDraft(typeClient: TypeClient = "PERSONNE_MORALE"): ClientDraft {
  return {
    typeClient,
    conducteurHabituel: true,
    telephones: [{ numero: "", principal: true, whatsapp: false }],
  };
}

function isAcquisitionValid(
  acquisition: AcquisitionClient | undefined,
  options: AcquisitionOptions | undefined,
) {
  if (!acquisition) return true;
  if (!acquisition.origineCommercialeId || !acquisition.dateAcquisition) return false;

  const origin = options?.origines.find((item) => item.id === acquisition.origineCommercialeId);
  if (!origin || !origin.actif) return false;
  if (origin.type === "COLLABORATEUR") return Boolean(acquisition.recommandeParUtilisateurId);
  if (origin.type === "CLIENT") return Boolean(acquisition.recommandeParClientId);
  return true;
}

function clean(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function Field({
  label: fieldLabel,
  children,
  required = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 text-sm ${className}`}>
      <span className="font-medium">
        {fieldLabel}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function dateLabel(value?: string | null) {
  if (!value) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function label(value?: string | null) {
  return value ? value.replaceAll("_", " ").toLocaleLowerCase("fr").replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("fr")) : "-";
}

function principalMembershipId(detail?: Awaited<ReturnType<typeof clientApi.getClientCrm>>) {
  if (!detail) return undefined;
  const clientId = detail.client.id;
  const principalGroupId = detail.client.groupe?.id;
  for (const groupe of detail.groupes) {
    const membership = groupe.membres.find((item) =>
      item.clientId === clientId && (item.principal || groupe.id === principalGroupId)
    );
    if (membership) return membership.membershipId;
  }
  return undefined;
}
