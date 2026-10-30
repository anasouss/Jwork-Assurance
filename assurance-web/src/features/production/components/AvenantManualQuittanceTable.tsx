import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QuittanceInput } from "../types";

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
}: {
  lignes: QuittanceInput[];
  onChange: (lignes: QuittanceInput[]) => void;
  disabled: boolean;
  allowNegative: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Catégorie</TableHead>
            {columns.map(([key, label]) => <TableHead key={key}>{label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignes.map((ligne, index) => (
            <TableRow key={ligne.categorie}>
              <TableCell className="font-medium">{ligne.categorie === "CORPOREL" ? "Corporel" : ligne.categorie === "AUTOMOBILE" ? "Automobile" : ligne.categorie}</TableCell>
              {columns.map(([key, label]) => (
                <TableCell key={key}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={allowNegative ? undefined : 0}
                    className="w-32 text-right"
                    aria-label={`${ligne.categorie} - ${label}`}
                    value={ligne[key] ?? ""}
                    disabled={disabled}
                    onChange={(event) => onChange(lignes.map((current, row) => row === index
                      ? { ...current, [key]: event.target.value === "" ? undefined : Number(event.target.value), primeTotale: undefined }
                      : current))}
                  />
                </TableCell>
              ))}
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
