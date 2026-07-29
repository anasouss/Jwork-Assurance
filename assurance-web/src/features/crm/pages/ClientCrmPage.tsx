import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronLeft, ChevronRight, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
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
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { productionApi } from "@/features/production/api";
import type { ClientResponse, GroupeClient, RelationGroupeClient } from "@/features/production/types";

export default function ClientCrmPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [groupeId, setGroupeId] = useState("TOUS");
  const [page, setPage] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState("");
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

  return (
    <div className="min-w-0 space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">CRM</p>
          <h1 className="text-2xl font-semibold">Fiche client</h1>
          <p className="text-sm text-muted-foreground">Portefeuille, groupes et situation contractuelle.</p>
        </div>
        <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setGroupDialogOpen(true)}>
          <Plus className="size-4" />
          Nouveau groupe
        </Button>
      </header>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,2.1fr)]">
        <div className="min-w-0 rounded-lg border bg-card">
          <div className="grid gap-3 border-b p-3 sm:grid-cols-[1fr_220px] xl:grid-cols-1">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                className="pl-9"
                placeholder="Nom, RC, CIN, ICE ou code"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            <Select
              value={groupeId}
              onValueChange={(value) => {
                setGroupeId(value);
                setPage(0);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TOUS">Tous les groupes</SelectItem>
                {(groupesQuery.data ?? []).map((groupe) => (
                  <SelectItem key={groupe.id} value={groupe.id}>{groupe.code} - {groupe.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="divide-y">
            {(clientsQuery.data?.items ?? []).map((client) => (
              <button
                key={client.id}
                type="button"
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30 ${
                  selectedClientId === client.id ? "bg-blue-50 dark:bg-blue-950/30" : ""
                }`}
                onClick={() => setSelectedClientId(client.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{client.nomAffichage || client.raisonSociale || client.nom}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {client.codeClient || "Sans code"} · {client.rc || client.cin || client.ice || "Identifiant non renseigné"}
                    </div>
                  </div>
                  {client.groupe ? <Badge variant="secondary">{client.groupe.code}</Badge> : null}
                </div>
              </button>
            ))}
            {!clientsQuery.isLoading && (clientsQuery.data?.items.length ?? 0) === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Aucun client trouvé.</div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t p-3 text-sm">
            <span className="text-muted-foreground">{clientsQuery.data?.page.totalElements ?? 0} client(s)</span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={clientsQuery.data?.page.first ?? true}
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={clientsQuery.data?.page.last ?? true}
                onClick={() => setPage((current) => current + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border bg-card">
          {detailQuery.data ? (
            <ClientDetail
              detail={detailQuery.data}
              onAssignGroup={() => setAssignmentOpen(true)}
            />
          ) : (
            <div className="grid min-h-80 place-items-center p-6 text-center text-sm text-muted-foreground">
              Sélectionnez un client pour ouvrir sa fiche.
            </div>
          )}
        </div>
      </section>

      <GroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        onSaved={refreshCrm}
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

function ClientDetail({
  detail,
  onAssignGroup,
}: {
  detail: Awaited<ReturnType<typeof productionApi.getClientCrm>>;
  onAssignGroup: () => void;
}) {
  const client = detail.client;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{client.nomAffichage || client.raisonSociale || client.nom}</h2>
            <Badge variant="outline">{client.typeClient === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[client.codeClient, client.rc || client.cin, client.ice].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onAssignGroup}>
          <Users className="size-4" />
          Gérer le groupe
        </Button>
      </div>

      <div className="grid gap-px border-b bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Primes émises" value={money(detail.totalQuittances)} />
        <Metric label="Solde non réglé" value={money(detail.totalImpayes)} alert={detail.totalImpayes > 0} />
        <Metric label="Contrats" value={String(detail.contrats.length)} />
        <Metric label="Groupe principal" value={client.groupe?.libelle ?? "Indépendant"} />
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1.2fr]">
        <section className="min-w-0">
          <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Coordonnées</h3>
          <dl className="grid gap-2 text-sm">
            <Info label="Adresse" value={[client.adresse, client.ville].filter(Boolean).join(", ")} />
            <Info label="Téléphone" value={client.telephone} />
            <Info label="Email" value={client.email} />
            <Info label="Catégorie" value={client.categorieClientLibelle} />
          </dl>
        </section>
        <section className="min-w-0">
          <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Groupes actifs</h3>
          <div className="grid gap-2">
            {detail.groupes.map((groupe) => (
              <div key={groupe.id} className="rounded-md border p-3">
                <div className="flex items-center gap-2 font-medium">
                  <Building2 className="size-4 text-blue-600" />
                  {groupe.code} - {groupe.libelle}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Trésorerie : {groupe.clientTresorerieNom || "Non définie"} · {groupe.facturationConsolideeDefaut ? "Consolidée" : "Directe"}
                </div>
              </div>
            ))}
            {detail.groupes.length === 0 ? <p className="text-sm text-muted-foreground">Aucun rattachement actif.</p> : null}
          </div>
        </section>
      </div>

      <section className="min-w-0 border-t p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Contrats et facturation</h3>
        <div className="max-w-full overflow-x-auto rounded-md border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/70 text-left">
              <tr>
                <th className="px-3 py-2">Dossier</th>
                <th className="px-3 py-2">Police</th>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2">Rôle</th>
                <th className="px-3 py-2">Payeur</th>
                <th className="px-3 py-2">Facturation</th>
                <th className="px-3 py-2 text-right">Prime</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {detail.contrats.map((contrat) => (
                <tr key={contrat.id}>
                  <td className="px-3 py-2 font-medium">
                    <Link className="text-blue-700 hover:underline" to={`/app/production/contrats/${contrat.id}`}>
                      {contrat.numeroDossier || `#${contrat.id}`}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{contrat.numeroPolice || "-"}</td>
                  <td className="px-3 py-2">{label(contrat.typeContrat)}</td>
                  <td className="px-3 py-2">{label(contrat.roleClient)}</td>
                  <td className="px-3 py-2">{contrat.payeurPrimeNom || label(contrat.typePayeurPrime)}</td>
                  <td className="px-3 py-2">{label(contrat.modeFacturation)}</td>
                  <td className="px-3 py-2 text-right font-medium">{money(contrat.primeTotale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
          <DialogDescription>Définissez la structure juridique et la trésorerie responsable.</DialogDescription>
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
          <Field label="Trésorerie">
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

function Metric({ label: metricLabel, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-card p-4">
      <div className="text-xs font-medium uppercase text-muted-foreground">{metricLabel}</div>
      <div className={`mt-1 text-lg font-semibold ${alert ? "text-red-600" : ""}`}>{value}</div>
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

function Field({ label: fieldLabel, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{fieldLabel}</span>
      {children}
    </label>
  );
}

function money(value?: number | null) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(value ?? 0);
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
