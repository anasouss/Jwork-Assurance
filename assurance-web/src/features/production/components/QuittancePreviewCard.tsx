import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "../utils/format";
import type { QuittancePreview } from "../types";

export function QuittancePreviewCard({
  preview,
  loading = false,
}: {
  preview?: QuittancePreview | null;
  loading?: boolean;
}) {
  const rows = preview?.lignes.length ? preview.lignes : emptyRows();

  return (
    <div className="grid gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Prime nette</TableHead>
            <TableHead className="text-right">Taxe</TableHead>
            <TableHead className="text-right">TPF</TableHead>
            <TableHead className="text-right">ACC</TableHead>
            <TableHead className="text-right">CNPAC</TableHead>
            <TableHead className="text-right">Total à payer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((ligne) => (
            <TableRow key={`${ligne.categorie}-${ligne.ordre}`}>
              <TableCell className={ligne.globale ? "font-semibold" : ""}>{ligne.categorie}</TableCell>
              <TableCell className="text-right">{formatPreviewValue(ligne.primeNette, loading, preview)}</TableCell>
              <TableCell className="text-right">{formatPreviewValue(ligne.taxe, loading, preview)}</TableCell>
              <TableCell className="text-right">{formatPreviewValue(ligne.taxeParafiscale, loading, preview)}</TableCell>
              <TableCell className="text-right">{formatPreviewValue(ligne.accessoire, loading, preview)}</TableCell>
              <TableCell className="text-right">{formatPreviewValue(ligne.cnpac, loading, preview)}</TableCell>
              <TableCell className="text-right font-medium">{formatPreviewValue(ligne.primeTotale, loading, preview)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function emptyRows(): QuittancePreview["lignes"] {
  return [
    emptyRow("AUTOMOBILE", 10),
    emptyRow("EVCAT", 30),
    emptyRow("TOTAL", 999, true),
  ];
}

function emptyRow(categorie: string, ordre: number, globale = false): QuittancePreview["lignes"][number] {
  return {
    categorie,
    ordre,
    globale,
    primeNette: 0,
    taxe: 0,
    taxeParafiscale: 0,
    accessoire: 0,
    cnpac: 0,
    primeTotale: 0,
  };
}

function formatPreviewValue(value: number, loading: boolean, preview?: QuittancePreview | null) {
  if (loading) {
    return "Calcul...";
  }
  if (!preview) {
    return "-";
  }
  return formatMoney(value);
}
