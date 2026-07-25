import { ContratFormLayout } from "./ContratFormLayout";
import type { ContratCreationFormState } from "./useContratCreationForm";

export function ParticulierContratForm({ form }: { form: ContratCreationFormState }) {
  return (
    <ContratFormLayout
      form={form}
      badge="Particulier"
      description="Contrat automobile particulier avec saisie manuelle des garanties."
      showGrille={false}
      allowSaisiePrimeNette
      allowMultipleVehicules={false}
    />
  );
}
