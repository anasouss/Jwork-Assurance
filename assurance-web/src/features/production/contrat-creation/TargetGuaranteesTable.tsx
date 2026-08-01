import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MoneyInput } from "../components/MoneyInput";
import type { AssistanceDraft, GarantieInput, QuittancePreview, ReferenceOption } from "../types";
import { money, moneyAmount, numberValue, toNumber } from "../utils/format";
import { validateValeurVenale } from "../utils/vehicle-validation";
import {
  removeGuaranteeExclusionConflicts as withoutExclusionConflicts,
  sameGuaranteeTarget as sameTarget,
  targetedGuaranteeInput,
} from "./guarantee-selection";
import { previewGuaranteeLine } from "./target-calculation";
import { TargetAssistanceTable } from "./TargetAssistanceTable";
import { guaranteeCalculationKey } from "./contract-target-key";
import type { ContractPricingMode, ContractTarget } from "./ContractTargetsSection";

type Target = ContractTarget;
type PricingMode = ContractPricingMode;

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

function ResponsiveRecordCell({
  label,
  children,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}) {
  return (
    <td className="col-span-2 grid grid-cols-1 gap-1 border-t border-border/60 px-3 py-2 sm:grid-cols-[minmax(7.5rem,0.8fr)_minmax(0,1.2fr)] sm:items-center sm:gap-3 xl:table-cell xl:border-t-0">
      <span className="text-xs font-medium text-muted-foreground xl:hidden">{label}</span>
      <div className={cn("min-w-0", valueClassName)}>{children}</div>
    </td>
  );
}

function GuaranteeTableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-2 py-2", className)}>{children}</td>;
}

export function TargetGuaranteesTable({
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
  showAssistance,
  grilleSelected,
  pricingMode,
  preview,
  previewing,
  dirtyCalculationKeys,
  onRequestCalculation,
  layout,
  primeColumnLabel,
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
  showAssistance?: boolean;
  grilleSelected: boolean;
  pricingMode: PricingMode;
  preview?: QuittancePreview | null;
  previewing?: boolean;
  dirtyCalculationKeys?: string[];
  onRequestCalculation?: (target: Target, garantieId?: string, selectedGaranties?: GarantieInput[]) => void;
  layout: "tariff" | "particulier";
  primeColumnLabel: string;
}) {
  const update = (garantieId: string, patch: Partial<GarantieInput>) => {
    const next = selected.map((item) => (item.garantieId === garantieId && sameTarget(item, target) ? { ...item, ...patch } : item));
    setSelected(next);
    onRequestCalculation?.(target, garantieId, next);
  };
  const automaticPricing = pricingMode === "AUTOMATIQUE_GRILLE";
  const primeInputEnabled = pricingMode === "MANUELLE_AVEC_PRIME_NETTE";

  const toggle = (garantie: ReferenceOption, checked: boolean) => {
    if (garantie.responsabiliteCivile) {
      return;
    }
    const lineOptions = automaticPricing ? matchingLines(lignes, garantie, target) : [];
    const selectedLine = selectedLineFor(lineOptions);
    if (checked) {
      const warning = valueWarning(garantie, target, selectedLine);
      if (warning) {
        toast.error(warning);
        return;
      }
    }
    const baseSelection = checked ? withoutExclusionConflicts(selected, garanties, target, garantie) : selected;
    const next = checked
      ? [...baseSelection, { ...targetedInput(garantie, target), ...targetLineSelectionPatch(garantie, selectedLine, target, pricingMode) }]
      : selected.filter((item) => !(item.garantieId === garantie.id && sameTarget(item, target)));
    setSelected(next);
    onRequestCalculation?.(target, garantie.id, next);
  };

  const togglePersonne = (garantie: ReferenceOption, checked: boolean) => {
    const formules = automaticPricing ? matchingPersonneFormules(formulesPersonne, garantie, target) : [];
    const baseSelection = checked ? withoutExclusionConflicts(selected, personneGaranties, target, garantie) : selected;
    const next = checked
        ? [
            ...baseSelection,
            {
              ...targetedInput(garantie, target),
              modeSelectionne: "PROTECTION",
              sourceValeurSelectionnee: "AUCUNE",
              formuleGarantiePersonneId: formules[0]?.id,
              formule: String(formules[0]?.libelle ?? garantie.code ?? garantie.libelle),
              prime: numberValue(String(formules[0]?.primeNette ?? "")),
            },
          ]
        : selected.filter((item) => !(item.garantieId === garantie.id && sameTarget(item, target)));
    setSelected(next);
    onRequestCalculation?.(target, garantie.id, next);
  };

  const usage = target.kind === "vehicule" ? usages.find((item) => item.id === target.usageId) : undefined;
  const configuredGaranties = automaticPricing
    ? garanties.filter((garantie) => Boolean(garantie.responsabiliteCivile) || matchingLines(lignes, garantie, target).length > 0)
    : garanties;
  const configuredPersonneGaranties = automaticPricing
    ? personneGaranties.filter((garantie) => matchingPersonneFormules(formulesPersonne, garantie, target).length > 0)
    : layout === "particulier" || primeInputEnabled ? personneGaranties : [];
  const showPersonne = target.kind === "vehicule" && Boolean(usage?.garantiesPersonne) && configuredPersonneGaranties.length > 0;

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-md border">
        <div className="border-b px-3 py-2 text-sm font-semibold">
          {target.kind === "vehicule" ? "Garanties véhicule" : "Garanties remorque"}
        </div>
        <table className="w-full min-w-[720px] table-fixed border-collapse text-xs [&_input]:h-8 [&_input]:px-2 [&_input]:text-xs [&_[data-slot=select-trigger]]:h-8 [&_[data-slot=select-trigger]]:px-2 [&_[data-slot=select-trigger]]:text-xs xl:min-w-[860px] xl:text-sm xl:[&_input]:h-9 xl:[&_input]:px-3 xl:[&_input]:text-sm xl:[&_[data-slot=select-trigger]]:h-9 xl:[&_[data-slot=select-trigger]]:px-3 xl:[&_[data-slot=select-trigger]]:text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-3 text-left" />
              <th className="w-16 px-2 py-3 text-left xl:w-auto"><span className="xl:hidden">Code</span><span className="hidden xl:inline">Garantie</span></th>
              <th className="w-44 px-2 py-3 text-left">{layout === "particulier" ? "Valeur assurée" : "Capital / valeur"}</th>
              {layout === "tariff" ? <th className="w-20 px-2 py-3 text-left xl:w-36">Taux (%)</th> : null}
              {layout === "particulier" ? (
                <>
                  <th className="w-40 px-3 py-3 text-left">Taux franchise (%)</th>
                  <th className="w-44 px-3 py-3 text-left">Min franchise</th>
                </>
              ) : (
                <th className="w-28 px-2 py-3 text-right xl:w-56">Franchise</th>
              )}
              {layout === "tariff" ? <th className="w-24 px-2 py-3 text-right xl:w-40">{primeColumnLabel}</th> : null}
            </tr>
          </thead>
          <tbody>
            {configuredGaranties.map((garantie) => {
              const item = selected.find((selectedItem) => selectedItem.garantieId === garantie.id && sameTarget(selectedItem, target));
              const checked = Boolean(item);
              const isRc = Boolean(garantie.responsabiliteCivile);
              const lineOptions = automaticPricing ? matchingLines(lignes, garantie, target) : [];
              const selectedLine = selectedLineFor(lineOptions, item);
              const hasLine = isRc || lineOptions.length > 0;
              const disabled = isRc || (automaticPricing && (!grilleSelected || !hasLine));
              const editable = checked && !isRc;
              const warning = checked ? valueWarning(garantie, target, selectedLine) : "";
              const sourceOptions = target.kind === "vehicule" ? selectableTargetValueSources(garantie, target, selectedLine) : [];
              const selectedSource = target.kind === "vehicule" ? selectedTargetValueSource(garantie, item, target, selectedLine) : "";
              const manualValue = selectedSource === "MANUEL" && lineMode(selectedLine) !== "CAPITAL";
              const displayCapital = targetGuaranteeCapitalValue(garantie, selectedLine, target, item);
              const previewLine = previewGuaranteeLine(preview, garantie, target, item);
              const calculatedPrime = previewLine?.primeNette;
              const rowCalculating = checked && Boolean(previewing) && Boolean(dirtyCalculationKeys?.includes(guaranteeCalculationKey(target, garantie.id)));

              return (
                <tr
                  key={garantie.id}
                  className={cn(
                    "border-t align-middle transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20",
                    !checked && "bg-muted/20 text-muted-foreground",
                    checked && "bg-background",
                    isRc && "bg-amber-50/50 dark:bg-amber-950/20"
                  )}
                >
                  <td className="px-2 py-2">
                    <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => toggle(garantie, Boolean(value))} />
                  </td>
                  <td className="min-w-0 px-2 py-2">
                    <div className="font-medium">
                      <span className="xl:hidden">{garantie.code || garantie.libelle}</span>
                      <span className="hidden xl:inline">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</span>
                    </div>
                    {warning ? <div className="mt-1 text-xs text-destructive">{warning}</div> : null}
                  </td>
                  <GuaranteeTableCell>
                    {manualValue && !isRc ? (
                      <div className="grid gap-1">
                        {sourceOptions.length > 1 ? (
                          <Select
                            value={selectedSource}
                            disabled={!editable}
                            onValueChange={(value) => update(garantie.id, {
                              sourceValeurSelectionnee: value,
                              valeurAssuree: undefined,
                              capital: undefined,
                            })}
                          >
                            <SelectTrigger className={cn(controlClass(editable), "[&>span]:w-full [&>span]:text-right")}>
                              <SelectValue placeholder="Source" />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceOptions.map((source) => (
                                <SelectItem key={source} value={source}>{targetSourceOptionLabel(source, target)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <MoneyInput
                          disabled={!editable}
                          className={cn(controlClass(editable), "text-right")}
                          value={item?.valeurAssuree ?? item?.capital}
                          onValueChange={(value) => update(garantie.id, { sourceValeurSelectionnee: "MANUEL", valeurAssuree: value, capital: value })}
                        />
                      </div>
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
                          if (value !== "MANUEL" && !hasTargetValue(target, value)) {
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
                  </GuaranteeTableCell>
                  {layout === "tariff" ? <GuaranteeTableCell>
                    {!automaticPricing && !isRc ? (
                      <Input
                        type="number"
                        disabled={!editable}
                        className={cn(controlClass(editable), "text-right")}
                        value={item?.taux ?? ""}
                        onChange={(event) => update(garantie.id, { taux: numberValue(event.target.value) })}
                      />
                    ) : !isRc && lineOptions.length > 1 ? (
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
                  </GuaranteeTableCell> : null}
                  {layout === "particulier" ? (
                    <>
                      <GuaranteeTableCell>
                        <Input
                          type="number"
                          disabled={!editable || !garantie.avecFranchise}
                          className={cn(controlClass(editable && Boolean(garantie.avecFranchise)), "text-right")}
                          value={garantie.avecFranchise ? item?.tauxFranchise ?? "" : ""}
                          onChange={(event) => update(garantie.id, { tauxFranchise: numberValue(event.target.value) })}
                        />
                      </GuaranteeTableCell>
                      <GuaranteeTableCell>
                        <MoneyInput
                          disabled={!editable || !garantie.avecFranchiseMinimale}
                          className={cn(controlClass(editable && Boolean(garantie.avecFranchiseMinimale)), "text-right")}
                          value={garantie.avecFranchiseMinimale ? item?.franchiseMinimale : undefined}
                          onValueChange={(value) => update(garantie.id, { franchiseMinimale: value })}
                        />
                      </GuaranteeTableCell>
                    </>
                  ) : <GuaranteeTableCell className="text-right text-muted-foreground">
                    {!automaticPricing && !isRc ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          disabled={!editable || !garantie.avecFranchise}
                          className={cn(controlClass(editable && Boolean(garantie.avecFranchise)), "text-right")}
                          value={item?.tauxFranchise ?? ""}
                          onChange={(event) => update(garantie.id, { tauxFranchise: numberValue(event.target.value) })}
                        />
                        <MoneyInput
                          disabled={!editable || !garantie.avecFranchiseMinimale}
                          className={cn(controlClass(editable && Boolean(garantie.avecFranchiseMinimale)), "text-right")}
                          value={garantie.avecFranchiseMinimale ? item?.franchiseMinimale : undefined}
                          onValueChange={(value) => update(garantie.id, { franchiseMinimale: value })}
                        />
                      </div>
                    ) : franchiseDisplay(
                      selectedLine,
                      Boolean(garantie.avecFranchise),
                      Boolean(garantie.avecFranchiseMinimale)
                    )}
                  </GuaranteeTableCell>}
                  {layout === "tariff" ? <GuaranteeTableCell className="text-right font-medium">
                    {primeInputEnabled && !isRc ? (
                      <MoneyInput
                        disabled={!editable}
                        className={cn(controlClass(editable), "text-right")}
                        value={item?.prime}
                        onValueChange={(value) => update(garantie.id, { prime: value })}
                      />
                    ) : checked || previewLine ? <CalculationValue value={calculatedPrime} loading={rowCalculating} /> : "-"}
                  </GuaranteeTableCell> : null}
                </tr>
              );
            })}
            {configuredGaranties.length === 0 ? (
              <tr>
                <td colSpan={layout === "particulier" ? 5 : 6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucune garantie véhicule configurée pour cet usage.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showPersonne ? (
        <div className="overflow-hidden rounded-md border xl:overflow-x-auto">
          <div className="border-b px-3 py-2 text-sm font-semibold">Garanties personne</div>
          <table className="block w-full border-collapse text-sm xl:table xl:min-w-[1080px] 2xl:min-w-[1320px]">
            <thead className="hidden bg-muted/60 text-xs uppercase text-muted-foreground xl:table-header-group">
              <tr>
                <th className="w-12 px-3 py-3 text-left" />
                <th className="px-3 py-3 text-left">Garantie</th>
                {layout === "tariff" ? <th className="w-56 px-3 py-3 text-left">Formule</th> : null}
                <th className="w-32 px-3 py-3 text-left">Décès</th>
                <th className="w-32 px-3 py-3 text-left">Invalidité</th>
                <th className="w-32 px-3 py-3 text-left">Frais médicaux</th>
                <th className="w-40 px-3 py-3 text-left">Hospitalisation</th>
                <th className="w-40 px-3 py-3 text-left">Frais funéraires</th>
                <th className="w-48 px-3 py-3 text-left">Chirurgie</th>
                {layout === "tariff" ? <th className="w-32 px-3 py-3 text-right">{primeColumnLabel}</th> : null}
              </tr>
            </thead>
            <tbody className="block xl:table-row-group">
              {configuredPersonneGaranties.map((garantie) => {
                const item = selected.find((selectedItem) => selectedItem.garantieId === garantie.id && sameTarget(selectedItem, target));
                const checked = Boolean(item);
                const formules = automaticPricing ? matchingPersonneFormules(formulesPersonne, garantie, target) : [];
                const selectedFormule = formules.find((formule) => formule.id === item?.formuleGarantiePersonneId) ?? formules[0];
                const disabled = automaticPricing && (!grilleSelected || formules.length === 0);
                const previewLine = previewGuaranteeLine(preview, garantie, target, item);
                const calculatedPrime = previewLine?.primeNette;
                const rowCalculating = checked && Boolean(previewing) && Boolean(dirtyCalculationKeys?.includes(guaranteeCalculationKey(target, garantie.id)));

                return (
                  <tr
                    key={garantie.id}
                    className={cn(
                      "grid w-full grid-cols-[2.5rem_minmax(0,1fr)] border-t align-middle transition-colors xl:table-row",
                      !checked && "bg-muted/20 text-muted-foreground",
                      checked && "bg-background"
                    )}
                  >
                    <td className="col-start-1 row-start-1 px-3 py-3 xl:table-cell xl:py-2">
                      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => togglePersonne(garantie, Boolean(value))} />
                    </td>
                    <td className="col-start-2 row-start-1 min-w-0 px-2 py-3 xl:table-cell xl:px-3 xl:py-2">
                      <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                    </td>
                    {layout === "tariff" ? <ResponsiveRecordCell label="Formule">
                      {automaticPricing ? (
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
                      ) : (
                        <Input
                          disabled={!checked}
                          className={controlClass(checked)}
                          value={item?.formule ?? ""}
                          onChange={(event) => update(garantie.id, { formule: event.target.value })}
                        />
                      )}
                    </ResponsiveRecordCell> : null}
                    <ResponsiveRecordCell label="Décès">{automaticPricing ? money(selectedFormule?.montantDeces) : <MoneyInput disabled={!checked} className={controlClass(checked)} value={item?.montantDeces} onValueChange={(value) => update(garantie.id, { montantDeces: value })} />}</ResponsiveRecordCell>
                    <ResponsiveRecordCell label="Invalidité">{automaticPricing ? money(selectedFormule?.montantInvalidite) : <MoneyInput disabled={!checked} className={controlClass(checked)} value={item?.montantInvalidite} onValueChange={(value) => update(garantie.id, { montantInvalidite: value })} />}</ResponsiveRecordCell>
                    <ResponsiveRecordCell label="Frais médicaux">{automaticPricing ? money(selectedFormule?.montantFraisMedicaux) : <MoneyInput disabled={!checked} className={controlClass(checked)} value={item?.montantFraisMedicaux} onValueChange={(value) => update(garantie.id, { montantFraisMedicaux: value })} />}</ResponsiveRecordCell>
                    <ResponsiveRecordCell label="Hospitalisation">{automaticPricing ? money(selectedFormule?.montantFraisHospitalisation) : <MoneyInput disabled={!checked} className={controlClass(checked)} value={item?.montantFraisHospitalisation} onValueChange={(value) => update(garantie.id, { montantFraisHospitalisation: value })} />}</ResponsiveRecordCell>
                    <ResponsiveRecordCell label="Frais funéraires">{automaticPricing ? money(selectedFormule?.montantFraisFuneraires) : <MoneyInput disabled={!checked} className={controlClass(checked)} value={item?.montantFraisFuneraires} onValueChange={(value) => update(garantie.id, { montantFraisFuneraires: value })} />}</ResponsiveRecordCell>
                    <ResponsiveRecordCell label="Chirurgie">{automaticPricing ? money(selectedFormule?.montantFraisChirurgie) : <MoneyInput disabled={!checked} className={controlClass(checked)} value={item?.montantFraisChirurgie} onValueChange={(value) => update(garantie.id, { montantFraisChirurgie: value })} />}</ResponsiveRecordCell>
                    {layout === "tariff" ? <ResponsiveRecordCell label={primeColumnLabel} valueClassName="text-right">
                      {primeInputEnabled ? (
                        <MoneyInput disabled={!checked} className={controlClass(checked)} value={item?.prime} onValueChange={(value) => update(garantie.id, { prime: value })} />
                      ) : checked || previewLine ? <CalculationValue value={calculatedPrime} loading={rowCalculating} /> : "-"}
                    </ResponsiveRecordCell> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {showAssistance && target.kind === "vehicule" ? (
        <TargetAssistanceTable
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

function targetedInput(garantie: ReferenceOption, target: Target): GarantieInput {
  return targetedGuaranteeInput(garantie, target, defaultTargetSource(garantie, target));
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

function targetLineSelectionPatch(garantie: ReferenceOption, line: ReferenceOption | undefined, target?: Target, pricingMode: PricingMode = "AUTOMATIQUE_GRILLE"): Partial<GarantieInput> {
  const manualPricing = pricingMode !== "AUTOMATIQUE_GRILLE";
  const mode = lineMode(line) || String(garantie.modeParDefaut ?? "TAUX");
  const source = mode === "CAPITAL"
    ? "AUCUNE"
    : target ? defaultTargetSource(garantie, target, line) : defaultSource(garantie);
  return {
    ligneGrilleTarifaireId: manualPricing ? undefined : line?.id,
    modeSelectionne: mode,
    sourceValeurSelectionnee: source,
    valeurAssuree: undefined,
    capital: undefined,
    taux: manualPricing ? undefined : toNumber(line?.taux),
    prime: manualPricing ? undefined : toNumber(line?.prime),
    tauxFranchise: manualPricing || !garantie.avecFranchise ? undefined : toNumber(line?.tauxFranchise),
    franchiseMinimale: manualPricing || !garantie.avecFranchiseMinimale ? undefined : toNumber(line?.franchiseMinimale),
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

function franchiseDisplay(line?: ReferenceOption, avecFranchise = true, avecFranchiseMinimale = true) {
  const tauxFranchise = avecFranchise ? toNumber(line?.tauxFranchise) : undefined;
  const franchiseMinimale = avecFranchiseMinimale ? toNumber(line?.franchiseMinimale) : undefined;
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
      if (manualTargetValueAllowed(garantie)) {
        return "";
      }
      return `${allowedSources.map(sourceLabel).join(" ou ")} requise`;
    }
    const source = configuredDefaultVehicleValueSource(garantie) || allowedSources[0];
    if (source && !hasTargetValue(target, source) && manualTargetValueAllowed(garantie)) {
      return "";
    }
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

function selectableTargetValueSources(garantie: ReferenceOption, target: Target, line?: ReferenceOption) {
  const sources = availableTargetValueSources(garantie, target, line);
  if (lineMode(line) !== "CAPITAL" && manualTargetValueAllowed(garantie)) {
    sources.push("MANUEL");
  }
  return sources;
}

function selectedTargetValueSource(garantie: ReferenceOption, item: GarantieInput | undefined, target: Target, line?: ReferenceOption) {
  if (lineMode(line) === "CAPITAL") {
    return "AUCUNE";
  }
  const selected = String(item?.sourceValeurSelectionnee ?? "").toUpperCase();
  if (selected === "MANUEL" && manualTargetValueAllowed(garantie)) {
    return selected;
  }
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
  if (manualTargetValueAllowed(garantie)) {
    return "MANUEL";
  }
  const source = configuredDefaultVehicleValueSource(garantie) || (allowedVehicleValueSources(garantie).length === 1 ? allowedVehicleValueSources(garantie)[0] : "");
  return source || (allowedVehicleValueSources(garantie).length > 0 ? allowedVehicleValueSources(garantie)[0] : defaultSource(garantie));
}

function manualTargetValueAllowed(garantie: ReferenceOption) {
  return Boolean(garantie.saisieManuelleAutorisee);
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
  if (source === "MANUEL") {
    return "Saisie manuelle";
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

function controlClass(active: boolean) {
  return active
    ? "border-slate-300 bg-slate-50/70 shadow-none focus-visible:border-ring focus-visible:ring-ring/50 dark:border-slate-700 dark:bg-input/30"
    : "border-transparent bg-muted/40 text-muted-foreground shadow-none";
}
