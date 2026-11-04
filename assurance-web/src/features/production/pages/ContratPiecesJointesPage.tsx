import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, FileText, Link2, Plus, RefreshCw, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/store/auth-store";
import { DocumentValidity } from "@/features/crm/components/ClientDocuments";
import { documentStatus, documentValidityDate, formatDocumentDate } from "../utils/format";
import { attachmentApi } from "../api/attachments";
import type { PieceJointe, PiecesJointesContrat, TypeContrat, TypePieceJointe } from "../types";
import {
  formatAttachmentSize,
  OTHER_ATTACHMENT_TYPE,
  UploadPieceDialog,
} from "../components/UploadPieceDialog";

export default function ContratPiecesJointesPage() {
  const { contratId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const mouvementId = numericParam(searchParams.get("mouvementId"));
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [replacement, setReplacement] = useState<PieceJointe>();
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<PieceJointe>();
  const [assignment, setAssignment] = useState<PieceJointe>();
  const [assignmentOwner, setAssignmentOwner] = useState("");
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canManage = permissions.includes("piece-jointe:manage") || permissions.includes("contrat:update");
  const canManageClient = permissions.includes("client:manage") || permissions.includes("client:create");

  const piecesQuery = useQuery({
    queryKey: ["contrat-pieces-jointes", contratId, mouvementId],
    queryFn: () => attachmentApi.getContratPiecesJointes(contratId, mouvementId),
    enabled: Boolean(contratId),
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: { typePieceJointeId?: string; customTypeLabel?: string; files: File[] }) =>
      replacement ? replacement.clientId
        ? attachmentApi.uploadClient(replacement.clientId, { typePieceJointeId: selectedTypeId, files: payload.files,
            expiresOn: expiresOn || undefined, previousVersionId: replacement.id, reason })
        : attachmentApi.replace(contratId, replacement.id, payload.files, expiresOn, reason)
        : attachmentApi.uploadPieceJointe(contratId, { ...payload, mouvementId,
            clientId: selectedType?.documentOwner === "CLIENT" ? ownerId : undefined,
            vehiculeId: selectedType?.documentOwner === "VEHICULE" ? ownerId : undefined, expiresOn: expiresOn || undefined }),
    onSuccess: async () => {
      resetUpload();
      await queryClient.invalidateQueries({ queryKey: ["contrat-pieces-jointes", contratId, mouvementId] });
      await queryClient.invalidateQueries({ queryKey: ["client-documents"] });
      toast.success("Pièce jointe enregistrée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Upload impossible"),
  });

  const deleteMutation = useMutation({
    mutationFn: (piece: PieceJointe) => piece.canUnlink ? attachmentApi.unlink(contratId, piece.id, mouvementId)
      : piece.clientId ? attachmentApi.deleteClient(piece.clientId, piece.id) : attachmentApi.deletePieceJointe(contratId, piece.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contrat-pieces-jointes", contratId, mouvementId] });
      await queryClient.invalidateQueries({ queryKey: ["client-documents"] });
      setConfirmDelete(undefined);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Suppression impossible"),
  });

  const data = piecesQuery.data;
  const selectedType = data?.types.find(type => type.id === selectedTypeId);
  const selectedOwner = selectedType?.documentOwner === "CLIENT" ? data?.documentClients?.find(owner => owner.id === ownerId)
    : data?.documentVehicles?.find(owner => owner.id === ownerId);
  const effectiveExpiry = selectedType?.documentValiditySource && selectedType.documentValiditySource !== "MANUAL"
    ? documentValidityDate(selectedType, selectedOwner) : expiresOn;
  const piecesByType = useMemo(() => groupPiecesByType((data?.pieces ?? []).filter(piece => piece.status === "VALID" || !piece.status)), [data?.pieces]);
  const completedRequired = (data?.types ?? []).filter((type) => type.obligatoire && (piecesByType.get(type.id)?.length ?? 0) > 0).length;
  const requiredCount = (data?.types ?? []).filter((type) => type.obligatoire).length;
  const selectableTypes = (data?.types ?? []).filter((type) => !isGenericOtherType(type));
  const reuseMutation = useMutation({
    mutationFn: ({ pieceId, typeId }: { pieceId: string; typeId: string }) => attachmentApi.reuse(contratId, pieceId, typeId, mouvementId),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["contrat-pieces-jointes", contratId, mouvementId] }); },
    onError: error => toast.error(error instanceof Error ? error.message : "Liaison impossible"),
  });
  const assignMutation = useMutation({
    mutationFn: () => attachmentApi.assignOwner(contratId, assignment!.id,
      assignment?.expectedOwner === "CLIENT" ? assignmentOwner : undefined,
      assignment?.expectedOwner === "VEHICULE" ? assignmentOwner : undefined),
    onSuccess: async () => {
      setAssignment(undefined); setAssignmentOwner("");
      await queryClient.invalidateQueries({ queryKey: ["contrat-pieces-jointes", contratId, mouvementId] });
      await queryClient.invalidateQueries({ queryKey: ["client-documents"] });
    },
    onError: error => toast.error(error instanceof Error ? error.message : "Rattachement impossible"),
  });

  async function download(piece: PieceJointe) {
    try {
      const blob = await attachmentApi.downloadPieceJointe(contratId, piece.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = piece.nomFichier;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléchargement impossible");
    }
  }

  function resetUpload() {
    setUploadOpen(false);
    setSelectedTypeId("");
    setCustomTypeLabel("");
    setUploadFiles([]);
    setReplacement(undefined); setReason(""); setOwnerId(""); setExpiresOn("");
  }

  function submitUpload() {
    if (!selectedTypeId) {
      toast.error("Sélectionnez un type de document");
      return;
    }
    if (selectedTypeId === OTHER_ATTACHMENT_TYPE && !customTypeLabel.trim()) {
      toast.error("Saisissez le nom du document");
      return;
    }
    if (uploadFiles.length === 0) {
      toast.error("Sélectionnez au moins un fichier");
      return;
    }
    uploadMutation.mutate({
      typePieceJointeId: selectedTypeId === OTHER_ATTACHMENT_TYPE ? undefined : selectedTypeId,
      customTypeLabel: selectedTypeId === OTHER_ATTACHMENT_TYPE ? customTypeLabel.trim() : undefined,
      files: uploadFiles,
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
          <h1 className="text-xl font-semibold tracking-tight">Pièces jointes</h1>
          <p className="text-sm text-muted-foreground">
            {data?.numeroDossier ?? `Contrat #${contratId}`} · {data?.mouvementLibelle ?? "Mouvement contrat"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/production/contrats">Retour liste</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoCell label="Police" value={data?.numeroPolice ?? "-"} />
        <InfoCell label="Type dossier" value={contractTypeLabel(data)} />
        <InfoCell label="Obligatoires" value={`${completedRequired}/${requiredCount}`} />
      </div>

      {(data?.availableDocuments?.length ?? 0) > 0 && <section className="space-y-2 border-y py-4">
        <h2 className="text-sm font-semibold">Documents disponibles</h2>
        {data?.availableDocuments?.map(piece => {
          const type = data.types.find(item => item.id === piece.typePieceJointeId);
          return <div key={piece.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <div><strong>{piece.typePieceJointeLibelle}</strong><p className="text-muted-foreground">{piece.ownerName} · {piece.nomFichier}</p></div>
            {canManage && type && <Button type="button" size="sm" variant="outline" disabled={reuseMutation.isPending}
              onClick={() => reuseMutation.mutate({ pieceId: piece.id, typeId: type.id })}>Utiliser ce document</Button>}
          </div>;
        })}
      </section>}

      <Card className="min-w-0 border-border/70 shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-emerald-50/70 py-3 dark:bg-emerald-950/30">
          <div>
            <CardTitle className="text-sm">Documents enregistrés</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Pièces liées à ce mouvement.</p>
          </div>
          <Button type="button" size="sm" disabled={!canManage} onClick={() => setUploadOpen(true)}>
            <Plus className="size-4" />
            Ajouter un document
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {piecesQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Chargement...</div>
          ) : (data?.pieces ?? []).length === 0 ? (
            <div className="grid min-h-40 place-items-center px-6 py-10 text-center">
              <div>
                <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Aucun document enregistré</p>
                <p className="mt-1 text-xs text-muted-foreground">Ajoutez la première pièce jointe de ce mouvement.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/35 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Type de document</th>
                    <th className="px-4 py-3">Fichier</th>
                    <th className="px-4 py-3">Ajouté le</th>
                    <th className="px-4 py-3 text-right">Taille</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.pieces ?? []).map((piece) => (
                    <tr key={piece.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{piece.typePieceJointeLibelle ?? "Autre"}<p className="text-xs font-normal text-muted-foreground">{piece.ownerName}</p>
                        <p className={piece.status === "EXPIRED" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{documentStatus(piece)}{piece.expiresOn ? ` · ${formatDocumentDate(piece.expiresOn)}` : ""}</p>
                        {piece.changeReason && <p className="text-xs font-normal text-muted-foreground">{piece.changeReason}</p>}</td>
                      <td className="px-4 py-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0 text-emerald-700" />
                          <span className="truncate">{piece.nomFichier}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(piece.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">{formatAttachmentSize(piece.tailleOctets) || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {canManage && !piece.clientId && !piece.vehiculeId && !piece.archived && (piece.expectedOwner === "CLIENT" || piece.expectedOwner === "VEHICULE") &&
                            <Button type="button" variant="ghost" size="icon" className="size-8" title="Identifier le titulaire" onClick={() => { setAssignmentOwner(""); setAssignment(piece); }}><Link2 className="size-4" /></Button>}
                          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => download(piece)} title="Télécharger">
                            <Download className="size-4" />
                          </Button>
                          {canManage && !piece.archived && (!piece.clientId || canManageClient) && <Button type="button" variant="ghost" size="icon" className="size-8" title="Remplacer"
                            onClick={() => { setReplacement(piece); setOwnerId(piece.clientId ?? piece.vehiculeId ?? ""); setSelectedTypeId(piece.typePieceJointeId ?? ""); setUploadOpen(true); }}><RefreshCw className="size-4" /></Button>}
                          {canManage && (piece.canUnlink || (!piece.archived && (!piece.clientId || canManageClient))) && <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => setConfirmDelete(piece)}
                            title={piece.canUnlink ? "Retirer du mouvement" : piece.canDelete ? "Supprimer" : "Archiver"}
                          >
                            {piece.canUnlink ? <Unlink className="size-4" /> : piece.canDelete ? <Trash2 className="size-4" /> : <Archive className="size-4" />}
                          </Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <UploadPieceDialog
        types={replacement ? selectableTypes.filter(type => type.id === selectedTypeId) : selectableTypes}
        selectedTypeId={selectedTypeId}
        customTypeLabel={customTypeLabel}
        files={uploadFiles}
        open={uploadOpen}
        uploading={uploadMutation.isPending}
        title={replacement ? "Remplacer le document" : "Ajouter un document"}
        allowOther={!replacement}
        disabled={(selectedType?.documentExpiry === "REQUIRED" && !effectiveExpiry) ||
          (!!replacement && !reason.trim()) || (!replacement && (selectedType?.documentOwner === "CLIENT" || selectedType?.documentOwner === "VEHICULE") && !ownerId)}
        onOpenChange={(open) => open ? setUploadOpen(true) : resetUpload()}
        onTypeChange={(value) => {
          setSelectedTypeId(value);
          setOwnerId(""); setExpiresOn("");
          if (value !== OTHER_ATTACHMENT_TYPE) setCustomTypeLabel("");
        }}
        onCustomTypeLabelChange={setCustomTypeLabel}
        onFiles={setUploadFiles}
        onUpload={submitUpload}
      >
        {!replacement && (selectedType?.documentOwner === "CLIENT" || selectedType?.documentOwner === "VEHICULE") && <label className="grid gap-2 text-sm font-medium">
          {selectedType.documentOwner === "CLIENT" ? "Titulaire du document *" : "Véhicule concerné *"}
          <Select value={ownerId} onValueChange={setOwnerId}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>
            {(selectedType.documentOwner === "CLIENT" ? data?.documentClients?.filter(client => !selectedType.typeClient || client.typeClient === selectedType.typeClient) : data?.documentVehicles)?.map(owner => <SelectItem key={owner.id} value={owner.id}>{owner.libelle}</SelectItem>)}
          </SelectContent></Select>
        </label>}
        <DocumentValidity type={selectedType} value={expiresOn} onChange={setExpiresOn} owner={selectedOwner} />
        {replacement && <label className="grid gap-2 text-sm font-medium">Motif du remplacement *<Input value={reason} maxLength={500} onChange={event => setReason(event.target.value)} /></label>}
      </UploadPieceDialog>
      <Dialog open={!!assignment} onOpenChange={open => { if (!open && !assignMutation.isPending) setAssignment(undefined); }}><DialogContent>
        <DialogHeader><DialogTitle>Identifier le titulaire</DialogTitle></DialogHeader>
        <p className="text-sm">{assignment?.typePieceJointeLibelle} · {assignment?.nomFichier}</p>
        <label className="grid gap-2 text-sm font-medium">{assignment?.expectedOwner === "CLIENT" ? "Client titulaire" : "Véhicule concerné"}
          <Select value={assignmentOwner} onValueChange={setAssignmentOwner}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>
            {(assignment?.expectedOwner === "CLIENT" ? data?.documentClients : data?.documentVehicles)?.map((owner, index) => <SelectItem key={`${owner.id}-${index}`} value={owner.id}>{owner.libelle}</SelectItem>)}
          </SelectContent></Select>
        </label>
        <DialogFooter><Button type="button" variant="outline" disabled={assignMutation.isPending} onClick={() => setAssignment(undefined)}>Annuler</Button>
          <Button type="button" disabled={!assignmentOwner || assignMutation.isPending} onClick={() => assignMutation.mutate()}>Rattacher</Button></DialogFooter>
      </DialogContent></Dialog>
      <Dialog open={!!confirmDelete} onOpenChange={open => { if (!open && !deleteMutation.isPending) setConfirmDelete(undefined); }}><DialogContent>
        <DialogHeader><DialogTitle>{confirmDelete?.canUnlink ? "Retirer le document du mouvement ?" : confirmDelete?.canDelete ? "Supprimer le fichier ?" : "Archiver le document ?"}</DialogTitle></DialogHeader>
        <p className="text-sm">{confirmDelete?.canUnlink ? "Le fichier restera disponible dans le dossier de son titulaire." : confirmDelete?.canDelete ? "Le fichier sera définitivement supprimé." : "Le fichier et ses références historiques seront conservés."}</p>
        <DialogFooter><Button type="button" variant="outline" disabled={deleteMutation.isPending} onClick={() => setConfirmDelete(undefined)}>Annuler</Button>
          <Button type="button" variant="destructive" disabled={deleteMutation.isPending} onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}>{confirmDelete?.canUnlink ? "Retirer" : confirmDelete?.canDelete ? "Supprimer" : "Archiver"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function groupPiecesByType(pieces: PieceJointe[]) {
  const map = new Map<string, PieceJointe[]>();
  pieces.forEach((piece) => {
    if (!piece.typePieceJointeId) return;
    map.set(piece.typePieceJointeId, [...(map.get(piece.typePieceJointeId) ?? []), piece]);
  });
  return map;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function isGenericOtherType(type: TypePieceJointe) {
  const label = type.libelle.trim().toLocaleLowerCase("fr");
  return label === "autre" || label === "autre document";
}

function numericParam(value: string | null) {
  return value && /^\d+$/.test(value) ? value : null;
}

function contractTypeLabel(data?: PiecesJointesContrat) {
  if (data?.brancheAssuranceCode?.trim().toUpperCase() === "ASSISTANCE") {
    const assistanceType = data.typeAssistance?.trim().toUpperCase();
    if (assistanceType === "ASSISTANCE VOYAGE") return "Assistance voyage";
    if (assistanceType === "ASSISTANCE AUTOMOBILE") return "Assistance automobile";
    return "Assistance";
  }
  const type: TypeContrat | string | null | undefined = data?.typeContrat;
  if (type === "PARTICULIER") return "Mono";
  if (type === "CONVENTION") return "Convention";
  if (type === "FLOTTE") return "Flotte";
  return "-";
}
