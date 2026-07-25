import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";
import type { GarantieInput, ReferenceOption } from "../types";

export function GarantieSection({
  garanties,
  selected,
  setSelected,
  lignes,
  vehiculeCount,
  showLigneGrille = true,
  automaticPricing = false,
  allowPrimeColumn = false,
  primeColumnEnabled = false,
  setPrimeColumnEnabled,
}: {
  garanties: ReferenceOption[];
  selected: GarantieInput[];
  setSelected: (value: GarantieInput[]) => void;
  lignes: ReferenceOption[];
  vehiculeCount: number;
  showLigneGrille?: boolean;
  automaticPricing?: boolean;
  allowPrimeColumn?: boolean;
  primeColumnEnabled?: boolean;
  setPrimeColumnEnabled?: (value: boolean) => void;
}) {
  const byId = new Map(selected.map((item) => [item.garantieId, item]));
  const vehiculeGaranties = garanties.filter((garantie) => String(garantie.typeGarantie ?? "VEHICULE") !== "PERSONNE");
  const personneGaranties = garanties.filter((garantie) => String(garantie.typeGarantie ?? "VEHICULE") === "PERSONNE");
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
      setSelected([
        ...selected,
        {
          garantieId: garantie.id,
          vehiculeIndex: type === "VEHICULE" && vehiculeCount > 0 ? 0 : undefined,
          modeSelectionne: String(garantie.modeParDefaut ?? (type === "PERSONNE" ? "PROTECTION" : "TAUX")),
          sourceValeurSelectionnee: defaultSource(garantie),
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
              <th className="w-40 px-3 py-3 text-left">Franchise (%)</th>
              <th className="w-40 px-3 py-3 text-left">Min franchise</th>
              {showLigneGrille ? <th className="w-56 px-3 py-3 text-left">Ligne grille</th> : null}
              {automaticPricing || primeColumnEnabled ? <th className="w-40 px-3 py-3 text-left">Prime nette</th> : null}
            </tr>
          </thead>
          <tbody>
            {vehiculeGaranties.map((garantie) => {
              const item = byId.get(garantie.id);
              const checked = Boolean(item);
              const isRc = Boolean(garantie.responsabiliteCivile);
              const rowDisabled = !checked;
              const locked = isRc;
              const hasLine = !automaticPricing || isRc || linesForGuarantee(lignes, garantie).length > 0;
              const editable = checked && !locked;
              const isVehicleGuarantee = String(garantie.typeGarantie ?? "VEHICULE") === "VEHICULE";

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
                  {showLigneGrille ? (
                    <td className="px-3 py-2">
                      {!isRc ? (
                        <Select value={item?.ligneGrilleTarifaireId ?? ""} disabled={rowDisabled} onValueChange={(value) => update(garantie.id, { ligneGrilleTarifaireId: value })}>
                          <SelectTrigger className={controlClass(editable)}><SelectValue placeholder="Option" /></SelectTrigger>
                          <SelectContent>
                            {lignes
                              .filter((ligne) => !ligne.garantieId || ligne.garantieId === garantie.id)
                              .map((ligne) => <SelectItem key={ligne.id} value={ligne.id}>{ligne.libelle}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">Calcul RC</span>
                      )}
                    </td>
                  ) : null}
                  {automaticPricing ? (
                    <td className="px-3 py-2 text-muted-foreground">{checked ? "Calcul auto" : "-"}</td>
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
      {personneGaranties.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Garanties personne</div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-12 px-3 py-3 text-left"></th>
                  <th className="px-3 py-3 text-left">Garantie</th>
                  <th className="w-40 px-3 py-3 text-left">Décès</th>
                  <th className="w-40 px-3 py-3 text-left">Invalidité</th>
                  <th className="w-44 px-3 py-3 text-left">Frais médicaux</th>
                  <th className="w-48 px-3 py-3 text-left">Hospitalisation</th>
                  <th className="w-44 px-3 py-3 text-left">Frais funéraires</th>
                  <th className="w-56 px-3 py-3 text-left">Chirurgie réparatrice</th>
                  {automaticPricing || primeColumnEnabled ? <th className="w-40 px-3 py-3 text-left">Prime nette</th> : null}
                </tr>
              </thead>
              <tbody>
                {personneGaranties.map((garantie) => {
                  const item = byId.get(garantie.id);
                  const checked = Boolean(item);
                  const rowDisabled = !checked;

                  return (
                    <tr key={garantie.id} className={cn("border-t align-middle transition-colors", rowDisabled ? "bg-muted/20 text-muted-foreground" : "bg-background")}>
                      <td className="px-3 py-2">
                        <Checkbox checked={checked} onCheckedChange={(value) => toggle(garantie, Boolean(value))} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantDeces ?? ""} onChange={(event) => update(garantie.id, { montantDeces: numberValue(event.target.value) })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantInvalidite ?? ""} onChange={(event) => update(garantie.id, { montantInvalidite: numberValue(event.target.value) })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisMedicaux ?? ""} onChange={(event) => update(garantie.id, { montantFraisMedicaux: numberValue(event.target.value) })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisHospitalisation ?? ""} onChange={(event) => update(garantie.id, { montantFraisHospitalisation: numberValue(event.target.value) })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisFuneraires ?? ""} onChange={(event) => update(garantie.id, { montantFraisFuneraires: numberValue(event.target.value) })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={rowDisabled} className={controlClass(checked)} value={item?.montantFraisChirurgie ?? ""} onChange={(event) => update(garantie.id, { montantFraisChirurgie: numberValue(event.target.value) })} />
                      </td>
                      {automaticPricing ? (
                        <td className="px-3 py-2 text-muted-foreground">{checked ? "Calcul auto" : "-"}</td>
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
    </SectionCard>
  );
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

function linesForGuarantee(lignes: ReferenceOption[], garantie: ReferenceOption) {
  return lignes.filter((ligne) => !ligne.garantieId || ligne.garantieId === garantie.id);
}

function controlClass(active: boolean) {
  return active
    ? "border-slate-300 bg-slate-50/70 shadow-none focus-visible:border-ring focus-visible:ring-ring/50 dark:border-slate-700 dark:bg-input/30"
    : "border-transparent bg-muted/40 text-muted-foreground shadow-none";
}

function numberValue(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
