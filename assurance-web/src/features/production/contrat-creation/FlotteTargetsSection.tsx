import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ChevronDown, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DatePicker } from "@/components/ui/date-picker";
import { EcheanceInput } from "@/components/ui/echeance-input";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Field } from "../components/Field";
import { MoneyInput } from "../components/MoneyInput";
import { SectionCard } from "../components/SectionCard";
import { emptyVehicule } from "../components/VehiculeSection";
import { productionApi } from "../api";
import { computeDateEcheanceFromCode, toDateOnly } from "../date";
import { formatMoney, money, moneyAmount, numberOrZero, numberValue, roundMoney, toNumber } from "../utils/format";
import { validateValeurVenale } from "../utils/vehicle-validation";
import type { GarantieInput, QuittancePreview, ReferenceOption, RemorqueInput, VehiculeInput, VehiculeResponse } from "../types";
import type { ContratSectionKey } from "./useContratCreationForm";

type Target = {
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

type AssistanceDraft = {
  enabled: boolean;
  compagnieAssistanceId?: string;
  produitAssistanceId?: string;
  dateEffet?: string;
  dateSouscription?: string;
  echeanceCode?: string;
  dateEcheance?: string;
  numeroContratOuQuittance?: string;
};

type TargetQuittanceSummary = {
  totalNet?: number;
  evcat?: number;
  pta?: number;
  accessoire?: number;
  taxe?: number;
  cnpac?: number;
  totalAPayer?: number;
};

type LookupStatus = "idle" | "loading" | "found" | "new" | "error";
type LookupState = {
  status: LookupStatus;
  message?: string;
};

type Props = {
  vehicules: VehiculeInput[];
  setVehicules: Dispatch<SetStateAction<VehiculeInput[]>>;
  remorques: RemorqueInput[];
  setRemorques: Dispatch<SetStateAction<RemorqueInput[]>>;
  garanties: ReferenceOption[];
  selectedGaranties: GarantieInput[];
  setSelectedGaranties: Dispatch<SetStateAction<GarantieInput[]>>;
  lignes: ReferenceOption[];
  formulesPersonne: ReferenceOption[];
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  compagniesAssistance: ReferenceOption[];
  produitsAssistance: ReferenceOption[];
  grilleSelected: boolean;
  preview?: QuittancePreview | null;
  previewing?: boolean;
  saving?: boolean;
  onPreviewQuittance?: (target: Target) => void;
  onSaveDraft?: (label: string, onSuccess?: () => void) => void;
  onSaveTargetDraft?: (target: Target, part: "info" | "garanties", label: string, onSuccess?: () => void) => boolean;
  onValidateTarget?: (target: Target, part?: "info" | "garanties") => boolean;
  setAssistanceEnabled?: Dispatch<SetStateAction<boolean>>;
  assistanceCategorieClientId?: string;
  crmPartage?: boolean;
  crmPartageValeur?: string;
  prospectionMode?: boolean;
  maxRemorques?: number | null;
  errors?: Record<string, string>;
  openSection?: ContratSectionKey;
  onSectionOpenChange?: (section: ContratSectionKey, open: boolean) => void;
};

export function FlotteTargetsSection({
  vehicules,
  setVehicules,
  remorques,
  setRemorques,
  garanties,
  selectedGaranties,
  setSelectedGaranties,
  lignes,
  formulesPersonne,
  usages,
  marques,
  carrosseries,
  categoriesTransport,
  compagniesAssistance,
  produitsAssistance,
  grilleSelected,
  preview,
  previewing = false,
  saving = false,
  onPreviewQuittance,
  onSaveDraft,
  onSaveTargetDraft,
  onValidateTarget,
  setAssistanceEnabled,
  assistanceCategorieClientId,
  crmPartage = false,
  crmPartageValeur = "",
  prospectionMode = false,
  maxRemorques,
  errors = {},
  openSection,
  onSectionOpenChange,
}: Props) {
  const targets = useMemo<Target[]>(
    () => [
      ...vehicules.map((vehicule, index) => ({
        kind: "vehicule" as const,
        index,
        label: `Véhicule ${index + 1}`,
        usageId: vehicule.usageId,
        categorieTransportId: vehicule.categorieTransportId,
        valeurVenale: vehicule.valeurVenale,
        valeurNeuf: vehicule.valeurNeuf,
        valeurGlace: vehicule.valeurGlace,
      })),
      ...remorques.map((remorque, index) => ({
        kind: "remorque" as const,
        index,
        label: `Remorque ${index + 1}`,
        usageId: remorque.usageId,
        valeurAssuree: remorque.valeurAssuree,
      })),
    ],
    [remorques, vehicules]
  );
  const [activeKey, setActiveKey] = useState(targetKey(targets[0]));
  const [activeTargetPart, setActiveTargetPart] = useState<"info" | "garanties">("info");
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [recalculationRequest, setRecalculationRequest] = useState<{ targetKey: string; seq: number } | null>(null);
  const [assistances, setAssistances] = useState<Record<string, AssistanceDraft>>({});
  const vehiculeGaranties = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "VEHICULE") !== "PERSONNE"),
    [garanties]
  );
  const personneGaranties = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "") === "PERSONNE"),
    [garanties]
  );
  const canAddRemorque = maxRemorques == null || remorques.length < maxRemorques;
  const vehiculeTargets = targets.filter((target) => target.kind === "vehicule");
  const remorqueTargets = targets.filter((target) => target.kind === "remorque");
  const activeVehiculeTarget =
    vehiculeTargets.find((target) => targetKey(target) === activeKey) ?? vehiculeTargets[0];
  const activeRemorqueTarget =
    remorqueTargets.find((target) => targetKey(target) === activeKey) ?? remorqueTargets[0];

  useEffect(() => {
    if (!recalculationRequest || !onPreviewQuittance) {
      return;
    }
    const target = targets.find((item) => targetKey(item) === recalculationRequest.targetKey);
    if (target) {
      onPreviewQuittance(target);
    }
  }, [recalculationRequest?.seq]);

  const requestTargetCalculation = (target: Target) => {
    const key = targetKey(target);
    setRecalculationRequest((current) => ({ targetKey: key, seq: (current?.seq ?? 0) + 1 }));
  };

  const updateAssistance = (target: Target, patch: Partial<AssistanceDraft>) => {
    setAssistances((current) => {
      const key = targetKey(target);
      const draft = current[key] ?? { enabled: false };
      const nextForTarget = { ...draft, ...patch };
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
    const rcGaranties = vehiculeGaranties.filter((garantie) => Boolean(garantie.responsabiliteCivile));
    if (rcGaranties.length === 0 || targets.length === 0) {
      return;
    }
    setSelectedGaranties((current) => {
      const additions: GarantieInput[] = [];
      for (const target of targets) {
        for (const garantie of rcGaranties) {
          if (!current.some((item) => item.garantieId === garantie.id && sameTarget(item, target))) {
            additions.push(targetedInput(garantie, target));
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

  return (
    <>
      <SectionCard
        title="Véhicules"
        badge={`${vehicules.length} véhicule${vehicules.length > 1 ? "s" : ""}`}
        tone="production"
        open={openSection === "flotteTargets"}
        onOpenChange={(open) => onSectionOpenChange?.("flotteTargets", open)}
      >
        <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
          <div className="grid content-start gap-3">
            <div className="grid gap-2">
              {vehiculeTargets.map((target) => {
                const key = targetKey(target);
                const active = key === targetKey(activeVehiculeTarget);
                const saved = savedKeys.includes(`${key}:info`) && savedKeys.includes(`${key}:garanties`);
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
                    <Badge variant={saved ? "outline" : "secondary"}>
                      {saved ? "Validé" : selectedGaranties.filter((item) => sameTarget(item, target)).length}
                    </Badge>
                  </button>
                );
              })}
            </div>
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
          </div>

          {activeVehiculeTarget ? (
            <div className="grid gap-4">
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
                  marques={marques}
                  carrosseries={carrosseries}
                  categoriesTransport={categoriesTransport}
                  crmPartage={crmPartage}
                  crmPartageValeur={crmPartageValeur}
                  prospectionMode={prospectionMode}
                  errors={errors}
                />
                <SectionSubmitButton
                  saving={saving}
                  onClick={() => saveTargetSection(activeVehiculeTarget, "info", "Informations véhicule", () => {
                    setActiveTargetPart("garanties");
                    onPreviewQuittance?.(activeVehiculeTarget);
                  })}
                >
                  Enregistrer informations
                </SectionSubmitButton>
              </TargetSubsection>
              <TargetSubsection
                title="Garanties"
                badge={`${selectedGaranties.filter((item) => sameTarget(item, activeVehiculeTarget)).length} garantie${selectedGaranties.filter((item) => sameTarget(item, activeVehiculeTarget)).length > 1 ? "s" : ""}`}
                open={activeTargetPart === "garanties"}
                onOpenChange={() => setActiveTargetPart("garanties")}
                action={
                  <Button
                    type="button"
                    disabled={previewing || saving}
                    onClick={() => {
                      saveTargetSection(activeVehiculeTarget, "garanties", "Garanties véhicule", () => {
                        onPreviewQuittance?.(activeVehiculeTarget);
                      });
                    }}
                  >
                    {previewing || saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {saving ? "Enregistrement..." : previewing ? "Calcul..." : "Enregistrer garanties"}
                  </Button>
                }
              >
                <TargetGuaranteesTable
                  target={activeVehiculeTarget}
                  garanties={vehiculeGaranties}
                  personneGaranties={personneGaranties}
                  selected={selectedGaranties}
                  setSelected={setSelectedGaranties}
                  lignes={lignes}
                  formulesPersonne={formulesPersonne}
                  usages={usages}
                  compagniesAssistance={compagniesAssistance}
                  produitsAssistance={produitsAssistance}
                  assistance={assistances[targetKey(activeVehiculeTarget)] ?? { enabled: false }}
                  onAssistanceChange={(patch) => updateAssistance(activeVehiculeTarget, patch)}
                  assistanceCategorieClientId={assistanceCategorieClientId}
                  grilleSelected={grilleSelected}
                  preview={preview}
                  previewing={previewing}
                  onRequestCalculation={requestTargetCalculation}
                />
                <QuittanceTotalsSummary
                  preview={preview}
                  target={activeVehiculeTarget}
                  loading={previewing}
                  showPersonneTotals={hasTargetPersonneGaranties(selectedGaranties, personneGaranties, activeVehiculeTarget)}
                  showAssistanceTotal={Boolean(assistances[targetKey(activeVehiculeTarget)]?.enabled)}
                  assistanceNet={targetAssistanceNet(assistances[targetKey(activeVehiculeTarget)], produitsAssistance)}
                />
              </TargetSubsection>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Remorques"
        badge={`${remorques.length} remorque${remorques.length > 1 ? "s" : ""}`}
        tone="production"
        defaultOpen={false}
        open={openSection === "remorque"}
        onOpenChange={(open) => onSectionOpenChange?.("remorque", open)}
      >
        <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
          <div className="grid content-start gap-3">
            {remorqueTargets.length > 0 ? (
              <div className="grid gap-2">
                {remorqueTargets.map((target) => {
                  const key = targetKey(target);
                  const active = key === targetKey(activeRemorqueTarget);
                  const saved = savedKeys.includes(`${key}:info`) && savedKeys.includes(`${key}:garanties`);
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
                      <Badge variant={saved ? "outline" : "secondary"}>
                        {saved ? "Validé" : selectedGaranties.filter((item) => sameTarget(item, target)).length}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Aucune remorque ajoutée.
              </div>
            )}
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
          </div>

          {activeRemorqueTarget ? (
            <div className="grid gap-4">
              <TargetSubsection title="Informations remorque">
                <RemorqueForm
                  index={activeRemorqueTarget.index}
                  remorque={remorques[activeRemorqueTarget.index]}
                  setRemorques={setRemorques}
                  usages={usages}
                  marques={marques}
                  prospectionMode={prospectionMode}
                />
                <SectionSubmitButton saving={saving} onClick={() => saveTargetSection(activeRemorqueTarget, "info", "Informations remorque")}>
                  Enregistrer informations
                </SectionSubmitButton>
              </TargetSubsection>
              <TargetSubsection
                title="Garanties"
                badge={`${selectedGaranties.filter((item) => sameTarget(item, activeRemorqueTarget)).length} garantie${selectedGaranties.filter((item) => sameTarget(item, activeRemorqueTarget)).length > 1 ? "s" : ""}`}
                action={
                  <Button
                    type="button"
                    disabled={previewing || saving}
                    onClick={() => {
                      saveTargetSection(activeRemorqueTarget, "garanties", "Garanties remorque", () => {
                        onPreviewQuittance?.(activeRemorqueTarget);
                      });
                    }}
                  >
                    {previewing || saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {saving ? "Enregistrement..." : previewing ? "Calcul..." : "Enregistrer garanties"}
                  </Button>
                }
              >
                <TargetGuaranteesTable
                  target={activeRemorqueTarget}
                  garanties={vehiculeGaranties}
                  personneGaranties={personneGaranties}
                  selected={selectedGaranties}
                  setSelected={setSelectedGaranties}
                  lignes={lignes}
                  formulesPersonne={formulesPersonne}
                  usages={usages}
                  compagniesAssistance={compagniesAssistance}
                  produitsAssistance={produitsAssistance}
                  assistance={assistances[targetKey(activeRemorqueTarget)] ?? { enabled: false }}
                  onAssistanceChange={(patch) => updateAssistance(activeRemorqueTarget, patch)}
                  assistanceCategorieClientId={assistanceCategorieClientId}
                  grilleSelected={grilleSelected}
                  preview={preview}
                  previewing={previewing}
                  onRequestCalculation={requestTargetCalculation}
                />
                <QuittanceTotalsSummary
                  preview={preview}
                  target={activeRemorqueTarget}
                  loading={previewing}
                  showPersonneTotals={hasTargetPersonneGaranties(selectedGaranties, personneGaranties, activeRemorqueTarget)}
                  showAssistanceTotal={Boolean(assistances[targetKey(activeRemorqueTarget)]?.enabled)}
                  assistanceNet={targetAssistanceNet(assistances[targetKey(activeRemorqueTarget)], produitsAssistance)}
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
    </>
  );
}

function SectionSubmitButton({
  children,
  disabled,
  saving,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  saving?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-5 flex justify-end border-t pt-4">
      <Button type="button" disabled={disabled || saving} onClick={onClick}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {saving ? "Enregistrement..." : children}
      </Button>
    </div>
  );
}

function LookupMessage({ state }: { state?: LookupState }) {
  if (!state || state.status === "idle") {
    return null;
  }
  const tone = state.status === "found"
    ? "text-emerald-700 dark:text-emerald-400"
    : state.status === "new"
      ? "text-slate-500"
      : state.status === "error"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <span className={`flex items-center gap-1 text-xs ${tone}`}>
      {state.status === "loading" ? <Loader2 className="size-3 animate-spin" /> : null}
      {state.message}
    </span>
  );
}

function TargetSubsection({
  title,
  badge,
  action,
  children,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
}: {
  title: string;
  badge?: string;
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
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between gap-3 bg-emerald-50 px-4 py-3 text-left text-emerald-950 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-50 dark:hover:bg-emerald-950/45">
          <span className="flex min-w-0 items-center gap-2">
            <ChevronDown className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} />
            <span className="truncate text-sm font-semibold">{title}</span>
            {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          </span>
        </button>
      </CollapsibleTrigger>
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
    ["TAXE", scoped.taxe],
    ["CNPAC", scoped.cnpac],
    ["TOTAL À PAYER", scoped.totalAPayer],
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
            {loading ? <CalculationValue loading value={value} fallback="-" /> : value == null ? "-" : formatMoney(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function targetQuittanceSummary(preview: QuittancePreview | null | undefined, target: Target): TargetQuittanceSummary {
  if (!preview) {
    return {};
  }
  const backendSummary = backendTargetSummary(preview, target);
  if (backendSummary) {
    return {
      totalNet: backendSummary.primeNetteHorsEvcat,
      evcat: backendSummary.evcatPrimeNette,
      pta: backendSummary.corporelPrimeNette,
      accessoire: backendSummary.accessoire,
      taxe: addNumbers(backendSummary.taxe, backendSummary.taxeParafiscale),
      cnpac: backendSummary.cnpac,
      totalAPayer: backendSummary.primeTotale,
    };
  }
  const autoLine = quittanceLine(preview, "AUTOMOBILE");
  const corpLine = quittanceLine(preview, "CORPOREL");
  const evcatLine = quittanceLine(preview, "EVCAT");
  const targetLines = (preview.garanties ?? []).filter((line) => previewLineMatchesTarget(line, target));
  const autoNet = roundMoney(sumPreviewLines(targetLines.filter((line) => !isPersonnePreviewLine(line))));
  const pta = roundMoney(sumPreviewLines(targetLines.filter(isPersonnePreviewLine)));
  const evcat = proportionalAmount(evcatLine?.primeNette, autoNet, autoLine?.primeNette);
  const accessoire = proportionalAmount(corpLine?.accessoire, pta, corpLine?.primeNette);
  const cnpac = targetHasRcPreviewLine(targetLines) ? targetCnpac(preview) : 0;
  const taxe = roundMoney(
    numberOrZero(proportionalAmount(lineTaxTotal(autoLine), autoNet, autoLine?.primeNette))
      + numberOrZero(proportionalAmount(lineTaxTotal(corpLine), pta, corpLine?.primeNette))
      + numberOrZero(proportionalAmount(lineTaxTotal(evcatLine), evcat, evcatLine?.primeNette))
  );
  const totalNet = roundMoney(autoNet + pta);
  const totalAPayer = roundMoney(totalNet + numberOrZero(evcat) + taxe + cnpac + numberOrZero(accessoire));

  return {
    totalNet,
    evcat,
    pta,
    accessoire,
    taxe,
    cnpac,
    totalAPayer,
  };
}

function backendTargetSummary(preview: QuittancePreview, target: Target) {
  return preview.targetSummaries?.find((summary) => {
    const kind = String(summary.kind ?? "").toUpperCase();
    return target.kind === "vehicule"
      ? kind === "VEHICULE" && summary.vehiculeIndex === target.index
      : kind === "REMORQUE" && summary.remorqueIndex === target.index;
  });
}

function addNumbers(left?: number, right?: number) {
  if (left == null && right == null) {
    return undefined;
  }
  return numberOrZero(left) + numberOrZero(right);
}

function quittanceLine(preview: QuittancePreview, categorie: string) {
  return preview.lignes.find((ligne) => ligne.categorie === categorie);
}

function lineTaxTotal(line?: QuittancePreview["lignes"][number]) {
  if (!line) {
    return undefined;
  }
  return numberOrZero(line.taxe) + numberOrZero(line.taxeParafiscale);
}

function proportionalAmount(total: number | undefined, part: number | undefined, base: number | undefined) {
  if (total == null) {
    return undefined;
  }
  if (!part || !base) {
    return 0;
  }
  return roundMoney(total * (part / base));
}

function sumPreviewLines(lines: NonNullable<QuittancePreview["garanties"]>) {
  return lines.reduce((sum, line) => sum + numberOrZero(line.primeNette), 0);
}

function previewLineMatchesTarget(line: NonNullable<QuittancePreview["garanties"]>[number], target: Target) {
  return target.kind === "vehicule"
    ? line.vehiculeIndex === target.index
    : line.remorqueIndex === target.index;
}

function isPersonnePreviewLine(line: NonNullable<QuittancePreview["garanties"]>[number]) {
  const type = String(line.typeGarantie ?? "").toUpperCase();
  const code = String(line.code ?? "").trim().toUpperCase();
  return type === "PERSONNE" || code === "PP" || code === "PC" || code === "PTA";
}

function targetHasRcPreviewLine(lines: NonNullable<QuittancePreview["garanties"]>) {
  return lines.some((line) => String(line.code ?? "").trim().toUpperCase() === "RC");
}

function targetCnpac(preview: QuittancePreview) {
  const autoCnpac = numberOrZero(quittanceLine(preview, "AUTOMOBILE")?.cnpac);
  const units = new Set<string>();
  for (const line of preview.garanties ?? []) {
    if (String(line.code ?? "").trim().toUpperCase() !== "RC") {
      continue;
    }
    if (line.vehiculeIndex != null) {
      units.add(`V:${line.vehiculeIndex}`);
    } else if (line.remorqueIndex != null) {
      units.add(`R:${line.remorqueIndex}`);
    }
  }
  return units.size > 0 ? roundMoney(autoCnpac / units.size) : autoCnpac;
}

function targetAssistanceNet(assistance: AssistanceDraft | undefined, produitsAssistance: ReferenceOption[]) {
  if (!assistance?.enabled || !assistance.produitAssistanceId) {
    return undefined;
  }
  const product = produitsAssistance.find((item) => item.id === assistance.produitAssistanceId);
  return numberValue(String(product?.montantHt ?? ""));
}

function previewGuaranteeLine(
  preview: QuittancePreview | null | undefined,
  garantie: ReferenceOption,
  target: Target,
  selected?: GarantieInput
) {
  const expectedLineId = selected?.ligneGrilleTarifaireId;
  const expectedFormuleId = selected?.formuleGarantiePersonneId;
  return preview?.garanties?.find((line) => {
    if (String(line.garantieId ?? "") !== String(garantie.id)) {
      return false;
    }
    if (target.kind === "vehicule" && line.vehiculeIndex !== target.index) {
      return false;
    }
    if (target.kind === "remorque" && line.remorqueIndex !== target.index) {
      return false;
    }
    if (expectedLineId && line.ligneGrilleTarifaireId && String(line.ligneGrilleTarifaireId) !== String(expectedLineId)) {
      return false;
    }
    if (expectedFormuleId && line.formuleGarantiePersonneId && String(line.formuleGarantiePersonneId) !== String(expectedFormuleId)) {
      return false;
    }
    return true;
  });
}

function CalculationValue({ value, loading, fallback = "Calcul auto" }: { value?: number; loading?: boolean; fallback?: string }) {
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

function stringValue(value: unknown) {
  return value === undefined || value === null ? undefined : String(value);
}

function toOptionalNumber(value: unknown) {
  return typeof value === "number" ? value : value === undefined || value === null || value === "" ? undefined : Number(value);
}

function VehicleForm({
  index,
  vehicule,
  setVehicules,
  usages,
  marques,
  carrosseries,
  categoriesTransport,
  crmPartage,
  crmPartageValeur,
  prospectionMode,
  errors,
}: {
  index: number;
  vehicule: VehiculeInput;
  setVehicules: Dispatch<SetStateAction<VehiculeInput[]>>;
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  crmPartage: boolean;
  crmPartageValeur: string;
  prospectionMode: boolean;
  errors: Record<string, string>;
}) {
  const usage = usages.find((item) => item.id === vehicule.usageId);
  const needsCarburantAndPf = Boolean(usage?.byCarburantAndPf);
  const needsSousClasse = Boolean(usage?.bySousClasse);
  const needsPtc = Boolean(usage?.byPtc);
  const needsCategorieTransport = Boolean(usage?.byCategorieTransport);
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = (patch: Partial<VehiculeInput>) => {
    setVehicules((current) => current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };
  useEffect(() => () => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
  }, []);

  const fillExistingVehicule = (found: VehiculeResponse) => {
    const usageId = stringValue(found.usageId);
    const marqueId = stringValue(found.marqueId);
    const carrosserieId = stringValue(found.carrosserieId);
    const categorieTransportId = stringValue(found.categorieTransportId);
    const usageAllowed = usageId && usages.some((item) => item.id === usageId);
    update({
      usageId: usageAllowed ? usageId : vehicule.usageId,
      marqueId: marqueId || undefined,
      marqueLibelle: marqueId ? undefined : found.marque ?? undefined,
      carrosserieId: carrosserieId || undefined,
      carrosserieLibelle: carrosserieId ? undefined : found.carrosserie ?? undefined,
      categorieTransportId: categorieTransportId || undefined,
      carburant: found.carburant ?? undefined,
      puissanceFiscale: found.puissanceFiscale ?? undefined,
      nombrePlaces: found.nombrePlaces ?? undefined,
      sousClasse: found.sousClasse ?? undefined,
      ptc: found.ptc ?? undefined,
      datePremiereCirculation: found.datePremiereCirculation ?? undefined,
      dateExpirationCarteGrise: found.dateExpirationCarteGrise ?? undefined,
      crm: crmPartage ? vehicule.crm : found.crm ?? undefined,
      valeurVenale: toOptionalNumber(found.valeurVenale),
      valeurNeuf: toOptionalNumber(found.valeurNeuf),
      valeurGlace: toOptionalNumber(found.valeurGlace),
    });
  };

  const searchVehicule = async (immatriculation?: string) => {
    const value = immatriculation?.trim();
    if (!value) {
      setLookup({ status: "idle" });
      return;
    }
    setLookup({ status: "loading", message: "Recherche du véhicule..." });
    try {
      const found = await productionApi.searchVehicule({ immatriculation: value });
      if (found) {
        fillExistingVehicule(found);
        setLookup({ status: "found", message: "Véhicule existant chargé." });
        return;
      }
      setLookup({ status: "new", message: "Nouveau véhicule : aucune fiche trouvée." });
    } catch {
      setLookup({ status: "error", message: "Recherche véhicule indisponible." });
    }
  };

  const scheduleVehiculeSearch = (immatriculation?: string) => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const value = immatriculation?.trim();
    if (!value || value.length < 3) {
      setLookup({ status: "idle" });
      return;
    }
    setLookup({ status: "loading", message: "Recherche du véhicule..." });
    lookupTimer.current = setTimeout(() => {
      void searchVehicule(value);
    }, 500);
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Usage" required error={errors[`vehicules.${index}.usageId`]}>
          <AutocompleteSelect
            value={vehicule.usageId ?? ""}
            placeholder="Usage"
            emptyText="Aucun usage trouvé"
            invalidText="Usage invalide : choisissez une option existante."
            options={usages.map((usage) => ({
              value: usage.id,
              label: usage.code ? `${usage.code} - ${usage.libelle}` : usage.libelle,
              keywords: usage.code,
            }))}
            onValueChange={(value) =>
              update({
                usageId: value,
                categorieTransportId: undefined,
                carburant: undefined,
                puissanceFiscale: undefined,
                sousClasse: undefined,
                ptc: undefined,
              })
            }
          />
        </Field>
        <Field label="Marque" required error={errors[`vehicules.${index}.marqueId`]}>
          <AutocompleteSelect
            value={vehicule.marqueId ?? ""}
            customValue={vehicule.marqueLibelle}
            allowCustomValue
            placeholder="Marque"
            emptyText="Aucune marque trouvée"
            options={marques.map((marque) => ({ value: marque.id, label: marque.libelle, keywords: marque.code }))}
            onValueChange={(value) => update({ marqueId: value || undefined, marqueLibelle: undefined })}
            onCustomValueChange={(value) => update({ marqueId: undefined, marqueLibelle: value })}
          />
        </Field>
        <Field label="Immatriculation" required error={errors[`vehicules.${index}.immatriculation`]}>
          <Input
            value={vehicule.immatriculation ?? ""}
            onBlur={() => searchVehicule(vehicule.immatriculation)}
            onChange={(event) => {
              update({ immatriculation: event.target.value });
              scheduleVehiculeSearch(event.target.value);
            }}
          />
          <LookupMessage state={lookup} />
        </Field>
        <Field label="Date mise en circulation">
          <DatePicker date={vehicule.datePremiereCirculation} onSelect={(date) => update({ datePremiereCirculation: toDateOnly(date) })} />
        </Field>
        <Field label="Date validité CG" error={errors[`vehicules.${index}.dateExpirationCarteGrise`]}>
          <DatePicker date={vehicule.dateExpirationCarteGrise} onSelect={(date) => update({ dateExpirationCarteGrise: toDateOnly(date) })} />
        </Field>
        {needsCarburantAndPf ? (
          <Field label="Puissance fiscale / cylindrée" required error={errors[`vehicules.${index}.puissanceFiscale`]}>
            <Input className="text-right" value={vehicule.puissanceFiscale ?? ""} onChange={(event) => update({ puissanceFiscale: event.target.value })} />
          </Field>
        ) : null}
        {needsCarburantAndPf ? (
          <Field label="Carburant" required error={errors[`vehicules.${index}.carburant`]}>
            <Select value={vehicule.carburant ?? ""} onValueChange={(value) => update({ carburant: value })}>
              <SelectTrigger><SelectValue placeholder="Carburant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Diesel">Diesel</SelectItem>
                <SelectItem value="Essence">Essence</SelectItem>
                <SelectItem value="Électrique">Électrique</SelectItem>
                <SelectItem value="Hybride_E">Hybride_E</SelectItem>
                <SelectItem value="Hybride_D">Hybride_D</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label="Carrosserie" required error={errors[`vehicules.${index}.carrosserieId`]}>
          <AutocompleteSelect
            value={vehicule.carrosserieId ?? ""}
            customValue={vehicule.carrosserieLibelle}
            allowCustomValue
            placeholder="Carrosserie"
            emptyText="Aucune carrosserie trouvée"
            options={carrosseries.map((carrosserie) => ({ value: carrosserie.id, label: carrosserie.libelle, keywords: carrosserie.code }))}
            onValueChange={(value) => update({ carrosserieId: value || undefined, carrosserieLibelle: undefined })}
            onCustomValueChange={(value) => update({ carrosserieId: undefined, carrosserieLibelle: value })}
          />
        </Field>
        {needsSousClasse ? (
          <Field label="Sous-classe" required error={errors[`vehicules.${index}.sousClasse`]}>
            <Input value={vehicule.sousClasse ?? ""} onChange={(event) => update({ sousClasse: event.target.value })} />
          </Field>
        ) : null}
        {needsPtc ? (
          <Field label="PTC" required error={errors[`vehicules.${index}.ptc`]}>
            <Input className="text-right" value={vehicule.ptc ?? ""} onChange={(event) => update({ ptc: event.target.value })} />
          </Field>
        ) : null}
        {needsCategorieTransport ? (
          <Field label="Catégorie transport" required error={errors[`vehicules.${index}.categorieTransportId`]}>
            <Select value={vehicule.categorieTransportId ?? ""} onValueChange={(value) => update({ categorieTransportId: value })}>
              <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                {categoriesTransport.map((categorie) => <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {!prospectionMode ? (
          <Field label="N° attestation">
            <Input value={vehicule.numeroAttestation ?? ""} onChange={(event) => update({ numeroAttestation: event.target.value })} />
          </Field>
        ) : null}
        <Field label="Nombre de places" required error={errors[`vehicules.${index}.nombrePlaces`]}>
          <Input className="text-right" value={vehicule.nombrePlaces ?? ""} onChange={(event) => update({ nombrePlaces: event.target.value })} />
        </Field>
        <Field label="Valeur à neuf" error={errors[`vehicules.${index}.valeurNeuf`]}>
          <MoneyInput className="text-right" value={vehicule.valeurNeuf} onValueChange={(value) => update({ valeurNeuf: value })} />
        </Field>
        <Field label="Valeur vénale" error={errors[`vehicules.${index}.valeurVenale`] ?? validateValeurVenale(vehicule)}>
          <MoneyInput className="text-right" value={vehicule.valeurVenale} onValueChange={(value) => update({ valeurVenale: value })} />
        </Field>
        <Field label="Valeur glace">
          <MoneyInput className="text-right" value={vehicule.valeurGlace} onValueChange={(value) => update({ valeurGlace: value })} />
        </Field>
        <Field label="CRM" required error={errors[`vehicules.${index}.crm`]}>
          <Input
            value={crmPartage ? crmPartageValeur : vehicule.crm ?? ""}
            readOnly={crmPartage}
            className={cn("text-right", crmPartage ? "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400" : undefined)}
            onChange={(event) => update({ crm: event.target.value })}
          />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Checkbox
          checked={Boolean(vehicule.organismeCredit)}
          onCheckedChange={(checked) =>
            update(Boolean(checked)
              ? { organismeCredit: true }
              : { organismeCredit: false, nomOrganismeCredit: undefined, montantCredit: undefined, dateFinCredit: undefined })
          }
        />
        <span className="text-sm">Organisme de crédit</span>
      </div>
      {vehicule.organismeCredit ? (
        <div className="mt-3 grid max-w-5xl gap-3 md:grid-cols-3">
          <Field label="Nom organisme">
            <Input value={vehicule.nomOrganismeCredit ?? ""} onChange={(event) => update({ nomOrganismeCredit: event.target.value })} />
          </Field>
          <Field label="Montant de crédit">
            <MoneyInput className="text-right" value={vehicule.montantCredit} onValueChange={(value) => update({ montantCredit: value })} />
          </Field>
          <Field label="Date fin crédit">
            <DatePicker date={vehicule.dateFinCredit} onSelect={(date) => update({ dateFinCredit: toDateOnly(date) })} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function RemorqueForm({
  index,
  remorque,
  setRemorques,
  usages,
  marques,
  prospectionMode,
}: {
  index: number;
  remorque: RemorqueInput;
  setRemorques: Dispatch<SetStateAction<RemorqueInput[]>>;
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  prospectionMode: boolean;
}) {
  const update = (patch: Partial<RemorqueInput>) => {
    setRemorques((current) => current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Usage" required>
          <AutocompleteSelect
            value={remorque.usageId ?? ""}
            placeholder="Usage remorque"
            emptyText="Aucun usage trouvé"
            invalidText="Usage invalide : choisissez une option existante."
            options={usages.map((usage) => ({
              value: usage.id,
              label: usage.code ? `${usage.code} - ${usage.libelle}` : usage.libelle,
              keywords: usage.code,
            }))}
            onValueChange={(value) => update({ usageId: value })}
          />
        </Field>
        <Field label="Immatriculation">
          <Input value={remorque.immatriculation ?? ""} onChange={(event) => update({ immatriculation: event.target.value })} />
        </Field>
        <Field label="Marque">
          <AutocompleteSelect
            value={remorque.marqueId ?? ""}
            customValue={remorque.marqueLibelle}
            allowCustomValue
            placeholder="Marque"
            emptyText="Aucune marque trouvée"
            options={marques.map((marque) => ({ value: marque.id, label: marque.libelle, keywords: marque.code }))}
            onValueChange={(value) => update({ marqueId: value || undefined, marqueLibelle: undefined })}
            onCustomValueChange={(value) => update({ marqueId: undefined, marqueLibelle: value })}
          />
        </Field>
        <Field label="PTC">
          <Input className="text-right" value={remorque.ptc ?? ""} onChange={(event) => update({ ptc: event.target.value })} />
        </Field>
        <Field label="Date mise en circulation">
          <DatePicker date={remorque.dateMiseEnCirculation} onSelect={(date) => update({ dateMiseEnCirculation: toDateOnly(date) })} />
        </Field>
        <Field label="Date d'effet">
          <DatePicker date={remorque.dateEffet} onSelect={(date) => update({ dateEffet: toDateOnly(date) })} />
        </Field>
        <Field label="Date d'échéance">
          <DatePicker date={remorque.dateEcheance} onSelect={(date) => update({ dateEcheance: toDateOnly(date) })} />
        </Field>
        <Field label="CRM">
          <Input className="text-right" value={remorque.crm ?? ""} onChange={(event) => update({ crm: event.target.value })} />
        </Field>
        {!prospectionMode ? (
          <Field label="N° attestation">
            <Input value={remorque.numeroAttestation ?? ""} onChange={(event) => update({ numeroAttestation: event.target.value })} />
          </Field>
        ) : null}
        <Field label="Valeur assurée">
          <MoneyInput className="text-right" value={remorque.valeurAssuree} onValueChange={(value) => update({ valeurAssuree: value })} />
        </Field>
      </div>
    </div>
  );
}

function TargetGuaranteesTable({
  target,
  garanties,
  personneGaranties,
  selected,
  setSelected,
  lignes,
  formulesPersonne,
  usages,
  compagniesAssistance,
  produitsAssistance,
  assistance,
  onAssistanceChange,
  assistanceCategorieClientId,
  grilleSelected,
  preview,
  previewing,
  onRequestCalculation,
}: {
  target: Target;
  garanties: ReferenceOption[];
  personneGaranties: ReferenceOption[];
  selected: GarantieInput[];
  setSelected: Dispatch<SetStateAction<GarantieInput[]>>;
  lignes: ReferenceOption[];
  formulesPersonne: ReferenceOption[];
  usages: ReferenceOption[];
  compagniesAssistance: ReferenceOption[];
  produitsAssistance: ReferenceOption[];
  assistance: AssistanceDraft;
  onAssistanceChange: (patch: Partial<AssistanceDraft>) => void;
  assistanceCategorieClientId?: string;
  grilleSelected: boolean;
  preview?: QuittancePreview | null;
  previewing?: boolean;
  onRequestCalculation?: (target: Target) => void;
}) {
  const update = (garantieId: string, patch: Partial<GarantieInput>) => {
    setSelected((current) => current.map((item) => (item.garantieId === garantieId && sameTarget(item, target) ? { ...item, ...patch } : item)));
    onRequestCalculation?.(target);
  };

  const toggle = (garantie: ReferenceOption, checked: boolean) => {
    if (Boolean(garantie.responsabiliteCivile)) {
      return;
    }
    const lineOptions = matchingLines(lignes, garantie, target);
    const selectedLine = selectedLineFor(lineOptions);
    if (checked) {
      const warning = valueWarning(garantie, target, selectedLine);
      if (warning) {
        toast.error(warning);
        return;
      }
    }
    setSelected((current) => checked
      ? [...current, { ...targetedInput(garantie, target), ...targetLineSelectionPatch(garantie, selectedLine, target) }]
      : current.filter((item) => !(item.garantieId === garantie.id && sameTarget(item, target))));
    onRequestCalculation?.(target);
  };

  const togglePersonne = (garantie: ReferenceOption, checked: boolean) => {
    const formules = matchingPersonneFormules(formulesPersonne, garantie, target);
    setSelected((current) =>
      checked
        ? [
            ...current,
            {
              ...targetedInput(garantie, target),
              modeSelectionne: "PROTECTION",
              sourceValeurSelectionnee: "AUCUNE",
              formuleGarantiePersonneId: formules[0]?.id,
              formule: String(formules[0]?.libelle ?? garantie.code ?? garantie.libelle),
              prime: numberValue(String(formules[0]?.primeNette ?? "")),
            },
          ]
        : current.filter((item) => !(item.garantieId === garantie.id && sameTarget(item, target)))
    );
    onRequestCalculation?.(target);
  };

  const usage = target.kind === "vehicule" ? usages.find((item) => item.id === target.usageId) : undefined;
  const configuredGaranties = garanties.filter((garantie) => Boolean(garantie.responsabiliteCivile) || matchingLines(lignes, garantie, target).length > 0);
  const configuredPersonneGaranties = personneGaranties.filter((garantie) => matchingPersonneFormules(formulesPersonne, garantie, target).length > 0);
  const showPersonne = target.kind === "vehicule" && Boolean(usage?.garantiesPersonne) && configuredPersonneGaranties.length > 0;

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-md border">
        <div className="border-b px-3 py-2 text-sm font-semibold">Garanties véhicule</div>
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-3 text-left" />
              <th className="px-3 py-3 text-left">Garantie</th>
              <th className="w-44 px-3 py-3 text-left">Capital / valeur</th>
              <th className="w-36 px-3 py-3 text-left">Taux (%)</th>
              <th className="w-56 px-3 py-3 text-left">Taux franchise / Min franchise</th>
              <th className="w-40 px-3 py-3 text-left">Prime nette</th>
            </tr>
          </thead>
          <tbody>
            {configuredGaranties.map((garantie) => {
              const item = selected.find((selectedItem) => selectedItem.garantieId === garantie.id && sameTarget(selectedItem, target));
              const checked = Boolean(item);
              const isRc = Boolean(garantie.responsabiliteCivile);
              const lineOptions = matchingLines(lignes, garantie, target);
              const selectedLine = selectedLineFor(lineOptions, item);
              const hasLine = isRc || lineOptions.length > 0;
              const disabled = isRc || !grilleSelected || !hasLine;
              const editable = checked && !isRc;
              const warning = checked ? valueWarning(garantie, target, selectedLine) : "";
              const sourceOptions = target.kind === "vehicule" ? availableTargetValueSources(garantie, target, selectedLine) : [];
              const selectedSource = target.kind === "vehicule" ? selectedTargetValueSource(garantie, item, target, selectedLine) : "";
              const manualValue = defaultSource(garantie) === "MANUEL" && lineMode(selectedLine) !== "CAPITAL";
              const displayCapital = targetGuaranteeCapitalValue(garantie, selectedLine, target, item);
              const previewLine = previewGuaranteeLine(preview, garantie, target, item);
              const previewPrime = previewLine?.primeNette;
              const rowCalculating = checked && Boolean(previewing);

              return (
                <tr
                  key={garantie.id}
                  className={cn(
                    "border-t align-middle transition-colors",
                    !checked && "bg-muted/20 text-muted-foreground",
                    checked && "bg-background",
                    isRc && "bg-amber-50/50 dark:bg-amber-950/20"
                  )}
                >
                  <td className="px-3 py-2">
                    <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => toggle(garantie, Boolean(value))} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                    {warning ? <div className="mt-1 text-xs text-destructive">{warning}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    {manualValue ? (
                      <MoneyInput
                        disabled={!editable}
                        className={cn(controlClass(editable), "text-right")}
                        value={item?.valeurAssuree ?? item?.capital}
                        onValueChange={(value) => update(garantie.id, { valeurAssuree: value, capital: value })}
                      />
                    ) : lineOptions.length > 1 && lineMode(selectedLine) === "CAPITAL" ? (
                      <Select
                        value={selectedLine?.id ?? ""}
                        disabled={!editable}
                        onValueChange={(value) => {
                          const line = lineOptions.find((option) => option.id === value);
                          update(garantie.id, targetLineSelectionPatch(garantie, line, target));
                        }}
                      >
                        <SelectTrigger className={cn(controlClass(editable), "[&>span]:w-full [&>span]:text-right")}><SelectValue placeholder="Formule" /></SelectTrigger>
                        <SelectContent>
                          {lineOptions.map((line) => <SelectItem key={line.id} value={line.id}>{capitalLineLabel(line)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : sourceOptions.length > 1 ? (
                      <Select
                        value={selectedSource}
                        disabled={!editable}
                        onValueChange={(value) => {
                          if (!hasTargetValue(target, value)) {
                            toast.error(`${sourceLabel(value)} requise`);
                            return;
                          }
                          update(garantie.id, { sourceValeurSelectionnee: value, valeurAssuree: undefined, capital: undefined });
                        }}
                      >
                        <SelectTrigger className={cn(controlClass(editable), "[&>span]:w-full [&>span]:text-right")}><SelectValue placeholder="Source" /></SelectTrigger>
                        <SelectContent>
                          {sourceOptions.map((source) => (
                            <SelectItem key={source} value={source}>{targetSourceOptionLabel(source, target)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : sourceOptions.length === 1 ? (
                      <Input readOnly disabled className={cn(controlClass(false), "text-right")} value={targetSourceOptionLabel(sourceOptions[0], target)} />
                    ) : isRc ? (
                      <span className="block rounded-md px-3 py-2 text-right text-muted-foreground">
                        {money(previewLine?.capital ?? (target.kind === "vehicule" ? resolveRcCapital(target, usages) : undefined)) || "Capital RC"}
                      </span>
                    ) : (
                      <Input readOnly disabled className={cn(controlClass(false), "text-right")} value={capitalDisplay(garantie, selectedLine, target, displayCapital)} />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!isRc && lineOptions.length > 1 ? (
                      <Select
                        value={selectedLine?.id ?? ""}
                        disabled={!editable}
                        onValueChange={(value) => {
                          const line = lineOptions.find((option) => option.id === value);
                          update(garantie.id, targetLineSelectionPatch(garantie, line, target));
                        }}
                      >
                        <SelectTrigger className={cn(controlClass(editable), "[&>span]:w-full [&>span]:text-right")}><SelectValue placeholder="Option" /></SelectTrigger>
                        <SelectContent>
                          {lineOptions.map((line, index) => <SelectItem key={line.id} value={line.id}>{tariffLineLabel(line, index)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="block rounded-md px-3 py-2 text-right text-muted-foreground">{isRc ? "-" : rateDisplay(selectedLine)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{franchiseDisplay(selectedLine)}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {checked ? <CalculationValue value={previewPrime} loading={rowCalculating} /> : "-"}
                  </td>
                </tr>
              );
            })}
            {configuredGaranties.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucune garantie véhicule configurée pour cet usage.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showPersonne ? (
        <div className="overflow-x-auto rounded-md border">
          <div className="border-b px-3 py-2 text-sm font-semibold">Garanties personne</div>
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-12 px-3 py-3 text-left" />
                <th className="px-3 py-3 text-left">Garantie</th>
                <th className="w-56 px-3 py-3 text-left">Formule</th>
                <th className="w-32 px-3 py-3 text-left">Décès</th>
                <th className="w-32 px-3 py-3 text-left">Invalidité</th>
                <th className="w-32 px-3 py-3 text-left">Frais médicaux</th>
                <th className="w-32 px-3 py-3 text-right">Prime nette</th>
              </tr>
            </thead>
            <tbody>
              {configuredPersonneGaranties.map((garantie) => {
                const item = selected.find((selectedItem) => selectedItem.garantieId === garantie.id && sameTarget(selectedItem, target));
                const checked = Boolean(item);
                const formules = matchingPersonneFormules(formulesPersonne, garantie, target);
                const selectedFormule = formules.find((formule) => formule.id === item?.formuleGarantiePersonneId) ?? formules[0];
                const disabled = !grilleSelected || formules.length === 0;
                const previewLine = previewGuaranteeLine(preview, garantie, target, item);
                const rowCalculating = checked && Boolean(previewing);

                return (
                  <tr
                    key={garantie.id}
                    className={cn(
                      "border-t align-middle transition-colors",
                      !checked && "bg-muted/20 text-muted-foreground",
                      checked && "bg-background"
                    )}
                  >
                    <td className="px-3 py-2">
                      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => togglePersonne(garantie, Boolean(value))} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={item?.formuleGarantiePersonneId ?? selectedFormule?.id ?? ""}
                        disabled={!checked || formules.length <= 1}
                        onValueChange={(value) => {
                          const formule = formules.find((option) => option.id === value);
                          update(garantie.id, {
                            formuleGarantiePersonneId: value,
                            formule: String(formule?.libelle ?? ""),
                            prime: numberValue(String(formule?.primeNette ?? "")),
                          });
                        }}
                      >
                        <SelectTrigger className={controlClass(checked)}>
                          <SelectValue placeholder="Formule" />
                        </SelectTrigger>
                        <SelectContent>
                          {formules.map((formule) => (
                            <SelectItem key={formule.id} value={formule.id}>{formule.libelle}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">{money(selectedFormule?.montantDeces)}</td>
                    <td className="px-3 py-2">{money(selectedFormule?.montantInvalidite)}</td>
                    <td className="px-3 py-2">{money(selectedFormule?.montantFraisMedicaux)}</td>
                    <td className="px-3 py-2 text-right">{checked ? <CalculationValue value={previewLine?.primeNette} loading={rowCalculating} /> : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {target.kind === "vehicule" ? (
        <AssistanceTable
          target={target}
          assistance={assistance}
          onChange={onAssistanceChange}
          compagniesAssistance={compagniesAssistance}
          produitsAssistance={produitsAssistance}
          categorieClientId={assistanceCategorieClientId}
        />
      ) : null}
    </div>
  );
}

function AssistanceTable({
  target,
  assistance,
  onChange,
  compagniesAssistance,
  produitsAssistance,
  categorieClientId,
}: {
  target: Target;
  assistance: AssistanceDraft;
  onChange: (patch: Partial<AssistanceDraft>) => void;
  compagniesAssistance: ReferenceOption[];
  produitsAssistance: ReferenceOption[];
  categorieClientId?: string;
}) {
  const filteredProducts = produitsAssistance.filter((produit) => {
    if (assistance.compagnieAssistanceId && produit.compagnieAssistanceId !== assistance.compagnieAssistanceId) {
      return false;
    }
    if (!assistanceProductMatchesCategory(produit, categorieClientId)) {
      return false;
    }
    const usageIds = Array.isArray(produit.usageIds) ? produit.usageIds.map(String) : [];
    return usageIds.length === 0 || !target.usageId || usageIds.includes(target.usageId);
  });
  const selectedProduct = filteredProducts.find((produit) => produit.id === assistance.produitAssistanceId);
  const selectedProductId = selectedProduct?.id ?? "";
  const prime = numberValue(String(selectedProduct?.montantHt ?? ""));
  const updateDateEffet = (dateEffet?: string) => {
    onChange({
      dateEffet,
      dateEcheance: computeDateEcheanceFromCode(dateEffet, assistance.echeanceCode, assistance.dateEcheance),
    });
  };
  const updateEcheance = (echeanceCode?: string) => {
    onChange({
      echeanceCode,
      dateEcheance: computeDateEcheanceFromCode(assistance.dateEffet, echeanceCode, assistance.dateEcheance),
    });
  };

  useEffect(() => {
    if (assistance.produitAssistanceId && !selectedProductId) {
      onChange({ produitAssistanceId: undefined });
    }
  }, [assistance.produitAssistanceId, onChange, selectedProductId]);

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
        <Checkbox
          checked={assistance.enabled}
          onCheckedChange={(checked) => onChange({ enabled: Boolean(checked) })}
        />
        <span>Assistance</span>
      </div>
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-3 text-left">Date effet</th>
            <th className="px-3 py-3 text-left">Date souscription</th>
            <th className="px-3 py-3 text-left">Échéance</th>
            <th className="px-3 py-3 text-left">Date échéance</th>
            <th className="px-3 py-3 text-left">N° contrat</th>
            <th className="px-3 py-3 text-left">Compagnie</th>
            <th className="px-3 py-3 text-left">Produit</th>
            <th className="px-3 py-3 text-right">Prime</th>
          </tr>
        </thead>
        <tbody>
          <tr className={cn("border-t align-middle", !assistance.enabled && "bg-muted/20 text-muted-foreground")}>
            <td className="px-3 py-2">
              <DatePicker disabled={!assistance.enabled} date={assistance.dateEffet} onSelect={(date) => updateDateEffet(toDateOnly(date))} />
            </td>
            <td className="px-3 py-2">
              <DatePicker disabled={!assistance.enabled} date={assistance.dateSouscription} onSelect={(date) => onChange({ dateSouscription: toDateOnly(date) })} />
            </td>
            <td className="px-3 py-2">
              <EcheanceInput
                disabled={!assistance.enabled}
                value={assistance.echeanceCode ?? ""}
                onValueChange={updateEcheance}
              />
            </td>
            <td className="px-3 py-2">
              <DatePicker disabled={!assistance.enabled} date={assistance.dateEcheance} onSelect={(date) => onChange({ dateEcheance: toDateOnly(date) })} />
            </td>
            <td className="px-3 py-2">
              <Input
                disabled={!assistance.enabled}
                value={assistance.numeroContratOuQuittance ?? ""}
                placeholder="N° contrat"
                onChange={(event) => onChange({ numeroContratOuQuittance: event.target.value })}
              />
            </td>
            <td className="px-3 py-2">
              <Select
                disabled={!assistance.enabled}
                value={assistance.compagnieAssistanceId ?? ""}
                onValueChange={(value) => onChange({ compagnieAssistanceId: value, produitAssistanceId: undefined })}
              >
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {compagniesAssistance.map((compagnie) => (
                    <SelectItem key={compagnie.id} value={compagnie.id}>{compagnie.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>
            <td className="px-3 py-2">
              <Select
                disabled={!assistance.enabled || filteredProducts.length === 0}
                value={selectedProductId}
                onValueChange={(value) => onChange({ produitAssistanceId: value })}
              >
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {filteredProducts.map((produit) => (
                    <SelectItem key={produit.id} value={produit.id}>{produit.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>
            <td className="px-3 py-2 text-right font-medium">
              {assistance.enabled && prime != null ? formatMoney(prime) : "-"}
            </td>
          </tr>
        </tbody>
      </table>
      {assistance.enabled ? (
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          Le prorata et la prime totale restent calculés par le service assistance lors de l'enregistrement sur le contrat créé.
        </div>
      ) : null}
    </div>
  );
}

function targetedInput(garantie: ReferenceOption, target: Target): GarantieInput {
  return {
    garantieId: garantie.id,
    vehiculeIndex: target.kind === "vehicule" ? target.index : undefined,
    remorqueIndex: target.kind === "remorque" ? target.index : undefined,
    modeSelectionne: String(garantie.modeParDefaut ?? "TAUX"),
    sourceValeurSelectionnee: defaultTargetSource(garantie, target),
  };
}

function sameTarget(item: GarantieInput, target?: Target) {
  if (!target) {
    return false;
  }
  return target.kind === "vehicule" ? item.vehiculeIndex === target.index : item.remorqueIndex === target.index;
}

function hasTargetPersonneGaranties(selected: GarantieInput[], personneGaranties: ReferenceOption[], target?: Target) {
  if (!target || personneGaranties.length === 0) {
    return false;
  }
  const personneIds = new Set(personneGaranties.map((garantie) => garantie.id));
  return selected.some((item) => sameTarget(item, target) && personneIds.has(item.garantieId));
}

function targetKey(target?: Target) {
  return target ? `${target.kind}:${target.index}` : "";
}

function matchingLines(lignes: ReferenceOption[], garantie: ReferenceOption, target?: Target) {
  if (!target) {
    return [];
  }
  return lignes
    .filter((ligne) => {
      if (ligne.garantieId && ligne.garantieId !== garantie.id) {
        return false;
      }
      if (ligne.usageId && ligne.usageId !== target.usageId) {
        return false;
      }
      if (ligne.categorieTransportId) {
        return target.kind === "vehicule" && ligne.categorieTransportId === target.categorieTransportId;
      }
      return true;
    })
    .sort((left, right) =>
      (numberValue(String(left.ordreAffichage ?? "")) ?? 9999) - (numberValue(String(right.ordreAffichage ?? "")) ?? 9999)
      || String(left.libelle ?? "").localeCompare(String(right.libelle ?? ""))
    );
}

function selectedLineFor(lines: ReferenceOption[], item?: GarantieInput) {
  return lines.find((line) => line.id === item?.ligneGrilleTarifaireId) ?? lines[0];
}

function targetLineSelectionPatch(garantie: ReferenceOption, line: ReferenceOption | undefined, target?: Target): Partial<GarantieInput> {
  const mode = lineMode(line) || String(garantie.modeParDefaut ?? "TAUX");
  const source = mode === "CAPITAL"
    ? "AUCUNE"
    : target ? defaultTargetSource(garantie, target, line) : defaultSource(garantie);
  return {
    ligneGrilleTarifaireId: line?.id,
    modeSelectionne: mode,
    sourceValeurSelectionnee: source,
    valeurAssuree: undefined,
    capital: undefined,
    taux: toNumber(line?.taux),
    prime: toNumber(line?.prime),
    tauxFranchise: toNumber(line?.tauxFranchise),
    franchiseMinimale: toNumber(line?.franchiseMinimale),
  };
}

function lineMode(line?: ReferenceOption) {
  return String(line?.modeTarification ?? "").toUpperCase();
}

function targetGuaranteeCapitalValue(garantie: ReferenceOption, line: ReferenceOption | undefined, target: Target, item?: GarantieInput) {
  if (lineMode(line) === "CAPITAL") {
    return toNumber(line?.capital);
  }
  if (defaultSource(garantie) === "MANUEL") {
    return item?.valeurAssuree ?? item?.capital;
  }
  const source = selectedTargetValueSource(garantie, item, target, line);
  if (target.kind === "vehicule") {
    if (source === "VENALE") return target.valeurVenale;
    if (source === "NEUF") return target.valeurNeuf;
    if (source === "GLACE") return target.valeurGlace;
  }
  return target.kind === "remorque" ? target.valeurAssuree : toNumber(line?.capital);
}

function capitalDisplay(garantie: ReferenceOption, line: ReferenceOption | undefined, target: Target, capital?: number) {
  if (lineMode(line) === "CAPITAL") {
    return capital == null ? "" : money(capital);
  }
  if (target.kind === "vehicule") {
    const source = selectedTargetValueSource(garantie, undefined, target, line);
    if (source === "VENALE") return `V.Vénale: ${money(target.valeurVenale)}`;
    if (source === "NEUF") return `V.Neuf: ${money(target.valeurNeuf)}`;
    if (source === "GLACE") return `V.Glace: ${money(target.valeurGlace)}`;
  }
  return capital == null ? "" : money(capital);
}

function capitalLineLabel(line: ReferenceOption) {
  const capital = toNumber(line.capital);
  return capital == null ? String(line.libelle ?? "Formule") : money(capital);
}

function tariffLineLabel(line: ReferenceOption, index = 0) {
  const mode = lineMode(line);
  const taux = toNumber(line.taux);
  if (mode === "TAUX" && taux != null) {
    return `${money(taux)} %`;
  }
  if (mode === "CAPITAL") {
    const label = String(line.libelle ?? "");
    return label.toLowerCase().includes("formule") ? label : `Formule ${index + 1}`;
  }
  return taux == null ? "" : `${money(taux)} %`;
}

function rateDisplay(line?: ReferenceOption) {
  const taux = toNumber(line?.taux);
  if (lineMode(line) === "CAPITAL") {
    return "";
  }
  return taux == null ? "-" : `${money(taux)} %`;
}

function franchiseDisplay(line?: ReferenceOption) {
  const tauxFranchise = toNumber(line?.tauxFranchise);
  const franchiseMinimale = toNumber(line?.franchiseMinimale);
  if (tauxFranchise == null && franchiseMinimale == null) {
    return "-";
  }
  const left = tauxFranchise == null ? "" : `${money(tauxFranchise)} %`;
  const right = franchiseMinimale == null ? "" : `${money(franchiseMinimale)} DH`;
  return [left, right].filter(Boolean).join(" _ ");
}

function resolveRcCapital(target: Target | undefined, usages: ReferenceOption[]) {
  const usage = usages.find((item) => item.id === target?.usageId);
  const usageText = `${usage?.code ?? ""} ${usage?.libelle ?? ""}`.toUpperCase();
  return usageText.includes("CYCLO") ? 5_000_000 : 50_000_000;
}

function matchingPersonneFormules(formules: ReferenceOption[], garantie: ReferenceOption, target?: Target) {
  if (!target || target.kind !== "vehicule") {
    return [];
  }
  return formules
    .filter((formule) => {
      if (formule.garantieId !== garantie.id) {
        return false;
      }
      return !formule.usageId || formule.usageId === target.usageId;
    })
    .sort((left, right) =>
      (numberValue(String(left.ordreAffichage ?? "")) ?? 9999) - (numberValue(String(right.ordreAffichage ?? "")) ?? 9999)
      || String(left.libelle ?? "").localeCompare(String(right.libelle ?? ""))
    );
}

function valueWarning(garantie: ReferenceOption, target?: Target, line?: ReferenceOption) {
  if (!target) {
    return "";
  }
  if (target.kind === "vehicule") {
    if (lineMode(line) === "CAPITAL" || defaultSource(garantie) === "MANUEL") {
      return validateValeurVenale(target) ?? "";
    }
    const allowedSources = allowedVehicleValueSources(garantie);
    if (allowedSources.length > 1) {
      if (allowedSources.some((allowedSource) => hasTargetValue(target, allowedSource))) {
        return validateValeurVenale(target) ?? "";
      }
      return `${allowedSources.map(sourceLabel).join(" ou ")} requise`;
    }
    const source = configuredDefaultVehicleValueSource(garantie) || allowedSources[0];
    if (source === "NEUF" && !target.valeurNeuf) {
      return "Valeur à neuf requise";
    }
    if (source === "VENALE" && !target.valeurVenale) {
      return "Valeur vénale requise";
    }
    if (source === "GLACE" && !target.valeurGlace) {
      return "Valeur glace requise";
    }
    const valeurVenaleError = validateValeurVenale(target);
    if (valeurVenaleError) {
      return valeurVenaleError;
    }
  }
  if (target.kind === "remorque" && garantie.avecCapital && !target.valeurAssuree) {
    return "Valeur remorque requise";
  }
  return "";
}

function configuredDefaultVehicleValueSource(garantie: ReferenceOption) {
  const source = String(garantie.sourceValeurParDefaut ?? "").toUpperCase();
  if (["VENALE", "NEUF", "GLACE"].includes(source)) {
    return source;
  }
  return "";
}

function allowedVehicleValueSources(garantie: ReferenceOption) {
  const sources = Array.isArray(garantie.sourcesValeurAutorisees)
    ? garantie.sourcesValeurAutorisees.map((source) => String(source).toUpperCase())
    : [];
  const valueSources = sources.filter((source) => ["VENALE", "NEUF", "GLACE"].includes(source));
  if (valueSources.length > 0) {
    return valueSources;
  }
  return [
    garantie.requiertValeurVenale ? "VENALE" : "",
    garantie.requiertValeurNeuf ? "NEUF" : "",
    garantie.requiertValeurGlace ? "GLACE" : "",
  ].filter(Boolean);
}

function hasTargetValue(target: Target, source: string) {
  if (source === "NEUF") {
    return Boolean(target.valeurNeuf);
  }
  if (source === "VENALE") {
    return Boolean(target.valeurVenale);
  }
  if (source === "GLACE") {
    return Boolean(target.valeurGlace);
  }
  return false;
}

function availableTargetValueSources(garantie: ReferenceOption, target: Target, line?: ReferenceOption) {
  if (lineMode(line) === "CAPITAL") {
    return [];
  }
  return allowedVehicleValueSources(garantie).filter((source) => hasTargetValue(target, source));
}

function selectedTargetValueSource(garantie: ReferenceOption, item: GarantieInput | undefined, target: Target, line?: ReferenceOption) {
  if (lineMode(line) === "CAPITAL") {
    return "AUCUNE";
  }
  const selected = String(item?.sourceValeurSelectionnee ?? "").toUpperCase();
  if (selected && selected !== "AUCUNE" && hasTargetValue(target, selected)) {
    return selected;
  }
  return defaultTargetSource(garantie, target, line);
}

function defaultTargetSource(garantie: ReferenceOption, target: Target, line?: ReferenceOption) {
  if (target.kind !== "vehicule") {
    return defaultSource(garantie);
  }
  if (lineMode(line) === "CAPITAL") {
    return "AUCUNE";
  }
  const sourceWithValue = allowedVehicleValueSources(garantie).find((allowedSource) => hasTargetValue(target, allowedSource));
  if (sourceWithValue) {
    return sourceWithValue;
  }
  const source = configuredDefaultVehicleValueSource(garantie) || (allowedVehicleValueSources(garantie).length === 1 ? allowedVehicleValueSources(garantie)[0] : "");
  return source || (allowedVehicleValueSources(garantie).length > 0 ? allowedVehicleValueSources(garantie)[0] : defaultSource(garantie));
}

function targetSourceOptionLabel(source: string, target: Target) {
  if (source === "NEUF") {
    return `V.Neuf: ${money(target.valeurNeuf)}`;
  }
  if (source === "VENALE") {
    return `V.Vénale: ${money(target.valeurVenale)}`;
  }
  if (source === "GLACE") {
    return `V.Glace: ${money(target.valeurGlace)}`;
  }
  return sourceLabel(source);
}

function sourceLabel(source: string) {
  if (source === "NEUF") {
    return "Valeur à neuf";
  }
  if (source === "VENALE") {
    return "Valeur vénale";
  }
  if (source === "GLACE") {
    return "Valeur glace";
  }
  return "Valeur";
}

function defaultSource(garantie: ReferenceOption) {
  if (garantie.sourceValeurParDefaut) {
    return String(garantie.sourceValeurParDefaut);
  }
  if (garantie.requiertValeurVenale) {
    return "VENALE";
  }
  if (garantie.requiertValeurNeuf) {
    return "NEUF";
  }
  if (garantie.requiertValeurGlace) {
    return "GLACE";
  }
  return "AUCUNE";
}

function assistanceProductMatchesCategory(produit: ReferenceOption, categorieClientId?: string) {
  const productCategoryId = produit.categorieClientId == null ? "" : String(produit.categorieClientId);
  if (!productCategoryId) return true;
  return Boolean(categorieClientId) && productCategoryId === String(categorieClientId);
}

function controlClass(active: boolean) {
  return active
    ? "border-slate-300 bg-slate-50/70 shadow-none focus-visible:border-ring focus-visible:ring-ring/50 dark:border-slate-700 dark:bg-input/30"
    : "border-transparent bg-muted/40 text-muted-foreground shadow-none";
}
