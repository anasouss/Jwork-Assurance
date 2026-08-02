import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Check, ChevronDown, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SectionCard } from "../components/SectionCard";
import { emptyVehicule } from "../components/VehiculeSection";
import { assistanceProductApi } from "../api/assistance-products";
import { resolveAssistanceTariffAmount } from "../assistance-pricing";
import { moneyAmount } from "../utils/format";
import type { AssistanceDraft, GarantieInput, QuittancePreview, ReferenceOption, RemorqueInput, VehiculeInput } from "../types";
import type { ContratSectionKey } from "./useContratCreationForm";
import { RemorqueForm, VehicleForm } from "./ContractTargetForms";
import { TargetGuaranteesTable } from "./TargetGuaranteesTable";
import { contractTargetKey as targetKey, guaranteeCalculationKey } from "./contract-target-key";
import { sameGuaranteeTarget as sameTarget, targetedGuaranteeInput } from "./guarantee-selection";
import {
  previewForTarget,
  remapAssistancesAfterVehicleRemoval,
  targetQuittanceSummary,
} from "./target-calculation";

export type ContractTarget = {
  kind: "vehicule" | "remorque";
  index: number;
  label: string;
  usageId?: string;
  categorieTransportId?: string;
  valeurVenale?: number;
  valeurNeuf?: number;
  valeurGlace?: number;
  valeurAssuree?: number;
};

type Target = ContractTarget;

export type ContractPricingMode = "MANUELLE" | "MANUELLE_AVEC_PRIME_NETTE" | "AUTOMATIQUE_GRILLE";

type PricingMode = ContractPricingMode;

export type ContractTargetsSectionProps = {
  vehicules: VehiculeInput[];
  setVehicules: Dispatch<SetStateAction<VehiculeInput[]>>;
  remorques: RemorqueInput[];
  setRemorques: Dispatch<SetStateAction<RemorqueInput[]>>;
  garanties: ReferenceOption[];
  selectedGaranties: GarantieInput[];
  setSelectedGaranties: Dispatch<SetStateAction<GarantieInput[]>>;
  lockedGaranties?: GarantieInput[];
  lignes: ReferenceOption[];
  formulesPersonne: ReferenceOption[];
  usages: ReferenceOption[];
  compagnies?: ReferenceOption[];
  compagnieAssuranceId?: string | null;
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  sousClasses: ReferenceOption[];
  compagniesAssistance: ReferenceOption[];
  produitsAssistance: ReferenceOption[];
  grilleSelected: boolean;
  pricingMode?: ContractPricingMode | string | null;
  preview?: QuittancePreview | null;
  targetPreview?: QuittancePreview | null;
  previewing?: boolean;
  saving?: boolean;
  onPreviewQuittance?: (target: ContractTarget, selectedGaranties?: GarantieInput[]) => void;
  onSaveDraft?: (label: string, onSuccess?: () => void) => void;
  onSaveTargetDraft?: (target: ContractTarget, part: "info" | "garanties", label: string, onSuccess?: () => void) => boolean;
  onValidateTarget?: (target: ContractTarget, part?: "info" | "garanties") => boolean;
  onVehiculesCompleted?: () => void;
  onRemorquesCompleted?: () => void;
  garantiesExtraAction?: ReactNode;
  targetActionMode?: "save" | "calculate";
  previewAfterInfoSave?: boolean;
  targetAssistances?: Record<string, AssistanceDraft>;
  setTargetAssistances?: Dispatch<SetStateAction<Record<string, AssistanceDraft>>>;
  setAssistanceEnabled?: Dispatch<SetStateAction<boolean>>;
  showAssistance?: boolean;
  showInfoSections?: boolean;
  allowTargetChanges?: boolean;
  assistanceCategorieClientId?: string;
  crmPartage?: boolean;
  crmPartageValeur?: string;
  showVehicleCrm?: boolean;
  prospectionMode?: boolean;
  controleStockAttestation?: boolean;
  lockContractDates?: boolean;
  maxRemorques?: number | null;
  errors?: Record<string, string>;
  openSection?: ContratSectionKey;
  onSectionOpenChange?: (section: ContratSectionKey, open: boolean) => void;
  singleVehicleLayout?: boolean;
  singleRemorqueLayout?: boolean;
  showVehicleSection?: boolean;
  showRemorqueSection?: boolean;
  vehicleSectionTitle?: string;
  remorqueSectionTitle?: string;
  guaranteeLayout?: "tariff" | "particulier";
  primeColumnLabel?: string;
};

export function ContractTargetsSection({
  vehicules,
  setVehicules,
  remorques,
  setRemorques,
  garanties,
  selectedGaranties,
  setSelectedGaranties,
  lockedGaranties = [],
  lignes,
  formulesPersonne,
  usages,
  compagnies = [],
  compagnieAssuranceId,
  marques,
  carrosseries,
  categoriesTransport,
  sousClasses,
  compagniesAssistance,
  produitsAssistance,
  grilleSelected,
  pricingMode = "AUTOMATIQUE_GRILLE",
  preview,
  targetPreview,
  previewing = false,
  saving = false,
  onPreviewQuittance,
  onSaveDraft,
  onSaveTargetDraft,
  onValidateTarget,
  onVehiculesCompleted,
  onRemorquesCompleted,
  garantiesExtraAction,
  targetActionMode = "save",
  previewAfterInfoSave = true,
  targetAssistances,
  setTargetAssistances,
  setAssistanceEnabled,
  showAssistance = true,
  showInfoSections = true,
  allowTargetChanges = true,
  assistanceCategorieClientId,
  crmPartage = false,
  crmPartageValeur = "",
  showVehicleCrm = true,
  prospectionMode = false,
  controleStockAttestation = true,
  lockContractDates = false,
  maxRemorques,
  errors = {},
  openSection,
  onSectionOpenChange,
  singleVehicleLayout = false,
  singleRemorqueLayout = false,
  showVehicleSection = true,
  showRemorqueSection = true,
  vehicleSectionTitle = "Véhicules",
  remorqueSectionTitle = "Remorques",
  guaranteeLayout = "tariff",
  primeColumnLabel = "Prime nette",
}: ContractTargetsSectionProps) {
  const targets = useMemo<Target[]>(
    () => [
      ...vehicules.map((vehicule, index) => ({
        kind: "vehicule" as const,
        index,
        label: vehicleTargetLabel(vehicule, index),
        usageId: vehicule.usageId,
        categorieTransportId: vehicule.categorieTransportId,
        valeurVenale: vehicule.valeurVenale,
        valeurNeuf: vehicule.valeurNeuf,
        valeurGlace: vehicule.valeurGlace,
      })),
      ...remorques.map((remorque, index) => ({
        kind: "remorque" as const,
        index,
        label: remorqueTargetLabel(remorque, index),
        usageId: remorque.usageId,
        valeurAssuree: remorque.valeurAssuree,
      })),
    ],
    [remorques, vehicules]
  );
  const [activeKey, setActiveKey] = useState(targetKey(targets[0]));
  const [activeTargetPart, setActiveTargetPart] = useState<"info" | "garanties">("info");
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [dirtyCalculationKeys, setDirtyCalculationKeys] = useState<string[]>([]);
  const [localAssistances, setLocalAssistances] = useState<Record<string, AssistanceDraft>>({});
  const assistances = targetAssistances ?? localAssistances;
  const setAssistances = setTargetAssistances ?? setLocalAssistances;
  const calculationTargetKeyRef = useRef("");
  const wasPreviewingRef = useRef(false);
  const vehiculeGaranties = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "VEHICULE") !== "PERSONNE"),
    [garanties]
  );
  const personneGaranties = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "") === "PERSONNE"),
    [garanties]
  );
  const canAddRemorque = maxRemorques == null || remorques.length < maxRemorques;
  const normalizedPricingMode = normalizePricingMode(pricingMode);
  const vehiculeTargets = targets.filter((target) => target.kind === "vehicule");
  const remorqueTargets = targets.filter((target) => target.kind === "remorque");
  const activeVehiculeTarget =
    vehiculeTargets.find((target) => targetKey(target) === activeKey) ?? vehiculeTargets[0];
  const activeRemorqueTarget =
    remorqueTargets.find((target) => targetKey(target) === activeKey) ?? remorqueTargets[0];
  const activeVehiculePreview = previewForTarget(preview, targetPreview, activeVehiculeTarget);
  const activeRemorquePreview = previewForTarget(preview, targetPreview, activeRemorqueTarget);
  const activeVehiculeAssistance = activeVehiculeTarget ? assistances[targetKey(activeVehiculeTarget)] : undefined;
  const activeRemorqueAssistance = activeRemorqueTarget ? assistances[targetKey(activeRemorqueTarget)] : undefined;
  const activeVehiculeAssistanceProductId = activeVehiculeAssistance?.enabled ? activeVehiculeAssistance.produitAssistanceId ?? "" : "";
  const activeRemorqueAssistanceProductId = activeRemorqueAssistance?.enabled ? activeRemorqueAssistance.produitAssistanceId ?? "" : "";
  const activeVehiculeAssistanceTarifs = useQuery({
    queryKey: ["referentiel", "produits-assistance", activeVehiculeAssistanceProductId, "tarifs"],
    queryFn: () => assistanceProductApi.listProductRates(activeVehiculeAssistanceProductId),
    enabled: Boolean(activeVehiculeAssistanceProductId),
    staleTime: 60_000,
  });
  const activeRemorqueAssistanceTarifs = useQuery({
    queryKey: ["referentiel", "produits-assistance", activeRemorqueAssistanceProductId, "tarifs"],
    queryFn: () => assistanceProductApi.listProductRates(activeRemorqueAssistanceProductId),
    enabled: Boolean(activeRemorqueAssistanceProductId),
    staleTime: 60_000,
  });
  const activeVehiculeAssistanceNet = targetAssistanceNet(activeVehiculeAssistance, produitsAssistance, activeVehiculeAssistanceTarifs.data);
  const activeRemorqueAssistanceNet = targetAssistanceNet(activeRemorqueAssistance, produitsAssistance, activeRemorqueAssistanceTarifs.data);
  const targetActionText = targetActionMode === "calculate"
    ? {
        info: "Enregistrer informations",
        garanties: "Calculer garanties",
        loading: "Enregistrement...",
      }
    : {
        info: "Enregistrer informations",
        garanties: "Enregistrer garanties",
        loading: "Enregistrement...",
      };

  useEffect(() => {
    if (wasPreviewingRef.current && !previewing) {
      const targetPrefix = calculationTargetKeyRef.current ? `${calculationTargetKeyRef.current}:` : "";
      setDirtyCalculationKeys((current) => targetPrefix ? current.filter((key) => !key.startsWith(targetPrefix)) : []);
      calculationTargetKeyRef.current = "";
    }
    wasPreviewingRef.current = previewing;
  }, [previewing]);

  const requestTargetCalculation = (target: Target, garantieId?: string, nextSelectedGaranties?: GarantieInput[]) => {
    const key = targetKey(target);
    calculationTargetKeyRef.current = key;
    if (garantieId) {
      const dirtyKey = guaranteeCalculationKey(target, garantieId);
      setDirtyCalculationKeys((current) => (current.includes(dirtyKey) ? current : [...current, dirtyKey]));
    }
    onPreviewQuittance?.(target, nextSelectedGaranties);
  };

  const updateAssistance = (target: Target, patch: Partial<AssistanceDraft>) => {
    setAssistances((current) => {
      const key = targetKey(target);
      const draft = current[key] ?? { enabled: false };
      const nextForTarget = { ...draft, ...patch, modified: true };
      const next = { ...current, [key]: nextForTarget };
      setAssistanceEnabled?.(Object.values(next).some((item) => item.enabled));
      return next;
    });
  };

  useEffect(() => {
    if (!targets.some((target) => targetKey(target) === activeKey)) {
      setActiveKey(targetKey(targets[0]));
    }
  }, [activeKey, targets]);

  useEffect(() => {
    setActiveTargetPart("info");
  }, [activeKey]);

  useEffect(() => {
    if (!showInfoSections) {
      setActiveTargetPart("garanties");
    }
  }, [showInfoSections]);

  useEffect(() => {
    const rcGaranties = vehiculeGaranties.filter((garantie) => Boolean(garantie.responsabiliteCivile));
    if (rcGaranties.length === 0 || targets.length === 0) {
      return;
    }
    setSelectedGaranties((current) => {
      const additions: GarantieInput[] = [];
      for (const target of targets) {
        for (const garantie of rcGaranties) {
          if (!current.some((item) => item.garantieId === garantie.id && sameTarget(item, target))) {
            additions.push(targetedGuaranteeInput(garantie, target, "AUCUNE"));
          }
        }
      }
      return additions.length === 0 ? current : [...current, ...additions];
    });
  }, [setSelectedGaranties, targets, vehiculeGaranties]);

  const addVehicle = () => {
    setVehicules((current) => {
      const next = [...current, emptyVehicule()];
      setActiveKey(`vehicule:${next.length - 1}`);
      return next;
    });
  };

  const addRemorque = () => {
    setRemorques((current) => {
      const next = [...current, {}];
      setActiveKey(`remorque:${next.length - 1}`);
      return next;
    });
  };

  const removeTarget = (target?: Target) => {
    if (!target) {
      return;
    }
    if (target.kind === "vehicule" && vehicules.length > 1) {
      setVehicules((current) => current.filter((_, index) => index !== target.index));
      setSelectedGaranties((current) =>
        current
          .filter((item) => item.vehiculeIndex !== target.index)
          .map((item) =>
            item.vehiculeIndex !== undefined && item.vehiculeIndex > target.index
              ? { ...item, vehiculeIndex: item.vehiculeIndex - 1 }
              : item
          )
      );
      setAssistances((current) => {
        const next = remapAssistancesAfterVehicleRemoval(current, target.index);
        setAssistanceEnabled?.(Object.values(next).some((item) => item.enabled));
        return next;
      });
    }
    if (target.kind === "remorque") {
      setRemorques((current) => current.filter((_, index) => index !== target.index));
      setSelectedGaranties((current) =>
        current
          .filter((item) => item.remorqueIndex !== target.index)
          .map((item) =>
            item.remorqueIndex !== undefined && item.remorqueIndex > target.index
              ? { ...item, remorqueIndex: item.remorqueIndex - 1 }
              : item
          )
      );
    }
  };

  const saveTargetSection = (target: Target, part: "info" | "garanties", label: string, onSaved?: () => void) => {
    if (onValidateTarget && !onValidateTarget(target, part)) {
      return false;
    }
    const key = `${targetKey(target)}:${part}`;
    const markSaved = () => {
      setSavedKeys((current) => (current.includes(key) ? current : [...current, key]));
      onSaved?.();
    };
    if (onSaveTargetDraft) {
      return onSaveTargetDraft(target, part, label, markSaved);
    }
    if (onSaveDraft) {
      onSaveDraft(label, markSaved);
      return true;
    }
    markSaved();
    toast.success(`${label} enregistré`);
    return true;
  };

  const advanceAfterVehiculeGaranties = (target: Target) => {
    const currentIndex = vehiculeTargets.findIndex((candidate) => targetKey(candidate) === targetKey(target));
    const nextTarget = currentIndex >= 0 ? vehiculeTargets[currentIndex + 1] : undefined;
    if (nextTarget) {
      setActiveKey(targetKey(nextTarget));
      setActiveTargetPart("info");
      return;
    }
    onVehiculesCompleted?.();
  };

  const advanceAfterRemorqueGaranties = (target: Target) => {
    const currentIndex = remorqueTargets.findIndex((candidate) => targetKey(candidate) === targetKey(target));
    const nextTarget = currentIndex >= 0 ? remorqueTargets[currentIndex + 1] : undefined;
    if (nextTarget) {
      setActiveKey(targetKey(nextTarget));
      return;
    }
    onRemorquesCompleted?.();
  };

  return (
    <>
      {showVehicleSection ? (
        <SectionCard
          title={vehicleSectionTitle}
          badge={`${vehicules.length} véhicule${vehicules.length > 1 ? "s" : ""}`}
          tone="production"
          open={openSection === undefined ? undefined : openSection === "flotteTargets"}
          onOpenChange={(open) => onSectionOpenChange?.("flotteTargets", open)}
        >
          <div className={cn("grid gap-4", !singleVehicleLayout && "lg:grid-cols-[230px_1fr]")}>
            {!singleVehicleLayout ? (
              <div className="grid content-start gap-3">
                <div className="grid gap-2">
                  {vehiculeTargets.map((target) => {
                    const key = targetKey(target);
                    const active = key === targetKey(activeVehiculeTarget);
                    const saved = targetSaved(target, savedKeys, selectedGaranties, vehicules, remorques);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={cn(
                          "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          active ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "hover:bg-muted/60"
                        )}
                        onClick={() => setActiveKey(targetKey(target))}
                      >
                        <span className="font-medium">{target.label}</span>
                        <TargetStatusBadge saved={saved} count={selectedGaranties.filter((item) => sameTarget(item, target)).length} />
                      </button>
                    );
                  })}
                </div>
                {allowTargetChanges ? (
                  <div className="grid gap-2 border-t pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={addVehicle}>
                      <Plus className="size-4" />
                      Véhicule
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!activeVehiculeTarget || vehicules.length === 1}
                      onClick={() => removeTarget(activeVehiculeTarget)}
                    >
                      <Trash2 className="size-4" />
                      Retirer
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeVehiculeTarget ? (
              <div className="grid gap-4">
              {showInfoSections ? (
                <TargetSubsection
                  title="Informations véhicule"
                  open={activeTargetPart === "info"}
                  onOpenChange={() => setActiveTargetPart("info")}
                >
                  <VehicleForm
                    index={activeVehiculeTarget.index}
                    vehicule={vehicules[activeVehiculeTarget.index]}
                    setVehicules={setVehicules}
                    usages={usages}
                    compagnies={compagnies}
                    compagnieAssuranceId={compagnieAssuranceId}
                    marques={marques}
                    carrosseries={carrosseries}
                    categoriesTransport={categoriesTransport}
                    sousClasses={sousClasses}
                    crmPartage={crmPartage}
                    crmPartageValeur={crmPartageValeur}
                    showCrm={showVehicleCrm}
                    prospectionMode={prospectionMode}
                    controleStockAttestation={controleStockAttestation}
                    errors={errors}
                  />
                  <SectionSubmitButton
                    icon="save"
                    saving={saving}
                    loadingText={targetActionText.loading}
                    onClick={() => saveTargetSection(activeVehiculeTarget, "info", "Informations véhicule", () => {
                      setActiveTargetPart("garanties");
                      if (previewAfterInfoSave) {
                        onPreviewQuittance?.(activeVehiculeTarget);
                      }
                    })}
                  >
                    {targetActionText.info}
                  </SectionSubmitButton>
                </TargetSubsection>
              ) : null}
              <TargetSubsection
                title="Garanties"
                badge={`${selectedGaranties.filter((item) => sameTarget(item, activeVehiculeTarget)).length} garantie${selectedGaranties.filter((item) => sameTarget(item, activeVehiculeTarget)).length > 1 ? "s" : ""}`}
                open={!showInfoSections || activeTargetPart === "garanties"}
                onOpenChange={() => setActiveTargetPart("garanties")}
                headerAction={garantiesExtraAction}
                action={
                  <Button
                    type="button"
                    disabled={previewing || saving}
                    onClick={() => {
                      saveTargetSection(
                        activeVehiculeTarget,
                        "garanties",
                        "Garanties véhicule",
                        () => advanceAfterVehiculeGaranties(activeVehiculeTarget)
                      );
                    }}
                  >
                    {previewing || saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {saving ? "Enregistrement..." : previewing ? "Calcul..." : targetActionText.garanties}
                  </Button>
                }
              >
                <TargetGuaranteesTable
                  target={activeVehiculeTarget}
                  garanties={vehiculeGaranties}
                  personneGaranties={personneGaranties}
                  selected={selectedGaranties}
                  setSelected={setSelectedGaranties}
                  locked={lockedGaranties}
                  lignes={lignes}
                  formulesPersonne={formulesPersonne}
                  usages={usages}
                  compagniesAssistance={compagniesAssistance}
                  produitsAssistance={produitsAssistance}
                  assistance={assistances[targetKey(activeVehiculeTarget)] ?? { enabled: false }}
                  onAssistanceChange={(patch) => updateAssistance(activeVehiculeTarget, patch)}
                  assistanceCategorieClientId={assistanceCategorieClientId}
                  showAssistance={showAssistance}
                  grilleSelected={grilleSelected}
                  pricingMode={normalizedPricingMode}
                  preview={activeVehiculePreview}
                  previewing={previewing}
                  dirtyCalculationKeys={dirtyCalculationKeys}
                  onRequestCalculation={requestTargetCalculation}
                  layout={guaranteeLayout}
                  primeColumnLabel={primeColumnLabel}
                />
                <QuittanceTotalsSummary
                  preview={activeVehiculePreview}
                  target={activeVehiculeTarget}
                  loading={previewing}
                  showPersonneTotals={hasTargetPersonneGaranties(selectedGaranties, personneGaranties, activeVehiculeTarget)}
                  showAssistanceTotal={showAssistance && Boolean(assistances[targetKey(activeVehiculeTarget)]?.enabled)}
                  assistanceNet={activeVehiculeAssistanceNet}
                />
              </TargetSubsection>
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {showRemorqueSection ? (
        <SectionCard
          title={remorqueSectionTitle}
          badge={`${remorques.length} remorque${remorques.length > 1 ? "s" : ""}`}
          tone="production"
          defaultOpen={false}
          open={openSection === undefined ? undefined : openSection === "remorque"}
          onOpenChange={(open) => onSectionOpenChange?.("remorque", open)}
        >
          <div className={cn("grid gap-4", !singleRemorqueLayout && "lg:grid-cols-[230px_1fr]")}>
            {!singleRemorqueLayout ? (
              <div className="grid content-start gap-3">
            {remorqueTargets.length > 0 ? (
              <div className="grid gap-2">
                {remorqueTargets.map((target) => {
                  const key = targetKey(target);
                  const active = key === targetKey(activeRemorqueTarget);
                  const saved = targetSaved(target, savedKeys, selectedGaranties, vehicules, remorques);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        active ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "hover:bg-muted/60"
                      )}
                      onClick={() => setActiveKey(targetKey(target))}
                    >
                      <span className="font-medium">{target.label}</span>
                      <TargetStatusBadge saved={saved} count={selectedGaranties.filter((item) => sameTarget(item, target)).length} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Aucune remorque ajoutée.
              </div>
            )}
            {allowTargetChanges ? (
              <div className="grid gap-2 border-t pt-3">
                <Button type="button" variant="outline" size="sm" disabled={!canAddRemorque} onClick={addRemorque}>
                  <Plus className="size-4" />
                  Remorque
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!activeRemorqueTarget}
                  onClick={() => removeTarget(activeRemorqueTarget)}
                >
                  <Trash2 className="size-4" />
                  Retirer
                </Button>
              </div>
            ) : null}
              </div>
            ) : null}

            {activeRemorqueTarget ? (
              <div className="grid gap-4">
              {showInfoSections ? (
                <TargetSubsection title="Informations remorque">
                  <RemorqueForm
                    index={activeRemorqueTarget.index}
                    remorque={remorques[activeRemorqueTarget.index]}
                    setRemorques={setRemorques}
                    usages={usages}
                    compagnies={compagnies}
                    compagnieAssuranceId={compagnieAssuranceId}
                    marques={marques}
                    prospectionMode={prospectionMode}
                    controleStockAttestation={controleStockAttestation}
                    lockContractDates={lockContractDates}
                  />
                  <SectionSubmitButton
                    icon="save"
                    saving={saving}
                    loadingText={targetActionText.loading}
                    onClick={() => saveTargetSection(activeRemorqueTarget, "info", "Informations remorque", () => {
                      if (previewAfterInfoSave) {
                        onPreviewQuittance?.(activeRemorqueTarget);
                      }
                    })}
                  >
                    {targetActionText.info}
                  </SectionSubmitButton>
                </TargetSubsection>
              ) : null}
              <TargetSubsection
                title="Garanties"
                badge={`${selectedGaranties.filter((item) => sameTarget(item, activeRemorqueTarget)).length} garantie${selectedGaranties.filter((item) => sameTarget(item, activeRemorqueTarget)).length > 1 ? "s" : ""}`}
                headerAction={garantiesExtraAction}
                action={
                  <Button
                    type="button"
                    disabled={previewing || saving}
                    onClick={() => {
                      saveTargetSection(
                        activeRemorqueTarget,
                        "garanties",
                        "Garanties remorque",
                        () => advanceAfterRemorqueGaranties(activeRemorqueTarget)
                      );
                    }}
                  >
                    {previewing || saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {saving ? "Enregistrement..." : previewing ? "Calcul..." : targetActionText.garanties}
                  </Button>
                }
              >
                <TargetGuaranteesTable
                  target={activeRemorqueTarget}
                  garanties={vehiculeGaranties}
                  personneGaranties={personneGaranties}
                  selected={selectedGaranties}
                  setSelected={setSelectedGaranties}
                  locked={lockedGaranties}
                  lignes={lignes}
                  formulesPersonne={formulesPersonne}
                  usages={usages}
                  compagniesAssistance={compagniesAssistance}
                  produitsAssistance={produitsAssistance}
                  assistance={assistances[targetKey(activeRemorqueTarget)] ?? { enabled: false }}
                  onAssistanceChange={(patch) => updateAssistance(activeRemorqueTarget, patch)}
                  assistanceCategorieClientId={assistanceCategorieClientId}
                  showAssistance={showAssistance}
                  grilleSelected={grilleSelected}
                  pricingMode={normalizedPricingMode}
                  preview={activeRemorquePreview}
                  previewing={previewing}
                  dirtyCalculationKeys={dirtyCalculationKeys}
                  onRequestCalculation={requestTargetCalculation}
                  layout={guaranteeLayout}
                  primeColumnLabel={primeColumnLabel}
                />
                <QuittanceTotalsSummary
                  preview={activeRemorquePreview}
                  target={activeRemorqueTarget}
                  loading={previewing}
                  showPersonneTotals={hasTargetPersonneGaranties(selectedGaranties, personneGaranties, activeRemorqueTarget)}
                  showAssistanceTotal={showAssistance && Boolean(assistances[targetKey(activeRemorqueTarget)]?.enabled)}
                  assistanceNet={activeRemorqueAssistanceNet}
                />
              </TargetSubsection>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                Ajoutez une remorque pour renseigner ses informations.
              </div>
            )}
          </div>
        </SectionCard>
      ) : null}
    </>
  );
}

function SectionSubmitButton({
  children,
  disabled,
  icon = "save",
  saving,
  loadingText = "Enregistrement...",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  icon?: "save" | "calculate";
  saving?: boolean;
  loadingText?: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-5 flex justify-end border-t pt-4">
      <Button type="button" disabled={disabled || saving} onClick={onClick}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : icon === "calculate" ? <Calculator className="size-4" /> : <Save className="size-4" />}
        {saving ? loadingText : children}
      </Button>
    </div>
  );
}

function TargetSubsection({
  title,
  badge,
  headerAction,
  action,
  children,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
}: {
  title: string;
  badge?: string;
  headerAction?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between gap-3 bg-emerald-50 px-4 py-3 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:text-emerald-700 dark:hover:text-emerald-100">
            <ChevronDown className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} />
            <span className="truncate text-sm font-semibold">{title}</span>
            {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          </button>
        </CollapsibleTrigger>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <CollapsibleContent>
        <div className="border-t p-4">
          {children}
          {action ? <div className="mt-4 flex justify-end border-t pt-3">{action}</div> : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function QuittanceTotalsSummary({
  preview,
  target,
  loading,
  showPersonneTotals,
  showAssistanceTotal,
  assistanceNet,
}: {
  preview?: QuittancePreview | null;
  target: Target;
  loading?: boolean;
  showPersonneTotals?: boolean;
  showAssistanceTotal?: boolean;
  assistanceNet?: number;
}) {
  const scoped = targetQuittanceSummary(preview, target);
  const rows: [string, number | undefined][] = [
    ["TOTAL NET", scoped.totalNet],
    ["EVCAT", scoped.evcat],
    ["TAXES", scoped.taxe],
    ["CNPAC", scoped.cnpac],
    ["TOTAL", scoped.totalAPayer],
  ];
  if (showPersonneTotals) {
    rows.splice(2, 0, ["PTA (Prime Personne)", scoped.pta], ["ACCESSOIRE", scoped.accessoire]);
  }
  if (showAssistanceTotal) {
    rows.push(["ASSISTANCE", assistanceNet]);
  }

  return (
    <div className="mt-4 ml-auto w-full max-w-sm overflow-hidden rounded-md border">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[1fr_120px] border-b last:border-b-0">
          <div className="bg-muted/30 px-3 py-2 text-right text-xs font-semibold">{label}</div>
          <div className="px-3 py-2 text-right text-xs">
            {loading ? <CalculationValue loading value={value} fallback="-" /> : value == null ? "-" : moneyAmount(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function TargetStatusBadge({ saved, count }: { saved: boolean; count: number }) {
  if (saved) {
    return (
      <span
        title="Validé"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm"
      >
        <Check className="size-4" />
      </span>
    );
  }
  return <Badge variant="secondary">{count}</Badge>;
}

function CalculationValue({ value, loading, fallback = "-" }: { value?: number; loading?: boolean; fallback?: string }) {
  if (loading) {
    return (
      <span className="inline-flex items-center justify-end gap-1 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span>Calcul...</span>
      </span>
    );
  }
  return value == null ? fallback : moneyAmount(value);
}

function targetAssistanceNet(assistance: AssistanceDraft | undefined, produitsAssistance: ReferenceOption[], tarifs?: ReferenceOption[]) {
  if (!assistance?.enabled || !assistance.produitAssistanceId) {
    return undefined;
  }
  const product = produitsAssistance.find((item) => item.id === assistance.produitAssistanceId);
  return resolveAssistanceTariffAmount(product, tarifs, assistance.dateSouscription, "montantTtc");
}

function hasTargetPersonneGaranties(selected: GarantieInput[], personneGaranties: ReferenceOption[], target?: Target) {
  if (!target || personneGaranties.length === 0) {
    return false;
  }
  const personneIds = new Set(personneGaranties.map((garantie) => garantie.id));
  return selected.some((item) => sameTarget(item, target) && personneIds.has(item.garantieId));
}

function targetSaved(
  target: Target,
  savedKeys: string[],
  selected: GarantieInput[],
  vehicules: VehiculeInput[],
  remorques: RemorqueInput[]
) {
  const key = targetKey(target);
  if (savedKeys.includes(`${key}:info`) && savedKeys.includes(`${key}:garanties`)) {
    return true;
  }
  const persistedInfo = target.kind === "vehicule"
    ? Boolean(vehicules[target.index]?.vehiculeId)
    : Boolean(remorques[target.index]?.remorqueId);
  if (!persistedInfo) {
    return false;
  }
  const targetGaranties = selected.filter((item) => sameTarget(item, target));
  return targetGaranties.length > 0 && targetGaranties.every((item) => item.prime != null);
}

function vehicleTargetLabel(vehicule: VehiculeInput, index: number) {
  return normalizeTargetLabel(vehicule.immatriculation) ?? `Véhicule ${index + 1}`;
}

function remorqueTargetLabel(remorque: RemorqueInput, index: number) {
  return normalizeTargetLabel(remorque.immatriculation) ?? `Remorque ${index + 1}`;
}

function normalizeTargetLabel(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizePricingMode(value?: string | null): PricingMode {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "MANUELLE" || normalized === "MANUELLE_AVEC_PRIME_NETTE" || normalized === "AUTOMATIQUE_GRILLE") {
    return normalized;
  }
  return "AUTOMATIQUE_GRILLE";
}
