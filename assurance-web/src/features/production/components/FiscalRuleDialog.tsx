import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./Field";
import { referenceApi } from "../api/references";
import type { FiscalRule, FiscalRuleBase, FiscalRuleMode, FiscalRuleNature, QuittanceCategory, UpsertFiscalRule } from "../api/fiscal-rules";

type Props = {
  open: boolean;
  rule: FiscalRule | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: UpsertFiscalRule) => void;
};

const NONE = "__none__";
const categories: QuittanceCategory[] = ["AUTOMOBILE", "CORPOREL", "EVCAT"];

export function FiscalRuleDialog({ open, rule, pending, onOpenChange, onSubmit }: Props) {
  const [form, setForm] = useState<UpsertFiscalRule>(() => emptyRule());
  const compagnies = useReference("compagnies-assurance", open);
  const garanties = useQuery({
    queryKey: ["referentiel", "garanties", "parametrage"],
    queryFn: () => referenceApi.configuredGuarantees(),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const usages = useReference("usages", open);
  const groupes = useReference("groupes-usage-attestation", open);

  useEffect(() => {
    if (open) setForm(rule ? fromRule(rule) : emptyRule());
  }, [open, rule]);

  const percentage = form.modeCalcul === "TAUX";
  const displayedValue = percentage ? percentageForInput(form.valeur) : form.valeur;

  const changeNature = (nature: FiscalRuleNature) => {
    const defaults = defaultsForNature(nature);
    setForm((current) => ({ ...current, nature, ...defaults }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Modifier la règle fiscale" : "Ajouter une règle fiscale"}</DialogTitle>
          <DialogDescription>Les dates de fin sont exclusives. Une règle plus précise remplace une règle générale.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Code" required>
            <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />
          </Field>
          <Field label="Libellé" required>
            <Input value={form.libelle} onChange={(event) => setForm({ ...form, libelle: event.target.value })} />
          </Field>
          <Field label="Nature" required>
            <EnumSelect value={form.nature} onChange={(value) => changeNature(value as FiscalRuleNature)} options={natureOptions} />
          </Field>
          <Field label="Mode de calcul" required>
            <EnumSelect value={form.modeCalcul} onChange={(value) => setForm({ ...form, modeCalcul: value as FiscalRuleMode })} options={modeOptions} disabled={form.nature === "CNPAC"} />
          </Field>
          <Field label={percentage ? "Taux (%)" : "Montant (MAD)"} required>
            <Input type="number" min="0" step={percentage ? "0.001" : "0.01"} value={Number.isFinite(displayedValue) ? displayedValue : 0}
              onChange={(event) => setForm({ ...form, valeur: Number(event.target.value || 0) / (percentage ? 100 : 1) })} />
          </Field>
          <Field label="Base de calcul" required>
            <EnumSelect value={form.baseCalcul} onChange={(value) => setForm(changeBase(form, value as FiscalRuleBase))} options={baseOptionsFor(form.nature)} disabled={form.nature !== "TAXE_ASSURANCE"} />
          </Field>

          {form.baseCalcul === "PRIME_CATEGORIE" ? (
            <Field label="Catégorie de base" required>
              <CategorySelect value={form.categorieBase ?? defaultCategoryBase(form.nature)}
                categories={categoryBasesFor(form.nature)}
                onChange={(categorieBase) => setForm({ ...form, categorieBase, categorieResultat: categorieBase })} />
            </Field>
          ) : null}
          <Field label="Catégorie de résultat" required>
            <CategorySelect value={form.categorieResultat} disabled={form.baseCalcul === "PRIME_CATEGORIE" || form.nature === "EVCAT" || form.nature === "CNPAC"}
              onChange={(categorieResultat) => setForm({ ...form, categorieResultat })} />
          </Field>
          <Field label="Compagnie">
            <ReferenceSelect value={form.compagnieAssuranceId} items={compagnies.data ?? []} onChange={(compagnieAssuranceId) => setForm({ ...form, compagnieAssuranceId })} />
          </Field>
          <Field label="Type de contrat">
            <EnumSelect nullable value={form.typeContrat ?? NONE} onChange={(value) => setForm({ ...form, typeContrat: value === NONE ? null : value as UpsertFiscalRule["typeContrat"] })} options={contractOptions} />
          </Field>

          {form.baseCalcul === "PRIME_GARANTIE" ? <>
            <Field label="Garantie">
              <ReferenceSelect value={form.garantieId} items={garanties.data ?? []} onChange={(garantieId) => setForm({ ...form, garantieId, typeGarantie: null })} />
            </Field>
            <Field label="Type de garantie">
              <EnumSelect nullable value={form.typeGarantie ?? NONE} onChange={(value) => setForm({ ...form, typeGarantie: value === NONE ? null : value as UpsertFiscalRule["typeGarantie"], garantieId: null })} options={guaranteeTypeOptions} />
            </Field>
            <Field label="Usage">
              <ReferenceSelect value={form.usageId} items={usages.data ?? []} onChange={(usageId) => setForm({ ...form, usageId })} />
            </Field>
            <Field label="Groupe d’usage stock">
              <ReferenceSelect value={form.groupeUsageAttestationId} items={groupes.data ?? []} onChange={(groupeUsageAttestationId) => setForm({ ...form, groupeUsageAttestationId })} />
            </Field>
          </> : null}

          <Field label="Début d’application" required>
            <DatePicker date={form.dateDebut} onSelect={(date) => setForm({ ...form, dateDebut: toDateOnly(date) })} />
          </Field>
          <Field label="Fin d’application (exclusive)">
            <DatePicker date={form.dateFin ?? undefined} minDate={form.dateDebut ? new Date(`${form.dateDebut}T00:00:00`) : undefined}
              onSelect={(date) => setForm({ ...form, dateFin: date ? toDateOnly(date) : null })} />
          </Field>
          <Field label="Priorité">
            <Input type="number" value={form.priorite} onChange={(event) => setForm({ ...form, priorite: Number(event.target.value || 0) })} />
          </Field>

          <Toggle label="Applicable" checked={form.applicable} onChange={(applicable) => setForm({ ...form, applicable })} />
          <Toggle label="Active" checked={form.actif} onChange={(actif) => setForm({ ...form, actif })} />
          <Field label="Référence réglementaire">
            <Input value={form.referenceReglementaire ?? ""} onChange={(event) => setForm({ ...form, referenceReglementaire: event.target.value || null })} />
          </Field>
          <Field label="Description" className="md:col-span-2 xl:col-span-3">
            <Textarea value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value || null })} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={pending || !isValid(form)} onClick={() => onSubmit(form)}>
            <Save className="size-4" /> Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useReference(path: string, enabled: boolean) {
  return useQuery({ queryKey: ["referentiel", path], queryFn: () => referenceApi.list(path), enabled, staleTime: 5 * 60_000 });
}

function EnumSelect({ value, options, onChange, disabled, nullable }: { value: string; options: [string, string][]; onChange: (value: string) => void; disabled?: boolean; nullable?: boolean }) {
  return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
    {nullable ? <SelectItem value={NONE}>Tous</SelectItem> : null}
    {options.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
  </SelectContent></Select>;
}

function CategorySelect({ value, onChange, categories: allowed = categories, disabled }: { value: QuittanceCategory; onChange: (value: QuittanceCategory) => void; categories?: QuittanceCategory[]; disabled?: boolean }) {
  return <EnumSelect value={value} disabled={disabled} onChange={(next) => onChange(next as QuittanceCategory)} options={allowed.map((item) => [item, categoryLabels[item]])} />;
}

function ReferenceSelect({ value, items, onChange }: { value?: string | null; items: { id: string; code?: string | null; libelle: string }[]; onChange: (value: string | null) => void }) {
  return <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? null : next)}><SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger><SelectContent>
    <SelectItem value={NONE}>Tous</SelectItem>
    {items.map((item) => <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} - ` : ""}{item.libelle}</SelectItem>)}
  </SelectContent></Select>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex h-9 items-center justify-between rounded-md border px-3"><span className="text-sm font-medium">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></div>;
}

function emptyRule(): UpsertFiscalRule {
  return { code: "", libelle: "", nature: "TAXE_ASSURANCE", modeCalcul: "TAUX", valeur: 0,
    baseCalcul: "PRIME_GARANTIE", categorieBase: null, categorieResultat: "AUTOMOBILE",
    compagnieAssuranceId: null, garantieId: null, typeGarantie: null, usageId: null,
    groupeUsageAttestationId: null, typeContrat: null, dateDebut: toDateOnly(new Date()), dateFin: null,
    applicable: true, priorite: 0, actif: true, description: null, referenceReglementaire: null };
}

function fromRule(rule: FiscalRule): UpsertFiscalRule {
  return {
    code: rule.code,
    libelle: rule.libelle,
    nature: rule.nature,
    modeCalcul: rule.modeCalcul,
    valeur: rule.valeur,
    baseCalcul: rule.baseCalcul,
    categorieBase: rule.categorieBase,
    categorieResultat: rule.categorieResultat,
    compagnieAssuranceId: rule.compagnieAssuranceId,
    garantieId: rule.garantieId,
    typeGarantie: rule.typeGarantie,
    usageId: rule.usageId,
    groupeUsageAttestationId: rule.groupeUsageAttestationId,
    typeContrat: rule.typeContrat,
    dateDebut: rule.dateDebut,
    dateFin: rule.dateFin,
    applicable: rule.applicable,
    priorite: rule.priorite,
    actif: rule.actif,
    description: rule.description,
    referenceReglementaire: rule.referenceReglementaire,
  };
}

function defaultsForNature(nature: FiscalRuleNature): Partial<UpsertFiscalRule> {
  if (nature === "CNPAC") return { modeCalcul: "MONTANT_FIXE", baseCalcul: "UNITE_ASSUREE", categorieBase: null, categorieResultat: "AUTOMOBILE", garantieId: null, typeGarantie: null, usageId: null, groupeUsageAttestationId: null };
  if (nature === "TPF") return { modeCalcul: "TAUX", baseCalcul: "PRIME_CATEGORIE", categorieBase: "AUTOMOBILE", categorieResultat: "AUTOMOBILE", garantieId: null, typeGarantie: null, usageId: null, groupeUsageAttestationId: null };
  if (nature === "EVCAT") return { modeCalcul: "TAUX", baseCalcul: "PRIME_GARANTIE", categorieBase: null, categorieResultat: "EVCAT" };
  return { modeCalcul: "TAUX", baseCalcul: "PRIME_GARANTIE", categorieBase: null, categorieResultat: "AUTOMOBILE" };
}

function changeBase(form: UpsertFiscalRule, baseCalcul: FiscalRuleBase): UpsertFiscalRule {
  if (baseCalcul === "PRIME_GARANTIE") {
    return { ...form, baseCalcul, categorieBase: null };
  }
  const categorieBase = defaultCategoryBase(form.nature);
  return { ...form, baseCalcul, categorieBase, categorieResultat: categorieBase,
    garantieId: null, typeGarantie: null, usageId: null, groupeUsageAttestationId: null };
}

function isValid(form: UpsertFiscalRule) {
  return Boolean(form.code.trim() && form.libelle.trim() && form.dateDebut && form.categorieResultat && form.valeur >= 0
    && (form.baseCalcul !== "PRIME_CATEGORIE" || form.categorieBase === form.categorieResultat)
    && (!form.dateFin || form.dateFin > form.dateDebut));
}

function toDateOnly(date?: Date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function percentageForInput(decimalValue: number) {
  if (!Number.isFinite(decimalValue)) return 0;
  return Number((decimalValue * 100).toFixed(8));
}

const natureOptions: [string, string][] = [["TAXE_ASSURANCE", "Taxe d’assurance"], ["TPF", "Taxe parafiscale"], ["EVCAT", "EVCAT"], ["CNPAC", "CNPAC"]];
const modeOptions: [string, string][] = [["TAUX", "Taux"], ["MONTANT_FIXE", "Montant fixe"]];
const baseOptions: [string, string][] = [["PRIME_GARANTIE", "Prime de garantie"], ["PRIME_CATEGORIE", "Prime de catégorie"], ["UNITE_ASSUREE", "Unité assurée"]];
const guaranteeTypeOptions: [string, string][] = [["VEHICULE", "Véhicule"], ["PERSONNE", "Personne"]];
const contractOptions: [string, string][] = [["PARTICULIER", "Particulier"], ["CONVENTION", "Convention"], ["FLOTTE", "Flotte"]];
const categoryLabels: Record<QuittanceCategory, string> = { AUTOMOBILE: "Automobile", CORPOREL: "Corporel", EVCAT: "EVCAT", ASSISTANCE: "Assistance" };

function baseOptionsFor(nature: FiscalRuleNature) {
  return nature === "CNPAC" ? baseOptions.slice(2) : baseOptions.slice(0, 2);
}

function categoryBasesFor(nature: FiscalRuleNature): QuittanceCategory[] {
  return nature === "TAXE_ASSURANCE" ? ["EVCAT"] : categories;
}

function defaultCategoryBase(nature: FiscalRuleNature): QuittanceCategory {
  return nature === "TAXE_ASSURANCE" ? "EVCAT" : "AUTOMOBILE";
}
