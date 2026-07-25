import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import { SectionCard } from "./SectionCard";
import type { ReferenceOption, RemorqueInput, VehiculeInput } from "../types";

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
  remorques,
  setVehicules,
  setRemorques,
  usages,
  marques,
  carrosseries,
  categoriesTransport,
  allowMultipleVehicules = true,
}: {
  vehicules: VehiculeInput[];
  remorques: RemorqueInput[];
  setVehicules: (vehicules: VehiculeInput[]) => void;
  setRemorques: (remorques: RemorqueInput[]) => void;
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
      title="Véhicules et remorques"
      badge={`${vehicules.length} véhicule${vehicules.length > 1 ? "s" : ""}`}
      action={
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setRemorques([...remorques, {}])}>
            <Plus className="size-4" />
            Remorque
          </Button>
          {allowMultipleVehicules ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setVehicules([...vehicules, emptyVehicule()])}>
              <Plus className="size-4" />
              Véhicule
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-4">
        {vehicules.map((vehicule, index) => {
          const usage = usages.find((item) => item.id === vehicule.usageId);
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
                <Field label="Usage">
                  <Select value={vehicule.usageId ?? ""} onValueChange={(value) => update(index, { usageId: value, categorieTransportId: undefined })}>
                    <SelectTrigger><SelectValue placeholder="Usage" /></SelectTrigger>
                    <SelectContent>
                      {usages.map((usage) => <SelectItem key={usage.id} value={usage.id}>{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Marque">
                  <Select value={vehicule.marqueId ?? ""} onValueChange={(value) => update(index, { marqueId: value })}>
                    <SelectTrigger><SelectValue placeholder="Marque" /></SelectTrigger>
                    <SelectContent>
                      {marques.map((marque) => <SelectItem key={marque.id} value={marque.id}>{marque.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Carrosserie">
                  <Select value={vehicule.carrosserieId ?? ""} onValueChange={(value) => update(index, { carrosserieId: value })}>
                    <SelectTrigger><SelectValue placeholder="Carrosserie" /></SelectTrigger>
                    <SelectContent>
                      {carrosseries.map((carrosserie) => <SelectItem key={carrosserie.id} value={carrosserie.id}>{carrosserie.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                {needsCategorieTransport ? (
                  <Field label="Catégorie transport">
                    <Select value={vehicule.categorieTransportId ?? ""} onValueChange={(value) => update(index, { categorieTransportId: value })}>
                      <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                      <SelectContent>
                        {categoriesTransport.map((categorie) => <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <Field label="Immatriculation">
                    <Input value={vehicule.immatriculation ?? ""} onChange={(event) => update(index, { immatriculation: event.target.value })} />
                  </Field>
                )}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {needsCategorieTransport ? (
                  <Field label="Immatriculation">
                    <Input value={vehicule.immatriculation ?? ""} onChange={(event) => update(index, { immatriculation: event.target.value })} />
                  </Field>
                ) : null}
                <Field label="Modèle">
                  <Input value={vehicule.modele ?? ""} onChange={(event) => update(index, { modele: event.target.value })} />
                </Field>
                <Field label="Carburant">
                  <Select value={vehicule.carburant ?? ""} onValueChange={(value) => update(index, { carburant: value })}>
                    <SelectTrigger><SelectValue placeholder="Carburant" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ESSENCE">Essence</SelectItem>
                      <SelectItem value="DIESEL">Diesel</SelectItem>
                      <SelectItem value="HYBRIDE">Hybride</SelectItem>
                      <SelectItem value="ELECTRIQUE">Électrique</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Puissance fiscale">
                  <Input value={vehicule.puissanceFiscale ?? ""} onChange={(event) => update(index, { puissanceFiscale: event.target.value })} />
                </Field>
                <Field label="Places">
                  <Input value={vehicule.nombrePlaces ?? ""} onChange={(event) => update(index, { nombrePlaces: event.target.value })} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="PTC">
                  <Input value={vehicule.ptc ?? ""} onChange={(event) => update(index, { ptc: event.target.value })} />
                </Field>
                <Field label="Sous-classe">
                  <Input value={vehicule.sousClasse ?? ""} onChange={(event) => update(index, { sousClasse: event.target.value })} />
                </Field>
                <Field label="Date effet">
                  <DatePicker date={vehicule.dateEffet} onSelect={(date) => update(index, { dateEffet: toIso(date) })} />
                </Field>
                <Field label="Date échéance">
                  <DatePicker date={vehicule.dateEcheance} onSelect={(date) => update(index, { dateEcheance: toIso(date) })} />
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
                <Field label="N° attestation">
                  <Input value={vehicule.numeroAttestation ?? ""} onChange={(event) => update(index, { numeroAttestation: event.target.value })} />
                </Field>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Checkbox checked={Boolean(vehicule.organismeCredit)} onCheckedChange={(checked) => update(index, { organismeCredit: Boolean(checked) })} />
                <span className="text-sm">Organisme de crédit</span>
              </div>
            </div>
          );
        })}
        {remorques.map((remorque, index) => (
          <div key={index} className="rounded-lg border border-dashed p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">Remorque {index + 1}</div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setRemorques(remorques.filter((_, idx) => idx !== index))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Usage">
                <Select value={remorque.usageId ?? ""} onValueChange={(value) => setRemorques(remorques.map((item, idx) => idx === index ? { ...item, usageId: value } : item))}>
                  <SelectTrigger><SelectValue placeholder="Usage remorque" /></SelectTrigger>
                  <SelectContent>
                    {usages.map((usage) => <SelectItem key={usage.id} value={usage.id}>{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Immatriculation">
                <Input value={remorque.immatriculation ?? ""} onChange={(event) => setRemorques(remorques.map((item, idx) => idx === index ? { ...item, immatriculation: event.target.value } : item))} />
              </Field>
              <Field label="PTC">
                <Input value={remorque.ptc ?? ""} onChange={(event) => setRemorques(remorques.map((item, idx) => idx === index ? { ...item, ptc: event.target.value } : item))} />
              </Field>
              <Field label="Valeur assurée">
                <Input type="number" value={remorque.valeurAssuree ?? ""} onChange={(event) => setRemorques(remorques.map((item, idx) => idx === index ? { ...item, valeurAssuree: numberValue(event.target.value) } : item))} />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function toIso(date?: Date) {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

function numberValue(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
