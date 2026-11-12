import type { ClientInput, ClientResponse } from "@/features/production/types";
import { formatDocumentDate } from "@/features/production/utils/format";

export function clientProfileSections(client: ClientResponse) {
  const identity = client.typeClient === "PERSONNE_MORALE" ? [
    ["Raison sociale", client.raisonSociale], ["RC", client.rc], ["ICE", client.ice],
    ["Identifiant fiscal (IF)", client.iff], ["CNSS", client.cnss], ["Patente", client.patente],
  ] : [
    ["Nom", client.nom], ["Prénom", client.prenom],
    ["Genre", client.genre === "HOMME" ? "Homme" : client.genre === "FEMME" ? "Femme" : undefined],
    ["Date de naissance", client.dateNaissance && formatDocumentDate(client.dateNaissance)],
    ["Nationalité", client.nationalite], ["CIN", client.cin],
    ["Validité CIN", client.cinValidite && formatDocumentDate(client.cinValidite)],
    ["Passeport", client.passport], ["Validité passeport", client.passportValidite && formatDocumentDate(client.passportValidite)],
    ["Carte de résidence", client.carteResidence],
    ["Validité carte de séjour", client.carteResidenceValidite && formatDocumentDate(client.carteResidenceValidite)],
  ];
  const sections = [{ key: "identity", title: client.typeClient === "PERSONNE_MORALE" ? "Identification de l’entreprise" : "Identité", fields: identity }];
  if (client.typeClient === "PERSONNE_PHYSIQUE" && (client.numeroPermis || client.dateDelivrancePermis || client.dateValiditePermis)) {
    sections.push({ key: "licence", title: "Permis de conduire", fields: [
      ["Numéro de permis", client.numeroPermis],
      ["Date de délivrance", client.dateDelivrancePermis && formatDocumentDate(client.dateDelivrancePermis)],
      ["Date de validité", client.dateValiditePermis && formatDocumentDate(client.dateValiditePermis)],
      ["Conducteur habituel", client.conducteurHabituel == null ? undefined : client.conducteurHabituel ? "Oui" : "Non"],
    ] });
  }
  return sections.map(section => ({ ...section, fields: section.fields
    .filter((field): field is [string, string] => typeof field[1] === "string" && field[1].trim().length > 0)
    .map(([label, value]) => ({ label, value })) }))
    .filter(section => section.fields.length > 0);
}

export function clientRecordDraft(client: ClientResponse): ClientInput["client"] {
  return {
    typeClient: client.typeClient, clientParentId: client.clientParentId ?? undefined,
    genre: client.genre, prenom: client.prenom, nom: client.nom, raisonSociale: client.raisonSociale,
    cin: client.cin, cinValidite: client.cinValidite, passport: client.passport,
    typePieceIdentite: client.typePieceIdentite, paysResidence: client.paysResidence, villeEtrangere: client.villeEtrangere,
    passportValidite: client.passportValidite, carteResidence: client.carteResidence, nationalite: client.nationalite,
    carteResidenceValidite: client.carteResidenceValidite,
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
