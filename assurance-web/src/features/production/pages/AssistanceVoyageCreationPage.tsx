import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plane, Plus, Search, Trash2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { assistanceVoyageApi } from "../api/assistance-voyage";
import { clientApi } from "../api/clients";
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

type PersonDraft = {
  clientId?: string;
  documentType: IdentityType;
  documentNumber: string;
  documentValidity: string;
  genre: "HOMME" | "FEMME";
  prenom: string;
  nom: string;
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
  const [searchParams] = useSearchParams();
  const [compagnieId, setCompagnieId] = useState(searchParams.get("compagnieId") ?? "");
  const [produitId, setProduitId] = useState(searchParams.get("produitId") ?? "");
  const [subscriber, setSubscriber] = useState(emptyPerson());
  const [sameInsured, setSameInsured] = useState(true);
  const [insuredPeople, setInsuredPeople] = useState<PersonDraft[]>([emptyPerson()]);
  const [numeroContrat, setNumeroContrat] = useState("");
  const [dateEffet, setDateEffet] = useState(today);
  const [dureeMois, setDureeMois] = useState("12");
  const [codePromo, setCodePromo] = useState("");
  const [payer, setPayer] = useState("subscriber");

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

  const effectiveInsured = sameInsured ? [subscriber] : insuredPeople;
  const quote = useQuery({
    queryKey: ["assistance-voyage", "quote", compagnieId, produitId, dateEffet, dureeMois, codePromo.trim()],
    queryFn: () => assistanceVoyageApi.quote({
      compagnieAssistanceId: compagnieId,
      produitAssistanceId: produitId,
      dateEffet,
      dureeMois: Number(dureeMois),
      codePromo: codePromo.trim() || undefined,
    }),
    enabled: Boolean(compagnieId && produitId && dateEffet && dureeMois),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => assistanceVoyageApi.create({
      compagnieAssistanceId: compagnieId,
      produitAssistanceId: produitId,
      dateEffet,
      dureeMois: Number(dureeMois),
      numeroContrat: numeroContrat.trim(),
      codePromo: codePromo.trim() || undefined,
      souscripteur: personRequest(subscriber),
      assures: sameInsured ? [] : insuredPeople.map(personRequest),
      assureIdentiqueSouscripteur: sameInsured,
      payeurIndex: payer === "subscriber" ? -1 : Number(payer.replace("insured-", "")),
    }),
    onSuccess: (created) => {
      toast.success(`Dossier ${created.numeroDossier} créé`);
      navigate(`/app/production/contrats/${created.contratId}`);
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Création de l’assistance voyage impossible"
    ),
  });

  const canSubmit = Boolean(
    compagnieId
    && produitId
    && numeroContrat.trim()
    && dateEffet
    && quote.isSuccess
    && validPerson(subscriber)
    && effectiveInsured.every(validPerson)
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
          <h1 className="text-xl font-semibold">Nouvelle assistance voyage</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/production/ajouter-dossier">
            <ArrowLeft className="size-4" />
            Retour
          </Link>
        </Button>
      </header>

      <SectionCard title="Souscripteur" badge={personBadge(subscriber)} tone="production" defaultOpen>
        <PersonEditor
          value={subscriber}
          onChange={setSubscriber}
          cities={cities.data ?? []}
        />
      </SectionCard>

      <SectionCard
        title="Personnes assurées"
        badge={sameInsured ? "Souscripteur" : `${insuredPeople.length} assuré${insuredPeople.length > 1 ? "s" : ""}`}
        tone="production"
        defaultOpen
      >
        <div className="grid gap-4">
          <label className="flex min-h-10 items-center gap-3 rounded-md border px-3 py-2">
            <Switch checked={sameInsured} onCheckedChange={(checked) => {
              setSameInsured(checked);
              setPayer("subscriber");
            }} />
            <span className="text-sm font-medium">L’assuré est le souscripteur</span>
          </label>

          {!sameInsured ? insuredPeople.map((person, index) => (
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
                      setPayer("subscriber");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <PersonEditor
                value={person}
                onChange={(next) => setInsuredPeople((current) => current.map(
                  (item, currentIndex) => currentIndex === index ? next : item
                ))}
                cities={cities.data ?? []}
              />
            </section>
          )) : null}

          {!sameInsured ? (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => setInsuredPeople((current) => [...current, emptyPerson()])}
            >
              <Plus className="size-4" />
              Ajouter un assuré
            </Button>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Contrat" badge={numeroContrat.trim() ? "Renseigné" : "À compléter"} tone="production" defaultOpen>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Compagnie d’assistance" required>
            <Select value={compagnieId} onValueChange={(value) => {
              setCompagnieId(value);
              setProduitId("");
            }}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                {(companies.data ?? []).map((company) => (
                  <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Produit d’assistance" required>
            <Select value={produitId} onValueChange={setProduitId} disabled={!compagnieId}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                {(products.data ?? []).map((product) => (
                  <SelectItem key={product.id} value={product.id}>{product.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="N° de contrat" required>
            <Input value={numeroContrat} onChange={(event) => setNumeroContrat(event.target.value)} />
          </Field>
          <Field label="Durée" required>
            <Select value={dureeMois} onValueChange={setDureeMois}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 mois</SelectItem>
                <SelectItem value="12">1 an</SelectItem>
                <SelectItem value="24">2 ans</SelectItem>
                <SelectItem value="36">3 ans</SelectItem>
                <SelectItem value="48">4 ans</SelectItem>
                <SelectItem value="60">5 ans</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date d’effet" required>
            <DatePicker date={dateEffet} onSelect={(date) => setDateEffet(toDateOnly(date) ?? "")} />
          </Field>
          <Field label="Date d’expiration">
            <Input value={quote.data?.dateEcheance ? formatDate(quote.data.dateEcheance) : ""} readOnly />
          </Field>
          <Field label="Code promo">
            <Input value={codePromo} onChange={(event) => setCodePromo(event.target.value.toUpperCase())} />
          </Field>
          <Field label="Payeur" required>
            <Select value={payer} onValueChange={setPayer}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="subscriber">Souscripteur</SelectItem>
                {!sameInsured ? insuredPeople.map((person, index) => (
                  <SelectItem key={index} value={`insured-${index}`}>
                    {personName(person) || `Assuré ${index + 1}`}
                  </SelectItem>
                )) : null}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {quote.data ? (
          <div className="mt-4 grid overflow-hidden rounded-md border sm:grid-cols-3">
            <Summary label="Prime nette (MAD)" value={money(quote.data.primeNette)} />
            <Summary label="Réduction (MAD)" value={money(quote.data.montantReduction)} />
            <Summary label="Prime TTC (MAD)" value={money(quote.data.primeTotale)} strong />
          </div>
        ) : null}
        {quote.isError ? (
          <p className="mt-3 text-sm font-medium text-destructive">
            {quote.error instanceof Error ? quote.error.message : "Tarification impossible"}
          </p>
        ) : null}
      </SectionCard>

      <footer className="flex justify-end gap-2 border-t py-4">
        <Button asChild variant="outline"><Link to="/app/production/ajouter-dossier">Annuler</Link></Button>
        <Button
          type="button"
          disabled={!canSubmit || create.isPending}
          onClick={() => create.mutate()}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Plane className="size-4" />
          {create.isPending ? "Enregistrement..." : "Créer le dossier"}
        </Button>
      </footer>
    </div>
  );
}

function PersonEditor(props: {
  value: PersonDraft;
  onChange: (value: PersonDraft) => void;
  cities: ReferenceOption[];
}) {
  const search = useMutation({
    mutationFn: () => clientApi.searchClient(props.value.documentType === "CIN"
      ? { cin: props.value.documentNumber.trim() }
      : { passport: props.value.documentNumber.trim() }),
    onSuccess: (client) => {
      if (!client) {
        toast.info("Aucun client existant trouvé");
        return;
      }
      props.onChange(personFromClient(client, props.value.documentType));
      toast.success("Client existant sélectionné");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Recherche impossible"),
  });
  const locked = Boolean(props.value.clientId);

  function update(patch: Partial<PersonDraft>) {
    props.onChange({ ...props.value, ...patch });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Field label="Pièce d’identité" required>
        <Select value={props.value.documentType} onValueChange={(value) => props.onChange({
          ...emptyPerson(),
          documentType: value as IdentityType,
        })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CIN">CIN</SelectItem>
            <SelectItem value="PASSEPORT">Passeport</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={props.value.documentType === "CIN" ? "N° CIN" : "N° passeport"} required>
        <div className="flex gap-2">
          <Input
            value={props.value.documentNumber}
            readOnly={locked}
            onChange={(event) => update({ documentNumber: event.target.value, clientId: undefined })}
          />
          {!locked ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Rechercher ce document"
              disabled={!props.value.documentNumber.trim() || search.isPending}
              onClick={() => search.mutate()}
            >
              <Search className="size-4" />
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => props.onChange(emptyPerson())}>
              Changer
            </Button>
          )}
        </div>
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
      <Field label="Civilité" required>
        <Select disabled={locked} value={props.value.genre} onValueChange={(value) => update({ genre: value as PersonDraft["genre"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="HOMME">Monsieur</SelectItem><SelectItem value="FEMME">Madame</SelectItem></SelectContent>
        </Select>
      </Field>
      <Field label="Prénom" required><Input readOnly={locked} value={props.value.prenom} onChange={(event) => update({ prenom: event.target.value })} /></Field>
      <Field label="Nom" required><Input readOnly={locked} value={props.value.nom} onChange={(event) => update({ nom: event.target.value })} /></Field>
      <Field label="Date de naissance" required>
        <DatePicker disabled={locked} date={props.value.dateNaissance} onSelect={(date) => update({ dateNaissance: toDateOnly(date) ?? "" })} />
      </Field>
      <Field label="Nationalité" required><Input readOnly={locked} value={props.value.nationalite} onChange={(event) => update({ nationalite: event.target.value })} /></Field>
      <Field label="Ville" required>
        <Select disabled={locked} value={props.value.villeId} onValueChange={(villeId) => update({ villeId })}>
          <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
          <SelectContent>{props.cities.map((city) => <SelectItem key={city.id} value={city.id}>{city.libelle}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Adresse" required><Input readOnly={locked} value={props.value.adresse} onChange={(event) => update({ adresse: event.target.value })} /></Field>
      <Field label="Téléphone" required><Input readOnly={locked} value={props.value.telephone} onChange={(event) => update({ telephone: event.target.value })} /></Field>
      <Field label="E-mail"><Input readOnly={locked} type="email" value={props.value.email} onChange={(event) => update({ email: event.target.value })} /></Field>
    </div>
  );
}

function emptyPerson(): PersonDraft {
  return {
    documentType: "CIN",
    documentNumber: "",
    documentValidity: "",
    genre: "HOMME",
    prenom: "",
    nom: "",
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
  return {
    client: {
      typeClient: "PERSONNE_PHYSIQUE",
      genre: person.genre,
      prenom: person.prenom.trim(),
      nom: person.nom.trim(),
      cin: person.documentType === "CIN" ? person.documentNumber.trim() : undefined,
      cinValidite: person.documentType === "CIN" ? person.documentValidity : undefined,
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
  return {
    clientId: client.id,
    documentType,
    documentNumber: documentType === "CIN" ? client.cin ?? "" : client.passport ?? "",
    documentValidity: client.cinValidite ?? "",
    genre: client.genre ?? "HOMME",
    prenom: client.prenom ?? "",
    nom: client.nom ?? "",
    dateNaissance: client.dateNaissance ?? "",
    nationalite: client.nationalite ?? "",
    adresse: client.adresse ?? "",
    villeId: client.villeId ?? "",
    telephone: client.telephone ?? "",
    email: client.email ?? "",
  };
}

function validPerson(person: PersonDraft) {
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
  return [person.prenom, person.nom].filter(Boolean).join(" ").trim();
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
