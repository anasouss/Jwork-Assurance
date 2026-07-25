import { ContratFormLayout } from "./ContratFormLayout";
import type { ContratCreationFormState } from "./useContratCreationForm";

export function FlotteContratForm({ form }: { form: ContratCreationFormState }) {
  return (
    <ContratFormLayout
      form={form}
      badge="Flotte"
      description="Contrat flotte avec grille tarifaire et gestion multi-véhicules."
      showGrille
      allowMultipleVehicules
      order="flotte"
    />
  );
}
