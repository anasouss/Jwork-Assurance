import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyInput } from "./MoneyInput";
import { moneyAmount } from "../utils/format";
import type { QuittanceInput, QuittancePreview } from "../types";

const columns = [
  ["primeNette", "Prime nette"],
  ["taxe", "Taxes"],
  ["taxeParafiscale", "TPF"],
  ["accessoire", "ACC"],
  ["cnpac", "CNPAC"],
] as const;

export function AvenantManualQuittanceTable({
  lignes,
  onChange,
  disabled,
  allowNegative,
  preview,
  loading = false,
}: {
  lignes: QuittanceInput[];
  onChange: (lignes: QuittanceInput[]) => void;
  disabled: boolean;
  allowNegative: boolean;
  preview?: QuittancePreview | null;
  loading?: boolean;
}) {
  const amount = (value?: number | null) => loading
    ? <Skeleton className="ml-auto h-4 w-20" />
    : value == null ? "-" : moneyAmount(value);
  return (
    <div className="overflow-x-auto rounded-md border bg-background" aria-busy={loading}>
      <Table className="min-w-[980px] table-fixed">
        <colgroup>
          <col className="w-[28%]" />
          {columns.map(([key]) => <col key={key} className="w-[12%]" />)}
          <col className="w-[12%]" />
        </colgroup>
        <TableHeader className="bg-muted/60 text-xs uppercase [&_th]:text-muted-foreground">
          <TableRow>
            <TableHead className="px-3 py-3">Catégorie</TableHead>
            {columns.map(([key, label]) => <TableHead key={key} className="px-3 py-3">{label}</TableHead>)}
            <TableHead className="px-3 py-3 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignes.map((ligne, index) => (
            <TableRow key={ligne.categorie}>
              <TableCell className="px-3 py-2 font-medium">{ligne.categorie === "CORPOREL" ? "Corporel" : ligne.categorie === "AUTOMOBILE" ? "Automobile" : ligne.categorie}</TableCell>
              {columns.map(([key, label]) => (
                <TableCell key={key} className="px-3 py-2">
                  <MoneyInput
                    allowNegative={allowNegative}
                    className="w-full min-w-0"
                    aria-label={`${ligne.categorie} - ${label}`}
                    value={ligne[key]}
                    disabled={disabled}
                    onValueChange={(value) => onChange(lignes.map((current, row) => row === index
                      ? { ...current, [key]: value, primeTotale: undefined }
                      : current))}
                  />
                </TableCell>
              ))}
              <TableCell className="px-3 py-2 text-right font-semibold tabular-nums">
                {amount(preview?.lignes.find((item) => item.categorie === ligne.categorie)?.primeTotale)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell className="px-3 py-3">Total assurance</TableCell>
            {columns.map(([key]) => <TableCell key={key} className="px-3 py-3 text-right tabular-nums">{amount(preview?.[key])}</TableCell>)}
            <TableCell className="px-3 py-3 text-right tabular-nums">{amount(preview?.primeTotale)}</TableCell>
          </TableRow>
          {(preview?.assistances ?? []).map((assistance, index) => (
            <TableRow key={index}>
              <TableCell className="px-3 py-3 font-medium">Assistance</TableCell>
              <TableCell className="px-3 py-3 text-right tabular-nums">{amount(assistance.primeNette)}</TableCell>
              <TableCell colSpan={4} />
              <TableCell className="px-3 py-3 text-right font-semibold tabular-nums">{amount(assistance.primeTotale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function emptyAvenantQuittance(): QuittanceInput[] {
  return [{ categorie: "AUTOMOBILE" }, { categorie: "CORPOREL" }, { categorie: "EVCAT" }];
}

export function hasAvenantQuittanceAmounts(lignes: QuittanceInput[]) {
  return lignes.some((ligne) => columns.some(([key]) => ligne[key] != null && Number.isFinite(ligne[key])));
}
