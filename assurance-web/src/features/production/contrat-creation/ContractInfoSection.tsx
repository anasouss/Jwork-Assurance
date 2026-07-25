import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../components/Field";
import { SectionCard } from "../components/SectionCard";
import { toDateOnly } from "../date";
import type { CreateContratRequest } from "../types";
import type { ContratCreationFormState } from "./useContratCreationForm";

type Props = {
  form: ContratCreationFormState;
  badge: string;
  showConvention?: boolean;
  showGrille?: boolean;
};

export function ContractInfoSection({
  form,
  badge,
  showConvention = false,
  showGrille = true,
}: Props) {
  const filteredConventions = (form.refs.conventions.data ?? []).filter(
    (convention) => !form.compagnieAssuranceId || convention.compagnieAssuranceId === form.compagnieAssuranceId
  );
  const filteredGrilles = (form.refs.grilles.data ?? []).filter(
    (grille) => !form.compagnieAssuranceId || grille.compagnieAssuranceId === form.compagnieAssuranceId
  );
  const souscripteur = form.clients.find((client) => client.role === "SOUSCRIPTEUR");
  const categorieClientId = souscripteur?.client.categorieClientId ?? "";
  const selectedCategorie = (form.refs.categoriesClient.data ?? []).find((categorie) => categorie.id === categorieClientId);

  return (
    <SectionCard title="Contrat" badge={badge} tone="production" defaultOpen={false}>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Catégorie">
          {categorieClientId ? (
            <Input value={selectedCategorie?.libelle ?? "Catégorie sélectionnée"} disabled />
          ) : (
            <Select
              value={categorieClientId}
              onValueChange={(value) =>
                form.setClients(
                  form.clients.map((client) =>
                    client.role === "SOUSCRIPTEUR"
                      ? { ...client, client: { ...client.client, categorieClientId: value } }
                      : client
                  )
                )
              }
            >
              <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                {form.refs.categoriesClient.data?.map((item) => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </Field>
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
          <DatePicker date={form.dateEffet} onSelect={(date) => form.setDateEffet(toDateOnly(date))} />
        </Field>
        <Field label="Date échéance">
          <DatePicker date={form.dateEcheance} onSelect={(date) => form.setDateEcheance(toDateOnly(date))} />
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
      </div>
    </SectionCard>
  );
}
