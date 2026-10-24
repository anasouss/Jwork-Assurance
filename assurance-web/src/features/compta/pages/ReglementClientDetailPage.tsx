import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Landmark, Pencil } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { AddInstrumentToRemittanceDialog } from "../components/AddInstrumentToRemittanceDialog";
import { formatAccountingAmount } from "../format";
import type {
  ClientPayment,
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
};

const INSTRUMENT_STATUS_LABELS: Record<PaymentInstrumentStatus, string> = {
  EN_ATTENTE: "En attente",
  REMIS_EN_BANQUE: "Remis en banque",
  CONFIRME: "Confirmé",
  REJETE: "Impayé",
  REMPLACE: "Remplacé",
};

const ALLOCATION_STATUS_LABELS: Record<PaymentAllocationStatus, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  ANNULEE: "Annulée",
};

const INSTRUMENT_STATUS_BADGE_VARIANTS: Record<
  PaymentInstrumentStatus,
  "warning" | "info" | "success" | "red" | "gray"
> = {
  EN_ATTENTE: "warning",
  REMIS_EN_BANQUE: "info",
  CONFIRME: "success",
  REJETE: "red",
  REMPLACE: "gray",
};

const ALLOCATION_STATUS_BADGE_VARIANTS: Record<
  PaymentAllocationStatus,
  "warning" | "success" | "red"
> = {
  EN_ATTENTE: "warning",
  CONFIRMEE: "success",
  ANNULEE: "red",
};

export default function ReglementClientDetailPage() {
  const { reglementId = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const canEdit = user?.permissions.includes("reglement-client:create")
    || user?.permissions.includes("reglement-client:manage");
  const canManageTreasury = user?.permissions.includes("tresorerie:manage") ?? false;
  const [instrumentToRemit, setInstrumentToRemit] = useState<ClientPayment["instruments"][number]>();
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
  const allocations = groupAllocations(data);
  const allocatedInstrumentCount = new Set(
    allocations.flatMap((allocation) => Array.from(allocation.instrumentIds))
  ).size;

  async function downloadReceipt() {
    try {
      const blob = await comptaApi.clientPaymentReceipt(data.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = data.bordereauNomFichier || `bordereau-${data.numero}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléchargement du bordereau impossible");
    }
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" className="mb-2 -ml-3">
            <Link to={data.statut === "A_VALIDER"
              ? `/app/compta/reglements/etat-encaissements?date=${data.dateReglement}`
              : "/app/compta/reglements/historique"}
            >
              <ArrowLeft className="size-4" />
              Retour aux règlements
            </Link>
          </Button>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
          <h1 className="mt-1 text-xl font-semibold">{data.numero}</h1>
          <p className="text-sm text-muted-foreground">Détail du règlement client.</p>
        </div>
        <div className="flex items-center gap-2">
          {data.bordereauNomFichier && (
            <Button variant="outline" onClick={() => void downloadReceipt()}>
              <Download className="size-4" /> Bordereau banque
            </Button>
          )}
          {data.statut === "A_VALIDER" && data.creeParId === user?.id && canEdit && (
            <Button asChild variant="outline">
              <Link to={`/app/compta/reglements/${data.id}/modifier`}>
                <Pencil className="size-4" />
                Modifier
              </Link>
            </Button>
          )}
          <Badge variant={data.statut === "VALIDE"
            ? "success"
            : data.statut === "ANNULE" ? "red" : "warning"}
          >
            {data.statut === "VALIDE" ? "Validé" : data.statut === "ANNULE" ? "Annulé" : "À valider"}
          </Badge>
        </div>
      </header>

      <section className={`grid overflow-hidden rounded-md border bg-card sm:grid-cols-2 ${data.multiPayeur ? "lg:grid-cols-7" : "lg:grid-cols-6"}`}>
        <Summary label="Payeur" value={data.payeurNom} />
        {data.multiPayeur && <Summary label="Déposant" value={data.deposantNom || "-"} />}
        <Summary label="Date" value={formatDate(data.dateReglement)} />
        <Summary label="Montant total" value={formatAccountingAmount(data.montantTotal)} strong />
        <Summary label="Non affecté" value={formatAccountingAmount(data.montantNonAffecte)} />
        <Summary label="Créé par" value={data.creePar || "-"} />
        <Summary
          label="Validation"
          value={data.validePar
            ? `${data.validePar}${data.dateValidation ? ` · ${formatDateTime(data.dateValidation)}` : ""}`
            : data.statut === "A_VALIDER" ? "En attente" : "-"}
        />
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
                <th className="px-4 py-3 text-right">Action</th>
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
                        {instrument.mode === "CHEQUE" ? "Date portée sur le chèque" : "Échéance"} {formatDate(instrument.dateEcheance)}
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
                    <Badge variant={data.statut === "A_VALIDER"
                      ? "warning"
                      : data.statut === "ANNULE"
                        ? "red"
                        : INSTRUMENT_STATUS_BADGE_VARIANTS[instrument.statut]}
                    >
                      {data.statut === "A_VALIDER"
                        ? "À valider"
                        : data.statut === "ANNULE"
                          ? "Annulé"
                          : INSTRUMENT_STATUS_LABELS[instrument.statut]}
                    </Badge>
                    {instrument.motifStatut && (
                      <div className={`mt-1 text-xs ${instrument.statut === "REJETE" ? "text-red-600" : "text-muted-foreground"}`}>
                        {instrument.motifStatut}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {instrument.bordereauRemiseId ? (
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/app/compta/tresorerie/bordereaux-remise/${instrument.bordereauRemiseId}`}>
                          <Landmark className="size-4" /> {instrument.numeroBordereauRemise || "Voir le bordereau"}
                        </Link>
                      </Button>
                    ) : data.statut === "VALIDE"
                      && instrument.statut === "EN_ATTENTE"
                      && (instrument.mode === "CHEQUE" || instrument.mode === "EFFET")
                      && canManageTreasury ? (
                        <Button variant="outline" size="sm" onClick={() => setInstrumentToRemit(instrument)}>
                          <Landmark className="size-4" /> Ajouter au bordereau
                        </Button>
                      ) : "-"}
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
          <p className="text-sm text-muted-foreground">
            {allocations.length > 0
              ? `${allocatedInstrumentCount} moyen${allocatedInstrumentCount > 1 ? "s" : ""} de paiement · ${allocations.length} destination${allocations.length > 1 ? "s" : ""} affectée${allocations.length > 1 ? "s" : ""}`
              : "Répartition du règlement sur les créances et documents clients."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white">
              <tr>
                <th className="px-4 py-3 text-left">Destination</th>
                <th className="px-4 py-3 text-left">Client / groupe</th>
                <th className="px-4 py-3 text-center">Moyens</th>
                <th className="px-4 py-3 text-right">Montant affecté</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allocations.map((allocation) => (
                <tr key={allocation.key} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {allocation.destination}
                  </td>
                  <td className="px-4 py-3">{allocation.payer}</td>
                  <td className="px-4 py-3 text-center">{allocation.instrumentCount}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAccountingAmount(allocation.montant)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={data.statut === "A_VALIDER"
                      ? "warning"
                      : data.statut === "ANNULE"
                        ? "red"
                        : ALLOCATION_STATUS_BADGE_VARIANTS[allocation.statut]}
                    >
                      {data.statut === "A_VALIDER"
                        ? "Réservée"
                        : data.statut === "ANNULE"
                          ? "Annulée"
                          : ALLOCATION_STATUS_LABELS[allocation.statut]}
                    </Badge>
                  </td>
                </tr>
              ))}
              {allocations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Aucune affectation.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AddInstrumentToRemittanceDialog
        instrument={instrumentToRemit}
        open={Boolean(instrumentToRemit)}
        onOpenChange={(open) => !open && setInstrumentToRemit(undefined)}
      />
    </div>
  );
}

function groupAllocations(payment: ClientPayment) {
  const grouped = new Map<string, {
    key: string;
    destination: string;
    payer: string;
    instrumentIds: Set<string>;
    instrumentCount: number;
    montant: number;
    statut: PaymentAllocationStatus;
  }>();
  payment.instruments.forEach((instrument) => {
    instrument.affectations.forEach((allocation) => {
      const target = allocation.documentClientId
        ? `D:${allocation.documentClientId}:E:${allocation.elementFacturableId ?? ""}`
        : `E:${allocation.elementFacturableId ?? ""}`;
      const key = `${target}:${allocation.statut}:${allocation.payeurType ?? ""}:${allocation.payeurId ?? ""}`;
      const current = grouped.get(key) ?? {
        key,
        destination: allocation.destination
          || (allocation.documentClientId
            ? `Document client #${allocation.documentClientId}`
            : allocation.elementFacturableId
              ? `Créance #${allocation.elementFacturableId}`
              : "-"),
        payer: allocation.payeurNom || "-",
        instrumentIds: new Set<string>(),
        instrumentCount: 0,
        montant: 0,
        statut: allocation.statut,
      };
      current.instrumentIds.add(instrument.id);
      current.instrumentCount = current.instrumentIds.size;
      current.montant += allocation.montant;
      grouped.set(key, current);
    });
  });
  return Array.from(grouped.values());
}

function Summary({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 break-words ${strong ? "text-lg font-semibold" : "font-medium"}`}>{value}</div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateTime(value: string) {
  const [datePart, timePart = ""] = value.split("T");
  return `${formatDate(datePart)} ${timePart.slice(0, 5)}`.trim();
}
