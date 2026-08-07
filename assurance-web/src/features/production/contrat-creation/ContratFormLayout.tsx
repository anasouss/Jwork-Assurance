import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CircleAlert, Loader2, Save } from "lucide-react";
import { ApiError } from "@/lib/api/base";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ClientSection } from "../components/ClientSection";
import { GarantieSection } from "../components/GarantieSection";
import { ManualQuittanceSection } from "../components/ManualQuittanceSection";
import { QuittancePreviewCard } from "../components/QuittancePreviewCard";
import { RemorqueSection } from "../components/RemorqueSection";
import { SectionCard } from "../components/SectionCard";
import { VehiculeSection } from "../components/VehiculeSection";
import { ProductionFormSkeleton } from "../components/ProductionFormSkeleton";
import { Field } from "../components/Field";
import { ContractInfoSection } from "./ContractInfoSection";
import { FlotteTargetsSection } from "./FlotteTargetsSection";
import { TariffGridSection } from "./TariffGridSection";
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
  const loadError = form.draftQuery.error;
  const submissionError = form.createMutation.error;
  const loadCorrectionConflict = loadError instanceof ApiError
    && loadError.code === "CONTRACT_INITIAL_MOVEMENT_CORRECTION_BLOCKED";
  const correctionConflict = form.correctionBlocked || loadCorrectionConflict
    || (submissionError instanceof ApiError
      && submissionError.code === "CONTRACT_INITIAL_MOVEMENT_CORRECTION_BLOCKED");
  const assistanceCategorieClientId = form.categorieClientId;
  const compagniesAssistance = form.assistanceContext.data?.compagnies ?? [];
  const produitsAssistance = form.assistanceContext.data?.produits ?? [];
  const selectedUsage = form.availableUsages.find((usage) => usage.id === form.usageId);
  const selectedSousClasseCode = form.vehicules[0]?.sousClasse;
  const selectedSousClasse = (form.refs.sousClasses.data ?? []).find(
    (item) => (item.code ?? item.libelle) === selectedSousClasseCode
  );
  const requireDriverDetails = !(
    showConvention
    && selectedUsage?.bySousClasse
    && !selectedSousClasse?.conducteurPermisRequis
  );
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
  const souscripteurGroupeId = form.clients.find((client) => client.role === "SOUSCRIPTEUR")?.groupeClientId ?? "";
  const souscripteurGroupe = useMemo(
    () => (form.groupesClients.data ?? []).find((groupe) => groupe.id === souscripteurGroupeId),
    [form.groupesClients.data, souscripteurGroupeId]
  );

  useEffect(() => {
    if (!workflowSections.includes(activeSection)) {
      setActiveSection(workflowSections[0] ?? "souscripteur");
    }
  }, [activeSection, workflowSections]);

  useEffect(() => {
    if (!souscripteurGroupe || form.groupeFacturationId) {
      return;
    }
    form.setGroupeFacturationId(souscripteurGroupe.id);
    form.setModeFacturation(souscripteurGroupe.facturationConsolideeDefaut ? "CONSOLIDEE_GROUPE" : "DIRECTE");
  }, [form, souscripteurGroupe]);

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

  const advanceAfterSectionSave = (section: ContratSectionKey) => {
    const currentIndex = workflowSections.indexOf(section);
    const nextSection = currentIndex >= 0 ? workflowSections[currentIndex + 1] : undefined;
    if (nextSection) {
      setActiveSection(nextSection);
    }
  };

  const saveSectionAndAdvance = (
    section: "souscripteur" | "proprietaire" | "vehicule" | "garanties"
  ) => {
    form.handleSaveSection(section, () => advanceAfterSectionSave(section));
  };

  const clientSections = (
    <ClientSection
      clients={form.clients}
      setClients={form.setClients}
      villes={form.refs.villes.data ?? []}
      categoriesClient={form.refs.categoriesClient.data ?? []}
      groupesClients={form.groupesClients.data ?? []}
      onSouscripteurGroupChange={(groupe) => {
        form.setGroupeFacturationId(groupe?.id ?? "");
        form.setModeFacturation(groupe?.facturationConsolideeDefaut ? "CONSOLIDEE_GROUPE" : "DIRECTE");
        if (!groupe && form.typePayeurPrime !== "TIERS_MANDATE") {
          form.setTypePayeurPrime("SOUSCRIPTEUR");
          form.setPayeurPrimeClientId("");
        }
      }}
      showOptionalRoles={false}
      showProprietaireCategorie={order === "flotte"}
      requireDriverDetails={requireDriverDetails}
      errors={form.validationErrors}
      onSaveSection={saveSectionAndAdvance}
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
      onSaved={() => advanceAfterSectionSave("contrat")}
    />
  );

  const vehicleSection = (
    <VehiculeSection
      vehicules={form.vehicules}
      setVehicules={form.setVehicules}
      usages={form.availableUsages}
      compagnies={form.refs.compagnies.data ?? []}
      compagnieAssuranceId={form.compagnieAssuranceId}
      marques={form.refs.marques.data ?? []}
      carrosseries={form.refs.carrosseries.data ?? []}
      categoriesTransport={form.refs.categoriesTransport.data ?? []}
      sousClasses={form.refs.sousClasses.data ?? []}
      tarifsUsage={form.refs.tarifsUsage.data ?? []}
      allowMultipleVehicules={allowMultipleVehicules}
      showUsage={form.typeContrat !== "PARTICULIER" && !showConvention}
      showAttestation={form.typeContrat !== "PARTICULIER" && !showConvention}
      controleStockAttestation={form.modeTermeRenouvellement !== "COMPAGNIE"}
      showRemorqueFlag={showConvention || form.typeContrat === "PARTICULIER"}
      errors={form.validationErrors}
      onSaveSection={saveSectionAndAdvance}
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
      showRateColumn={form.typeContrat !== "PARTICULIER"}
      setPrimeColumnEnabled={form.setSaisiePrimeNette}
      preview={form.preview}
      previewing={form.previewMutation.isPending || form.autoPreviewMutation.isPending}
      showTotalsSummary={showConvention}
      assistanceEnabled={form.assistanceEnabled}
      setAssistanceEnabled={form.setAssistanceEnabled}
      showAssistanceRow={showConvention}
      assistanceDraft={form.assistanceDraft}
      setAssistanceDraft={form.setAssistanceDraft}
      compagniesAssistance={compagniesAssistance}
      produitsAssistance={produitsAssistance}
      assistanceUsageId={form.usageId}
      assistanceCategorieClientId={assistanceCategorieClientId}
      onSaveSection={saveSectionAndAdvance}
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
      compagnies={form.refs.compagnies.data ?? []}
      compagnieAssuranceId={form.compagnieAssuranceId}
      marques={form.refs.marques.data ?? []}
      carrosseries={form.refs.carrosseries.data ?? []}
      categoriesTransport={form.refs.categoriesTransport.data ?? []}
      sousClasses={form.refs.sousClasses.data ?? []}
      tarifsUsage={form.refs.tarifsUsage.data ?? []}
      compagniesAssistance={compagniesAssistance}
      produitsAssistance={produitsAssistance}
      grilleSelected={Boolean(form.grilleTarifaireId)}
      preview={form.preview}
      targetPreview={form.targetPreview}
      previewing={form.targetPreviewMutation.isPending}
      saving={form.saveDraftMutation.isPending || form.saveTargetDraftMutation.isPending}
      onPreviewQuittance={form.handlePreviewTarget}
      onSaveDraft={form.handleSaveDraft}
      onSaveTargetDraft={form.handleSaveTargetDraft}
      onValidateTarget={form.validateTarget}
      onVehiculesCompleted={() => advanceAfterSectionSave("flotteTargets")}
      onRemorquesCompleted={() => advanceAfterSectionSave("remorque")}
      targetAssistances={form.targetAssistances}
      setTargetAssistances={form.setTargetAssistances}
      setAssistanceEnabled={form.setAssistanceEnabled}
      assistanceCategorieClientId={assistanceCategorieClientId}
      crmPartage={form.crmPartage}
      crmPartageValeur={form.crmPartageValeur}
      prospectionMode={form.prospectionMode}
      controleStockAttestation={form.modeTermeRenouvellement !== "COMPAGNIE"}
      lockContractDates={form.renewalMode}
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
      usages={form.availableUsages}
      compagnies={form.refs.compagnies.data ?? []}
      compagnieAssuranceId={form.compagnieAssuranceId}
      marques={form.refs.marques.data ?? []}
      maxRemorques={maxRemorques}
      controleStockAttestation={form.modeTermeRenouvellement !== "COMPAGNIE"}
      lockContractDates={form.renewalMode}
      openSection={activeSection}
      onSectionOpenChange={handleSectionOpenChange}
    />
  );

  if (form.initialLoading) {
    return (
      <div className="mx-auto w-full max-w-[1440px]">
        <ProductionFormSkeleton variant="contract" />
      </div>
    );
  }

  if (form.draftQuery.isError) {
    return (
      <div className="mx-auto grid w-full max-w-[1440px] gap-4">
        <div>
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Production</div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Modification du contrat</h1>
          <p className="text-sm text-muted-foreground">Le contrat ne peut pas être ouvert en modification.</p>
        </div>

        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>
            {loadCorrectionConflict ? "Modification directe impossible" : "Chargement impossible"}
          </AlertTitle>
          <AlertDescription>
            <p>
              {loadError instanceof Error
                ? loadError.message
                : "Une erreur est survenue pendant le chargement du contrat."}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to="/app/production/contrats">Retour à la liste des contrats</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Production</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {form.renewalMode ? "Modifier le pré-terme" : form.prospectionMode ? "Ajouter devis" : "Ajouter dossier"}
            </h1>
            {form.renewalMode ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                Brouillon de renouvellement
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {correctionConflict ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Modification directe impossible</AlertTitle>
          <AlertDescription>
            <p>
              Ce contrat contient déjà des avenants ou mouvements validés. L'affaire nouvelle ne peut plus être modifiée directement.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to="/app/production/contrats">Retour à la liste des contrats</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : form.createMutation.isError ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Enregistrement impossible</AlertTitle>
          <AlertDescription>
            {submissionError instanceof Error ? submissionError.message : "Une erreur est survenue pendant l'enregistrement."}
          </AlertDescription>
        </Alert>
      ) : null}

      {clientSections}
      {contractSection}
      {order === "flotte" ? (
        <>
          <TariffGridSection
            form={form}
            openSection={activeSection}
            onSectionOpenChange={handleSectionOpenChange}
          />
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
      <ManualQuittanceSection
        lignes={form.quittances}
        setLignes={form.setQuittances}
        assistances={form.preview?.assistances}
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

      {showConvention && form.modeReglement === "facture" ? (
        <SectionCard title="Bulletin" badge="Obligatoire" tone="production" defaultOpen>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Montant du bulletin" required error={form.validationErrors.montantBulletin}>
              <Input
                inputMode="decimal"
                value={form.montantBulletin}
                onChange={(event) => form.setMontantBulletin(event.target.value)}
              />
            </Field>
          </div>
        </SectionCard>
      ) : null}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={form.handleCreate} disabled={form.createMutation.isPending || correctionConflict}>
          {form.createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {form.createMutation.isPending
            ? form.correctionMode ? "Enregistrement..." : form.renewalMode ? "Enregistrement..." : "Création..."
            : form.correctionMode ? "Enregistrer" : form.renewalMode ? "Enregistrer le pré-terme" : form.prospectionMode ? "Créer devis" : "Créer contrat"}
        </Button>
      </div>

    </div>
  );
}
