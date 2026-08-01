import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReferenceOption } from "../types";

export type AttestationUsageLine = {
  id: string;
  groupeUsageAttestationCode: string;
  numeroDebut: string;
  numeroFin: string;
};

type Props<TLine extends AttestationUsageLine> = {
  groupes: ReferenceOption[];
  lines: TLine[];
  showRanges: boolean;
  disabled?: boolean;
  quantityValue: (line: TLine) => string;
  onToggle: (groupe: ReferenceOption, checked: boolean) => void;
  onQuantityChange: (line: TLine, value: string) => void;
  onRangeChange: (line: TLine, patch: { numeroDebut?: string; numeroFin?: string }) => void;
};

export function AttestationUsageSelectionTable<TLine extends AttestationUsageLine>({
  groupes,
  lines,
  showRanges,
  disabled,
  quantityValue,
  onToggle,
  onQuantityChange,
  onRangeChange,
}: Props<TLine>) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="font-medium">Usages concernés</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Cochez les usages à traiter, puis renseignez les valeurs de chaque ligne.
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">Choix</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="w-52">Quantité</TableHead>
              {showRanges ? <TableHead className="w-56">N° début</TableHead> : null}
              {showRanges ? <TableHead className="w-56">N° fin calculé</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupes.map((groupe) => {
              const code = String(groupe.code ?? groupe.id);
              const line = lines.find((item) => item.groupeUsageAttestationCode === code);
              const checked = Boolean(line);
              return (
                <TableRow key={groupe.id} className={checked ? "bg-emerald-50/70" : undefined}>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(value) => onToggle(groupe, value === true)}
                      aria-label={`Sélectionner l'usage ${code}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{code}</div>
                    <div className="text-xs text-muted-foreground">{groupe.libelle}</div>
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="numeric"
                      value={line ? quantityValue(line) : ""}
                      disabled={!line}
                      onChange={(event) => {
                        if (!line) return;
                        const value = event.target.value;
                        onQuantityChange(line, value);
                        if (showRanges) {
                          onRangeChange(line, { numeroFin: calculatedRangeEnd(line.numeroDebut, value) });
                        }
                      }}
                    />
                  </TableCell>
                  {showRanges ? (
                    <TableCell>
                      <Input
                        inputMode="numeric"
                        value={line?.numeroDebut ?? ""}
                        disabled={!line}
                        onChange={(event) => {
                          if (!line) return;
                          const numeroDebut = event.target.value;
                          onRangeChange(line, {
                            numeroDebut,
                            numeroFin: calculatedRangeEnd(numeroDebut, quantityValue(line)),
                          });
                        }}
                      />
                    </TableCell>
                  ) : null}
                  {showRanges ? (
                    <TableCell>
                      <Input
                        value={line?.numeroFin ?? ""}
                        disabled={!line}
                        readOnly
                        className="bg-muted/50"
                        aria-label={`Numéro de fin calculé pour l'usage ${code}`}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
            {groupes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showRanges ? 5 : 3} className="h-24 text-center text-sm text-muted-foreground">
                  {disabled ? "Sélectionnez d'abord une compagnie." : "Aucun usage disponible."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function calculatedRangeEnd(numeroDebut: string, quantite: string) {
  const debut = Number.parseInt(numeroDebut, 10);
  const count = toPositiveInteger(quantite);
  if (!Number.isFinite(debut) || debut < 0 || !count) return "";
  return String(debut + count - 1);
}

function toPositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
