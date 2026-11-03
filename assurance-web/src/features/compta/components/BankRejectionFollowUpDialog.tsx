import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, History, Landmark, Plus, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { ClientPaymentDetailsDialog } from "./ClientPaymentDetailsDialog";
import { comptaApi } from "../api";
import { rejectionInstrumentLabels, rejectionStatusLabels, rejectionStatusVariants } from "../bank-rejection-status";
import type { BankRejectionFollowUp, BankRejectionFollowUpStatus, PaymentInstrument } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY } from "../pages/treasury-format";

const eventLabels: Record<BankRejectionFollowUp["mouvements"][number]["type"], string> = {
  REJET: "Rejet bancaire", PREPARATION_REMISE: "Nouvelle remise préparée", REMISE_EN_BANQUE: "Remise en banque",
  REMPLACEMENT: "Contre-valeur enregistrée", ENCAISSEMENT: "Encaissement confirmé", SUIVI: "Mouvement de suivi",
};

export function BankRejectionFollowUpDialog({ instrument, mode, onClose }: {
  instrument: PaymentInstrument; mode: "history" | "movement"; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canViewPayment = useAuthStore(state => state.user?.permissions.includes("reglement-client:view") ?? false);
  const [paymentDetailId, setPaymentDetailId] = useState<string>();
  const [date, setDate] = useState(TODAY);
  const [status, setStatus] = useState<BankRejectionFollowUpStatus>();
  const [reason, setReason] = useState("");
  const query = useQuery({ queryKey: ["compta", "treasury", "bank-rejections", instrument.id, "history"],
    queryFn: () => comptaApi.bankRejectionHistory(instrument.id) });
  const detail = query.data;
  const allowed = detail?.statutsAutorises ?? [];
  const selectedStatus = status ?? (detail && allowed.includes(detail.statutSuivi) ? detail.statutSuivi : allowed[0]);
  const latestDate = detail?.dateMinimumMouvement;
  const save = useMutation({
    mutationFn: () => comptaApi.addBankRejectionMovement(instrument.id, { dateOperation: date, statut: selectedStatus!, motif: reason.trim() }),
    onSuccess: async () => {
      toast.success("Mouvement de suivi enregistré");
      await queryClient.invalidateQueries({ queryKey: ["compta", "treasury", "bank-rejections"] });
      onClose();
    },
    onError: error => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });
  const movement = mode === "movement";
  if (paymentDetailId) return <ClientPaymentDetailsDialog paymentId={paymentDetailId}
    closeLabel="Retour au rejet" onClose={() => setPaymentDetailId(undefined)} />;
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className={`flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 ${movement ? "sm:max-w-xl" : "sm:max-w-5xl"}`}>
      <DialogHeader className="shrink-0 border-b bg-orange-50/70 p-5 pr-12 text-left dark:bg-orange-950/20">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-orange-600 text-white">{movement ? <Plus className="size-5" /> : <History className="size-5" />}</div>
          <div className="min-w-0"><DialogTitle>{movement ? "Ajouter un mouvement" : "Détail du rejet bancaire"}</DialogTitle>
            <DialogDescription className="mt-1 break-words">{paymentModeLabel(instrument.mode)} {instrument.referenceInstrument || "-"} · {instrument.payeurNom} · {formatTreasuryMoney(instrument.montant)}</DialogDescription></div>
        </div>
      </DialogHeader>
      <div className="min-h-0 space-y-5 overflow-y-auto p-5">
        {query.isPending ? <p className="py-6 text-sm text-muted-foreground">Chargement...</p> : query.isError ? <div role="alert" className="space-y-3 text-sm">
          <p>{query.error instanceof Error ? query.error.message : "Chargement impossible"}</p><Button variant="outline" onClick={() => void query.refetch()}>Réessayer</Button>
        </div> : detail && <>
          <div className="space-y-2 border-b pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Situation actuelle</h3>
              <Badge variant={detail.reglementAnnule ? "destructive" : rejectionStatusVariants[detail.statutSuivi]}>{detail.reglementAnnule ? "Annulé" : rejectionStatusLabels[detail.statutSuivi]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{currentSituation(detail)}</p>
          </div>
          {detail.reglementAnnule && <p role="alert" className="text-sm text-destructive">Le règlement est annulé. Aucun mouvement ne peut être ajouté.</p>}
          {movement ? <>
            {!allowed.length ? <p className="text-sm text-muted-foreground">Aucun statut disponible pour cet instrument.</p> : <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2"><Label>Date du mouvement</Label><DatePicker date={date} disabled={save.isPending} maxDate={new Date(`${TODAY}T00:00:00`)}
                  minDate={latestDate ? new Date(`${latestDate}T00:00:00`) : undefined} onSelect={value => setDate(toDateOnly(value) ?? "")} /></div>
                <div className="grid gap-2"><Label htmlFor="rejection-follow-up-status">Statut</Label><Select value={selectedStatus} disabled={save.isPending} onValueChange={value => setStatus(value as BankRejectionFollowUpStatus)}>
                  <SelectTrigger id="rejection-follow-up-status"><SelectValue /></SelectTrigger><SelectContent>{allowed.map(value => <SelectItem key={value} value={value}>{rejectionStatusLabels[value]}</SelectItem>)}</SelectContent>
                </Select></div>
              </div>
              <div className="grid gap-2"><Label htmlFor="rejection-follow-up-reason">Motif *</Label><Textarea id="rejection-follow-up-reason" value={reason} maxLength={500} disabled={save.isPending} onChange={event => setReason(event.target.value)} /></div>
            </>}
          </> : <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
              <Info label="Règlement">{canViewPayment
                ? <button type="button" className="text-left font-medium text-blue-700 underline-offset-4 hover:underline dark:text-blue-300" onClick={() => setPaymentDetailId(detail.reglementId)}>{detail.numeroReglement}</button>
                : detail.numeroReglement}</Info>
              <Info label="Date du règlement">{formatTreasuryDate(detail.dateReglement)}</Info>
              <Info label="Banque">{detail.banque || "-"}</Info>
              <Info label="Date de retour">{formatTreasuryDate(detail.dateRejet)}</Info>
              {detail.contreValeurs.length > 0 && <Info label="Contre-valeur encaissée">{formatTreasuryMoney(detail.contreValeurEncaissee)}</Info>}
            </dl>
            <section className="space-y-4 border-t pt-4"><h3 className="text-sm font-semibold">Historique</h3>
              <ol>{detail.mouvements.map((event, index) => {
                const bank = event.type === "REMISE_EN_BANQUE";
                const rejected = event.type === "REJET";
                const confirmed = event.type === "ENCAISSEMENT";
                const Icon = rejected ? CircleAlert : bank ? Landmark : confirmed ? CheckCircle2 : event.type === "PREPARATION_REMISE" ? RefreshCcw : History;
                const title = event.libelle || (event.type === "SUIVI" ? `Suivi : ${rejectionStatusLabels[event.statut]}` : eventLabels[event.type]);
                return <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < detail.mouvements.length - 1 && <span aria-hidden className="absolute bottom-0 left-4 top-8 w-px bg-border" />}
                  <span className={`relative flex size-8 shrink-0 items-center justify-center rounded-md ${rejected ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" : confirmed ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400"}`}><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h4 className="text-sm font-semibold">{title}</h4><time dateTime={event.date} className="text-xs text-muted-foreground">{formatTreasuryDate(event.date)}</time></div>
                    {event.motif && event.motif !== title && <p className="whitespace-pre-wrap break-words text-sm">{event.motif}</p>}
                    {event.instrumentSourceId && event.instrumentSourceId !== instrument.id && <p className="text-xs text-muted-foreground">Sur une contre-valeur</p>}
                    {event.bordereauId && <Link className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300" to={`/app/compta/tresorerie/bordereaux-remise/${event.bordereauId}`}><Landmark className="size-3.5" />{event.numeroBordereau || "Bordereau"}</Link>}
                    <p className="text-xs text-muted-foreground">{event.historiqueExistant ? "Historique existant" : event.utilisateur || "Utilisateur non renseigné"}</p>
                  </div>
                </li>;
              })}</ol>
              {!detail.mouvements.length && <p className="py-3 text-sm text-muted-foreground">Aucun événement enregistré.</p>}
            </section>
            {detail.contreValeurs.length > 0 && <section className="space-y-2"><h3 className="text-sm font-semibold">Contre-valeurs</h3><div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[440px] text-sm">
              <thead className="bg-muted/60 text-xs uppercase"><tr>{["Mode", "Référence", "Montant", "État"].map(label => <th key={label} className="px-3 py-2 text-left">{label}</th>)}</tr></thead>
              <tbody className="divide-y">{detail.contreValeurs.map(value => <tr key={value.id}><td className="px-3 py-2">{paymentModeLabel(value.mode)}</td><td className="px-3 py-2">{value.reference || "-"}</td><td className="px-3 py-2 font-semibold tabular-nums">{formatTreasuryMoney(value.montant)}</td><td className="px-3 py-2">{rejectionInstrumentLabels[value.statut]}</td></tr>)}</tbody>
            </table></div></section>}
          </>}
        </>}
      </div>
      <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-4">
        <Button variant="outline" disabled={save.isPending} onClick={onClose}>{movement ? "Annuler" : "Fermer"}</Button>
        {movement && <Button disabled={save.isPending || !detail || query.isError || !selectedStatus || !allowed.includes(selectedStatus) || !reason.trim() || !date || Boolean(latestDate && date < latestDate)} onClick={() => save.mutate()}><Plus className="size-4" />{save.isPending ? "Enregistrement..." : "Enregistrer le mouvement"}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{children}</dd></div>;
}

function currentSituation(detail: BankRejectionFollowUp) {
  if (detail.reglementAnnule) return "Règlement annulé.";
  if (detail.statutSuivi === "REGLE_CV") return "Montant intégralement réglé par contre-valeur.";
  if (detail.statutSuivi === "CONTENTIEUX") return "Recouvrement en contentieux.";
  if (detail.statutInstrument === "CONFIRME") return "Encaissement confirmé.";
  if (detail.statutInstrument === "REMIS_EN_BANQUE") {
    const lastRemittance = detail.mouvements.filter(event => event.type === "REMISE_EN_BANQUE" && event.instrumentSourceId === detail.instrumentId).at(-1);
    return `${lastRemittance ? `Remis en banque le ${formatTreasuryDate(lastRemittance.date)}. ` : ""}En attente d’encaissement.`;
  }
  if (detail.statutInstrument === "REMPLACE") return "Contre-valeur en attente d’encaissement.";
  if (detail.statutInstrument === "EN_ATTENTE") return "Nouvelle remise préparée, non encore déposée en banque.";
  return "En attente de traitement du rejet.";
}
