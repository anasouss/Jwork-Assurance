import { useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { EcheanceInput } from "@/components/ui/echeance-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";
import { computeDateEcheanceFromCode, toDateOnly } from "../date";
import { formatMoney, money, moneyAmount, numberValue } from "../utils/format";
import { validateValeurVenale } from "../utils/vehicle-validation";
import type { AssistanceDraft, GarantieInput, QuittancePreview, ReferenceOption, VehiculeInput } from "../types";
import type { ContratSectionKey } from "../contrat-creation/useContratCreationForm";

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
  const personneIds = new Set(personneGaranties.map((garantie) => garantie.id));
  const showPersonneTotals = selected.some((item) => personneIds.has(item.garantieId))
    || lineTaxeParafiscale(preview, "CORPOREL") != null
    || (preview?.accessoire ?? 0) > 0;
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
      badge={`${selected.length} sélectionnée${selected.length > 1 ? "s" : ""}`}
      tone="production"
      open={openSection === "garanties"}
      onOpenChange={(open) => onSectionOpenChange?.("garanties", open)}
    >
      {allowPrimeColumn ? (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Switch checked={primeColumnEnabled} onCheckedChange={(value) => setPrimeColumnEnabled?.(value)} />
          <span>Saisie avec primes</span>
        </div>
      ) : null}
      <div className="mb-2 text-sm font-semibold">Garanties véhicule</div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-3 text-left"></th>
              <th className="px-3 py-3 text-left">Garantie</th>
              {vehiculeCount > 1 ? <th className="w-40 px-3 py-3 text-left">Véhicule</th> : null}
              <th className="w-48 px-3 py-3 text-left">Valeur assurée</th>
              <th className="w-36 px-3 py-3 text-left">Taux (%)</th>
              {automaticPricing ? (
                <>
                  <th className="w-56 px-3 py-3 text-left">Taux franchise / Min franchise</th>
                  <th className="w-40 px-3 py-3 text-left">Prime annuelle</th>
                </>
              ) : (
                <>
                  <th className="w-40 px-3 py-3 text-left">Franchise (%)</th>
                  <th className="w-40 px-3 py-3 text-left">Min franchise</th>
                </>
              )}
              {showLigneGrille ? <th className="w-56 px-3 py-3 text-left">Ligne grille</th> : null}
              {automaticPricing || primeColumnEnabled ? <th className="w-40 px-3 py-3 text-left">Prime nette</th> : null}
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
              const manualValue = selectedSource === "MANUEL";
              const displayCapital = guaranteeCapitalValue(garantie, selectedLine, selectedVehicle, item);
              const estimatedPrime = automaticPricing && checked && !isRc ? estimatePrime(selectedLine, displayCapital) : undefined;
              const rcPrime = isRc ? resolveRcPrime(preview, selected, garanties, lignes, vehicules) : undefined;

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
                  <td className="px-3 py-2">
                    <Checkbox checked={checked} disabled={isRc || !hasLine} onCheckedChange={(value) => toggle(garantie, Boolean(value))} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {isRc ? <Badge>RC obligatoire</Badge> : null}
                      {automaticPricing && !isRc && !hasLine ? <Badge variant="outline">Tarif manquant</Badge> : null}
                    </div>
                  </td>
                  {vehiculeCount > 1 ? (
                    <td className="px-3 py-2">
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
                    </td>
                  ) : null}
                  {automaticPricing ? (
                    <>
                      <td className="px-3 py-2">
                        {manualValue && !isRc ? (
                          <Input
                            type="number"
                            disabled={!editable}
                            className={controlClass(editable)}
                            value={item?.valeurAssuree ?? item?.capital ?? ""}
                            onChange={(event) => update(garantie.id, { valeurAssuree: numberValue(event.target.value), capital: numberValue(event.target.value) })}
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
                      </td>
                      <td className="px-3 py-2">
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
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{franchiseDisplay(selectedLine)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{isRc ? autoPrimeDisplay(rcPrime) : estimatedPrime == null ? "-" : money(estimatedPrime)}</td>
                      <td className="px-3 py-2 text-right font-medium">{isRc ? autoPrimeDisplay(rcPrime) : estimatedPrime == null ? (checked ? "Calcul auto" : "-") : money(estimatedPrime)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          disabled={rowDisabled || isRc}
                          className={controlClass(editable)}
                          value={item?.valeurAssuree ?? item?.capital ?? ""}
                          onChange={(event) => update(garantie.id, { valeurAssuree: numberValue(event.target.value), capital: numberValue(event.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={rowDisabled || isRc} className={controlClass(editable)} value={item?.taux ?? ""} onChange={(event) => update(garantie.id, { taux: numberValue(event.target.value) })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={rowDisabled || isRc || !garantie.avecFranchise} className={controlClass(editable && Boolean(garantie.avecFranchise))} value={item?.tauxFranchise ?? ""} onChange={(event) => update(garantie.id, { tauxFranchise: numberValue(event.target.value) })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={rowDisabled || isRc || !garantie.avecFranchise} className={controlClass(editable && Boolean(garantie.avecFranchise))} value={item?.franchiseMinimale ?? ""} onChange={(event) => update(garantie.id, { franchiseMinimale: numberValue(event.target.value) })} />
                      </td>
                    </>
                  )}
                  {!automaticPricing && showLigneGrille ? (
                    <td className="px-3 py-2">
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
                    </td>
                  ) : null}
                  {!automaticPricing && primeColumnEnabled ? (
                    <td className="px-3 py-2">
                      <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.prime ?? ""} onChange={(event) => update(garantie.id, { prime: numberValue(event.target.value) })} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
      {personneGaranties.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Garanties personne</div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
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
              <tbody>
                {personneGaranties.map((garantie) => {
                  const item = byId.get(garantie.id);
                  const checked = Boolean(item);
                  const rowDisabled = !checked;
                  const hasFormula = !automaticPricing || formulesForGuarantee(formulesPersonne, garantie).length > 0;
                  const formules = formulesForGuarantee(formulesPersonne, garantie);
                  const selectedFormule = formules.find((formule) => formule.id === item?.formuleGarantiePersonneId) ?? formules[0];

                  return (
                    <tr key={garantie.id} className={cn("border-t align-middle transition-colors", rowDisabled || !hasFormula ? "bg-muted/20 text-muted-foreground" : "bg-background")}>
                      <td className="px-3 py-2">
                        <Checkbox checked={checked} disabled={!hasFormula} onCheckedChange={(value) => toggle(garantie, Boolean(value))} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                        {automaticPricing && !hasFormula ? <Badge variant="outline">Formule manquante</Badge> : null}
                      </td>
                      {automaticPricing ? (
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
                      ) : null}
                      <td className="px-3 py-2 text-right">{automaticPricing ? money(selectedFormule?.montantDeces) : <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantDeces ?? ""} onChange={(event) => update(garantie.id, { montantDeces: numberValue(event.target.value) })} />}</td>
                      <td className="px-3 py-2 text-right">{automaticPricing ? money(selectedFormule?.montantInvalidite) : <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantInvalidite ?? ""} onChange={(event) => update(garantie.id, { montantInvalidite: numberValue(event.target.value) })} />}</td>
                      <td className="px-3 py-2 text-right">{automaticPricing ? money(selectedFormule?.montantFraisMedicaux) : <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisMedicaux ?? ""} onChange={(event) => update(garantie.id, { montantFraisMedicaux: numberValue(event.target.value) })} />}</td>
                      <td className="px-3 py-2 text-right">{automaticPricing ? money(selectedFormule?.montantFraisHospitalisation) : <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisHospitalisation ?? ""} onChange={(event) => update(garantie.id, { montantFraisHospitalisation: numberValue(event.target.value) })} />}</td>
                      <td className="px-3 py-2 text-right">{automaticPricing ? money(selectedFormule?.montantFraisFuneraires) : <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisFuneraires ?? ""} onChange={(event) => update(garantie.id, { montantFraisFuneraires: numberValue(event.target.value) })} />}</td>
                      <td className="px-3 py-2 text-right">{automaticPricing ? money(selectedFormule?.montantFraisChirurgie) : <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisChirurgie ?? ""} onChange={(event) => update(garantie.id, { montantFraisChirurgie: numberValue(event.target.value) })} />}</td>
                      {automaticPricing ? (
                        <td className="px-3 py-2 text-right text-muted-foreground">{checked ? money(selectedFormule?.primeNette) : "-"}</td>
                      ) : primeColumnEnabled ? (
                        <td className="px-3 py-2">
                          <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.prime ?? ""} onChange={(event) => update(garantie.id, { prime: numberValue(event.target.value) })} />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {showTotalsSummary ? (
        <GuaranteeTotalsSummary
          preview={preview}
          loading={previewing}
          showPersonneTotals={showPersonneTotals}
          showAssistanceTotal={showAssistanceTotal}
        />
      ) : null}
    </SectionCard>
  );
}

function GuaranteeTotalsSummary({
  preview,
  loading,
  showPersonneTotals,
  showAssistanceTotal,
}: {
  preview?: QuittancePreview | null;
  loading?: boolean;
  showPersonneTotals?: boolean;
  showAssistanceTotal?: boolean;
}) {
  const rows: [string, number | undefined][] = [
    ["TOTAL NET", preview?.primeNette],
    ["EVCAT", linePrimeNette(preview, "EVCAT")],
    ["TAXE", preview?.taxe],
    ["CNPAC", preview?.cnpac],
    ["TOTAL À PAYER", preview?.primeTotale],
  ];
  if (showPersonneTotals) {
    rows.splice(2, 0, ["PTA (Prime Personne)", lineTaxeParafiscale(preview, "CORPOREL")], ["ACCESSOIRE", preview?.accessoire]);
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
            {loading ? "Calcul..." : value == null ? "-" : formatMoney(value)}
          </div>
        </div>
      ))}
    </div>
  );
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
        <Checkbox checked={assistance.enabled} onCheckedChange={(checked) => onChange({ enabled: Boolean(checked) })} />
        <span>ASSISTANCE</span>
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
    </div>
  );
}

function linePrimeNette(preview: QuittancePreview | null | undefined, categorie: string) {
  return preview?.lignes.find((ligne) => ligne.categorie === categorie)?.primeNette;
}

function lineTaxeParafiscale(preview: QuittancePreview | null | undefined, categorie: string) {
  return preview?.lignes.find((ligne) => ligne.categorie === categorie)?.taxeParafiscale;
}

function autoPrimeDisplay(value?: number) {
  return value == null ? "Calcul auto" : moneyAmount(value);
}

function resolveRcPrime(
  preview: QuittancePreview | null | undefined,
  selected: GarantieInput[],
  garanties: ReferenceOption[],
  lignes: ReferenceOption[],
  vehicules: VehiculeInput[]
) {
  const automobileNet = linePrimeNette(preview, "AUTOMOBILE");
  if (automobileNet == null) {
    return undefined;
  }
  const nonRcPrime = selected.reduce((total, item) => {
    const garantie = garanties.find((option) => option.id === item.garantieId);
    if (!garantie || Boolean(garantie.responsabiliteCivile) || String(garantie.typeGarantie ?? "VEHICULE") === "PERSONNE") {
      return total;
    }
    const line = selectedLineFor(linesForGuarantee(lignes, garantie), item);
    const vehicle = vehicules[item.vehiculeIndex ?? 0] ?? vehicules[0];
    const capital = guaranteeCapitalValue(garantie, line, vehicle, item);
    return total + (estimatePrime(line, capital) ?? 0);
  }, 0);
  return Math.max(0, automobileNet - nonRcPrime);
}

function resolveRcCapital(vehicule: VehiculeInput | undefined, usages: ReferenceOption[]) {
  const usage = usages.find((item) => item.id === vehicule?.usageId);
  const usageText = `${usage?.code ?? ""} ${usage?.libelle ?? ""}`.toUpperCase();
  return usageText.includes("CYCLO") ? 5_000_000 : 50_000_000;
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
  if (selected && (!vehicule || hasVehicleValue(vehicule, selected))) {
    return selected;
  }
  const sourceWithValue = allowedVehicleValueSources(garantie).find((source) => vehicule && hasVehicleValue(vehicule, source));
  if (sourceWithValue) {
    return sourceWithValue;
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

function requiredVehicleValueWarning(garantie: ReferenceOption, vehicule?: VehiculeInput, line?: ReferenceOption) {
  if (!vehicule || lineMode(line) === "CAPITAL" || defaultSource(garantie) === "MANUEL") {
    return "";
  }
  const allowedSources = allowedVehicleValueSources(garantie);
  if (allowedSources.length > 1) {
    if (allowedSources.some((allowedSource) => hasVehicleValue(vehicule, allowedSource))) {
      return validateValeurVenale(vehicule) ?? "";
    }
    return `Renseignez ${allowedSources.map(sourceLabel).join(" ou ")} avant de sélectionner cette garantie.`;
  }
  const source = configuredDefaultVehicleValueSource(garantie) || allowedSources[0];
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
  if (isManualValue(garantie, line)) {
    return item?.valeurAssuree ?? item?.capital;
  }
  const source = selectedValueSource(garantie, item, line, vehicule);
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

function franchiseDisplay(line?: ReferenceOption) {
  const tauxFranchise = numeric(line?.tauxFranchise);
  const franchiseMinimale = numeric(line?.franchiseMinimale);
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
