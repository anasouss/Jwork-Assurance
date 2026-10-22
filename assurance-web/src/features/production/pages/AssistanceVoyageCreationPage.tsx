import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plane, Plus, Save, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { contractKeys } from "@/lib/query-keys";
import { assistanceVoyageApi } from "../api/assistance-voyage";
import { clientApi } from "../api/clients";
import { contractApi } from "../api/contracts";
import { referenceApi } from "../api/references";
import { Field } from "../components/Field";
import { SectionCard } from "../components/SectionCard";
import { toDateOnly } from "../date";
import type {
  AssistanceVoyagePersonRequest,
  ClientResponse,
  ReferenceOption,
} from "../types";

type IdentityType = "CIN" | "PASSEPORT";
type VoyageSection = "souscripteur" | "assures" | "contrat";
type LookupState = {
  status: "idle" | "loading" | "found" | "new" | "error";
  message?: string;
};

type PersonDraft = {
  clientId?: string;
  typeClient: "PERSONNE_PHYSIQUE" | "PERSONNE_MORALE";
  documentType: IdentityType;
  documentNumber: string;
  documentValidity: string;
  genre: "HOMME" | "FEMME";
  prenom: string;
  nom: string;
  raisonSociale: string;
  rc: string;
  ice: string;
  dateNaissance: string;
  nationalite: string;
  adresse: string;
  villeId: string;
  telephone: string;
  email: string;
};

const today = new Date().toISOString().slice(0, 10);

export default function AssistanceVoyageCreationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { contratId } = useParams<{ contratId: string }>();
  const [searchParams] = useSearchParams();
  const renewing = Boolean(contratId) && searchParams.get("action") === "renouveler";
  const editing = Boolean(contratId) && !renewing;
  const loadingExisting = Boolean(contratId);
  const [compagnieId, setCompagnieId] = useState(searchParams.get("compagnieId") ?? "");
  const [produitId, setProduitId] = useState(searchParams.get("produitId") ?? "");
  const [subscriber, setSubscriber] = useState(emptyPerson());
  const [sameInsured, setSameInsured] = useState(true);
  const [insuredPeople, setInsuredPeople] = useState<PersonDraft[]>([emptyPerson()]);
  const [numeroContrat, setNumeroContrat] = useState("");
  const [dateEffet, setDateEffet] = useState(today);
  const [dureeMois, setDureeMois] = useState("12");
  const [codePromo, setCodePromo] = useState("");
  const [typePayeurPrime, setTypePayeurPrime] = useState<"SOUSCRIPTEUR" | "TIERS_MANDATE">("SOUSCRIPTEUR");
  const [payeurPrimeClientId, setPayeurPrimeClientId] = useState("");
  const [payerSearch, setPayerSearch] = useState("");
  const [openSection, setOpenSection] = useState<VoyageSection>("souscripteur");
  const [validatedSections, setValidatedSections] = useState<Partial<Record<VoyageSection, boolean>>>({});
  const hydratedContractRef = useRef<string | null>(null);

  const existingContract = useQuery({
    queryKey: contractKeys.detail(contratId ?? ""),
    queryFn: () => contractApi.getContrat(contratId!),
    enabled: loadingExisting,
  });

  const companies = useQuery({
    queryKey: ["referentiel", "compagnies-assistance", "travel-contract"],
    queryFn: () => referenceApi.list("compagnies-assistance"),
    staleTime: 60_000,
  });
  const products = useQuery({
    queryKey: ["referentiel", "produits-assistance", "travel-contract", compagnieId],
    queryFn: () => referenceApi.list("produits-assistance", {
      compagnieAssistanceId: compagnieId,
      type: "Assistance Voyage",
    }),
    enabled: Boolean(compagnieId),
    staleTime: 60_000,
  });
  const cities = useQuery({
    queryKey: ["referentiel", "villes", "travel-contract"],
    queryFn: () => referenceApi.list("villes"),
    staleTime: 60_000,
  });
  const deferredPayerSearch = useDeferredValue(payerSearch.trim());
  const payerClients = useQuery({
    queryKey: ["clients", "assistance-voyage-payer-search", deferredPayerSearch],
    queryFn: () => clientApi.listClients({ query: deferredPayerSearch, size: 25 }),
    enabled: typePayeurPrime === "TIERS_MANDATE" && deferredPayerSearch.length >= 2,
    staleTime: 30_000,
  });

  const subscriberCanBeInsured = subscriber.typeClient === "PERSONNE_PHYSIQUE";
  const subscriberIsInsured = sameInsured && subscriberCanBeInsured;
  const effectiveInsured = useMemo(
    () => subscriberIsInsured ? [subscriber] : insuredPeople,
    [insuredPeople, subscriber, subscriberIsInsured],
  );
  const insuredBirthDates = effectiveInsured.map((person) => person.dateNaissance).filter(Boolean);
  const selectedCompany = (companies.data ?? []).find((company) => company.id === compagnieId);
  const selectedProduct = (products.data ?? []).find((product) => product.id === produitId);
  const durationOptions = travelDurationOptions(selectedProduct);
  const expiryDate = calculateExpiryDate(dateEffet, Number(dureeMois));
  const payerOptions = useMemo(() => {
    const linkedPeople = [subscriber, ...effectiveInsured]
      .filter((person) => person.clientId)
      .map((person) => ({
        id: person.clientId!,
        nomAffichage: personName(person) || person.clientId!,
        rc: person.rc || undefined,
        cin: person.documentType === "CIN" ? person.documentNumber || undefined : undefined,
      }));
    const persisted = existingContract.data?.payeurPrimeClientId && existingContract.data.payeurPrimeNom
      ? [{
          id: existingContract.data.payeurPrimeClientId,
          nomAffichage: existingContract.data.payeurPrimeNom,
          rc: undefined,
          cin: undefined,
        }]
      : [];
    const byId = new Map(
      [...linkedPeople, ...persisted, ...(payerClients.data?.items ?? [])].map((client) => [client.id, client]),
    );
    return [...byId.values()].map((client) => ({
      value: client.id,
      label: client.nomAffichage ?? client.id,
      keywords: [client.rc, client.cin].filter(Boolean).join(" "),
    }));
  }, [effectiveInsured, existingContract.data?.payeurPrimeClientId, existingContract.data?.payeurPrimeNom, payerClients.data?.items, subscriber]);

  useEffect(() => {
    const contract = existingContract.data;
    const hydrationKey = `${contratId}:${renewing ? "renew" : "edit"}`;
    if (!contratId || !contract || hydratedContractRef.current === hydrationKey) return;
    const assistance = contract.assistances?.[0];
    const subscriberLink = contract.clients?.find((link) => link.role === "SOUSCRIPTEUR");
    const subscriberClient = subscriberLink?.client;
    const insuredLinks = (contract.clients ?? []).filter((link) => link.role === "BENEFICIAIRE");
    const insuredClients = insuredLinks.flatMap((link) => link.client ? [link.client] : []);
    if (!assistance || !subscriberClient || insuredClients.length === 0) return;

    const subscriberDraft = personFromClient(subscriberClient, identityTypeFor(subscriberClient));
    const subscriberIsInsured = insuredClients.some((client) => client.id === subscriberClient.id);
    setSubscriber(subscriberDraft);
    setSameInsured(subscriberIsInsured);
    setInsuredPeople(subscriberIsInsured
      ? [emptyPerson()]
      : insuredClients.map((client) => personFromClient(client, identityTypeFor(client))));
    setCompagnieId(assistance.compagnieAssistanceId ?? "");
    setProduitId(assistance.produitAssistanceId ?? "");
    setNumeroContrat(renewing ? "" : contract.numeroContrat ?? assistance.numeroContratOuQuittance ?? "");
    setDateEffet(renewing
      ? dayAfter(assistance.dateEcheance ?? contract.dateEcheance)
      : assistance.dateEffet ?? contract.dateEffet ?? today);
    setDureeMois(String(assistance.duree ?? 12));
    setCodePromo(renewing ? "" : assistance.codePromo ?? "");
    const payerType = contract.typePayeurPrime === "TIERS_MANDATE" ? "TIERS_MANDATE" : "SOUSCRIPTEUR";
    setTypePayeurPrime(payerType);
    setPayeurPrimeClientId(payerType === "TIERS_MANDATE" ? contract.payeurPrimeClientId ?? "" : "");
    hydratedContractRef.current = hydrationKey;
  }, [contratId, existingContract.data, renewing]);

  useEffect(() => {
    if (selectedProduct && !durationOptions.some((option) => option.value === dureeMois)) {
      setDureeMois(durationOptions[0]?.value ?? "12");
    }
  }, [dureeMois, durationOptions, selectedProduct]);
  const quote = useQuery({
    queryKey: ["assistance-voyage", "quote", compagnieId, produitId, dateEffet, dureeMois, codePromo.trim(), insuredBirthDates],
    queryFn: () => assistanceVoyageApi.quote({
      compagnieAssistanceId: compagnieId,
      produitAssistanceId: produitId,
      dateEffet,
      dureeMois: Number(dureeMois),
      codePromo: codePromo.trim() || undefined,
      datesNaissanceAssures: insuredBirthDates,
    }),
    enabled: Boolean(
      compagnieId
      && produitId
      && dateEffet
      && dureeMois
      && insuredBirthDates.length === effectiveInsured.length
    ),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () => {
      const request = {
        compagnieAssistanceId: compagnieId,
        produitAssistanceId: produitId,
        dateEffet,
        dureeMois: Number(dureeMois),
        numeroContrat: numeroContrat.trim(),
        codePromo: codePromo.trim() || undefined,
        souscripteur: personRequest(subscriber),
        assures: subscriberIsInsured ? [] : insuredPeople.map(personRequest),
        assureIdentiqueSouscripteur: subscriberIsInsured,
        typePayeurPrime,
        payeurPrimeClientId: typePayeurPrime === "TIERS_MANDATE" ? payeurPrimeClientId : undefined,
      };
      if (renewing && contratId) return assistanceVoyageApi.renew(contratId, request);
      if (editing && contratId) return assistanceVoyageApi.update(contratId, request);
      return assistanceVoyageApi.create(request);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
      toast.success(renewing
        ? `Dossier ${saved.numeroDossier} renouvelé`
        : editing
          ? `Dossier ${saved.numeroDossier} modifié`
          : `Dossier ${saved.numeroDossier} créé`);
      navigate(editing
        ? `/app/production/contrats/${saved.contratId}`
        : `/app/production/contrats/${saved.contratId}/pieces-jointes`);
    },
    onError: (error) => toast.error(
      error instanceof Error
        ? error.message
        : renewing
          ? "Renouvellement de l’assistance voyage impossible"
          : editing
          ? "Modification de l’assistance voyage impossible"
          : "Création de l’assistance voyage impossible"
    ),
  });

  const canSubmit = Boolean(
    compagnieId
    && produitId
    && numeroContrat.trim()
    && dateEffet
    && expiryDate
    && quote.isSuccess
    && validPerson(subscriber)
    && effectiveInsured.every(validPerson)
    && (typePayeurPrime !== "TIERS_MANDATE" || payeurPrimeClientId)
    && validatedSections.souscripteur
    && validatedSections.assures
  );

  const invalidateFrom = (section: VoyageSection) => {
    const order: VoyageSection[] = ["souscripteur", "assures", "contrat"];
    const sectionIndex = order.indexOf(section);
    setValidatedSections((current) => {
      const next = { ...current };
      order.slice(sectionIndex).forEach((key) => delete next[key]);
      return next;
    });
  };

  const validateAndContinue = (section: Exclude<VoyageSection, "contrat">) => {
    const valid = section === "souscripteur"
      ? validPerson(subscriber)
      : effectiveInsured.length > 0 && effectiveInsured.every(validPerson);
    if (!valid) {
      toast.error(section === "souscripteur"
        ? "Complétez les informations obligatoires du souscripteur."
        : "Complétez les informations obligatoires de chaque personne assurée.");
      return;
    }
    setValidatedSections((current) => ({ ...current, [section]: true }));
    setOpenSection(section === "souscripteur" ? "assures" : "contrat");
  };

  const handleSectionOpenChange = (section: VoyageSection, open: boolean) => {
    if (!open) return;
    const order: VoyageSection[] = ["souscripteur", "assures", "contrat"];
    const targetIndex = order.indexOf(section);
    const firstIncomplete = order.slice(0, targetIndex).find((item) => !validatedSections[item]);
    if (firstIncomplete) {
      setOpenSection(firstIncomplete);
      toast.error("Validez la section en cours avant de continuer.");
      return;
    }
    setOpenSection(section);
  };

  if (loadingExisting && existingContract.isLoading) {
    return <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>;
  }

  if (loadingExisting && existingContract.isError) {
    return <p className="text-sm font-medium text-destructive">Chargement du dossier impossible.</p>;
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
          <h1 className="text-xl font-semibold">
            {renewing ? "Renouveler l’assistance voyage" : editing ? "Modifier l’assistance voyage" : "Nouvelle assistance voyage"}
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link to={renewing
            ? "/app/production/echeances"
            : editing
              ? "/app/production/contrats"
              : "/app/production/ajouter-dossier"}
          >
            <ArrowLeft className="size-4" />
            Retour
          </Link>
        </Button>
      </header>

      <SectionCard
        title="Souscripteur"
        badge={validatedSections.souscripteur ? "Validé" : personBadge(subscriber)}
        tone="production"
        open={openSection === "souscripteur"}
        onOpenChange={(open) => handleSectionOpenChange("souscripteur", open)}
      >
        <PersonEditor
          value={subscriber}
          onChange={(next) => {
            setSubscriber(next);
            invalidateFrom("souscripteur");
            if (next.typeClient === "PERSONNE_MORALE") {
              setSameInsured(false);
            }
          }}
          cities={cities.data ?? []}
          allowLegalEntity
        />
        <SectionContinueButton onClick={() => validateAndContinue("souscripteur")} />
      </SectionCard>

      <SectionCard
        title="Personnes assurées"
        badge={validatedSections.assures
          ? "Validé"
          : subscriberIsInsured ? "Souscripteur" : `${insuredPeople.length} assuré${insuredPeople.length > 1 ? "s" : ""}`}
        tone="production"
        open={openSection === "assures"}
        onOpenChange={(open) => handleSectionOpenChange("assures", open)}
      >
        <div className="grid gap-4">
          <label className="flex min-h-10 items-center gap-3 rounded-md border px-3 py-2">
            <Switch disabled={!subscriberCanBeInsured} checked={subscriberIsInsured} onCheckedChange={(checked) => {
              setSameInsured(checked);
              invalidateFrom("assures");
            }} />
            <span className="text-sm font-medium">L’assuré est le souscripteur</span>
            {!subscriberCanBeInsured ? (
              <span className="text-xs text-muted-foreground">Indisponible pour une personne morale</span>
            ) : null}
          </label>

          {!subscriberIsInsured ? insuredPeople.map((person, index) => (
            <section key={index} className="grid gap-3 border-t pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Assuré {index + 1}</h3>
                {insuredPeople.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    title="Retirer cette personne"
                    onClick={() => {
                      setInsuredPeople((current) => current.filter((_, currentIndex) => currentIndex !== index));
                      invalidateFrom("assures");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <PersonEditor
                value={person}
                onChange={(next) => {
                  setInsuredPeople((current) => current.map(
                    (item, currentIndex) => currentIndex === index ? next : item
                  ));
                  invalidateFrom("assures");
                }}
                cities={cities.data ?? []}
                allowLegalEntity={false}
              />
            </section>
          )) : null}

          {!subscriberIsInsured ? (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => {
                setInsuredPeople((current) => [...current, emptyPerson()]);
                invalidateFrom("assures");
              }}
            >
              <Plus className="size-4" />
              Ajouter un assuré
            </Button>
          ) : null}
          <SectionContinueButton onClick={() => validateAndContinue("assures")} />
        </div>
      </SectionCard>

      <SectionCard
        title="Contrat"
        badge={quote.isSuccess ? "Tarif calculé" : numeroContrat.trim() ? "Renseigné" : "À compléter"}
        tone="production"
        open={openSection === "contrat"}
        onOpenChange={(open) => handleSectionOpenChange("contrat", open)}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Compagnie d’assistance" required>
            <Input className="bg-muted/50" value={selectedCompany?.libelle ?? ""} readOnly />
          </Field>
          <Field label="Produit d’assistance" required>
            <Input className="bg-muted/50" value={selectedProduct?.libelle ?? ""} readOnly />
          </Field>
          <Field label={renewing ? "N° du nouveau contrat" : "N° de contrat"} required>
            <Input value={numeroContrat} onChange={(event) => setNumeroContrat(event.target.value)} />
          </Field>
          <Field label="Durée" required>
            <Select value={dureeMois} onValueChange={setDureeMois}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {durationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date d’effet" required>
            <DatePicker date={dateEffet} onSelect={(date) => setDateEffet(toDateOnly(date) ?? "")} />
          </Field>
          <Field label="Date d’expiration">
            <Input value={expiryDate ? formatDate(expiryDate) : ""} readOnly />
          </Field>
          <Field label="Code promo">
            <Input value={codePromo} onChange={(event) => setCodePromo(event.target.value.toUpperCase())} />
          </Field>
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

        {quote.data ? (
          <div className="mt-4 grid gap-3">
            <div className="grid overflow-hidden rounded-md border sm:grid-cols-3">
              <Summary label="Prime nette (MAD)" value={money(quote.data.primeNette)} />
              <Summary label="Réduction (MAD)" value={money(quote.data.montantReduction)} />
              <Summary label="Prime TTC (MAD)" value={money(quote.data.primeTotale)} strong />
            </div>
            {quote.data.lignes.length > 1 ? (
              <div className="overflow-hidden rounded-md border">
                {quote.data.lignes.map((line) => (
                  <div key={line.assureIndex} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b px-3 py-2 text-sm last:border-b-0">
                    <span className="truncate font-medium">
                      {personName(effectiveInsured[line.assureIndex]) || `Assuré ${line.assureIndex + 1}`}
                    </span>
                    <span className="text-muted-foreground">{line.age} ans</span>
                    <span className="tabular-nums">{money(line.primeTotale)} MAD</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {quote.isError ? (
          <p className="mt-3 text-sm font-medium text-destructive">
            {quote.error instanceof Error ? quote.error.message : "Tarification impossible"}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2 border-t pt-4">
          <Button asChild variant="outline">
            <Link to={loadingExisting && contratId ? `/app/production/contrats/${contratId}` : "/app/production/ajouter-dossier"}>Annuler</Link>
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || save.isPending}
            onClick={() => save.mutate()}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plane className="size-4" />}
            {save.isPending
              ? "Enregistrement..."
              : renewing
                ? "Renouveler l’assistance"
                : editing
                  ? "Enregistrer les modifications"
                  : "Créer le dossier"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

function SectionContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-4 flex justify-end border-t pt-3">
      <Button type="button" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={onClick}>
        <Save className="size-4" />
        Enregistrer
      </Button>
    </div>
  );
}

function PersonEditor(props: {
  value: PersonDraft;
  onChange: (value: PersonDraft) => void;
  cities: ReferenceOption[];
  allowLegalEntity: boolean;
}) {
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIdentity = props.value.typeClient === "PERSONNE_MORALE"
    ? props.value.rc.trim()
    : props.value.documentNumber.trim();
  const currentIdentityRef = useRef(currentIdentity);
  currentIdentityRef.current = currentIdentity;
  const search = useMutation({
    mutationFn: (value: string) => props.value.typeClient === "PERSONNE_MORALE"
      ? clientApi.searchClient({ rc: value })
      : clientApi.searchClient(props.value.documentType === "CIN"
        ? { cin: value }
        : { passport: value }),
    onSuccess: (client, searchedValue) => {
      if (currentIdentityRef.current !== searchedValue) return;
      if (!client) {
        setLookup({ status: "new", message: "Nouveau client : aucune fiche trouvée." });
        return;
      }
      if (!props.allowLegalEntity && client.typeClient !== "PERSONNE_PHYSIQUE") {
        setLookup({ status: "error", message: "Une personne assurée doit être une personne physique." });
        return;
      }
      props.onChange(personFromClient(client, props.value.documentType));
      setLookup({
        status: "found",
        message: `Client existant chargé${client.nomAffichage ? ` : ${client.nomAffichage}` : ""}.`,
      });
    },
    onError: (_error, searchedValue) => {
      if (currentIdentityRef.current === searchedValue) {
        setLookup({ status: "error", message: "Recherche client indisponible." });
      }
    },
  });
  const locked = Boolean(props.value.clientId);

  useEffect(() => () => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
  }, []);

  function update(patch: Partial<PersonDraft>) {
    props.onChange({ ...props.value, ...patch });
  }

  function searchIdentity(value: string, immediate = false) {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const normalized = value.trim();
    if (normalized.length < 3) {
      setLookup({ status: "idle" });
      return;
    }
    setLookup({ status: "loading", message: "Recherche du client..." });
    if (immediate) {
      search.mutate(normalized);
      return;
    }
    lookupTimer.current = setTimeout(() => search.mutate(normalized), 500);
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {props.allowLegalEntity ? (
        <Field label="Type de souscripteur" required>
          <Select
            disabled={locked}
            value={props.value.typeClient}
            onValueChange={(value) => {
              setLookup({ status: "idle" });
              props.onChange(emptyPerson(value as PersonDraft["typeClient"]));
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PERSONNE_PHYSIQUE">Personne physique</SelectItem>
              <SelectItem value="PERSONNE_MORALE">Personne morale</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {props.value.typeClient === "PERSONNE_MORALE" ? (
        <>
          <Field label="N° RC" required>
            <IdentitySearchField
              value={props.value.rc}
              lookup={lookup}
              onChange={(rc) => {
                update({ rc, clientId: undefined });
                searchIdentity(rc);
              }}
              onBlur={() => searchIdentity(props.value.rc, true)}
            />
          </Field>
          <Field label="Raison sociale" required>
            <Input readOnly={locked} value={props.value.raisonSociale} onChange={(event) => update({ raisonSociale: event.target.value })} />
          </Field>
          <Field label="ICE">
            <Input readOnly={locked} value={props.value.ice} onChange={(event) => update({ ice: event.target.value })} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Pièce d’identité" required>
            <Select value={props.value.documentType} onValueChange={(value) => {
              setLookup({ status: "idle" });
              props.onChange({
                ...emptyPerson("PERSONNE_PHYSIQUE"),
                documentType: value as IdentityType,
              });
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CIN">CIN</SelectItem>
                <SelectItem value="PASSEPORT">Passeport</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={props.value.documentType === "CIN" ? "N° CIN" : "N° passeport"} required>
            <IdentitySearchField
              value={props.value.documentNumber}
              lookup={lookup}
              onChange={(documentNumber) => {
                update({ documentNumber, clientId: undefined });
                searchIdentity(documentNumber);
              }}
              onBlur={() => searchIdentity(props.value.documentNumber, true)}
            />
          </Field>
          {props.value.documentType === "CIN" ? (
            <Field label="Validité CIN" required>
              <DatePicker
                disabled={locked}
                date={props.value.documentValidity}
                onSelect={(date) => update({ documentValidity: toDateOnly(date) ?? "" })}
              />
            </Field>
          ) : null}
          <Field label="Genre" required>
            <Select disabled={locked} value={props.value.genre} onValueChange={(value) => update({ genre: value as PersonDraft["genre"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="HOMME">Homme</SelectItem><SelectItem value="FEMME">Femme</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Prénom" required><Input readOnly={locked} value={props.value.prenom} onChange={(event) => update({ prenom: event.target.value })} /></Field>
          <Field label="Nom" required><Input readOnly={locked} value={props.value.nom} onChange={(event) => update({ nom: event.target.value })} /></Field>
          <Field label="Date de naissance" required>
            <DatePicker disabled={locked} date={props.value.dateNaissance} onSelect={(date) => update({ dateNaissance: toDateOnly(date) ?? "" })} />
          </Field>
          <Field label="Nationalité" required><Input readOnly={locked} value={props.value.nationalite} onChange={(event) => update({ nationalite: event.target.value })} /></Field>
        </>
      )}
      <Field label="Ville" required>
        <AutocompleteSelect
          value={props.value.villeId}
          disabled={locked}
          placeholder="Ville"
          emptyText="Aucune ville trouvée"
          invalidText="Ville invalide : choisissez une option existante."
          options={props.cities.map((city) => ({ value: city.id, label: city.libelle, keywords: city.code }))}
          onValueChange={(villeId) => update({ villeId })}
        />
      </Field>
      <Field label="Adresse" required><Input readOnly={locked} value={props.value.adresse} onChange={(event) => update({ adresse: event.target.value })} /></Field>
      <Field label="Téléphone" required><Input readOnly={locked} value={props.value.telephone} onChange={(event) => update({ telephone: event.target.value })} /></Field>
      <Field label="E-mail"><Input readOnly={locked} type="email" value={props.value.email} onChange={(event) => update({ email: event.target.value })} /></Field>
    </div>
  );
}

function IdentitySearchField(props: {
  value: string;
  lookup: LookupState;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="grid gap-1">
      <Input
        value={props.value}
        onBlur={props.onBlur}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <LookupMessage state={props.lookup} />
    </div>
  );
}

function LookupMessage({ state }: { state: LookupState }) {
  if (state.status === "idle") return null;
  const tone = state.status === "found"
    ? "text-emerald-700 dark:text-emerald-400"
    : state.status === "new"
      ? "text-muted-foreground"
      : state.status === "error"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <span className={`flex items-center gap-1 text-xs ${tone}`}>
      {state.status === "loading" ? <Loader2 className="size-3 animate-spin" /> : null}
      {state.message}
    </span>
  );
}

function emptyPerson(typeClient: PersonDraft["typeClient"] = "PERSONNE_PHYSIQUE"): PersonDraft {
  return {
    typeClient,
    documentType: "CIN",
    documentNumber: "",
    documentValidity: "",
    genre: "HOMME",
    prenom: "",
    nom: "",
    raisonSociale: "",
    rc: "",
    ice: "",
    dateNaissance: "",
    nationalite: "Marocaine",
    adresse: "",
    villeId: "",
    telephone: "",
    email: "",
  };
}

function personRequest(person: PersonDraft): AssistanceVoyagePersonRequest {
  if (person.clientId) return { clientId: person.clientId };
  if (person.typeClient === "PERSONNE_MORALE") {
    return {
      client: {
        typeClient: "PERSONNE_MORALE",
        raisonSociale: person.raisonSociale.trim(),
        rc: person.rc.trim(),
        ice: person.ice.trim() || undefined,
        adresse: person.adresse.trim(),
        villeId: person.villeId,
        telephone: person.telephone.trim(),
        email: person.email.trim() || undefined,
      },
    };
  }
  return {
    client: {
      typeClient: "PERSONNE_PHYSIQUE",
      genre: person.genre,
      prenom: person.prenom.trim(),
      nom: person.nom.trim(),
      cin: person.documentType === "CIN" ? person.documentNumber.trim() : undefined,
      cinValidite: person.documentValidity,
      passport: person.documentType === "PASSEPORT" ? person.documentNumber.trim() : undefined,
      dateNaissance: person.dateNaissance,
      nationalite: person.nationalite.trim(),
      adresse: person.adresse.trim(),
      villeId: person.villeId,
      telephone: person.telephone.trim(),
      email: person.email.trim() || undefined,
    },
  };
}

function personFromClient(client: ClientResponse, documentType: IdentityType): PersonDraft {
  const legalEntity = client.typeClient === "PERSONNE_MORALE";
  return {
    clientId: client.id,
    typeClient: legalEntity ? "PERSONNE_MORALE" : "PERSONNE_PHYSIQUE",
    documentType,
    documentNumber: documentType === "CIN" ? client.cin ?? "" : client.passport ?? "",
    documentValidity: client.cinValidite ?? "",
    genre: client.genre ?? "HOMME",
    prenom: client.prenom ?? "",
    nom: client.nom ?? "",
    raisonSociale: client.raisonSociale ?? "",
    rc: client.rc ?? "",
    ice: client.ice ?? "",
    dateNaissance: client.dateNaissance ?? "",
    nationalite: client.nationalite ?? "",
    adresse: client.adresse ?? "",
    villeId: client.villeId ?? "",
    telephone: client.telephone ?? "",
    email: client.email ?? "",
  };
}

function identityTypeFor(client: ClientResponse): IdentityType {
  return client.passport && !client.cin ? "PASSEPORT" : "CIN";
}

function validPerson(person: PersonDraft) {
  if (person.typeClient === "PERSONNE_MORALE") {
    return Boolean(
      person.rc.trim()
      && person.raisonSociale.trim()
      && person.villeId
      && person.adresse.trim()
      && person.telephone.trim()
    );
  }
  return Boolean(
    person.documentNumber.trim()
    && (person.documentType !== "CIN" || person.documentValidity)
    && person.prenom.trim()
    && person.nom.trim()
    && person.dateNaissance
    && person.nationalite.trim()
    && person.villeId
    && person.adresse.trim()
    && person.telephone.trim()
  );
}

function personBadge(person: PersonDraft) {
  return person.clientId ? "Client existant" : validPerson(person) ? "Renseigné" : "À compléter";
}

function personName(person: PersonDraft) {
  if (person.typeClient === "PERSONNE_MORALE") return person.raisonSociale.trim();
  return [person.prenom, person.nom].filter(Boolean).join(" ").trim();
}

function calculateExpiryDate(start: string, months: number) {
  const [year, month, day] = start.split("-").map(Number);
  if (!year || !month || !day || !months) return "";
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const expiration = new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)));
  expiration.setUTCDate(expiration.getUTCDate() - 1);
  return expiration.toISOString().slice(0, 10);
}

function dayAfter(value?: string | null) {
  if (!value) return today;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return today;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function travelDurationOptions(product?: ReferenceOption) {
  const configured = Array.isArray(product?.dureesTarifaires)
    ? product.dureesTarifaires.map(Number).filter(Number.isFinite)
    : [];
  const options: Array<{ value: string; label: string }> = [];
  if (configured.includes(6)) options.push({ value: "6", label: "6 mois" });
  if (configured.includes(12)) {
    options.push(
      { value: "12", label: "1 an" },
      { value: "24", label: "2 ans" },
      { value: "36", label: "3 ans" },
      { value: "48", label: "4 ans" },
      { value: "60", label: "5 ans" },
    );
  }
  return options.length > 0 ? options : [{ value: "12", label: "1 an" }];
}

function money(value: number) {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function Summary({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 tabular-nums ${strong ? "text-lg font-semibold text-emerald-700" : "font-medium"}`}>
        {value}
      </div>
    </div>
  );
}
