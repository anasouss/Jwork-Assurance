import { Save, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientSection } from "../components/ClientSection";
import { GarantieSection } from "../components/GarantieSection";
import { QuittancePreviewCard } from "../components/QuittancePreviewCard";
import { RemorqueSection } from "../components/RemorqueSection";
import { SectionCard } from "../components/SectionCard";
import { VehiculeSection } from "../components/VehiculeSection";
import { ContractInfoSection } from "./ContractInfoSection";
import type { ContratCreationFormState } from "./useContratCreationForm";

type Props = {
  form: ContratCreationFormState;
  badge: string;
  description: string;
  showConvention?: boolean;
  showGrille?: boolean;
  allowSaisiePrimeNette?: boolean;
  allowMultipleVehicules?: boolean;
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
  order = "mono",
}: Props) {
  const clientSections = (
    <ClientSection
      clients={form.clients}
      setClients={form.setClients}
      villes={form.refs.villes.data ?? []}
      categoriesClient={form.refs.categoriesClient.data ?? []}
      showOptionalRoles={false}
    />
  );

  const contractSection = (
    <ContractInfoSection
      form={form}
      badge={badge}
      showConvention={showConvention}
      showGrille={showGrille}
      allowSaisiePrimeNette={allowSaisiePrimeNette}
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
    />
  );

  const guaranteeSection = (
    <GarantieSection
      garanties={form.refs.garanties.data ?? []}
      selected={form.garanties}
      setSelected={form.setGaranties}
      lignes={showGrille ? form.lignesGrille.data ?? [] : []}
      vehiculeCount={form.vehicules.length}
      showLigneGrille={showGrille}
      showPrimeColumn={allowSaisiePrimeNette && form.saisiePrimeNette}
    />
  );

  const remorqueSection = (
    <RemorqueSection
      remorques={form.remorques}
      setRemorques={form.setRemorques}
      usages={form.refs.usages.data ?? []}
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={form.handlePreview} disabled={form.previewMutation.isPending}>
            <Wand2 className="size-4" />
            Prévisualiser
          </Button>
          <Button onClick={form.handleCreate} disabled={form.createMutation.isPending}>
            <Save className="size-4" />
            Créer contrat
          </Button>
        </div>
      </div>

      {clientSections}
      {contractSection}
      {order === "flotte" ? (
        <>
          {guaranteeSection}
          {vehicleSection}
          {remorqueSection}
        </>
      ) : (
        <>
          {vehicleSection}
          {remorqueSection}
          {guaranteeSection}
        </>
      )}

      <SectionCard title="Quittances" tone="production" defaultOpen={false}>
        <QuittancePreviewCard preview={form.preview} />
      </SectionCard>
    </div>
  );
}
