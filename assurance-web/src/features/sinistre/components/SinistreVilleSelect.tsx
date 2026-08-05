import { AutocompleteSelect } from "@/components/ui/autocomplete-select";

export type CityOption = {
  id: string;
  code?: string | null;
  libelle: string;
};

export function SinistreVilleSelect({
  cities,
  value,
  disabled = false,
  onValueChange,
}: {
  cities: CityOption[];
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <AutocompleteSelect
      value={value}
      disabled={disabled}
      placeholder="Sélectionner une ville"
      emptyText="Aucune ville trouvée"
      invalidText="Ville invalide : choisissez une option existante."
      options={cities.map((city) => ({
        value: city.id,
        label: city.libelle,
        keywords: city.code,
      }))}
      onValueChange={onValueChange}
    />
  );
}
