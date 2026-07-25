import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { SectionCard } from "./SectionCard";
import { Field } from "./Field";
import type { ClientInput, ReferenceOption } from "../types";

const roles = ["SOUSCRIPTEUR", "PROPRIETAIRE", "CONDUCTEUR", "BENEFICIAIRE"] as const;

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
  categoriesClient,
}: {
  clients: ClientInput[];
  setClients: (clients: ClientInput[]) => void;
  villes: ReferenceOption[];
  categoriesClient: ReferenceOption[];
}) {
  const update = (index: number, patch: Partial<ClientInput>) => {
    setClients(clients.map((client, idx) => (idx === index ? { ...client, ...patch } : client)));
  };
  const updateClient = (index: number, patch: Partial<ClientInput["client"]>) => {
    setClients(
      clients.map((client, idx) =>
        idx === index ? { ...client, client: { ...client.client, ...patch } } : client
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
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Rôle">
                  <Select value={item.role} onValueChange={(value) => update(index, { role: value as ClientInput["role"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Type">
                  <Select value={item.client.typeClient} onValueChange={(value) => updateClient(index, { typeClient: value as ClientInput["client"]["typeClient"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSONNE_PHYSIQUE">Physique</SelectItem>
                      <SelectItem value="PERSONNE_MORALE">Morale</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Ville">
                  <Select value={item.client.villeId ?? ""} onValueChange={(value) => updateClient(index, { villeId: value })}>
                    <SelectTrigger><SelectValue placeholder="Ville" /></SelectTrigger>
                    <SelectContent>
                      {villes.map((ville) => <SelectItem key={ville.id} value={ville.id}>{ville.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Catégorie client">
                  <Select value={item.client.categorieClientId ?? ""} onValueChange={(value) => updateClient(index, { categorieClientId: value })}>
                    <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                    <SelectContent>
                      {categoriesClient.map((categorie) => <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {morale ? (
                  <>
                    <Field label="Raison sociale">
                      <Input value={item.client.raisonSociale ?? ""} onChange={(event) => updateClient(index, { raisonSociale: event.target.value })} />
                    </Field>
                    <Field label="RC">
                      <Input value={item.client.rc ?? ""} onChange={(event) => updateClient(index, { rc: event.target.value })} />
                    </Field>
                    <Field label="ICE">
                      <Input value={item.client.ice ?? ""} onChange={(event) => updateClient(index, { ice: event.target.value })} />
                    </Field>
                    <Field label="Activité">
                      <Input value={item.client.activite ?? ""} onChange={(event) => updateClient(index, { activite: event.target.value })} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Prénom">
                      <Input value={item.client.prenom ?? ""} onChange={(event) => updateClient(index, { prenom: event.target.value })} />
                    </Field>
                    <Field label="Nom">
                      <Input value={item.client.nom ?? ""} onChange={(event) => updateClient(index, { nom: event.target.value })} />
                    </Field>
                    <Field label="CIN">
                      <Input value={item.client.cin ?? ""} onChange={(event) => updateClient(index, { cin: event.target.value })} />
                    </Field>
                    <Field label="Validité CIN">
                      <DatePicker date={item.client.cinValidite} onSelect={(date) => updateClient(index, { cinValidite: toIso(date) })} />
                    </Field>
                  </>
                )}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Téléphone">
                  <Input value={item.client.telephone ?? ""} onChange={(event) => updateClient(index, { telephone: event.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={item.client.email ?? ""} onChange={(event) => updateClient(index, { email: event.target.value })} />
                </Field>
                <Field label="Adresse">
                  <Input value={item.client.adresse ?? ""} onChange={(event) => updateClient(index, { adresse: event.target.value })} />
                </Field>
                <div className="flex items-end gap-2 pb-2">
                  <Checkbox checked={Boolean(item.client.sahara)} onCheckedChange={(checked) => updateClient(index, { sahara: Boolean(checked) })} />
                  <span className="text-sm">Réduction saharienne</span>
                </div>
              </div>
              {!morale ? (
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <Field label="N° permis">
                    <Input value={item.client.numeroPermis ?? ""} onChange={(event) => updateClient(index, { numeroPermis: event.target.value })} />
                  </Field>
                  <Field label="Délivrance permis">
                    <DatePicker date={item.client.dateDelivrancePermis} onSelect={(date) => updateClient(index, { dateDelivrancePermis: toIso(date) })} />
                  </Field>
                  <Field label="Validité permis">
                    <DatePicker date={item.client.dateValiditePermis} onSelect={(date) => updateClient(index, { dateValiditePermis: toIso(date) })} />
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
    </>
  );
}

function toIso(date?: Date) {
  return date ? date.toISOString().slice(0, 10) : undefined;
}
