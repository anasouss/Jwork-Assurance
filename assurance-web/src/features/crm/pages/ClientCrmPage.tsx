import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  FileText,
  FolderOpen,
  History,
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
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { useAuthStore } from "@/store/auth-store";
import { productionApi } from "@/features/production/api";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "@/features/compta/api";
import type { ClientDocument } from "@/features/compta/types";
import type {
  ClientInput,
  ClientPage,
  ClientResponse,
  GroupeClient,
  RelationGroupeClient,
  TypeClient,
} from "@/features/production/types";

export default function ClientCrmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const agenceId = useAuthStore((state) => state.user?.agenceId ?? "");
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [groupeId, setGroupeId] = useState("TOUS");
  const [page, setPage] = useState(0);
  const selectedClientId = searchParams.get("clientId") ?? "";
  const activeTab = normalizePortfolioTab(searchParams.get("tab"));
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);

  const groupesQuery = useQuery({
    queryKey: ["groupes-clients"],
    queryFn: productionApi.listGroupesClients,
    staleTime: 60_000,
  });
  const clientsQuery = useQuery({
    queryKey: ["crm-clients", deferredQuery, groupeId, page],
    queryFn: () => productionApi.listClients({
      query: deferredQuery || undefined,
      groupeId: groupeId === "TOUS" ? undefined : groupeId,
      page,
      size: 25,
    }),
    placeholderData: (previous) => previous,
  });
  const detailQuery = useQuery({
    queryKey: ["crm-client", selectedClientId],
    queryFn: () => productionApi.getClientCrm(selectedClientId),
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
    setSearchParams({ clientId, tab: "overview" });
    setClientPickerOpen(false);
  };

  const changeTab = (tab: string) => {
    if (!selectedClientId) return;
    setSearchParams({ clientId: selectedClientId, tab });
  };

  return (
    <div className="min-w-0 space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">CRM</p>
          <h1 className="text-2xl font-semibold">Portefeuille client</h1>
          <p className="text-sm text-muted-foreground">Identité, organisation, contrats, documents et situation comptable.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setGroupDialogOpen(true)}>
            <Users className="size-4" />
            Nouveau groupe
          </Button>
          {selectedClientId ? (
            <Button type="button" variant="outline" onClick={() => setClientPickerOpen(true)}>
              <Search className="size-4" />
              Changer de client
            </Button>
          ) : null}
          <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setClientDialogOpen(true)}>
            <Plus className="size-4" />
            Nouveau client
          </Button>
        </div>
      </header>

      {!selectedClientId ? (
        <section className="mx-auto w-full max-w-5xl rounded-lg border bg-card">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">Rechercher un client</h2>
            <p className="text-sm text-muted-foreground">Sélectionnez le client dont vous souhaitez ouvrir le portefeuille.</p>
          </div>
          <ClientPicker
            query={query}
            onQueryChange={(value) => { setQuery(value); setPage(0); }}
            groupeId={groupeId}
            onGroupChange={(value) => { setGroupeId(value); setPage(0); }}
            groupes={groupesQuery.data ?? []}
            clients={clientsQuery.data?.items ?? []}
            loading={clientsQuery.isLoading}
            page={clientsQuery.data?.page}
            onPageChange={setPage}
            onSelect={selectClient}
          />
        </section>
      ) : detailQuery.isLoading ? (
        <PortfolioSkeleton />
      ) : detailQuery.data ? (
        <ClientDetail
          detail={detailQuery.data}
          activeTab={activeTab}
          onTabChange={changeTab}
          onAssignGroup={() => setAssignmentOpen(true)}
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
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>Changer de client</DialogTitle>
            <DialogDescription>Recherchez par nom, identifiant ou groupe.</DialogDescription>
          </DialogHeader>
          <ClientPicker
            query={query}
            onQueryChange={(value) => { setQuery(value); setPage(0); }}
            groupeId={groupeId}
            onGroupChange={(value) => { setGroupeId(value); setPage(0); }}
            groupes={groupesQuery.data ?? []}
            clients={clientsQuery.data?.items ?? []}
            loading={clientsQuery.isLoading}
            page={clientsQuery.data?.page}
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
        agenceId={agenceId}
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
  clients,
  loading,
  page,
  onPageChange,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  groupeId: string;
  onGroupChange: (value: string) => void;
  groupes: GroupeClient[];
  clients: ClientResponse[];
  loading: boolean;
  page?: ClientPage["page"];
  onPageChange: (page: number) => void;
  onSelect: (clientId: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="grid gap-3 border-b p-4 sm:grid-cols-[minmax(0,1fr)_260px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            className="pl-9"
            placeholder="Nom, code client, RC, CIN ou ICE"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <Select value={groupeId} onValueChange={onGroupChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les groupes</SelectItem>
            {groupes.map((groupe) => (
              <SelectItem key={groupe.id} value={groupe.id}>{groupe.code} - {groupe.libelle}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="max-h-[54vh] divide-y overflow-y-auto">
        {loading ? Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 p-4">
            <Skeleton className="size-10 rounded-md" />
            <div className="grid flex-1 gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64 max-w-full" /></div>
          </div>
        )) : null}
        {!loading && clients.map((client) => (
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
        {!loading && clients.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Aucun client trouvé.</div>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t p-3 text-sm">
        <span className="text-muted-foreground">{page?.totalElements ?? 0} client(s)</span>
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="outline" disabled={page?.first ?? true} onClick={() => onPageChange(Math.max((page?.number ?? 0) - 1, 0))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" disabled={page?.last ?? true} onClick={() => onPageChange((page?.number ?? 0) + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
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
  agenceId,
  groupes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agenceId: string;
  groupes: GroupeClient[];
  onSaved: (clientId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ClientDraft>(() => emptyClientDraft());
  const villesQuery = useQuery({
    queryKey: ["referentiel", "villes"],
    queryFn: () => productionApi.referentiel("villes"),
    staleTime: 60_000,
    enabled: open,
  });
  const categoriesQuery = useQuery({
    queryKey: ["referentiel", "categories-client"],
    queryFn: () => productionApi.referentiel("categories-client"),
    staleTime: 60_000,
    enabled: open,
  });
  const update = (patch: Partial<ClientDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const createMutation = useMutation({
    mutationFn: async () => {
      const client = await productionApi.createClient({
        agenceId,
        typeClient: draft.typeClient,
        civilite: clean(draft.civilite),
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
    agenceId
      && draft.villeId
      && draft.adresse?.trim()
      && draft.telephone?.trim()
      && (physical
        ? draft.civilite && draft.nom?.trim() && draft.prenom?.trim() && draft.cin?.trim() && draft.cinValidite
        : draft.raisonSociale?.trim() && draft.rc?.trim())
  );

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
              <Field label="Civilité" required>
                <Select value={draft.civilite ?? ""} onValueChange={(value) => update({ civilite: value })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monsieur">Monsieur</SelectItem>
                    <SelectItem value="madame">Madame</SelectItem>
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
        <DialogFooter>
          <Button type="button" variant="outline" disabled={createMutation.isPending} onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={!valid || createMutation.isPending}
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
  activeTab,
  onTabChange,
  onAssignGroup,
}: {
  detail: Awaited<ReturnType<typeof productionApi.getClientCrm>>;
  activeTab: PortfolioTab;
  onTabChange: (tab: string) => void;
  onAssignGroup: () => void;
}) {
  const client = detail.client;
  const documentsQuery = useQuery({
    queryKey: ["crm", "client-documents", client.id],
    queryFn: () => comptaApi.searchClientDocuments({
      payeurType: "CLIENT",
      payeurId: client.id,
      page: 0,
      size: 8,
    }),
    enabled: activeTab === "documents" || activeTab === "accounting",
  });
  const sourcesQuery = useQuery({
    queryKey: ["crm", "client-document-sources", client.id],
    queryFn: () => comptaApi.searchClientDocumentSources({
      payeurType: "CLIENT",
      payeurId: client.id,
      page: 0,
      size: 8,
    }),
    enabled: activeTab === "accounting",
  });
  const movements = detail.contrats.flatMap((contract) => contract.mouvements);
  const groupMembers = uniqueGroupMembers(detail.groupes, client.id);
  const accountingUrl = `/app/compta/releves-factures?payeurType=CLIENT&payeurId=${client.id}`;
  const productionUrl = `/app/production/contrats?clientId=${encodeURIComponent(client.id)}&client=${encodeURIComponent(
    client.codeClient || client.rc || client.cin || client.ice || client.nomAffichage || "",
  )}`;

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
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
          <Button asChild type="button" variant="outline" className="border-amber-200 text-amber-950 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-100 dark:hover:bg-amber-950/30">
            <Link to={accountingUrl}><ReceiptText className="size-4" />Relevés et factures</Link>
          </Button>
          <Button type="button" variant="outline" onClick={onAssignGroup} className="border-violet-200 text-violet-950 hover:bg-violet-50 dark:border-violet-900 dark:text-violet-100 dark:hover:bg-violet-950/30">
            <Users className="size-4" />Gérer le groupe
          </Button>
        </div>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Primes émises" value={money(detail.totalQuittances)} tone="emerald" />
        <Metric label="Solde non réglé" value={money(detail.totalImpayes)} alert={detail.totalImpayes > 0} tone="amber" />
        <Metric label="Contrats" value={String(detail.contrats.length)} tone="blue" />
        <Metric label="Mouvements" value={String(movements.length)} tone="violet" />
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <div className="overflow-x-auto border-y bg-slate-50/70 px-4 py-2 dark:bg-slate-950/30">
          <TabsList className="w-max min-w-full justify-start bg-transparent">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-950 dark:data-[state=active]:bg-blue-900/50 dark:data-[state=active]:text-blue-100"><Eye className="size-4" />Vue d’ensemble</TabsTrigger>
            <TabsTrigger value="contracts" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-950 dark:data-[state=active]:bg-emerald-900/50 dark:data-[state=active]:text-emerald-100"><FolderOpen className="size-4" />Contrats</TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-950 dark:data-[state=active]:bg-amber-900/50 dark:data-[state=active]:text-amber-100"><FileText className="size-4" />Documents</TabsTrigger>
            <TabsTrigger value="accounting" className="data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-950 dark:data-[state=active]:bg-cyan-900/50 dark:data-[state=active]:text-cyan-100"><CircleDollarSign className="size-4" />Comptabilité</TabsTrigger>
            <TabsTrigger value="claims" className="data-[state=active]:bg-slate-200 data-[state=active]:text-slate-950 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100"><ShieldCheck className="size-4" />Sinistres <Badge variant="secondary" className="ml-1">À venir</Badge></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="m-0 grid gap-5 p-5 lg:grid-cols-2">
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
          <PortfolioSection title="Organisation et groupe" icon={<Building2 className="size-4" />} tone="violet" action={<Button size="sm" variant="outline" onClick={onAssignGroup}>Modifier</Button>}>
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
          <PortfolioSection title="Entités liées" icon={<Building2 className="size-4" />} tone="emerald">
            {groupMembers.length ? (
              <div className="divide-y">
                {groupMembers.slice(0, 8).map((member) => (
                  <Link key={member.clientId} to={`/app/crm?clientId=${member.clientId}&tab=overview`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-blue-700">
                    <span><strong>{member.clientNom}</strong><span className="ml-2 text-muted-foreground">{label(member.typeRelation)}</span></span>
                    <ArrowRight className="size-4" />
                  </Link>
                ))}
              </div>
            ) : <EmptyState text="Aucune autre entité liée." />}
          </PortfolioSection>
          <PortfolioSection title="Accès rapides" icon={<ArrowRight className="size-4" />} tone="amber">
            <div className="grid gap-2 sm:grid-cols-2">
              <WorkspaceLink to={`/app/crm?clientId=${client.id}&tab=contracts`} icon={<FolderOpen className="size-4" />} title="Contrats et mouvements" detail={`${detail.contrats.length} contrat(s)`} tone="emerald" />
              <WorkspaceLink to={accountingUrl} icon={<ReceiptText className="size-4" />} title="Relevés et factures" detail="Espace comptable du payeur" tone="amber" />
            </div>
          </PortfolioSection>
        </TabsContent>

        <TabsContent value="contracts" className="m-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-semibold">Contrats et mouvements</h3><p className="text-sm text-muted-foreground">Historique de production associé à ce client comme assuré ou payeur.</p></div>
            <Button asChild variant="outline" size="sm" className="border-emerald-200 text-emerald-950 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-100 dark:hover:bg-emerald-950/30">
              <Link to={productionUrl}><FolderOpen className="size-4" />Ouvrir la liste production</Link>
            </Button>
          </div>
          <ContractsPortfolio contracts={detail.contrats} />
        </TabsContent>

        <TabsContent value="documents" className="m-0 grid gap-5 p-5 lg:grid-cols-[1.4fr_0.8fr]">
          <PortfolioSection title="Documents comptables émis" icon={<FileText className="size-4" />} tone="amber" action={<Button asChild size="sm" variant="outline"><Link to={accountingUrl}>Gérer les documents</Link></Button>}>
            <ClientDocuments rows={documentsQuery.data?.rows ?? []} loading={documentsQuery.isLoading} />
          </PortfolioSection>
          <PortfolioSection title="Pièces contractuelles" icon={<FolderOpen className="size-4" />} tone="blue">
            <p className="mb-3 text-sm text-muted-foreground">Les justificatifs restent rattachés à leur contrat et à leur mouvement d’origine.</p>
            <div className="divide-y">
              {detail.contrats.map((contract) => (
                <Link key={contract.id} to={`/app/production/contrats/${contract.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-blue-700">
                  <span><strong>{contract.numeroDossier || `#${contract.id}`}</strong><span className="ml-2 text-muted-foreground">{contract.numeroPolice || "Sans police"}</span></span>
                  <ArrowRight className="size-4" />
                </Link>
              ))}
            </div>
          </PortfolioSection>
        </TabsContent>

        <TabsContent value="accounting" className="m-0 grid gap-5 p-5">
          <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total émis" value={money(detail.totalQuittances)} tone="emerald" />
            <Metric label="Non réglé" value={money(detail.totalImpayes)} alert={detail.totalImpayes > 0} tone="amber" />
            <Metric label="À documenter" value={String(sourcesQuery.data?.page.totalElements ?? 0)} tone="blue" />
            <Metric label="Documents émis" value={String(documentsQuery.data?.page.totalElements ?? 0)} tone="violet" />
          </div>
          <PortfolioSection title="Situation comptable" icon={<CircleDollarSign className="size-4" />} tone="cyan" action={<Button asChild><Link to={accountingUrl}>Ouvrir l’espace comptable <ArrowRight className="size-4" /></Link></Button>}>
            <p className="text-sm text-muted-foreground">Les quittances validées, relevés, factures et crédits sont gérés dans l’espace comptable du payeur. Les montants affichés ici proviennent des quittances serveur.</p>
          </PortfolioSection>
        </TabsContent>

        <TabsContent value="claims" className="m-0 p-5">
          <div className="grid min-h-64 place-items-center rounded-md border border-dashed bg-muted/20 p-8 text-center">
            <div className="max-w-md"><ShieldCheck className="mx-auto size-9 text-muted-foreground" /><h3 className="mt-3 font-semibold">Espace sinistres à venir</h3><p className="mt-1 text-sm text-muted-foreground">Les déclarations, dossiers sinistres et indemnisations seront reliés à ce portefeuille lorsque le module Sinistres sera disponible.</p></div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

type PortfolioTab = "overview" | "contracts" | "documents" | "accounting" | "claims";

function normalizePortfolioTab(value: string | null): PortfolioTab {
  const tabs: PortfolioTab[] = ["overview", "contracts", "documents", "accounting", "claims"];
  return tabs.includes(value as PortfolioTab) ? value as PortfolioTab : "overview";
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
  tone: "emerald" | "amber";
}) {
  const styles = tone === "emerald"
    ? {
        link: "hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
        icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      }
    : {
        link: "hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30",
        icon: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      };
  return (
    <Link to={to} className={`flex min-w-0 items-center gap-3 rounded-md border p-3 transition-colors ${styles.link}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-md ${styles.icon}`}>{icon}</span>
      <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{title}</strong><span className="block truncate text-xs text-muted-foreground">{detail}</span></span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function ContractsPortfolio({ contracts }: {
  contracts: Awaited<ReturnType<typeof productionApi.getClientCrm>>["contrats"];
}) {
  if (!contracts.length) return <EmptyState text="Aucun contrat n’est associé à ce client." />;

  return (
    <div className="grid gap-4">
      {contracts.map((contract) => (
        <section key={contract.id} className="min-w-0 overflow-hidden rounded-md border border-blue-100 dark:border-blue-900">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/25">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"><FolderOpen className="size-4" /></span>
                <h4 className="text-base font-semibold">{contract.numeroDossier || `Contrat #${contract.id}`}</h4>
                <Badge variant="outline" className="border-blue-200 bg-white/70 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">{contractTypeLabel(contract.typeContrat)}</Badge>
                <StatusBadge status={contract.statut} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground"><strong className="font-medium text-foreground">{contract.numeroPolice || "Sans numéro de police"}</strong> · {contract.compagnie || "Compagnie non renseignée"}</p>
            </div>
            <Button asChild size="sm" variant="outline"><Link to={`/app/production/contrats/${contract.id}`}><Eye className="size-4" />Voir le contrat</Link></Button>
          </div>
          <dl className="grid gap-px border-b bg-border text-sm sm:grid-cols-2 lg:grid-cols-4">
            <ContractFact label="Période de couverture" value={`${dateLabel(contract.dateEffet)} au ${dateLabel(contract.dateEcheance)}`} tone="blue" />
            <ContractFact label="Rôle du client" value={contractRoleLabel(contract.roleClient)} tone="violet" />
            <ContractFact label="Mode de facturation" value={label(contract.modeFacturation)} tone="amber" />
            <ContractFact label="Total des quittances" value={money(contract.primeTotale)} tone="emerald" />
          </dl>
          <details className="group" open={contracts.length === 1}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-emerald-50/35 px-4 py-3 font-medium hover:bg-emerald-50/70 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/25">
              <span className="flex items-center gap-2 text-emerald-950 dark:text-emerald-100"><History className="size-4 text-emerald-700 dark:text-emerald-300" />Historique des mouvements <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-100">{contract.mouvements.length}</Badge></span>
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            {contract.mouvements.length ? (
              <div className="overflow-x-auto border-t">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600 dark:bg-slate-950/40 dark:text-slate-300"><tr><th className="w-20 px-4 py-2">Ordre</th><th className="px-4 py-2">Événement contractuel</th><th className="px-4 py-2">Date d’effet</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2 text-right">Impact financier</th><th className="w-14 px-4 py-2" /></tr></thead>
                  <tbody>{contract.mouvements.map((movement, index) => (
                    <tr key={movement.id} className="border-t first:border-t-0 hover:bg-muted/20">
                      <td className="px-4 py-3"><span className="inline-grid min-w-8 place-items-center rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{movement.numeroMouvement || "-"}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{movement.libelle || label(movement.categorie)}</span>
                          {index === 0 ? <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">Dernier mouvement</Badge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{movement.code || label(movement.categorie)}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{dateLabel(movement.dateEffet)}</td>
                      <td className="px-4 py-3"><StatusBadge status={movement.statut} /></td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${financialImpactClass(movement.primeTotale)}`}>{money(movement.primeTotale)}</td>
                      <td className="px-4 py-2"><Button asChild size="icon" variant="ghost" title="Voir ce mouvement"><Link aria-label={`Voir le mouvement ${movement.numeroMouvement || ""}`} to={`/app/production/contrats/${contract.id}?mouvementId=${movement.id}`}><Eye className="size-4" /></Link></Button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="border-t p-5 text-sm text-muted-foreground">Aucun mouvement enregistré.</div>}
          </details>
        </section>
      ))}
    </div>
  );
}

type ContractFactTone = "blue" | "violet" | "amber" | "emerald";

function ContractFact({ label: factLabel, value, tone }: { label: string; value: string; tone: ContractFactTone }) {
  const styles: Record<ContractFactTone, string> = {
    blue: "bg-blue-50/35 dark:bg-blue-950/15",
    violet: "bg-violet-50/35 dark:bg-violet-950/15",
    amber: "bg-amber-50/35 dark:bg-amber-950/15",
    emerald: "bg-emerald-50/35 dark:bg-emerald-950/15",
  };
  return <div className={`px-4 py-3 ${styles[tone]}`}><dt className="text-xs text-muted-foreground">{factLabel}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = status?.toUpperCase() ?? "";
  const className = normalized.includes("ANNU") || normalized.includes("RESIL")
    ? "bg-red-100 text-red-800 hover:bg-red-100"
    : normalized.includes("VALID") || normalized.includes("ACTIF")
      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
      : "bg-slate-100 text-slate-700 hover:bg-slate-100";
  return <Badge className={className}>{statusLabel(status)}</Badge>;
}

function contractTypeLabel(type?: string | null) {
  return type === "PARTICULIER" ? "Mono" : label(type);
}

function contractRoleLabel(role?: string | null) {
  if (!role) return "-";
  return role.split(",").map((value) => label(value.trim())).join(", ");
}

function financialImpactClass(value?: number | null) {
  if ((value ?? 0) < 0) return "text-red-700 dark:text-red-400";
  if ((value ?? 0) > 0) return "text-emerald-700 dark:text-emerald-400";
  return "text-muted-foreground";
}

function statusLabel(status?: string | null) {
  const normalized = status?.toUpperCase() ?? "";
  if (normalized.includes("CANCEL") || normalized.includes("RESIL")) return "Résilié";
  if (normalized.includes("VALID")) return "Validé";
  if (normalized.includes("ACTIF")) return "Actif";
  if (normalized.includes("DRAFT") || normalized.includes("BROUILLON")) return "Brouillon";
  return label(status);
}

function ClientDocuments({ rows, loading }: { rows: ClientDocument[]; loading: boolean }) {
  if (loading) return <div className="grid gap-2">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-11" />)}</div>;
  if (!rows.length) return <EmptyState text="Aucun relevé ou facture n’a encore été émis pour ce client." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="border-b bg-muted/35 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Document</th><th className="px-3 py-2">Émission</th><th className="px-3 py-2">Période</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
        <tbody>{rows.map((document) => (
          <tr key={document.id} className="border-b last:border-0">
            <td className="px-3 py-3"><div className="font-medium">{document.numero}</div><div className="text-xs text-muted-foreground">{label(document.typeDocument)}</div></td>
            <td className="whitespace-nowrap px-3 py-3">{dateLabel(document.dateEmission)}</td>
            <td className="whitespace-nowrap px-3 py-3">{dateLabel(document.periodeDebut)} au {dateLabel(document.periodeFin)}</td>
            <td className="px-3 py-3"><StatusBadge status={document.statut} /></td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-medium">{money(document.totalDocument)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
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
    queryFn: () => productionApi.listClients({ query: deferredSearch, size: 25 }),
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
    mutationFn: productionApi.createGroupeClient,
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
          await productionApi.endClientGroup(clientId, membershipId);
        }
        return;
      }
      await productionApi.assignClientGroup(clientId, {
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
    sahara: false,
  };
}

function clean(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function Field({
  label: fieldLabel,
  children,
  required = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">
        {fieldLabel}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function money(value?: number | null) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(value ?? 0);
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

function principalMembershipId(detail?: Awaited<ReturnType<typeof productionApi.getClientCrm>>) {
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
