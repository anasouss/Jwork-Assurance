import { useMutation } from "@tanstack/react-query";
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
  const allocations = groupAllocations(payment);
  const showDocument = allocations.some(allocation => allocation.documentId);
  const downloadReceipt = useMutation({
    mutationFn: () => comptaApi.clientPaymentReceipt(payment.id),
    onSuccess: blob => downloadBlob(blob, payment.bordereauNomFichier || `bordereau-${payment.numero}`),
    onError: error => toast.error(error instanceof Error ? error.message : "Téléchargement du bordereau impossible"),
  });

  return <div className="min-w-0 space-y-5">
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-y bg-muted/20 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <Summary label="Payeur" value={payment.payeurNom} />
      <Summary label="Date du règlement" value={formatTreasuryDate(payment.dateReglement)} />
      <Summary label="Montant total" value={formatAccountingAmount(payment.montantTotal)} strong />
      {payment.multiPayeur && <Summary label="Déposant" value={payment.deposantNom || "-"} />}
      <Summary label="Non affecté" value={formatAccountingAmount(payment.montantNonAffecte)} />
      <Summary label="Créé par" value={payment.creePar || "-"} />
    </dl>

    <section className="min-w-0 space-y-3">
      <h2 className="text-sm font-semibold">Polices et mouvements</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
            <th className="px-3 py-3 text-left">N° police</th>
            <th className="px-3 py-3 text-left">Mouvement / prestation</th>
            {showDocument && <th className="px-3 py-3 text-left">Document</th>}
            <th className="px-3 py-3 text-left">Client / groupe</th>
            <th className="px-3 py-3 text-center">Moyens</th>
            <th className="px-3 py-3 text-right">Montant affecté</th>
            <th className="px-3 py-3 text-center">Statut</th>
          </tr></thead>
          <tbody className="divide-y">{allocations.map(allocation => <tr key={allocation.key} className="hover:bg-muted/30">
            <td className="whitespace-pre-line px-3 py-3 font-medium">{allocation.numeroPolice || "-"}</td>
            <td className="px-3 py-3">{allocation.mouvement || "-"}</td>
            {showDocument && <td className="px-3 py-3">{allocation.referenceDocument || "-"}</td>}
            <td className="px-3 py-3">{allocation.payer}</td>
            <td className="px-3 py-3 text-center">{allocation.instrumentIds.size}</td>
            <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatAccountingAmount(allocation.montant)}</td>
            <td className="px-3 py-3 text-center"><Badge variant={payment.statut === "ANNULE" ? "red" : ALLOCATION_VARIANTS[allocation.statut]}>
              {payment.statut === "ANNULE" ? "Annulée" : ALLOCATION_LABELS[allocation.statut]}
            </Badge></td>
          </tr>)}
            {!allocations.length && <tr><td colSpan={showDocument ? 7 : 6} className="px-3 py-8 text-center text-muted-foreground">Aucune affectation.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="min-w-0 space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Modes de règlement</h2>
        {payment.bordereauNomFichier && <Button size="sm" variant="outline" disabled={downloadReceipt.isPending} onClick={() => downloadReceipt.mutate()}>
          <Download className="size-4" />{downloadReceipt.isPending ? "Téléchargement..." : "Bordereau banque"}
        </Button>}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
            <th className="px-3 py-3 text-left">Mode</th>
            <th className="px-3 py-3 text-left">Date</th>
            <th className="px-3 py-3 text-left">Référence</th>
            <th className="px-3 py-3 text-left">Banque / compte</th>
            <th className="px-3 py-3 text-right">Montant</th>
            <th className="px-3 py-3 text-center">Statut</th>
            <th className="px-3 py-3 text-right">Bordereau</th>
          </tr></thead>
          <tbody className="divide-y">{payment.instruments.map(instrument => <tr key={instrument.id} className="hover:bg-muted/30">
            <td className="px-3 py-3 font-medium">{paymentModeLabel(instrument.mode)}</td>
            <td className="px-3 py-3"><div>{formatTreasuryDate(instrument.dateInstrument)}</div>
              {instrument.dateEcheance && <div className="text-xs text-muted-foreground">{instrument.mode === "CHEQUE" ? "Date portée sur le chèque" : "Échéance"} {formatTreasuryDate(instrument.dateEcheance)}</div>}
            </td>
            <td className="px-3 py-3"><div>{instrument.referenceInstrument || "-"}</div>
              {instrument.instrumentRemplaceId && <div className="text-xs text-muted-foreground">Remplace {instrument.modeInstrumentRemplace ? paymentModeLabel(instrument.modeInstrumentRemplace).toLowerCase() : "le moyen"}{instrument.referenceInstrumentRemplace ? ` ${instrument.referenceInstrumentRemplace}` : ""}</div>}
            </td>
            <td className="px-3 py-3"><div>{instrument.banqueEmettrice || instrument.compteTresorerie || "-"}</div>
              {instrument.banqueEmettrice && instrument.compteTresorerie && <div className="text-xs text-muted-foreground">{instrument.compteTresorerie}</div>}
            </td>
            <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatAccountingAmount(instrument.montant)}</td>
            <td className="px-3 py-3 text-center"><Badge variant={payment.statut === "ANNULE" ? "red" : INSTRUMENT_VARIANTS[instrument.statut]}>
              {payment.statut === "ANNULE" ? "Annulé" : INSTRUMENT_LABELS[instrument.statut]}
            </Badge>
              {instrument.motifStatut && <div className={`mt-1 text-xs ${instrument.statut === "REJETE" ? "text-red-600" : "text-muted-foreground"}`}>{instrument.motifStatut}</div>}
            </td>
            <td className="px-3 py-3 text-right">{instrument.bordereauRemiseId ? <Button asChild variant="outline" size="sm">
              <Link to={`/app/compta/tresorerie/bordereaux-remise/${instrument.bordereauRemiseId}`}><Landmark className="size-4" />{instrument.numeroBordereauRemise || "Voir le bordereau"}</Link>
            </Button> : "-"}</td>
          </tr>)}
            {!payment.instruments.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Aucun mode de règlement.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    {payment.notes && <section className="space-y-2 border-t pt-4"><h2 className="text-sm font-semibold">Notes</h2><p className="whitespace-pre-wrap break-words text-sm">{payment.notes}</p></section>}
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

function Summary({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={`mt-1 break-words ${strong ? "text-lg font-semibold tabular-nums" : "font-medium"}`}>{value}</dd></div>;
}
