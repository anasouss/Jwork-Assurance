import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientSection } from "../components/ClientSection";
import { GarantieSection } from "../components/GarantieSection";
import { ManualQuittanceSection } from "../components/ManualQuittanceSection";
import { QuittancePreviewCard } from "../components/QuittancePreviewCard";
import { RemorqueSection } from "../components/RemorqueSection";
import { SectionCard } from "../components/SectionCard";
import { VehiculeSection } from "../components/VehiculeSection";
import { ContractInfoSection } from "./ContractInfoSection";
import { FlotteTargetsSection } from "./FlotteTargetsSection";
import { TariffGridSection } from "./TariffGridSection";
import type { ContratCreationFormState } from "./useContratCreationForm";

type Props = {
  form: ContratCreationFormState;
  badge: string;
  description: string;
  showConvention?: boolean;
  showGrille?: boolean;
  allowSaisiePrimeNette?: boolean;
  allowMultipleVehicules?: boolean;
  allowRemorques?: boolean;
  maxRemorques?: number | null;
  showFractionnement?: boolean;
  order?: "mono" | "flotte";
};

export function ContratFormLayout({
  form,
  badge,
  description,
  showConvention = false,
  showGrille = true,
  allowSaisiePrimeNette = false,
  allowMultipleVehicules = false,
  allowRemorques = true,
  maxRemorques = 1,
  showFractionnement = true,
  order = "mono",
}: Props) {
  const clientSections = (
    <ClientSection
      clients={form.clients}
      setClients={form.setClients}
      villes={form.refs.villes.data ?? []}
      showOptionalRoles={false}
      errors={form.validationErrors}
      onSaveSection={form.handleSaveSection}
      savedSections={form.savedSections}
    />
  );

  const contractSection = (
    <ContractInfoSection
      form={form}
      badge={badge}
      showConvention={showConvention}
      showGrille={showGrille && order !== "flotte"}
      showFractionnement={showFractionnement}
    />
  );

  const vehicleSection = (
    <VehiculeSection
      vehicules={form.vehicules}
      setVehicules={form.setVehicules}
      usages={form.refs.usages.data ?? []}
      marques={form.refs.marques.data ?? []}
      carrosseries={form.refs.carrosseries.data ?? []}
      categoriesTransport={form.refs.categoriesTransport.data ?? []}
      allowMultipleVehicules={allowMultipleVehicules}
      errors={form.validationErrors}
    />
  );

  const guaranteeSection = (
    <GarantieSection
      garanties={form.refs.garanties.data ?? []}
      selected={form.garanties}
      setSelected={form.setGaranties}
      lignes={showGrille ? form.lignesGrille.data ?? [] : []}
      vehiculeCount={form.vehicules.length}
      showLigneGrille={false}
      automaticPricing={showGrille}
      allowPrimeColumn={allowSaisiePrimeNette}
      primeColumnEnabled={form.saisiePrimeNette}
      setPrimeColumnEnabled={form.setSaisiePrimeNette}
    />
  );

  const flotteTargetsSection = (
    <FlotteTargetsSection
      vehicules={form.vehicules}
      setVehicules={form.setVehicules}
      remorques={form.remorques}
      setRemorques={form.setRemorques}
      garanties={form.refs.garanties.data ?? []}
      selectedGaranties={form.garanties}
      setSelectedGaranties={form.setGaranties}
      lignes={form.lignesGrille.data ?? []}
      formulesPersonne={form.formulesPersonne.data ?? []}
      usages={form.refs.usages.data ?? []}
      marques={form.refs.marques.data ?? []}
      carrosseries={form.refs.carrosseries.data ?? []}
      categoriesTransport={form.refs.categoriesTransport.data ?? []}
      compagniesAssistance={form.refs.compagniesAssistance.data ?? []}
      produitsAssistance={form.refs.produitsAssistance.data ?? []}
      grilleSelected={Boolean(form.grilleTarifaireId)}
      preview={form.preview}
      previewing={form.previewMutation.isPending || form.autoPreviewMutation.isPending}
      onPreviewQuittance={form.handlePreview}
      setAssistanceEnabled={form.setAssistanceEnabled}
      maxRemorques={maxRemorques}
      errors={form.validationErrors}
    />
  );

  const remorqueSection = (
    <RemorqueSection
      remorques={form.remorques}
      setRemorques={form.setRemorques}
      usages={form.refs.usages.data ?? []}
      marques={form.refs.marques.data ?? []}
      maxRemorques={maxRemorques}
    />
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Production</div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Ajouter dossier</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {clientSections}
      {contractSection}
      {order === "flotte" ? (
        <>
          <TariffGridSection form={form} />
          {flotteTargetsSection}
        </>
      ) : (
        <>
          {vehicleSection}
          {allowRemorques ? remorqueSection : null}
          {guaranteeSection}
        </>
      )}

      {form.typeContrat === "PARTICULIER" ? (
      <ManualQuittanceSection lignes={form.quittances} setLignes={form.setQuittances} />
    ) : (
      <SectionCard
        title="Quittances"
        badge={form.preview ? "Calculée" : "Non calculée"}
        tone="production"
        defaultOpen={false}
      >
        <QuittancePreviewCard preview={form.preview} />
      </SectionCard>
    )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={form.handleCreate} disabled={form.createMutation.isPending}>
          <Save className="size-4" />
          Créer contrat
        </Button>
      </div>
    </div>
  );
}
