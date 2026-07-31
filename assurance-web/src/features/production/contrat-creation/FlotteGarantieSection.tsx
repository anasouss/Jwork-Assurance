import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MoneyInput } from "../components/MoneyInput";
import { SectionCard } from "../components/SectionCard";
import { numberValue } from "../utils/format";
import type { GarantieInput, ReferenceOption, RemorqueInput, VehiculeInput } from "../types";

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

type Props = {
  garanties: ReferenceOption[];
  selected: GarantieInput[];
  setSelected: Dispatch<SetStateAction<GarantieInput[]>>;
  lignes: ReferenceOption[];
  vehicules: VehiculeInput[];
  remorques: RemorqueInput[];
  grilleSelected: boolean;
};

export function FlotteGarantieSection({
  garanties,
  selected,
  setSelected,
  lignes,
  vehicules,
  remorques,
  grilleSelected,
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
  const [activeKey, setActiveKey] = useState(() => targetKey(targets[0]));
  const activeTarget = targets.find((target) => targetKey(target) === activeKey) ?? targets[0];
  const vehiculeGaranties = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "VEHICULE") !== "PERSONNE"),
    [garanties]
  );
  const selectedCount = selected.filter((item) => item.vehiculeIndex !== undefined || item.remorqueIndex !== undefined).length;

  useEffect(() => {
    if (!targets.some((target) => targetKey(target) === activeKey)) {
      setActiveKey(targetKey(targets[0]));
    }
  }, [activeKey, targets]);

  useEffect(() => {
    const rcGaranties = vehiculeGaranties.filter((garantie) => Boolean(garantie.responsabiliteCivile));
    if (rcGaranties.length === 0 || targets.length === 0) {
      return;
    }
    setSelected((current) => {
      const additions: GarantieInput[] = [];
      for (const target of targets) {
        for (const garantie of rcGaranties) {
          const exists = current.some((item) => item.garantieId === garantie.id && sameTarget(item, target));
          if (!exists) {
            additions.push(targetedInput(garantie, target));
          }
        }
      }
      return additions.length === 0 ? current : [...current, ...additions];
    });
  }, [setSelected, targets, vehiculeGaranties]);

  const update = (target: Target, garantieId: string, patch: Partial<GarantieInput>) => {
    setSelected(selected.map((item) => (item.garantieId === garantieId && sameTarget(item, target) ? { ...item, ...patch } : item)));
  };

  const toggle = (target: Target, garantie: ReferenceOption, checked: boolean) => {
    if (Boolean(garantie.responsabiliteCivile)) {
      return;
    }
    if (checked) {
      setSelected([...withoutExclusionConflicts(selected, vehiculeGaranties, target, garantie), targetedInput(garantie, target)]);
      return;
    }
    setSelected(selected.filter((item) => !(item.garantieId === garantie.id && sameTarget(item, target))));
  };

  return (
    <SectionCard title="Garanties" badge={`${selectedCount} sélectionnée${selectedCount > 1 ? "s" : ""}`} tone="production">
      {targets.length === 0 ? (
        <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          Ajoutez un véhicule ou une remorque avant de sélectionner les garanties.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="grid content-start gap-2">
            {targets.map((target) => {
              const key = targetKey(target);
              const active = key === targetKey(activeTarget);
              const count = selected.filter((item) => sameTarget(item, target)).length;
              return (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    active ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "hover:bg-muted/60"
                  )}
                  onClick={() => setActiveKey(key)}
                >
                  <span className="font-medium">{target.label}</span>
                  <Badge variant="secondary">{count}</Badge>
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-12 px-3 py-3 text-left" />
                  <th className="px-3 py-3 text-left">Garantie</th>
                  <th className="w-44 px-3 py-3 text-left">Capital / valeur</th>
                  <th className="w-36 px-3 py-3 text-left">Taux (%)</th>
                  <th className="w-40 px-3 py-3 text-left">Franchise (%)</th>
                  <th className="w-40 px-3 py-3 text-left">Min franchise</th>
                  <th className="w-40 px-3 py-3 text-left">Prime nette</th>
                </tr>
              </thead>
              <tbody>
                {vehiculeGaranties.map((garantie) => {
                  const item = selected.find((selectedItem) => selectedItem.garantieId === garantie.id && sameTarget(selectedItem, activeTarget));
                  const checked = Boolean(item);
                  const isRc = Boolean(garantie.responsabiliteCivile);
                  const hasLine = isRc || matchingLines(lignes, garantie, activeTarget).length > 0;
                  const disabled = isRc || !grilleSelected || !hasLine;
                  const editable = checked && !isRc;
                  const warning = checked ? valueWarning(garantie, activeTarget) : "";

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
                        <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => toggle(activeTarget, garantie, Boolean(value))} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {!isRc && !grilleSelected ? <Badge variant="outline">Grille requise</Badge> : null}
                          {!isRc && grilleSelected && !hasLine ? <Badge variant="outline">Tarif manquant</Badge> : null}
                          {warning ? <Badge variant="destructive">{warning}</Badge> : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <MoneyInput
                          disabled={!editable}
                          className={controlClass(editable)}
                          value={item?.valeurAssuree ?? item?.capital}
                          onValueChange={(value) => update(activeTarget, garantie.id, { valeurAssuree: value, capital: value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={!editable} className={controlClass(editable)} value={item?.taux ?? ""} onChange={(event) => update(activeTarget, garantie.id, { taux: numberValue(event.target.value) })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" disabled={!editable || !garantie.avecFranchise} className={controlClass(editable && Boolean(garantie.avecFranchise))} value={item?.tauxFranchise ?? ""} onChange={(event) => update(activeTarget, garantie.id, { tauxFranchise: numberValue(event.target.value) })} />
                      </td>
                      <td className="px-3 py-2">
                        <MoneyInput
                          disabled={!editable || !garantie.avecFranchiseMinimale}
                          className={controlClass(editable && Boolean(garantie.avecFranchiseMinimale))}
                          value={garantie.avecFranchiseMinimale ? item?.franchiseMinimale : undefined}
                          onValueChange={(value) => update(activeTarget, garantie.id, { franchiseMinimale: value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{checked ? "Calcul auto" : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function targetedInput(garantie: ReferenceOption, target: Target): GarantieInput {
  return {
    garantieId: garantie.id,
    vehiculeIndex: target.kind === "vehicule" ? target.index : undefined,
    remorqueIndex: target.kind === "remorque" ? target.index : undefined,
    modeSelectionne: String(garantie.modeParDefaut ?? "TAUX"),
    sourceValeurSelectionnee: defaultSource(garantie),
  };
}

function sameTarget(item: GarantieInput, target?: Target) {
  if (!target) {
    return false;
  }
  return target.kind === "vehicule" ? item.vehiculeIndex === target.index : item.remorqueIndex === target.index;
}

function withoutExclusionConflicts(selected: GarantieInput[], garanties: ReferenceOption[], target: Target, garantie: ReferenceOption) {
  const groupeExclusionId = String(garantie.groupeExclusionId ?? "");
  if (!groupeExclusionId) {
    return selected;
  }
  const incompatibleGarantieIds = new Set(
    garanties
      .filter((candidate) => candidate.id !== garantie.id && String(candidate.groupeExclusionId ?? "") === groupeExclusionId)
      .map((candidate) => candidate.id)
  );
  if (incompatibleGarantieIds.size === 0) {
    return selected;
  }
  return selected.filter((item) => !(sameTarget(item, target) && incompatibleGarantieIds.has(item.garantieId)));
}

function targetKey(target?: Target) {
  return target ? `${target.kind}:${target.index}` : "";
}

function matchingLines(lignes: ReferenceOption[], garantie: ReferenceOption, target?: Target) {
  if (!target) {
    return [];
  }
  return lignes.filter((ligne) => {
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
  });
}

function valueWarning(garantie: ReferenceOption, target?: Target) {
  if (!target) {
    return "";
  }
  if (garantie.requiertValeurGlace && !target.valeurGlace) {
    return "Valeur glace requise";
  }
  if (garantie.requiertValeurNeuf && !target.valeurNeuf) {
    return "Valeur à neuf requise";
  }
  if (garantie.requiertValeurVenale && !target.valeurVenale) {
    return "Valeur vénale requise";
  }
  if (target.kind === "remorque" && garantie.avecCapital && !target.valeurAssuree) {
    return "Valeur remorque requise";
  }
  return "";
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
