import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Download, Landmark } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import { formatTreasuryDate, paymentModeLabel } from "../pages/treasury-format";
import type { ClientPayment, PaymentAllocationStatus, PaymentInstrumentStatus } from "../types";

const INSTRUMENT_LABELS: Record<PaymentInstrumentStatus, string> = {
  EN_ATTENTE: "En attente", REMIS_EN_BANQUE: "Remis en banque", CONFIRME: "Confirmé", REJETE: "Impayé", REMPLACE: "Remplacé",
};
const INSTRUMENT_VARIANTS = {
  EN_ATTENTE: "warning", REMIS_EN_BANQUE: "info", CONFIRME: "success", REJETE: "red", REMPLACE: "gray",
} as const;
const ALLOCATION_LABELS: Record<PaymentAllocationStatus, string> = {
  EN_ATTENTE: "En attente", CONFIRMEE: "Confirmée", ANNULEE: "Annulée",
};
const ALLOCATION_VARIANTS = { EN_ATTENTE: "warning", CONFIRMEE: "success", ANNULEE: "red" } as const;

export function ClientPaymentDetails({ payment }: { payment: ClientPayment }) {
  const detail = payment.detail;
  const history = groupAllocations(payment).filter(allocation => allocation.statut === "ANNULEE");
  const downloadReceipt = useMutation({
    mutationFn: () => comptaApi.clientPaymentReceipt(payment.id),
    onSuccess: blob => downloadBlob(blob, payment.bordereauNomFichier || `bordereau-${payment.numero}`),
    onError: error => toast.error(error instanceof Error ? error.message : "Téléchargement du bordereau impossible"),
  });

  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <dl className="min-w-0 space-y-2 text-sm">
        <div className="flex min-w-0 gap-2"><dt className="shrink-0 text-muted-foreground">Payeur :</dt><dd className="break-words font-semibold">{payment.payeurNom}</dd></div>
        {payment.multiPayeur && <div className="flex min-w-0 gap-2"><dt className="shrink-0 text-muted-foreground">Déposant :</dt><dd className="break-words">{payment.deposantNom || "-"}</dd></div>}
      </dl>
      <span className="text-xs text-muted-foreground">Montants en MAD</span>
    </div>

    <dl className="grid grid-cols-1 divide-y border-b sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Summary label="Total affecté" value={amount(detail?.totalRegle)} />
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
            <th className="px-3 py-3 text-right" title="Montant affecté par ce règlement">Montant affecté</th>
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
        <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Encaissements</h2>
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
              {instrument.motifStatut && instrument.motifStatut.trim().toLocaleLowerCase("fr")
                !== (payment.statut === "ANNULE" ? "Annulé" : INSTRUMENT_LABELS[instrument.statut]).toLocaleLowerCase("fr")
                && <div className={`mt-1 text-xs ${instrument.statut === "REJETE" ? "text-red-600" : "text-muted-foreground"}`}>{instrument.motifStatut}</div>}
              {instrument.bordereauRemiseId && <Link className="mt-2 flex items-center gap-1.5 text-xs font-medium text-blue-700 underline-offset-4 hover:underline dark:text-blue-300" to={`/app/compta/tresorerie/bordereaux-remise/${instrument.bordereauRemiseId}`}><Landmark className="size-3.5 shrink-0" />{instrument.numeroBordereauRemise || "Voir le bordereau"}</Link>}
            </td>
          </tr>)}
            {!payment.instruments.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Aucun encaissement.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    {history.length > 0 && <details className="border-t pt-4 text-sm">
      <summary className="cursor-pointer font-medium">Historique des affectations annulées</summary>
      <div className="mt-3 overflow-x-auto rounded-md border"><table className="w-full min-w-[600px] text-sm">
        <thead className="bg-muted text-xs"><tr><th className="px-3 py-2 text-left">Police / contrat</th><th className="px-3 py-2 text-left">Mouvement / document</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2 text-left">Statut</th></tr></thead>
        <tbody className="divide-y">{history.map(allocation => <tr key={allocation.key}><td className="px-3 py-2">{allocation.numeroPolice || "-"}</td><td className="px-3 py-2">{allocation.mouvement || allocation.referenceDocument || "-"}</td><td className="px-3 py-2 text-right tabular-nums">{amount(allocation.montant)}</td><td className="px-3 py-2"><Badge variant={ALLOCATION_VARIANTS[allocation.statut]}>{ALLOCATION_LABELS[allocation.statut]}</Badge></td></tr>)}</tbody>
      </table></div>
    </details>}
    {payment.notes && <section className="space-y-2 border-t pt-4"><h2 className="text-sm font-semibold">Notes</h2><p className="whitespace-pre-wrap break-words text-sm">{payment.notes}</p></section>}
    <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-muted-foreground"><span>Créé par : {payment.creePar || "-"}</span><span>Non affecté : {amount(payment.montantNonAffecte)}</span></div>
  </div>;
}

function groupAllocations(payment: ClientPayment) {
  const grouped = new Map<string, {
    key: string;
    numeroPolice?: string | null;
    mouvement?: string | null;
    documentId?: string | null;
    referenceDocument?: string | null;
    payer: string;
    instrumentIds: Set<string>;
    montant: number;
    statut: PaymentAllocationStatus;
  }>();
  payment.instruments.forEach(instrument => {
    instrument.affectations.forEach(allocation => {
      const target = allocation.documentClientId
        ? `D:${allocation.documentClientId}:E:${allocation.elementFacturableId ?? ""}`
        : `E:${allocation.elementFacturableId ?? ""}`;
      const key = `${target}:${allocation.statut}:${allocation.payeurType ?? ""}:${allocation.payeurId ?? ""}`;
      const current = grouped.get(key) ?? {
        key, numeroPolice: allocation.numeroPolice, mouvement: allocation.mouvement,
        documentId: allocation.documentClientId, referenceDocument: allocation.referenceDocument,
        payer: allocation.payeurNom || "-", instrumentIds: new Set<string>(), montant: 0, statut: allocation.statut,
      };
      current.instrumentIds.add(instrument.id);
      current.montant += allocation.montant;
      grouped.set(key, current);
    });
  });
  return Array.from(grouped.values());
}

function Summary({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return <div className="min-w-0 py-3 sm:px-5 sm:first:pl-0 sm:last:pr-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{value}{children}</dd></div>;
}

function amount(value?: number | null) {
  return value == null ? "-" : formatAccountingAmount(value);
}
