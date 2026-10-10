import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import type { BankReference } from "../types";

export function BankSelect({
  banks,
  value,
  onChange,
  label = "Banque émettrice",
  disabled = false,
}: {
  banks: BankReference[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label} <span className="text-destructive">*</span></Label>
      <Combobox
        options={banks.filter((bank) => bank.actif).map((bank) => ({
          value: bank.id,
          label: bank.libelle,
          keywords: [bank.code, ...bank.aliases].join(" "),
        }))}
        value={value}
        onValueChange={(nextValue) => onChange(String(nextValue))}
        placeholder="Sélectionner une banque"
        searchPlaceholder="Nom, code ou ancien nom..."
        emptyText="Aucune banque active trouvée."
        disabled={disabled}
      />
    </div>
  );
}
