import type { ClientInput, ClientResponse } from "@/features/production/types";

export function clientRecordDraft(client: ClientResponse): ClientInput["client"] {
  return {
    typeClient: client.typeClient, clientParentId: client.clientParentId ?? undefined,
    genre: client.genre, prenom: client.prenom, nom: client.nom, raisonSociale: client.raisonSociale,
    cin: client.cin, cinValidite: client.cinValidite, passport: client.passport,
    passportValidite: client.passportValidite, carteResidence: client.carteResidence, nationalite: client.nationalite,
    rc: client.rc, ice: client.ice, iff: client.iff, patente: client.patente, cnss: client.cnss,
    numeroPermis: client.numeroPermis, dateDelivrancePermis: client.dateDelivrancePermis,
    dateValiditePermis: client.dateValiditePermis, dateNaissance: client.dateNaissance,
    adresse: client.adresse, villeId: client.villeId, categorieClientId: client.categorieClientId,
    telephone: client.telephone, email: client.email, conducteurHabituel: client.conducteurHabituel,
    telephones: client.telephones?.length
      ? client.telephones.map(({ numero, principal, whatsapp }) => ({ numero, principal, whatsapp }))
      : client.telephone ? [{ numero: client.telephone, principal: true, whatsapp: false }] : [],
  };
}
