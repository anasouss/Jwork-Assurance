import { MoneyInput } from "./MoneyInput";
import { SectionCard } from "./SectionCard";
import { moneyAmount, numberOrZero, roundMoney } from "../utils/format";
import type { AssistanceContrat, QuittanceInput } from "../types";
import type { ContratSectionKey } from "../contrat-creation/useContratCreationForm";

type Props = {
  lignes: QuittanceInput[];
  setLignes: (value: QuittanceInput[]) => void;
  assistances?: AssistanceContrat[];
  openSection?: ContratSectionKey;
  onSectionOpenChange?: (section: ContratSectionKey, open: boolean) => void;
};

const LABELS: Record<QuittanceInput["categorie"], string> = {
  AUTOMOBILE: "Automobile",
  CORPOREL: "Corporel",
  EVCAT: "EVCAT",
  ASSISTANCE: "Assistance",
  TOTAL: "Total",
};

type MoneyColumnKey = "primeNette" | "taxe" | "taxeParafiscale" | "accessoire" | "cnpac";

const COLUMNS: { key: MoneyColumnKey; label: string }[] = [
  { key: "primeNette", label: "Prime Nette" },
  { key: "taxe", label: "Taxes" },
  { key: "taxeParafiscale", label: "TPF" },
  { key: "accessoire", label: "ACC" },
  { key: "cnpac", label: "CNPAC" },
];

export function ManualQuittanceSection({
  lignes,
  setLignes,
  assistances = [],
  openSection,
  onSectionOpenChange,
}: Props) {
  const insuranceTotals = lignes.reduce(
    (acc, ligne) => ({
      primeNette: acc.primeNette + numberOrZero(ligne.primeNette),
      taxe: acc.taxe + numberOrZero(ligne.taxe),
      taxeParafiscale: acc.taxeParafiscale + numberOrZero(ligne.taxeParafiscale),
      accessoire: acc.accessoire + numberOrZero(ligne.accessoire),
      cnpac: acc.cnpac + numberOrZero(ligne.cnpac),
      primeTotale: acc.primeTotale + totalLine(ligne),
    }),
    { primeNette: 0, taxe: 0, taxeParafiscale: 0, accessoire: 0, cnpac: 0, primeTotale: 0 }
  );
  const assistanceTotals = assistances.reduce(
    (totals, assistance) => ({
      primeNette: totals.primeNette + numberOrZero(assistance.primeNette),
      taxe: totals.taxe + Math.max(
        0,
        numberOrZero(assistance.primeTotale) - numberOrZero(assistance.primeNette)
      ),
      primeTotale: totals.primeTotale + numberOrZero(assistance.primeTotale),
    }),
    { primeNette: 0, taxe: 0, primeTotale: 0 }
  );
  const hasAssistance = assistances.length > 0;
  const totals = {
    primeNette: insuranceTotals.primeNette + assistanceTotals.primeNette,
    taxe: insuranceTotals.taxe + assistanceTotals.taxe,
    taxeParafiscale: insuranceTotals.taxeParafiscale,
    accessoire: insuranceTotals.accessoire,
    cnpac: insuranceTotals.cnpac,
    primeTotale: insuranceTotals.primeTotale + assistanceTotals.primeTotale,
  };

  const update = (categorie: QuittanceInput["categorie"], key: MoneyColumnKey, value: number | undefined) => {
    setLignes(lignes.map((ligne) => (ligne.categorie === categorie ? { ...ligne, [key]: value } : ligne)));
  };

  return (
    <SectionCard
      title="Quittances"
      badge={moneyAmount(totals.primeTotale)}
      tone="production"
      defaultOpen={false}
      open={openSection === "quittances"}
      onOpenChange={(open) => onSectionOpenChange?.("quittances", open)}
    >
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left">Catégorie</th>
              {COLUMNS.map((column) => (
                <th key={column.key} className="w-40 px-3 py-3 text-left">{column.label}</th>
              ))}
              <th className="w-44 px-3 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.categorie} className="border-t align-middle">
                <td className="px-3 py-2 font-medium">{LABELS[ligne.categorie]}</td>
                {COLUMNS.map((column) => (
                  <td key={column.key} className="px-3 py-2">
                    <MoneyInput
                      className="border-emerald-300 bg-white shadow-sm focus-visible:border-emerald-600 focus-visible:ring-emerald-200 dark:bg-background"
                      value={ligne[column.key]}
                      onValueChange={(value) => update(ligne.categorie, column.key, value)}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold">{moneyAmount(totalLine(ligne))}</td>
              </tr>
            ))}
            {hasAssistance ? (
              <>
                <SummaryRow label="Total assurance" totals={insuranceTotals} />
                <tr className="border-t">
                  <td className="px-3 py-3 font-medium">Assistance</td>
                  <td className="px-3 py-3 text-right">{moneyAmount(assistanceTotals.primeNette)}</td>
                  <td className="px-3 py-3 text-right">{moneyAmount(assistanceTotals.taxe)}</td>
                  <td className="px-3 py-3 text-right">{moneyAmount(0)}</td>
                  <td className="px-3 py-3 text-right">{moneyAmount(0)}</td>
                  <td className="px-3 py-3 text-right">{moneyAmount(0)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{moneyAmount(assistanceTotals.primeTotale)}</td>
                </tr>
                <SummaryRow label="Total général" totals={totals} />
              </>
            ) : (
              <SummaryRow label="Total" totals={insuranceTotals} />
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function SummaryRow({
  label,
  totals,
}: {
  label: string;
  totals: {
    primeNette: number;
    taxe: number;
    taxeParafiscale: number;
    accessoire: number;
    cnpac: number;
    primeTotale: number;
  };
}) {
  return (
    <tr className="border-t bg-muted/50 font-semibold">
      <td className="px-3 py-3">{label}</td>
      <td className="px-3 py-3 text-right">{moneyAmount(totals.primeNette)}</td>
      <td className="px-3 py-3 text-right">{moneyAmount(totals.taxe)}</td>
      <td className="px-3 py-3 text-right">{moneyAmount(totals.taxeParafiscale)}</td>
      <td className="px-3 py-3 text-right">{moneyAmount(totals.accessoire)}</td>
      <td className="px-3 py-3 text-right">{moneyAmount(totals.cnpac)}</td>
      <td className="px-3 py-3 text-right">{moneyAmount(totals.primeTotale)}</td>
    </tr>
  );
}

function totalLine(ligne: QuittanceInput) {
  return roundMoney(
    numberOrZero(ligne.primeNette)
      + numberOrZero(ligne.taxe)
      + numberOrZero(ligne.taxeParafiscale)
      + numberOrZero(ligne.accessoire)
      + numberOrZero(ligne.cnpac)
  );
}
