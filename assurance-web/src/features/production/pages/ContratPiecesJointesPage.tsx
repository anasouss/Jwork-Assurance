import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, FileUp, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { productionApi } from "../api";
import type { PieceJointe, TypePieceJointe } from "../types";

export default function ContratPiecesJointesPage() {
  const { contratId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const mouvementId = numericParam(searchParams.get("mouvementId"));
  const queryClient = useQueryClient();
  const [uploadTarget, setUploadTarget] = useState<TypePieceJointe | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const piecesQuery = useQuery({
    queryKey: ["contrat-pieces-jointes", contratId, mouvementId],
    queryFn: () => productionApi.getContratPiecesJointes(contratId, mouvementId),
    enabled: Boolean(contratId),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ typePieceJointeId, files }: { typePieceJointeId: string; files: File[] }) =>
      productionApi.uploadPieceJointe(contratId, { typePieceJointeId, mouvementId, files }),
    onSuccess: async () => {
      setUploadTarget(null);
      setUploadFiles([]);
      await queryClient.invalidateQueries({ queryKey: ["contrat-pieces-jointes", contratId, mouvementId] });
      toast.success("Pièce jointe enregistrée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Upload impossible"),
  });

  const deleteMutation = useMutation({
    mutationFn: (pieceId: string) => productionApi.deletePieceJointe(contratId, pieceId),
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

  async function download(piece: PieceJointe) {
    try {
      const blob = await productionApi.downloadPieceJointe(contratId, piece.id);
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

  function closeUploadDialog(open: boolean) {
    if (open) return;
    setUploadTarget(null);
    setUploadFiles([]);
  }

  function submitUpload() {
    if (!uploadTarget || uploadFiles.length === 0) return;
    uploadMutation.mutate({ typePieceJointeId: uploadTarget.id, files: uploadFiles });
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
        <InfoCell label="Type contrat" value={data?.typeContrat ?? "-"} />
        <InfoCell label="Obligatoires" value={`${completedRequired}/${requiredCount}`} />
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="border-b bg-emerald-50/70 py-3 dark:bg-emerald-950/30">
          <CardTitle className="text-sm">Documents attendus</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {piecesQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Chargement...</div>
          ) : (data?.types ?? []).length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Aucun type de pièce jointe n'est configuré pour ce mouvement.
            </div>
          ) : (
            <div className="divide-y">
              {(data?.types ?? []).map((type) => {
                const pieces = piecesByType.get(type.id) ?? [];
                return (
                  <DocumentSlot
                    key={type.id}
                    type={type}
                    pieces={pieces}
                    deletingId={deleteMutation.variables}
                    onAdd={() => {
                      setUploadTarget(type);
                      setUploadFiles([]);
                    }}
                    onDownload={download}
                    onDelete={(pieceId) => deleteMutation.mutate(pieceId)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <UploadPieceDialog
        type={uploadTarget}
        files={uploadFiles}
        open={Boolean(uploadTarget)}
        uploading={uploadMutation.isPending}
        onOpenChange={closeUploadDialog}
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

function DocumentSlot({
  type,
  pieces,
  deletingId,
  onAdd,
  onDownload,
  onDelete,
}: {
  type: TypePieceJointe;
  pieces: PieceJointe[];
  deletingId?: string;
  onAdd: () => void;
  onDownload: (piece: PieceJointe) => void;
  onDelete: (pieceId: string) => void;
}) {
  const done = pieces.length > 0;
  return (
    <div className={cn("grid gap-3 p-4 lg:grid-cols-[280px_1fr_auto]", type.obligatoire && !done && "bg-amber-50/40 dark:bg-amber-950/15")}>
      <div className="grid content-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{type.libelle}</span>
          {type.obligatoire ? <Badge variant={done ? "default" : "destructive"}>{done ? "Reçu" : "Obligatoire"}</Badge> : <Badge variant="secondary">Optionnel</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          {type.typeMouvementLibelle ?? "Tous mouvements"} · {type.typeClient ?? "Tout client"}
        </div>
      </div>

      <div className="grid gap-2">
        {pieces.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">Aucun fichier enregistré.</div>
        ) : (
          pieces.map((piece) => (
            <div key={piece.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-emerald-700" />
                <span className="truncate text-sm font-medium">{piece.nomFichier}</span>
                <span className="text-xs text-muted-foreground">{formatSize(piece.tailleOctets)}</span>
              </span>
              <span className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onDownload(piece)} title="Télécharger">
                  <Download className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" disabled={deletingId === piece.id} onClick={() => onDelete(piece.id)} title="Supprimer">
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-start justify-end">
        <Button type="button" variant={done ? "outline" : "default"} size="sm" onClick={onAdd}>
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>
    </div>
  );
}

function UploadPieceDialog({
  type,
  files,
  open,
  uploading,
  onOpenChange,
  onFiles,
  onUpload,
}: {
  type: TypePieceJointe | null;
  files: File[];
  open: boolean;
  uploading: boolean;
  onOpenChange: (open: boolean) => void;
  onFiles: (files: File[]) => void;
  onUpload: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = type ? `pj-upload-${type.id}` : "pj-upload";

  function acceptFiles(nextFiles: File[]) {
    if (nextFiles.length > 1 && nextFiles.some((file) => !file.type.startsWith("image/"))) {
      toast.error("Plusieurs fichiers doivent être des images pour générer un PDF.");
      return;
    }
    if (nextFiles.some((file) => !file.type.startsWith("image/") && file.type !== "application/pdf")) {
      toast.error("Format non accepté.");
      return;
    }
    onFiles(nextFiles);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFiles(Array.from(event.dataTransfer.files ?? []));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{type ? `Ajouter ${type.libelle}` : "Ajouter une pièce jointe"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <label
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "grid min-h-44 cursor-pointer place-items-center rounded-md border border-dashed px-4 py-6 text-center transition-colors",
              dragging ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50" : "border-slate-300 bg-slate-50/60 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-950/40 dark:hover:bg-neutral-900"
            )}
          >
            <Input
              id={inputId}
              type="file"
              multiple
              accept="image/*,.pdf"
              className="sr-only"
              onChange={(event) => acceptFiles(Array.from(event.target.files ?? []))}
            />
            <span className="grid justify-items-center gap-2">
              <span className="grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <FileUp className="size-6" />
              </span>
              <span className="text-sm font-medium">Déposer les fichiers ou parcourir</span>
              <span className="text-xs text-muted-foreground">PDF ou images. Plusieurs images seront fusionnées en un PDF.</span>
            </span>
          </label>

          {files.length ? (
            <div className="grid gap-2">
              {files.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-emerald-700" />
                    <span className="truncate text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    onClick={() => onFiles(files.filter((_, fileIndex) => fileIndex !== index))}
                    title="Retirer"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="button" disabled={!files.length || uploading} onClick={onUpload}>
            <Upload className="size-4" />
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function formatSize(value?: number | null) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`;
  return `${(value / 1024 / 1024).toFixed(1)} Mo`;
}

function numericParam(value: string | null) {
  return value && /^\d+$/.test(value) ? value : null;
}
