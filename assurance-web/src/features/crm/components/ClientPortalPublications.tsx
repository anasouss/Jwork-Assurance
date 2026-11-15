import { useId, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Loader2, MessageSquare, Plus, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableRowActions } from "@/components/shared/table-row-actions";
import { formatDocumentDate } from "@/features/production/utils/format";
import { portalApi, portalKeys, type PortalAccess, type PortalPublication } from "../client-portal-api";
import { PortalConfirm, PortalFeedback, PortalField, PortalPager } from "./ClientPortalControls";

type PublicationKind = "documents" | "updates";

export function ClientPortalPublications({ agency, access, onClose, onChanged }: {
  agency: string; access: PortalAccess; onClose: () => void; onChanged: () => Promise<void>;
}) {
  return <section className="min-w-0 space-y-4 border-t pt-5">
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="text-lg font-semibold">Publications</h2>
        <p className="break-words text-sm text-muted-foreground">{access.reference || access.numeroPolice || "-"}
          {!access.actif && " · Accès retiré"}</p></div>
      <Button variant="ghost" size="icon-sm" title="Fermer les publications" aria-label="Fermer les publications" onClick={onClose}><X className="size-4" /></Button>
    </header>
    {access.sinistreId ? <Tabs defaultValue="documents">
      <TabsList><TabsTrigger value="documents"><FileText className="size-4" />Documents</TabsTrigger>
        <TabsTrigger value="updates"><MessageSquare className="size-4" />Suivi client</TabsTrigger></TabsList>
      <TabsContent value="documents"><PublicationList agency={agency} access={access} kind="documents" onChanged={onChanged} /></TabsContent>
      <TabsContent value="updates"><PublicationList agency={agency} access={access} kind="updates" onChanged={onChanged} /></TabsContent>
    </Tabs> : <PublicationList agency={agency} access={access} kind="documents" onChanged={onChanged} />}
  </section>;
}

function PublicationList({ agency, access, kind, onChanged }: {
  agency: string; access: PortalAccess; kind: PublicationKind; onChanged: () => Promise<void>;
}) {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canReadSource = permissions.includes(access.sinistreId ? "sinistre:view" : "contrat:view");
  const canPublish = access.actif && canReadSource && permissions.includes("client-portal-publication:create");
  const [page, setPage] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [withdrawn, setWithdrawn] = useState<PortalPublication | null>(null);
  const publications = useQuery({
    queryKey: portalKeys.publications(agency, access.id, kind, page),
    queryFn: () => portalApi.publications(access.id, kind, page),
  });
  const withdraw = useMutation({
    mutationFn: async () => {
      if (!withdrawn) throw new Error("Publication non sélectionnée.");
      await portalApi.withdraw(withdrawn.id, kind);
    },
    onSuccess: async () => { setWithdrawn(null); toast.success("Publication retirée"); await onChanged(); },
  });
  return <div className="grid gap-3 pt-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{kind === "documents" ? "Documents du portail" : "Messages destinés au client"}</h3>
      {canPublish && <Button size="sm" onClick={() => setPublishOpen(true)}><Plus className="size-4" />
        {kind === "documents" ? "Publier un document" : "Publier un suivi"}</Button>}
    </div>
    <div className="overflow-hidden rounded-md border">
      <PortalFeedback pending={publications.isPending} error={publications.error} retry={() => void publications.refetch()} />
      {!publications.isPending && !publications.isError && <>
        <Table className="min-w-[540px]">
          <TableHeader><TableRow><TableHead>{kind === "documents" ? "Document" : "Message"}</TableHead>
            <TableHead className="w-32">Date</TableHead><TableHead className="w-28">Statut</TableHead><TableHead className="w-16 text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{publications.data?.items.map(publication => <TableRow key={publication.id}>
            <TableCell className="min-w-48 max-w-xl"><p className="break-words font-medium">{publication.titre}</p>
              {publication.message && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{publication.message}</p>}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDocumentDate(publication.createdAt)}</TableCell>
            <TableCell><Badge variant={publication.published ? "success" : "gray"}>{publication.published ? "Publié" : "Retiré"}</Badge></TableCell>
            <TableCell className="text-right">{publication.published && <TableRowActions actions={[{
              label: "Retirer du portail", permission: "client-portal-publication:deactivate", icon: X, destructive: true,
              onSelect: () => { withdraw.reset(); setWithdrawn(publication); }, disabled: withdraw.isPending,
            }]} />}</TableCell>
          </TableRow>)}
          {!publications.data?.items.length && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Aucune publication.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <PortalPager metadata={publications.data?.page} pending={publications.isFetching}
          onChange={setPage} />
      </>}
    </div>
    {publishOpen && <PublishDialog agency={agency} access={access} kind={kind} onClose={() => setPublishOpen(false)} onChanged={onChanged} />}
    {withdrawn && <PortalConfirm title="Retirer cette publication ?" description={withdrawn.titre}
      pending={withdraw.isPending} error={withdraw.error} onClose={() => setWithdrawn(null)} onConfirm={() => withdraw.mutate()} />}
  </div>;
}

function PublishDialog({ agency, access, kind, onClose, onChanged }: {
  agency: string; access: PortalAccess; kind: PublicationKind; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const uid = useId();
  const [page, setPage] = useState(0);
  const [source, setSource] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const sources = useQuery({
    queryKey: portalKeys.sources(agency, access.id, page),
    queryFn: () => portalApi.sources(access.id, page),
    enabled: kind === "documents",
  });
  const publish = useMutation({
    mutationFn: () => kind === "documents"
      ? portalApi.publishDocument(access, source, title.trim())
      : portalApi.publishUpdate(access.id, title.trim(), message.trim()),
    onSuccess: async () => { onClose(); toast.success("Publication enregistrée"); await onChanged(); },
  });
  return <Dialog open onOpenChange={open => { if (!open && !publish.isPending) onClose(); }}>
    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{kind === "documents" ? "Publier un document" : "Publier un suivi"}</DialogTitle>
        <DialogDescription>{access.reference || access.numeroPolice || "Dossier sélectionné"}</DialogDescription></DialogHeader>
      <form className="grid gap-4" onSubmit={event => { event.preventDefault(); publish.mutate(); }}>
        {kind === "documents" && <div className="grid gap-2">
          <PortalFeedback pending={sources.isPending} error={sources.error} retry={() => void sources.refetch()} />
          {!sources.isPending && !sources.isError && <>
            <PortalField id={uid + "-source"} label="Document du dossier" required>
              <Select value={source} disabled={publish.isPending} onValueChange={value => {
                setSource(value);
                if (!title.trim()) setTitle(sources.data?.items.find(item => item.id === value)?.nomFichier ?? "");
              }}>
                <SelectTrigger id={uid + "-source"}><SelectValue placeholder="Sélectionner un document" /></SelectTrigger>
                <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                  {sources.data?.items.map(item => <SelectItem key={item.id} value={item.id} className="break-all whitespace-normal">{item.nomFichier}</SelectItem>)}
                </SelectContent>
              </Select>
            </PortalField>
            {!sources.data?.items.length && <p className="text-sm text-muted-foreground">Aucun document disponible dans ce dossier.</p>}
            <PortalPager metadata={sources.data?.page} pending={sources.isFetching || publish.isPending}
              onChange={next => { setPage(next); setSource(""); }} />
          </>}
        </div>}
        <PortalField id={uid + "-title"} label="Titre visible par le client" required>
          <Input id={uid + "-title"} value={title} required maxLength={180} disabled={publish.isPending} onChange={e => setTitle(e.target.value)} />
        </PortalField>
        {kind === "updates" && <PortalField id={uid + "-message"} label="Message visible par le client" required>
          <Textarea id={uid + "-message"} value={message} required maxLength={2000} rows={5} disabled={publish.isPending} onChange={e => setMessage(e.target.value)} />
        </PortalField>}
        {publish.error && <p role="alert" className="break-words text-sm text-destructive">{publish.error.message}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={publish.isPending} onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={publish.isPending || !title.trim() || (kind === "documents" ? !source || sources.isError : !message.trim())}>
            {publish.isPending && <Loader2 className="size-4 animate-spin" />}Publier
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
