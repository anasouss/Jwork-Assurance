import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { productionApi } from "../api";
import type { PieceJointe, TypePieceJointe } from "../types";

export default function ContratPiecesJointesPage() {
  const { contratId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const mouvementId = searchParams.get("mouvementId");
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>({});

  const piecesQuery = useQuery({
    queryKey: ["contrat-pieces-jointes", contratId, mouvementId],
    queryFn: () => productionApi.getContratPiecesJointes(contratId, mouvementId),
    enabled: Boolean(contratId),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ typePieceJointeId, files }: { typePieceJointeId: string; files: File[] }) =>
      productionApi.uploadPieceJointe(contratId, { typePieceJointeId, mouvementId, files }),
    onSuccess: async (_, variables) => {
      setSelectedFiles((current) => ({ ...current, [variables.typePieceJointeId]: [] }));
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
                const files = selectedFiles[type.id] ?? [];
                return (
                  <DocumentSlot
                    key={type.id}
                    type={type}
                    pieces={pieces}
                    files={files}
                    uploading={uploadMutation.isPending}
                    deletingId={deleteMutation.variables}
                    onFiles={(nextFiles) => setSelectedFiles((current) => ({ ...current, [type.id]: nextFiles }))}
                    onUpload={() => uploadMutation.mutate({ typePieceJointeId: type.id, files })}
                    onDownload={download}
                    onDelete={(pieceId) => deleteMutation.mutate(pieceId)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
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
  files,
  uploading,
  deletingId,
  onFiles,
  onUpload,
  onDownload,
  onDelete,
}: {
  type: TypePieceJointe;
  pieces: PieceJointe[];
  files: File[];
  uploading: boolean;
  deletingId?: string;
  onFiles: (files: File[]) => void;
  onUpload: () => void;
  onDownload: (piece: PieceJointe) => void;
  onDelete: (pieceId: string) => void;
}) {
  const done = pieces.length > 0;
  return (
    <div className={cn("grid gap-3 p-4 lg:grid-cols-[280px_1fr_280px]", type.obligatoire && !done && "bg-amber-50/40 dark:bg-amber-950/15")}>
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

      <div className="grid content-start gap-2">
        <Input
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
        />
        <Button type="button" disabled={files.length === 0 || uploading} onClick={onUpload}>
          <Upload className="size-4" />
          Envoyer
        </Button>
        {files.length > 1 ? <div className="text-xs text-muted-foreground">Plusieurs images seront fusionnées en un PDF.</div> : null}
      </div>
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

function formatSize(value?: number | null) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`;
  return `${(value / 1024 / 1024).toFixed(1)} Mo`;
}
