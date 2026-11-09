import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, CheckCircle2, CircleAlert, History, Landmark, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import { formatTreasuryDate, paymentModeLabel } from "../pages/treasury-format";
import type { ClientPayment, PaymentAllocationStatus, PaymentInstrumentStatus } from "../types";
import { instrumentHistoryRows } from "../payment-instrument-history";

const statusLabels: Record<PaymentInstrumentStatus, string> = {
  EN_ATTENTE: "En instance", REMIS_EN_BANQUE: "Remis en banque", CONFIRME: "Encaissé",
  REJETE: "Retourné / impayé", REMPLACE: "Remplacé",
};
const statusVariants = { EN_ATTENTE: "warning", REMIS_EN_BANQUE: "info", CONFIRME: "success", REJETE: "red", REMPLACE: "gray" } as const;
const allocationLabels: Record<PaymentAllocationStatus, string> = { EN_ATTENTE: "En attente", CONFIRMEE: "Confirmée", ANNULEE: "Annulée" };
const allocationVariants = { EN_ATTENTE: "warning", CONFIRMEE: "success", ANNULEE: "red" } as const;

export function PaymentInstrumentDetailsDialog({ paymentId, instrumentId, onClose }: {
  paymentId: string;
  instrumentId: string;
  onClose: () => void;
}) {
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(instrumentId);
  useEffect(() => setSelectedInstrumentId(instrumentId), [instrumentId]);
  const query = useQuery({
    queryKey: ["compta", "client-payment", paymentId],
    queryFn: () => comptaApi.clientPayment(paymentId),
    refetchOnMount: "always",
  });
  const payment = query.data;
  const instrument = payment?.instruments.find(item => item.id === selectedInstrumentId);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
      <DialogHeader className="shrink-0 border-b bg-orange-50/70 p-5 pr-12 text-left dark:bg-orange-950/20">
        <DialogTitle className="break-words leading-snug">{instrument
          ? `${paymentModeLabel(instrument.mode)}${instrument.referenceInstrument ? ` · ${instrument.referenceInstrument}` : ""}`
          : "Détail du moyen de règlement"}</DialogTitle>
        <DialogDescription className="break-words">{payment ? `${payment.numero} · ${payment.payeurNom}` : "Informations et affectations du moyen sélectionné."}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {query.isPending ? <div role="status" className="space-y-4"><span className="sr-only">Chargement du moyen de règlement...</span><Skeleton className="h-28 w-full" /><Skeleton className="h-40 w-full" /></div>
          : query.isError ? <div role="alert" className="space-y-3 text-sm"><p>{query.error instanceof Error ? query.error.message : "Chargement impossible."}</p><Button variant="outline" onClick={() => void query.refetch()}>Réessayer</Button></div>
            : !instrument ? <p role="alert" className="text-sm text-muted-foreground">Ce moyen ne figure plus dans ce règlement. Relancez la recherche.</p>
              : <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <p className="text-xl font-semibold tabular-nums">{formatAccountingAmount(instrument.montant)} <span className="text-sm font-normal text-muted-foreground">MAD</span></p>
                  <div className="flex flex-wrap gap-2"><Badge variant={statusVariants[instrument.statut]}>{instrument.statut === "REJETE" && payment?.statut === "ANNULE" && !instrument.dateRejet ? "Annulé avec le règlement" : statusLabels[instrument.statut]}</Badge>
                    {payment?.statut === "ANNULE" && <Badge variant="red">Règlement annulé</Badge>}</div>
                </div>
                {payment && <InstrumentLifecycle key={instrument.id} payment={payment} instrument={instrument} onSelect={setSelectedInstrumentId} />}
                <section className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold">Affectations</h3>
                  <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[600px] text-sm">
                    <thead className="bg-muted text-left"><tr>
                      <th scope="col" className="px-3 py-2 font-medium">Client</th><th scope="col" className="px-3 py-2 font-medium">Police / Contrat / Document</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Montant</th><th scope="col" className="px-3 py-2 font-medium">Statut</th>
                    </tr></thead>
                    <tbody className="divide-y">{instrument.affectations.map(allocation => <tr key={allocation.id} className="align-top">
                      <td className="max-w-48 break-words px-3 py-3">{allocation.payeurNom || "-"}</td>
                      <td className="max-w-72 break-words px-3 py-3"><p className="font-medium">{allocation.numeroPolice || allocation.referenceDocument || allocation.destination || "-"}</p>
                        {allocation.mouvement && <p className="mt-1 text-xs text-muted-foreground">{allocation.mouvement}</p>}
                        {allocation.numeroPolice && allocation.referenceDocument && <p className="mt-1 text-xs text-muted-foreground">{allocation.referenceDocument}</p>}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatAccountingAmount(allocation.montant)}</td>
                      <td className="px-3 py-3"><Badge variant={allocationVariants[allocation.statut]}>{allocationLabels[allocation.statut]}</Badge></td>
                    </tr>)}
                      {!instrument.affectations.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Aucune affectation pour ce moyen.</td></tr>}
                    </tbody>
                  </table></div>
                </section>
              </div>}
      </div>
      <DialogFooter className="shrink-0 border-t px-5 py-4">
        <Button variant="outline" onClick={onClose}>Fermer</Button>
        <Button asChild><Link to={`/app/compta/reglements/${paymentId}`}><ArrowUpRight className="size-4" />Ouvrir le règlement</Link></Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

type Instrument = ClientPayment["instruments"][number];

function InstrumentLifecycle({ payment, instrument, onSelect }: {
  payment: ClientPayment; instrument: Instrument; onSelect: (id: string) => void;
}) {
  const canViewTreasury = useAuthStore(state => state.user?.permissions.includes("tresorerie:view") ?? false);
  const paper = instrument.mode === "CHEQUE" || instrument.mode === "EFFET";
  const hasRejection = Boolean(instrument.dateRejet || (instrument.statut === "REJETE" && payment.statut !== "ANNULE"));
  const history = useQuery({
    queryKey: ["compta", "treasury", "bank-rejections", instrument.id, "history"],
    queryFn: () => comptaApi.bankRejectionHistory(instrument.id),
    enabled: canViewTreasury && paper && hasRejection,
    refetchOnMount: "always",
  });
  const remittance = useQuery({
    queryKey: ["compta", "treasury", "instrument-remittance", instrument.bordereauRemiseId],
    queryFn: () => comptaApi.remittanceSlip(instrument.bordereauRemiseId!),
    enabled: canViewTreasury && paper && Boolean(instrument.bordereauRemiseId),
    refetchOnMount: "always",
  });
  const events = instrumentHistoryRows(history.data?.mouvements ?? [], instrument.id);
  const ownEvents = events.filter(event => !event.instrumentSourceId || event.instrumentSourceId === instrument.id);
  const deposits = ownEvents.filter(event => event.type === "REMISE_EN_BANQUE");
  const lastReturn = ownEvents.filter(event => event.type === "REJET").at(-1);
  const lastCollection = ownEvents.filter(event => event.type === "ENCAISSEMENT").at(-1);
  const prepared = ownEvents.filter(event => event.type === "PREPARATION_REMISE").at(-1);
  const awaitingDeposit = Boolean(prepared && instrument.statut === "EN_ATTENTE");
  const children = payment.instruments.filter(item => item.instrumentRemplaceId === instrument.id);
  const parent = payment.instruments.find(item => item.id === instrument.instrumentRemplaceId);
  const collectionDate = lastCollection?.date || (instrument.statut === "CONFIRME" ? instrument.dateStatut : undefined);
  function slipLabel(id?: string | null, number?: string | null) {
    return id && canViewTreasury ? <Link className="text-sky-700 underline-offset-4 hover:underline dark:text-sky-300" to={`/app/compta/tresorerie/bordereaux-remise/${id}`}>{number || "Voir le bordereau"}</Link> : number || "-";
  }
  return <>
    <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <Field label={paper ? `${paymentModeLabel(instrument.mode)} n°` : "Référence"}>{instrument.referenceInstrument || "-"}</Field>
      <Field label="Date du règlement">{formatTreasuryDate(payment.dateReglement)}</Field>
      <Field label={paper ? "Date de réception" : "Date du moyen"}>{formatTreasuryDate(instrument.dateInstrument)}</Field>
      {paper && <Field label="Date de valeur / échéance">{formatTreasuryDate(instrument.dateEcheance)}</Field>}
      {(paper || instrument.banqueEmettrice) && <Field label="Banque émettrice">{instrument.banqueEmettrice || "-"}</Field>}
      <Field label="Compte de trésorerie">{instrument.compteTresorerie || "-"}</Field>
    </dl>
    {paper && <section className="space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-800 dark:text-sky-200"><Landmark className="size-4" />Remises en banque</h3>
      {deposits.length > 0 ? deposits.map(event => <div key={event.id} className="grid gap-3 text-sm sm:grid-cols-3">
        <p className="font-medium">{event.title}</p>
        <dl><Field label="Date de remise">{formatTreasuryDate(event.date)}</Field></dl>
        <dl><Field label="Bordereau bancaire">{slipLabel(event.bordereauId, event.numeroBordereau)}</Field></dl>
      </div>) : <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Field label={remittance.data?.statut === "BROUILLON" ? "Bordereau préparé, non déposé" : "Bordereau bancaire"}>{slipLabel(instrument.bordereauRemiseId, instrument.numeroBordereauRemise)}</Field>
        <Field label="Date de remise">{formatTreasuryDate(remittance.data?.dateDepot)}</Field>
      </dl>}
      {remittance.data && <dl className="text-sm"><Field label="Compte bancaire destinataire">{remittance.data.compteDestination}</Field></dl>}
      {canViewTreasury && remittance.isFetching && <p role="status" className="text-xs text-muted-foreground">Chargement de la remise...</p>}
      {remittance.isError && <p role="alert" className="text-xs text-destructive">Remise indisponible. <button type="button" className="underline" onClick={() => void remittance.refetch()}>Réessayer</button></p>}
    </section>}
    {(collectionDate || instrument.statut === "CONFIRME") && <section className="space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200"><CheckCircle2 className="size-4" />{instrument.statut === "CONFIRME" ? "Encaissement confirmé" : "Encaissement antérieur"}</h3>
      <dl className="text-sm"><Field label="Date d’encaissement">{formatTreasuryDate(collectionDate)}</Field></dl>
    </section>}
    {hasRejection && <section className="space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-200"><CircleAlert className="size-4" />Retour / rejet</h3>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Field label="Date de retour">{formatTreasuryDate(lastReturn?.date || instrument.dateRejet)}</Field>
        <Field label="Motif de retour">{lastReturn?.motif || instrument.motifRejet || "-"}</Field>
      </dl>
    </section>}
    {(instrument.statut === "REMPLACE" || children.length > 0 || instrument.instrumentRemplaceId || awaitingDeposit) && <section className="space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200"><RefreshCcw className="size-4" />{instrument.statut === "REMPLACE" ? "Remplacement par contre-valeur" : instrument.instrumentRemplaceId ? "Origine de la contre-valeur" : "Nouvelle remise préparée"}</h3>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {instrument.statut === "REMPLACE" && <><Field label="Date de remplacement">{formatTreasuryDate(instrument.dateStatut)}</Field><Field label="Motif du remplacement">{instrument.motifStatut || "-"}</Field></>}
        {prepared && awaitingDeposit && <Field label="Date de préparation">{formatTreasuryDate(prepared.date)}</Field>}
        {instrument.instrumentRemplaceId && <Field label="Remplace le moyen">{parent ? <button type="button" className="text-sky-700 underline-offset-4 hover:underline dark:text-sky-300" onClick={() => onSelect(parent.id)}>{paymentModeLabel(parent.mode)} · {parent.referenceInstrument || "-"}</button> : instrument.referenceInstrumentRemplace || "-"}</Field>}
      </dl>
      {history.data?.statutSuivi === "REGLE_CV" && <Badge variant="success">Réglé par contre-valeur</Badge>}
      {children.map(child => <div key={child.id} className="flex flex-wrap items-center justify-between gap-3 border-t py-2 text-sm">
        <button type="button" className="inline-flex min-w-0 items-center gap-1.5 break-words font-medium text-sky-700 underline-offset-4 hover:underline dark:text-sky-300" onClick={() => onSelect(child.id)}><ArrowUpRight className="size-3.5 shrink-0" />{paymentModeLabel(child.mode)} · {child.referenceInstrument || "Sans référence"}</button>
        <div className="flex flex-wrap items-center gap-3"><span className="tabular-nums">{formatAccountingAmount(child.montant)}</span><Badge variant={statusVariants[child.statut]}>{statusLabels[child.statut]}</Badge></div>
      </div>)}
    </section>}
    {canViewTreasury && paper && hasRejection && <section className="space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-sky-700 dark:text-sky-300" />Historique du moyen</h3>
      {history.isPending ? <p role="status" className="text-sm text-muted-foreground">Chargement de l’historique...</p> : history.isError ? <p role="alert" className="text-sm text-destructive">Historique indisponible. <button type="button" className="underline" onClick={() => void history.refetch()}>Réessayer</button></p> : <ol className="divide-y">
        {events.map(event => {
          const source = payment.instruments.find(item => item.id === event.instrumentSourceId);
          return <li key={event.id} className="space-y-1 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className="font-medium">{event.title}</p><time dateTime={event.date} className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatTreasuryDate(event.date)}</time></div>
            {source && source.id !== instrument.id && <button type="button" className="text-xs text-sky-700 hover:underline dark:text-sky-300" onClick={() => onSelect(source.id)}>Sur la contre-valeur : {paymentModeLabel(source.mode)} · {source.referenceInstrument || "-"}</button>}
            {event.numeroBordereau && <p>{slipLabel(event.bordereauId, event.numeroBordereau)}</p>}
            {event.motif && event.motif !== event.title && <p className="whitespace-pre-wrap break-words text-muted-foreground">{event.motif}</p>}
            {event.utilisateur && <p className="text-xs text-muted-foreground">{event.utilisateur}</p>}
          </li>;
        })}
        {!events.length && <li className="py-2 text-sm text-muted-foreground">Aucun événement enregistré.</li>}
      </ol>}
    </section>}
  </>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words font-medium">{children}</dd></div>;
}
