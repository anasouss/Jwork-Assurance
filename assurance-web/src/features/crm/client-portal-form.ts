import type { ClientResponse } from "@/features/production/types";

export function defaultPortalIdentifier(client: Pick<ClientResponse, "typeClient" | "cin" | "rc" | "passport" | "carteResidence">) {
  const values = [client.typeClient === "PERSONNE_MORALE" ? client.rc : client.cin, client.passport, client.carteResidence];
  return (values.find(value => value?.trim()) ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

export function portalPasswordError(password: string, confirmation: string) {
  if (password.trim().length === 0 || password.length < 12) return "Le mot de passe doit contenir au moins 12 caractères.";
  if (new TextEncoder().encode(password).length > 72) return "Le mot de passe dépasse la limite de 72 octets.";
  if (password !== confirmation) return "Les mots de passe ne correspondent pas.";
  return null;
}
