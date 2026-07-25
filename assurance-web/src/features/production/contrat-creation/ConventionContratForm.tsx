import { ContratFormLayout } from "./ContratFormLayout";
import type { ContratCreationFormState } from "./useContratCreationForm";

export function ConventionContratForm({ form }: { form: ContratCreationFormState }) {
  return (
    <ContratFormLayout
      form={form}
      badge="Convention"
      description="Contrat convention avec convention, usage autorisé et grille tarifaire."
      showConvention
      showGrille
      allowMultipleVehicules={false}
      showFractionnement={false}
    />
  );
}
