import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import type {
  ClientPaymentMode,
  PaymentAllocationStatus,
  PaymentInstrumentStatus,
} from "../types";

const MODE_LABELS: Record<ClientPaymentMode, string> = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  EFFET: "Effet",
  VIREMENT: "Virement",
  VERSEMENT_BANCAIRE: "Versement bancaire",
  CARTE: "Carte",
  PRELEVEMENT: "Prélèvement",
};

const INSTRUMENT_STATUS_LABELS: Record<PaymentInstrumentStatus, string> = {
  EN_ATTENTE: "En attente",
  REMIS_EN_BANQUE: "Remis en banque",
  CONFIRME: "Confirmé",
  REJETE: "Rejeté",
  REMPLACE: "Remplacé",
};

const ALLOCATION_STATUS_LABELS: Record<PaymentAllocationStatus, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  ANNULEE: "Annulée",
};

export default function ReglementClientDetailPage() {
  const { reglementId = "" } = useParams();
  const payment = useQuery({
    queryKey: ["compta", "client-payment", reglementId],
    queryFn: () => comptaApi.clientPayment(reglementId),
    enabled: Boolean(reglementId),
  });

  if (payment.isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Chargement du règlement...</div>;
  }
  if (payment.isError || !payment.data) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Règlement introuvable.</div>;
  }

  const data = payment.data;
  const allocations = data.instruments.flatMap((instrument) =>
    instrument.affectations.map((allocation) => ({ instrument, allocation }))
  );

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" className="mb-2 -ml-3">
            <Link to="/app/compta/reglements/historique">
              <ArrowLeft className="size-4" />
              Retour aux règlements
            </Link>
          </Button>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
          <h1 className="mt-1 text-xl font-semibold">{data.numero}</h1>
          <p className="text-sm text-muted-foreground">Détail du règlement client.</p>
        </div>
        <Badge variant={data.statut === "VALIDE" ? "default" : "destructive"}>
          {data.statut === "VALIDE" ? "Validé" : "Annulé"}
        </Badge>
      </header>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-2 lg:grid-cols-5">
        <Summary label="Payeur" value={data.payeurNom} />
        <Summary label="Date" value={formatDate(data.dateReglement)} />
        <Summary label="Montant total" value={formatAccountingAmount(data.montantTotal)} strong />
        <Summary label="Non affecté" value={formatAccountingAmount(data.montantNonAffecte)} />
        <Summary label="Créé par" value={data.creePar || "-"} />
      </section>

      {data.notes && (
        <section className="rounded-md border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Notes</div>
          <div className="mt-1 whitespace-pre-wrap text-sm">{data.notes}</div>
        </section>
      )}

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Moyens de paiement</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white">
              <tr>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Référence</th>
                <th className="px-4 py-3 text-left">Banque / compte</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.instruments.map((instrument) => (
                <tr key={instrument.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{MODE_LABELS[instrument.mode]}</td>
                  <td className="px-4 py-3">
                    <div>{formatDate(instrument.dateInstrument)}</div>
                    {instrument.dateEcheance && (
                      <div className="text-xs text-muted-foreground">
                        {instrument.mode === "CHEQUE" ? "Remise prévue" : "Échéance"} {formatDate(instrument.dateEcheance)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>{instrument.referenceInstrument || "-"}</div>
                    {instrument.instrumentRemplaceId && (
                      <div className="text-xs text-muted-foreground">
                        Remplace {instrument.modeInstrumentRemplace ? MODE_LABELS[instrument.modeInstrumentRemplace].toLowerCase() : "le moyen"}
                        {instrument.referenceInstrumentRemplace ? ` ${instrument.referenceInstrumentRemplace}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>{instrument.banqueEmettrice || instrument.compteTresorerie || "-"}</div>
                    {instrument.banqueEmettrice && instrument.compteTresorerie && (
                      <div className="text-xs text-muted-foreground">{instrument.compteTresorerie}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAccountingAmount(instrument.montant)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={instrument.statut === "REJETE" ? "destructive" : "outline"}>
                      {INSTRUMENT_STATUS_LABELS[instrument.statut]}
                    </Badge>
                    {instrument.motifStatut && (
                      <div className={`mt-1 text-xs ${instrument.statut === "REJETE" ? "text-red-600" : "text-muted-foreground"}`}>
                        {instrument.motifStatut}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Affectations</h2>
          <p className="text-sm text-muted-foreground">Répartition du règlement sur les créances et documents clients.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white">
              <tr>
                <th className="px-4 py-3 text-left">Moyen</th>
                <th className="px-4 py-3 text-left">Destination</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allocations.map(({ instrument, allocation }) => (
                <tr key={allocation.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{MODE_LABELS[instrument.mode]}</td>
                  <td className="px-4 py-3 font-medium">
                    {allocation.documentClientId
                      ? `Document client #${allocation.documentClientId}`
                      : allocation.elementFacturableId
                        ? `Créance #${allocation.elementFacturableId}`
                        : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAccountingAmount(allocation.montant)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline">{ALLOCATION_STATUS_LABELS[allocation.statut]}</Badge>
                  </td>
                </tr>
              ))}
              {allocations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Aucune affectation.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate ${strong ? "text-lg font-semibold" : "font-medium"}`}>{value}</div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
