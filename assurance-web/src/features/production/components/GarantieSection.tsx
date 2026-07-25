import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import { SectionCard } from "./SectionCard";
import type { GarantieInput, ReferenceOption } from "../types";

export function GarantieSection({
  garanties,
  selected,
  setSelected,
  lignes,
  vehiculeCount,
  showLigneGrille = true,
}: {
  garanties: ReferenceOption[];
  selected: GarantieInput[];
  setSelected: (value: GarantieInput[]) => void;
  lignes: ReferenceOption[];
  vehiculeCount: number;
  showLigneGrille?: boolean;
}) {
  const byId = new Map(selected.map((item) => [item.garantieId, item]));
  const update = (garantieId: string, patch: Partial<GarantieInput>) => {
    setSelected(selected.map((item) => (item.garantieId === garantieId ? { ...item, ...patch } : item)));
  };

  return (
    <SectionCard title="Garanties" badge={`${selected.length} sélectionnée${selected.length > 1 ? "s" : ""}`}>
      <div className="grid gap-3">
        {garanties.map((garantie) => {
          const item = byId.get(garantie.id);
          const checked = Boolean(item);
          const type = String(garantie.typeGarantie ?? "VEHICULE");
          const sources = [
            garantie.requiertValeurVenale ? "VENALE" : null,
            garantie.requiertValeurNeuf ? "NEUF" : null,
            garantie.requiertValeurGlace ? "GLACE" : null,
            garantie.saisieManuelleAutorisee || garantie.avecCapital ? "MANUEL" : null,
          ].filter(Boolean) as string[];
          return (
            <div key={garantie.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => {
                      if (value) {
                        setSelected([
                          ...selected,
                          {
                            garantieId: garantie.id,
                            vehiculeIndex: type === "VEHICULE" && vehiculeCount > 0 ? 0 : undefined,
                            modeSelectionne: String(garantie.modeParDefaut ?? (type === "PERSONNE" ? "PROTECTION" : "TAUX")),
                            sourceValeurSelectionnee: String(garantie.sourceValeurParDefaut ?? sources[0] ?? "AUCUNE"),
                          },
                        ]);
                      } else {
                        setSelected(selected.filter((selectedItem) => selectedItem.garantieId !== garantie.id));
                      }
                    }}
                  />
                  <div>
                    <div className="text-sm font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                    <div className="mt-1 flex gap-1">
                      <Badge variant="outline">{type}</Badge>
                      {garantie.responsabiliteCivile ? <Badge>RC</Badge> : null}
                    </div>
                  </div>
                </div>
              </div>
              {checked && item ? (
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  {type === "VEHICULE" && vehiculeCount > 0 ? (
                    <Field label="Véhicule">
                      <Select value={String(item.vehiculeIndex ?? 0)} onValueChange={(value) => update(garantie.id, { vehiculeIndex: Number(value) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: vehiculeCount }).map((_, index) => <SelectItem key={index} value={String(index)}>Véhicule {index + 1}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}
                  <Field label="Mode">
                    <Select value={item.modeSelectionne ?? ""} onValueChange={(value) => update(garantie.id, { modeSelectionne: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TAUX">Taux</SelectItem>
                        <SelectItem value="CAPITAL">Capital</SelectItem>
                        <SelectItem value="PRIME_FIXE">Prime fixe</SelectItem>
                        <SelectItem value="PROTECTION">Protection</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Source valeur">
                    <Select value={item.sourceValeurSelectionnee ?? "AUCUNE"} onValueChange={(value) => update(garantie.id, { sourceValeurSelectionnee: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUCUNE">Aucune</SelectItem>
                        <SelectItem value="VENALE">Vénale</SelectItem>
                        <SelectItem value="NEUF">Neuf</SelectItem>
                        <SelectItem value="GLACE">Glace</SelectItem>
                        <SelectItem value="MANUEL">Manuel</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {showLigneGrille ? (
                    <Field label="Ligne grille">
                      <Select value={item.ligneGrilleTarifaireId ?? ""} onValueChange={(value) => update(garantie.id, { ligneGrilleTarifaireId: value })}>
                        <SelectTrigger><SelectValue placeholder="Option" /></SelectTrigger>
                        <SelectContent>
                          {lignes
                            .filter((ligne) => !ligne.garantieId || ligne.garantieId === garantie.id)
                            .map((ligne) => <SelectItem key={ligne.id} value={ligne.id}>{ligne.libelle}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}
                  <Field label="Prime / capital">
                    <Input
                      type="number"
                      value={item.prime ?? item.capital ?? ""}
                      onChange={(event) => update(garantie.id, { prime: numberValue(event.target.value), capital: numberValue(event.target.value) })}
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function numberValue(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
