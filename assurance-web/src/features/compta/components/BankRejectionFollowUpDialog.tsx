import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Plus, UserRound } from "lucide-react";
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
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className={`flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 ${movement ? "sm:max-w-xl" : "sm:max-w-5xl"}`}>
      <DialogHeader className="shrink-0 border-b bg-orange-50/70 p-5 pr-12 text-left dark:bg-orange-950/20">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-orange-600 text-white">{movement ? <Plus className="size-5" /> : <History className="size-5" />}</div>
          <div className="min-w-0"><DialogTitle>{movement ? "Ajouter un mouvement" : "Historique du rejet"}</DialogTitle>
            <DialogDescription className="mt-1 break-words">{paymentModeLabel(instrument.mode)} {instrument.referenceInstrument || "-"} · {instrument.payeurNom} · {formatTreasuryMoney(instrument.montant)}</DialogDescription></div>
        </div>
      </DialogHeader>
      <div className="min-h-0 space-y-5 overflow-y-auto p-5">
        {query.isPending ? <p className="py-6 text-sm text-muted-foreground">Chargement...</p> : query.isError ? <div role="alert" className="space-y-3 text-sm">
          <p>{query.error instanceof Error ? query.error.message : "Chargement impossible"}</p><Button variant="outline" onClick={() => void query.refetch()}>Réessayer</Button>
        </div> : detail && <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <Badge variant={rejectionStatusVariants[detail.statutSuivi]}>{rejectionStatusLabels[detail.statutSuivi]}</Badge>
            <span className="text-sm text-muted-foreground">{rejectionInstrumentLabels[detail.statutInstrument]}</span>
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
              <Info label="Règlement"><Link className="font-medium text-blue-700 hover:underline dark:text-blue-300" to={`/app/compta/reglements/${detail.reglementId}`}>{detail.numeroReglement}</Link></Info>
              <Info label="Date du règlement">{formatTreasuryDate(detail.dateReglement)}</Info>
              <Info label="Banque">{detail.banque || "-"}</Info>
              <Info label="Date de retour">{formatTreasuryDate(detail.dateRejet)}</Info>
              <div className="col-span-2"><Info label="Motif du retour">{detail.motifRejet || "-"}</Info></div>
              {detail.contreValeurs.length > 0 && <Info label="Contre-valeur encaissée">{formatTreasuryMoney(detail.contreValeurEncaissee)}</Info>}
            </dl>
            <section className="space-y-2"><h3 className="text-sm font-semibold">Mouvements du rejet</h3>
              <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[680px] text-sm">
                <thead className="bg-orange-600 text-xs uppercase text-white"><tr>{["Date", "Mouvement", "Statut", "Motif", "Utilisateur"].map(label => <th key={label} className="px-3 py-3 text-left">{label}</th>)}</tr></thead>
                <tbody className="divide-y">{detail.mouvements.map(event => <tr key={event.id} className="align-top hover:bg-muted/20">
                  <td className="whitespace-nowrap px-3 py-3">{formatTreasuryDate(event.date)}</td>
                  <td className="px-3 py-3">{eventLabels[event.type]}{event.instrumentSourceId && event.instrumentSourceId !== instrument.id && <span className="block text-xs text-muted-foreground">Contre-valeur</span>}</td>
                  <td className="px-3 py-3"><Badge variant={rejectionStatusVariants[event.statut]}>{rejectionStatusLabels[event.statut]}</Badge></td>
                  <td className="max-w-96 whitespace-pre-wrap break-words px-3 py-3">{event.motif || "-"}</td>
                  <td className="px-3 py-3">{event.utilisateur || "-"}</td>
                </tr>)}{!detail.mouvements.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Aucun mouvement enregistré.</td></tr>}</tbody>
              </table></div>
            </section>
            {detail.remises.length > 0 && <section className="space-y-2"><h3 className="text-sm font-semibold">Remises bancaires</h3><ul className="divide-y border-y text-sm">{detail.remises.map((line, index) => <li key={`${line.id}-${index}`} className="flex flex-wrap justify-between gap-2 py-2">
              <Link className="font-medium text-blue-700 hover:underline dark:text-blue-300" to={`/app/compta/tresorerie/bordereaux-remise/${line.id}`}>{line.numero}</Link>
              <span>{formatTreasuryDate(line.dateDepot)} · {line.statut === "REJETEE" ? "Rejetée" : line.statut === "ENCAISSEE" ? "Encaissée" : "Remise"}</span>
            </li>)}</ul></section>}
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

export function BankRejectionPayerDialog({ instrument, onClose }: { instrument: PaymentInstrument; onClose: () => void }) {
  const query = useQuery({ queryKey: ["compta", "treasury", "bank-rejections", instrument.id, "payer"], queryFn: () => comptaApi.bankRejectionPayer(instrument.id) });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><div className="flex items-center gap-2"><UserRound className="size-5 text-emerald-600" /><DialogTitle>Fiche client</DialogTitle></div><DialogDescription>{instrument.payeurNom}</DialogDescription></DialogHeader>
    {query.isPending ? <p className="py-6 text-sm text-muted-foreground">Chargement...</p> : query.isError ? <div role="alert" className="space-y-3 text-sm"><p>{query.error instanceof Error ? query.error.message : "Chargement impossible"}</p><Button variant="outline" onClick={() => void query.refetch()}>Réessayer</Button></div> : <div className="space-y-5">
      {query.data.groupe && <p className="text-sm"><span className="text-muted-foreground">Groupe : </span>{query.data.groupe}</p>}
      {query.data.clients.map(client => <section key={client.id} className="space-y-3 border-t pt-4"><h3 className="font-semibold">{client.nom} <span className="text-sm font-normal text-muted-foreground">{client.code}</span></h3><dl className="grid grid-cols-2 gap-4 text-sm">
        <Info label="CIN">{client.cin || "-"}</Info><Info label="RC">{client.rc || "-"}</Info><Info label="ICE">{client.ice || "-"}</Info><Info label="Ville">{client.ville || "-"}</Info><div className="col-span-2"><Info label="Adresse">{client.adresse || "-"}</Info></div><Info label="Téléphone">{client.telephone || "-"}</Info><Info label="E-mail">{client.email || "-"}</Info>
      </dl></section>)}
      {!query.data.clients.length && <p className="py-4 text-sm text-muted-foreground">Aucune fiche client rattachée à ce payeur.</p>}
    </div>}
    <DialogFooter><Button variant="outline" onClick={onClose}>Fermer</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{children}</dd></div>;
}
