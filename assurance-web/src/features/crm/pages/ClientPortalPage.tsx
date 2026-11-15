import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Eye, FileText, KeyRound, Plus, Share2, ShieldCheck, Smartphone, UserCheck, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableRowActions } from "@/components/shared/table-row-actions";
import { clientApi } from "@/features/production/api/clients";
import { formatDocumentDate } from "@/features/production/utils/format";
import type { ClientResponse } from "@/features/production/types";
import { portalApi, portalKeys, useClientPortalAvailability, type PortalAccount, type PortalAccess } from "../client-portal-api";
import { PortalConfirm, PortalFeedback, PortalPager, PortalPasswordDialog } from "../components/ClientPortalControls";
import { ClientPortalShareDialog } from "../components/ClientPortalShareDialog";
import { ClientPortalPublications } from "../components/ClientPortalPublications";

export default function ClientPortalPage() {
  const { clientId = "" } = useParams();
  const user = useAuthStore(state => state.user);
  const agency = user?.agenceId ?? "";
  const allowed = user?.permissions.includes("client-portal-account:view") ?? false;
  const availability = useClientPortalAvailability();
  const enabled = allowed && Boolean(agency && availability.data?.enabled) && !availability.isError;
  const client = useQuery({
    queryKey: ["crm-client", clientId], queryFn: () => clientApi.getClientCrm(clientId),
    enabled: enabled && Boolean(clientId),
  });
  const account = useQuery({
    queryKey: portalKeys.account(agency, clientId), queryFn: () => portalApi.account(clientId),
    enabled: enabled && Boolean(clientId),
  });
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const changed = async () => { await queryClient.invalidateQueries({ queryKey: portalKeys.root(agency) }); };
  const back = <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
    <Link to={`/app/crm?clientId=${encodeURIComponent(clientId)}`}><ArrowLeft className="size-4" />Fiche client</Link>
  </Button>;

  if (!allowed || !agency) return <div className="space-y-4 p-4 md:p-6">{back}<p role="alert">Accès non autorisé.</p></div>;
  if (availability.isPending || availability.isError) return <div className="space-y-4 p-4 md:p-6">{back}
    <PortalFeedback pending={availability.isPending} error={availability.error} retry={() => void availability.refetch()} /></div>;
  if (!enabled) return <div className="space-y-4 p-4 md:p-6">{back}<h1 className="text-xl font-semibold">Portail client indisponible</h1></div>;

  const clientData = client.data?.client;
  return <div className="min-w-0 space-y-5 p-4 md:p-6">
    {back}
    <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
      <div className="min-w-0"><h1 className="text-2xl font-semibold">Portail client</h1>
        <p className="mt-1 break-words text-sm text-muted-foreground">{clientData?.nomAffichage || clientData?.raisonSociale || "-"}
          {clientData?.codeClient ? ` · ${clientData.codeClient}` : ""}</p></div>
      {clientData?.actif === false && <Badge variant="gray">Client inactif</Badge>}
    </header>
    <PortalFeedback pending={client.isPending || account.isPending} error={client.error || account.error}
      retry={() => { void client.refetch(); void account.refetch(); }} />
    {!client.isPending && !account.isPending && !client.isError && !account.isError && clientData && <>
      {account.data ? <AccountWorkspace key={account.data.id} agency={agency} account={account.data} client={clientData} onChanged={changed} />
        : <section className="grid justify-items-start gap-4 border-b py-6">
          <div className="flex items-center gap-3"><Smartphone className="size-5 text-muted-foreground" /><h2 className="text-base font-semibold">Aucun compte client</h2></div>
          {user?.permissions.includes("client-portal-account:create") && <Button disabled={clientData.actif === false} onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />Créer le compte client
          </Button>}
        </section>}
      {createOpen && <PortalPasswordDialog client={clientData} onClose={() => setCreateOpen(false)} onChanged={changed} />}
    </>}
  </div>;
}

type Confirmation = { kind: "active"; active: boolean } | { kind: "access"; access: PortalAccess };

function AccountWorkspace({ agency, account, client, onChanged }: {
  agency: string; account: PortalAccount; client: ClientResponse; onChanged: () => Promise<void>;
}) {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const [page, setPage] = useState(0);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const publicationsRef = useRef<HTMLDivElement>(null);
  const accesses = useQuery({
    queryKey: portalKeys.accesses(agency, account.id, page), queryFn: () => portalApi.accesses(account.id, page),
  });
  const selected = accesses.data?.items.find(access => access.id === selectedId);
  const canShare = permissions.includes("client-portal-account:assign") && (permissions.includes("contrat:view") || permissions.includes("sinistre:view"));
  const action = useMutation({
    mutationFn: async () => {
      if (!confirmation) throw new Error("Action non sélectionnée.");
      if (confirmation.kind === "active") await portalApi.active(account.id, confirmation.active);
      else await portalApi.revoke(confirmation.access.id);
    },
    onSuccess: async () => { setConfirmation(null); toast.success("Accès mis à jour"); await onChanged(); },
  });
  return <>
    <section className="space-y-4 border-b pb-5">
      <header className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Compte client</h2>
        <TableRowActions label="Actions du compte client" actions={[
          { label: "Réinitialiser le mot de passe", permission: "client-portal-account:reset-password", icon: KeyRound,
            onSelect: () => setPasswordOpen(true), disabled: action.isPending },
          { label: account.actif ? "Désactiver le compte" : "Réactiver le compte", permission: "client-portal-account:deactivate",
            icon: account.actif ? Ban : UserCheck, destructive: account.actif, disabled: action.isPending,
            onSelect: () => { action.reset(); setConfirmation({ kind: "active", active: !account.actif }); } },
        ]} />
      </header>
      <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0"><dt className="mb-1 text-muted-foreground">Identifiant CIN / RC</dt><dd className="break-all font-medium">{account.identifiant}</dd></div>
        <div><dt className="mb-1 text-muted-foreground">Compte</dt><dd><Badge variant={account.actif ? "success" : "gray"}>{account.actif ? "Actif" : "Désactivé"}</Badge></dd></div>
        <div><dt className="mb-1 text-muted-foreground">Mot de passe</dt><dd>{account.passwordChangeRequired ? <Badge variant="warning">À changer</Badge> : "Personnel"}</dd></div>
        <div><dt className="mb-1 text-muted-foreground">Dernière connexion</dt><dd>{account.lastLoginAt ? formatDocumentDate(account.lastLoginAt) : "Aucune"}</dd></div>
      </dl>
    </section>
    <section className="min-w-0 space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Dossiers partagés</h2>
        {canShare && <Button size="sm" onClick={() => setShareOpen(true)}><Share2 className="size-4" />Partager un dossier</Button>}
      </header>
      <div className="overflow-hidden rounded-md border">
        <PortalFeedback pending={accesses.isPending} error={accesses.error} retry={() => void accesses.refetch()} />
        {!accesses.isPending && !accesses.isError && <>
          <Table className="min-w-[680px]">
            <TableHeader><TableRow><TableHead className="w-28">Type</TableHead><TableHead>Dossier / police</TableHead>
              <TableHead>Date de début</TableHead><TableHead>Date de fin</TableHead><TableHead>Accès</TableHead><TableHead className="w-16 text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{accesses.data?.items.map(access => {
              const Icon = access.sinistreId ? ShieldCheck : FileText;
              return <TableRow key={access.id} data-state={selectedId === access.id ? "selected" : undefined}>
                <TableCell><span className="inline-flex items-center gap-2"><Icon className="size-4 shrink-0 text-muted-foreground" />{access.sinistreId ? "Sinistre" : "Contrat"}</span></TableCell>
                <TableCell className="min-w-40"><p className="font-medium">{access.reference || "-"}</p><p className="text-xs text-muted-foreground">{access.numeroPolice || "-"}</p></TableCell>
                <TableCell className="whitespace-nowrap">{formatDocumentDate(access.dateDebut)}</TableCell><TableCell className="whitespace-nowrap">{formatDocumentDate(access.dateFin)}</TableCell>
                <TableCell><Badge variant={access.actif ? "success" : "gray"}>{access.actif ? "Partagé" : "Retiré"}</Badge></TableCell>
                <TableCell className="text-right"><TableRowActions actions={[
                  { label: "Publications", permission: "client-portal-publication:view", icon: Eye, onSelect: () => {
                    setSelectedId(access.id);
                    window.setTimeout(() => publicationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                  } },
                  ...(access.actif ? [{ label: "Retirer l'accès", permission: "client-portal-account:assign", icon: X, destructive: true,
                    disabled: action.isPending, onSelect: () => { action.reset(); setConfirmation({ kind: "access", access }); } }] : []),
                ]} /></TableCell>
              </TableRow>;
            })}
            {!accesses.data?.items.length && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Aucun dossier partagé.</TableCell></TableRow>}
            </TableBody>
          </Table>
          <PortalPager metadata={accesses.data?.page} pending={accesses.isFetching} onChange={next => { setPage(next); setSelectedId(""); }} />
        </>}
      </div>
    </section>
    {selected && permissions.includes("client-portal-publication:view") && <div ref={publicationsRef} className="scroll-mt-20">
      <ClientPortalPublications key={selected.id} agency={agency} access={selected} onClose={() => setSelectedId("")} onChanged={onChanged} />
    </div>}
    {passwordOpen && <PortalPasswordDialog client={client} account={account} onClose={() => setPasswordOpen(false)} onChanged={onChanged} />}
    {shareOpen && <ClientPortalShareDialog agency={agency} account={account} onClose={() => setShareOpen(false)} onChanged={onChanged} />}
    {confirmation && <PortalConfirm
      title={confirmation.kind === "access" ? "Retirer l'accès au dossier ?" : confirmation.active ? "Réactiver ce compte ?" : "Désactiver ce compte ?"}
      description={confirmation.kind === "access" ? confirmation.access.reference || confirmation.access.numeroPolice || "Dossier sélectionné"
        : confirmation.active ? account.clientNom : `Les sessions de ${account.clientNom} seront révoquées.`}
      pending={action.isPending} error={action.error} destructive={confirmation.kind === "access" || !confirmation.active}
      onClose={() => setConfirmation(null)} onConfirm={() => action.mutate()} />}
  </>;
}
