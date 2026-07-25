import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { SectionCard } from "./SectionCard";
import { Field } from "./Field";
import { toDateOnly } from "../date";
import type { ClientInput, ReferenceOption } from "../types";

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
  showOptionalRoles = false,
}: {
  clients: ClientInput[];
  setClients: (clients: ClientInput[]) => void;
  villes: ReferenceOption[];
  showOptionalRoles?: boolean;
}) {
  const [sameAsSouscripteur, setSameAsSouscripteur] = useState(false);

  useEffect(() => {
    const proprietaire = clients.find((client) => client.role === "PROPRIETAIRE");
    const needsConducteur = Boolean(
      proprietaire && (proprietaire.client.typeClient === "PERSONNE_MORALE" || proprietaire.client.conducteurHabituel === false)
    );
    const hasConducteur = clients.some((client) => client.role === "CONDUCTEUR");
    if (needsConducteur && !hasConducteur) {
      setClients([...clients, emptyClient("CONDUCTEUR")]);
      return;
    }
    if (!needsConducteur && hasConducteur && !showOptionalRoles) {
      setClients(clients.filter((client) => client.role !== "CONDUCTEUR"));
    }
  }, [clients, setClients, showOptionalRoles]);

  const updateClient = (index: number, patch: Partial<ClientInput["client"]>) => {
    setClients(
      clients.map((client, idx) =>
        idx === index || (sameAsSouscripteur && clients[index]?.role === "SOUSCRIPTEUR" && client.role === "PROPRIETAIRE")
          ? { ...client, client: { ...client.client, ...patch } }
          : client
      )
    );
  };

  const setProprietaireConducteur = (index: number, value: boolean) => {
    setClients(
      clients
        .filter((client) => value || client.role !== "CONDUCTEUR" || showOptionalRoles)
        .map((client, idx) =>
          idx === index
            ? { ...client, client: { ...client.client, conducteurHabituel: value } }
            : client
        )
    );
  };

  const copySouscripteurToProprietaire = (checked: boolean) => {
    setSameAsSouscripteur(checked);
    if (!checked) {
      return;
    }
    const souscripteur = clients.find((client) => client.role === "SOUSCRIPTEUR");
    if (!souscripteur) {
      return;
    }
    setClients(
      clients.map((client) =>
        client.role === "PROPRIETAIRE"
          ? {
              ...client,
              client: {
                ...client.client,
                ...souscripteur.client,
                telephone: client.client.telephone,
                telephones: client.client.telephones,
                email: client.client.email,
                conducteurHabituel: client.client.conducteurHabituel,
                sahara: client.client.sahara,
                justificatifSahara: client.client.justificatifSahara,
              },
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
          const proprietorIsDriver = isProprietaire && !morale && item.client.conducteurHabituel !== false;
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
              <div className="grid gap-3 md:grid-cols-4">
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
                    <Field label="Raison sociale" required>
                      <Input disabled={disabledByCopy} value={item.client.raisonSociale ?? ""} onChange={(event) => updateClient(index, { raisonSociale: event.target.value })} />
                    </Field>
                    <Field label="RC" required>
                      <Input disabled={disabledByCopy} value={item.client.rc ?? ""} onChange={(event) => updateClient(index, { rc: event.target.value })} />
                    </Field>
                    <Field label="ICE">
                      <Input disabled={disabledByCopy} value={item.client.ice ?? ""} onChange={(event) => updateClient(index, { ice: event.target.value })} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Intitulé" required>
                      <Select value={item.client.civilite ?? ""} disabled={disabledByCopy} onValueChange={(value) => updateClient(index, { civilite: value })}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monsieur">Monsieur</SelectItem>
                          <SelectItem value="madame">Madame</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="CIN" required>
                      <Input disabled={disabledByCopy} value={item.client.cin ?? ""} onChange={(event) => updateClient(index, { cin: event.target.value })} />
                    </Field>
                    <Field label="Validité CIN" required>
                      <DatePicker date={item.client.cinValidite} disabled={disabledByCopy} onSelect={(date) => updateClient(index, { cinValidite: toDateOnly(date) })} />
                    </Field>
                  </>
                )}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {morale ? (
                  <Field label="Activité">
                    <Input disabled={disabledByCopy} value={item.client.activite ?? ""} onChange={(event) => updateClient(index, { activite: event.target.value })} />
                  </Field>
                ) : (
                  <>
                    <Field label="Nom" required>
                      <Input disabled={disabledByCopy} value={item.client.nom ?? ""} onChange={(event) => updateClient(index, { nom: event.target.value })} />
                    </Field>
                    <Field label="Prénom" required>
                      <Input disabled={disabledByCopy} value={item.client.prenom ?? ""} onChange={(event) => updateClient(index, { prenom: event.target.value })} />
                    </Field>
                  </>
                )}
                <Field label="Ville" required>
                  <Select value={item.client.villeId ?? ""} disabled={disabledByCopy} onValueChange={(value) => updateClient(index, { villeId: value, sahara: false, justificatifSahara: undefined })}>
                    <SelectTrigger><SelectValue placeholder="Ville" /></SelectTrigger>
                    <SelectContent>
                      {villes.map((ville) => <SelectItem key={ville.id} value={ville.id}>{ville.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Adresse" required className="md:col-span-2">
                  <Input disabled={disabledByCopy} value={item.client.adresse ?? ""} onChange={(event) => updateClient(index, { adresse: event.target.value })} />
                </Field>
              </div>
              {isProprietaire ? (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
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
                    <TelephoneList client={item} updateClient={(patch) => updateClient(index, patch)} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div className="flex items-end gap-3 pb-2 text-sm md:col-span-2">
                      <span>Le propriétaire est-il lui-même le conducteur ?</span>
                      <label className="flex items-center gap-1">
                        <Checkbox
                          checked={proprietorIsDriver}
                          disabled={morale}
                          onCheckedChange={(checked) => setProprietaireConducteur(index, Boolean(checked))}
                        />
                        Oui
                      </label>
                      <label className="flex items-center gap-1">
                        <Checkbox
                          checked={!proprietorIsDriver}
                          onCheckedChange={(checked) => setProprietaireConducteur(index, !Boolean(checked))}
                        />
                        Non
                      </label>
                    </div>
                  </div>
                  {!proprietorIsDriver && conducteur ? (
                    <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                      <div className="mb-3 text-sm font-medium">Conducteur habituel</div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <Field label="Intitulé" required>
                          <Select value={conducteur.client.client.civilite ?? ""} onValueChange={(value) => updateClient(conducteur.clientIndex, { civilite: value })}>
                            <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monsieur">Monsieur</SelectItem>
                              <SelectItem value="madame">Madame</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="CIN" required>
                          <Input value={conducteur.client.client.cin ?? ""} onChange={(event) => updateClient(conducteur.clientIndex, { cin: event.target.value })} />
                        </Field>
                        <Field label="Validité CIN">
                          <DatePicker date={conducteur.client.client.cinValidite} onSelect={(date) => updateClient(conducteur.clientIndex, { cinValidite: toDateOnly(date) })} />
                        </Field>
                        <Field label="Ville">
                          <Select value={conducteur.client.client.villeId ?? ""} onValueChange={(value) => updateClient(conducteur.clientIndex, { villeId: value })}>
                            <SelectTrigger><SelectValue placeholder="Ville" /></SelectTrigger>
                            <SelectContent>
                              {villes.map((ville) => <SelectItem key={ville.id} value={ville.id}>{ville.libelle}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Nom" required>
                          <Input value={conducteur.client.client.nom ?? ""} onChange={(event) => updateClient(conducteur.clientIndex, { nom: event.target.value })} />
                        </Field>
                        <Field label="Prénom" required>
                          <Input value={conducteur.client.client.prenom ?? ""} onChange={(event) => updateClient(conducteur.clientIndex, { prenom: event.target.value })} />
                        </Field>
                        <Field label="Adresse" className="md:col-span-2">
                          <Input value={conducteur.client.client.adresse ?? ""} onChange={(event) => updateClient(conducteur.clientIndex, { adresse: event.target.value })} />
                        </Field>
                        <Field label="Date de naissance">
                          <DatePicker date={conducteur.client.client.dateNaissance} onSelect={(date) => updateClient(conducteur.clientIndex, { dateNaissance: toDateOnly(date) })} />
                        </Field>
                        <Field label="Délivrance permis">
                          <DatePicker date={conducteur.client.client.dateDelivrancePermis} onSelect={(date) => updateClient(conducteur.clientIndex, { dateDelivrancePermis: toDateOnly(date) })} />
                        </Field>
                        <Field label="N° permis">
                          <Input value={conducteur.client.client.numeroPermis ?? ""} onChange={(event) => updateClient(conducteur.clientIndex, { numeroPermis: event.target.value })} />
                        </Field>
                        <Field label="Validité permis" required>
                          <DatePicker date={conducteur.client.client.dateValiditePermis} onSelect={(date) => updateClient(conducteur.clientIndex, { dateValiditePermis: toDateOnly(date) })} />
                        </Field>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
              {!isProprietaire && !morale ? (
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <Field label="Date de naissance">
                    <DatePicker date={item.client.dateNaissance} onSelect={(date) => updateClient(index, { dateNaissance: toDateOnly(date) })} />
                  </Field>
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
      <SectionCard title="Souscripteur" badge="Obligatoire" tone="production">
        {renderClients(["SOUSCRIPTEUR"])}
      </SectionCard>

      <SectionCard title="Propriétaire" badge="Obligatoire" tone="production" defaultOpen={false}>
        {renderClients(["PROPRIETAIRE"])}
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

function TelephoneList({
  client,
  updateClient,
}: {
  client: ClientInput;
  updateClient: (patch: Partial<ClientInput["client"]>) => void;
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
        <span className="text-sm font-medium">Téléphones</span>
        <Button type="button" variant="outline" size="sm" onClick={addTelephone}>
          <Plus className="size-4" />
          Téléphone
        </Button>
      </div>
      <div className="grid gap-2">
        {telephones.map((telephone, index) => (
          <div key={index} className="grid gap-2 rounded-md border bg-muted/20 p-2 md:grid-cols-[1fr_auto_auto_auto]">
            <Input value={telephone.numero} onChange={(event) => updateTelephone(index, { numero: event.target.value })} placeholder="Numéro" />
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
    </div>
  );
}
