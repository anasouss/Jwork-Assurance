import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Field } from "../components/Field";
import { SectionCard } from "../components/SectionCard";
import { emptyVehicule } from "../components/VehiculeSection";
import { toDateOnly } from "../date";
import { money, numberValue } from "../utils/format";
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
  vehicules: VehiculeInput[];
  setVehicules: Dispatch<SetStateAction<VehiculeInput[]>>;
  remorques: RemorqueInput[];
  setRemorques: Dispatch<SetStateAction<RemorqueInput[]>>;
  garanties: ReferenceOption[];
  selectedGaranties: GarantieInput[];
  setSelectedGaranties: Dispatch<SetStateAction<GarantieInput[]>>;
  lignes: ReferenceOption[];
  formulesPersonne: ReferenceOption[];
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  grilleSelected: boolean;
  maxRemorques?: number | null;
  errors?: Record<string, string>;
};

export function FlotteTargetsSection({
  vehicules,
  setVehicules,
  remorques,
  setRemorques,
  garanties,
  selectedGaranties,
  setSelectedGaranties,
  lignes,
  formulesPersonne,
  usages,
  marques,
  carrosseries,
  categoriesTransport,
  grilleSelected,
  maxRemorques,
  errors = {},
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
  const [activeKey, setActiveKey] = useState(targetKey(targets[0]));
  const activeTarget = targets.find((target) => targetKey(target) === activeKey) ?? targets[0];
  const vehiculeGaranties = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "VEHICULE") !== "PERSONNE"),
    [garanties]
  );
  const personneGaranties = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "") === "PERSONNE"),
    [garanties]
  );
  const canAddRemorque = maxRemorques == null || remorques.length < maxRemorques;
  const vehiculeTargets = targets.filter((target) => target.kind === "vehicule");
  const remorqueTargets = targets.filter((target) => target.kind === "remorque");
  const activeVehiculeTarget =
    vehiculeTargets.find((target) => targetKey(target) === activeKey) ?? vehiculeTargets[0];
  const activeRemorqueTarget =
    remorqueTargets.find((target) => targetKey(target) === activeKey) ?? remorqueTargets[0];

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
    setSelectedGaranties((current) => {
      const additions: GarantieInput[] = [];
      for (const target of targets) {
        for (const garantie of rcGaranties) {
          if (!current.some((item) => item.garantieId === garantie.id && sameTarget(item, target))) {
            additions.push(targetedInput(garantie, target));
          }
        }
      }
      return additions.length === 0 ? current : [...current, ...additions];
    });
  }, [setSelectedGaranties, targets, vehiculeGaranties]);

  const addVehicle = () => {
    setVehicules((current) => {
      const next = [...current, emptyVehicule()];
      setActiveKey(`vehicule:${next.length - 1}`);
      return next;
    });
  };

  const addRemorque = () => {
    setRemorques((current) => {
      const next = [...current, {}];
      setActiveKey(`remorque:${next.length - 1}`);
      return next;
    });
  };

  const removeTarget = (target?: Target) => {
    if (!target) {
      return;
    }
    if (target.kind === "vehicule" && vehicules.length > 1) {
      setVehicules((current) => current.filter((_, index) => index !== target.index));
      setSelectedGaranties((current) =>
        current
          .filter((item) => item.vehiculeIndex !== target.index)
          .map((item) =>
            item.vehiculeIndex !== undefined && item.vehiculeIndex > target.index
              ? { ...item, vehiculeIndex: item.vehiculeIndex - 1 }
              : item
          )
      );
    }
    if (target.kind === "remorque") {
      setRemorques((current) => current.filter((_, index) => index !== target.index));
      setSelectedGaranties((current) =>
        current
          .filter((item) => item.remorqueIndex !== target.index)
          .map((item) =>
            item.remorqueIndex !== undefined && item.remorqueIndex > target.index
              ? { ...item, remorqueIndex: item.remorqueIndex - 1 }
              : item
          )
      );
    }
  };

  return (
    <>
      <SectionCard title="Véhicules" badge={`${vehicules.length} véhicule${vehicules.length > 1 ? "s" : ""}`} tone="production">
        <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
          <div className="grid content-start gap-3">
            <div className="grid gap-2">
              {vehiculeTargets.map((target) => {
                const active = targetKey(target) === targetKey(activeVehiculeTarget);
                return (
                  <button
                    key={targetKey(target)}
                    type="button"
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      active ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "hover:bg-muted/60"
                    )}
                    onClick={() => setActiveKey(targetKey(target))}
                  >
                    <span className="font-medium">{target.label}</span>
                    <Badge variant="secondary">
                      {selectedGaranties.filter((item) => sameTarget(item, target)).length}
                    </Badge>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={addVehicle}>
                <Plus className="size-4" />
                Véhicule
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!activeVehiculeTarget || vehicules.length === 1}
                onClick={() => removeTarget(activeVehiculeTarget)}
              >
                <Trash2 className="size-4" />
                Retirer
              </Button>
            </div>
          </div>

          {activeVehiculeTarget ? (
            <VehicleForm
              index={activeVehiculeTarget.index}
              vehicule={vehicules[activeVehiculeTarget.index]}
              setVehicules={setVehicules}
              usages={usages}
              marques={marques}
              carrosseries={carrosseries}
              categoriesTransport={categoriesTransport}
              errors={errors}
            />
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Remorques" badge={`${remorques.length} remorque${remorques.length > 1 ? "s" : ""}`} tone="production" defaultOpen={remorques.length > 0}>
        <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
          <div className="grid content-start gap-3">
            {remorqueTargets.length > 0 ? (
              <div className="grid gap-2">
                {remorqueTargets.map((target) => {
                  const active = targetKey(target) === targetKey(activeRemorqueTarget);
                  return (
                    <button
                      key={targetKey(target)}
                      type="button"
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        active ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "hover:bg-muted/60"
                      )}
                      onClick={() => setActiveKey(targetKey(target))}
                    >
                      <span className="font-medium">{target.label}</span>
                      <Badge variant="secondary">
                        {selectedGaranties.filter((item) => sameTarget(item, target)).length}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Aucune remorque ajoutée.
              </div>
            )}
            <div className="grid gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="sm" disabled={!canAddRemorque} onClick={addRemorque}>
                <Plus className="size-4" />
                Remorque
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!activeRemorqueTarget}
                onClick={() => removeTarget(activeRemorqueTarget)}
              >
                <Trash2 className="size-4" />
                Retirer
              </Button>
            </div>
          </div>

          {activeRemorqueTarget ? (
            <RemorqueForm
              index={activeRemorqueTarget.index}
              remorque={remorques[activeRemorqueTarget.index]}
              setRemorques={setRemorques}
              usages={usages}
              marques={marques}
            />
          ) : (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Ajoutez une remorque pour renseigner ses informations.
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Garanties" badge={`${selectedGaranties.length} sélectionnée${selectedGaranties.length > 1 ? "s" : ""}`} tone="production">
        <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
          <div className="grid content-start gap-3">
          <div className="grid gap-2">
            {targets.map((target) => {
              const active = targetKey(target) === targetKey(activeTarget);
              const count = selectedGaranties.filter((item) => sameTarget(item, target)).length;
              return (
                <button
                  key={targetKey(target)}
                  type="button"
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    active ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "hover:bg-muted/60"
                  )}
                  onClick={() => setActiveKey(targetKey(target))}
                >
                  <span className="font-medium">{target.label}</span>
                  <Badge variant="secondary">{count}</Badge>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4">
          {activeTarget ? (
            <TargetGuaranteesTable
              target={activeTarget}
              garanties={vehiculeGaranties}
              personneGaranties={personneGaranties}
              selected={selectedGaranties}
              setSelected={setSelectedGaranties}
              lignes={lignes}
              formulesPersonne={formulesPersonne}
              usages={usages}
              grilleSelected={grilleSelected}
            />
          ) : null}
        </div>
      </div>
      </SectionCard>
    </>
  );
}

function VehicleForm({
  index,
  vehicule,
  setVehicules,
  usages,
  marques,
  carrosseries,
  categoriesTransport,
  errors,
}: {
  index: number;
  vehicule: VehiculeInput;
  setVehicules: Dispatch<SetStateAction<VehiculeInput[]>>;
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  errors: Record<string, string>;
}) {
  const usage = usages.find((item) => item.id === vehicule.usageId);
  const needsCarburantAndPf = Boolean(usage?.byCarburantAndPf);
  const needsSousClasse = Boolean(usage?.bySousClasse);
  const needsPtc = Boolean(usage?.byPtc);
  const needsCategorieTransport = Boolean(usage?.byCategorieTransport);
  const update = (patch: Partial<VehiculeInput>) => {
    setVehicules((current) => current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 text-sm font-semibold">Informations véhicule</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
              update({
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
        <Field label="Immatriculation" required>
          <Input value={vehicule.immatriculation ?? ""} onChange={(event) => update({ immatriculation: event.target.value })} />
        </Field>
        <Field label="Marque" required>
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
        <Field label="Carrosserie" required>
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
        {needsCarburantAndPf ? (
          <Field label="Carburant" required>
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
        {needsCarburantAndPf ? (
          <Field label="Puissance fiscale / cylindrée" required>
            <Input value={vehicule.puissanceFiscale ?? ""} onChange={(event) => update({ puissanceFiscale: event.target.value })} />
          </Field>
        ) : null}
        {needsSousClasse ? (
          <Field label="Sous-classe" required>
            <Input value={vehicule.sousClasse ?? ""} onChange={(event) => update({ sousClasse: event.target.value })} />
          </Field>
        ) : null}
        {needsPtc ? (
          <Field label="PTC" required>
            <Input value={vehicule.ptc ?? ""} onChange={(event) => update({ ptc: event.target.value })} />
          </Field>
        ) : null}
        {needsCategorieTransport ? (
          <Field label="Catégorie transport" required>
            <Select value={vehicule.categorieTransportId ?? ""} onValueChange={(value) => update({ categorieTransportId: value })}>
              <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                {categoriesTransport.map((categorie) => <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label="Modèle">
          <Input value={vehicule.modele ?? ""} onChange={(event) => update({ modele: event.target.value })} />
        </Field>
        <Field label="Nombre de places">
          <Input value={vehicule.nombrePlaces ?? ""} onChange={(event) => update({ nombrePlaces: event.target.value })} />
        </Field>
        <Field label="Date mise en circulation">
          <DatePicker date={vehicule.datePremiereCirculation} onSelect={(date) => update({ datePremiereCirculation: toDateOnly(date) })} />
        </Field>
        <Field label="Date validité CG" required error={errors[`vehicules.${index}.dateExpirationCarteGrise`]}>
          <DatePicker date={vehicule.dateExpirationCarteGrise} onSelect={(date) => update({ dateExpirationCarteGrise: toDateOnly(date) })} />
        </Field>
        <Field label="N° attestation">
          <Input value={vehicule.numeroAttestation ?? ""} onChange={(event) => update({ numeroAttestation: event.target.value })} />
        </Field>
        <Field label="Valeur vénale">
          <Input type="number" value={vehicule.valeurVenale ?? ""} onChange={(event) => update({ valeurVenale: numberValue(event.target.value) })} />
        </Field>
        <Field label="Valeur à neuf" error={errors[`vehicules.${index}.valeurNeuf`]}>
          <Input type="number" value={vehicule.valeurNeuf ?? ""} onChange={(event) => update({ valeurNeuf: numberValue(event.target.value) })} />
        </Field>
        <Field label="Valeur glace">
          <Input type="number" value={vehicule.valeurGlace ?? ""} onChange={(event) => update({ valeurGlace: numberValue(event.target.value) })} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Checkbox checked={Boolean(vehicule.organismeCredit)} onCheckedChange={(checked) => update({ organismeCredit: Boolean(checked) })} />
        <span className="text-sm">Organisme de crédit</span>
      </div>
      {vehicule.organismeCredit ? (
        <div className="mt-3 grid max-w-3xl gap-3 md:grid-cols-2">
          <Field label="Nom organisme">
            <Input value={vehicule.nomOrganismeCredit ?? ""} onChange={(event) => update({ nomOrganismeCredit: event.target.value })} />
          </Field>
          <Field label="Date fin crédit">
            <DatePicker date={vehicule.dateFinCredit} onSelect={(date) => update({ dateFinCredit: toDateOnly(date) })} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function RemorqueForm({
  index,
  remorque,
  setRemorques,
  usages,
  marques,
}: {
  index: number;
  remorque: RemorqueInput;
  setRemorques: Dispatch<SetStateAction<RemorqueInput[]>>;
  usages: ReferenceOption[];
  marques: ReferenceOption[];
}) {
  const update = (patch: Partial<RemorqueInput>) => {
    setRemorques((current) => current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 text-sm font-semibold">Informations remorque</div>
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
        <Field label="Modèle">
          <Input value={remorque.modele ?? ""} onChange={(event) => update({ modele: event.target.value })} />
        </Field>
        <Field label="PTC">
          <Input value={remorque.ptc ?? ""} onChange={(event) => update({ ptc: event.target.value })} />
        </Field>
        <Field label="Date mise en circulation">
          <DatePicker date={remorque.dateMiseEnCirculation} onSelect={(date) => update({ dateMiseEnCirculation: toDateOnly(date) })} />
        </Field>
        <Field label="Date d'effet">
          <DatePicker date={remorque.dateEffet} onSelect={(date) => update({ dateEffet: toDateOnly(date) })} />
        </Field>
        <Field label="Date d'échéance">
          <DatePicker date={remorque.dateEcheance} onSelect={(date) => update({ dateEcheance: toDateOnly(date) })} />
        </Field>
        <Field label="CRM">
          <Input value={remorque.crm ?? ""} onChange={(event) => update({ crm: event.target.value })} />
        </Field>
        <Field label="N° attestation">
          <Input value={remorque.numeroAttestation ?? ""} onChange={(event) => update({ numeroAttestation: event.target.value })} />
        </Field>
        <Field label="Valeur assurée">
          <Input type="number" value={remorque.valeurAssuree ?? ""} onChange={(event) => update({ valeurAssuree: numberValue(event.target.value) })} />
        </Field>
      </div>
    </div>
  );
}

function TargetGuaranteesTable({
  target,
  garanties,
  personneGaranties,
  selected,
  setSelected,
  lignes,
  formulesPersonne,
  usages,
  grilleSelected,
}: {
  target: Target;
  garanties: ReferenceOption[];
  personneGaranties: ReferenceOption[];
  selected: GarantieInput[];
  setSelected: Dispatch<SetStateAction<GarantieInput[]>>;
  lignes: ReferenceOption[];
  formulesPersonne: ReferenceOption[];
  usages: ReferenceOption[];
  grilleSelected: boolean;
}) {
  const update = (garantieId: string, patch: Partial<GarantieInput>) => {
    setSelected((current) => current.map((item) => (item.garantieId === garantieId && sameTarget(item, target) ? { ...item, ...patch } : item)));
  };

  const toggle = (garantie: ReferenceOption, checked: boolean) => {
    if (Boolean(garantie.responsabiliteCivile)) {
      return;
    }
    setSelected((current) => checked
      ? [...current, targetedInput(garantie, target)]
      : current.filter((item) => !(item.garantieId === garantie.id && sameTarget(item, target))));
  };

  const togglePersonne = (garantie: ReferenceOption, checked: boolean) => {
    const formules = matchingPersonneFormules(formulesPersonne, garantie, target);
    setSelected((current) =>
      checked
        ? [
            ...current,
            {
              ...targetedInput(garantie, target),
              modeSelectionne: "PROTECTION",
              sourceValeurSelectionnee: "AUCUNE",
              formuleGarantiePersonneId: formules[0]?.id,
              formule: String(formules[0]?.libelle ?? garantie.code ?? garantie.libelle),
              prime: numberValue(String(formules[0]?.primeNette ?? "")),
            },
          ]
        : current.filter((item) => !(item.garantieId === garantie.id && sameTarget(item, target)))
    );
  };

  const usage = target.kind === "vehicule" ? usages.find((item) => item.id === target.usageId) : undefined;
  const showPersonne = target.kind === "vehicule" && Boolean(usage?.garantiesPersonne) && personneGaranties.length > 0;

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-md border">
        <div className="border-b px-3 py-2 text-sm font-semibold">Garanties véhicule</div>
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
            {garanties.map((garantie) => {
              const item = selected.find((selectedItem) => selectedItem.garantieId === garantie.id && sameTarget(selectedItem, target));
              const checked = Boolean(item);
              const isRc = Boolean(garantie.responsabiliteCivile);
              const hasLine = isRc || matchingLines(lignes, garantie, target).length > 0;
              const disabled = isRc || !grilleSelected || !hasLine;
              const editable = checked && !isRc;
              const warning = checked ? valueWarning(garantie, target) : "";

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
                    <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => toggle(garantie, Boolean(value))} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {isRc ? <Badge>RC obligatoire</Badge> : null}
                      {!isRc && !grilleSelected ? <Badge variant="outline">Grille requise</Badge> : null}
                      {!isRc && grilleSelected && !hasLine ? <Badge variant="outline">Tarif manquant</Badge> : null}
                      {warning ? <Badge variant="destructive">{warning}</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      disabled={!editable}
                      className={controlClass(editable)}
                      value={item?.valeurAssuree ?? item?.capital ?? ""}
                      onChange={(event) => update(garantie.id, { valeurAssuree: numberValue(event.target.value), capital: numberValue(event.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" disabled={!editable} className={controlClass(editable)} value={item?.taux ?? ""} onChange={(event) => update(garantie.id, { taux: numberValue(event.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" disabled={!editable || !garantie.avecFranchise} className={controlClass(editable && Boolean(garantie.avecFranchise))} value={item?.tauxFranchise ?? ""} onChange={(event) => update(garantie.id, { tauxFranchise: numberValue(event.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" disabled={!editable || !garantie.avecFranchise} className={controlClass(editable && Boolean(garantie.avecFranchise))} value={item?.franchiseMinimale ?? ""} onChange={(event) => update(garantie.id, { franchiseMinimale: numberValue(event.target.value) })} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{checked ? "Calcul auto" : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showPersonne ? (
        <div className="overflow-x-auto rounded-md border">
          <div className="border-b px-3 py-2 text-sm font-semibold">Garanties personne</div>
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-12 px-3 py-3 text-left" />
                <th className="px-3 py-3 text-left">Garantie</th>
                <th className="w-56 px-3 py-3 text-left">Formule</th>
                <th className="w-32 px-3 py-3 text-left">Décès</th>
                <th className="w-32 px-3 py-3 text-left">Invalidité</th>
                <th className="w-32 px-3 py-3 text-left">Frais médicaux</th>
                <th className="w-32 px-3 py-3 text-left">Prime nette</th>
              </tr>
            </thead>
            <tbody>
              {personneGaranties.map((garantie) => {
                const item = selected.find((selectedItem) => selectedItem.garantieId === garantie.id && sameTarget(selectedItem, target));
                const checked = Boolean(item);
                const formules = matchingPersonneFormules(formulesPersonne, garantie, target);
                const selectedFormule = formules.find((formule) => formule.id === item?.formuleGarantiePersonneId) ?? formules[0];
                const disabled = !grilleSelected || formules.length === 0;

                return (
                  <tr
                    key={garantie.id}
                    className={cn(
                      "border-t align-middle transition-colors",
                      !checked && "bg-muted/20 text-muted-foreground",
                      checked && "bg-background"
                    )}
                  >
                    <td className="px-3 py-2">
                      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => togglePersonne(garantie, Boolean(value))} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {!grilleSelected ? <Badge variant="outline">Grille requise</Badge> : null}
                        {grilleSelected && formules.length === 0 ? <Badge variant="outline">Formule manquante</Badge> : null}
                      </div>
                    </td>
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
                    <td className="px-3 py-2">{money(selectedFormule?.montantDeces)}</td>
                    <td className="px-3 py-2">{money(selectedFormule?.montantInvalidite)}</td>
                    <td className="px-3 py-2">{money(selectedFormule?.montantFraisMedicaux)}</td>
                    <td className="px-3 py-2">{money(selectedFormule?.primeNette)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : target.kind === "vehicule" ? (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Les garanties personne s'affichent uniquement pour les usages autorisés dans Paramètres production.
        </div>
      ) : null}
    </div>
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

function matchingPersonneFormules(formules: ReferenceOption[], garantie: ReferenceOption, target?: Target) {
  if (!target || target.kind !== "vehicule") {
    return [];
  }
  return formules.filter((formule) => {
    if (formule.garantieId !== garantie.id) {
      return false;
    }
    return !formule.usageId || formule.usageId === target.usageId;
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
