import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Check, Download, Landmark, X } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toDateOnly } from "@/features/production/date";
import { downloadBlob } from "@/lib/download";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import { formatTreasuryDate, paymentModeLabel } from "../pages/treasury-format";
import type { ClientPayment, PaymentInstrumentStatus } from "../types";
import { RemittanceSlipPdfDialog } from "./RemittanceSlipPdfDialog";

const INSTRUMENT_LABELS: Record<PaymentInstrumentStatus, string> = {
  EN_ATTENTE: "En attente", REMIS_EN_BANQUE: "Remis en banque", CONFIRME: "Confirmé", REJETE: "Impayé", REMPLACE: "Remplacé",
};
const INSTRUMENT_VARIANTS = {
  EN_ATTENTE: "warning", REMIS_EN_BANQUE: "info", CONFIRME: "success", REJETE: "red", REMPLACE: "gray",
} as const;

export function ClientPaymentDetails({ payment }: { payment: ClientPayment }) {
  const canViewTreasury = useAuthStore((state) => state.user?.permissions.includes("tresorerie:view") ?? false);
  const canManageTreasury = useAuthStore((state) => state.user?.permissions.includes("tresorerie:manage") ?? false);
  const outgoing = payment.sens === "SORTIE";
  const client = useQueryClient();
  const [operation, setOperation] = useState<{ id: string; statut: "CONFIRME" | "REJETE" }>();
  const [operationDate, setOperationDate] = useState(() => toDateOnly(new Date())!);
  const [reason, setReason] = useState("");
  const processPayment = useMutation({
    mutationFn: async () => {
      if (!operation) throw new Error("Sélectionnez un moyen de règlement");
      return comptaApi.changePaymentInstrumentStatus(operation.id, {
        statut: operation.statut, dateOperation: operationDate, motif: reason.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setOperation(undefined); setReason("");
      await Promise.all(["client-payment", "client-payments", "client-receivables", "convention-invoice-receivables", "treasury"]
        .map(key => client.invalidateQueries({ queryKey: ["compta", key] })));
      toast.success("Décaissement mis à jour");
    },
    onError: error => toast.error(error.message),
  });
  const [bordereauPdf, setBordereauPdf] = useState<{ id: string; numero?: string | null } | null>(null);
  const detail = payment.detail;
  const downloadReceipt = useMutation({
    mutationFn: () => comptaApi.clientPaymentReceipt(payment.id),
    onSuccess: blob => downloadBlob(blob, payment.bordereauNomFichier || `bordereau-${payment.numero}`),
    onError: error => toast.error(error instanceof Error ? error.message : "Téléchargement du bordereau impossible"),
  });

  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <dl className="min-w-0 space-y-2 text-sm">
        <div className="flex min-w-0 gap-2"><dt className="shrink-0 text-muted-foreground">{outgoing ? "Bénéficiaire :" : "Payeur :"}</dt><dd className="break-words font-semibold">{payment.payeurNom}</dd></div>
        {payment.multiPayeur && <div className="flex min-w-0 gap-2"><dt className="shrink-0 text-muted-foreground">Déposant :</dt><dd className="break-words">{payment.deposantNom || "-"}</dd></div>}
      </dl>
      <span className="text-xs text-muted-foreground">Montants en MAD</span>
    </div>

    <dl className="grid grid-cols-1 divide-y border-b sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Summary label={outgoing ? "Ristourne à régler" : "Total perçu"} value={amount(detail?.totalRegle)} />
      <Summary label="Total quittances" value={amount(detail?.totalQuittances)} />
      <Summary label="Solde restant" value={amount(detail?.solde)} />
    </dl>

    <section className="min-w-0 space-y-3">
      <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Productions</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="bg-emerald-600 text-xs uppercase text-white"><tr>
            <th className="px-3 py-3 text-left">Police / contrat</th>
            <th className="px-3 py-3 text-left">Compagnie</th>
            <th className="px-3 py-3 text-left">Assuré</th>
            <th className="px-3 py-3 text-left">Du</th>
            <th className="px-3 py-3 text-left">Au</th>
            <th className="px-3 py-3 text-right">Montant quittance</th>
            <th className="px-3 py-3 text-right">{outgoing ? "Montant réglé" : "Montant perçu"}</th>
            <th className="px-3 py-3 text-right">Solde</th>
          </tr></thead>
          <tbody className="divide-y">{detail?.productions.map(production => <tr key={production.key} className="hover:bg-muted/30">
            <td className="max-w-60 px-3 py-3"><div className="whitespace-pre-line font-medium">{production.numeroPolice || "-"}</div>
              {production.mouvement && <div className="mt-1 text-xs text-muted-foreground">{production.mouvement}</div>}
              {production.referenceDocument && <div className="mt-1 text-xs text-muted-foreground">{production.referenceDocument}</div>}
            </td>
            <td className="max-w-44 whitespace-pre-line px-3 py-3">{production.compagnie || "-"}</td>
            <td className="max-w-44 whitespace-pre-line px-3 py-3">{production.assure || "-"}</td>
            <td className="whitespace-nowrap px-3 py-3">{formatTreasuryDate(production.dateDebut)}</td>
            <td className="whitespace-nowrap px-3 py-3">{formatTreasuryDate(production.dateFin)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{amount(production.montantQuittance)}</td>
            <td className="px-3 py-3 text-right font-semibold tabular-nums">{amount(production.montantRegle)}</td>
            <td className="px-3 py-3 text-right font-semibold tabular-nums">{amount(production.solde)}</td>
          </tr>)}
            {!detail?.productions.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">{detail ? "Aucune production affectée." : "Détail des productions indisponible."}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="min-w-0 space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{outgoing ? "Décaissement" : "Encaissements"}</h2>
        {payment.bordereauNomFichier && <Button size="sm" variant="outline" disabled={downloadReceipt.isPending} onClick={() => downloadReceipt.mutate()}>
          <Download className="size-4" />{downloadReceipt.isPending ? "Téléchargement..." : "Bordereau banque"}
        </Button>}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
            <th className="px-3 py-3 text-left">Mode</th>
            <th className="px-3 py-3 text-left">Référence</th>
            <th className="px-3 py-3 text-right">Montant</th>
            <th className="px-3 py-3 text-left">Banque</th>
            <th className="px-3 py-3 text-left">Date de valeur</th>
            <th className="px-3 py-3 text-left">Statut</th>
          </tr></thead>
          <tbody className="divide-y">{payment.instruments.map(instrument => <tr key={instrument.id} className="hover:bg-muted/30">
            <td className="px-3 py-3 font-medium">{paymentModeLabel(instrument.mode)}</td>
            <td className="px-3 py-3"><div>{instrument.referenceInstrument || "-"}</div>
              {instrument.instrumentRemplaceId && <div className="mt-1 text-xs text-muted-foreground">Remplace {instrument.modeInstrumentRemplace ? paymentModeLabel(instrument.modeInstrumentRemplace).toLowerCase() : "le moyen"}{instrument.referenceInstrumentRemplace ? ` ${instrument.referenceInstrumentRemplace}` : ""}</div>}
            </td>
            <td className="px-3 py-3 text-right font-semibold tabular-nums">{amount(instrument.montant)}</td>
            <td className="px-3 py-3"><div>{instrument.banqueEmettrice || instrument.compteTresorerie || "-"}</div>
              {instrument.banqueEmettrice && instrument.compteTresorerie && <div className="mt-1 text-xs text-muted-foreground">{instrument.compteTresorerie}</div>}
            </td>
            <td className="whitespace-nowrap px-3 py-3" title={instrument.mode === "CHEQUE" ? "Date portée sur le chèque" : undefined}>{formatTreasuryDate(instrument.mode === "CHEQUE" || instrument.mode === "EFFET" ? instrument.dateEcheance : instrument.dateInstrument)}</td>
            <td className="px-3 py-3"><Badge variant={payment.statut === "ANNULE" ? "red" : INSTRUMENT_VARIANTS[instrument.statut]}>
              {payment.statut === "ANNULE" ? "Annulé" : INSTRUMENT_LABELS[instrument.statut]}
            </Badge>
              {outgoing && canManageTreasury && payment.statut === "VALIDE" && instrument.statut === "EN_ATTENTE" && <div className="mt-2 flex gap-1">
                <Button variant="outline" size="sm" disabled={processPayment.isPending} onClick={() => { setReason(""); setOperation({ id: instrument.id, statut: "CONFIRME" }); }}><Check className="size-4" />Confirmer le débit</Button>
                <Button variant="ghost" size="icon" title="Rejeter le décaissement" aria-label="Rejeter le décaissement" disabled={processPayment.isPending} onClick={() => { setReason(""); setOperation({ id: instrument.id, statut: "REJETE" }); }}><X className="size-4" /></Button>
              </div>}
              {instrument.motifStatut && instrument.motifStatut.trim().toLocaleLowerCase("fr")
                !== (payment.statut === "ANNULE" ? "Annulé" : INSTRUMENT_LABELS[instrument.statut]).toLocaleLowerCase("fr")
                && <div className={`mt-1 text-xs ${instrument.statut === "REJETE" ? "text-red-600" : "text-muted-foreground"}`}>{instrument.motifStatut}</div>}
              {instrument.bordereauRemiseId && (canViewTreasury ? <Button type="button" variant="link"
                className="mt-2 flex h-auto items-center justify-start gap-1.5 whitespace-normal p-0 text-left text-xs font-medium text-blue-700 dark:text-blue-300"
                title="Afficher le PDF du bordereau"
                onClick={() => { if (instrument.bordereauRemiseId) setBordereauPdf({ id: instrument.bordereauRemiseId, numero: instrument.numeroBordereauRemise }); }}>
                <Landmark className="size-3.5 shrink-0" />{instrument.numeroBordereauRemise || "Voir le bordereau"}
              </Button> : instrument.numeroBordereauRemise ? <div className="mt-2 text-xs text-muted-foreground">{instrument.numeroBordereauRemise}</div> : null)}
            </td>
          </tr>)}
            {!payment.instruments.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Aucun encaissement.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    {payment.notes && <section className="space-y-2 border-t pt-4"><h2 className="text-sm font-semibold">Notes</h2><p className="whitespace-pre-wrap break-words text-sm">{payment.notes}</p></section>}
    <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-muted-foreground"><span>Créé par : {payment.creePar || "-"}</span><span>Non affecté : {amount(payment.montantNonAffecte)}</span></div>
    {bordereauPdf && <RemittanceSlipPdfDialog key={bordereauPdf.id} {...bordereauPdf} onClose={() => setBordereauPdf(null)} />}
    <Dialog open={Boolean(operation)} onOpenChange={open => { if (!open && !processPayment.isPending) setOperation(undefined); }}>
      <DialogContent><DialogHeader><DialogTitle>{operation?.statut === "CONFIRME" ? "Confirmer le décaissement" : "Rejeter le décaissement"}</DialogTitle>
        <DialogDescription>{payment.numero} · {payment.payeurNom}</DialogDescription></DialogHeader>
        <div className="grid gap-2"><Label>Date d'opération</Label><DatePicker date={operationDate} onSelect={value => setOperationDate(toDateOnly(value) ?? "")} /></div>
        {operation?.statut === "REJETE" && <div className="grid gap-2"><Label htmlFor="refund-reason">Motif <span className="text-destructive">*</span></Label><Input id="refund-reason" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></div>}
        <DialogFooter><Button variant="outline" disabled={processPayment.isPending} onClick={() => setOperation(undefined)}>Annuler</Button>
          <Button disabled={processPayment.isPending || !operationDate || (operation?.statut === "REJETE" && !reason.trim())} onClick={() => processPayment.mutate()}>Confirmer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function Summary({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return <div className="min-w-0 py-3 sm:px-5 sm:first:pl-0 sm:last:pr-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{value}{children}</dd></div>;
}

function amount(value?: number | null) {
  return value == null ? "-" : formatAccountingAmount(value);
}
