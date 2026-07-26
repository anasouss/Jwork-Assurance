import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { EcheanceInput } from "@/components/ui/echeance-input";
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
  showFractionnement?: boolean;
};

export function ContractInfoSection({
  form,
  badge,
  showConvention = false,
  showGrille = true,
  showFractionnement = true,
}: Props) {
  const filteredConventions = (form.refs.conventions.data ?? []).filter(
    (convention) => !form.compagnieAssuranceId || convention.compagnieAssuranceId === form.compagnieAssuranceId
  );
  const filteredGrilles = (form.refs.grilles.data ?? []).filter(
    (grille) => !form.compagnieAssuranceId || grille.compagnieAssuranceId === form.compagnieAssuranceId
  );
  const selectedUsage = (form.refs.usages.data ?? []).find((item) => item.id === form.usageId);
  const selectedConvention = filteredConventions.find((item) => item.id === form.conventionId);
  const souscripteur = form.clients.find((client) => client.role === "SOUSCRIPTEUR");
  const categorieClientId = souscripteur?.client.categorieClientId ?? "";
  const selectedCategorie = (form.refs.categoriesClient.data ?? []).find((categorie) => categorie.id === categorieClientId);
  const showCategorieClient = form.typeContrat === "PARTICULIER";
  const readOnlyConventionContext = form.typeContrat === "CONVENTION";
  const showCrmPartage = form.typeContrat === "FLOTTE";
  const conventionHasFixedEcheance = readOnlyConventionContext
    && Boolean(form.request.echeance ?? form.effectiveEcheance)
    && selectedConvention?.typeEcheance === "A_ECHEANCE";

  return (
    <SectionCard
      title="Contrat"
      badge={form.savedSections.contrat ? "Validé" : badge}
      tone="production"
      defaultOpen={false}
    >
      <div className="grid gap-3 md:grid-cols-4">
        {showCategorieClient ? (
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
        ) : null}
        {!readOnlyConventionContext ? (
          <Field label="Compagnie" required error={form.validationErrors.compagnieAssuranceId}>
            <Select value={form.compagnieAssuranceId} onValueChange={form.setCompagnieAssuranceId}>
              <SelectTrigger><SelectValue placeholder="Compagnie" /></SelectTrigger>
              <SelectContent>
                {form.refs.compagnies.data?.map((item) => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {showConvention && !readOnlyConventionContext ? (
          <Field label="Convention / produit" required error={form.validationErrors.conventionId}>
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
          {readOnlyConventionContext ? (
            <Input value={formatReferenceLabel(selectedUsage) || "Usage sélectionné"} disabled />
          ) : (
            <Select value={form.usageId} onValueChange={form.setUsageId}>
              <SelectTrigger><SelectValue placeholder="Usage" /></SelectTrigger>
              <SelectContent>
                {form.availableUsages.map((item) => <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} - ` : ""}{item.libelle}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
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
        <Field label="N° contrat" required error={form.validationErrors.numeroContrat}>
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
        <Field label="Type de contrat" required error={form.validationErrors.typeRenouvellement}>
          <Select
            value={form.typeRenouvellement}
            onValueChange={(value) => {
              form.setTypeRenouvellement(value as "renouvelable" | "ferme");
              if (value === "ferme") {
                form.setEcheance(undefined);
              }
            }}
          >
            <SelectTrigger><SelectValue placeholder="Type de contrat" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="renouvelable">Renouvelable</SelectItem>
              <SelectItem value="ferme">Ferme</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date effet" required error={form.validationErrors.dateEffet}>
          <DatePicker date={form.dateEffet} onSelect={(date) => form.setDateEffet(toDateOnly(date))} />
        </Field>
        <Field label="Date échéance" required error={form.validationErrors.dateEcheance}>
          <DatePicker disabled={form.showContractEcheance} date={form.dateEcheance} onSelect={(date) => form.setDateEcheance(toDateOnly(date))} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        {showFractionnement ? (
          <Field label="Périodicité">
            <Select
              value={form.fractionnement}
              onValueChange={(value) => {
                form.setFractionnement(value as CreateContratRequest["fractionnement"]);
                if (value !== "ANNUEL") {
                  form.setEcheance(undefined);
                }
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ANNUEL">Annuel</SelectItem>
                <SelectItem value="SEMESTRIEL">Semestriel</SelectItem>
                <SelectItem value="TRIMESTRIEL">Trimestriel</SelectItem>
                <SelectItem value="MENSUEL">Mensuel</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {form.showContractEcheance ? (
          <Field label="Échéance" required error={form.validationErrors.echeance}>
            <EcheanceInput
              value={form.effectiveEcheance}
              disabled={Boolean(conventionHasFixedEcheance)}
              onValueChange={form.setEcheance}
            />
          </Field>
        ) : null}
        {readOnlyConventionContext ? (
          <>
            <Field label="Mode de règlement" required error={form.validationErrors.modeReglement}>
              <Select
                value={form.modeReglement}
                onValueChange={(value) => {
                  form.setModeReglement(value);
                  if (value !== "facture") {
                    form.setNumeroBonCommande("");
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Mode de règlement" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bureau">Règlement bureau</SelectItem>
                  <SelectItem value="facture">Règlement facture</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.modeReglement === "facture" ? (
              <Field label="N° bon de commande" required error={form.validationErrors.numeroBonCommande}>
                <Input value={form.numeroBonCommande} onChange={(event) => form.setNumeroBonCommande(event.target.value)} />
              </Field>
            ) : null}
          </>
        ) : null}
        {showCrmPartage ? (
          <>
            <Field label="CRM partagé">
              <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                <Checkbox checked={form.crmPartage} onCheckedChange={(checked) => form.setCrmPartage(Boolean(checked))} />
                <span>Appliquer à tous les véhicules</span>
              </label>
            </Field>
            <Field label="CRM flotte">
              <Input
                value={form.crmPartageValeur}
                disabled={!form.crmPartage}
                placeholder="0,9"
                onChange={(event) => form.setCrmPartageValeur(event.target.value)}
              />
            </Field>
          </>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end border-t pt-3">
        <Button type="button" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => form.handleSaveSection("contrat")}>
          <Save className="size-4" />
          Enregistrer
        </Button>
      </div>
    </SectionCard>
  );
}

function formatReferenceLabel(option?: { code?: string | null; libelle?: string | null } | null) {
  if (!option) {
    return "";
  }
  return option.code ? `${option.code} - ${option.libelle ?? ""}` : option.libelle ?? "";
}
