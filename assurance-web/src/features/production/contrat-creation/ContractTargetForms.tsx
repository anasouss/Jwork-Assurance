import type { Dispatch, SetStateAction } from "react";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AttestationNumberInput } from "../components/AttestationNumberInput";
import { Field } from "../components/Field";
import { MoneyInput } from "../components/MoneyInput";
import { VehicleRegistrationLookupInput } from "../components/VehicleRegistrationLookupInput";
import { toDateOnly } from "../date";
import type { ReferenceOption, RemorqueInput, VehiculeInput, VehiculeResponse } from "../types";
import { validateValeurVenale } from "../utils/vehicle-validation";

type VehicleFormProps = {
  index: number;
  vehicule: VehiculeInput;
  setVehicules: Dispatch<SetStateAction<VehiculeInput[]>>;
  usages: ReferenceOption[];
  compagnies: ReferenceOption[];
  compagnieAssuranceId?: string | null;
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  sousClasses: ReferenceOption[];
  tarifsUsage?: ReferenceOption[];
  crmPartage: boolean;
  crmPartageValeur: string;
  showCrm: boolean;
  prospectionMode: boolean;
  controleStockAttestation: boolean;
  errors: Record<string, string>;
};

export function VehicleForm({
  index,
  vehicule,
  setVehicules,
  usages,
  compagnies,
  compagnieAssuranceId,
  marques,
  carrosseries,
  categoriesTransport,
  sousClasses,
  tarifsUsage = [],
  crmPartage,
  crmPartageValeur,
  showCrm,
  prospectionMode,
  controleStockAttestation,
  errors,
}: VehicleFormProps) {
  const usage = usages.find((item) => item.id === vehicule.usageId);
  const needsCarburantAndPf = Boolean(usage?.byCarburantAndPf);
  const needsSousClasse = Boolean(usage?.bySousClasse);
  const availableSousClasses = tariffedSousClasses(sousClasses, tarifsUsage, vehicule.usageId);
  const selectedSousClasse = sousClasses.find((item) => item.code === vehicule.sousClasse);
  const usesCylindree = needsSousClasse && selectedSousClasse?.champMoteur === "CYLINDREE";
  const needsMotorField = needsCarburantAndPf || (needsSousClasse && Boolean(selectedSousClasse));
  const needsPtc = Boolean(usage?.byPtc);
  const needsCategorieTransport = Boolean(usage?.byCategorieTransport);
  const update = (patch: Partial<VehiculeInput>) => {
    setVehicules((current) => current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const fillExistingVehicule = (found: VehiculeResponse) => {
    const usageId = stringValue(found.usageId);
    const marqueId = stringValue(found.marqueId);
    const carrosserieId = stringValue(found.carrosserieId);
    const categorieTransportId = stringValue(found.categorieTransportId);
    const usageAllowed = usageId && usages.some((item) => item.id === usageId);
    update({
      usageId: usageAllowed ? usageId : vehicule.usageId,
      marqueId: marqueId || undefined,
      marqueLibelle: marqueId ? undefined : found.marque ?? undefined,
      carrosserieId: carrosserieId || undefined,
      carrosserieLibelle: carrosserieId ? undefined : found.carrosserie ?? undefined,
      categorieTransportId: categorieTransportId || undefined,
      carburant: found.carburant ?? undefined,
      puissanceFiscale: found.puissanceFiscale ?? undefined,
      cylindree: found.cylindree ?? undefined,
      nombrePlaces: found.nombrePlaces ?? undefined,
      sousClasse: found.sousClasse ?? undefined,
      ptc: found.ptc ?? undefined,
      datePremiereCirculation: found.datePremiereCirculation ?? undefined,
      dateExpirationCarteGrise: found.dateExpirationCarteGrise ?? undefined,
      crm: crmPartage ? crmPartageValeur || undefined : found.crm ?? undefined,
      valeurVenale: toOptionalNumber(found.valeurVenale),
      valeurNeuf: toOptionalNumber(found.valeurNeuf),
      valeurGlace: toOptionalNumber(found.valeurGlace),
    });
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            onValueChange={(value) => update({
              usageId: value,
              categorieTransportId: undefined,
              carburant: undefined,
              puissanceFiscale: undefined,
              cylindree: undefined,
              sousClasse: undefined,
              ptc: undefined,
            })}
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
            onValueChange={(value) => update({ marqueId: value || undefined, marqueLibelle: undefined })}
            onCustomValueChange={(value) => update({ marqueId: undefined, marqueLibelle: value })}
          />
        </Field>
        <Field label="Immatriculation" required error={errors[`vehicules.${index}.immatriculation`]}>
          <VehicleRegistrationLookupInput
            value={vehicule.immatriculation ?? ""}
            onValueChange={(nextValue) => update({ immatriculation: nextValue })}
            onVehicleFound={fillExistingVehicule}
          />
        </Field>
        <Field label="Date mise en circulation">
          <DatePicker date={vehicule.datePremiereCirculation} onSelect={(date) => update({ datePremiereCirculation: toDateOnly(date) })} />
        </Field>
        <Field label="Date validité CG" required error={errors[`vehicules.${index}.dateExpirationCarteGrise`]}>
          <DatePicker date={vehicule.dateExpirationCarteGrise} onSelect={(date) => update({ dateExpirationCarteGrise: toDateOnly(date) })} />
        </Field>
        <Field label="Nombre de places" required error={errors[`vehicules.${index}.nombrePlaces`]}>
          <Input className="text-right" value={vehicule.nombrePlaces ?? ""} onChange={(event) => update({ nombrePlaces: event.target.value })} />
        </Field>
        {needsMotorField ? (
          <Field
            label={usesCylindree ? "Cylindrée" : "Puissance fiscale"}
            required
            error={errors[`vehicules.${index}.${usesCylindree ? "cylindree" : "puissanceFiscale"}`]}
          >
            <Input
              className="text-right"
              value={usesCylindree ? vehicule.cylindree ?? "" : vehicule.puissanceFiscale ?? ""}
              onChange={(event) => update(usesCylindree
                ? { cylindree: event.target.value }
                : { puissanceFiscale: event.target.value })}
            />
          </Field>
        ) : null}
        {needsCarburantAndPf ? (
          <Field label="Carburant" required error={errors[`vehicules.${index}.carburant`]}>
            <Select value={vehicule.carburant ?? ""} onValueChange={(value) => update({ carburant: value })}>
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
        <Field label="Carrosserie" required error={errors[`vehicules.${index}.carrosserieId`]}>
          <AutocompleteSelect
            value={vehicule.carrosserieId ?? ""}
            customValue={vehicule.carrosserieLibelle}
            allowCustomValue
            placeholder="Carrosserie"
            emptyText="Aucune carrosserie trouvée"
            options={carrosseries.map((carrosserie) => ({ value: carrosserie.id, label: carrosserie.libelle, keywords: carrosserie.code }))}
            onValueChange={(value) => update({ carrosserieId: value || undefined, carrosserieLibelle: undefined })}
            onCustomValueChange={(value) => update({ carrosserieId: undefined, carrosserieLibelle: value })}
          />
        </Field>
        {needsSousClasse ? (
          <Field label="Sous-classe" required error={errors[`vehicules.${index}.sousClasse`]}>
            <AutocompleteSelect
              value={vehicule.sousClasse ?? ""}
              placeholder="Sous-classe"
              emptyText="Aucune sous-classe trouvée"
              invalidText="Sous-classe invalide : choisissez une option existante."
              options={availableSousClasses.map((sousClasse) => ({
                value: sousClasse.code ?? sousClasse.libelle,
                label: sousClasse.code ? `${sousClasse.code} - ${sousClasse.libelle}` : sousClasse.libelle,
                keywords: sousClasse.libelle,
              }))}
              onValueChange={(value) => update({
                sousClasse: value || undefined,
                puissanceFiscale: undefined,
                cylindree: undefined,
              })}
            />
          </Field>
        ) : null}
        {needsPtc ? (
          <Field label="PTC" required error={errors[`vehicules.${index}.ptc`]}>
            <Input className="text-right" value={vehicule.ptc ?? ""} onChange={(event) => update({ ptc: event.target.value })} />
          </Field>
        ) : null}
        {needsCategorieTransport ? (
          <Field label="Catégorie transport" required error={errors[`vehicules.${index}.categorieTransportId`]}>
            <Select value={vehicule.categorieTransportId ?? ""} onValueChange={(value) => update({ categorieTransportId: value })}>
              <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                {categoriesTransport.map((categorie) => <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {!prospectionMode ? (
          <Field label="N° attestation">
            <AttestationNumberInput
              value={vehicule.numeroAttestation ?? ""}
              onChange={(value) => update({ numeroAttestation: value })}
              numeroCourant={vehicule.numeroAttestationInitiale}
              compagnieAssuranceId={compagnieAssuranceId}
              usageId={vehicule.usageId}
              compagnies={compagnies}
              usages={usages}
              controleStock={controleStockAttestation}
              required={controleStockAttestation && Boolean(usages.find((item) => item.id === vehicule.usageId)?.consommeAttestation)}
            />
          </Field>
        ) : null}
        <Field label="Valeur à neuf" error={errors[`vehicules.${index}.valeurNeuf`]}>
          <MoneyInput className="text-right" value={vehicule.valeurNeuf} onValueChange={(value) => update({ valeurNeuf: value })} />
        </Field>
        <Field label="Valeur vénale" error={errors[`vehicules.${index}.valeurVenale`] ?? validateValeurVenale(vehicule)}>
          <MoneyInput className="text-right" value={vehicule.valeurVenale} onValueChange={(value) => update({ valeurVenale: value })} />
        </Field>
        <Field label="Valeur glace">
          <MoneyInput className="text-right" value={vehicule.valeurGlace} onValueChange={(value) => update({ valeurGlace: value })} />
        </Field>
        {showCrm ? (
          <Field label="CRM" required error={errors[`vehicules.${index}.crm`]}>
            <Input
              value={crmPartage ? crmPartageValeur : vehicule.crm ?? ""}
              readOnly={crmPartage}
              className={cn("text-right", crmPartage ? "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400" : undefined)}
              onChange={(event) => update({ crm: event.target.value })}
            />
          </Field>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Checkbox
          checked={Boolean(vehicule.organismeCredit)}
          onCheckedChange={(checked) => update(checked
            ? { organismeCredit: true }
            : { organismeCredit: false, nomOrganismeCredit: undefined, montantCredit: undefined, dateFinCredit: undefined })}
        />
        <span className="text-sm">Organisme de crédit</span>
      </div>
      {vehicule.organismeCredit ? (
        <div className="mt-3 grid max-w-5xl gap-3 md:grid-cols-3">
          <Field label="Nom organisme">
            <Input value={vehicule.nomOrganismeCredit ?? ""} onChange={(event) => update({ nomOrganismeCredit: event.target.value })} />
          </Field>
          <Field label="Montant de crédit">
            <MoneyInput className="text-right" value={vehicule.montantCredit} onValueChange={(value) => update({ montantCredit: value })} />
          </Field>
          <Field label="Date fin crédit">
            <DatePicker date={vehicule.dateFinCredit} onSelect={(date) => update({ dateFinCredit: toDateOnly(date) })} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

type RemorqueFormProps = {
  index: number;
  remorque: RemorqueInput;
  setRemorques: Dispatch<SetStateAction<RemorqueInput[]>>;
  usages: ReferenceOption[];
  compagnies: ReferenceOption[];
  compagnieAssuranceId?: string | null;
  marques: ReferenceOption[];
  prospectionMode: boolean;
  controleStockAttestation: boolean;
  lockContractDates: boolean;
};

export function RemorqueForm({
  index,
  remorque,
  setRemorques,
  usages,
  compagnies,
  compagnieAssuranceId,
  marques,
  prospectionMode,
  controleStockAttestation,
  lockContractDates,
}: RemorqueFormProps) {
  const update = (patch: Partial<RemorqueInput>) => {
    setRemorques((current) => current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Usage" required>
          <AutocompleteSelect
            value={remorque.usageId ?? ""}
            placeholder="Usage remorque"
            emptyText="Aucun usage trouvé"
            invalidText="Usage invalide : choisissez une option existante."
            options={usages.map((usage) => ({
              value: usage.id,
              label: usage.code ? `${usage.code} - ${usage.libelle}` : usage.libelle,
              keywords: usage.code,
            }))}
            onValueChange={(value) => update({ usageId: value })}
          />
        </Field>
        <Field label="Immatriculation">
          <Input value={remorque.immatriculation ?? ""} onChange={(event) => update({ immatriculation: event.target.value })} />
        </Field>
        <Field label="Marque">
          <AutocompleteSelect
            value={remorque.marqueId ?? ""}
            customValue={remorque.marqueLibelle}
            allowCustomValue
            placeholder="Marque"
            emptyText="Aucune marque trouvée"
            options={marques.map((marque) => ({ value: marque.id, label: marque.libelle, keywords: marque.code }))}
            onValueChange={(value) => update({ marqueId: value || undefined, marqueLibelle: undefined })}
            onCustomValueChange={(value) => update({ marqueId: undefined, marqueLibelle: value })}
          />
        </Field>
        <Field label="PTC">
          <Input className="text-right" value={remorque.ptc ?? ""} onChange={(event) => update({ ptc: event.target.value })} />
        </Field>
        <Field label="Date mise en circulation">
          <DatePicker date={remorque.dateMiseEnCirculation} onSelect={(date) => update({ dateMiseEnCirculation: toDateOnly(date) })} />
        </Field>
        <Field label="Date d'effet">
          <DatePicker disabled={lockContractDates} date={remorque.dateEffet} onSelect={(date) => update({ dateEffet: toDateOnly(date) })} />
        </Field>
        <Field label="Date d'échéance">
          <DatePicker disabled={lockContractDates} date={remorque.dateEcheance} onSelect={(date) => update({ dateEcheance: toDateOnly(date) })} />
        </Field>
        <Field label="CRM">
          <Input className="text-right" value={remorque.crm ?? ""} onChange={(event) => update({ crm: event.target.value })} />
        </Field>
        {!prospectionMode ? (
          <Field label="N° attestation">
            <AttestationNumberInput
              value={remorque.numeroAttestation ?? ""}
              onChange={(value) => update({ numeroAttestation: value })}
              numeroCourant={remorque.numeroAttestationInitiale}
              compagnieAssuranceId={compagnieAssuranceId}
              usageId={remorque.usageId}
              compagnies={compagnies}
              usages={usages}
              controleStock={controleStockAttestation}
              required={controleStockAttestation && Boolean(usages.find((usage) => usage.id === remorque.usageId)?.consommeAttestation)}
            />
          </Field>
        ) : null}
        <Field label="Valeur assurée">
          <MoneyInput className="text-right" value={remorque.valeurAssuree} onValueChange={(value) => update({ valeurAssuree: value })} />
        </Field>
      </div>
    </div>
  );
}

function stringValue(value: unknown) {
  return value == null ? "" : String(value);
}

function isActiveReference(option: ReferenceOption) {
  return option.actif !== false;
}

function tariffedSousClasses(
  sousClasses: ReferenceOption[],
  tarifsUsage: ReferenceOption[],
  usageId?: string,
) {
  const activeSousClasses = sousClasses.filter(isActiveReference);
  if (!usageId || tarifsUsage.length === 0) {
    return activeSousClasses;
  }
  const configuredIds = new Set(
    tarifsUsage
      .filter((tarif) => String(tarif.usageId ?? "") === usageId && tarif.actif !== false)
      .map((tarif) => String(tarif.sousClasseId ?? ""))
      .filter(Boolean),
  );
  return activeSousClasses.filter((sousClasse) => configuredIds.has(sousClasse.id));
}

function toOptionalNumber(value: unknown) {
  return typeof value === "number" ? value : value === undefined || value === null || value === "" ? undefined : Number(value);
}
