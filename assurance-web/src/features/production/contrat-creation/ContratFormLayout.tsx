import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientSection } from "../components/ClientSection";
import { GarantieSection } from "../components/GarantieSection";
import { ManualQuittanceSection } from "../components/ManualQuittanceSection";
import { QuittancePreviewCard } from "../components/QuittancePreviewCard";
import { RemorqueSection } from "../components/RemorqueSection";
import { SectionCard } from "../components/SectionCard";
import { VehiculeSection } from "../components/VehiculeSection";
import { formatMoney, roundMoney } from "../utils/format";
import { ContractInfoSection } from "./ContractInfoSection";
import { FlotteTargetsSection } from "./FlotteTargetsSection";
import { TariffGridSection } from "./TariffGridSection";
import type { QuittancePreview } from "../types";
import type { ContratCreationFormState, ContratSectionKey } from "./useContratCreationForm";

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
  const souscripteurCategorieClientId = form.clients.find((client) => client.role === "SOUSCRIPTEUR")?.client.categorieClientId ?? "";
  const proprietaireCategorieClientId = form.clients.find((client) => client.role === "PROPRIETAIRE")?.client.categorieClientId ?? "";
  const assistanceCategorieClientId = order === "flotte"
    ? proprietaireCategorieClientId || souscripteurCategorieClientId
    : souscripteurCategorieClientId;
  const flotteTargetUsages = useMemo(() => {
    if (order !== "flotte") {
      return form.availableUsages;
    }
    if (!form.grilleTarifaireId) {
      return [];
    }
    const configuredUsageIds = new Set<string>();
    for (const ligne of form.lignesGrille.data ?? []) {
      if (ligne.usageId) configuredUsageIds.add(String(ligne.usageId));
    }
    for (const formule of form.formulesPersonne.data ?? []) {
      if (formule.usageId) configuredUsageIds.add(String(formule.usageId));
    }
    return form.availableUsages.filter((usage) => configuredUsageIds.has(usage.id));
  }, [form.availableUsages, form.formulesPersonne.data, form.grilleTarifaireId, form.lignesGrille.data, order]);
  const workflowSections = useMemo<ContratSectionKey[]>(() => {
    if (order === "flotte") {
      return ["souscripteur", "proprietaire", "contrat", "grille", "flotteTargets", "remorque", "quittances"];
    }
    return [
      "souscripteur",
      "proprietaire",
      "contrat",
      "vehicule",
      ...(allowRemorques ? (["remorque"] as ContratSectionKey[]) : []),
      "garanties",
      "quittances",
    ];
  }, [allowRemorques, order]);
  const [activeSection, setActiveSection] = useState<ContratSectionKey>("souscripteur");

  useEffect(() => {
    if (!workflowSections.includes(activeSection)) {
      setActiveSection(workflowSections[0] ?? "souscripteur");
    }
  }, [activeSection, workflowSections]);

  const handleSectionOpenChange = (section: ContratSectionKey, open: boolean) => {
    if (!open) {
      return;
    }
    const targetIndex = workflowSections.indexOf(section);
    if (targetIndex === -1) {
      return;
    }
    for (const previous of workflowSections.slice(0, targetIndex)) {
      if (!form.validateSection(previous)) {
        setActiveSection(previous);
        return;
      }
    }
    setActiveSection(section);
  };

  const clientSections = (
    <ClientSection
      clients={form.clients}
      setClients={form.setClients}
      villes={form.refs.villes.data ?? []}
      categoriesClient={form.refs.categoriesClient.data ?? []}
      showOptionalRoles={false}
      showProprietaireCategorie={order === "flotte"}
      errors={form.validationErrors}
      onSaveSection={form.handleSaveSection}
      savedSections={form.savedSections}
      saving={form.saveDraftMutation.isPending}
      openSection={activeSection}
      onSectionOpenChange={handleSectionOpenChange}
    />
  );

  const contractSection = (
    <ContractInfoSection
      form={form}
      badge={badge}
      showConvention={showConvention}
      showGrille={showGrille && order !== "flotte" && !showConvention}
      showFractionnement={showFractionnement}
      openSection={activeSection}
      onSectionOpenChange={handleSectionOpenChange}
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
      showUsage={!showConvention}
      showAttestation={!showConvention}
      showRemorqueFlag={showConvention}
      errors={form.validationErrors}
      onSaveSection={form.handleSaveSection}
      savedSections={form.savedSections}
      saving={form.saveDraftMutation.isPending}
      openSection={activeSection}
      onSectionOpenChange={handleSectionOpenChange}
    />
  );

  const guaranteeSection = (
    <GarantieSection
      garanties={form.refs.garanties.data ?? []}
      selected={form.garanties}
      setSelected={form.setGaranties}
      lignes={showGrille ? form.lignesGrille.data ?? [] : []}
      formulesPersonne={showGrille ? form.formulesPersonne.data ?? [] : []}
      vehicules={form.vehicules}
      usages={form.refs.usages.data ?? []}
      vehiculeCount={form.vehicules.length}
      showLigneGrille={false}
      automaticPricing={showGrille}
      allowPrimeColumn={allowSaisiePrimeNette}
      primeColumnEnabled={form.saisiePrimeNette}
      setPrimeColumnEnabled={form.setSaisiePrimeNette}
      preview={form.preview}
      previewing={form.previewMutation.isPending || form.autoPreviewMutation.isPending}
      assistanceEnabled={form.assistanceEnabled}
      setAssistanceEnabled={form.setAssistanceEnabled}
      showAssistanceRow={showConvention}
      assistanceDraft={form.assistanceDraft}
      setAssistanceDraft={form.setAssistanceDraft}
      compagniesAssistance={form.refs.compagniesAssistance.data ?? []}
      produitsAssistance={form.refs.produitsAssistance.data ?? []}
      assistanceUsageId={form.usageId}
      assistanceCategorieClientId={assistanceCategorieClientId}
      onSaveSection={form.handleSaveSection}
      savedSections={form.savedSections}
      saving={form.saveDraftMutation.isPending}
      openSection={activeSection}
      onSectionOpenChange={handleSectionOpenChange}
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
      usages={flotteTargetUsages}
      marques={form.refs.marques.data ?? []}
      carrosseries={form.refs.carrosseries.data ?? []}
      categoriesTransport={form.refs.categoriesTransport.data ?? []}
      compagniesAssistance={form.refs.compagniesAssistance.data ?? []}
      produitsAssistance={form.refs.produitsAssistance.data ?? []}
      grilleSelected={Boolean(form.grilleTarifaireId)}
      preview={form.preview}
      targetPreview={form.targetPreview}
      previewing={form.targetPreviewMutation.isPending}
      saving={form.saveDraftMutation.isPending || form.saveTargetDraftMutation.isPending}
      onPreviewQuittance={form.handlePreviewTarget}
      onSaveDraft={form.handleSaveDraft}
      onSaveTargetDraft={form.handleSaveTargetDraft}
      onValidateTarget={form.validateTarget}
      setAssistanceEnabled={form.setAssistanceEnabled}
      assistanceCategorieClientId={assistanceCategorieClientId}
      crmPartage={form.crmPartage}
      crmPartageValeur={form.crmPartageValeur}
      prospectionMode={form.prospectionMode}
      maxRemorques={maxRemorques}
      errors={form.validationErrors}
      openSection={activeSection}
      onSectionOpenChange={handleSectionOpenChange}
    />
  );

  const remorqueSection = (
    <RemorqueSection
      remorques={form.remorques}
      setRemorques={form.setRemorques}
      usages={form.refs.usages.data ?? []}
      marques={form.refs.marques.data ?? []}
      maxRemorques={maxRemorques}
      openSection={activeSection}
      onSectionOpenChange={handleSectionOpenChange}
    />
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Production</div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{form.prospectionMode ? "Ajouter devis" : "Ajouter dossier"}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {clientSections}
      {contractSection}
      {order === "flotte" ? (
        <>
          <TariffGridSection form={form} openSection={activeSection} onSectionOpenChange={handleSectionOpenChange} />
          {flotteTargetsSection}
        </>
      ) : (
        <>
          {vehicleSection}
          {allowRemorques ? remorqueSection : null}
          {guaranteeSection}
          {form.typeContrat !== "PARTICULIER" ? (
            <VehicleCalculationSummary
              preview={form.preview}
              loading={form.previewMutation.isPending || form.autoPreviewMutation.isPending}
            />
          ) : null}
        </>
      )}

      {form.typeContrat === "PARTICULIER" ? (
      <ManualQuittanceSection
        lignes={form.quittances}
        setLignes={form.setQuittances}
        openSection={activeSection}
        onSectionOpenChange={handleSectionOpenChange}
      />
    ) : (
      <SectionCard
        title="Quittance générale"
        badge={form.preview ? "Calculée" : "Non calculée"}
        tone="production"
        defaultOpen={false}
        open={activeSection === "quittances"}
        onOpenChange={(open) => handleSectionOpenChange("quittances", open)}
      >
        <QuittancePreviewCard preview={form.preview} loading={form.previewMutation.isPending || form.autoPreviewMutation.isPending} />
      </SectionCard>
    )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={form.handleCreate} disabled={form.createMutation.isPending}>
          {form.createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {form.createMutation.isPending
            ? form.correctionMode ? "Enregistrement..." : "Création..."
            : form.correctionMode ? "Enregistrer" : form.prospectionMode ? "Créer devis" : "Créer contrat"}
        </Button>
      </div>
    </div>
  );
}

type VehicleSummary = {
  label: string;
  totalNet?: number;
  evcat?: number;
  pta?: number;
  accessoire?: number;
  taxe?: number;
  cnpac?: number;
  totalAPayer?: number;
};

function VehicleCalculationSummary({ preview, loading }: { preview?: QuittancePreview | null; loading?: boolean }) {
  const summaries = vehicleSummaries(preview);
  const calculated = Boolean(preview);

  return (
    <SectionCard
      title="Résumé véhicule"
      badge={calculated ? "Calculé" : "Non calculé"}
      tone="production"
      defaultOpen
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(summaries.length > 0 ? summaries : [emptyVehicleSummary()]).map((summary, index) => {
          const rows: [string, number | undefined][] = [
            ["TOTAL NET", summary.totalNet],
            ["EVCAT", summary.evcat],
            ["TAXE", summary.taxe],
            ["CNPAC", summary.cnpac],
            ["TOTAL À PAYER", summary.totalAPayer],
          ];
          if (summary.pta != null) {
            rows.splice(2, 0, ["PTA (Prime Personne)", summary.pta], ["ACCESSOIRE", summary.accessoire]);
          }

          return (
            <div key={`${summary.label}-${index}`} className="overflow-hidden rounded-md border">
              {summaries.length > 1 ? (
                <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase">{summary.label}</div>
              ) : null}
              {rows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[1fr_140px] border-b last:border-b-0">
                  <div className="bg-muted/20 px-3 py-2 text-right text-xs font-semibold uppercase">{label}</div>
                  <div className="px-3 py-2 text-right text-xs font-semibold">
                    {loading ? "Calcul..." : value == null ? "-" : formatMoney(value)}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function vehicleSummaries(preview?: QuittancePreview | null): VehicleSummary[] {
  if (!preview) {
    return [];
  }
  return (preview.targetSummaries ?? [])
    .filter((summary) => String(summary.kind ?? "").toUpperCase() === "VEHICULE")
    .map((summary) => {
      const pta = positiveOrDefined(summary.corporelPrimeNette);
      return {
        label: summary.vehiculeIndex == null ? "Véhicule" : `Véhicule ${summary.vehiculeIndex + 1}`,
        totalNet: summary.automobilePrimeNette ?? subtractMoney(summary.primeNetteHorsEvcat, pta),
        evcat: summary.evcatPrimeNette,
        pta,
        accessoire: pta == null ? undefined : summary.accessoire,
        taxe: addMoney(summary.taxe, summary.taxeParafiscale),
        cnpac: summary.cnpac,
        totalAPayer: summary.primeTotale,
      };
    });
}

function emptyVehicleSummary(): VehicleSummary {
  return { label: "Véhicule" };
}

function positiveOrDefined(value?: number) {
  return value != null && value > 0 ? value : undefined;
}

function addMoney(left?: number, right?: number) {
  if (left == null && right == null) {
    return undefined;
  }
  return roundMoney((left ?? 0) + (right ?? 0));
}

function subtractMoney(left?: number, right?: number) {
  if (left == null) {
    return undefined;
  }
  return roundMoney(left - (right ?? 0));
}
