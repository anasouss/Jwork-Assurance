import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { SectionCard } from "./SectionCard";
import { Field } from "./Field";
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

  const updateClient = (index: number, patch: Partial<ClientInput["client"]>) => {
    setClients(
      clients.map((client, idx) =>
        idx === index || (sameAsSouscripteur && clients[index]?.role === "SOUSCRIPTEUR" && client.role === "PROPRIETAIRE")
          ? { ...client, client: { ...client.client, ...patch } }
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
                profession: client.client.profession,
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
          return (
            <div key={index} className="rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{item.role === "SOUSCRIPTEUR" ? "Souscripteur" : item.role === "PROPRIETAIRE" ? "Propriétaire" : item.role}</div>
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
                <Field label="Type">
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
                    <Field label="Raison sociale">
                      <Input disabled={disabledByCopy} value={item.client.raisonSociale ?? ""} onChange={(event) => updateClient(index, { raisonSociale: event.target.value })} />
                    </Field>
                    <Field label="RC">
                      <Input disabled={disabledByCopy} value={item.client.rc ?? ""} onChange={(event) => updateClient(index, { rc: event.target.value })} />
                    </Field>
                    <Field label="ICE">
                      <Input disabled={disabledByCopy} value={item.client.ice ?? ""} onChange={(event) => updateClient(index, { ice: event.target.value })} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="CIN">
                      <Input disabled={disabledByCopy} value={item.client.cin ?? ""} onChange={(event) => updateClient(index, { cin: event.target.value })} />
                    </Field>
                    <Field label="Validité CIN">
                      <DatePicker date={item.client.cinValidite} disabled={disabledByCopy} onSelect={(date) => updateClient(index, { cinValidite: toIso(date) })} />
                    </Field>
                    <Field label="Intitulé">
                      <Select value={item.client.civilite ?? ""} disabled={disabledByCopy} onValueChange={(value) => updateClient(index, { civilite: value })}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monsieur">Monsieur</SelectItem>
                          <SelectItem value="madame">Madame</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <Field label="Nom">
                      <Input disabled={disabledByCopy} value={item.client.nom ?? ""} onChange={(event) => updateClient(index, { nom: event.target.value })} />
                    </Field>
                    <Field label="Prénom">
                      <Input disabled={disabledByCopy} value={item.client.prenom ?? ""} onChange={(event) => updateClient(index, { prenom: event.target.value })} />
                    </Field>
                    {isProprietaire ? (
                      <Field label="Profession">
                        <Input value={item.client.profession ?? ""} onChange={(event) => updateClient(index, { profession: event.target.value })} />
                      </Field>
                    ) : null}
                  </>
                )}
                <Field label="Ville">
                  <Select value={item.client.villeId ?? ""} disabled={disabledByCopy} onValueChange={(value) => updateClient(index, { villeId: value, sahara: false, justificatifSahara: undefined })}>
                    <SelectTrigger><SelectValue placeholder="Ville" /></SelectTrigger>
                    <SelectContent>
                      {villes.map((ville) => <SelectItem key={ville.id} value={ville.id}>{ville.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Adresse" className="md:col-span-2">
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
                    <Field label="Téléphone">
                      <Input value={item.client.telephone ?? ""} onChange={(event) => updateClient(index, { telephone: event.target.value })} />
                    </Field>
                  </div>
                  {!morale ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                      <div className="flex items-end gap-3 pb-2 text-sm">
                        <span>Le propriétaire est-il lui-même le conducteur ?</span>
                        <label className="flex items-center gap-1">
                          <Checkbox checked={item.client.conducteurHabituel !== false} onCheckedChange={(checked) => updateClient(index, { conducteurHabituel: Boolean(checked) })} />
                          Oui
                        </label>
                      </div>
                      <Field label="Date de naissance">
                        <DatePicker date={item.client.dateNaissance} onSelect={(date) => updateClient(index, { dateNaissance: toIso(date) })} />
                      </Field>
                      <Field label="Délivrance permis">
                        <DatePicker date={item.client.dateDelivrancePermis} onSelect={(date) => updateClient(index, { dateDelivrancePermis: toIso(date) })} />
                      </Field>
                      <Field label="N° permis">
                        <Input value={item.client.numeroPermis ?? ""} onChange={(event) => updateClient(index, { numeroPermis: event.target.value })} />
                      </Field>
                      <Field label="Validité permis">
                        <DatePicker date={item.client.dateValiditePermis} onSelect={(date) => updateClient(index, { dateValiditePermis: toIso(date) })} />
                      </Field>
                    </div>
                  ) : null}
                </>
              ) : null}
              {!isProprietaire && !morale ? (
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <Field label="Date de naissance">
                    <DatePicker date={item.client.dateNaissance} onSelect={(date) => updateClient(index, { dateNaissance: toIso(date) })} />
                  </Field>
                  <Field label="Profession">
                    <Input value={item.client.profession ?? ""} onChange={(event) => updateClient(index, { profession: event.target.value })} />
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

function toIso(date?: Date) {
  return date ? date.toISOString().slice(0, 10) : undefined;
}
