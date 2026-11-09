import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
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
        <DialogTitle className={instrument ? "sr-only" : "break-words leading-snug"}>Détail du moyen de règlement</DialogTitle>
        {instrument && <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <Field label={instrument.mode === "CHEQUE" || instrument.mode === "EFFET" ? `${paymentModeLabel(instrument.mode)} N°` : "Référence"}>{instrument.referenceInstrument || "-"}</Field>
          <Field label="Montant"><span className="text-lg font-semibold tabular-nums">{formatAccountingAmount(instrument.montant)}</span> <span className="text-xs font-normal text-muted-foreground">MAD</span></Field>
          <Field label="Statut"><div className="flex flex-wrap gap-2"><Badge variant={statusVariants[instrument.statut]}>{instrument.statut === "REJETE" && payment?.statut === "ANNULE" && !instrument.dateRejet ? "Annulé avec le règlement" : statusLabels[instrument.statut]}</Badge>
            {payment?.statut === "ANNULE" && <Badge variant="red">Règlement annulé</Badge>}</div></Field>
        </dl>}
        <DialogDescription className="break-words">{payment ? `${payment.numero} · ${payment.payeurNom}` : "Informations et affectations du moyen sélectionné."}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {query.isPending ? <div role="status" className="space-y-4"><span className="sr-only">Chargement du moyen de règlement...</span><Skeleton className="h-28 w-full" /><Skeleton className="h-40 w-full" /></div>
          : query.isError ? <div role="alert" className="space-y-3 text-sm"><p>{query.error instanceof Error ? query.error.message : "Chargement impossible."}</p><Button variant="outline" onClick={() => void query.refetch()}>Réessayer</Button></div>
            : !instrument ? <p role="alert" className="text-sm text-muted-foreground">Ce moyen ne figure plus dans ce règlement. Relancez la recherche.</p>
              : <div className="space-y-6">
                <div className="divide-y overflow-hidden rounded-md border">
                  {payment && <InstrumentLifecycle key={instrument.id} payment={payment} instrument={instrument} onSelect={setSelectedInstrumentId} />}
                </div>
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
  const events = history.data?.mouvements ?? [];
  const ownEvents = events.filter(event => !event.instrumentSourceId || event.instrumentSourceId === instrument.id);
  const deposits = ownEvents.filter(event => event.type === "REMISE_EN_BANQUE");
  const firstDeposit = deposits[0];
  const firstReturnIndex = ownEvents.findIndex(event => event.type === "REJET");
  const newDeposits = firstReturnIndex < 0 ? []
    : ownEvents.slice(firstReturnIndex + 1).filter(event => event.type === "REMISE_EN_BANQUE");
  const newDeposit = newDeposits.at(-1);
  const returns = ownEvents.filter(event => event.type === "REJET");
  const firstReturn = returns[0];
  const lastReturn = returns.at(-1);
  const returnAfterNewDeposit = Boolean(newDeposit && lastReturn
    && ownEvents.indexOf(lastReturn) > ownEvents.indexOf(newDeposit));
  const lastCollection = ownEvents.filter(event => event.type === "ENCAISSEMENT").at(-1);
  const prepared = ownEvents.filter(event => event.type === "PREPARATION_REMISE").at(-1);
  const awaitingDeposit = Boolean(prepared && instrument.statut === "EN_ATTENTE");
  const children = payment.instruments.filter(item => item.instrumentRemplaceId === instrument.id);
  const parent = payment.instruments.find(item => item.id === instrument.instrumentRemplaceId);
  const collectionDate = lastCollection?.date || (instrument.statut === "CONFIRME" ? instrument.dateStatut : undefined);
  const replacement = ownEvents.filter(event => event.type === "REMPLACEMENT").at(-1);
  function slipLabel(id?: string | null, number?: string | null) {
    return id && canViewTreasury ? <Link className="text-sky-700 underline-offset-4 hover:underline dark:text-sky-300" to={`/app/compta/tresorerie/bordereaux-remise/${id}`}>{number || "Voir le bordereau"}</Link> : number || "-";
  }
  return <>
    <div className="space-y-5 p-4">
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <Field label="Date du règlement">{formatTreasuryDate(payment.dateReglement)}</Field>
        {paper && <div className="sm:col-start-2"><Field label="Date de valeur">{formatTreasuryDate(instrument.dateEcheance)}</Field></div>}
        <div className={paper ? "sm:col-start-3" : undefined}><Field label={instrument.mode === "ESPECES" ? "Caisse" : "Banque"}>{instrument.banqueEmettrice || instrument.compteTresorerie || "-"}</Field></div>
      </dl>
      {paper && <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <Field label="Date de remise">{formatTreasuryDate(firstDeposit?.date || remittance.data?.dateDepot)}</Field>
        <Field label={remittance.data?.statut === "BROUILLON" && !firstDeposit ? "Bordereau bancaire préparé, non déposé" : "Bordereau bancaire"}>{firstDeposit
          ? slipLabel(firstDeposit.bordereauId, firstDeposit.numeroBordereau)
          : slipLabel(instrument.bordereauRemiseId, instrument.numeroBordereauRemise)}</Field>
        {(collectionDate || instrument.statut === "CONFIRME") && <Field label={instrument.statut === "CONFIRME" ? "Date d’encaissement" : "Date d’encaissement antérieur"}>{formatTreasuryDate(collectionDate)}</Field>}
      </dl>}
      {!paper && (collectionDate || instrument.statut === "CONFIRME") && <dl className="text-sm"><Field label={instrument.statut === "CONFIRME" ? "Date d’encaissement" : "Date d’encaissement antérieur"}>{formatTreasuryDate(collectionDate)}</Field></dl>}
    </div>
    {hasRejection && <div className="space-y-5 p-4">
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <Field label={returns.length > 1 ? "Date du premier retour" : "Date de retour"}>{formatTreasuryDate(firstReturn?.date || instrument.dateRejet)}</Field>
        <div className="sm:col-span-2"><Field label={returns.length > 1 ? "Motif du premier retour" : "Motif de retour"}>{firstReturn ? firstReturn.motif || "-" : instrument.motifRejet || "-"}</Field></div>
      </dl>
      {returns.length > 1 && !returnAfterNewDeposit && <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <Field label="Date du dernier retour">{formatTreasuryDate(lastReturn?.date)}</Field>
        <div className="sm:col-span-2"><Field label="Motif du dernier retour">{lastReturn?.motif || "-"}</Field></div>
      </dl>}
    </div>}
    {(newDeposit || awaitingDeposit || instrument.statut === "REMPLACE" || children.length > 0 || instrument.instrumentRemplaceId) && <div className="space-y-5 p-4">
      {newDeposit && <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <Field label={newDeposits.length > 1 ? "Date de la dernière nouvelle remise" : "Date de nouvelle remise"}>{formatTreasuryDate(newDeposit.date)}</Field>
        <Field label={newDeposits.length > 1 ? "Dernier bordereau de nouvelle remise" : "Nouveau bordereau bancaire"}>{slipLabel(newDeposit.bordereauId, newDeposit.numeroBordereau)}</Field>
      </dl>}
      {returnAfterNewDeposit && <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <Field label="Date du dernier retour">{formatTreasuryDate(lastReturn?.date)}</Field>
        <Field label="Motif du dernier retour">{lastReturn?.motif || "-"}</Field>
        {lastReturn?.bordereauId && <Field label="Bordereau du dernier retour">{slipLabel(lastReturn.bordereauId, lastReturn.numeroBordereau)}</Field>}
      </dl>}
      {prepared && awaitingDeposit && <dl className="text-sm"><Field label="Nouvelle remise préparée le, non encore déposée">{formatTreasuryDate(prepared.date)}</Field></dl>}
      {(instrument.statut === "REMPLACE" || children.length > 0) && <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <Field label="Date de C/V">{formatTreasuryDate(replacement?.date || (instrument.statut === "REMPLACE" ? instrument.dateStatut : undefined))}</Field>
        <div className="sm:col-span-2"><Field label="Moyen de remplacement">{children.length ? <ul className="space-y-3">{children.map(child => <li key={child.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" className="inline-flex min-w-0 items-center gap-1.5 break-words text-sky-700 underline-offset-4 hover:underline dark:text-sky-300" onClick={() => onSelect(child.id)}><ArrowUpRight className="size-3.5 shrink-0" />{paymentModeLabel(child.mode)} · {child.referenceInstrument || "Sans référence"}</button>
          <span className="tabular-nums">{formatAccountingAmount(child.montant)}</span><Badge variant={statusVariants[child.statut]}>{statusLabels[child.statut]}</Badge>
        </li>)}</ul> : "-"}</Field></div>
      </dl>}
      {instrument.instrumentRemplaceId && <dl className="text-sm"><Field label="Remplace le moyen">{parent ? <button type="button" className="text-sky-700 underline-offset-4 hover:underline dark:text-sky-300" onClick={() => onSelect(parent.id)}>{paymentModeLabel(parent.mode)} · {parent.referenceInstrument || "-"}</button> : instrument.referenceInstrumentRemplace || "-"}</Field></dl>}
      {history.data?.statutSuivi === "REGLE_CV" && <Badge variant="success">Réglé par contre-valeur</Badge>}
    </div>}
    {((canViewTreasury && history.isFetching) || remittance.isFetching) && <p role="status" className="p-4 text-xs text-muted-foreground">Chargement des dates bancaires...</p>}
    {(history.isError || remittance.isError) && <p role="alert" className="p-4 text-xs text-destructive">Certaines informations bancaires sont indisponibles. <button type="button" className="underline" onClick={() => {
      if (history.isError) void history.refetch();
      if (remittance.isError) void remittance.refetch();
    }}>Réessayer</button></p>}
  </>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words font-medium">{children}</dd></div>;
}
