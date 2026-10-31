import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Megaphone,
  Paperclip,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { AcquisitionFields } from "@/features/crm/components/AcquisitionFields";
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
    setSearchParams({ clientId });
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

      <GroupDialog
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupes: GroupeClient[];
  onSaved: (clientId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ClientDraft>(() => emptyClientDraft());
  const villesQuery = useQuery({
    queryKey: ["referentiel", "villes"],
    queryFn: () => referenceApi.list("villes"),
    staleTime: 60_000,
    enabled: open,
  });
  const categoriesQuery = useQuery({
    queryKey: ["referentiel", "categories-client"],
    queryFn: () => referenceApi.list("categories-client"),
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
  const createMutation = useMutation({
    mutationFn: async () => {
      const client = await clientApi.createClient({
        typeClient: draft.typeClient,
        genre: draft.genre,
        prenom: clean(draft.prenom),
        nom: clean(draft.nom),
        raisonSociale: clean(draft.raisonSociale),
        cin: clean(draft.cin),
        cinValidite: draft.cinValidite,
        rc: clean(draft.rc),
        ice: clean(draft.ice),
        villeId: draft.villeId,
        categorieClientId: draft.categorieClientId,
        adresse: clean(draft.adresse),
        telephone: clean(draft.telephone),
        email: clean(draft.email),
        groupeClientId: draft.groupeClientId,
        relationGroupe: draft.relationGroupe,
        telephones: draft.telephone?.trim()
          ? [{ numero: draft.telephone.trim(), principal: true, whatsapp: false }]
          : [],
        acquisition: draft.acquisition,
      });
      return client;
    },
    onSuccess: async (client) => {
      await onSaved(client.id);
      toast.success("Client créé");
      setDraft(emptyClientDraft());
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });
  const physical = draft.typeClient === "PERSONNE_PHYSIQUE";
  const valid = Boolean(
    draft.villeId
      && draft.adresse?.trim()
      && draft.telephone?.trim()
      && (physical
        ? draft.genre && draft.nom?.trim() && draft.prenom?.trim() && draft.cin?.trim() && draft.cinValidite
        : draft.raisonSociale?.trim() && draft.rc?.trim())
  );
  const acquisitionValid = isAcquisitionValid(draft.acquisition, acquisitionOptionsQuery.data);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!createMutation.isPending) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
          <DialogDescription>Créez la fiche CRM puis rattachez-la éventuellement à un groupe.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Type de client">
            <Select
              value={draft.typeClient}
              onValueChange={(value) => setDraft({
                ...emptyClientDraft(value as TypeClient),
                groupeClientId: draft.groupeClientId,
                relationGroupe: draft.relationGroupe,
              })}
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
            </>
          )}
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
          <Field label="Téléphone" required>
            <Input value={draft.telephone ?? ""} onChange={(event) => update({ telephone: event.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={draft.email ?? ""} onChange={(event) => update({ email: event.target.value })} />
          </Field>
          <Field label="Catégorie">
            <Select value={draft.categorieClientId ?? "AUCUNE"} onValueChange={(value) => update({ categorieClientId: value === "AUCUNE" ? undefined : value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUCUNE">Non définie</SelectItem>
                {(categoriesQuery.data ?? []).filter((item) => item.actif !== false).map((categorie) => (
                  <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Groupe">
            <Select value={draft.groupeClientId ?? "INDEPENDANT"} onValueChange={(value) => update({
              groupeClientId: value === "INDEPENDANT" ? undefined : value,
              relationGroupe: value === "INDEPENDANT" ? undefined : draft.relationGroupe ?? "FILIALE",
            })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INDEPENDANT">Client indépendant</SelectItem>
                {groupes.filter((groupe) => groupe.actif).map((groupe) => (
                  <SelectItem key={groupe.id} value={groupe.id}>{groupe.code} - {groupe.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
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
        <section className="rounded-md border">
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
        </section>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={createMutation.isPending} onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={!valid || !acquisitionValid || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Enregistrement..." : "Créer le client"}
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
}: {
  detail: Awaited<ReturnType<typeof clientApi.getClientCrm>>;
  onAssignGroup: () => void;
  canManageClients: boolean;
}) {
  const client = detail.client;
  const queryClient = useQueryClient();
  const [acquisitionOpen, setAcquisitionOpen] = useState(false);
  const [acquisitionDraft, setAcquisitionDraft] = useState<AcquisitionClient | undefined>();
  const [paymentConditionOpen, setPaymentConditionOpen] = useState(false);
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
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
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
          <Button asChild type="button" variant="outline" className="border-emerald-200 text-emerald-950 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-100 dark:hover:bg-emerald-950/30">
            <Link to={productionUrl}><FolderOpen className="size-4" />Portefeuille client</Link>
          </Button>
          <Button asChild type="button" variant="outline" className="border-amber-200 text-amber-950 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-100 dark:hover:bg-amber-950/30">
            <Link to={accountingUrl}><ReceiptText className="size-4" />Relevés et factures</Link>
          </Button>
          {canManageClients ? (
            <Button type="button" variant="outline" onClick={onAssignGroup} className="border-violet-200 text-violet-950 hover:bg-violet-50 dark:border-violet-900 dark:text-violet-100 dark:hover:bg-violet-950/30">
              <Users className="size-4" />Gérer le groupe
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Code client" value={client.codeClient || "-"} tone="blue" />
        <Metric label="Organisation" value={client.groupe?.libelle ?? "Indépendant"} tone="violet" />
        <Metric label="Délai de paiement" value={`${activePaymentCondition?.delaiJours ?? 60} jours`} tone="amber" />
        <Metric label="Contrats" value={String(detail.contrats.length)} tone="emerald" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PortfolioSection title="Informations client" icon={<Users className="size-4" />} tone="blue">
            <dl className="grid gap-1 text-sm sm:grid-cols-2 sm:gap-x-6">
              <Info label="Identifiant" value={client.rc || client.cin || client.ice} />
              <Info label="Catégorie" value={client.categorieClientLibelle} />
              <Info label="Adresse" value={[client.adresse, client.ville].filter(Boolean).join(", ")} />
              <Info label="Téléphone" value={client.telephone} />
              <Info label="Email" value={client.email} />
              <Info label="Organisation" value={client.groupe?.libelle ?? "Client indépendant"} />
            </dl>
        </PortfolioSection>
        <PortfolioSection
            title="Acquisition commerciale"
            icon={<Megaphone className="size-4" />}
            tone="cyan"
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
            tone="violet"
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
            tone="amber"
            action={canManageClients ? (
              <Button size="sm" variant="outline" onClick={() => setPaymentConditionOpen(true)}>
                <Plus className="size-4" />
                Nouvelle condition
              </Button>
            ) : undefined}
          >
            <PaymentConditionHistory
              rows={paymentConditionsQuery.data ?? []}
              loading={paymentConditionsQuery.isLoading}
            />
        </PortfolioSection>
        <PortfolioSection title="Entités liées" icon={<Building2 className="size-4" />} tone="emerald">
            {groupMembers.length ? (
              <div className="divide-y">
                {groupMembers.slice(0, 8).map((member) => (
                  <Link key={member.clientId} to={`/app/crm?clientId=${member.clientId}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-blue-700">
                    <span><strong>{member.clientNom}</strong><span className="ml-2 text-muted-foreground">{label(member.typeRelation)}</span></span>
                    <ArrowRight className="size-4" />
                  </Link>
                ))}
              </div>
            ) : <EmptyState text="Aucune autre entité liée." />}
        </PortfolioSection>
        <PortfolioSection title="Espaces liés" icon={<ArrowRight className="size-4" />} tone="amber">
            <div className="grid gap-2">
              <WorkspaceLink to={productionUrl} icon={<FolderOpen className="size-4" />} title="Portefeuille client" detail={`${detail.contrats.length} contrat(s) en production`} tone="emerald" />
              <WorkspaceLink to={accountingUrl} icon={<ReceiptText className="size-4" />} title="Relevés et factures" detail="Espace comptable du payeur" tone="amber" />
              {canViewClaims ? (
                <WorkspaceLink to={claimsUrl} icon={<ShieldCheck className="size-4" />} title="Dossiers sinistre" detail="Déclarations et suivi des dossiers" tone="blue" />
              ) : null}
            </div>
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
    return (
      <div className="space-y-2">
        <p className="text-sm">Délai appliqué : <strong>60 jours</strong></p>
        <p className="text-xs text-muted-foreground">
          Aucune condition particulière n’est enregistrée. Le délai par défaut sera proposé sur les factures.
        </p>
      </div>
    );
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

type PortfolioTone = "blue" | "violet" | "emerald" | "amber" | "cyan";

function PortfolioSection({ title, icon, action, children, tone = "blue" }: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: PortfolioTone;
}) {
  const headerTone: Record<PortfolioTone, string> = {
    blue: "border-blue-100 bg-blue-50/70 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100",
    violet: "border-violet-100 bg-violet-50/70 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100",
    emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100",
    amber: "border-amber-100 bg-amber-50/70 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
    cyan: "border-cyan-100 bg-cyan-50/70 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100",
  };
  return (
    <section className="min-w-0 overflow-hidden rounded-md border">
      <header className={`flex min-h-11 items-center justify-between gap-3 border-b px-4 py-2 ${headerTone[tone]}`}>
        <h3 className="flex items-center gap-2 font-semibold">{icon}{title}</h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function WorkspaceLink({ to, icon, title, detail, tone }: {
  to: string;
  icon: ReactNode;
  title: string;
  detail: string;
  tone: "blue" | "emerald" | "amber";
}) {
  const styles = {
    blue: {
      link: "hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30",
      icon: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    },
    emerald: {
      link: "hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
      icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
    amber: {
      link: "hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30",
      icon: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    },
  }[tone];
  return (
    <Link to={to} className={`flex min-w-0 items-center gap-3 rounded-md border p-3 transition-colors ${styles.link}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-md ${styles.icon}`}>{icon}</span>
      <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{title}</strong><span className="block truncate text-xs text-muted-foreground">{detail}</span></span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function GroupDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [libelle, setLibelle] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const deferredSearch = useDeferredValue(clientSearch.trim());
  const [clientTeteId, setClientTeteId] = useState("");
  const [clientTresorerieId, setClientTresorerieId] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, ClientOption>>({});
  const [consolidated, setConsolidated] = useState(false);
  const clientsQuery = useQuery({
    queryKey: ["clients", "group-responsible-search", deferredSearch],
    queryFn: () => clientApi.listClients({ query: deferredSearch, size: 25 }),
    enabled: open && deferredSearch.length >= 2,
  });
  const remoteOptions = (clientsQuery.data?.items ?? []).map((client) => ({
    value: client.id,
    label: client.nomAffichage ?? client.id,
    keywords: [client.rc, client.cin, client.ice].filter(Boolean).join(" "),
  }));
  const options = useMemo(() => {
    const byId = new Map(Object.values(selectedOptions).map((option) => [option.value, option]));
    remoteOptions.forEach((option) => byId.set(option.value, option));
    return [...byId.values()];
  }, [remoteOptions, selectedOptions]);
  const selectResponsible = (value: string, setter: (next: string) => void) => {
    setter(value);
    const option = remoteOptions.find((item) => item.value === value);
    if (option) {
      setSelectedOptions((current) => ({ ...current, [value]: option }));
    }
  };
  const createMutation = useMutation({
    mutationFn: clientApi.createGroupeClient,
    onSuccess: async () => {
      await onSaved();
      toast.success("Groupe client créé");
      onOpenChange(false);
      setCode("");
      setLibelle("");
      setClientTeteId("");
      setClientTresorerieId("");
      setClientSearch("");
      setSelectedOptions({});
      setConsolidated(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau groupe client</DialogTitle>
          <DialogDescription>Définissez la structure du groupe et l'entité qui centralise ses paiements.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code">
            <Input value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
          <Field label="Nom du groupe">
            <Input value={libelle} onChange={(event) => setLibelle(event.target.value)} />
          </Field>
          <Field label="Tête de groupe">
            <AutocompleteSelect
              value={clientTeteId}
              onValueChange={(value) => selectResponsible(value, setClientTeteId)}
              onQueryChange={setClientSearch}
              options={options}
              placeholder="RC, CIN ou nom"
            />
          </Field>
          <Field label="Entité responsable des paiements">
            <AutocompleteSelect
              value={clientTresorerieId}
              onValueChange={(value) => selectResponsible(value, setClientTresorerieId)}
              onQueryChange={setClientSearch}
              options={options}
              placeholder="RC, CIN ou nom"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={consolidated} onCheckedChange={(checked) => setConsolidated(Boolean(checked))} />
            Facturation consolidée par défaut
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={!code.trim() || !libelle.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate({
              code: code.trim(),
              libelle: libelle.trim(),
              clientTeteId: clientTeteId || undefined,
              clientTresorerieId: clientTresorerieId || undefined,
              facturationConsolideeDefaut: consolidated,
              actif: true,
            })}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INDEPENDANT">Client indépendant</SelectItem>
                {groupes.filter((groupe) => groupe.actif).map((groupe) => (
                  <SelectItem key={groupe.id} value={groupe.id}>{groupe.code} - {groupe.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

type MetricTone = "blue" | "violet" | "emerald" | "amber";

function Metric({ label: metricLabel, value, alert, tone = "blue" }: {
  label: string;
  value: string;
  alert?: boolean;
  tone?: MetricTone;
}) {
  const styles: Record<MetricTone, { surface: string; label: string; value: string }> = {
    blue: {
      surface: "border-t-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
      label: "text-blue-700 dark:text-blue-300",
      value: "text-blue-950 dark:text-blue-100",
    },
    violet: {
      surface: "border-t-2 border-violet-500 bg-violet-50/50 dark:bg-violet-950/20",
      label: "text-violet-700 dark:text-violet-300",
      value: "text-violet-950 dark:text-violet-100",
    },
    emerald: {
      surface: "border-t-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
      label: "text-emerald-700 dark:text-emerald-300",
      value: "text-emerald-950 dark:text-emerald-100",
    },
    amber: {
      surface: "border-t-2 border-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
      label: "text-amber-700 dark:text-amber-300",
      value: "text-amber-950 dark:text-amber-100",
    },
  };
  const style = styles[tone];

  return (
    <div className={`p-4 ${style.surface}`}>
      <div className={`text-xs font-medium uppercase ${style.label}`}>{metricLabel}</div>
      <div className={`mt-1 text-lg font-semibold ${alert ? "text-red-600 dark:text-red-400" : style.value}`}>{value}</div>
    </div>
  );
}

function Info({ label: infoLabel, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b py-2 last:border-0">
      <dt className="text-muted-foreground">{infoLabel}</dt>
      <dd className="font-medium">{value || "-"}</dd>
    </div>
  );
}

function emptyClientDraft(typeClient: TypeClient = "PERSONNE_MORALE"): ClientDraft {
  return {
    typeClient,
    conducteurHabituel: true,
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

type ClientOption = {
  value: string;
  label: string;
  keywords: string;
};

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
