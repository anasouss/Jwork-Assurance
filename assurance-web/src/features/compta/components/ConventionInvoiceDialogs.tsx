import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Download, Eye, Trash2 } from "lucide-react";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob } from "@/lib/download";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import { paymentModeLabel } from "../pages/treasury-format";
import { ClientPaymentDetailsDialog } from "./ClientPaymentDetailsDialog";

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
  const canViewPayments = useAuthStore(state => state.user?.permissions.includes("reglement-client:view") ?? false);
  const [paymentPage, setPaymentPage] = useState(0);
  const [paymentId, setPaymentId] = useState<string>();
  const detail = useQuery({ queryKey: ["compta", "client-document", id], queryFn: () => comptaApi.clientDocument(id) });
  const pdf = useMutation({ mutationFn: () => comptaApi.clientDocumentPdf(id),
    onSuccess: blob => downloadBlob(blob, `${detail.data?.numero ?? "facture"}.pdf`), onError: error => toast.error(error.message) });
  const document = detail.data;
  const outgoing = (document?.totalDocument ?? 0) < 0;
  const payments = useQuery({
    queryKey: ["compta", "client-payments", "invoice", id, outgoing, paymentPage],
    queryFn: () => comptaApi.conventionPayments({ documentId: id, sens: outgoing ? "SORTIE" : "ENTREE", page: paymentPage, size: 10 }),
    enabled: canViewPayments && Boolean(document), staleTime: 0,
  });
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
            {canViewPayments && <section className="grid gap-3 border-t pt-4">
              <h2 className="font-semibold">{outgoing ? "Règlements de la facture" : "Encaissements de la facture"}</h2>
              <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm">
                <thead className="bg-orange-600 text-left text-xs uppercase text-white"><tr>
                  {["Référence", "Date", "Mode", "Montant affecté", "État", "Actions"].map(label => <th key={label} className={`px-3 py-3 ${label === "Montant affecté" ? "text-right" : ""}`}>{label}</th>)}
                </tr></thead>
                <tbody className="divide-y">
                  {payments.isPending ? <TableRowsSkeleton colSpan={6} rows={2} />
                    : payments.isError ? <tr><td colSpan={6} className="p-6 text-center"><p role="alert" className="text-destructive">{payments.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void payments.refetch()}>Réessayer</Button></td></tr>
                      : !payments.data?.rows.length ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucun règlement affecté à cette facture.</td></tr>
                        : payments.data.rows.map(payment => <tr key={payment.id}>
                          <td className="px-3 py-3"><button type="button" className="font-medium text-sky-700 hover:underline dark:text-sky-300" onClick={() => setPaymentId(payment.id)}>{payment.numero}</button>
                            {!outgoing && <div className="mt-1 text-xs text-muted-foreground">{payment.circuit === "DIRECT_COMPAGNIE" ? `Compagnie · ${payment.compagnieDirecte || "-"}` : "Cabinet"}</div>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">{date(payment.dateReglement)}</td>
                          <td className="px-3 py-3">{[...new Set(payment.instruments.filter(instrument => instrument.statut !== "REMPLACE").map(instrument => paymentModeLabel(instrument.mode)))].join(", ") || "-"}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{payment.montantAffecteDocument == null ? "-" : formatAccountingAmount(payment.montantAffecteDocument)}</td>
                          <td className="px-3 py-3"><Badge variant={payment.statut === "VALIDE" ? "success" : "secondary"}>{payment.statut === "VALIDE" ? "Enregistré" : "Annulé"}</Badge></td>
                          <td className="px-3 py-3"><Button variant="ghost" size="icon" title="Voir le règlement" aria-label={`Voir ${payment.numero}`} onClick={() => setPaymentId(payment.id)}><Eye className="size-4" /></Button></td>
                        </tr>)}
                </tbody>
              </table></div>
              <ServerPagination page={payments.data?.page.number ?? paymentPage} totalPages={payments.data?.page.totalPages ?? 0}
                totalElements={payments.data?.page.totalElements ?? 0} loading={payments.isFetching} onPageChange={setPaymentPage} />
              {paymentId && <ClientPaymentDetailsDialog paymentId={paymentId} onClose={() => setPaymentId(undefined)} />}
            </section>}
          </>}
      <DialogFooter><Button variant="outline" onClick={onClose}>Fermer</Button>
        <Button disabled={!document || pdf.isPending} onClick={() => pdf.mutate()}><Download className="size-4" />Télécharger PDF</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
