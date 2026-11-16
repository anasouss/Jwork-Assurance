import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob } from "@/lib/download";
import { toast } from "@/lib/toast";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";

export function InvoiceActionDialog({ id, action, onClose }: { id: string; action: "delete" | "cancel"; onClose: () => void }) {
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const detail = useQuery({ queryKey: ["compta", "client-document", id], queryFn: () => comptaApi.clientDocument(id), staleTime: 0 });
  const deletion = action === "delete";
  const mutation = useMutation({
    mutationFn: async () => {
      if (deletion) await comptaApi.deleteClientDocument(id, reason.trim());
      else await comptaApi.cancelClientDocument(id, reason.trim());
    },
    onSuccess: async () => {
      toast.success(deletion ? "Facture supprimée définitivement" : "Facture annulée");
      await Promise.all(["convention-invoices", "convention-invoice-receivables", "convention-billing-preparation", "convention-billing", "client-documents", "client-document-sources", "client-receivables", "client-invoice-receivables"]
        .map(key => client.invalidateQueries({ queryKey: ["compta", key] })));
      if (deletion) client.removeQueries({ queryKey: ["compta", "client-document", id] });
      else await client.invalidateQueries({ queryKey: ["compta", "client-document", id] });
      onClose();
    },
    onError: error => { toast.error(error.message); void detail.refetch(); },
  });
  const allowed = detail.data?.statut === "EMIS" && (!deletion || detail.data.suppressionAutorisee === true);
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent onEscapeKeyDown={event => { if (mutation.isPending) event.preventDefault(); }} onPointerDownOutside={event => { if (mutation.isPending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{deletion ? "Supprimer définitivement" : "Annuler"} {detail.data?.numero ?? "la facture"} ?</DialogTitle>
        <DialogDescription>{deletion ? "Suppression irréversible du document et de ses lignes. Les périodes sont libérées et une trace est conservée dans le journal d’activité."
          : "La facture est conservée avec le statut annulé. Ses périodes redeviennent disponibles à la facturation."}</DialogDescription>
      </DialogHeader>
      {detail.isPending || detail.isFetching ? <p role="status" className="text-sm">Vérification de la facture…</p>
        : detail.isError ? <p role="alert" className="text-sm text-destructive">{detail.error.message}</p>
          : !allowed ? <p role="alert" className="text-sm text-destructive">{deletion ? detail.data?.motifBlocageSuppression || "Suppression non autorisée." : "Cette facture ne peut plus être annulée."}</p>
            : <div className="grid gap-2"><Label htmlFor="invoice-action-reason">Motif <span className="text-destructive">*</span></Label>
              <Textarea id="invoice-action-reason" required maxLength={500} value={reason} disabled={mutation.isPending} onChange={event => setReason(event.target.value)} /></div>}
      <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={onClose}>Fermer</Button>
        <Button variant="destructive" disabled={!allowed || !reason.trim() || detail.isFetching || detail.isError || mutation.isPending} onClick={() => mutation.mutate()}>
          {deletion ? <Trash2 className="size-4" /> : <Ban className="size-4" />}{mutation.isPending ? "Traitement…" : deletion ? "Supprimer définitivement" : "Confirmer l’annulation"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`)) : "-";
}

export function InvoiceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: ["compta", "client-document", id], queryFn: () => comptaApi.clientDocument(id) });
  const pdf = useMutation({ mutationFn: () => comptaApi.clientDocumentPdf(id),
    onSuccess: blob => downloadBlob(blob, `${detail.data?.numero ?? "facture"}.pdf`), onError: error => toast.error(error.message) });
  const document = detail.data;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
      <DialogHeader><DialogTitle>{document?.numero ?? "Détail de la facture"}</DialogTitle>
        <DialogDescription>{document ? `${document.conventionFacturee || "Convention"} · ${document.payeurNom}` : "Chargement de la facture…"}</DialogDescription>
      </DialogHeader>
      {detail.isError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{detail.error.message}</p><Button variant="outline" onClick={() => void detail.refetch()}>Réessayer</Button></div>
        : detail.isPending ? <p role="status" className="p-6 text-sm text-muted-foreground">Chargement…</p>
          : document && <>
            <dl className="grid grid-cols-2 gap-4 border-y py-3 text-sm sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Émise le</dt><dd>{date(document.dateEmission)}</dd></div>
              <div><dt className="text-muted-foreground">Échéance</dt><dd>{date(document.dateEcheance)}</dd></div>
              <div><dt className="text-muted-foreground">Période</dt><dd>{date(document.periodeDebut)} – {date(document.periodeFin)}</dd></div>
              <div><dt className="text-muted-foreground">Total MAD</dt><dd className="font-semibold">{formatAccountingAmount(document.totalDocument)}</dd></div>
            </dl>
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm">
              <thead className="bg-orange-600 text-left text-xs uppercase text-white"><tr>{["Police", "Assuré", "Mouvement", "Période", "TTC"].map(label => <th key={label} className={`px-3 py-3 ${label === "TTC" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
              <tbody className="divide-y">{document.lignes.map(line => <tr key={line.id}>
                <td className="px-3 py-3">{line.numeroPolice || "-"}</td><td className="px-3 py-3">{line.assureConvention || "-"}</td>
                <td className="px-3 py-3">{line.mouvement || "-"}</td><td className="px-3 py-3">{date(line.dateOperation)} – {date(line.dateEcheance)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatAccountingAmount(line.montantTtc)}</td>
              </tr>)}</tbody>
            </table></div>
          </>}
      <DialogFooter><Button variant="outline" onClick={onClose}>Fermer</Button>
        <Button disabled={!document || pdf.isPending} onClick={() => pdf.mutate()}><Download className="size-4" />Télécharger PDF</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
