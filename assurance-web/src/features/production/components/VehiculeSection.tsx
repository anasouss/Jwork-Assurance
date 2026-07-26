import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import { SectionCard } from "./SectionCard";
import { toDateOnly } from "../date";
import { numberValue } from "../utils/format";
import { validateValeurVenale } from "../utils/vehicle-validation";
import type { ReferenceOption, VehiculeInput } from "../types";

export function emptyVehicule(usageId?: string): VehiculeInput {
  return {
    typeVehicule: "AUTOMOBILE",
    usageId,
    carburant: "ESSENCE",
    coefficientProrata: 1,
  };
}

export function VehiculeSection({
  vehicules,
  setVehicules,
  usages,
  marques,
  carrosseries,
  categoriesTransport,
  allowMultipleVehicules = true,
  showUsage = true,
  showAttestation = true,
  showRemorqueFlag = false,
  errors = {},
}: {
  vehicules: VehiculeInput[];
  setVehicules: (vehicules: VehiculeInput[]) => void;
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  allowMultipleVehicules?: boolean;
  showUsage?: boolean;
  showAttestation?: boolean;
  showRemorqueFlag?: boolean;
  errors?: Record<string, string>;
}) {
  const update = (index: number, patch: Partial<VehiculeInput>) => {
    setVehicules(vehicules.map((vehicule, idx) => (idx === index ? { ...vehicule, ...patch } : vehicule)));
  };

  return (
    <SectionCard
      title="Véhicule"
      badge={`${vehicules.length} véhicule${vehicules.length > 1 ? "s" : ""}`}
      tone="production"
      action={
        allowMultipleVehicules ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/50 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            onClick={() => setVehicules([...vehicules, emptyVehicule()])}
          >
            <Plus className="size-4" />
            Véhicule
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4">
        {vehicules.map((vehicule, index) => {
          const usage = usages.find((item) => item.id === vehicule.usageId);
          const needsCarburantAndPf = Boolean(usage?.byCarburantAndPf);
          const needsSousClasse = Boolean(usage?.bySousClasse);
          const needsPtc = Boolean(usage?.byPtc);
          const needsCategorieTransport = Boolean(usage?.byCategorieTransport);
          return (
            <div key={index} className="rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium">Véhicule {index + 1}</div>
                {allowMultipleVehicules && vehicules.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setVehicules(vehicules.filter((_, idx) => idx !== index))}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {showUsage ? (
                  <Field label="Usage" required>
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
                        update(index, {
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
                ) : null}
                <Field label="Immatriculation" required>
                  <Input value={vehicule.immatriculation ?? ""} onChange={(event) => update(index, { immatriculation: event.target.value })} />
                </Field>
                <Field label="Marque" required>
                  <AutocompleteSelect
                    value={vehicule.marqueId ?? ""}
                    customValue={vehicule.marqueLibelle}
                    allowCustomValue
                    placeholder="Marque"
                    emptyText="Aucune marque trouvée"
                    options={marques.map((marque) => ({ value: marque.id, label: marque.libelle, keywords: marque.code }))}
                    onValueChange={(value) => update(index, { marqueId: value || undefined, marqueLibelle: undefined })}
                    onCustomValueChange={(value) => update(index, { marqueId: undefined, marqueLibelle: value })}
                  />
                </Field>
                <Field label="Carrosserie" required>
                  <AutocompleteSelect
                    value={vehicule.carrosserieId ?? ""}
                    customValue={vehicule.carrosserieLibelle}
                    allowCustomValue
                    placeholder="Carrosserie"
                    emptyText="Aucune carrosserie trouvée"
                    options={carrosseries.map((carrosserie) => ({ value: carrosserie.id, label: carrosserie.libelle, keywords: carrosserie.code }))}
                    onValueChange={(value) => update(index, { carrosserieId: value || undefined, carrosserieLibelle: undefined })}
                    onCustomValueChange={(value) => update(index, { carrosserieId: undefined, carrosserieLibelle: value })}
                  />
                </Field>
                {needsCarburantAndPf ? (
                  <Field label="Carburant" required>
                    <Select value={vehicule.carburant ?? ""} onValueChange={(value) => update(index, { carburant: value })}>
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
                {needsCarburantAndPf ? (
                  <Field label="Puissance fiscale / cylindrée" required>
                    <Input value={vehicule.puissanceFiscale ?? ""} onChange={(event) => update(index, { puissanceFiscale: event.target.value })} />
                  </Field>
                ) : null}
                {needsSousClasse ? (
                  <Field label="Sous-classe" required>
                    <Input value={vehicule.sousClasse ?? ""} onChange={(event) => update(index, { sousClasse: event.target.value })} />
                  </Field>
                ) : null}
                {needsPtc ? (
                  <Field label="PTC" required>
                    <Input value={vehicule.ptc ?? ""} onChange={(event) => update(index, { ptc: event.target.value })} />
                  </Field>
                ) : null}
                {needsCategorieTransport ? (
                  <Field label="Catégorie transport" required>
                    <Select value={vehicule.categorieTransportId ?? ""} onValueChange={(value) => update(index, { categorieTransportId: value })}>
                      <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                      <SelectContent>
                        {categoriesTransport.map((categorie) => <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                <Field label="Nombre de places">
                  <Input value={vehicule.nombrePlaces ?? ""} onChange={(event) => update(index, { nombrePlaces: event.target.value })} />
                </Field>
                <Field label="Date mise en circulation">
                  <DatePicker date={vehicule.datePremiereCirculation} onSelect={(date) => update(index, { datePremiereCirculation: toDateOnly(date) })} />
                </Field>
                <Field label="Date validité CG" required error={errors[`vehicules.${index}.dateExpirationCarteGrise`]}>
                  <DatePicker date={vehicule.dateExpirationCarteGrise} onSelect={(date) => update(index, { dateExpirationCarteGrise: toDateOnly(date) })} />
                </Field>
                {showAttestation ? (
                  <Field label="N° attestation">
                    <Input value={vehicule.numeroAttestation ?? ""} onChange={(event) => update(index, { numeroAttestation: event.target.value })} />
                  </Field>
                ) : null}
                <Field label="Valeur à neuf" error={errors[`vehicules.${index}.valeurNeuf`]}>
                  <Input type="number" value={vehicule.valeurNeuf ?? ""} onChange={(event) => update(index, { valeurNeuf: numberValue(event.target.value) })} />
                </Field>
                <Field label="Valeur vénale" error={errors[`vehicules.${index}.valeurVenale`] ?? validateValeurVenale(vehicule)}>
                  <Input type="number" value={vehicule.valeurVenale ?? ""} onChange={(event) => update(index, { valeurVenale: numberValue(event.target.value) })} />
                </Field>
                <Field label="Valeur glace">
                  <Input type="number" value={vehicule.valeurGlace ?? ""} onChange={(event) => update(index, { valeurGlace: numberValue(event.target.value) })} />
                </Field>
                <Field label="CRM" required error={errors[`vehicules.${index}.crm`]}>
                  <Input value={vehicule.crm ?? ""} onChange={(event) => update(index, { crm: event.target.value })} />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
                {showRemorqueFlag ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={Boolean(vehicule.remorque)} onCheckedChange={(checked) => update(index, { remorque: Boolean(checked) })} />
                    <span>Remorque</span>
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(vehicule.organismeCredit)}
                    onCheckedChange={(checked) =>
                      update(index, Boolean(checked)
                        ? { organismeCredit: true }
                        : { organismeCredit: false, nomOrganismeCredit: undefined, montantCredit: undefined, dateFinCredit: undefined })
                    }
                  />
                  <span>Organisme de crédit</span>
                </label>
              </div>
              {vehicule.organismeCredit ? (
                <div className="mt-3 grid max-w-5xl gap-3 md:grid-cols-3">
                  <Field label="Nom organisme">
                    <Input value={vehicule.nomOrganismeCredit ?? ""} onChange={(event) => update(index, { nomOrganismeCredit: event.target.value })} />
                  </Field>
                  <Field label="Montant de crédit">
                    <Input type="number" value={vehicule.montantCredit ?? ""} onChange={(event) => update(index, { montantCredit: numberValue(event.target.value) })} />
                  </Field>
                  <Field label="Date fin crédit">
                    <DatePicker date={vehicule.dateFinCredit} onSelect={(date) => update(index, { dateFinCredit: toDateOnly(date) })} />
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
