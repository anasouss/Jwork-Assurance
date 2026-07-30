import type { ReactNode } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import { AttestationNumberInput } from "./AttestationNumberInput";
import { MoneyInput } from "./MoneyInput";
import { SectionCard } from "./SectionCard";
import { VehicleRegistrationLookupInput } from "./VehicleRegistrationLookupInput";
import { toDateOnly } from "../date";
import { validateValeurVenale } from "../utils/vehicle-validation";
import type { ReferenceOption, VehiculeInput, VehiculeResponse } from "../types";
import type { ContratSectionKey } from "../contrat-creation/useContratCreationForm";

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
  compagnies = [],
  compagnieAssuranceId,
  marques,
  carrosseries,
  categoriesTransport,
  sousClasses,
  allowMultipleVehicules = true,
  showUsage = true,
  showAttestation = true,
  controleStockAttestation = true,
  showRemorqueFlag = false,
  errors = {},
  extraAction,
  onSaveSection,
  savedSections = {},
  saving = false,
  openSection,
  onSectionOpenChange,
}: {
  vehicules: VehiculeInput[];
  setVehicules: (vehicules: VehiculeInput[]) => void;
  usages: ReferenceOption[];
  compagnies?: ReferenceOption[];
  compagnieAssuranceId?: string | null;
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  sousClasses: ReferenceOption[];
  allowMultipleVehicules?: boolean;
  showUsage?: boolean;
  showAttestation?: boolean;
  controleStockAttestation?: boolean;
  showRemorqueFlag?: boolean;
  errors?: Record<string, string>;
  extraAction?: ReactNode;
  onSaveSection?: (section: "vehicule") => void;
  savedSections?: Partial<Record<"vehicule", boolean>>;
  saving?: boolean;
  openSection?: ContratSectionKey;
  onSectionOpenChange?: (section: ContratSectionKey, open: boolean) => void;
}) {
  const update = (index: number, patch: Partial<VehiculeInput>) => {
    setVehicules(vehicules.map((vehicule, idx) => (idx === index ? { ...vehicule, ...patch } : vehicule)));
  };

  const fillExistingVehicule = (index: number, found: VehiculeResponse) => {
    const current = vehicules[index];
    if (!current) {
      return;
    }
    const usageId = stringValue(found.usageId);
    const marqueId = stringValue(found.marqueId);
    const carrosserieId = stringValue(found.carrosserieId);
    const categorieTransportId = stringValue(found.categorieTransportId);
    const usageAllowed = usageId && usages.some((item) => item.id === usageId);
    update(index, {
      usageId: usageAllowed ? usageId : current.usageId,
      marqueId: marqueId || undefined,
      marqueLibelle: marqueId ? undefined : found.marque ?? undefined,
      carrosserieId: carrosserieId || undefined,
      carrosserieLibelle: carrosserieId ? undefined : found.carrosserie ?? undefined,
      categorieTransportId: categorieTransportId || undefined,
      carburant: found.carburant ?? undefined,
      puissanceFiscale: found.puissanceFiscale ?? undefined,
      nombrePlaces: found.nombrePlaces ?? undefined,
      sousClasse: found.sousClasse ?? undefined,
      ptc: found.ptc ?? undefined,
      datePremiereCirculation: found.datePremiereCirculation ?? undefined,
      dateExpirationCarteGrise: found.dateExpirationCarteGrise ?? undefined,
      crm: found.crm ?? undefined,
      valeurVenale: toOptionalNumber(found.valeurVenale),
      valeurNeuf: toOptionalNumber(found.valeurNeuf),
      valeurGlace: toOptionalNumber(found.valeurGlace),
    });
  };

  const headerActions = (
    <>
      {extraAction}
      {allowMultipleVehicules ? (
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
      ) : null}
    </>
  );

  return (
    <SectionCard
      title="Véhicule"
      badge={savedSections.vehicule ? "Validé" : `${vehicules.length} véhicule${vehicules.length > 1 ? "s" : ""}`}
      tone="production"
      open={openSection === "vehicule"}
      onOpenChange={(open) => onSectionOpenChange?.("vehicule", open)}
      action={extraAction || allowMultipleVehicules ? headerActions : null}
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
                  <Field label="Usage" required error={errors[`vehicules.${index}.usageId`]}>
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
                <Field label="Immatriculation" required error={errors[`vehicules.${index}.immatriculation`]}>
                  <VehicleRegistrationLookupInput
                    value={vehicule.immatriculation ?? ""}
                    onValueChange={(nextValue) => update(index, { immatriculation: nextValue })}
                    onVehicleFound={(found) => fillExistingVehicule(index, found)}
                  />
                </Field>
                <Field label="Marque" required error={errors[`vehicules.${index}.marqueId`]}>
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
                <Field label="Carrosserie" required error={errors[`vehicules.${index}.carrosserieId`]}>
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
                  <Field label="Carburant" required error={errors[`vehicules.${index}.carburant`]}>
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
                  <Field label="Puissance fiscale / cylindrée" required error={errors[`vehicules.${index}.puissanceFiscale`]}>
                    <Input value={vehicule.puissanceFiscale ?? ""} onChange={(event) => update(index, { puissanceFiscale: event.target.value })} />
                  </Field>
                ) : null}
                {needsSousClasse ? (
                  <Field label="Sous-classe" required error={errors[`vehicules.${index}.sousClasse`]}>
                    <AutocompleteSelect
                      value={vehicule.sousClasse ?? ""}
                      placeholder="Sous-classe"
                      emptyText="Aucune sous-classe trouvée"
                      invalidText="Sous-classe invalide : choisissez une option existante."
                      options={sousClasses.filter(isActiveReference).map((sousClasse) => ({
                        value: sousClasse.code ?? sousClasse.libelle,
                        label: sousClasse.code ? `${sousClasse.code} - ${sousClasse.libelle}` : sousClasse.libelle,
                        keywords: sousClasse.libelle,
                      }))}
                      onValueChange={(value) => update(index, { sousClasse: value || undefined })}
                    />
                  </Field>
                ) : null}
                {needsPtc ? (
                  <Field label="PTC" required error={errors[`vehicules.${index}.ptc`]}>
                    <Input value={vehicule.ptc ?? ""} onChange={(event) => update(index, { ptc: event.target.value })} />
                  </Field>
                ) : null}
                {needsCategorieTransport ? (
                  <Field label="Catégorie transport" required error={errors[`vehicules.${index}.categorieTransportId`]}>
                    <Select value={vehicule.categorieTransportId ?? ""} onValueChange={(value) => update(index, { categorieTransportId: value })}>
                      <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                      <SelectContent>
                        {categoriesTransport.map((categorie) => <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                <Field label="Nombre de places" required error={errors[`vehicules.${index}.nombrePlaces`]}>
                  <Input value={vehicule.nombrePlaces ?? ""} onChange={(event) => update(index, { nombrePlaces: event.target.value })} />
                </Field>
                <Field label="Date mise en circulation">
                  <DatePicker date={vehicule.datePremiereCirculation} onSelect={(date) => update(index, { datePremiereCirculation: toDateOnly(date) })} />
                </Field>
                <Field label="Date validité CG" error={errors[`vehicules.${index}.dateExpirationCarteGrise`]}>
                  <DatePicker date={vehicule.dateExpirationCarteGrise} onSelect={(date) => update(index, { dateExpirationCarteGrise: toDateOnly(date) })} />
                </Field>
                {showAttestation ? (
                  <Field label="N° attestation">
                    <AttestationNumberInput
                      value={vehicule.numeroAttestation ?? ""}
                      onChange={(value) => update(index, { numeroAttestation: value })}
                      compagnieAssuranceId={compagnieAssuranceId}
                      usageId={vehicule.usageId}
                      compagnies={compagnies}
                      usages={usages}
                      controleStock={controleStockAttestation}
                      required={controleStockAttestation && Boolean(usage?.consommeAttestation)}
                    />
                  </Field>
                ) : null}
                <Field label="Valeur à neuf" error={errors[`vehicules.${index}.valeurNeuf`]}>
                  <MoneyInput className="text-right" value={vehicule.valeurNeuf} onValueChange={(value) => update(index, { valeurNeuf: value })} />
                </Field>
                <Field label="Valeur vénale" error={errors[`vehicules.${index}.valeurVenale`] ?? validateValeurVenale(vehicule)}>
                  <MoneyInput className="text-right" value={vehicule.valeurVenale} onValueChange={(value) => update(index, { valeurVenale: value })} />
                </Field>
                <Field label="Valeur glace">
                  <MoneyInput className="text-right" value={vehicule.valeurGlace} onValueChange={(value) => update(index, { valeurGlace: value })} />
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
                    <MoneyInput value={vehicule.montantCredit} onValueChange={(value) => update(index, { montantCredit: value })} />
                  </Field>
                  <Field label="Date fin crédit">
                    <DatePicker date={vehicule.dateFinCredit} onSelect={(date) => update(index, { dateFinCredit: toDateOnly(date) })} />
                  </Field>
                </div>
              ) : null}
            </div>
          );
        })}
        {onSaveSection ? (
          <div className="flex justify-end border-t pt-3">
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={saving}
              onClick={() => onSaveSection("vehicule")}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function stringValue(value: unknown) {
  return value === undefined || value === null ? undefined : String(value);
}

function toOptionalNumber(value: unknown) {
  return typeof value === "number" ? value : value === undefined || value === null || value === "" ? undefined : Number(value);
}

function isActiveReference(option: ReferenceOption) {
  return option.actif !== false;
}
