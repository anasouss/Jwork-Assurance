import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import { SectionCard } from "./SectionCard";
import { toDateOnly } from "../date";
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
}: {
  vehicules: VehiculeInput[];
  setVehicules: (vehicules: VehiculeInput[]) => void;
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  allowMultipleVehicules?: boolean;
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
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Usage" required>
                  <Select
                    value={vehicule.usageId ?? ""}
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
                  >
                    <SelectTrigger><SelectValue placeholder="Usage" /></SelectTrigger>
                    <SelectContent>
                      {usages.map((usage) => <SelectItem key={usage.id} value={usage.id}>{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Immatriculation" required>
                  <Input value={vehicule.immatriculation ?? ""} onChange={(event) => update(index, { immatriculation: event.target.value })} />
                </Field>
                <Field label="Marque" required>
                  <Select value={vehicule.marqueId ?? ""} onValueChange={(value) => update(index, { marqueId: value })}>
                    <SelectTrigger><SelectValue placeholder="Marque" /></SelectTrigger>
                    <SelectContent>
                      {marques.map((marque) => <SelectItem key={marque.id} value={marque.id}>{marque.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Carrosserie" required>
                  <Select value={vehicule.carrosserieId ?? ""} onValueChange={(value) => update(index, { carrosserieId: value })}>
                    <SelectTrigger><SelectValue placeholder="Carrosserie" /></SelectTrigger>
                    <SelectContent>
                      {carrosseries.map((carrosserie) => <SelectItem key={carrosserie.id} value={carrosserie.id}>{carrosserie.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
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
                <Field label="Modèle">
                  <Input value={vehicule.modele ?? ""} onChange={(event) => update(index, { modele: event.target.value })} />
                </Field>
                <Field label="Places">
                  <Input value={vehicule.nombrePlaces ?? ""} onChange={(event) => update(index, { nombrePlaces: event.target.value })} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Date mise en circulation">
                  <DatePicker date={vehicule.datePremiereCirculation} onSelect={(date) => update(index, { datePremiereCirculation: toDateOnly(date) })} />
                </Field>
                <Field label="Date validité CG" required>
                  <DatePicker date={vehicule.dateExpirationCarteGrise} onSelect={(date) => update(index, { dateExpirationCarteGrise: toDateOnly(date) })} />
                </Field>
                <Field label="N° attestation">
                  <Input value={vehicule.numeroAttestation ?? ""} onChange={(event) => update(index, { numeroAttestation: event.target.value })} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Valeur vénale">
                  <Input type="number" value={vehicule.valeurVenale ?? ""} onChange={(event) => update(index, { valeurVenale: numberValue(event.target.value) })} />
                </Field>
                <Field label="Valeur à neuf">
                  <Input type="number" value={vehicule.valeurNeuf ?? ""} onChange={(event) => update(index, { valeurNeuf: numberValue(event.target.value) })} />
                </Field>
                <Field label="Valeur glace">
                  <Input type="number" value={vehicule.valeurGlace ?? ""} onChange={(event) => update(index, { valeurGlace: numberValue(event.target.value) })} />
                </Field>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Checkbox checked={Boolean(vehicule.organismeCredit)} onCheckedChange={(checked) => update(index, { organismeCredit: Boolean(checked) })} />
                <span className="text-sm">Organisme de crédit</span>
              </div>
              {vehicule.organismeCredit ? (
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <Field label="Nom organisme">
                    <Input value={vehicule.nomOrganismeCredit ?? ""} onChange={(event) => update(index, { nomOrganismeCredit: event.target.value })} />
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

function numberValue(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
