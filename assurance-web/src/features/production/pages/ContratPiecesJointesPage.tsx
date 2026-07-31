import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, FileUp, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { productionApi } from "../api";
import type { PieceJointe, TypeContrat, TypePieceJointe } from "../types";
import { Field } from "../components/Field";

const OTHER_TYPE = "__OTHER__";

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
    queryFn: () => productionApi.getContratPiecesJointes(contratId, mouvementId),
    enabled: Boolean(contratId),
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: { typePieceJointeId?: string; customTypeLabel?: string; files: File[] }) =>
      productionApi.uploadPieceJointe(contratId, { ...payload, mouvementId }),
    onSuccess: async () => {
      resetUpload();
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
  const selectableTypes = (data?.types ?? []).filter((type) => !isGenericOtherType(type));

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
    if (selectedTypeId === OTHER_TYPE && !customTypeLabel.trim()) {
      toast.error("Saisissez le nom du document");
      return;
    }
    if (uploadFiles.length === 0) {
      toast.error("Sélectionnez au moins un fichier");
      return;
    }
    uploadMutation.mutate({
      typePieceJointeId: selectedTypeId === OTHER_TYPE ? undefined : selectedTypeId,
      customTypeLabel: selectedTypeId === OTHER_TYPE ? customTypeLabel.trim() : undefined,
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
                      <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">{formatSize(piece.tailleOctets) || "-"}</td>
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
          if (value !== OTHER_TYPE) setCustomTypeLabel("");
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

function UploadPieceDialog({
  types,
  selectedTypeId,
  customTypeLabel,
  files,
  open,
  uploading,
  onOpenChange,
  onTypeChange,
  onCustomTypeLabelChange,
  onFiles,
  onUpload,
}: {
  types: TypePieceJointe[];
  selectedTypeId: string;
  customTypeLabel: string;
  files: File[];
  open: boolean;
  uploading: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeChange: (value: string) => void;
  onCustomTypeLabelChange: (value: string) => void;
  onFiles: (files: File[]) => void;
  onUpload: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = "pj-upload";

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
          <DialogTitle>Ajouter un document</DialogTitle>
          <DialogDescription>Sélectionnez le type puis ajoutez un PDF ou des images.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Type de document" required>
            <Select value={selectedTypeId} onValueChange={onTypeChange}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.libelle}{type.obligatoire ? " (obligatoire)" : ""}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_TYPE}>Autre</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {selectedTypeId === OTHER_TYPE ? (
            <Field label="Nom du document" required>
              <Input
                value={customTypeLabel}
                maxLength={160}
                placeholder="Ex. Attestation complémentaire"
                onChange={(event) => onCustomTypeLabelChange(event.target.value)}
              />
            </Field>
          ) : null}

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
              onClick={(event) => { event.currentTarget.value = ""; }}
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
          <Button
            type="button"
            disabled={!selectedTypeId || !files.length || (selectedTypeId === OTHER_TYPE && !customTypeLabel.trim()) || uploading}
            onClick={onUpload}
          >
            <Upload className="size-4" />
            {uploading ? "Envoi..." : "Enregistrer"}
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
