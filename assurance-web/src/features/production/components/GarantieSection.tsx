import { useEffect } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { EcheanceInput } from "@/components/ui/echeance-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { MoneyInput } from "./MoneyInput";
import { SectionCard } from "./SectionCard";
import { productionApi } from "../api";
import { resolveAssistanceTariffAmount } from "../assistance-pricing";
import { computeAssistanceQuarterCount, computeDateEcheanceFromCode, toDateOnly } from "../date";
import { formatMoney, money, moneyAmount, numberValue, roundMoney } from "../utils/format";
import { validateValeurVenale } from "../utils/vehicle-validation";
import type { AssistanceDraft, GarantieInput, QuittancePreview, ReferenceOption, VehiculeInput } from "../types";
import type { ContratSectionKey } from "../contrat-creation/useContratCreationForm";

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

function GuaranteeTableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={cn("px-2 py-2", className)}>{children}</td>;
}

export function GarantieSection({
  garanties,
  selected,
  setSelected,
  lignes,
  formulesPersonne = [],
  vehicules = [],
  usages = [],
  vehiculeCount,
  showLigneGrille = true,
  automaticPricing = false,
  allowPrimeColumn = false,
  primeColumnEnabled = false,
  showRateColumn = true,
  setPrimeColumnEnabled,
  preview,
  previewing = false,
  showTotalsSummary = false,
  assistanceEnabled = false,
  setAssistanceEnabled,
  showAssistanceRow = false,
  assistanceDraft,
  setAssistanceDraft,
  compagniesAssistance = [],
  produitsAssistance = [],
  assistanceUsageId,
  assistanceCategorieClientId,
  extraAction,
  onSaveSection,
  savedSections = {},
  saving = false,
  openSection,
  onSectionOpenChange,
}: {
  garanties: ReferenceOption[];
  selected: GarantieInput[];
  setSelected: (value: GarantieInput[]) => void;
  lignes: ReferenceOption[];
  formulesPersonne?: ReferenceOption[];
  vehicules?: VehiculeInput[];
  usages?: ReferenceOption[];
  vehiculeCount: number;
  showLigneGrille?: boolean;
  automaticPricing?: boolean;
  allowPrimeColumn?: boolean;
  primeColumnEnabled?: boolean;
  showRateColumn?: boolean;
  setPrimeColumnEnabled?: (value: boolean) => void;
  preview?: QuittancePreview | null;
  previewing?: boolean;
  showTotalsSummary?: boolean;
  assistanceEnabled?: boolean;
  setAssistanceEnabled?: (value: boolean) => void;
  showAssistanceRow?: boolean;
  assistanceDraft?: AssistanceDraft;
  setAssistanceDraft?: (value: AssistanceDraft) => void;
  compagniesAssistance?: ReferenceOption[];
  produitsAssistance?: ReferenceOption[];
  assistanceUsageId?: string;
  assistanceCategorieClientId?: string;
  extraAction?: ReactNode;
  onSaveSection?: (section: "garanties") => void;
  savedSections?: Partial<Record<"garanties", boolean>>;
  saving?: boolean;
  openSection?: ContratSectionKey;
  onSectionOpenChange?: (section: ContratSectionKey, open: boolean) => void;
}) {
  const byId = new Map(selected.map((item) => [item.garantieId, item]));
  const vehiculeGaranties = garanties
    .filter((garantie) => String(garantie.typeGarantie ?? "VEHICULE") !== "PERSONNE")
    .filter((garantie) => !automaticPricing || Boolean(garantie.responsabiliteCivile) || linesForGuarantee(lignes, garantie).length > 0);
  const personneGaranties = garanties
    .filter((garantie) => String(garantie.typeGarantie ?? "VEHICULE") === "PERSONNE")
    .filter((garantie) => !automaticPricing || formulesForGuarantee(formulesPersonne, garantie).length > 0);
  const showAssistanceTotal = assistanceEnabled || Boolean(assistanceDraft?.enabled) || linePrimeNette(preview, "ASSISTANCE") != null;
  const update = (garantieId: string, patch: Partial<GarantieInput>) => {
    setSelected(selected.map((item) => (item.garantieId === garantieId ? { ...item, ...patch } : item)));
  };

  const toggle = (garantie: ReferenceOption, checked: boolean) => {
    const type = String(garantie.typeGarantie ?? "VEHICULE");
    const isRc = Boolean(garantie.responsabiliteCivile);
    if (isRc) {
      return;
    }
    if (checked) {
      const formules = type === "PERSONNE" ? formulesForGuarantee(formulesPersonne, garantie) : [];
      const formule = formules[0];
      const line = type === "VEHICULE" ? linesForGuarantee(lignes, garantie)[0] : undefined;
      const selectedVehicle = type === "VEHICULE" ? vehicules[0] : undefined;
      const warning = type === "VEHICULE" ? requiredVehicleValueWarning(garantie, selectedVehicle, line) : "";
      if (warning) {
        toast.error(warning);
        return;
      }
      const linePatch = lineSelectionPatch(garantie, line);
      setSelected([
        ...selected,
        {
          garantieId: garantie.id,
          vehiculeIndex: type === "VEHICULE" && vehiculeCount > 0 ? 0 : undefined,
          modeSelectionne: String(linePatch.modeSelectionne ?? garantie.modeParDefaut ?? (type === "PERSONNE" ? "PROTECTION" : "TAUX")),
          ...linePatch,
          sourceValeurSelectionnee: type === "VEHICULE"
            ? initialVehicleValueSource(garantie, selectedVehicle, line)
            : defaultSource(garantie),
          formuleGarantiePersonneId: formule?.id,
          formule: formule ? String(formule.libelle ?? garantie.code ?? garantie.libelle) : undefined,
          prime: formule ? numberValue(String(formule.primeNette ?? "")) : undefined,
        },
      ]);
      return;
    }
    setSelected(selected.filter((item) => item.garantieId !== garantie.id));
  };

  return (
    <SectionCard
      title="Garanties"
      badge={savedSections.garanties ? "Validé" : `${selected.length} sélectionnée${selected.length > 1 ? "s" : ""}`}
      tone="production"
      open={openSection === "garanties"}
      onOpenChange={(open) => onSectionOpenChange?.("garanties", open)}
      action={extraAction}
    >
      {allowPrimeColumn ? (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Switch checked={primeColumnEnabled} onCheckedChange={(value) => setPrimeColumnEnabled?.(value)} />
          <span>Saisie avec primes</span>
        </div>
      ) : null}
      <div className="mb-2 text-sm font-semibold">Garanties véhicule</div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-xs xl:min-w-[980px] xl:text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-3 text-left"></th>
              <th className="w-16 px-2 py-3 text-left xl:w-auto"><span className="xl:hidden">Code</span><span className="hidden xl:inline">Garantie</span></th>
              {vehiculeCount > 1 ? <th className="w-40 px-3 py-3 text-left">Véhicule</th> : null}
              <th className="w-44 px-2 py-3 text-left xl:w-48">Valeur assurée</th>
              {showRateColumn ? <th className="w-20 px-2 py-3 text-left xl:w-36">Taux (%)</th> : null}
              {automaticPricing ? (
                <>
                  <th className="w-28 px-2 py-3 text-left xl:w-56">Franchise</th>
                  <th className="w-24 px-2 py-3 text-right xl:w-40">Prime annuelle</th>
                </>
              ) : (
                <>
                  <th className="w-40 px-3 py-3 text-left">Taux franchise (%)</th>
                  <th className="w-40 px-3 py-3 text-left">Min franchise</th>
                </>
              )}
              {showLigneGrille ? <th className="w-56 px-3 py-3 text-left">Ligne grille</th> : null}
              {automaticPricing || primeColumnEnabled ? <th className="w-24 px-2 py-3 text-right xl:w-40">Prime nette</th> : null}
            </tr>
          </thead>
          <tbody>
            {vehiculeGaranties.map((garantie) => {
              const item = byId.get(garantie.id);
              const isRc = Boolean(garantie.responsabiliteCivile);
              const checked = Boolean(item) || isRc;
              const rowDisabled = !checked;
              const locked = isRc;
              const hasLine = !automaticPricing || isRc || linesForGuarantee(lignes, garantie).length > 0;
              const editable = checked && !locked;
              const isVehicleGuarantee = String(garantie.typeGarantie ?? "VEHICULE") === "VEHICULE";
              const lineOptions = linesForGuarantee(lignes, garantie);
              const selectedLine = selectedLineFor(lineOptions, item);
              const selectedVehicle = vehicules[item?.vehiculeIndex ?? 0] ?? vehicules[0];
              const selectedSource = selectedValueSource(garantie, item, selectedLine, selectedVehicle);
              const sourceOptions = availableVehicleValueSources(garantie, selectedVehicle, selectedLine);
              const manualPricingSourceOptions = selectableManualValueSources(garantie, selectedVehicle, selectedLine);
              const manualValue = selectedSource === "MANUEL";
              const manualCapital = canEnterManualCapital(garantie, item, selectedLine);
              const displayCapital = guaranteeCapitalValue(garantie, selectedLine, selectedVehicle, item);
              const estimatedPrime = automaticPricing && checked && !isRc ? estimatePrime(selectedLine, displayCapital) : undefined;
              const previewLine = automaticPricing && checked
                ? guaranteePreviewLine(preview, garantie.id, item?.vehiculeIndex ?? 0)
                : undefined;
              const annualPrime = previewLine?.primeAnnuelle ?? estimatedPrime;
              const netPrime = previewLine?.primeNette;

              return (
                <tr
                  key={garantie.id}
                  className={cn(
                    "border-t align-middle transition-colors",
                    rowDisabled && "bg-muted/20 text-muted-foreground",
                    editable && "bg-background",
                    locked && "bg-amber-50/50 dark:bg-amber-950/20"
                  )}
                >
                  <td className="px-2 py-2">
                    <Checkbox checked={checked} disabled={isRc || !hasLine} onCheckedChange={(value) => toggle(garantie, Boolean(value))} />
                  </td>
                  <td className="min-w-0 px-2 py-2">
                    <div className="font-medium">
                      <span className="xl:hidden">{garantie.code || garantie.libelle}</span>
                      <span className="hidden xl:inline">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {automaticPricing && !isRc && !hasLine ? <Badge variant="outline">Tarif manquant</Badge> : null}
                    </div>
                  </td>
                  {vehiculeCount > 1 ? (
                    <GuaranteeTableCell>
                      {isVehicleGuarantee && !isRc ? (
                        <Select
                          value={String(item?.vehiculeIndex ?? 0)}
                          disabled={rowDisabled}
                          onValueChange={(value) => {
                            const nextVehicle = vehicules[Number(value)];
                            const warning = requiredVehicleValueWarning(garantie, nextVehicle, selectedLine);
                            if (warning) {
                              toast.error(warning);
                              return;
                            }
                            update(garantie.id, {
                              vehiculeIndex: Number(value),
                              sourceValeurSelectionnee: initialVehicleValueSource(garantie, nextVehicle, selectedLine),
                              valeurAssuree: undefined,
                              capital: undefined,
                            });
                          }}
                        >
                          <SelectTrigger className={controlClass(editable)}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: vehiculeCount }).map((_, index) => <SelectItem key={index} value={String(index)}>Véhicule {index + 1}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">Global</span>
                      )}
                    </GuaranteeTableCell>
                  ) : null}
                  {automaticPricing ? (
                    <>
                      <GuaranteeTableCell>
                        {manualValue && !isRc ? (
                          <MoneyInput
                            disabled={!editable}
                            className={controlClass(editable)}
                            value={item?.valeurAssuree ?? item?.capital}
                            onValueChange={(value) => update(garantie.id, { valeurAssuree: value, capital: value })}
                          />
                        ) : sourceOptions.length > 1 && !isRc ? (
                          <Select
                            value={selectedSource}
                            disabled={!editable}
                            onValueChange={(value) => {
                              if (!hasVehicleValue(selectedVehicle, value)) {
                                toast.error(`Renseignez ${sourceLabel(value)} avant de sélectionner cette source.`);
                                return;
                              }
                              const patch: Partial<GarantieInput> = {
                                sourceValeurSelectionnee: value,
                                valeurAssuree: undefined,
                                capital: undefined,
                              };
                              update(garantie.id, patch);
                            }}
                          >
                            <SelectTrigger className={controlClass(editable)}><SelectValue placeholder="Source" /></SelectTrigger>
                            <SelectContent>
                              {sourceOptions.map((source) => (
                                <SelectItem key={source} value={source}>{sourceOptionLabel(source, selectedVehicle)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : sourceOptions.length === 1 && !isRc ? (
                          <Input readOnly disabled={rowDisabled} className={controlClass(editable)} value={sourceOptionLabel(sourceOptions[0], selectedVehicle)} />
                        ) : lineOptions.length > 1 && lineMode(selectedLine) === "CAPITAL" ? (
                          <Select
                            value={selectedLine?.id ?? ""}
                            disabled={!editable}
                            onValueChange={(value) => {
                              const line = lineOptions.find((option) => option.id === value);
                              update(garantie.id, {
                                ...lineSelectionPatch(garantie, line),
                                sourceValeurSelectionnee: initialVehicleValueSource(garantie, selectedVehicle, line),
                              });
                            }}
                          >
                            <SelectTrigger className={controlClass(editable)}><SelectValue placeholder="Formule" /></SelectTrigger>
                            <SelectContent>
                              {lineOptions.map((line) => <SelectItem key={line.id} value={line.id}>{capitalLineLabel(line)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input readOnly disabled={rowDisabled} className={controlClass(editable)} value={isRc ? money(resolveRcCapital(selectedVehicle, usages)) : capitalDisplay(garantie, selectedLine, selectedVehicle, displayCapital, item)} />
                        )}
                      </GuaranteeTableCell>
                      <GuaranteeTableCell>
                        {!isRc && lineOptions.length > 1 ? (
                          <Select
                            value={selectedLine?.id ?? ""}
                            disabled={!editable}
                            onValueChange={(value) => {
                              const line = lineOptions.find((option) => option.id === value);
                              update(garantie.id, {
                                ...lineSelectionPatch(garantie, line),
                                sourceValeurSelectionnee: initialVehicleValueSource(garantie, selectedVehicle, line),
                              });
                            }}
                          >
                            <SelectTrigger className={controlClass(editable)}><SelectValue placeholder="Option" /></SelectTrigger>
                            <SelectContent>
                              {lineOptions.map((line, index) => <SelectItem key={line.id} value={line.id}>{tariffLineLabel(line, index)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn("block rounded-md px-3 py-2 text-right", rowDisabled ? "text-muted-foreground" : "")}>
                            {isRc ? "-" : rateDisplay(selectedLine)}
                          </span>
                        )}
                      </GuaranteeTableCell>
                      <GuaranteeTableCell className="text-right text-muted-foreground">
                        {franchiseDisplay(
                          selectedLine,
                          Boolean(garantie.avecFranchise),
                          Boolean(garantie.avecFranchiseMinimale)
                        )}
                      </GuaranteeTableCell>
                      <GuaranteeTableCell className="text-right text-muted-foreground">{checked ? autoPrimeDisplay(annualPrime) : "-"}</GuaranteeTableCell>
                      <GuaranteeTableCell className="text-right font-medium">{checked ? autoPrimeDisplay(netPrime) : "-"}</GuaranteeTableCell>
                    </>
                  ) : (
                    <>
                      <GuaranteeTableCell>
                        {isRc ? (
                          <Input
                            readOnly
                            disabled={rowDisabled}
                            className={controlClass(checked)}
                            value={money(resolveRcCapital(selectedVehicle, usages))}
                          />
                        ) : manualValue && manualPricingSourceOptions.length > 1 ? (
                          <div className="grid gap-1">
                            <Select
                              value={selectedSource}
                              disabled={!editable}
                              onValueChange={(value) => update(garantie.id, {
                                sourceValeurSelectionnee: value,
                                valeurAssuree: undefined,
                                capital: undefined,
                              })}
                            >
                              <SelectTrigger className={controlClass(editable)}>
                                <SelectValue placeholder="Source de la valeur" />
                              </SelectTrigger>
                              <SelectContent>
                                {manualPricingSourceOptions.map((source) => (
                                  <SelectItem key={source} value={source}>
                                    {sourceOptionLabel(source, selectedVehicle)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <MoneyInput
                              disabled={rowDisabled}
                              className={controlClass(editable)}
                              value={item?.valeurAssuree ?? item?.capital}
                              onValueChange={(value) => update(garantie.id, {
                                sourceValeurSelectionnee: "MANUEL",
                                valeurAssuree: value,
                                capital: value,
                              })}
                            />
                          </div>
                        ) : manualValue || (manualPricingSourceOptions.length === 0 && manualCapital) ? (
                          <MoneyInput
                            disabled={rowDisabled}
                            className={controlClass(editable)}
                            value={item?.valeurAssuree ?? item?.capital}
                            onValueChange={(value) => update(garantie.id, {
                              sourceValeurSelectionnee: manualValue ? "MANUEL" : item?.sourceValeurSelectionnee,
                              valeurAssuree: value,
                              capital: value,
                            })}
                          />
                        ) : manualPricingSourceOptions.length > 1 ? (
                          <Select
                            value={selectedSource}
                            disabled={!editable}
                            onValueChange={(value) => {
                              if (value !== "MANUEL" && !hasVehicleValue(selectedVehicle, value)) {
                                toast.error(`Renseignez ${sourceLabel(value)} avant de sélectionner cette source.`);
                                return;
                              }
                              update(garantie.id, {
                                sourceValeurSelectionnee: value,
                                valeurAssuree: undefined,
                                capital: undefined,
                              });
                            }}
                          >
                            <SelectTrigger className={controlClass(editable)}>
                              <SelectValue placeholder="Source de la valeur" />
                            </SelectTrigger>
                            <SelectContent>
                              {manualPricingSourceOptions.map((source) => (
                                <SelectItem key={source} value={source}>
                                  {sourceOptionLabel(source, selectedVehicle)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : manualPricingSourceOptions.length === 1 ? (
                          <Input
                            readOnly
                            disabled={rowDisabled}
                            className={controlClass(editable)}
                            value={sourceOptionLabel(manualPricingSourceOptions[0], selectedVehicle)}
                          />
                        ) : (
                          <Input
                            readOnly
                            disabled
                            className={controlClass(false)}
                            value=""
                          />
                        )}
                      </GuaranteeTableCell>
                      {showRateColumn ? (
                        <GuaranteeTableCell>
                          <Input type="number" disabled={rowDisabled || isRc} className={controlClass(editable)} value={item?.taux ?? ""} onChange={(event) => update(garantie.id, { taux: numberValue(event.target.value) })} />
                        </GuaranteeTableCell>
                      ) : null}
                      <GuaranteeTableCell>
                        <Input type="number" disabled={rowDisabled || isRc || !garantie.avecFranchise} className={controlClass(editable && Boolean(garantie.avecFranchise))} value={item?.tauxFranchise ?? ""} onChange={(event) => update(garantie.id, { tauxFranchise: numberValue(event.target.value) })} />
                      </GuaranteeTableCell>
                      <GuaranteeTableCell>
                        <MoneyInput
                          disabled={rowDisabled || isRc || !garantie.avecFranchiseMinimale}
                          className={controlClass(editable && Boolean(garantie.avecFranchiseMinimale))}
                          value={garantie.avecFranchiseMinimale ? item?.franchiseMinimale : undefined}
                          onValueChange={(value) => update(garantie.id, { franchiseMinimale: value })}
                        />
                      </GuaranteeTableCell>
                    </>
                  )}
                  {!automaticPricing && showLigneGrille ? (
                    <GuaranteeTableCell>
                      {!isRc ? (
                        <Select
                          value={item?.ligneGrilleTarifaireId ?? ""}
                          disabled={rowDisabled}
                          onValueChange={(value) => {
                            const line = lineOptions.find((option) => option.id === value);
                            update(garantie.id, {
                              ...lineSelectionPatch(garantie, line),
                              sourceValeurSelectionnee: initialVehicleValueSource(garantie, selectedVehicle, line),
                            });
                          }}
                        >
                          <SelectTrigger className={controlClass(editable)}><SelectValue placeholder="Option" /></SelectTrigger>
                          <SelectContent>
                            {lineOptions.map((ligne) => <SelectItem key={ligne.id} value={ligne.id}>{ligne.libelle}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">Calcul RC</span>
                      )}
                    </GuaranteeTableCell>
                  ) : null}
                  {!automaticPricing && primeColumnEnabled ? (
                    <GuaranteeTableCell>
                      <MoneyInput disabled={rowDisabled} className={controlClass(checked)} value={item?.prime} onValueChange={(value) => update(garantie.id, { prime: value })} />
                    </GuaranteeTableCell>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {personneGaranties.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Garanties personne</div>
          <div className="overflow-hidden rounded-md border xl:overflow-x-auto">
            <table className="block w-full border-collapse text-sm xl:table xl:min-w-[1120px]">
              <thead className="hidden bg-muted/60 text-xs uppercase text-muted-foreground xl:table-header-group">
                <tr>
                  <th className="w-12 px-3 py-3 text-left"></th>
                  <th className="px-3 py-3 text-left">Garantie</th>
                  {automaticPricing ? <th className="w-56 px-3 py-3 text-left">Formule</th> : null}
                  <th className="w-40 px-3 py-3 text-right">Décès</th>
                  <th className="w-40 px-3 py-3 text-right">Invalidité</th>
                  <th className="w-44 px-3 py-3 text-right">Frais médicaux</th>
                  <th className="w-48 px-3 py-3 text-right">Hospitalisation</th>
                  <th className="w-44 px-3 py-3 text-right">Frais funéraires</th>
                  <th className="w-56 px-3 py-3 text-right">Chirurgie réparatrice</th>
                  {automaticPricing || primeColumnEnabled ? <th className="w-40 px-3 py-3 text-left">Prime nette</th> : null}
                </tr>
              </thead>
              <tbody className="block xl:table-row-group">
                {personneGaranties.map((garantie) => {
                  const item = byId.get(garantie.id);
                  const checked = Boolean(item);
                  const rowDisabled = !checked;
                  const hasFormula = !automaticPricing || formulesForGuarantee(formulesPersonne, garantie).length > 0;
                  const formules = formulesForGuarantee(formulesPersonne, garantie);
                  const selectedFormule = formules.find((formule) => formule.id === item?.formuleGarantiePersonneId) ?? formules[0];

                  return (
                    <tr key={garantie.id} className={cn("grid w-full grid-cols-[2.5rem_minmax(0,1fr)] border-t align-middle transition-colors xl:table-row", rowDisabled || !hasFormula ? "bg-muted/20 text-muted-foreground" : "bg-background")}>
                      <td className="col-start-1 row-start-1 px-3 py-3 xl:table-cell xl:py-2">
                        <Checkbox checked={checked} disabled={!hasFormula} onCheckedChange={(value) => toggle(garantie, Boolean(value))} />
                      </td>
                      <td className="col-start-2 row-start-1 min-w-0 px-2 py-3 xl:table-cell xl:px-3 xl:py-2">
                        <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                        {automaticPricing && !hasFormula ? <Badge variant="outline">Formule manquante</Badge> : null}
                      </td>
                      {automaticPricing ? (
                        <ResponsiveRecordCell label="Formule">
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
                        </ResponsiveRecordCell>
                      ) : null}
                      <ResponsiveRecordCell label="Décès" valueClassName="text-right">{automaticPricing ? money(selectedFormule?.montantDeces) : <MoneyInput disabled={rowDisabled} className={controlClass(checked)} value={item?.montantDeces} onValueChange={(value) => update(garantie.id, { montantDeces: value })} />}</ResponsiveRecordCell>
                      <ResponsiveRecordCell label="Invalidité" valueClassName="text-right">{automaticPricing ? money(selectedFormule?.montantInvalidite) : <MoneyInput disabled={rowDisabled} className={controlClass(checked)} value={item?.montantInvalidite} onValueChange={(value) => update(garantie.id, { montantInvalidite: value })} />}</ResponsiveRecordCell>
                      <ResponsiveRecordCell label="Frais médicaux" valueClassName="text-right">{automaticPricing ? money(selectedFormule?.montantFraisMedicaux) : <MoneyInput disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisMedicaux} onValueChange={(value) => update(garantie.id, { montantFraisMedicaux: value })} />}</ResponsiveRecordCell>
                      <ResponsiveRecordCell label="Hospitalisation" valueClassName="text-right">{automaticPricing ? money(selectedFormule?.montantFraisHospitalisation) : <MoneyInput disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisHospitalisation} onValueChange={(value) => update(garantie.id, { montantFraisHospitalisation: value })} />}</ResponsiveRecordCell>
                      <ResponsiveRecordCell label="Frais funéraires" valueClassName="text-right">{automaticPricing ? money(selectedFormule?.montantFraisFuneraires) : <MoneyInput disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisFuneraires} onValueChange={(value) => update(garantie.id, { montantFraisFuneraires: value })} />}</ResponsiveRecordCell>
                      <ResponsiveRecordCell label="Chirurgie réparatrice" valueClassName="text-right">{automaticPricing ? money(selectedFormule?.montantFraisChirurgie) : <MoneyInput disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisChirurgie} onValueChange={(value) => update(garantie.id, { montantFraisChirurgie: value })} />}</ResponsiveRecordCell>
                      {automaticPricing ? (
                        <ResponsiveRecordCell label="Prime nette" valueClassName="text-right text-muted-foreground">{checked ? money(selectedFormule?.primeNette) : "-"}</ResponsiveRecordCell>
                      ) : primeColumnEnabled ? (
                        <ResponsiveRecordCell label="Prime nette">
                          <MoneyInput disabled={rowDisabled} className={controlClass(checked)} value={item?.prime} onValueChange={(value) => update(garantie.id, { prime: value })} />
                        </ResponsiveRecordCell>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {showAssistanceRow ? (
        assistanceDraft && setAssistanceDraft ? (
          <div className="mt-4">
            <AssistanceTable
              assistance={assistanceDraft}
              onChange={(patch) => {
                const next = { ...assistanceDraft, ...patch };
                setAssistanceDraft(next);
                if (patch.enabled !== undefined) {
                  setAssistanceEnabled?.(Boolean(patch.enabled));
                }
              }}
              compagniesAssistance={compagniesAssistance}
              produitsAssistance={produitsAssistance}
              usageId={assistanceUsageId}
              categorieClientId={assistanceCategorieClientId}
            />
          </div>
        ) : (
          <div className={cn("mt-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold", !assistanceEnabled && "bg-muted/20 text-muted-foreground")}>
            <Checkbox checked={assistanceEnabled} onCheckedChange={(checked) => setAssistanceEnabled?.(Boolean(checked))} />
            <span>ASSISTANCE</span>
          </div>
        )
      ) : null}
      {showTotalsSummary ? (
        <GuaranteeTotalsSummary
          preview={preview}
          loading={previewing}
          showAssistanceTotal={showAssistanceTotal}
        />
      ) : null}
      {onSaveSection ? (
        <div className="mt-4 flex justify-end border-t pt-3">
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={saving}
            onClick={() => onSaveSection("garanties")}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      ) : null}
    </SectionCard>
  );
}

function GuaranteeTotalsSummary({
  preview,
  loading,
  showAssistanceTotal,
}: {
  preview?: QuittancePreview | null;
  loading?: boolean;
  showAssistanceTotal?: boolean;
}) {
  const summary = vehicleSummary(preview);
  const rows: [string, number | undefined][] = [
    ["TOTAL NET", summary?.totalNet],
    ["EVCAT", summary?.evcat],
    ["TAXES", summary?.taxe],
    ["CNPAC", summary?.cnpac],
    ["TOTAL", summary?.totalAPayer],
  ];
  if (summary?.pta != null) {
    rows.splice(2, 0, ["PTA (Prime Personne)", summary.pta], ["ACCESSOIRE", summary.accessoire]);
  }
  if (showAssistanceTotal) {
    rows.push(["ASSISTANCE", linePrimeNette(preview, "ASSISTANCE")]);
  }

  return (
    <div className="mt-4 ml-auto w-full max-w-sm overflow-hidden rounded-md border">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[1fr_160px] border-b last:border-b-0">
          <div className="bg-muted/20 px-3 py-2 text-right text-xs font-semibold uppercase">{label}</div>
          <div className="px-3 py-2 text-right text-xs font-semibold">
            {loading ? "Calcul..." : value == null ? "-" : moneyAmount(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function vehicleSummary(preview: QuittancePreview | null | undefined) {
  const summary = preview?.targetSummaries?.find((item) => String(item.kind ?? "").toUpperCase() === "VEHICULE");
  if (!summary) {
    return undefined;
  }
  const pta = positiveOrDefined(summary.corporelPrimeNette);
  return {
    totalNet: summary.automobilePrimeNette,
    evcat: summary.evcatPrimeNette,
    pta,
    accessoire: pta == null ? undefined : summary.accessoire,
    taxe: addNumbers(summary.taxe, summary.taxeParafiscale),
    cnpac: summary.cnpac,
    totalAPayer: summary.primeTotale,
  };
}

function AssistanceTable({
  assistance,
  onChange,
  compagniesAssistance,
  produitsAssistance,
  usageId,
  categorieClientId,
}: {
  assistance: AssistanceDraft;
  onChange: (patch: Partial<AssistanceDraft>) => void;
  compagniesAssistance: ReferenceOption[];
  produitsAssistance: ReferenceOption[];
  usageId?: string;
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
    return usageIds.length === 0 || !usageId || usageIds.includes(usageId);
  });
  const selectedProduct = filteredProducts.find((produit) => produit.id === assistance.produitAssistanceId);
  const selectedProductId = selectedProduct?.id ?? "";
  const tarifsQuery = useQuery({
    queryKey: ["referentiel", "produits-assistance", selectedProductId, "tarifs"],
    queryFn: () => productionApi.listTarifsProduitAssistance(selectedProductId),
    enabled: assistance.enabled && Boolean(selectedProductId),
    staleTime: 60_000,
  });
  const prime = resolveAssistanceTariffAmount(selectedProduct, tarifsQuery.data, assistance.dateSouscription, "montantTtc");
  const trimestres = assistance.enabled ? computeAssistanceQuarterCount(assistance.dateEffet, assistance.dateEcheance) : undefined;
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
    <div className="overflow-hidden rounded-md border xl:overflow-x-auto">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
        <Checkbox checked={assistance.enabled} onCheckedChange={(checked) => onChange({ enabled: Boolean(checked) })} />
        <span>ASSISTANCE</span>
      </div>
      <table className="block w-full border-collapse text-sm xl:table xl:min-w-[1120px] xl:table-fixed">
        <colgroup className="hidden xl:table-column-group">
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[120px]" />
          <col className="w-[150px]" />
          <col className="w-[170px]" />
          <col className="w-[230px]" />
          <col className="w-[230px]" />
          <col className="w-[90px]" />
        </colgroup>
        <thead className="hidden bg-muted/60 text-xs uppercase text-muted-foreground xl:table-header-group">
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
        <tbody className="block xl:table-row-group">
          <tr className={cn("grid w-full grid-cols-2 border-t align-middle xl:table-row", !assistance.enabled && "bg-muted/20 text-muted-foreground")}>
            <ResponsiveRecordCell label="Date effet">
              <DatePicker disabled={!assistance.enabled} date={assistance.dateEffet} onSelect={(date) => updateDateEffet(toDateOnly(date))} />
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Date souscription">
              <DatePicker disabled={!assistance.enabled} date={assistance.dateSouscription} onSelect={(date) => onChange({ dateSouscription: toDateOnly(date) })} />
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Échéance">
              <EcheanceInput
                disabled={!assistance.enabled}
                value={assistance.echeanceCode ?? ""}
                onValueChange={updateEcheance}
              />
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Date échéance">
              <DatePicker disabled date={assistance.dateEcheance} onSelect={() => undefined} />
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="N° contrat">
              <Input
                disabled={!assistance.enabled}
                value={assistance.numeroContratOuQuittance ?? ""}
                placeholder="N° contrat"
                onChange={(event) => onChange({ numeroContratOuQuittance: event.target.value })}
              />
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Compagnie">
              <Select
                disabled={!assistance.enabled}
                value={assistance.compagnieAssistanceId ?? ""}
                onValueChange={(value) => onChange({ compagnieAssistanceId: value, produitAssistanceId: undefined })}
              >
              <SelectTrigger className="w-full"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {compagniesAssistance.map((compagnie) => (
                    <SelectItem key={compagnie.id} value={compagnie.id}>{compagnie.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Produit">
              <Select
                disabled={!assistance.enabled || filteredProducts.length === 0}
                value={selectedProductId}
                onValueChange={(value) => onChange({ produitAssistanceId: value })}
              >
              <SelectTrigger className="w-full"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {filteredProducts.map((produit) => (
                    <SelectItem key={produit.id} value={produit.id}>{produit.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Prime" valueClassName="text-right font-medium">
              {assistance.enabled && prime != null ? formatMoney(prime) : "-"}
            </ResponsiveRecordCell>
          </tr>
        </tbody>
      </table>
      {trimestres ? (
        <div className="border-t px-3 py-2 text-xs font-medium text-muted-foreground">
          Trimestres: {trimestres}/4
        </div>
      ) : null}
    </div>
  );
}

function linePrimeNette(preview: QuittancePreview | null | undefined, categorie: string) {
  return preview?.lignes.find((ligne) => ligne.categorie === categorie)?.primeNette;
}

function addNumbers(left?: number, right?: number) {
  if (left == null && right == null) {
    return undefined;
  }
  return roundMoney((left ?? 0) + (right ?? 0));
}

function positiveOrDefined(value?: number) {
  return value != null && value > 0 ? value : undefined;
}

function autoPrimeDisplay(value?: number) {
  return value == null ? "Calcul auto" : moneyAmount(value);
}

function guaranteePreviewLine(
  preview: QuittancePreview | null | undefined,
  garantieId: string,
  vehiculeIndex: number
) {
  return preview?.garanties?.find((line) =>
    String(line.garantieId ?? "") === String(garantieId)
      && (line.vehiculeIndex ?? 0) === vehiculeIndex
  );
}

function resolveRcCapital(vehicule: VehiculeInput | undefined, usages: ReferenceOption[]) {
  const usage = usages.find((item) => item.id === vehicule?.usageId);
  const usageText = `${usage?.code ?? ""} ${usage?.libelle ?? ""}`.toUpperCase();
  return usageText.includes("CYCLO") ? 5_000_000 : 50_000_000;
}

function defaultSource(garantie: ReferenceOption) {
  const configuredSource = String(garantie.sourceValeurParDefaut ?? "").toUpperCase();
  if (configuredSource && (configuredSource !== "MANUEL" || garantie.saisieManuelleAutorisee)) {
    return configuredSource;
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
  if (garantie.saisieManuelleAutorisee) {
    return "MANUEL";
  }
  return "AUCUNE";
}

function linesForGuarantee(lignes: ReferenceOption[], garantie: ReferenceOption) {
  return lignes
    .filter((ligne) => !ligne.garantieId || ligne.garantieId === garantie.id)
    .sort((left, right) =>
      (numberValue(String(left.ordreAffichage ?? "")) ?? 9999) - (numberValue(String(right.ordreAffichage ?? "")) ?? 9999)
      || String(left.libelle ?? "").localeCompare(String(right.libelle ?? ""))
    );
}

function formulesForGuarantee(formules: ReferenceOption[], garantie: ReferenceOption) {
  return formules.filter((formule) => !formule.garantieId || formule.garantieId === garantie.id);
}

function selectedLineFor(lines: ReferenceOption[], item?: GarantieInput) {
  return lines.find((line) => line.id === item?.ligneGrilleTarifaireId) ?? lines[0];
}

function lineSelectionPatch(garantie: ReferenceOption, line?: ReferenceOption): Partial<GarantieInput> {
  const mode = lineMode(line) || String(garantie.modeParDefaut ?? "TAUX");
  const allowedSources = allowedVehicleValueSources(garantie);
  const source = mode === "CAPITAL"
    ? "AUCUNE"
    : allowedSources.length <= 1 ? (configuredDefaultVehicleValueSource(garantie) || allowedSources[0] || defaultSource(garantie)) : undefined;
  return {
    ligneGrilleTarifaireId: line?.id,
    modeSelectionne: mode,
    sourceValeurSelectionnee: source,
    valeurAssuree: undefined,
    capital: undefined,
    taux: undefined,
    tauxFranchise: undefined,
    franchiseMinimale: undefined,
    prime: undefined,
  };
}

function lineMode(line?: ReferenceOption) {
  return String(line?.modeTarification ?? "").toUpperCase();
}

function isManualValue(garantie: ReferenceOption, line?: ReferenceOption) {
  if (lineMode(line) === "CAPITAL") {
    return false;
  }
  return defaultSource(garantie) === "MANUEL";
}

function selectedValueSource(garantie: ReferenceOption, item?: GarantieInput, line?: ReferenceOption, vehicule?: VehiculeInput) {
  if (lineMode(line) === "CAPITAL") {
    return "AUCUNE";
  }
  const selected = String(item?.sourceValeurSelectionnee ?? "").toUpperCase();
  if (selected === "MANUEL" && manualValueAllowed(garantie)) {
    return selected;
  }
  if (selected && (!vehicule || hasVehicleValue(vehicule, selected))) {
    return selected;
  }
  const sourceWithValue = allowedVehicleValueSources(garantie).find((source) => vehicule && hasVehicleValue(vehicule, source));
  if (sourceWithValue) {
    return sourceWithValue;
  }
  if (manualValueAllowed(garantie)) {
    return "MANUEL";
  }
  const defaultValue = configuredDefaultVehicleValueSource(garantie) || (allowedVehicleValueSources(garantie).length === 1 ? allowedVehicleValueSources(garantie)[0] : "");
  if (defaultValue) {
    return defaultValue;
  }
  return allowedVehicleValueSources(garantie)[0] ?? defaultSource(garantie);
}

function initialVehicleValueSource(garantie: ReferenceOption, vehicule?: VehiculeInput, line?: ReferenceOption) {
  if (lineMode(line) === "CAPITAL") {
    return "AUCUNE";
  }
  if (defaultSource(garantie) === "MANUEL") {
    return "MANUEL";
  }
  const availableSource = availableVehicleValueSources(garantie, vehicule, line)[0];
  if (availableSource) {
    return availableSource;
  }
  if (manualValueAllowed(garantie)) {
    return "MANUEL";
  }
  const allowedSources = allowedVehicleValueSources(garantie);
  return configuredDefaultVehicleValueSource(garantie)
    || (allowedSources.length === 1 ? allowedSources[0] : "")
    || allowedSources[0]
    || defaultSource(garantie);
}

function availableVehicleValueSources(garantie: ReferenceOption, vehicule?: VehiculeInput, line?: ReferenceOption) {
  if (lineMode(line) === "CAPITAL") {
    return [];
  }
  return allowedVehicleValueSources(garantie).filter((source) => vehicule && hasVehicleValue(vehicule, source));
}

function selectableManualValueSources(garantie: ReferenceOption, vehicule?: VehiculeInput, line?: ReferenceOption) {
  const sources = availableVehicleValueSources(garantie, vehicule, line);
  if (manualValueAllowed(garantie) && !sources.includes("MANUEL")) {
    sources.push("MANUEL");
  }
  return sources;
}

function manualValueAllowed(garantie: ReferenceOption) {
  return Boolean(garantie.saisieManuelleAutorisee);
}

function canEnterManualCapital(garantie: ReferenceOption, item?: GarantieInput, line?: ReferenceOption) {
  if (manualValueAllowed(garantie)) {
    return true;
  }
  const mode = String(item?.modeSelectionne || lineMode(line) || garantie.modeParDefaut || "").toUpperCase();
  return mode === "CAPITAL" && allowedVehicleValueSources(garantie).length === 0;
}

function requiredVehicleValueWarning(garantie: ReferenceOption, vehicule?: VehiculeInput, line?: ReferenceOption) {
  if (!vehicule || lineMode(line) === "CAPITAL" || defaultSource(garantie) === "MANUEL") {
    return "";
  }
  const allowedSources = allowedVehicleValueSources(garantie);
  if (allowedSources.length > 1) {
    if (allowedSources.some((allowedSource) => hasVehicleValue(vehicule, allowedSource))) {
      return validateValeurVenale(vehicule) ?? "";
    }
    if (manualValueAllowed(garantie)) {
      return "";
    }
    return `Renseignez ${allowedSources.map(sourceLabel).join(" ou ")} avant de sélectionner cette garantie.`;
  }
  const source = configuredDefaultVehicleValueSource(garantie) || allowedSources[0];
  if (source && !hasVehicleValue(vehicule, source) && manualValueAllowed(garantie)) {
    return "";
  }
  if (source === "NEUF" && !vehicule.valeurNeuf) {
    return "Renseignez la valeur à neuf avant de sélectionner cette garantie.";
  }
  if (source === "VENALE" && !vehicule.valeurVenale) {
    return "Renseignez la valeur vénale avant de sélectionner cette garantie.";
  }
  if (source === "GLACE" && !vehicule.valeurGlace) {
    return "Renseignez la valeur glace avant de sélectionner cette garantie.";
  }
  return validateValeurVenale(vehicule) ?? "";
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

function hasVehicleValue(vehicule: VehiculeInput, source: string) {
  if (source === "NEUF") {
    return Boolean(vehicule.valeurNeuf);
  }
  if (source === "VENALE") {
    return Boolean(vehicule.valeurVenale);
  }
  if (source === "GLACE") {
    return Boolean(vehicule.valeurGlace);
  }
  return false;
}

function sourceLabel(source: string) {
  if (source === "NEUF") {
    return "la valeur à neuf";
  }
  if (source === "VENALE") {
    return "la valeur vénale";
  }
  if (source === "GLACE") {
    return "la valeur glace";
  }
  return "la valeur";
}

function guaranteeCapitalValue(garantie: ReferenceOption, line?: ReferenceOption, vehicule?: VehiculeInput, item?: GarantieInput) {
  if (lineMode(line) === "CAPITAL") {
    return numeric(line?.capital);
  }
  const source = selectedValueSource(garantie, item, line, vehicule);
  if (source === "MANUEL" || isManualValue(garantie, line)) {
    return item?.valeurAssuree ?? item?.capital;
  }
  if (source === "VENALE") {
    return vehicule?.valeurVenale;
  }
  if (source === "NEUF") {
    return vehicule?.valeurNeuf;
  }
  if (source === "GLACE") {
    return vehicule?.valeurGlace;
  }
  return numeric(line?.capital);
}

function capitalDisplay(garantie: ReferenceOption, line?: ReferenceOption, vehicule?: VehiculeInput, capital?: number, item?: GarantieInput) {
  const mode = lineMode(line);
  if (mode === "CAPITAL") {
    return capital == null ? "" : money(capital);
  }
  const source = selectedValueSource(garantie, item, line, vehicule);
  if (source === "VENALE") {
    return `V.Vénale: ${money(vehicule?.valeurVenale)}`;
  }
  if (source === "NEUF") {
    return `V.Neuf: ${money(vehicule?.valeurNeuf)}`;
  }
  if (source === "GLACE") {
    return `V.Glace: ${money(vehicule?.valeurGlace)}`;
  }
  return capital == null ? "" : money(capital);
}

function sourceOptionLabel(source: string, vehicule?: VehiculeInput) {
  if (source === "MANUEL") {
    return "Saisie manuelle";
  }
  if (source === "NEUF") {
    return `V.Neuf: ${money(vehicule?.valeurNeuf)}`;
  }
  if (source === "VENALE") {
    return `V.Vénale: ${money(vehicule?.valeurVenale)}`;
  }
  if (source === "GLACE") {
    return `V.Glace: ${money(vehicule?.valeurGlace)}`;
  }
  return sourceLabel(source);
}

function capitalLineLabel(line: ReferenceOption) {
  const capital = numeric(line.capital);
  return capital == null ? String(line.libelle ?? "Option") : money(capital);
}

function tariffLineLabel(line: ReferenceOption, index = 0) {
  const mode = lineMode(line);
  const taux = numeric(line.taux);
  if (mode === "TAUX" && taux != null) {
    return `${money(taux)} %`;
  }
  if (mode === "CAPITAL") {
    const label = String(line.libelle ?? "");
    return label.toLowerCase().includes("formule") ? label : `Formule ${index + 1}`;
  }
  return String(line.libelle ?? rateDisplay(line));
}

function rateDisplay(line?: ReferenceOption) {
  const taux = numeric(line?.taux);
  if (lineMode(line) === "CAPITAL") {
    return String(line?.libelle ?? "-");
  }
  return taux == null ? "-" : `${money(taux)} %`;
}

function franchiseDisplay(line?: ReferenceOption, avecFranchise = true, avecFranchiseMinimale = true) {
  const tauxFranchise = avecFranchise ? numeric(line?.tauxFranchise) : undefined;
  const franchiseMinimale = avecFranchiseMinimale ? numeric(line?.franchiseMinimale) : undefined;
  if (tauxFranchise == null && franchiseMinimale == null) {
    return "-";
  }
  const left = tauxFranchise == null ? "" : `${money(tauxFranchise)} %`;
  const right = franchiseMinimale == null ? "" : `${money(franchiseMinimale)} DH`;
  return [left, right].filter(Boolean).join(" _ ");
}

function estimatePrime(line?: ReferenceOption, capital?: number) {
  const mode = lineMode(line);
  const taux = numeric(line?.taux);
  const prime = numeric(line?.prime);
  if (mode === "CAPITAL" || mode === "PRIME_FIXE") {
    if (taux != null && taux !== 0) {
      return ((prime ?? 0) * taux) / 100;
    }
    return prime;
  }
  if (taux != null && capital != null) {
    return (capital * taux) / 100;
  }
  return prime;
}

function assistanceProductMatchesCategory(produit: ReferenceOption, categorieClientId?: string) {
  const productCategoryId = produit.categorieClientId == null ? "" : String(produit.categorieClientId);
  if (!productCategoryId) return true;
  return Boolean(categorieClientId) && productCategoryId === String(categorieClientId);
}

function numeric(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function controlClass(active: boolean) {
  return active
    ? "border-slate-300 bg-slate-50/70 shadow-none focus-visible:border-ring focus-visible:ring-ring/50 dark:border-neutral-700 dark:bg-neutral-950/70"
    : "border-transparent bg-muted/40 text-muted-foreground shadow-none";
}
