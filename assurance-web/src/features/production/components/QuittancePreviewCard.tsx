import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QuittancePreview } from "../types";

export function QuittancePreviewCard({ preview }: { preview?: QuittancePreview | null }) {
  return (
    <div className="grid gap-3">
      {!preview ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Lancez la prévisualisation pour contrôler automobile, corporel, EVCAT, CNPAC et total avant création.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Prime nette</TableHead>
              <TableHead className="text-right">Taxe</TableHead>
              <TableHead className="text-right">TPF</TableHead>
              <TableHead className="text-right">CNPAC</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.lignes.map((ligne) => (
              <TableRow key={`${ligne.categorie}-${ligne.ordre}`}>
                <TableCell className={ligne.globale ? "font-semibold" : ""}>{ligne.categorie}</TableCell>
                <TableCell className="text-right">{formatMoney(ligne.primeNette)}</TableCell>
                <TableCell className="text-right">{formatMoney(ligne.taxe)}</TableCell>
                <TableCell className="text-right">{formatMoney(ligne.taxeParafiscale)}</TableCell>
                <TableCell className="text-right">{formatMoney(ligne.cnpac)}</TableCell>
                <TableCell className="text-right font-medium">{formatMoney(ligne.primeTotale)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function formatMoney(value?: number) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(value ?? 0);
}
