import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "./SectionCard";
import type { GarantieInput, ReferenceOption } from "../types";

export function GarantieSection({
  garanties,
  selected,
  setSelected,
  lignes,
  vehiculeCount,
  showLigneGrille = true,
  showPrimeColumn = false,
}: {
  garanties: ReferenceOption[];
  selected: GarantieInput[];
  setSelected: (value: GarantieInput[]) => void;
  lignes: ReferenceOption[];
  vehiculeCount: number;
  showLigneGrille?: boolean;
  showPrimeColumn?: boolean;
}) {
  const byId = new Map(selected.map((item) => [item.garantieId, item]));
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
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-3 text-left"></th>
              <th className="px-3 py-3 text-left">Garantie</th>
              {vehiculeCount > 1 ? <th className="w-40 px-3 py-3 text-left">Véhicule</th> : null}
              <th className="w-44 px-3 py-3 text-left">Mode</th>
              <th className="w-48 px-3 py-3 text-left">Valeur assurée</th>
              <th className="w-36 px-3 py-3 text-left">Taux (%)</th>
              <th className="w-40 px-3 py-3 text-left">Franchise (%)</th>
              <th className="w-40 px-3 py-3 text-left">Min franchise</th>
              {showLigneGrille ? <th className="w-56 px-3 py-3 text-left">Ligne grille</th> : null}
              {showPrimeColumn ? <th className="w-40 px-3 py-3 text-left">Prime nette</th> : null}
            </tr>
          </thead>
          <tbody>
            {garanties.map((garantie) => {
              const item = byId.get(garantie.id);
              const checked = Boolean(item);
              const isRc = Boolean(garantie.responsabiliteCivile);
              const type = String(garantie.typeGarantie ?? "VEHICULE");
              const rowDisabled = !checked;

              return (
                <tr key={garantie.id} className="border-t align-middle">
                  <td className="px-3 py-2">
                    <Checkbox checked={checked} disabled={isRc} onCheckedChange={(value) => toggle(garantie, Boolean(value))} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                    <div className="mt-1 flex gap-1">
                      <Badge variant="outline">{type}</Badge>
                      {isRc ? <Badge>RC obligatoire</Badge> : null}
                    </div>
                  </td>
                  {vehiculeCount > 1 ? (
                    <td className="px-3 py-2">
                      {type === "VEHICULE" && !isRc ? (
                        <Select value={String(item?.vehiculeIndex ?? 0)} disabled={rowDisabled} onValueChange={(value) => update(garantie.id, { vehiculeIndex: Number(value) })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <Select value={item?.modeSelectionne ?? String(garantie.modeParDefaut ?? "TAUX")} disabled={rowDisabled || isRc} onValueChange={(value) => update(garantie.id, { modeSelectionne: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TAUX">Taux</SelectItem>
                        <SelectItem value="CAPITAL">Capital</SelectItem>
                        <SelectItem value="PRIME_FIXE">Prime fixe</SelectItem>
                        <SelectItem value="PROTECTION">Protection</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      disabled={rowDisabled || isRc}
                      value={item?.valeurAssuree ?? item?.capital ?? ""}
                      onChange={(event) => update(garantie.id, { valeurAssuree: numberValue(event.target.value), capital: numberValue(event.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" disabled={rowDisabled || isRc} value={item?.taux ?? ""} onChange={(event) => update(garantie.id, { taux: numberValue(event.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" disabled={rowDisabled || isRc || !garantie.avecFranchise} value={item?.tauxFranchise ?? ""} onChange={(event) => update(garantie.id, { tauxFranchise: numberValue(event.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" disabled={rowDisabled || isRc || !garantie.avecFranchise} value={item?.franchiseMinimale ?? ""} onChange={(event) => update(garantie.id, { franchiseMinimale: numberValue(event.target.value) })} />
                  </td>
                  {showLigneGrille ? (
                    <td className="px-3 py-2">
                      {!isRc ? (
                        <Select value={item?.ligneGrilleTarifaireId ?? ""} disabled={rowDisabled} onValueChange={(value) => update(garantie.id, { ligneGrilleTarifaireId: value })}>
                          <SelectTrigger><SelectValue placeholder="Option" /></SelectTrigger>
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
                  {showPrimeColumn ? (
                    <td className="px-3 py-2">
                      <Input type="number" disabled={rowDisabled} value={item?.prime ?? ""} onChange={(event) => update(garantie.id, { prime: numberValue(event.target.value) })} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

function numberValue(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
