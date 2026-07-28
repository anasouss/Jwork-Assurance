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
  const rows = preview?.lignes.length ? visibleRows(preview) : emptyRows();

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

function visibleRows(preview: QuittancePreview) {
  const showCorporel = hasPersonneGuarantee(preview);
  const rows = preview.lignes.filter((ligne) => String(ligne.categorie ?? "").toUpperCase() !== "CORPOREL" || showCorporel);
  const alreadyIncludesAssistance = rows.some((ligne) => String(ligne.categorie ?? "").toUpperCase() === "ASSISTANCE");
  const assistance = alreadyIncludesAssistance ? null : assistanceRow(preview);
  return assistance ? [...rows, assistance] : rows;
}

function assistanceRow(preview: QuittancePreview): QuittancePreview["lignes"][number] | null {
  if (!preview.assistances?.length) {
    return null;
  }
  const primeNette = preview.assistances.reduce((total, assistance) => total + Number(assistance.primeNette ?? 0), 0);
  const primeTotale = preview.assistances.reduce((total, assistance) => total + Number(assistance.primeTotale ?? 0), 0);
  return {
    categorie: "ASSISTANCE",
    ordre: 110,
    globale: false,
    primeNette,
    taxe: Math.max(0, primeTotale - primeNette),
    taxeParafiscale: 0,
    accessoire: 0,
    cnpac: 0,
    primeTotale,
  };
}

function hasPersonneGuarantee(preview: QuittancePreview) {
  return (preview.garanties ?? []).some((garantie) => {
    const type = String(garantie.typeGarantie ?? "").toUpperCase();
    const code = String(garantie.code ?? "").toUpperCase();
    return type === "PERSONNE" || code === "PP" || code === "PC" || code === "PTA";
  });
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
