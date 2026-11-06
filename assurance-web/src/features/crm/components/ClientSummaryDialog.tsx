import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, FolderOpen, Mail, MapPin, Pencil, Phone, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { clientApi } from "@/features/production/api/clients";
import type { ClientResponse } from "@/features/production/types";
import { permissionRequirementForPath, satisfiesPermissionRequirement } from "@/lib/authorization";
import { useAuthStore } from "@/store/auth-store";
import { ClientDocuments } from "./ClientDocuments";

export function ClientSummaryDialog({ clientId, onClose, onEdit }: {
  clientId: string;
  onClose: () => void;
  onEdit?: (client: ClientResponse) => void;
}) {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const query = useQuery({ queryKey: ["crm-client", clientId], queryFn: () => clientApi.getClientCrm(clientId) });
  const conditions = useQuery({
    queryKey: ["crm", "payment-conditions", "CLIENT", clientId],
    queryFn: () => clientApi.listPaymentConditions("CLIENT", clientId),
  });
  const detail = query.data;
  const client = detail?.client;
  const activeCondition = conditions.data?.find(condition => condition.statut === "ACTIVE");
  const HeaderIcon = client?.typeClient === "PERSONNE_MORALE" ? Building2 : UserRound;
  const canOpen = (path: string) => {
    const requirement = permissionRequirementForPath(path);
    return requirement && satisfiesPermissionRequirement(permissions, requirement);
  };
  const portfolio = `/app/production/portefeuille-clients/${clientId}`;
  const accounting = `/app/compta/releves-factures?payeurType=CLIENT&payeurId=${clientId}`;
  const claims = `/app/sinistre/dossiers?clientId=${clientId}`;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
      <DialogHeader className="shrink-0 border-b bg-blue-50/70 p-5 pr-12 text-left dark:bg-blue-950/25">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white"><HeaderIcon className="size-5" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1 space-y-2">
            <DialogTitle className="break-words text-xl leading-snug">{client?.nomAffichage || client?.raisonSociale || [client?.prenom, client?.nom].filter(Boolean).join(" ") || "Fiche client"}</DialogTitle>
            <DialogDescription asChild><div className="flex flex-wrap items-center gap-2">
              <span>{client?.codeClient || "Consultation du client"}</span>
              {client && <><Badge variant="outline" className="border-blue-200 bg-background text-blue-800 dark:border-blue-800 dark:text-blue-200">{client.typeClient === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique"}</Badge>
                <Badge variant={client.actif === false ? "gray" : "success"}>{client.actif === false ? "Inactif" : "Actif"}</Badge></>}
            </div></DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {query.isPending ? <div role="status" className="space-y-5"><span className="sr-only">Chargement du client...</span><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-24 w-full" /></div>
          : query.isError ? <div role="alert" className="space-y-3 text-sm"><p>{query.error instanceof Error ? query.error.message : "Chargement du client impossible."}</p><Button variant="outline" onClick={() => void query.refetch()}>Réessayer</Button></div>
            : client && detail && <div className="space-y-5">
              <nav aria-label="Espaces du client" className="flex flex-wrap items-center gap-2 border-b pb-4">
                {onEdit && <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => onEdit(client)}><Pencil className="size-4" />Modifier</Button>}
                {canOpen(portfolio) && <Button asChild size="sm" variant="outline"><Link to={portfolio}><FolderOpen className="size-4 text-emerald-700 dark:text-emerald-300" />Portefeuille ({detail.contrats.length})</Link></Button>}
                {canOpen(accounting) && <Button asChild size="sm" variant="outline"><Link to={accounting}><ReceiptText className="size-4 text-orange-700 dark:text-orange-300" />Relevés et factures</Link></Button>}
                {canOpen(claims) && <Button asChild size="sm" variant="outline"><Link to={claims}><ShieldCheck className="size-4 text-rose-700 dark:text-rose-300" />Sinistres</Link></Button>}
              </nav>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">Identité et coordonnées</h3>
                <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  {client.typeClient === "PERSONNE_MORALE" ? <>
                    <Info label="RC">{client.rc || "-"}</Info>
                    {client.ice && <Info label="ICE">{client.ice}</Info>}
                    {client.iff && <Info label="Identifiant fiscal">{client.iff}</Info>}
                    {client.cnss && <Info label="CNSS">{client.cnss}</Info>}
                  </> : <>
                    <Info label="CIN">{client.cin || "-"}</Info>
                    {client.passport && <Info label="Passeport">{client.passport}</Info>}
                    {client.carteResidence && <Info label="Carte de résidence">{client.carteResidence}</Info>}
                  </>}
                  <Info label="Téléphones" icon={<Phone className="size-4" />}>
                    {client.telephones?.length ? <ul className="space-y-1">{client.telephones.map((phone, index) => <li key={`${phone.numero}-${index}`}>
                      <a className="text-blue-700 underline-offset-4 hover:underline dark:text-blue-300" href={`tel:${phone.numero.replace(/\s/g, "")}`}>{phone.numero}</a>
                      {phone.principal && <span className="ml-2 text-xs text-muted-foreground">Principal</span>}
                      {phone.whatsapp && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-300">WhatsApp</span>}
                    </li>)}</ul> : client.telephone ? <a className="text-blue-700 underline-offset-4 hover:underline dark:text-blue-300" href={`tel:${client.telephone.replace(/\s/g, "")}`}>{client.telephone}</a> : "-"}
                  </Info>
                  {client.email && <Info label="E-mail" icon={<Mail className="size-4" />}><a className="break-all text-blue-700 underline-offset-4 hover:underline dark:text-blue-300" href={`mailto:${client.email}`}>{client.email}</a></Info>}
                  {(client.adresse || client.ville) && <div className="sm:col-span-2"><Info label="Adresse" icon={<MapPin className="size-4" />}>{[client.adresse, client.ville].filter(Boolean).join(", ")}</Info></div>}
                </dl>
              </section>
              <dl className="grid gap-4 border-y py-4 text-sm sm:grid-cols-2">
                <Info label="Organisation">{detail.groupes.length ? <ul className="space-y-1">{detail.groupes.map(group => <li key={group.id}>
                  <span className="font-medium">{group.libelle}</span><span className="ml-2 text-xs text-muted-foreground">{group.code}</span>
                </li>)}</ul> : client.groupe ? client.groupe.libelle : "Client indépendant"}</Info>
                <Info label="Condition de paiement">{conditions.isPending ? "Chargement..." : conditions.isError
                  ? <button type="button" className="text-destructive underline" onClick={() => void conditions.refetch()}>Réessayer</button>
                  : activeCondition ? `${activeCondition.delaiJours} jours` : "Aucune condition particulière"}</Info>
              </dl>
              {detail.acquisition && <section className="space-y-3 border-b pb-4">
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">Acquisition commerciale</h3>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <Info label="Origine">{detail.acquisition.origineLibelle || "-"}</Info>
                  {(detail.acquisition.recommandeParUtilisateurNom || detail.acquisition.recommandeParClientNom) && <Info label="Recommandé par">{detail.acquisition.recommandeParUtilisateurNom || detail.acquisition.recommandeParClientNom}</Info>}
                </dl>
              </section>}
              <ClientDocuments clientId={client.id} typeClient={client.typeClient} owner={client} />
            </div>}
      </div>
      <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-4">
        <Button variant="outline" onClick={onClose}>Fermer</Button>
        {client && <Button asChild variant="outline"><Link to={`/app/crm?clientId=${clientId}`} onClick={onClose}><ArrowUpRight className="size-4" />Ouvrir la fiche complète</Link></Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function Info({ label, children, icon }: { label: string; children: ReactNode; icon?: ReactNode }) {
  return <div className="min-w-0"><dt className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</dt><dd className="break-words">{children}</dd></div>;
}
