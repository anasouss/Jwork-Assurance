import type { ConventionInvoicePreview } from "../types";
import { formatAccountingAmount } from "../format";
import { TableRowsSkeleton } from "@/components/shared";

export function ConventionInvoiceLines({ preview, loading = false, emptyMessage = "Aucune ligne." }: {
  preview: ConventionInvoicePreview;
  loading?: boolean;
  emptyMessage?: string;
}) {
  return <div className="overflow-x-auto border">
    <table className="w-full min-w-[1100px] text-sm">
      <thead className="bg-muted text-left text-xs">
        <tr>{["Quittance N°", "Police N°", "Compagnie", "Mouvement", "Assuré", "Véhicule", "Date d'effet", "Date d'expiration", "Montant bulletin", "Montant à payer"].map((label, index) =>
          <th key={label} className={`px-3 py-3 ${index >= 8 ? "text-right" : ""}`}>{label}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y">{loading ? <TableRowsSkeleton colSpan={10} rows={6} />
        : !preview.lignes.length ? <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">{emptyMessage}</td></tr>
        : preview.lignes.map((line, index) => <tr key={index}>
        {[line.numeroQuittance, line.numeroPolice, line.compagnie, line.mouvement, line.assure, line.vehicule,
          date(line.dateEffet), date(line.dateExpiration)].map((value, column) => <td key={column} className="px-3 py-3">{value || "-"}</td>)}
        <td className="px-3 py-3 text-right tabular-nums">{line.montantBulletin == null ? "-" : formatAccountingAmount(line.montantBulletin)}</td>
        <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatAccountingAmount(line.montantAPayer)}</td>
      </tr>)}</tbody>
      {!loading && preview.lignes.length > 0 && <tfoot className="border-t bg-muted/50 font-semibold"><tr><td colSpan={9} className="px-3 py-3">Total à payer (MAD)</td>
        <td className="px-3 py-3 text-right tabular-nums">{formatAccountingAmount(preview.total)}</td></tr></tfoot>}
    </table>
  </div>;
}

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`)) : "-";
}
