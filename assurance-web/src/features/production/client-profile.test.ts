import { describe, expect, it } from "vitest";
import { clientIdentityErrors, foreignResidence, identityDocument, internationalClient, residenceComplete, type ClientProfile } from "./client-profile";

describe("client identity and residence", () => {
  const client: ClientProfile = { typeClient: "PERSONNE_PHYSIQUE", cin: "AB123", cinValidite: "2031-01-01" };

  it("keeps existing CIN records compatible", () => {
    expect(identityDocument(client).value).toBe("CIN");
    expect(clientIdentityErrors(client, "2026-11-12")).toEqual({});
  });

  it("validates the selected passport instead of an old CIN", () => {
    const passport: ClientProfile = { ...client, typePieceIdentite: "PASSEPORT", passport: "PA123", passportValidite: "2030-01-01", cinValidite: "2020-01-01" };
    expect(clientIdentityErrors(passport, "2026-11-12")).toEqual({});
    expect(clientIdentityErrors({ ...passport, passport: "" }, "2026-11-12")).toHaveProperty("passport");
    expect(clientIdentityErrors({ ...passport, passportValidite: "2020-01-01" }, "2026-11-12")).toHaveProperty("passportValidite");
  });

  it("supports residence cards with their own validity", () => {
    const card: ClientProfile = { typeClient: "PERSONNE_PHYSIQUE", typePieceIdentite: "CARTE_RESIDENCE", carteResidence: "CS123" };
    expect(clientIdentityErrors(card, "2026-11-12")).toHaveProperty("carteResidenceValidite");
    expect(clientIdentityErrors({ ...card, carteResidenceValidite: "2030-01-01" }, "2026-11-12")).toEqual({});
  });

  it("uses Moroccan reference cities locally and actual foreign cities abroad", () => {
    expect(residenceComplete({ ...client, villeId: "1", adresse: "Rue 1" })).toBe(true);
    expect(residenceComplete({ ...client, paysResidence: "FR", villeEtrangere: "Lyon", adresse: "Rue 1" })).toBe(true);
    expect(residenceComplete({ ...client, paysResidence: "FR", villeId: "1", adresse: "Rue 1" })).toBe(false);
    expect(foreignResidence({ ...client, nationalite: "Française", paysResidence: "MA" })).toBe(false);
    expect(foreignResidence({ ...client, nationalite: "Marocaine", paysResidence: "FR" })).toBe(true);
  });

  it("keeps foreign mode enabled while requiring a country to be selected", () => {
    const pending: ClientProfile = { ...client, paysResidence: "", villeEtrangere: "Lyon", adresse: "Rue 1" };
    expect(foreignResidence(pending)).toBe(true);
    expect(residenceComplete(pending)).toBe(false);
    expect(residenceComplete({ ...pending, paysResidence: "FR" })).toBe(true);
  });

  it("allows expanded identity fields without forcing residence abroad", () => {
    expect(internationalClient({ ...client, paysResidence: "MA" })).toBe(false);
    expect(internationalClient({ ...client, typePieceIdentite: "PASSEPORT", paysResidence: "MA" })).toBe(true);
    expect(internationalClient({ ...client, paysResidence: "FR" })).toBe(true);
    expect(foreignResidence({ ...client, typePieceIdentite: "PASSEPORT", paysResidence: "MA" })).toBe(false);
  });
});
