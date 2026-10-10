import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
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
      <AutocompleteSelect
        options={banks.filter((bank) => bank.actif).map((bank) => ({
          value: bank.id,
          label: bank.libelle,
          keywords: [bank.code, ...bank.aliases].join(" "),
        }))}
        value={value}
        onValueChange={(nextValue) => onChange(String(nextValue))}
        placeholder="Nom, code ou ancien nom"
        emptyText="Aucune banque active trouvée."
        invalidText="Banque invalide : choisissez une option existante."
        disabled={disabled}
      />
    </div>
  );
}
