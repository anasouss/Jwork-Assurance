import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";
import { formatMoney, money, numberValue } from "../utils/format";
import type { GarantieInput, QuittancePreview, ReferenceOption, VehiculeInput } from "../types";

export function GarantieSection({
  garanties,
  selected,
  setSelected,
  lignes,
  formulesPersonne = [],
  vehicules = [],
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
}: {
  garanties: ReferenceOption[];
  selected: GarantieInput[];
  setSelected: (value: GarantieInput[]) => void;
  lignes: ReferenceOption[];
  formulesPersonne?: ReferenceOption[];
  vehicules?: VehiculeInput[];
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
    || linePrimeNette(preview, "CORPOREL") != null
    || (preview?.accessoire ?? 0) > 0;
  const showAssistanceTotal = assistanceEnabled || linePrimeNette(preview, "ASSISTANCE") != null;
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
      setSelected([
        ...selected,
        {
          garantieId: garantie.id,
          vehiculeIndex: type === "VEHICULE" && vehiculeCount > 0 ? 0 : undefined,
          modeSelectionne: String(garantie.modeParDefaut ?? (type === "PERSONNE" ? "PROTECTION" : "TAUX")),
          sourceValeurSelectionnee: defaultSource(garantie),
          ...lineSelectionPatch(garantie, line),
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
    <SectionCard title="Garanties" badge={`${selected.length} sélectionnée${selected.length > 1 ? "s" : ""}`} tone="production">
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
              const manualValue = isManualValue(garantie, selectedLine);
              const displayCapital = guaranteeCapitalValue(garantie, selectedLine, selectedVehicle, item);
              const estimatedPrime = automaticPricing && checked && !isRc ? estimatePrime(selectedLine, displayCapital) : undefined;

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
                        <Select value={String(item?.vehiculeIndex ?? 0)} disabled={rowDisabled} onValueChange={(value) => update(garantie.id, { vehiculeIndex: Number(value) })}>
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
                        ) : lineOptions.length > 1 && lineMode(selectedLine) === "CAPITAL" ? (
                          <Select
                            value={selectedLine?.id ?? ""}
                            disabled={!editable}
                            onValueChange={(value) => {
                              const line = lineOptions.find((option) => option.id === value);
                              update(garantie.id, lineSelectionPatch(garantie, line));
                            }}
                          >
                            <SelectTrigger className={controlClass(editable)}><SelectValue placeholder="Formule" /></SelectTrigger>
                            <SelectContent>
                              {lineOptions.map((line) => <SelectItem key={line.id} value={line.id}>{capitalLineLabel(line)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input readOnly disabled={rowDisabled} className={controlClass(editable)} value={isRc ? "Capital RC" : capitalDisplay(garantie, selectedLine, selectedVehicle, displayCapital)} />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!isRc && lineOptions.length > 1 ? (
                          <Select
                            value={selectedLine?.id ?? ""}
                            disabled={!editable}
                            onValueChange={(value) => {
                              const line = lineOptions.find((option) => option.id === value);
                              update(garantie.id, lineSelectionPatch(garantie, line));
                            }}
                          >
                            <SelectTrigger className={controlClass(editable)}><SelectValue placeholder="Option" /></SelectTrigger>
                            <SelectContent>
                              {lineOptions.map((line) => <SelectItem key={line.id} value={line.id}>{tariffLineLabel(line)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn("block rounded-md px-3 py-2 text-right", rowDisabled ? "text-muted-foreground" : "")}>
                            {isRc ? "-" : rateDisplay(selectedLine)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{franchiseDisplay(selectedLine)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{estimatedPrime == null ? "-" : money(estimatedPrime)}</td>
                      <td className="px-3 py-2 text-right font-medium">{estimatedPrime == null ? (checked ? "Calcul auto" : "-") : money(estimatedPrime)}</td>
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
                            update(garantie.id, lineSelectionPatch(garantie, line));
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
        <div className={cn("mt-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold", !assistanceEnabled && "bg-muted/20 text-muted-foreground")}>
          <Checkbox checked={assistanceEnabled} onCheckedChange={(checked) => setAssistanceEnabled?.(Boolean(checked))} />
          <span>ASSISTANCE</span>
        </div>
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
    rows.splice(2, 0, ["PTA (Prime Personne)", linePrimeNette(preview, "CORPOREL")], ["ACCESSOIRE", preview?.accessoire]);
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

function linePrimeNette(preview: QuittancePreview | null | undefined, categorie: string) {
  return preview?.lignes.find((ligne) => ligne.categorie === categorie)?.primeNette;
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
  const source = mode === "CAPITAL" ? "AUCUNE" : defaultSource(garantie);
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

function guaranteeCapitalValue(garantie: ReferenceOption, line?: ReferenceOption, vehicule?: VehiculeInput, item?: GarantieInput) {
  if (lineMode(line) === "CAPITAL") {
    return numeric(line?.capital);
  }
  if (isManualValue(garantie, line)) {
    return item?.valeurAssuree ?? item?.capital;
  }
  const source = defaultSource(garantie);
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

function capitalDisplay(garantie: ReferenceOption, line?: ReferenceOption, vehicule?: VehiculeInput, capital?: number) {
  const mode = lineMode(line);
  if (mode === "CAPITAL") {
    return capital == null ? "" : money(capital);
  }
  const source = defaultSource(garantie);
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

function capitalLineLabel(line: ReferenceOption) {
  const capital = numeric(line.capital);
  return capital == null ? String(line.libelle ?? "Option") : money(capital);
}

function tariffLineLabel(line: ReferenceOption) {
  const mode = lineMode(line);
  const taux = numeric(line.taux);
  if (mode === "TAUX" && taux != null) {
    return `${money(taux)} %`;
  }
  if (mode === "CAPITAL") {
    return String(line.libelle ?? capitalLineLabel(line));
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
    ? "border-slate-300 bg-slate-50/70 shadow-none focus-visible:border-ring focus-visible:ring-ring/50 dark:border-slate-700 dark:bg-input/30"
    : "border-transparent bg-muted/40 text-muted-foreground shadow-none";
}
