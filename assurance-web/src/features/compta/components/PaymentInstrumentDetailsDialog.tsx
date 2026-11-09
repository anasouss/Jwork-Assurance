import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import { formatTreasuryDate, paymentModeLabel } from "../pages/treasury-format";
import type { PaymentAllocationStatus, PaymentInstrumentStatus } from "../types";

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
  const query = useQuery({
    queryKey: ["compta", "client-payment", paymentId],
    queryFn: () => comptaApi.clientPayment(paymentId),
    refetchOnMount: "always",
  });
  const payment = query.data;
  const instrument = payment?.instruments.find(item => item.id === instrumentId);
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
                  <div className="flex flex-wrap gap-2"><Badge variant={statusVariants[instrument.statut]}>{statusLabels[instrument.statut]}</Badge>
                    {payment?.statut === "ANNULE" && <Badge variant="red">Règlement annulé</Badge>}</div>
                </div>
                <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Référence">{instrument.referenceInstrument || "-"}</Field>
                  <Field label="Banque émettrice">{instrument.banqueEmettrice || "-"}</Field>
                  <Field label="Compte de trésorerie">{instrument.compteTresorerie || "-"}</Field>
                  <Field label="Date du règlement">{formatTreasuryDate(payment?.dateReglement)}</Field>
                  <Field label="Date du moyen">{formatTreasuryDate(instrument.dateInstrument)}</Field>
                  <Field label="Date de valeur">{formatTreasuryDate(instrument.mode === "CHEQUE" || instrument.mode === "EFFET" ? instrument.dateEcheance : instrument.dateInstrument)}</Field>
                </dl>
                <section className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold">Suivi du moyen</h3>
                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    <Field label="Dernier changement d’état">{formatTreasuryDate(instrument.dateStatut)}</Field>
                    <Field label="Motif">{instrument.motifStatut || "-"}</Field>
                    {instrument.numeroBordereauRemise && <Field label="Bordereau bancaire">{instrument.numeroBordereauRemise}</Field>}
                    {instrument.instrumentRemplaceId && <Field label="Moyen remplacé">{instrument.modeInstrumentRemplace ? paymentModeLabel(instrument.modeInstrumentRemplace) : "Moyen de règlement"} · {instrument.referenceInstrumentRemplace || "-"}</Field>}
                    {instrument.dateRejet && <Field label="Date du rejet">{formatTreasuryDate(instrument.dateRejet)}</Field>}
                    {instrument.motifRejet && <Field label="Motif du rejet">{instrument.motifRejet}</Field>}
                  </dl>
                </section>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words font-medium">{children}</dd></div>;
}
