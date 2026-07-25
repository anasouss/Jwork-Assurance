import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Field } from "../components/Field";
import { SectionCard } from "../components/SectionCard";
import type { CreateContratRequest } from "../types";
import type { ContratCreationFormState } from "./useContratCreationForm";

type Props = {
  form: ContratCreationFormState;
  badge: string;
  showConvention?: boolean;
  showGrille?: boolean;
  allowSaisiePrimeNette?: boolean;
};

export function ContractInfoSection({
  form,
  badge,
  showConvention = false,
  showGrille = true,
  allowSaisiePrimeNette = false,
}: Props) {
  const filteredConventions = (form.refs.conventions.data ?? []).filter(
    (convention) => !form.compagnieAssuranceId || convention.compagnieAssuranceId === form.compagnieAssuranceId
  );
  const filteredGrilles = (form.refs.grilles.data ?? []).filter(
    (grille) => !form.compagnieAssuranceId || grille.compagnieAssuranceId === form.compagnieAssuranceId
  );

  return (
    <SectionCard title="Contrat" badge={badge} tone="production" defaultOpen={false}>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Compagnie">
          <Select value={form.compagnieAssuranceId} onValueChange={form.setCompagnieAssuranceId}>
            <SelectTrigger><SelectValue placeholder="Compagnie" /></SelectTrigger>
            <SelectContent>
              {form.refs.compagnies.data?.map((item) => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {showConvention ? (
          <Field label="Convention / produit">
            <Select value={form.conventionId} onValueChange={form.setConventionId}>
              <SelectTrigger><SelectValue placeholder="Convention" /></SelectTrigger>
              <SelectContent>
                {filteredConventions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} - ` : ""}{item.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label="Usage contrat">
          <Select value={form.usageId} onValueChange={form.setUsageId}>
            <SelectTrigger><SelectValue placeholder="Usage" /></SelectTrigger>
            <SelectContent>
              {form.refs.usages.data?.map((item) => <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} - ` : ""}{item.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {showGrille ? (
          <Field label="Grille tarifaire">
            <Select value={form.grilleTarifaireId} onValueChange={form.setGrilleTarifaireId}>
              <SelectTrigger><SelectValue placeholder="Grille" /></SelectTrigger>
              <SelectContent>
                {filteredGrilles.map((item) => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label="N° contrat">
          <Input value={form.numeroContrat} onChange={(event) => form.setNumeroContrat(event.target.value)} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Field label="N° police">
          <Input value={form.numeroPolice} onChange={(event) => form.setNumeroPolice(event.target.value)} />
        </Field>
        <Field label="N° attestation">
          <Input value={form.numeroAttestation} onChange={(event) => form.setNumeroAttestation(event.target.value)} />
        </Field>
        <Field label="Date effet">
          <DatePicker date={form.dateEffet} onSelect={(date) => form.setDateEffet(toIso(date))} />
        </Field>
        <Field label="Date échéance">
          <DatePicker date={form.dateEcheance} onSelect={(date) => form.setDateEcheance(toIso(date))} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Field label="Fractionnement">
          <Select value={form.fractionnement} onValueChange={(value) => form.setFractionnement(value as CreateContratRequest["fractionnement"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ANNUEL">Annuel</SelectItem>
              <SelectItem value="SEMESTRIEL">Semestriel</SelectItem>
              <SelectItem value="TRIMESTRIEL">Trimestriel</SelectItem>
              <SelectItem value="MENSUEL">Mensuel</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {allowSaisiePrimeNette ? (
          <div className="flex items-end gap-2 pb-2">
            <Switch checked={form.saisiePrimeNette} onCheckedChange={form.setSaisiePrimeNette} />
            <span className="text-sm">Saisie prime nette</span>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function toIso(date?: Date) {
  return date ? date.toISOString().slice(0, 10) : undefined;
}
