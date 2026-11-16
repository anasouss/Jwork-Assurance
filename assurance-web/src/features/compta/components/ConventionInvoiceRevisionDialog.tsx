import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { toast } from "@/lib/toast";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import type { ClientDocument } from "../types";
import { ConventionInvoiceLines } from "./ConventionInvoiceLines";

export function ConventionInvoiceRevisionDialog({ id, onClose, onRevised }: {
  id: string; onClose: () => void; onRevised: (document: ClientDocument) => void;
}) {
  const [busy, setBusy] = useState(false);
  const detail = useQuery({ queryKey: ["compta", "client-document", id], queryFn: () => comptaApi.clientDocument(id), staleTime: 0 });
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Rectifier {detail.data?.numero ?? "la facture"}</DialogTitle>
        <DialogDescription>Une nouvelle version remplace l’original sans l’effacer. Les ajouts doivent appartenir à la même convention, période et au même sens. Les échéances retirées redeviennent disponibles à la facturation.</DialogDescription>
      </DialogHeader>
      {detail.isPending ? <p role="status">Vérification de la facture…</p>
        : detail.isError ? <><p role="alert" className="text-destructive">{detail.error.message}</p><Button variant="outline" onClick={() => void detail.refetch()}>Réessayer</Button></>
          : !detail.data?.rectificationAutorisee ? <><p role="alert" className="text-destructive">{detail.data?.motifBlocageRectification || "Rectification non autorisée."}</p><Button variant="outline" onClick={onClose}>Fermer</Button></>
            : <RevisionForm document={detail.data} onClose={onClose} onRevised={onRevised} onPendingChange={setBusy} />}
    </DialogContent>
  </Dialog>;
}

function RevisionForm({ document, onClose, onRevised, onPendingChange }: {
  document: ClientDocument; onClose: () => void; onRevised: (document: ClientDocument) => void; onPendingChange: (busy: boolean) => void;
}) {
  const client = useQueryClient();
  const [selected, setSelected] = useState(() => new Set(document.lignes.flatMap(line => line.echeanceFacturationConventionId ? [line.echeanceFacturationConventionId] : [])));
  const [notes, setNotes] = useState(document.notes ?? "");
  const [reason, setReason] = useState("");
  const selectedIds = [...selected].sort();
  const sources = useQuery({
    queryKey: ["compta", "convention-revision-sources", document.id],
    queryFn: () => comptaApi.conventionRevisionSources(document.id), staleTime: 0,
  });
  const preview = useQuery({
    queryKey: ["compta", "convention-revision-preview", document.id, selectedIds],
    queryFn: () => comptaApi.previewConventionRevision(document.id, selectedIds),
    enabled: selectedIds.length > 0, staleTime: 0,
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayValue = toDateOnly(today)!;
  const [dueDate, setDueDate] = useState(document.dateEcheance && document.dateEcheance >= todayValue ? document.dateEcheance : todayValue);
  const maximum = document.delaiPaiementJours == null ? undefined : new Date(today.getFullYear(), today.getMonth(), today.getDate() + document.delaiPaiementJours);
  const mutation = useMutation({
    onMutate: () => onPendingChange(true),
    onSettled: () => onPendingChange(false),
    mutationFn: () => {
      if (!preview.data || preview.isFetching || preview.isError) throw new Error("Actualisez l’aperçu avant de valider.");
      return comptaApi.reviseConventionInvoice(document.id, {
      echeanceIds: selectedIds, montantAttendu: preview.data.total, motif: reason.trim(), notes: notes.trim() || undefined,
      dateEcheance: document.dateEcheance ? dueDate : undefined,
    }); },
    onSuccess: async replacement => {
      toast.success(`Facture rectifiée : ${replacement.numero}`);
      await Promise.all(["convention-invoices", "convention-invoice-receivables", "convention-billing-preparation", "convention-billing", "client-documents", "client-document", "client-invoice-receivables", "client-receivables", "convention-revision-sources", "convention-revision-preview"]
        .map(key => client.invalidateQueries({ queryKey: ["compta", key] })));
      onRevised(replacement);
    },
    onError: error => { toast.error(error.message); void sources.refetch(); void preview.refetch(); },
  });
  return <>
    <h3 className="font-semibold">Lignes de la facture d’origine</h3>
    <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm">
      <thead className="bg-orange-600 text-left text-xs uppercase text-white"><tr>{["Conserver", "Période facturée", "Police", "Assuré", "Montant"].map(title => <th key={title} className="px-3 py-3">{title}</th>)}</tr></thead>
      <tbody className="divide-y">{document.lignes.map(line => <tr key={line.id}>
        <td className="px-3 py-3"><Checkbox aria-label={`Conserver l’échéance de la police ${line.numeroPolice}`} checked={selected.has(line.echeanceFacturationConventionId!)} disabled={mutation.isPending} onCheckedChange={checked => setSelected(current => {
          const next = new Set(current); if (checked) next.add(line.echeanceFacturationConventionId!); else next.delete(line.echeanceFacturationConventionId!); return next;
        })} /></td>
        <td className="px-3 py-3">{date(line.periodeFactureeDebut)} au {date(line.periodeFactureeFin)}</td>
        <td className="px-3 py-3">{line.numeroPolice || "-"}</td><td className="px-3 py-3">{line.assureConvention || "-"}</td>
        <td className="px-3 py-3 text-right tabular-nums">{formatAccountingAmount(line.montantTtc)}</td>
      </tr>)}</tbody>
    </table></div>
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Lignes disponibles à ajouter</h3>
        <Button size="icon" variant="outline" title="Actualiser les lignes disponibles" aria-label="Actualiser les lignes disponibles" disabled={sources.isFetching || mutation.isPending} onClick={() => void sources.refetch()}><RefreshCw className="size-4" /></Button>
      </div>
      {sources.isPending ? <p role="status" className="text-sm text-muted-foreground">Recherche des lignes éligibles…</p>
        : sources.isError ? <p role="alert" className="text-sm text-destructive">{sources.error.message}</p>
          : !sources.data?.lignes.length ? <p className="text-sm text-muted-foreground">Aucune autre ligne éligible pour cette convention et cette période.</p>
            : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm">
              <thead className="bg-orange-600 text-left text-xs uppercase text-white"><tr>{["Ajouter", "Période facturée", "Police", "Assuré", "Montant"].map(title => <th key={title} className="px-3 py-3">{title}</th>)}</tr></thead>
              <tbody className="divide-y">{sources.data.lignes.flatMap(source => (source.details.length ? source.details : [null]).map((line, index) => <tr key={`${source.echeanceId}:${index}`}>
                {index === 0 && <><td rowSpan={Math.max(1, source.details.length)} className="px-3 py-3"><Checkbox aria-label={`Ajouter l’échéance de ${source.details[0]?.numeroPolice ?? source.echeanceId}`} checked={selected.has(source.echeanceId)} disabled={mutation.isPending || sources.isFetching || Boolean(source.blocage)} onCheckedChange={checked => setSelected(current => {
                  const next = new Set(current); if (checked) next.add(source.echeanceId); else next.delete(source.echeanceId); return next;
                })} /></td><td rowSpan={Math.max(1, source.details.length)} className="px-3 py-3">{date(source.periodeDebut)} au {date(source.periodeFin)}</td></>}
                {line ? <><td className="px-3 py-3">{line.numeroPolice || "-"}</td><td className="px-3 py-3">{line.assure || "-"}</td><td className="px-3 py-3 text-right tabular-nums">{line.montantAPayer == null ? "-" : formatAccountingAmount(line.montantAPayer)}</td></>
                  : <td colSpan={3} className="px-3 py-3 text-destructive">{source.blocage}</td>}
              </tr>))}</tbody>
            </table></div>}
    </section>
    {selected.size > 0 && <section className="grid gap-2 border-y py-3">
      {preview.isFetching ? <p role="status" className="text-sm text-muted-foreground">Calcul de la nouvelle facture…</p>
        : preview.isError ? <div role="alert"><p className="text-sm text-destructive">{preview.error.message}</p><Button variant="outline" className="mt-2" onClick={() => void preview.refetch()}>Actualiser l’aperçu</Button></div>
          : preview.data && <>
            <div className="flex justify-between gap-3 font-semibold"><span>Total nouvelle facture · MAD</span><span className="tabular-nums">{formatAccountingAmount(preview.data.total)}</span></div>
            <details><summary className="cursor-pointer text-sm">Aperçu de la nouvelle facture</summary><div className="mt-3"><ConventionInvoiceLines preview={preview.data} headerTone="accounting" /></div></details>
          </>}
    </section>}
    <div className="grid gap-4 sm:grid-cols-2">
      {document.dateEcheance && <div className="grid content-start gap-1.5"><Label>Date limite de paiement</Label>
        <DatePicker date={dueDate} minDate={today} maxDate={maximum} disabled={mutation.isPending} onSelect={value => setDueDate(toDateOnly(value) ?? "")} />
      </div>}
      <div className="grid gap-1.5"><Label htmlFor="revision-notes">Notes</Label><Textarea id="revision-notes" maxLength={1000} value={notes} disabled={mutation.isPending} onChange={event => setNotes(event.target.value)} /></div>
      <div className="col-span-full grid gap-1.5"><Label htmlFor="revision-reason">Motif de rectification <span className="text-destructive">*</span></Label>
        <Textarea id="revision-reason" required maxLength={500} value={reason} disabled={mutation.isPending} onChange={event => setReason(event.target.value)} />
      </div>
    </div>
    <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={onClose}>Annuler</Button>
      <Button disabled={!selected.size || !reason.trim() || Boolean(document.dateEcheance && !dueDate) || mutation.isPending || !preview.data || preview.isFetching || preview.isError || sources.isFetching || sources.isError} onClick={() => mutation.mutate()}><Pencil className="size-4" />{mutation.isPending ? "Rectification…" : "Établir la nouvelle version"}</Button>
    </DialogFooter>
  </>;
}

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`)) : "-";
}
