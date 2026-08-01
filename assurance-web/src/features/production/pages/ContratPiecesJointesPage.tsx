import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { attachmentApi } from "../api/attachments";
import type { PieceJointe, TypeContrat, TypePieceJointe } from "../types";
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

  const piecesQuery = useQuery({
    queryKey: ["contrat-pieces-jointes", contratId, mouvementId],
    queryFn: () => attachmentApi.getContratPiecesJointes(contratId, mouvementId),
    enabled: Boolean(contratId),
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: { typePieceJointeId?: string; customTypeLabel?: string; files: File[] }) =>
      attachmentApi.uploadPieceJointe(contratId, { ...payload, mouvementId }),
    onSuccess: async () => {
      resetUpload();
      await queryClient.invalidateQueries({ queryKey: ["contrat-pieces-jointes", contratId, mouvementId] });
      toast.success("Pièce jointe enregistrée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Upload impossible"),
  });

  const deleteMutation = useMutation({
    mutationFn: (pieceId: string) => attachmentApi.deletePieceJointe(contratId, pieceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contrat-pieces-jointes", contratId, mouvementId] });
      toast.success("Pièce jointe supprimée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Suppression impossible"),
  });

  const data = piecesQuery.data;
  const piecesByType = useMemo(() => groupPiecesByType(data?.pieces ?? []), [data?.pieces]);
  const completedRequired = (data?.types ?? []).filter((type) => type.obligatoire && (piecesByType.get(type.id)?.length ?? 0) > 0).length;
  const requiredCount = (data?.types ?? []).filter((type) => type.obligatoire).length;
  const selectableTypes = (data?.types ?? []).filter((type) => !isGenericOtherType(type));

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
        <InfoCell label="Type contrat" value={contractTypeLabel(data?.typeContrat)} />
        <InfoCell label="Obligatoires" value={`${completedRequired}/${requiredCount}`} />
      </div>

      <Card className="min-w-0 border-border/70 shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-emerald-50/70 py-3 dark:bg-emerald-950/30">
          <div>
            <CardTitle className="text-sm">Documents enregistrés</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Pièces liées à ce mouvement.</p>
          </div>
          <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
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
                      <td className="px-4 py-3 font-medium">{piece.typePieceJointeLibelle ?? "Autre"}</td>
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
                          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => download(piece)} title="Télécharger">
                            <Download className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            disabled={deleteMutation.isPending && deleteMutation.variables === piece.id}
                            onClick={() => deleteMutation.mutate(piece.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="size-4" />
                          </Button>
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
        types={selectableTypes}
        selectedTypeId={selectedTypeId}
        customTypeLabel={customTypeLabel}
        files={uploadFiles}
        open={uploadOpen}
        uploading={uploadMutation.isPending}
        onOpenChange={(open) => open ? setUploadOpen(true) : resetUpload()}
        onTypeChange={(value) => {
          setSelectedTypeId(value);
          if (value !== OTHER_ATTACHMENT_TYPE) setCustomTypeLabel("");
        }}
        onCustomTypeLabelChange={setCustomTypeLabel}
        onFiles={setUploadFiles}
        onUpload={submitUpload}
      />
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

function contractTypeLabel(type?: TypeContrat | string | null) {
  if (type === "PARTICULIER") return "Mono";
  if (type === "CONVENTION") return "Convention";
  if (type === "FLOTTE") return "Flotte";
  return "-";
}
