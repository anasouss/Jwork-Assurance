import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, History, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/download";
import { useAuthStore } from "@/store/auth-store";
import { attachmentApi, attachmentKeys } from "@/features/production/api/attachments";
import { UploadPieceDialog } from "@/features/production/components/UploadPieceDialog";
import { toDateOnly } from "@/features/production/date";
import type { DocumentOwnerOption, PieceJointe, TypeClient, TypePieceJointe } from "@/features/production/types";
import { documentStatus, documentValidityDate, formatDocumentDate } from "@/features/production/utils/format";

export type ClientDocumentDraft = { key: string; type: TypePieceJointe; files: File[]; expiresOn?: string };

export function DocumentValidity({ type, value, onChange, owner }: {
  type?: TypePieceJointe; value: string; onChange: (value: string) => void; owner?: Partial<DocumentOwnerOption>;
}) {
  if (!type?.documentExpiry || type.documentExpiry === "NONE") return null;
  if (type.documentValiditySource && type.documentValiditySource !== "MANUAL") {
    const label = { CLIENT_CIN: "Validité CIN", CLIENT_PASSPORT: "Validité passeport", CLIENT_PERMIS: "Validité permis",
      VEHICULE_CARTE_GRISE: "Validité carte grise" }[type.documentValiditySource];
    const date = documentValidityDate(type, owner);
    return <label className="grid gap-2 text-sm font-medium">{label}
      <Input readOnly value={date ? formatDocumentDate(date) : "Non renseignée"} />
    </label>;
  }
  return <label className="grid gap-2 text-sm font-medium">
    Date de validité{type.documentExpiry === "REQUIRED" ? " *" : ""}
    <DatePicker date={value || undefined} onSelect={date => onChange(toDateOnly(date) ?? "")} />
  </label>;
}

function DocumentUpload({ types, open, onClose, onSave, uploading, previous, owner }: {
  types: TypePieceJointe[]; open: boolean; onClose: () => void;
  onSave: (draft: ClientDocumentDraft, reason: string) => void; uploading: boolean; previous?: PieceJointe;
  owner?: Partial<DocumentOwnerOption>;
}) {
  const [typeId, setTypeId] = useState(previous?.typePieceJointeId ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [expiry, setExpiry] = useState("");
  const [reason, setReason] = useState("");
  const candidates = previous ? types.filter(type => type.naturePieceJointeId === previous.naturePieceJointeId) : types;
  const type = candidates.find(item => item.id === typeId) ?? (previous ? candidates[0] : undefined);
  const effectiveExpiry = type?.documentValiditySource && type.documentValiditySource !== "MANUAL" ? documentValidityDate(type, owner) : expiry;
  return <UploadPieceDialog types={candidates} selectedTypeId={type?.id ?? ""} customTypeLabel="" files={files}
    open={open} uploading={uploading} onOpenChange={next => { if (!next) onClose(); }} allowOther={false}
    title={previous ? `Remplacer : ${previous.typePieceJointeLibelle}` : "Ajouter un document client"}
    disabled={!type || (type.documentExpiry === "REQUIRED" && !effectiveExpiry) || (!!previous && !reason.trim())}
    onTypeChange={id => { setTypeId(id); setExpiry(""); }} onCustomTypeLabelChange={() => {}}
    onFiles={setFiles} onUpload={() => {
      if (type) onSave({ key: crypto.randomUUID(), type, files, expiresOn: expiry || undefined }, reason.trim());
    }}>
    <DocumentValidity type={type} value={expiry} onChange={setExpiry} owner={owner} />
    {previous && <label className="grid gap-2 text-sm font-medium">Motif du remplacement *
      <Input value={reason} maxLength={500} onChange={event => setReason(event.target.value)} />
    </label>}
  </UploadPieceDialog>;
}

export function ClientDocumentDrafts({ typeClient, value, onChange, disabled = false, owner }: {
  typeClient: TypeClient; value: ClientDocumentDraft[]; onChange: (value: ClientDocumentDraft[]) => void; disabled?: boolean;
  owner?: Partial<DocumentOwnerOption>;
}) {
  const [open, setOpen] = useState(false);
  const types = useQuery({ queryKey: attachmentKeys.clientTypes(typeClient), queryFn: () => attachmentApi.clientTypes(typeClient) });
  return <section className="grid gap-3 border-t pt-4">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Pièces jointes du client</h3>
      <Button type="button" size="sm" variant="outline" disabled={disabled || !types.data?.length} onClick={() => setOpen(true)}><Plus className="size-4" />Ajouter</Button>
    </div>
    {types.isError && <p className="text-sm text-destructive">Chargement des types impossible. <button type="button" className="underline" onClick={() => types.refetch()}>Réessayer</button></p>}
    {value.map(item => <div key={item.key} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
      <div className="min-w-0"><strong>{item.type.libelle}</strong><p className="break-all text-muted-foreground">{item.files.map(file => file.name).join(", ")}</p></div>
      <Button type="button" variant="ghost" size="icon" title="Retirer" disabled={disabled} onClick={() => onChange(value.filter(row => row.key !== item.key))}><Trash2 className="size-4" /></Button>
    </div>)}
    {open && <DocumentUpload types={types.data ?? []} open onClose={() => setOpen(false)} uploading={false} owner={owner}
      onSave={item => { onChange([...value, item]); setOpen(false); }} />}
  </section>;
}

export function ClientDocuments({ clientId, typeClient, owner }: { clientId: string; typeClient: TypeClient; owner?: Partial<DocumentOwnerOption> }) {
  const cache = useQueryClient();
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canManage = permissions.includes("client:manage") || permissions.includes("client:create");
  const [upload, setUpload] = useState<{ previous?: PieceJointe }>();
  const [confirm, setConfirm] = useState<PieceJointe>();
  const [showArchives, setShowArchives] = useState(false);
  const documents = useQuery({ queryKey: attachmentKeys.client(clientId), queryFn: () => attachmentApi.clientDocuments(clientId) });
  const types = useQuery({ queryKey: attachmentKeys.clientTypes(typeClient), queryFn: () => attachmentApi.clientTypes(typeClient) });
  const currentDocuments = (documents.data ?? []).filter(piece => !piece.archived);
  const archivedDocuments = (documents.data ?? []).filter(piece => piece.archived);
  async function refresh() {
    await cache.invalidateQueries({ queryKey: attachmentKeys.client(clientId) });
    await cache.invalidateQueries({ queryKey: ["contrat-pieces-jointes"] });
  }
  const save = useMutation({
    mutationFn: ({ draft, reason }: { draft: ClientDocumentDraft; reason: string }) => attachmentApi.uploadClient(clientId, {
      typePieceJointeId: draft.type.id, files: draft.files, expiresOn: draft.expiresOn,
      previousVersionId: upload?.previous?.id, reason: reason || undefined,
    }),
    onSuccess: async () => { setUpload(undefined); await refresh(); toast.success("Document enregistré"); },
    onError: error => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });
  const remove = useMutation({
    mutationFn: (piece: PieceJointe) => attachmentApi.deleteClient(clientId, piece.id),
    onSuccess: async () => { setConfirm(undefined); await refresh(); },
    onError: error => toast.error(error instanceof Error ? error.message : "Suppression impossible"),
  });
  async function download(piece: PieceJointe) {
    try { downloadBlob(await attachmentApi.downloadClient(clientId, piece.id), piece.nomFichier); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Téléchargement impossible"); }
  }
  function documentRow(piece: PieceJointe) {
    const previous = documents.data?.find(item => item.id === piece.previousVersionId);
    return <Collapsible key={piece.id} className="py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="font-medium">{piece.typePieceJointeLibelle ?? "Document"}</strong>
            <Badge variant={piece.status === "ARCHIVED" ? "gray" : piece.status === "EXPIRED" ? "red" : "success"} className="px-2 py-0 text-xs font-medium shadow-none">{documentStatus(piece)}</Badge>
          </div>
          <p className="mt-1 break-all text-muted-foreground">{piece.nomFichier}</p>
          {piece.expiresOn && <p className="mt-1 text-xs text-muted-foreground">Validité : {formatDocumentDate(piece.expiresOn)}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <Tooltip><TooltipTrigger asChild>
            <Button type="button" size="icon" variant="ghost" aria-label={`Télécharger ${piece.nomFichier}`} onClick={() => download(piece)}><Download className="size-4" /></Button>
          </TooltipTrigger><TooltipContent>Télécharger</TooltipContent></Tooltip>
          {canManage && !piece.archived && <>
            <Tooltip><TooltipTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40 dark:hover:text-amber-200" aria-label={`Remplacer ${piece.nomFichier}`} disabled={!types.data?.some(type => type.naturePieceJointeId === piece.naturePieceJointeId)} onClick={() => setUpload({ previous: piece })}><RefreshCw className="size-4" /></Button>
            </TooltipTrigger><TooltipContent>Remplacer</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200" aria-label={`${piece.canDelete ? "Supprimer" : "Archiver"} ${piece.nomFichier}`} onClick={() => setConfirm(piece)}>{piece.canDelete ? <Trash2 className="size-4" /> : <Archive className="size-4" />}</Button>
            </TooltipTrigger><TooltipContent>{piece.canDelete ? "Supprimer" : "Archiver"}</TooltipContent></Tooltip>
          </>}
        </div>
      </div>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-1 text-xs text-muted-foreground" aria-label={`Historique de ${piece.nomFichier}`}>
          <History className="size-3.5" />Historique
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1 border-l pl-3 text-xs leading-5 text-muted-foreground">
        <p>Ajouté le {formatDocumentDate(piece.createdAt)}{piece.createdBy ? ` par ${piece.createdBy}` : ""}</p>
        {piece.changeReason && <p className="break-words">Motif : {piece.changeReason}</p>}
        {piece.previousVersionId && <p className="break-all">Remplace : {previous?.nomFichier ?? `version #${piece.previousVersionId}`}</p>}
        {piece.archivedAt && <p>Archivé le {formatDocumentDate(piece.archivedAt)}{piece.archivedBy ? ` par ${piece.archivedBy}` : ""}</p>}
      </CollapsibleContent>
    </Collapsible>;
  }
  return <section className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">Documents actuels</h3>
      {canManage && <Button type="button" size="sm" variant="outline" disabled={!types.data?.length} onClick={() => setUpload({})}><Plus className="size-4" />Ajouter un document</Button>}
    </div>
    {archivedDocuments.length > 0 && <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
      <Switch checked={showArchives} onCheckedChange={setShowArchives} />
      Afficher les archives ({archivedDocuments.length})
    </label>}
    {types.isError && <div role="alert" className="text-sm text-destructive">
      Types de documents indisponibles. <button type="button" className="underline" onClick={() => types.refetch()}>Réessayer</button>
    </div>}
    {documents.isLoading ? <p className="text-sm text-muted-foreground">Chargement...</p> : documents.isError ?
      <Button type="button" variant="outline" onClick={() => documents.refetch()}>Réessayer</Button> :
      <div className="divide-y">
        {currentDocuments.map(documentRow)}
        {!currentDocuments.length && <p className="py-4 text-sm text-muted-foreground">Aucun document actuel.</p>}
      </div>}
    {showArchives && archivedDocuments.length > 0 && <div className="border-t pt-3">
      <h4 className="text-sm font-medium">Archives</h4>
      <div className="divide-y">{archivedDocuments.map(documentRow)}</div>
    </div>}
    {upload && <DocumentUpload key={upload.previous?.id ?? "new"} types={types.data ?? []} open onClose={() => setUpload(undefined)}
      previous={upload.previous} uploading={save.isPending} owner={owner} onSave={(draft, reason) => save.mutate({ draft, reason })} />}
    <Dialog open={!!confirm} onOpenChange={open => { if (!open && !remove.isPending) setConfirm(undefined); }}><DialogContent>
      <DialogHeader><DialogTitle>{confirm?.canDelete ? "Supprimer le fichier ?" : "Archiver le document ?"}</DialogTitle></DialogHeader>
      <p className="text-sm">{confirm?.canDelete ? "Le fichier sera définitivement supprimé." : "Le document restera dans l’historique et dans les contrats qui l’utilisent."}</p>
      <DialogFooter><Button type="button" variant="outline" disabled={remove.isPending} onClick={() => setConfirm(undefined)}>Annuler</Button>
        <Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => confirm && remove.mutate(confirm)}>{confirm?.canDelete ? "Supprimer" : "Archiver"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}

