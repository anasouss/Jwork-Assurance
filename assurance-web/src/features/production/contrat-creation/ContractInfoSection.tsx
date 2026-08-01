import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { EcheanceInput } from "@/components/ui/echeance-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Field } from "../components/Field";
import { AttestationNumberInput } from "../components/AttestationNumberInput";
import { SectionCard } from "../components/SectionCard";
import { toDateOnly } from "../date";
import { productionApi } from "../api";
import type { CreateContratRequest, ModeFacturationContrat, TypePayeurPrime } from "../types";
import type { ContratCreationFormState, ContratSectionKey } from "./useContratCreationForm";

type Props = {
  form: ContratCreationFormState;
  badge: string;
  showConvention?: boolean;
  showGrille?: boolean;
  showFractionnement?: boolean;
  openSection?: ContratSectionKey;
  onSectionOpenChange?: (section: ContratSectionKey, open: boolean) => void;
  onSaved?: () => void;
};

export function ContractInfoSection({
  form,
  badge,
  showConvention = false,
  showGrille = true,
  showFractionnement = true,
  openSection,
  onSectionOpenChange,
  onSaved,
}: Props) {
  const [payerSearch, setPayerSearch] = useState("");
  const deferredPayerSearch = useDeferredValue(payerSearch.trim());
  const payerClientsQuery = useQuery({
    queryKey: ["clients", "payer-search", deferredPayerSearch],
    queryFn: () => productionApi.listClients({ query: deferredPayerSearch, size: 25 }),
    enabled: form.typePayeurPrime === "TIERS_MANDATE" && deferredPayerSearch.length >= 2,
    staleTime: 30_000,
  });
  const filteredConventions = (form.refs.conventions.data ?? []).filter(
    (convention) => !form.compagnieAssuranceId || convention.compagnieAssuranceId === form.compagnieAssuranceId
  );
  const filteredGrilles = (form.refs.grilles.data ?? []).filter(
    (grille) => !form.compagnieAssuranceId || grille.compagnieAssuranceId === form.compagnieAssuranceId
  );
  const selectedUsage = (form.refs.usages.data ?? []).find((item) => item.id === form.usageId);
  const selectedConvention = filteredConventions.find((item) => item.id === form.conventionId);
  const souscripteurIndex = form.clients.findIndex((client) => client.role === "SOUSCRIPTEUR");
  const souscripteur = souscripteurIndex >= 0 ? form.clients[souscripteurIndex] : undefined;
  const categorieClientId = souscripteur?.client.categorieClientId ?? "";
  const showCategorieClient = form.typeContrat === "PARTICULIER" && !categorieClientId;
  const readOnlyConventionContext = form.typeContrat === "CONVENTION";
  const isConventionInvoice = readOnlyConventionContext && form.modeReglement === "facture";
  const isFlotte = form.typeContrat === "FLOTTE";
  const showContratUsage = form.typeContrat !== "FLOTTE";
  const showNumeroAttestation = !isFlotte;
  const showFlotteNumeroPolice = isFlotte && !form.prospectionMode;
  const conventionHasFixedEcheance = readOnlyConventionContext
    && Boolean(form.request.echeance ?? form.effectiveEcheance)
    && selectedConvention?.typeEcheance === "A_ECHEANCE";
  const showConventionDateToDateFractionnement = readOnlyConventionContext && selectedConvention?.typeEcheance === "DATE_A_DATE";
  const subscriberGroupId = souscripteur?.groupeClientId ?? "";
  const selectedGroup = (form.groupesClients.data ?? []).find(
    (groupe) => groupe.id === (form.groupeFacturationId || subscriberGroupId)
  );
  const payerOptions = useMemo(() => {
    if (form.typePayeurPrime === "MEMBRE_GROUPE") {
      return (selectedGroup?.membres ?? []).map((membre) => ({
        value: membre.clientId,
        label: membre.clientNom,
        keywords: membre.typeRelation,
      }));
    }
    const loaded = payerClientsQuery.data?.items ?? [];
    const linked = form.clients
      .filter((client) => client.clientId)
      .map((client) => ({
        id: client.clientId ?? "",
        nomAffichage: client.client.raisonSociale
          || [client.client.prenom, client.client.nom].filter(Boolean).join(" ")
          || client.clientId,
        rc: client.client.rc,
        cin: client.client.cin,
      }));
    const byId = new Map([...linked, ...loaded].map((client) => [client.id, client]));
    return [...byId.values()].map((client) => ({
      value: client.id,
      label: client.nomAffichage ?? client.id,
      keywords: [client.rc, client.cin].filter(Boolean).join(" "),
    }));
  }, [form.clients, form.typePayeurPrime, payerClientsQuery.data?.items, selectedGroup?.membres]);

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
          <Field
            label="Catégorie"
            required
            error={souscripteurIndex >= 0
              ? form.validationErrors[`clients.${souscripteurIndex}.client.categorieClientId`]
              : undefined}
          >
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
              <AutocompleteSelect
                value={form.usageId}
                onValueChange={form.setUsageId}
                options={form.availableUsages.map((item) => ({
                  value: item.id,
                  label: item.code ? `${item.code} - ${item.libelle}` : item.libelle,
                  keywords: item.code,
                }))}
                placeholder="Usage"
                emptyText="Aucun usage"
                invalidText="Sélectionnez un usage existant."
              />
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
              <DatePicker disabled={form.renewalMode} date={form.dateEffet} onSelect={(date) => form.setDateEffet(toDateOnly(date))} />
            </Field>
            <Field label="Date échéance" required error={form.validationErrors.dateEcheance}>
              <DatePicker disabled={form.renewalMode || form.showContractEcheance} date={form.dateEcheance} onSelect={(date) => form.setDateEcheance(toDateOnly(date))} />
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
            {form.isFlotteLocationCategory ? (
              <Field label="Taux RC" required error={form.validationErrors.tauxRc}>
                <Input
                  inputMode="decimal"
                  type="text"
                  pattern="[0-9]+([,.][0-9]+)?"
                  value={form.tauxRc}
                  onChange={(event) => form.setTauxRc(event.target.value)}
                />
              </Field>
            ) : null}
          </>
        ) : (
          <>
            <Field label="N° police" required={!form.prospectionMode} error={form.validationErrors.numeroPolice}>
              <Input value={form.numeroPolice} onChange={(event) => form.setNumeroPolice(event.target.value)} />
            </Field>
            {showNumeroAttestation ? (
              <Field label="N° attestation">
                <AttestationNumberInput
                  value={form.numeroAttestation}
                  onChange={form.setNumeroAttestation}
                  compagnieAssuranceId={form.compagnieAssuranceId}
                  usageId={form.usageId}
                  compagnies={form.refs.compagnies.data ?? []}
                  usages={form.refs.usages.data ?? []}
                  controleStock={form.modeTermeRenouvellement !== "COMPAGNIE"}
                  required={form.modeTermeRenouvellement !== "COMPAGNIE" && Boolean(selectedUsage?.consommeAttestation)}
                />
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
            {showFractionnement && (!readOnlyConventionContext || showConventionDateToDateFractionnement) ? (
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
            <Field label="Date effet" required error={form.validationErrors.dateEffet}>
              <DatePicker disabled={form.renewalMode} date={form.dateEffet} onSelect={(date) => form.setDateEffet(toDateOnly(date))} />
            </Field>
            <Field label="Date échéance" required error={form.validationErrors.dateEcheance}>
              <DatePicker disabled={form.renewalMode || form.lockDateEcheance} date={form.dateEcheance} onSelect={(date) => form.setDateEcheance(toDateOnly(date))} />
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
            {readOnlyConventionContext ? (
              <>
                <Field label="Mode de règlement" required error={form.validationErrors.modeReglement}>
                  <Select
                    value={form.modeReglement}
                    onValueChange={(value) => {
                      form.setModeReglement(value);
                      if (value === "facture") {
                        form.setTypePayeurPrime("SOUSCRIPTEUR");
                        form.setPayeurPrimeClientId("");
                        form.setGroupeFacturationId("");
                        form.setModeFacturation("DIRECTE");
                      } else {
                        form.setNumeroBonCommande("");
                        form.setMontantBulletin("");
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
        {!isConventionInvoice ? (
          <>
            <Field label="Payeur des primes" required error={form.validationErrors.payeurPrimeClientId}>
              <Select
                value={form.typePayeurPrime}
                onValueChange={(value) => {
                  const type = value as TypePayeurPrime;
                  form.setTypePayeurPrime(type);
                  form.setPayeurPrimeClientId("");
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOUSCRIPTEUR">Lui-même</SelectItem>
                  {selectedGroup?.clientTresorerieId ? (
                    <SelectItem value="TRESORERIE_GROUPE">Trésorerie du groupe</SelectItem>
                  ) : null}
                  {selectedGroup?.membres.length ? (
                    <SelectItem value="MEMBRE_GROUPE">Autre membre du groupe</SelectItem>
                  ) : null}
                  <SelectItem value="TIERS_MANDATE">Autre personne</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {selectedGroup ? (
              <Field label="Groupe de facturation">
                <Input value={`${selectedGroup.code} - ${selectedGroup.libelle}`} disabled />
              </Field>
            ) : null}
            {form.typePayeurPrime === "MEMBRE_GROUPE" || form.typePayeurPrime === "TIERS_MANDATE" ? (
              <Field label={form.typePayeurPrime === "MEMBRE_GROUPE" ? "Membre payeur" : "Autre payeur"} required>
                <AutocompleteSelect
                  value={form.payeurPrimeClientId}
                  onValueChange={form.setPayeurPrimeClientId}
                  onQueryChange={form.typePayeurPrime === "TIERS_MANDATE" ? setPayerSearch : undefined}
                  options={payerOptions}
                  placeholder={form.typePayeurPrime === "TIERS_MANDATE" ? "RC, CIN ou nom" : "Membre du groupe"}
                  emptyText="Aucun client trouvé"
                  invalidText="Sélectionnez un client existant."
                />
              </Field>
            ) : null}
            <Field label="Facturation" required error={form.validationErrors.groupeFacturationId}>
              <Select
                value={form.modeFacturation}
                onValueChange={(value) => form.setModeFacturation(value as ModeFacturationContrat)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECTE">Directe au payeur</SelectItem>
                  {selectedGroup ? (
                    <SelectItem value="CONSOLIDEE_GROUPE">Consolidée au groupe</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </Field>
          </>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end border-t pt-3">
        <Button
          type="button"
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={form.saveDraftMutation.isPending}
          onClick={() => form.handleSaveSection("contrat", onSaved)}
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
