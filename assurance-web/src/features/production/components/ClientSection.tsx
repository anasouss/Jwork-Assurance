import { useEffect, useRef, useState } from "react";
import { Info, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { SectionCard } from "./SectionCard";
import { Field } from "./Field";
import { toDateOnly } from "../date";
import { productionApi } from "../api";
import type { ClientInput, ClientResponse, GroupeClient, ReferenceOption, RelationGroupeClient } from "../types";
import type { ContratSectionKey } from "../contrat-creation/useContratCreationForm";

type LookupStatus = "idle" | "loading" | "found" | "new" | "error";
type LookupState = {
  status: LookupStatus;
  message?: string;
};

export function emptyClient(role: ClientInput["role"] = "SOUSCRIPTEUR"): ClientInput {
  return {
    role,
    principalPourRole: role === "SOUSCRIPTEUR",
    client: {
      typeClient: role === "SOUSCRIPTEUR" ? "PERSONNE_MORALE" : "PERSONNE_PHYSIQUE",
      sahara: false,
      telephones: [],
    },
  };
}

export function ClientSection({
  clients,
  setClients,
  villes,
  categoriesClient = [],
  groupesClients = [],
  onSouscripteurGroupChange,
  showOptionalRoles = false,
  showProprietaireCategorie = false,
  errors = {},
  onSaveSection,
  savedSections = {},
  saving = false,
  openSection,
  onSectionOpenChange,
}: {
  clients: ClientInput[];
  setClients: (clients: ClientInput[]) => void;
  villes: ReferenceOption[];
  categoriesClient?: ReferenceOption[];
  groupesClients?: GroupeClient[];
  onSouscripteurGroupChange?: (groupe?: GroupeClient) => void;
  showOptionalRoles?: boolean;
  showProprietaireCategorie?: boolean;
  errors?: Record<string, string>;
  onSaveSection?: (section: "souscripteur" | "proprietaire") => void;
  savedSections?: Partial<Record<"souscripteur" | "proprietaire", boolean>>;
  saving?: boolean;
  openSection?: ContratSectionKey;
  onSectionOpenChange?: (section: ContratSectionKey, open: boolean) => void;
}) {
  const [sameAsSouscripteur, setSameAsSouscripteur] = useState(false);
  const [lookupByIndex, setLookupByIndex] = useState<Record<number, LookupState>>({});
  const lookupTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const proprietaire = clients.find((client) => client.role === "PROPRIETAIRE");
    const needsConducteur = Boolean(
      proprietaire && (proprietaire.client.typeClient === "PERSONNE_MORALE" || proprietaire.client.conducteurHabituel === false)
    ) && !showProprietaireCategorie;
    const hasConducteur = clients.some((client) => client.role === "CONDUCTEUR");
    if (needsConducteur && !hasConducteur) {
      setClients([...clients, emptyClient("CONDUCTEUR")]);
      return;
    }
    if (!needsConducteur && hasConducteur && !showOptionalRoles) {
      setClients(clients.filter((client) => client.role !== "CONDUCTEUR"));
    }
  }, [clients, setClients, showOptionalRoles, showProprietaireCategorie]);

  useEffect(() => () => {
    Object.values(lookupTimers.current).forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const souscripteur = clients.find((client) => client.role === "SOUSCRIPTEUR");
    const proprietaire = clients.find((client) => client.role === "PROPRIETAIRE");
    const sameClient = Boolean(
      proprietaire?.sameAsRole === "SOUSCRIPTEUR"
      || (souscripteur?.clientId && proprietaire?.clientId && souscripteur.clientId === proprietaire.clientId)
    );
    setSameAsSouscripteur(sameClient);
  }, [clients]);

  const updateClient = (index: number, patch: Partial<ClientInput["client"]>) => {
    const target = clients[index];
    if (sameAsSouscripteur && (target?.role === "SOUSCRIPTEUR" || target?.role === "PROPRIETAIRE")) {
      const sharedClientId = clients.find((client) => client.role === "SOUSCRIPTEUR")?.clientId
        ?? clients.find((client) => client.role === "PROPRIETAIRE")?.clientId;
      setClients(
        clients.map((client) =>
          client.role === "SOUSCRIPTEUR" || client.role === "PROPRIETAIRE"
            ? {
                ...client,
                clientId: sharedClientId,
                sameAsRole: client.role === "PROPRIETAIRE" ? "SOUSCRIPTEUR" : undefined,
                client: { ...client.client, ...patch },
              }
            : client
        )
      );
      return;
    }
    setClients(
      clients.map((client, idx) =>
        idx === index
          ? { ...client, client: { ...client.client, ...patch } }
          : client
      )
    );
  };

  const updateIdentity = (index: number, patch: Partial<ClientInput["client"]>) => {
    setLookupByIndex((current) => ({ ...current, [index]: { status: "idle" } }));
    const target = clients[index];
    if (sameAsSouscripteur && (target?.role === "SOUSCRIPTEUR" || target?.role === "PROPRIETAIRE")) {
      setClients(
        clients.map((client) =>
          client.role === "SOUSCRIPTEUR" || client.role === "PROPRIETAIRE"
            ? {
                ...client,
                clientId: undefined,
                sameAsRole: client.role === "PROPRIETAIRE" ? "SOUSCRIPTEUR" : undefined,
                client: { ...client.client, ...patch },
              }
            : client
        )
      );
      return;
    }
    setClients(
      clients.map((client, idx) =>
        idx === index ? { ...client, clientId: undefined, client: { ...client.client, ...patch } } : client
      )
    );
  };

  const updateClientLink = (index: number, patch: Partial<Omit<ClientInput, "client">>) => {
    setClients(clients.map((client, idx) => idx === index ? { ...client, ...patch } : client));
  };

  const fillExistingClient = (index: number, found: ClientResponse) => {
    const target = clients[index];
    const shouldFillSameAsPair = sameAsSouscripteur && (target?.role === "SOUSCRIPTEUR" || target?.role === "PROPRIETAIRE");
    setClients(
      clients.map((client, idx) => {
        const shouldFill = idx === index || (shouldFillSameAsPair && (client.role === "SOUSCRIPTEUR" || client.role === "PROPRIETAIRE"));
        return shouldFill
          ? {
              ...client,
              clientId: found.id,
              groupeClientId: found.groupe?.id ?? undefined,
              relationGroupe: found.groupe?.typeRelation ?? undefined,
              retirerGroupesActifs: false,
              sameAsRole: client.role === "PROPRIETAIRE" && shouldFillSameAsPair ? "SOUSCRIPTEUR" : client.sameAsRole,
              client: {
                ...client.client,
                typeClient: found.typeClient,
                civilite: found.civilite ?? undefined,
                prenom: found.prenom ?? undefined,
                nom: found.nom ?? undefined,
                raisonSociale: found.raisonSociale ?? undefined,
                cin: found.cin ?? undefined,
                cinValidite: found.cinValidite ?? undefined,
                rc: found.rc ?? undefined,
                ice: found.ice ?? undefined,
                numeroPermis: found.numeroPermis ?? undefined,
                dateDelivrancePermis: found.dateDelivrancePermis ?? undefined,
                dateValiditePermis: found.dateValiditePermis ?? undefined,
                dateNaissance: found.dateNaissance ?? undefined,
                adresse: found.adresse ?? undefined,
                villeId: found.villeId ?? undefined,
                categorieClientId: found.categorieClientId ?? undefined,
                telephone: found.telephone ?? undefined,
                email: found.email ?? undefined,
                conducteurHabituel: found.conducteurHabituel ?? client.client.conducteurHabituel,
                sahara: found.sahara ?? false,
                justificatifSahara: found.justificatifSahara ?? undefined,
                telephones: found.telephones?.map((telephone) => ({
                  numero: telephone.numero,
                  principal: Boolean(telephone.principal),
                  whatsapp: Boolean(telephone.whatsapp),
                })),
              },
            }
          : client;
      })
    );
    if (target?.role === "SOUSCRIPTEUR") {
      onSouscripteurGroupChange?.(
        found.groupe ? groupesClients.find((groupe) => groupe.id === found.groupe?.id) : undefined
      );
    }
  };

  const searchClient = async (index: number, params: { cin?: string; rc?: string }) => {
    const cin = params.cin?.trim();
    const rc = params.rc?.trim();
    if (!cin && !rc) {
      setLookupByIndex((current) => ({ ...current, [index]: { status: "idle" } }));
      return;
    }
    setLookupByIndex((current) => ({ ...current, [index]: { status: "loading", message: "Recherche du client..." } }));
    try {
      const found = await productionApi.searchClient({ cin, rc });
      if (found) {
        fillExistingClient(index, found);
        setLookupByIndex((current) => ({
          ...current,
          [index]: { status: "found", message: `Client existant chargé${found.nomAffichage ? ` : ${found.nomAffichage}` : ""}.` },
        }));
        return;
      }
      setLookupByIndex((current) => ({
        ...current,
        [index]: { status: "new", message: "Nouveau client : aucune fiche trouvée." },
      }));
    } catch {
      setLookupByIndex((current) => ({
        ...current,
        [index]: { status: "error", message: "Recherche client indisponible." },
      }));
    }
  };

  const scheduleClientSearch = (index: number, params: { cin?: string; rc?: string }) => {
    clearTimeout(lookupTimers.current[index]);
    const cin = params.cin?.trim();
    const rc = params.rc?.trim();
    if ((cin ?? rc ?? "").length < 3) {
      setLookupByIndex((current) => ({ ...current, [index]: { status: "idle" } }));
      return;
    }
    setLookupByIndex((current) => ({ ...current, [index]: { status: "loading", message: "Recherche du client..." } }));
    lookupTimers.current[index] = setTimeout(() => {
      void searchClient(index, params);
    }, 500);
  };

  const setProprietaireConducteur = (index: number, value: boolean) => {
    const nextClients = clients.filter((client) => value || client.role !== "CONDUCTEUR" || showOptionalRoles);
    if (sameAsSouscripteur) {
      setClients(
        nextClients.map((client) =>
          client.role === "SOUSCRIPTEUR" || client.role === "PROPRIETAIRE"
            ? {
                ...client,
                sameAsRole: client.role === "PROPRIETAIRE" ? "SOUSCRIPTEUR" : undefined,
                client: { ...client.client, conducteurHabituel: value },
              }
            : client
        )
      );
      return;
    }
    setClients(
      nextClients.map((client, idx) =>
        idx === index
          ? { ...client, client: { ...client.client, conducteurHabituel: value } }
          : client
      )
    );
  };

  const copySouscripteurToProprietaire = (checked: boolean) => {
    setSameAsSouscripteur(checked);
    if (!checked) {
      setClients(
        clients.map((client) =>
          client.role === "PROPRIETAIRE"
            ? { ...client, clientId: undefined, sameAsRole: undefined }
            : client
        )
      );
      return;
    }
    const souscripteur = clients.find((client) => client.role === "SOUSCRIPTEUR");
    const proprietaire = clients.find((client) => client.role === "PROPRIETAIRE");
    if (!souscripteur || !proprietaire) {
      return;
    }
    const sharedClient = {
      ...souscripteur.client,
      categorieClientId: proprietaire.client.categorieClientId ?? souscripteur.client.categorieClientId,
      telephone: proprietaire.client.telephone ?? souscripteur.client.telephone,
      telephones: proprietaire.client.telephones?.length ? proprietaire.client.telephones : souscripteur.client.telephones,
      email: proprietaire.client.email ?? souscripteur.client.email,
      conducteurHabituel: proprietaire.client.conducteurHabituel,
      sahara: proprietaire.client.sahara,
      justificatifSahara: proprietaire.client.justificatifSahara,
    };
    setClients(
      clients.map((client) =>
        client.role === "SOUSCRIPTEUR"
          ? { ...client, client: sharedClient }
          : client.role === "PROPRIETAIRE"
            ? {
                ...client,
                clientId: souscripteur.clientId,
                sameAsRole: "SOUSCRIPTEUR",
                client: sharedClient,
              }
            : client
      )
    );
  };

  const renderClients = (rolesToShow: ClientInput["role"][]) => {
    const visibleClients = clients
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => rolesToShow.includes(item.role));

    return (
      <div className="grid gap-4">
        {visibleClients.map(({ item, index }) => {
          const morale = item.client.typeClient === "PERSONNE_MORALE";
          const isProprietaire = item.role === "PROPRIETAIRE";
          const selectedVille = villes.find((ville) => ville.id === item.client.villeId);
          const saharaAllowed = Boolean(selectedVille?.saharienne);
          const disabledByCopy = isProprietaire && sameAsSouscripteur;
          const showProprietaireConducteur = isProprietaire && !showProprietaireCategorie;
          const proprietorIsDriver = showProprietaireConducteur && !morale && item.client.conducteurHabituel !== false;
          const showProprietairePermisFields = isProprietaire && (showProprietaireCategorie || (!morale && proprietorIsDriver));
          const conducteur = clients
            .map((client, clientIndex) => ({ client, clientIndex }))
            .find(({ client }) => client.role === "CONDUCTEUR");
          return (
            <div key={index} className="rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{item.role === "SOUSCRIPTEUR" ? "Identité souscripteur" : item.role === "PROPRIETAIRE" ? "Identité propriétaire" : item.role}</div>
                {clients.length > 1 && item.role !== "SOUSCRIPTEUR" && item.role !== "PROPRIETAIRE" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setClients(clients.filter((_, idx) => idx !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              {isProprietaire ? (
                <label className="mb-4 flex items-center gap-2 text-sm">
                  <Checkbox checked={sameAsSouscripteur} onCheckedChange={(checked) => copySouscripteurToProprietaire(Boolean(checked))} />
                  Le propriétaire est-il lui-même le souscripteur ?
                </label>
              ) : null}
              <div className={`grid gap-3 md:grid-cols-2 ${isProprietaire && showProprietaireCategorie ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
                <Field label="Type" required>
                  <Select
                    value={item.client.typeClient}
                    disabled={disabledByCopy}
                    onValueChange={(value) => updateClient(index, { typeClient: value as ClientInput["client"]["typeClient"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSONNE_PHYSIQUE">Physique</SelectItem>
                      <SelectItem value="PERSONNE_MORALE">Morale</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {morale ? (
                  <>
                    <Field label="RC" required error={errors[`clients.${index}.client.rc`]}>
                      <Input
                        disabled={disabledByCopy}
                        value={item.client.rc ?? ""}
                        onBlur={() => searchClient(index, { rc: item.client.rc })}
                        onChange={(event) => {
                          updateIdentity(index, { rc: event.target.value });
                          scheduleClientSearch(index, { rc: event.target.value });
                        }}
                      />
                      <LookupMessage state={lookupByIndex[index]} />
                    </Field>
                    <Field label="Raison sociale" required error={errors[`clients.${index}.client.raisonSociale`]}>
                      <Input disabled={disabledByCopy} value={item.client.raisonSociale ?? ""} onChange={(event) => updateClient(index, { raisonSociale: event.target.value })} />
                    </Field>
                    <Field label="ICE">
                      <Input disabled={disabledByCopy} value={item.client.ice ?? ""} onChange={(event) => updateClient(index, { ice: event.target.value })} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Intitulé" required error={errors[`clients.${index}.client.civilite`]}>
                      <Select value={item.client.civilite ?? ""} disabled={disabledByCopy} onValueChange={(value) => updateClient(index, { civilite: value })}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monsieur">Monsieur</SelectItem>
                          <SelectItem value="madame">Madame</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="CIN" required error={errors[`clients.${index}.client.cin`]}>
                      <Input
                        disabled={disabledByCopy}
                        value={item.client.cin ?? ""}
                        onBlur={() => searchClient(index, { cin: item.client.cin })}
                        onChange={(event) => {
                          updateIdentity(index, { cin: event.target.value });
                          scheduleClientSearch(index, { cin: event.target.value });
                        }}
                      />
                      <LookupMessage state={lookupByIndex[index]} />
                    </Field>
                    <Field label="Validité CIN" required error={errors[`clients.${index}.client.cinValidite`]}>
                      <DatePicker date={item.client.cinValidite} disabled={disabledByCopy} onSelect={(date) => updateClient(index, { cinValidite: toDateOnly(date) })} />
                    </Field>
                  </>
                )}
                {isProprietaire && showProprietaireCategorie ? (
                  <Field label="Catégorie" required error={errors[`clients.${index}.client.categorieClientId`]}>
                    <Select
                      value={item.client.categorieClientId ?? ""}
                      onValueChange={(value) => updateClient(index, { categorieClientId: value })}
                    >
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>
                        {categoriesClient.map((categorie) => (
                          <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {!morale ? (
                  <>
                    <Field label="Nom" required error={errors[`clients.${index}.client.nom`]}>
                      <Input disabled={disabledByCopy} value={item.client.nom ?? ""} onChange={(event) => updateClient(index, { nom: event.target.value })} />
                    </Field>
                    <Field label="Prénom" required error={errors[`clients.${index}.client.prenom`]}>
                      <Input disabled={disabledByCopy} value={item.client.prenom ?? ""} onChange={(event) => updateClient(index, { prenom: event.target.value })} />
                    </Field>
                  </>
                ) : null}
                <Field label="Ville" required error={errors[`clients.${index}.client.villeId`]}>
                  <AutocompleteSelect
                    value={item.client.villeId ?? ""}
                    disabled={disabledByCopy}
                    placeholder="Ville"
                    emptyText="Aucune ville trouvée"
                    invalidText="Ville invalide : choisissez une option existante."
                    options={villes.map((ville) => ({ value: ville.id, label: ville.libelle, keywords: ville.code }))}
                    onValueChange={(value) => updateClient(index, { villeId: value, sahara: false, justificatifSahara: undefined })}
                  />
                </Field>
                <Field label="Adresse" required error={errors[`clients.${index}.client.adresse`]}>
                  <Input disabled={disabledByCopy} value={item.client.adresse ?? ""} onChange={(event) => updateClient(index, { adresse: event.target.value })} />
                </Field>
              </div>
              {isProprietaire ? (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-end gap-2 pb-2">
                      <Checkbox
                        checked={Boolean(item.client.sahara)}
                        disabled={!saharaAllowed}
                        onCheckedChange={(checked) => updateClient(index, { sahara: Boolean(checked) })}
                      />
                      <span className="text-sm text-muted-foreground">Réduction saharienne</span>
                    </div>
                    {item.client.sahara ? (
                      <Field label="Justificatif sahara">
                        <Select value={item.client.justificatifSahara ?? ""} onValueChange={(value) => updateClient(index, { justificatifSahara: value })}>
                          <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CNI">CNI</SelectItem>
                            <SelectItem value="Certificat de résidence">Certificat de résidence</SelectItem>
                            <SelectItem value="Certificat de présence au corps">Certificat de présence au corps</SelectItem>
                            <SelectItem value="Registre de commerce modèle J">Registre de commerce modèle J</SelectItem>
                            <SelectItem value="Autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    ) : null}
                    <Field label="Email">
                      <Input type="email" value={item.client.email ?? ""} onChange={(event) => updateClient(index, { email: event.target.value })} />
                    </Field>
                    <TelephoneList
                      client={item}
                      updateClient={(patch) => updateClient(index, patch)}
                      error={errors[`clients.${index}.client.telephones`]}
                    />
                  </div>
                  {showProprietaireConducteur ? (
                    <div className="mt-3 grid max-w-5xl gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <div className="grid gap-2 text-sm md:col-span-2">
                        <span className="font-medium">Le propriétaire est-il lui-même le conducteur ?</span>
                        <RadioGroup
                          className="flex items-center gap-5"
                          value={morale ? "non" : proprietorIsDriver ? "oui" : "non"}
                          onValueChange={(value) => setProprietaireConducteur(index, value === "oui")}
                          disabled={morale}
                        >
                          <label className={`flex items-center gap-2 ${morale ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}`}>
                            <RadioGroupItem value="oui" />
                            Oui
                          </label>
                          <label className={`flex items-center gap-2 ${morale ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}`}>
                            <RadioGroupItem value="non" />
                            Non
                          </label>
                        </RadioGroup>
                      </div>
                      {morale ? (
                        <Alert className="md:col-span-2 lg:col-span-4 border-sky-200 bg-sky-50/70 text-sky-950">
                          <Info />
                          <AlertDescription className="text-sky-900">
                            Une personne morale ne peut pas être conducteur. Renseignez le conducteur habituel ci-dessous.
                          </AlertDescription>
                        </Alert>
                      ) : null}
                    </div>
                  ) : null}
                  {showProprietairePermisFields ? (
                    <div className="mt-3 grid max-w-5xl gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Date de naissance">
                        <DatePicker date={item.client.dateNaissance} onSelect={(date) => updateClient(index, { dateNaissance: toDateOnly(date) })} />
                      </Field>
                      <Field label="Date de délivrance du permis">
                        <DatePicker date={item.client.dateDelivrancePermis} onSelect={(date) => updateClient(index, { dateDelivrancePermis: toDateOnly(date) })} />
                      </Field>
                      <Field label="N° de permis">
                        <Input value={item.client.numeroPermis ?? ""} onChange={(event) => updateClient(index, { numeroPermis: event.target.value })} />
                      </Field>
                      <Field label="Date de validité du PC" required error={errors[`clients.${index}.client.dateValiditePermis`]}>
                        <DatePicker date={item.client.dateValiditePermis} onSelect={(date) => updateClient(index, { dateValiditePermis: toDateOnly(date) })} />
                      </Field>
                    </div>
                  ) : null}
                  {!proprietorIsDriver && conducteur ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Intitulé" required error={errors[`clients.${conducteur.clientIndex}.client.civilite`]}>
                        <Select value={conducteur.client.client.civilite ?? ""} onValueChange={(value) => updateClient(conducteur.clientIndex, { civilite: value })}>
                          <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monsieur">Monsieur</SelectItem>
                            <SelectItem value="madame">Madame</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Nom" required error={errors[`clients.${conducteur.clientIndex}.client.nom`]}>
                        <Input value={conducteur.client.client.nom ?? ""} onChange={(event) => updateClient(conducteur.clientIndex, { nom: event.target.value })} />
                      </Field>
                      <Field label="Prénom" required error={errors[`clients.${conducteur.clientIndex}.client.prenom`]}>
                        <Input value={conducteur.client.client.prenom ?? ""} onChange={(event) => updateClient(conducteur.clientIndex, { prenom: event.target.value })} />
                      </Field>
                      <Field label="CIN" required error={errors[`clients.${conducteur.clientIndex}.client.cin`]}>
                        <Input
                          value={conducteur.client.client.cin ?? ""}
                          onBlur={() => searchClient(conducteur.clientIndex, { cin: conducteur.client.client.cin })}
                          onChange={(event) => {
                            updateIdentity(conducteur.clientIndex, { cin: event.target.value });
                            scheduleClientSearch(conducteur.clientIndex, { cin: event.target.value });
                          }}
                        />
                        <LookupMessage state={lookupByIndex[conducteur.clientIndex]} />
                      </Field>
                      <Field label="Date de naissance">
                        <DatePicker date={conducteur.client.client.dateNaissance} onSelect={(date) => updateClient(conducteur.clientIndex, { dateNaissance: toDateOnly(date) })} />
                      </Field>
                      <Field label="Date de délivrance du permis">
                        <DatePicker date={conducteur.client.client.dateDelivrancePermis} onSelect={(date) => updateClient(conducteur.clientIndex, { dateDelivrancePermis: toDateOnly(date) })} />
                      </Field>
                      <Field label="N° de permis">
                        <Input value={conducteur.client.client.numeroPermis ?? ""} onChange={(event) => updateClient(conducteur.clientIndex, { numeroPermis: event.target.value })} />
                      </Field>
                      <Field label="Date de validité du PC" required error={errors[`clients.${conducteur.clientIndex}.client.dateValiditePermis`]}>
                        <DatePicker date={conducteur.client.client.dateValiditePermis} onSelect={(date) => updateClient(conducteur.clientIndex, { dateValiditePermis: toDateOnly(date) })} />
                      </Field>
                    </div>
                  ) : null}
                </>
              ) : null}
              {item.role === "CONDUCTEUR" && !morale ? (
                <div className="mt-3 grid max-w-5xl gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Date de naissance">
                    <DatePicker date={item.client.dateNaissance} onSelect={(date) => updateClient(index, { dateNaissance: toDateOnly(date) })} />
                  </Field>
                </div>
              ) : null}
              {item.role === "SOUSCRIPTEUR" ? (
                <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Organisation">
                    <Select
                      value={item.groupeClientId ?? "INDEPENDANT"}
                      onValueChange={(value) => {
                        if (value === "INDEPENDANT") {
                          updateClientLink(index, {
                            groupeClientId: undefined,
                            relationGroupe: undefined,
                            retirerGroupesActifs: Boolean(item.clientId && item.groupeClientId),
                          });
                          onSouscripteurGroupChange?.();
                          return;
                        }
                        const selectedGroup = groupesClients.find((groupe) => groupe.id === value);
                        updateClientLink(index, {
                          groupeClientId: value,
                          relationGroupe: item.relationGroupe ?? "FILIALE",
                          retirerGroupesActifs: false,
                        });
                        onSouscripteurGroupChange?.(selectedGroup);
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INDEPENDANT">Client indépendant</SelectItem>
                        {groupesClients.filter((groupe) => groupe.actif).map((groupe) => (
                          <SelectItem key={groupe.id} value={groupe.id}>
                            {groupe.code} - {groupe.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {item.groupeClientId ? (
                    <>
                      <Field label="Lien avec le groupe">
                        <Select
                          value={item.relationGroupe ?? "FILIALE"}
                          onValueChange={(value) => updateClientLink(index, {
                            relationGroupe: value as RelationGroupeClient,
                          })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TETE_GROUPE">Tête de groupe</SelectItem>
                            <SelectItem value="FILIALE">Filiale</SelectItem>
                            <SelectItem value="SOCIETE_LIEE">Société liée</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <div className="flex items-end pb-2 text-sm text-muted-foreground md:col-span-2">
                        {formatGroupContext(groupesClients.find((groupe) => groupe.id === item.groupeClientId))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <SectionCard
        title="Souscripteur"
        badge={savedSections.souscripteur ? "Validé" : "Obligatoire"}
        tone="production"
        open={openSection === "souscripteur"}
        onOpenChange={(open) => onSectionOpenChange?.("souscripteur", open)}
      >
        {renderClients(["SOUSCRIPTEUR"])}
        {onSaveSection ? (
          <div className="mt-4 flex justify-end border-t pt-3">
            <SaveSectionButton saving={saving} onClick={() => onSaveSection("souscripteur")} />
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Propriétaire"
        badge={savedSections.proprietaire ? "Validé" : "Obligatoire"}
        tone="production"
        defaultOpen={false}
        open={openSection === "proprietaire"}
        onOpenChange={(open) => onSectionOpenChange?.("proprietaire", open)}
      >
        {renderClients(["PROPRIETAIRE"])}
        {onSaveSection ? (
          <div className="mt-4 flex justify-end border-t pt-3">
            <SaveSectionButton saving={saving} onClick={() => onSaveSection("proprietaire")} />
          </div>
        ) : null}
      </SectionCard>

      {showOptionalRoles ? (
        <SectionCard
          title="Conducteurs et bénéficiaires"
          badge="Optionnel"
          tone="production"
          defaultOpen={false}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setClients([...clients, emptyClient("CONDUCTEUR")])}>
              <Plus className="size-4" />
              Conducteur
            </Button>
          }
        >
          {renderClients(["CONDUCTEUR", "BENEFICIAIRE"])}
        </SectionCard>
      ) : null}
    </>
  );
}

function formatGroupContext(groupe?: GroupeClient) {
  if (!groupe) {
    return "";
  }
  const treasury = groupe.clientTresorerieNom
    ? `Trésorerie : ${groupe.clientTresorerieNom}`
    : "Trésorerie non définie";
  const billing = groupe.facturationConsolideeDefaut ? "Facturation consolidée par défaut" : "Facturation directe par défaut";
  return `${treasury} · ${billing}`;
}

function SaveSectionButton({ saving, onClick }: { saving?: boolean; onClick: () => void }) {
  return (
    <Button type="button" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={saving} onClick={onClick}>
      {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
      {saving ? "Enregistrement..." : "Enregistrer"}
    </Button>
  );
}

function LookupMessage({ state }: { state?: LookupState }) {
  if (!state || state.status === "idle") {
    return null;
  }
  const tone = state.status === "found"
    ? "text-emerald-700 dark:text-emerald-400"
    : state.status === "new"
      ? "text-slate-500"
      : state.status === "error"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <span className={`flex items-center gap-1 text-xs ${tone}`}>
      {state.status === "loading" ? <Loader2 className="size-3 animate-spin" /> : null}
      {state.message}
    </span>
  );
}

function TelephoneList({
  client,
  updateClient,
  error,
}: {
  client: ClientInput;
  updateClient: (patch: Partial<ClientInput["client"]>) => void;
  error?: string;
}) {
  const telephones = client.client.telephones && client.client.telephones.length > 0
    ? client.client.telephones
    : [{ numero: "", principal: true, whatsapp: false }];

  const updateTelephone = (index: number, patch: Partial<NonNullable<ClientInput["client"]["telephones"]>[number]>) => {
    updateClient({
      telephones: telephones.map((telephone, idx) => {
        if (idx !== index) {
          return patch.principal ? { ...telephone, principal: false } : telephone;
        }
        return { ...telephone, ...patch };
      }),
    });
  };

  const addTelephone = () => {
    updateClient({ telephones: [...telephones, { numero: "", principal: false, whatsapp: false }] });
  };

  const removeTelephone = (index: number) => {
    const next = telephones.filter((_, idx) => idx !== index);
    updateClient({
      telephones: next.length > 0
        ? next.map((telephone, idx) => ({ ...telephone, principal: idx === 0 ? true : telephone.principal }))
        : [{ numero: "", principal: true, whatsapp: false }],
    });
  };

  return (
    <div className="grid gap-2 md:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          Téléphones<span className="ml-1 text-red-500">*</span>
        </span>
        <Button type="button" variant="outline" size="sm" onClick={addTelephone}>
          <Plus className="size-4" />
          Téléphone
        </Button>
      </div>
      <div className="grid gap-2">
        {telephones.map((telephone, index) => (
          <div key={index} className="grid gap-2 rounded-md border bg-muted/20 p-2 md:grid-cols-[1fr_auto_auto_auto]">
            <Input
              value={telephone.numero}
              aria-invalid={Boolean(error)}
              onChange={(event) => updateTelephone(index, { numero: event.target.value })}
              placeholder="Numéro"
            />
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={Boolean(telephone.principal)} onCheckedChange={(checked) => updateTelephone(index, { principal: Boolean(checked) })} />
              Principal
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={Boolean(telephone.whatsapp)} onCheckedChange={(checked) => updateTelephone(index, { whatsapp: Boolean(checked) })} />
              WhatsApp
            </label>
            <Button type="button" variant="ghost" size="icon" disabled={telephones.length === 1} onClick={() => removeTelephone(index)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
