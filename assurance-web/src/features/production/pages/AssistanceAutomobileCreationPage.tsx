import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { EcheanceInput, isValidEcheance } from "@/components/ui/echeance-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contractKeys } from "@/lib/query-keys";
import { assistanceAutomobileApi } from "../api/assistance-automobile";
import { assistanceProductApi } from "../api/assistance-products";
import { clientApi } from "../api/clients";
import { contractApi } from "../api/contracts";
import { referenceApi } from "../api/references";
import { ClientSection, emptyClient } from "../components/ClientSection";
import { Field } from "../components/Field";
import { SectionCard } from "../components/SectionCard";
import { VehicleRegistrationLookupInput } from "../components/VehicleRegistrationLookupInput";
import { toDateOnly } from "../date";
import type { ContratSectionKey } from "../contrat-creation/useContratCreationForm";
import type {
  ClientInput,
  ContratSummary,
  CreateAssistanceAutomobileRequest,
  ReferenceOption,
  VehiculeInput,
  VehiculeResponse,
} from "../types";

const today = new Date().toISOString().slice(0, 10);
type AssistanceSection = "souscripteur" | "proprietaire" | "vehicule" | "contrat";

export default function AssistanceAutomobileCreationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { contratId } = useParams<{ contratId: string }>();
  const [searchParams] = useSearchParams();
  const renewing = Boolean(contratId) && searchParams.get("action") === "renouveler";
  const editing = Boolean(contratId) && !renewing;
  const loadingExisting = Boolean(contratId);
  const [compagnieId, setCompagnieId] = useState(searchParams.get("compagnieId") ?? "");
  const [produitId, setProduitId] = useState(searchParams.get("produitId") ?? "");
  const [clients, setClients] = useState<ClientInput[]>(initialClients);
  const [vehicule, setVehicule] = useState<VehiculeInput>({ typeVehicule: "AUTOMOBILE" });
  const [numeroContrat, setNumeroContrat] = useState("");
  const [libelleReleve, setLibelleReleve] = useState("");
  const [dateSouscription, setDateSouscription] = useState(today);
  const [dateEffet, setDateEffet] = useState(today);
  const [echeanceCode, setEcheanceCode] = useState<string | undefined>();
  const [dureeMois, setDureeMois] = useState("");
  const [codePromo, setCodePromo] = useState("");
  const [typePayeurPrime, setTypePayeurPrime] = useState<"SOUSCRIPTEUR" | "TIERS_MANDATE">("SOUSCRIPTEUR");
  const [payeurPrimeClientId, setPayeurPrimeClientId] = useState("");
  const [payerSearch, setPayerSearch] = useState("");
  const [openSection, setOpenSection] = useState<ContratSectionKey>("souscripteur");
  const [validatedSections, setValidatedSections] = useState<Partial<Record<AssistanceSection, boolean>>>({});
  const hydratedRef = useRef<string | null>(null);

  const existingContract = useQuery({
    queryKey: contractKeys.detail(contratId ?? ""),
    queryFn: () => contractApi.getContrat(contratId!),
    enabled: loadingExisting,
  });
  const companies = useReference("compagnies-assistance");
  const cities = useReference("villes");
  const categories = useReference("categories-client");
  const usages = useReference("usages");
  const marques = useReference("marques");
  const carrosseries = useReference("carrosseries");
  const transportCategories = useReference("categories-transport");
  const groups = useQuery({
    queryKey: ["groupes-clients"],
    queryFn: clientApi.listGroupesClients,
    staleTime: 60_000,
  });
  const deferredPayerSearch = useDeferredValue(payerSearch.trim());
  const payerClients = useQuery({
    queryKey: ["clients", "assistance-payer-search", deferredPayerSearch],
    queryFn: () => clientApi.listClients({ query: deferredPayerSearch, size: 25 }),
    enabled: typePayeurPrime === "TIERS_MANDATE" && deferredPayerSearch.length >= 2,
    staleTime: 30_000,
  });
  const selectedCompany = (companies.data ?? []).find((item) => item.id === compagnieId);
  const insured = clients.find((item) => item.role === "PROPRIETAIRE");
  const subscriber = clients.find((item) => item.role === "SOUSCRIPTEUR");
  const sameInsured = insured?.sameAsRole === "SOUSCRIPTEUR"
    || Boolean(insured?.clientId && subscriber?.clientId && insured.clientId === subscriber.clientId);
  const categorieClientId = insured?.client.categorieClientId || "";
  const availableCategories = categories.data ?? [];
  const availableUsages = useMemo(() => {
    const category = (categories.data ?? []).find((item) => item.id === categorieClientId);
    if (!category) return [];
    const categoryIds = stringArray(category?.usageIds);
    return (usages.data ?? []).filter((usage) => categoryIds.length === 0 || categoryIds.includes(usage.id));
  }, [categorieClientId, categories.data, usages.data]);
  const selectedUsage = availableUsages.find((item) => item.id === vehicule.usageId);
  const products = useQuery({
    queryKey: [
      "referentiel",
      "produits-assistance",
      "automobile-contract",
      compagnieId,
      categorieClientId,
      vehicule.usageId,
    ],
    queryFn: () => referenceApi.list("produits-assistance", {
      compagnieAssistanceId: compagnieId,
      type: "Assistance Automobile",
      categorieClientId,
      usageId: vehicule.usageId,
    }),
    enabled: Boolean(compagnieId && categorieClientId && vehicule.usageId),
    staleTime: 60_000,
  });
  const selectedProduct = (products.data ?? []).find((item) => item.id === produitId);
  const hasPromoCodes = Number(selectedProduct?.nombreCodesPromo ?? 0) > 0;
  const draftMode = Boolean(existingContract.data?.brouillon);
  const payerOptions = useMemo(() => {
    const linked = clients.filter((item) => item.clientId).map((item) => ({
      id: item.clientId!,
      nomAffichage: item.client.raisonSociale
        || [item.client.prenom, item.client.nom].filter(Boolean).join(" ")
        || item.clientId!,
      rc: item.client.rc,
      cin: item.client.cin,
    }));
    const persisted = existingContract.data?.payeurPrimeClientId && existingContract.data.payeurPrimeNom
      ? [{
          id: existingContract.data.payeurPrimeClientId,
          nomAffichage: existingContract.data.payeurPrimeNom,
          rc: undefined,
          cin: undefined,
        }]
      : [];
    const byId = new Map([...linked, ...persisted, ...(payerClients.data?.items ?? [])].map((item) => [item.id, item]));
    return [...byId.values()].map((item) => ({
      value: item.id,
      label: item.nomAffichage ?? item.id,
      keywords: [item.rc, item.cin].filter(Boolean).join(" "),
    }));
  }, [clients, existingContract.data?.payeurPrimeClientId, existingContract.data?.payeurPrimeNom, payerClients.data?.items]);
  const tariffs = useQuery({
    queryKey: ["referentiel", "produits-assistance", produitId, "tarifs", "automobile-contract"],
    queryFn: () => assistanceProductApi.listProductRates(produitId),
    enabled: Boolean(produitId),
    staleTime: 30_000,
  });
  const durationOptions = useMemo(
    () => assistanceDurationOptions(tariffs.data ?? [], dateSouscription),
    [dateSouscription, tariffs.data],
  );

  useEffect(() => {
    if (selectedProduct && !tariffs.isLoading && !durationOptions.some((option) => option.value === dureeMois)) {
      setDureeMois(durationOptions[0]?.value ?? "");
    }
  }, [dureeMois, durationOptions, selectedProduct, tariffs.isLoading]);

  useEffect(() => {
    if (selectedProduct && !hasPromoCodes && codePromo) setCodePromo("");
  }, [codePromo, hasPromoCodes, selectedProduct]);

  useEffect(() => {
    if (vehicule.usageId && categorieClientId && usages.isSuccess
      && !availableUsages.some((item) => item.id === vehicule.usageId)) {
      setVehicule((current) => ({ ...current, usageId: undefined, categorieTransportId: undefined }));
    }
  }, [availableUsages, categorieClientId, usages.isSuccess, vehicule.usageId]);

  useEffect(() => {
    if (!produitId || !products.isSuccess) return;
    if (!(products.data ?? []).some((product) => product.id === produitId)) {
      setProduitId("");
      setDureeMois("");
    }
  }, [produitId, products.data, products.isSuccess]);

  useEffect(() => {
    const contract = existingContract.data;
    const hydrationKey = `${contratId}:${renewing ? "renew" : "edit"}`;
    if (!contratId || !contract || hydratedRef.current === hydrationKey) return;
    const assistance = contract.assistances?.find((item) => normalize(item.typeAssistance) === "ASSISTANCE AUTOMOBILE")
      ?? contract.assistances?.[0];
    if (!assistance) return;
    setCompagnieId(assistance.compagnieAssistanceId ?? "");
    setProduitId(assistance.produitAssistanceId ?? "");
    setNumeroContrat(renewing ? "" : contract.numeroContrat ?? assistance.numeroContratOuQuittance ?? "");
    setLibelleReleve(renewing ? "" : assistance.libelleReleve ?? "");
    setDateSouscription(renewing ? today : assistance.dateSouscription ?? today);
    setDateEffet(renewing
      ? dayAfter(assistance.dateEcheance ?? contract.dateEcheance)
      : assistance.dateEffet ?? contract.dateEffet ?? today);
    setEcheanceCode(assistance.echeanceCode ?? contract.echeance
      ?? toEcheanceCode(dayAfter(assistance.dateEcheance ?? contract.dateEcheance)));
    setDureeMois(String(assistance.duree ?? ""));
    setCodePromo(renewing ? "" : assistance.codePromo ?? "");
    setClients(hydrateClients(contract.clients ?? [], optionalString(contract.categorieClientId)));
    setVehicule(hydrateVehicle(contract.vehicules?.[0]));
    const payerType = contract.typePayeurPrime === "TIERS_MANDATE" ? "TIERS_MANDATE" : "SOUSCRIPTEUR";
    setTypePayeurPrime(payerType);
    setPayeurPrimeClientId(payerType === "TIERS_MANDATE" ? contract.payeurPrimeClientId ?? "" : "");
    const hasSubscriber = Boolean(contract.clients?.some((link) => link.role === "SOUSCRIPTEUR"));
    const hasInsured = Boolean(contract.clients?.some((link) => link.role === "PROPRIETAIRE"));
    const hasVehicle = Boolean(contract.vehicules?.length);
    setValidatedSections({ souscripteur: hasSubscriber, proprietaire: hasInsured, vehicule: hasVehicle });
    setOpenSection(!hasSubscriber
      ? "souscripteur"
      : !hasInsured
        ? "proprietaire"
        : !hasVehicle
          ? "vehicule"
          : "contrat");
    hydratedRef.current = hydrationKey;
  }, [contratId, existingContract.data, renewing]);

  const quote = useQuery({
    queryKey: ["assistance-automobile", "quote", compagnieId, produitId, categorieClientId, vehicule.usageId, dateSouscription, dateEffet, dureeMois, hasPromoCodes ? codePromo.trim() : ""],
    queryFn: () => assistanceAutomobileApi.quote({
      compagnieAssistanceId: compagnieId,
      produitAssistanceId: produitId,
      categorieClientId,
      usageId: vehicule.usageId!,
      dateSouscription,
      dateEffet,
      dureeMois: Number(dureeMois),
      codePromo: hasPromoCodes ? codePromo.trim() || undefined : undefined,
    }),
    enabled: Boolean(compagnieId && produitId && categorieClientId && vehicule.usageId
      && dateSouscription && dateEffet && dateSouscription <= dateEffet && dureeMois),
    retry: false,
  });

  useEffect(() => {
    if (!echeanceCode && quote.data?.dateEcheance) {
      setEcheanceCode(toEcheanceCode(dayAfter(quote.data.dateEcheance)));
    }
  }, [echeanceCode, quote.data?.dateEcheance]);

  const draftSave = useMutation({
    mutationFn: ({ section }: { section: Exclude<AssistanceSection, "contrat"> }) =>
      assistanceAutomobileApi.saveDraftSection(contratId, section, {
        compagnieAssistanceId: compagnieId,
        personne: section === "souscripteur"
          ? personRequest(subscriber!)
          : section === "proprietaire"
            ? sameInsured && subscriber?.clientId
              ? { clientId: subscriber.clientId }
              : personRequest(insured!)
            : undefined,
        categorieClientId: section === "proprietaire" || section === "vehicule"
          ? categorieClientId
          : undefined,
        vehicule: section === "vehicule" ? vehicleRequest(vehicule) : undefined,
      }),
    onSuccess: async (saved, variables) => {
      const role = variables.section === "souscripteur"
        ? "SOUSCRIPTEUR"
        : variables.section === "proprietaire"
          ? "PROPRIETAIRE"
          : null;
      if (role && saved.clientIds[0]) {
        setClients((current) => current.map((client) => client.role === role
          ? { ...client, clientId: saved.clientIds[0] }
          : client));
      }
      setValidatedSections((current) => ({ ...current, [variables.section]: true }));
      setOpenSection(variables.section === "souscripteur"
        ? "proprietaire"
        : variables.section === "proprietaire"
          ? "vehicule"
          : "contrat");
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
      toast.success("Section enregistrée dans le brouillon");
      if (!contratId) {
        navigate(`/app/production/contrats/${saved.contratId}/assistance-automobile/modifier`, { replace: true });
      }
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Enregistrement du brouillon impossible",
    ),
  });

  const save = useMutation({
    mutationFn: () => {
      const request = buildRequest({
        compagnieId,
        produitId,
        dateSouscription,
        dateEffet,
        echeanceCode: echeanceCode!,
        dureeMois,
        numeroContrat,
        libelleReleve,
        codePromo: hasPromoCodes ? codePromo : "",
        subscriber: subscriber!,
        insured: insured!,
        sameInsured,
        typePayeurPrime,
        payeurPrimeClientId,
        vehicule,
      });
      if (renewing && contratId) return assistanceAutomobileApi.renew(contratId, request);
      if (draftMode && contratId) return assistanceAutomobileApi.finalizeDraft(contratId, request);
      if (editing && contratId) return assistanceAutomobileApi.update(contratId, request);
      return assistanceAutomobileApi.create(request);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
      toast.success(renewing
        ? `Dossier ${saved.numeroDossier} renouvelé`
        : draftMode
          ? `Brouillon finalisé sous le dossier ${saved.numeroDossier}`
          : editing
          ? `Dossier ${saved.numeroDossier} modifié`
          : `Dossier ${saved.numeroDossier} créé`);
      navigate(editing
        ? "/app/production/contrats"
        : `/app/production/contrats/${saved.contratId}/pieces-jointes`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const invalidateFrom = (section: AssistanceSection) => {
    const order: AssistanceSection[] = ["souscripteur", "proprietaire", "vehicule", "contrat"];
    const sectionIndex = order.indexOf(section);
    setValidatedSections((current) => {
      const next = { ...current };
      order.slice(sectionIndex).forEach((key) => delete next[key]);
      return next;
    });
  };

  const updateClients = (next: ClientInput[]) => {
    setClients(next);
    invalidateFrom(openSection === "souscripteur" ? "souscripteur" : "proprietaire");
  };

  const updateVehicle = (next: VehiculeInput) => {
    setVehicule(next);
    invalidateFrom("vehicule");
  };

  const updateInsuredCategory = (value: string) => {
    setClients((current) => current.map((item) => {
      const sharedPerson = sameInsured && item.role === "SOUSCRIPTEUR";
      if (item.role !== "PROPRIETAIRE" && !sharedPerson) return item;
      return { ...item, client: { ...item.client, categorieClientId: value } };
    }));
    setVehicule((current) => ({ ...current, usageId: undefined, categorieTransportId: undefined }));
    setProduitId("");
    setDureeMois("");
    invalidateFrom("vehicule");
  };

  const validateAndContinue = (section: Exclude<AssistanceSection, "contrat">) => {
    const valid = section === "souscripteur"
      ? Boolean(subscriber && validClient(subscriber, false))
      : section === "proprietaire"
        ? Boolean(insured && validClient(insured, false))
        : Boolean(categorieClientId && validVehicle(vehicule, Boolean(selectedUsage?.byCategorieTransport)));
    if (!valid) {
      toast.error(section === "vehicule"
        ? "Complétez les informations obligatoires du véhicule."
        : `Complétez les informations obligatoires de ${section === "souscripteur" ? "souscription" : "l’assuré"}.`);
      return;
    }
    if (!contratId || draftMode) {
      draftSave.mutate({ section });
      return;
    }
    setValidatedSections((current) => ({ ...current, [section]: true }));
    setOpenSection(section === "souscripteur" ? "proprietaire" : section === "proprietaire" ? "vehicule" : "contrat");
  };

  const handleSectionOpenChange = (section: AssistanceSection, open: boolean) => {
    if (!open) return;
    const order: AssistanceSection[] = ["souscripteur", "proprietaire", "vehicule", "contrat"];
    const targetIndex = order.indexOf(section);
    const firstIncomplete = order.slice(0, targetIndex).find((item) => !validatedSections[item]);
    if (firstIncomplete) {
      setOpenSection(firstIncomplete);
      toast.error("Validez la section en cours avant de continuer.");
      return;
    }
    setOpenSection(section);
  };

  const canSubmit = Boolean(
    compagnieId && produitId && numeroContrat.trim() && dateSouscription && dateEffet
    && dateSouscription <= dateEffet && isValidEcheance(echeanceCode) && dureeMois
    && (typePayeurPrime !== "TIERS_MANDATE" || payeurPrimeClientId)
    && subscriber && insured && validClient(subscriber, false) && validClient(insured, false) && categorieClientId
    && validVehicle(vehicule, Boolean(selectedUsage?.byCategorieTransport))
    && validatedSections.souscripteur && validatedSections.proprietaire && validatedSections.vehicule
    && quote.isSuccess,
  );

  if (loadingExisting && existingContract.isLoading) {
    return <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>;
  }
  if (loadingExisting && existingContract.isError) {
    return <p className="text-sm font-medium text-destructive">Chargement du dossier impossible.</p>;
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
          <h1 className="text-xl font-semibold">
            {renewing
              ? "Renouveler l’assistance automobile"
              : draftMode
                ? "Reprendre le brouillon d’assistance automobile"
                : editing
                  ? "Modifier l’assistance automobile"
                  : "Nouvelle assistance automobile"}
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link to={renewing
            ? "/app/production/echeances"
            : editing
              ? "/app/production/contrats"
              : "/app/production/ajouter-dossier"}
          >
            <ArrowLeft className="size-4" /> Retour
          </Link>
        </Button>
      </header>

      <ClientSection
        clients={clients}
        setClients={updateClients}
        villes={cities.data ?? []}
        groupesClients={groups.data ?? []}
        requireDriverDetails={false}
        requireDriverPermitValidity={false}
        requirePersonProfileDetails
        secondaryTitle="Assuré"
        secondaryIdentityLabel="Identité de l’assuré"
        sameAsSubscriberLabel="L’assuré est le souscripteur"
        onSaveSection={validateAndContinue}
        savedSections={validatedSections}
        saving={draftSave.isPending}
        saveActionLabel="Enregistrer"
        openSection={openSection}
        onSectionOpenChange={(section, open) => handleSectionOpenChange(section as AssistanceSection, open)}
      />

      <VehicleSection
        vehicle={vehicule}
        setVehicle={updateVehicle}
        categorieClientId={categorieClientId}
        categoriesClient={availableCategories}
        onCategoryChange={updateInsuredCategory}
        usages={availableUsages}
        marques={marques.data ?? []}
        carrosseries={carrosseries.data ?? []}
        categoriesTransport={transportCategories.data ?? []}
        needsTransportCategory={Boolean(selectedUsage?.byCategorieTransport)}
        validated={Boolean(validatedSections.vehicule)}
        saving={draftSave.isPending}
        onContinue={() => validateAndContinue("vehicule")}
        open={openSection === "vehicule"}
        onOpenChange={(open) => handleSectionOpenChange("vehicule", open)}
      />

      <SectionCard
        title="Contrat"
        badge={quote.isSuccess ? "Tarif calculé" : "À compléter"}
        tone="production"
        open={openSection === "contrat"}
        onOpenChange={(open) => handleSectionOpenChange("contrat", open)}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Compagnie d’assistance" required><Input readOnly value={selectedCompany?.libelle ?? ""} /></Field>
          <Field label="Produit d’assistance" required>
            <Select
              value={produitId}
              onValueChange={(value) => {
                setProduitId(value);
                setDureeMois("");
                setEcheanceCode(undefined);
              }}
              disabled={!categorieClientId || !vehicule.usageId || products.isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={categorieClientId && vehicule.usageId
                  ? "Choisir un produit"
                  : "Renseigner la catégorie et l’usage"}
                />
              </SelectTrigger>
              <SelectContent>
                {(products.data ?? []).map((product) => (
                  <SelectItem key={product.id} value={product.id}>{product.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categorieClientId && vehicule.usageId && products.isSuccess && products.data.length === 0 ? (
              <p className="mt-1 text-xs text-destructive">
                Aucun produit compatible avec cette catégorie et cet usage.
              </p>
            ) : null}
          </Field>
          <Field label={renewing ? "N° du nouveau contrat" : "N° de contrat"} required>
            <Input value={numeroContrat} onChange={(event) => setNumeroContrat(event.target.value)} />
          </Field>
          <Field label="Libellé du relevé (facultatif)">
            <Input
              value={libelleReleve}
              maxLength={180}
              placeholder="Libellé généré automatiquement"
              onChange={(event) => setLibelleReleve(event.target.value.replace(/[\r\n]+/g, " "))}
            />
          </Field>
          <Field label="Durée" required>
            <Select
              value={dureeMois}
              onValueChange={(value) => {
                setDureeMois(value);
                setEcheanceCode(undefined);
              }}
              disabled={durationOptions.length === 0}
            >
              <SelectTrigger><SelectValue placeholder="Choisir une durée" /></SelectTrigger>
              <SelectContent>{durationOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field
            label="Date de souscription"
            required
            error={dateSouscription && dateEffet && dateSouscription > dateEffet
              ? "La date de souscription doit précéder ou correspondre à la date d’effet."
              : undefined}
          >
            <DatePicker
              date={dateSouscription}
              onSelect={(date) => {
                setDateSouscription(toDateOnly(date) ?? "");
                setDureeMois("");
                setEcheanceCode(undefined);
              }}
            />
          </Field>
          <Field label="Date d’effet" required>
            <DatePicker
              date={dateEffet}
              onSelect={(date) => {
                const nextDate = toDateOnly(date) ?? "";
                setDateEffet(nextDate);
                setEcheanceCode(undefined);
              }}
            />
          </Field>
          <Field label="Échéance" required>
            <EcheanceInput value={echeanceCode} onValueChange={setEcheanceCode} />
          </Field>
          <Field label="Date d’expiration"><Input readOnly value={quote.data?.dateEcheance ? formatDate(quote.data.dateEcheance) : "-"} /></Field>
          {hasPromoCodes ? (
            <Field label="Code promo"><Input value={codePromo} onChange={(event) => setCodePromo(event.target.value)} /></Field>
          ) : null}
          <Field label="Payeur des primes" required>
            <Select
              value={typePayeurPrime}
              onValueChange={(value) => {
                setTypePayeurPrime(value as "SOUSCRIPTEUR" | "TIERS_MANDATE");
                setPayeurPrimeClientId("");
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SOUSCRIPTEUR">Lui-même</SelectItem>
                <SelectItem value="TIERS_MANDATE">Autre personne</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {typePayeurPrime === "TIERS_MANDATE" ? (
            <Field label="Autre payeur" required>
              <AutocompleteSelect
                value={payeurPrimeClientId}
                onValueChange={setPayeurPrimeClientId}
                onQueryChange={setPayerSearch}
                options={payerOptions}
                placeholder="RC, CIN ou nom"
                emptyText="Aucun client trouvé"
                invalidText="Sélectionnez un client existant."
              />
            </Field>
          ) : null}
        </div>
        {quote.isError ? <p className="mt-3 text-sm text-destructive">{quote.error instanceof Error ? quote.error.message : "Tarif indisponible."}</p> : null}
        {quote.data ? (
          <div className="mt-4 grid overflow-hidden rounded-md border sm:grid-cols-3">
            <Summary label="Prime nette" value={money(quote.data.primeNette)} />
            <Summary label="Réduction" value={money(quote.data.montantReduction)} />
            <Summary label="TTC" value={money(quote.data.primeTotale)} strong />
          </div>
        ) : null}
        <div className="mt-4 flex justify-end border-t pt-4">
          <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {save.isPending
              ? "Enregistrement..."
              : renewing
                ? "Renouveler l’assistance"
                : draftMode
                  ? "Finaliser le dossier"
                  : editing
                    ? "Enregistrer les modifications"
                    : "Créer le dossier"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

function VehicleSection(props: {
  vehicle: VehiculeInput;
  setVehicle: (vehicle: VehiculeInput) => void;
  categorieClientId: string;
  categoriesClient: ReferenceOption[];
  onCategoryChange: (value: string) => void;
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  needsTransportCategory: boolean;
  validated: boolean;
  saving?: boolean;
  onContinue: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = (patch: Partial<VehiculeInput>) => props.setVehicle({ ...props.vehicle, ...patch });
  const fill = (found: VehiculeResponse) => update({
    typeVehicule: found.typeVehicule ?? props.vehicle.typeVehicule,
    usageId: found.usageId && props.usages.some((item) => item.id === String(found.usageId)) ? String(found.usageId) : props.vehicle.usageId,
    marqueId: found.marqueId ? String(found.marqueId) : undefined,
    marqueLibelle: found.marqueId ? undefined : found.marque ?? undefined,
    carrosserieId: found.carrosserieId ? String(found.carrosserieId) : undefined,
    carrosserieLibelle: found.carrosserieId ? undefined : found.carrosserie ?? undefined,
    categorieTransportId: found.categorieTransportId ? String(found.categorieTransportId) : undefined,
    datePremiereCirculation: found.datePremiereCirculation ?? undefined,
    dateExpirationCarteGrise: found.dateExpirationCarteGrise ?? undefined,
  });
  return (
    <SectionCard title="Véhicule assuré" badge={props.validated ? "Validé" : "Obligatoire"} tone="production" open={props.open} onOpenChange={props.onOpenChange}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Catégorie client" required>
          <AutocompleteSelect
            value={props.categorieClientId}
            placeholder="Choisir une catégorie"
            emptyText="Aucune catégorie disponible"
            options={props.categoriesClient.map((item) => ({
              value: item.id,
              label: item.code ? `${item.code} - ${item.libelle}` : item.libelle,
            }))}
            onValueChange={props.onCategoryChange}
          />
        </Field>
        <Field label="Usage" required>
          <AutocompleteSelect value={props.vehicle.usageId ?? ""} placeholder="Choisir un usage" emptyText="Aucun usage compatible"
            options={props.usages.map((item) => ({ value: item.id, label: item.code ? `${item.code} - ${item.libelle}` : item.libelle }))}
            onValueChange={(value) => update({ usageId: value, categorieTransportId: undefined })} />
        </Field>
        <Field label="Immatriculation" required>
          <VehicleRegistrationLookupInput value={props.vehicle.immatriculation ?? ""} onValueChange={(value) => update({ immatriculation: value })} onVehicleFound={fill} />
        </Field>
        <Field label="Marque" required>
          <AutocompleteSelect value={props.vehicle.marqueId ?? ""} customValue={props.vehicle.marqueLibelle} allowCustomValue placeholder="Marque" emptyText="Aucune marque trouvée"
            options={props.marques.map((item) => ({ value: item.id, label: item.libelle }))}
            onValueChange={(value) => update({ marqueId: value || undefined, marqueLibelle: undefined })}
            onCustomValueChange={(value) => update({ marqueId: undefined, marqueLibelle: value })} />
        </Field>
        <Field label="Carrosserie">
          <AutocompleteSelect value={props.vehicle.carrosserieId ?? ""} customValue={props.vehicle.carrosserieLibelle} allowCustomValue placeholder="Carrosserie" emptyText="Aucune carrosserie trouvée"
            options={props.carrosseries.map((item) => ({ value: item.id, label: item.libelle }))}
            onValueChange={(value) => update({ carrosserieId: value || undefined, carrosserieLibelle: undefined })}
            onCustomValueChange={(value) => update({ carrosserieId: undefined, carrosserieLibelle: value })} />
        </Field>
        {props.needsTransportCategory ? (
          <Field label="Catégorie de transport" required>
            <Select value={props.vehicle.categorieTransportId ?? ""} onValueChange={(value) => update({ categorieTransportId: value })}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{props.categoriesTransport.map((item) => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label="Mise en circulation"><DatePicker date={props.vehicle.datePremiereCirculation} onSelect={(date) => update({ datePremiereCirculation: toDateOnly(date) })} /></Field>
        <Field label="Validité de la carte grise" required><DatePicker date={props.vehicle.dateExpirationCarteGrise} onSelect={(date) => update({ dateExpirationCarteGrise: toDateOnly(date) })} /></Field>
      </div>
      <div className="mt-4 flex justify-end border-t pt-3">
        <Button type="button" size="sm" disabled={props.saving} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={props.onContinue}>
          {props.saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {props.saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </SectionCard>
  );
}

function initialClients() {
  const subscriber = emptyClient("SOUSCRIPTEUR");
  const insured = emptyClient("PROPRIETAIRE");
  subscriber.client.typeClient = "PERSONNE_PHYSIQUE";
  insured.client.typeClient = "PERSONNE_PHYSIQUE";
  return [subscriber, insured];
}

function hydrateClients(
  links: Array<{ clientId: string; role: string; principalPourRole: boolean; client?: ClientInput["client"] }>,
  contractCategoryId?: string,
) {
  const result = links.filter((link) => link.role === "SOUSCRIPTEUR" || link.role === "PROPRIETAIRE").map((link) => ({
    clientId: link.clientId,
    role: link.role as ClientInput["role"],
    principalPourRole: link.principalPourRole,
    client: { ...emptyClient(link.role as ClientInput["role"]).client, ...(link.client ?? {}) },
  }));
  const subscriber = result.find((item) => item.role === "SOUSCRIPTEUR") ?? emptyClient("SOUSCRIPTEUR");
  let insured = result.find((item) => item.role === "PROPRIETAIRE") ?? emptyClient("PROPRIETAIRE");
  insured = { ...insured, client: { ...insured.client, categorieClientId: insured.client.categorieClientId ?? contractCategoryId } };
  if (subscriber.clientId && subscriber.clientId === insured.clientId) insured = { ...insured, sameAsRole: "SOUSCRIPTEUR" };
  return [subscriber, insured];
}

function hydrateVehicle(vehicle?: NonNullable<ContratSummary["vehicules"]>[number]): VehiculeInput {
  if (!vehicle) return { typeVehicule: "AUTOMOBILE" };
  return {
    typeVehicule: (vehicle.typeVehicule as VehiculeInput["typeVehicule"]) ?? "AUTOMOBILE",
    usageId: optionalString(vehicle.usageId), marqueId: optionalString(vehicle.marqueId), marqueLibelle: optionalString(vehicle.marque),
    carrosserieId: optionalString(vehicle.carrosserieId), carrosserieLibelle: optionalString(vehicle.carrosserie),
    categorieTransportId: optionalString(vehicle.categorieTransportId), immatriculation: optionalString(vehicle.immatriculation),
    datePremiereCirculation: optionalString(vehicle.datePremiereCirculation), dateExpirationCarteGrise: optionalString(vehicle.dateExpirationCarteGrise),
    nombrePlaces: optionalString(vehicle.nombrePlaces),
  };
}

function vehicleRequest(vehicle: VehiculeInput): CreateAssistanceAutomobileRequest["vehicule"] {
  return {
    typeVehicule: vehicle.typeVehicule,
    usageId: vehicle.usageId!,
    marqueId: vehicle.marqueId,
    marqueLibelle: vehicle.marqueLibelle,
    carrosserieId: vehicle.carrosserieId,
    carrosserieLibelle: vehicle.carrosserieLibelle,
    categorieTransportId: vehicle.categorieTransportId,
    immatriculation: vehicle.immatriculation!.trim(),
    datePremiereCirculation: vehicle.datePremiereCirculation,
    dateExpirationCarteGrise: vehicle.dateExpirationCarteGrise!,
    nombrePlaces: vehicle.nombrePlaces?.trim() || undefined,
  };
}

function buildRequest(input: {
  compagnieId: string; produitId: string; dateSouscription: string; dateEffet: string; echeanceCode: string; dureeMois: string; numeroContrat: string; codePromo: string; libelleReleve: string;
  subscriber: ClientInput; insured: ClientInput; sameInsured: boolean;
  typePayeurPrime: "SOUSCRIPTEUR" | "TIERS_MANDATE"; payeurPrimeClientId: string; vehicule: VehiculeInput;
}): CreateAssistanceAutomobileRequest {
  return {
    compagnieAssistanceId: input.compagnieId, produitAssistanceId: input.produitId,
    categorieClientId: input.insured.client.categorieClientId!, dateSouscription: input.dateSouscription,
    dateEffet: input.dateEffet, echeanceCode: input.echeanceCode,
    dureeMois: Number(input.dureeMois), numeroContrat: input.numeroContrat.trim(), codePromo: input.codePromo.trim() || undefined,
    libelleReleve: input.libelleReleve.trim() || undefined,
    souscripteur: personRequest(input.subscriber), assure: input.sameInsured ? undefined : personRequest(input.insured),
    assureIdentiqueSouscripteur: input.sameInsured, typePayeurPrime: input.typePayeurPrime,
    payeurPrimeClientId: input.typePayeurPrime === "TIERS_MANDATE" ? input.payeurPrimeClientId : undefined,
    vehicule: vehicleRequest(input.vehicule),
  };
}

function personRequest(input: ClientInput) {
  return input.clientId ? { clientId: input.clientId } : { client: input.client };
}

function validClient(input: ClientInput, requireCategory = true) {
  if (input.clientId) return Boolean(!requireCategory || input.client.categorieClientId || input.role === "SOUSCRIPTEUR");
  const hasTelephone = Boolean(
    input.client.telephone?.trim()
    || input.client.telephones?.some((telephone) => telephone.numero.trim()),
  );
  const common = Boolean(input.client.adresse && input.client.villeId && hasTelephone);
  return input.client.typeClient === "PERSONNE_MORALE"
    ? common && Boolean(input.client.raisonSociale && input.client.rc
      && (!requireCategory || input.role !== "PROPRIETAIRE" || input.client.categorieClientId))
    : common && Boolean(input.client.prenom && input.client.nom && (input.client.cin || input.client.passport) && input.client.dateNaissance
      && (!requireCategory || input.role !== "PROPRIETAIRE" || input.client.categorieClientId));
}

function validVehicle(vehicle: VehiculeInput, categoryRequired: boolean) {
  return Boolean(vehicle.usageId && vehicle.immatriculation?.trim() && (vehicle.marqueId || vehicle.marqueLibelle?.trim())
    && vehicle.dateExpirationCarteGrise && (!categoryRequired || vehicle.categorieTransportId));
}

function assistanceDurationOptions(tariffs: ReferenceOption[], effectiveDate: string) {
  const durations = Array.from(new Set(tariffs
    .filter((tariff) => {
      const start = optionalString(tariff.dateDebut);
      const end = optionalString(tariff.dateFin);
      return tariff.actif !== false && (!start || start <= effectiveDate) && (!end || end >= effectiveDate)
        && tariff.ageMin == null && tariff.ageMax == null;
    })
    .map((tariff) => Number(tariff.dureeMois))
    .filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
  return durations.map((months) => ({ value: String(months), label: durationLabel(months) }));
}

function durationLabel(months: number) {
  if (months === 12) return "1 an";
  if (months > 12 && months % 12 === 0) return `${months / 12} ans`;
  return `${months} mois`;
}

function useReference(path: string) {
  return useQuery({ queryKey: ["referentiel", path], queryFn: () => referenceApi.list(path), staleTime: 60_000 });
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function optionalString(value: unknown) {
  return value == null || value === "" ? undefined : String(value);
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function money(value: number) {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function toEcheanceCode(value?: string | null) {
  if (!value) return undefined;
  const [, month, day] = value.split("-");
  return day && month ? `${day}/${month}` : undefined;
}

function dayAfter(value?: string | null) {
  if (!value) return today;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return today;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function Summary({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
    <div className="text-xs uppercase text-muted-foreground">{label}</div>
    <div className={`mt-1 tabular-nums ${strong ? "text-lg font-semibold text-emerald-700" : "font-medium"}`}>{value}</div>
  </div>;
}
