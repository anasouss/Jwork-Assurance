import { Input } from "@/components/ui/input";
import { SectionCard } from "./SectionCard";
import type { QuittanceInput } from "../types";

type Props = {
  lignes: QuittanceInput[];
  setLignes: (value: QuittanceInput[]) => void;
};

const LABELS: Record<QuittanceInput["categorie"], string> = {
  AUTOMOBILE: "Automobile",
  CORPOREL: "Corporel",
  EVCAT: "EVCAT",
  ASSISTANCE: "Assistance",
  TOTAL: "Total",
};

const COLUMNS: { key: keyof QuittanceInput; label: string }[] = [
  { key: "primeNette", label: "Prime nette" },
  { key: "taxe", label: "Taxe" },
  { key: "taxeParafiscale", label: "TPF" },
  { key: "accessoire", label: "ACC" },
  { key: "cnpac", label: "CNPAC" },
];

export function ManualQuittanceSection({ lignes, setLignes }: Props) {
  const totals = lignes.reduce(
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

  const update = (categorie: QuittanceInput["categorie"], key: keyof QuittanceInput, value: string) => {
    setLignes(lignes.map((ligne) => (ligne.categorie === categorie ? { ...ligne, [key]: numberValue(value) } : ligne)));
  };

  return (
    <SectionCard title="Quittances" badge={formatMoney(totals.primeTotale)} tone="production" defaultOpen>
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
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="border-emerald-300 bg-white shadow-sm focus-visible:border-emerald-600 focus-visible:ring-emerald-200 dark:bg-background"
                      value={String(ligne[column.key] ?? "")}
                      onChange={(event) => update(ligne.categorie, column.key, event.target.value)}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold">{formatMoney(totalLine(ligne))}</td>
              </tr>
            ))}
            <tr className="border-t bg-muted/50 font-semibold">
              <td className="px-3 py-3">Total</td>
              <td className="px-3 py-3 text-right">{formatMoney(totals.primeNette)}</td>
              <td className="px-3 py-3 text-right">{formatMoney(totals.taxe)}</td>
              <td className="px-3 py-3 text-right">{formatMoney(totals.taxeParafiscale)}</td>
              <td className="px-3 py-3 text-right">{formatMoney(totals.accessoire)}</td>
              <td className="px-3 py-3 text-right">{formatMoney(totals.cnpac)}</td>
              <td className="px-3 py-3 text-right">{formatMoney(totals.primeTotale)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
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

function numberValue(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberOrZero(value?: number) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value?: number) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(value ?? 0);
}
