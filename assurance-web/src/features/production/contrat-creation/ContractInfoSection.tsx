import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { EcheanceInput } from "@/components/ui/echeance-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Field } from "../components/Field";
import { SectionCard } from "../components/SectionCard";
import { toDateOnly } from "../date";
import type { CreateContratRequest } from "../types";
import type { ContratCreationFormState, ContratSectionKey } from "./useContratCreationForm";

type Props = {
  form: ContratCreationFormState;
  badge: string;
  showConvention?: boolean;
  showGrille?: boolean;
  showFractionnement?: boolean;
  openSection?: ContratSectionKey;
  onSectionOpenChange?: (section: ContratSectionKey, open: boolean) => void;
};

export function ContractInfoSection({
  form,
  badge,
  showConvention = false,
  showGrille = true,
  showFractionnement = true,
  openSection,
  onSectionOpenChange,
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
  const isFlotte = form.typeContrat === "FLOTTE";
  const showContratUsage = form.typeContrat !== "FLOTTE";
  const showNumeroContrat = !isFlotte;
  const showNumeroAttestation = !isFlotte;
  const showFlotteNumeroPolice = isFlotte && !form.prospectionMode;
  const conventionHasFixedEcheance = readOnlyConventionContext
    && Boolean(form.request.echeance ?? form.effectiveEcheance)
    && selectedConvention?.typeEcheance === "A_ECHEANCE";

  return (
    <SectionCard
      title="Contrat"
      badge={form.savedSections.contrat ? "Validé" : badge}
      tone="production"
      defaultOpen={false}
      open={openSection === "contrat"}
      onOpenChange={(open) => onSectionOpenChange?.("contrat", open)}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <AutocompleteSelect
              value={form.compagnieAssuranceId}
              onValueChange={form.setCompagnieAssuranceId}
              options={(form.refs.compagnies.data ?? []).map((item) => ({
                value: item.id,
                label: item.libelle,
                keywords: item.code,
              }))}
              placeholder="Compagnie"
              emptyText="Aucune compagnie"
              invalidText="Sélectionnez une compagnie existante."
            />
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
        {showContratUsage ? (
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
        ) : null}
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
        {form.isFlotteLocationCategory ? (
          <Field label="Taux RC" required error={form.validationErrors.tauxRc}>
            <Input
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={form.tauxRc}
              onChange={(event) => form.setTauxRc(event.target.value)}
              placeholder="Ex: 3.50"
            />
          </Field>
        ) : null}
        {isFlotte ? (
          <>
            {showFlotteNumeroPolice ? (
              <Field label="N° police" required error={form.validationErrors.numeroPolice}>
                <Input value={form.numeroPolice} onChange={(event) => form.setNumeroPolice(event.target.value)} />
              </Field>
            ) : (
              <Field label="N° devis">
                <Input value={form.request.numeroDevis ?? ""} readOnly placeholder="Généré à l'enregistrement du devis" />
              </Field>
            )}
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
            {form.showContractEcheance ? (
              <Field label="Échéance" required error={form.validationErrors.echeance}>
                <EcheanceInput
                  value={form.effectiveEcheance}
                  disabled={Boolean(conventionHasFixedEcheance)}
                  onValueChange={form.setEcheance}
                />
              </Field>
            ) : null}
            <Field label="Date effet" required error={form.validationErrors.dateEffet}>
              <DatePicker date={form.dateEffet} onSelect={(date) => form.setDateEffet(toDateOnly(date))} />
            </Field>
            <Field label="Date échéance" required error={form.validationErrors.dateEcheance}>
              <DatePicker disabled={form.showContractEcheance} date={form.dateEcheance} onSelect={(date) => form.setDateEcheance(toDateOnly(date))} />
            </Field>
            {showFractionnement ? (
              <Field label="Fractionnement">
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
            <Field label="CRM partagé">
              <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                <Checkbox checked={form.crmPartage} onCheckedChange={(checked) => form.setCrmPartage(Boolean(checked))} />
                <span>Appliquer à tous les véhicules</span>
              </label>
            </Field>
            {form.crmPartage ? (
              <Field label="CRM flotte">
                <Input
                  value={form.crmPartageValeur}
                  onChange={(event) => form.setCrmPartageValeur(event.target.value)}
                />
              </Field>
            ) : null}
          </>
        ) : (
          <>
            {showNumeroContrat ? (
              <Field label="N° contrat" required error={form.validationErrors.numeroContrat}>
                <Input value={form.numeroContrat} onChange={(event) => form.setNumeroContrat(event.target.value)} />
              </Field>
            ) : null}
            <Field label="N° police" error={form.validationErrors.numeroPolice}>
              <Input value={form.numeroPolice} onChange={(event) => form.setNumeroPolice(event.target.value)} />
            </Field>
            {showNumeroAttestation ? (
              <Field label="N° attestation">
                <Input value={form.numeroAttestation} onChange={(event) => form.setNumeroAttestation(event.target.value)} />
              </Field>
            ) : null}
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
          </>
        )}
      </div>
      <div className="mt-4 flex justify-end border-t pt-3">
        <Button
          type="button"
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={form.saveDraftMutation.isPending}
          onClick={() => form.handleSaveSection("contrat")}
        >
          {form.saveDraftMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {form.saveDraftMutation.isPending ? "Enregistrement..." : "Enregistrer"}
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
