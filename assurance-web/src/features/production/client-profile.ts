import type { ClientInput } from "./types";

export type ClientProfile = ClientInput["client"];

export const IDENTITY_DOCUMENTS = [
  { value: "CIN", label: "CIN", numberKey: "cin", expiryKey: "cinValidite", expiryLabel: "Validité CIN" },
  { value: "PASSEPORT", label: "Passeport", numberKey: "passport", expiryKey: "passportValidite", expiryLabel: "Validité passeport" },
  { value: "CARTE_RESIDENCE", label: "Carte de séjour", numberKey: "carteResidence", expiryKey: "carteResidenceValidite", expiryLabel: "Validité carte de séjour" },
] as const;

export function identityDocument(client: ClientProfile) {
  const type = client.typePieceIdentite
    ?? (client.cin ? "CIN" : client.passport ? "PASSEPORT" : client.carteResidence ? "CARTE_RESIDENCE" : "CIN");
  return IDENTITY_DOCUMENTS.find((document) => document.value === type)!;
}

export function foreignResidence(client: ClientProfile) {
  return client.paysResidence != null && client.paysResidence !== "MA";
}

export function internationalClient(client: ClientProfile) {
  return foreignResidence(client)
    || (client.typeClient === "PERSONNE_PHYSIQUE" && identityDocument(client).value !== "CIN");
}

export function residenceComplete(client: ClientProfile) {
  return Boolean((foreignResidence(client) ? client.paysResidence && client.villeEtrangere?.trim() : client.villeId) && client.adresse?.trim());
}

export function identityComplete(client: ClientProfile) {
  const document = identityDocument(client);
  return Boolean(client[document.numberKey]?.trim() && client[document.expiryKey]);
}

export function primaryIdentityLabel(client: ClientProfile) {
  if (client.typeClient === "PERSONNE_MORALE") return client.rc ? `RC ${client.rc}` : undefined;
  const document = identityDocument(client);
  return client[document.numberKey] ? `${document.label} ${client[document.numberKey]}` : undefined;
}

export function clientIdentityErrors(client: ClientProfile, today: string): Record<string, string> {
  if (client.typeClient === "PERSONNE_MORALE") return {};
  const document = identityDocument(client);
  const errors: Record<string, string> = {};
  if (!client[document.numberKey]?.trim()) errors[document.numberKey] = `N° ${document.label} obligatoire.`;
  const expiry = client[document.expiryKey];
  if (!expiry) errors[document.expiryKey] = `${document.expiryLabel} obligatoire.`;
  else if (expiry < today) errors[document.expiryKey] = "La pièce d'identité sélectionnée est expirée.";
  return errors;
}
