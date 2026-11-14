import { Checkbox } from "@/components/ui/checkbox";
import { TableRowsSkeleton } from "@/components/shared";
import type { ConventionInvoicePreparation } from "../types";
import { formatAccountingAmount } from "../format";

export type ConventionBillingSource = ConventionInvoicePreparation["lignes"][number];

export function ConventionBillingSources({ rows, selected, selectionKey, loading, error, emptyMessage, canSelect, onToggle, onTogglePage }: {
  rows: ConventionBillingSource[];
  selected: Set<string>;
  selectionKey?: string;
  loading: boolean;
  error?: string;
  emptyMessage: string;
  canSelect: boolean;
  onToggle: (row: ConventionBillingSource, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
}) {
  const compatible = rows.filter(row => !row.blocage && row.details.length && (!selectionKey || billingSelectionKey(row) === selectionKey));
  const checked = compatible.length > 0 && compatible.every(row => selected.has(row.echeanceId));
  return <div className="overflow-x-auto border">
    <table className="w-full min-w-[1400px] text-sm">
      <thead className="bg-orange-600 text-left text-xs text-white"><tr>
        <th className="w-10 px-3 py-3"><Checkbox checked={checked} disabled={!canSelect || !compatible.length}
          onCheckedChange={value => onTogglePage(value === true)} aria-label="Sélectionner les lignes de la même convention, période et du même sens" /></th>
        <th className="px-3 py-3">Période facturée</th>
        {["Quittance N°", "Police N°", "Compagnie", "Mouvement", "Assuré", "Véhicule", "Date d'effet", "Date d'expiration", "Montant bulletin", "Montant à payer"].map((label, index) =>
          <th key={label} className={`px-3 py-3 ${index >= 8 ? "text-right" : ""}`}>{label}</th>)}
      </tr></thead>
      <tbody className="divide-y">{error ? <tr><td colSpan={12} className="bg-destructive/5 p-6 text-destructive"><p role="alert">{error}</p></td></tr>
        : loading ? <TableRowsSkeleton colSpan={12} rows={6} />
        : !rows.length ? <tr><td colSpan={12} className="p-10 text-center text-muted-foreground">{emptyMessage}</td></tr>
        : rows.flatMap(row => (row.details.length ? row.details : [null]).map((line, index) => <tr key={`${row.echeanceId}:${index}`} className="hover:bg-muted/30">
          {index === 0 && <>
            <td className="px-3 py-3" rowSpan={Math.max(1, row.details.length)}>
              <Checkbox checked={selected.has(row.echeanceId)}
                disabled={!canSelect || Boolean(row.blocage) || Boolean(selectionKey && selectionKey !== billingSelectionKey(row))}
                onCheckedChange={value => onToggle(row, value === true)} aria-label={`Sélectionner les lignes de ${row.payeurNom}`} />
            </td>
            <td className="whitespace-nowrap px-3 py-3 text-xs" rowSpan={Math.max(1, row.details.length)}>
              <div>Du {date(row.periodeDebut)}</div>
              <div>au {date(row.periodeFin)}</div>
            </td>
          </>}
          {line ? <>
            {[line.numeroQuittance, line.numeroPolice, line.compagnie, line.mouvement, line.assure, line.vehicule,
              date(line.dateEffet), date(line.dateExpiration)].map((value, column) => <td key={column} className="px-3 py-3">
                {value || "-"}
                {column === 1 && index === 0 && row.correspondancePartielle && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Échéance complète · plusieurs lignes</p>}
                {column === 1 && index === 0 && row.blocage && <p className="mt-1 text-xs text-destructive">{row.blocage}</p>}
              </td>)}
            <td className="px-3 py-3 text-right tabular-nums">{money(line.montantBulletin)}</td>
            <td className="px-3 py-3 text-right font-semibold tabular-nums">{money(line.montantAPayer)}</td>
          </> : <td colSpan={10} className="px-3 py-3 text-muted-foreground">{row.blocage ? <p className="text-destructive">{row.blocage}</p> : "-"}</td>}
        </tr>))}</tbody>
    </table>
  </div>;
}

export function payerKey(row: ConventionBillingSource) {
  return `${row.payeurType}:${row.payeurId}`;
}

export function billingSelectionKey(row: ConventionBillingSource) {
  return `${payerKey(row)}:${row.periodeDebut ?? ""}:${row.periodeFin ?? ""}:${billingDirection(row)}`;
}

export function billingDirection(row: ConventionBillingSource) {
  const signs = new Set(row.details.filter(line => line.montantAPayer != null && line.montantAPayer !== 0).map(line => Math.sign(line.montantAPayer!)));
  return signs.size === 1 ? signs.values().next().value ?? 0 : 0;
}

function money(value: number | null) {
  return value == null ? "-" : formatAccountingAmount(value);
}

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`)) : "-";
}
