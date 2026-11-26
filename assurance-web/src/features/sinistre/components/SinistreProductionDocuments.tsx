import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attachmentApi } from "@/features/production/api/attachments";
import type { PieceJointe } from "@/features/production/types";
import { downloadBlob } from "@/lib/download";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import type { SinistreDetail } from "../types";

export function SinistreProductionDocuments({ dossier }: { dossier: SinistreDetail }) {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const allowed = permissions.includes("piece-jointe:view") || permissions.includes("contrat:view");
  const { contratId, mouvementId, vehiculeId } = dossier.couverture;
  const documents = useQuery({
    queryKey: ["sinistre-production-documents", contratId, mouvementId, vehiculeId],
    enabled: allowed,
    queryFn: async () => {
      const movement = await attachmentApi.getContratPiecesJointes(contratId, mouvementId);
      const pieces = new Map<string, PieceJointe>();
      for (const piece of movement.pieces) {
        if (!piece.archived && (!piece.vehiculeId || piece.vehiculeId === vehiculeId)) pieces.set(piece.id, piece);
      }
      return [...pieces.values()];
    },
  });
  const download = useMutation({
    mutationFn: async (piece: PieceJointe) => ({
      blob: await attachmentApi.downloadPieceJointe(contratId, piece.id),
      name: piece.nomFichier,
    }),
    onSuccess: ({ blob, name }) => downloadBlob(blob, name),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Téléchargement impossible"),
  });

  return <div className="border-t">
    <h3 className="bg-muted/40 px-4 py-3 text-sm font-semibold">Documents liés à la production</h3>
    {!allowed ? <p className="px-4 py-3 text-xs text-muted-foreground">L’accès aux documents de production nécessite l’autorisation de consultation du contrat ou des pièces jointes.</p>
      : documents.isPending ? <p role="status" className="px-4 py-3 text-sm text-muted-foreground">Chargement des documents…</p>
      : documents.isError ? <div role="alert" className="grid gap-2 p-4 text-sm"><p className="text-destructive">{documents.error.message}</p><Button variant="outline" size="sm" onClick={() => void documents.refetch()}>Réessayer</Button></div>
      : documents.data?.length ? <ul className="divide-y">{documents.data.map((piece) => <li key={piece.id} className="flex items-start gap-2 px-4 py-3">
        <FileText className="mt-0.5 size-4 shrink-0 text-sky-700" />
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{piece.typePieceJointeLibelle || piece.nomFichier}</p>
          <p className="break-all text-xs text-muted-foreground">{piece.nomFichier}</p>
          {piece.status === "EXPIRED" ? <p className="text-xs text-amber-800 dark:text-amber-300">Expiré</p> : null}
        </div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" title="Télécharger le document de production" aria-label={`Télécharger ${piece.nomFichier}`} disabled={download.isPending} onClick={() => download.mutate(piece)}><Download className="size-4" /></Button>
      </li>)}</ul> : <p className="px-4 py-3 text-sm text-muted-foreground">Aucun document lié au contrat ou au mouvement concerné.</p>}
  </div>;
}
