import type { ReactNode } from "react";
import { Building2, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { TypeClient } from "@/features/production/types";

export type ClientDetails = {
  id: string;
  nom: string;
  code?: string | null;
  typeClient?: TypeClient | null;
  cin?: string | null;
  passport?: string | null;
  carteResidence?: string | null;
  rc?: string | null;
  ice?: string | null;
  iff?: string | null;
  patente?: string | null;
  adresse?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email?: string | null;
};

type ClientDetailsDialogProps = {
  name: string;
  data?: { groupe?: string | null; clients: ClientDetails[] };
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onClose: () => void;
};

export function ClientDetailsDialog({ name, data, loading, error, onRetry, onClose }: ClientDetailsDialogProps) {
  const singleClient = data?.clients.length === 1 ? data.clients[0] : undefined;
  const HeaderIcon = singleClient?.typeClient === "PERSONNE_MORALE" ? Building2 : UserRound;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
    <DialogHeader className="shrink-0 border-b bg-emerald-50/70 p-5 pr-12 text-left dark:bg-emerald-950/20">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white"><HeaderIcon className="size-5" /></div>
        <div className="min-w-0 space-y-1">
          <DialogTitle>Fiche client</DialogTitle>
          <DialogDescription className="break-words text-emerald-800 dark:text-emerald-200">{singleClient?.nom || name}</DialogDescription>
        </div>
      </div>
    </DialogHeader>
    <div className="min-h-0 overflow-y-auto p-5">
      {loading ? <div role="status" className="space-y-5">
        <span className="sr-only">Chargement de la fiche client...</span>
        <Skeleton className="h-5 w-32" /><div className="grid grid-cols-2 gap-4"><Skeleton className="h-12" /><Skeleton className="h-12" /></div><Skeleton className="h-20 w-full" />
      </div> : error ? <div role="alert" className="space-y-3 text-sm"><p>{error}</p><Button variant="outline" onClick={onRetry}>Réessayer</Button></div> : <div className="space-y-5">
        {data?.groupe && <p className="break-words text-sm"><span className="text-muted-foreground">Groupe : </span>{data.groupe}</p>}
        {data?.clients.map(client => <section key={client.id} className="space-y-5 border-b pb-5 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              {!singleClient && <h3 className="break-words font-semibold">{client.nom}</h3>}
              <p className="text-xs text-muted-foreground">Code client : <span className="font-medium text-foreground">{client.code || "-"}</span></p>
            </div>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{client.typeClient === "PERSONNE_PHYSIQUE" ? "Personne physique" : client.typeClient === "PERSONNE_MORALE" ? "Personne morale" : "Type non renseigné"}</Badge>
          </div>
          {(client.typeClient === "PERSONNE_PHYSIQUE" || client.typeClient === "PERSONNE_MORALE") && <div className="space-y-3">
            <h4 className="text-sm font-semibold">Identité</h4>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {client.typeClient === "PERSONNE_PHYSIQUE" ? <>
                <Info label="CIN">{client.cin || "-"}</Info>
                {client.passport && <Info label="Passeport">{client.passport}</Info>}
                {client.carteResidence && <Info label="Carte de résidence">{client.carteResidence}</Info>}
              </> : <>
                <Info label="RC">{client.rc || "-"}</Info><Info label="ICE">{client.ice || "-"}</Info>
                {client.iff && <Info label="IF">{client.iff}</Info>}
                {client.patente && <Info label="Taxe professionnelle">{client.patente}</Info>}
              </>}
            </dl>
          </div>}
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-semibold">Coordonnées</h4>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <div className="flex min-w-0 gap-3 sm:col-span-2">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <Info label="Adresse">{[client.adresse?.trim(), client.ville?.trim()].filter(Boolean).join(", ") || "-"}</Info>
              </div>
              <div className="flex min-w-0 gap-3">
                <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <Info label="Téléphone">{client.telephone ? <a href={`tel:${client.telephone.replace(/\s/g, "")}`} className="font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:underline dark:text-blue-300">{client.telephone}</a> : "-"}</Info>
              </div>
              <div className="flex min-w-0 gap-3">
                <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <Info label="E-mail">{client.email ? <a href={`mailto:${client.email}`} className="break-all font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:underline dark:text-blue-300">{client.email}</a> : "-"}</Info>
              </div>
            </dl>
          </div>
        </section>)}
        {!data?.clients.length && <p className="py-4 text-sm text-muted-foreground">Aucune fiche client rattachée à ce payeur.</p>}
      </div>}
    </div>
    <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-4"><Button variant="outline" onClick={onClose}>Fermer</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex min-w-0 items-baseline gap-2"><dt className="shrink-0 text-muted-foreground">{label} :</dt><dd className="min-w-0 break-words font-medium">{children}</dd></div>;
}
