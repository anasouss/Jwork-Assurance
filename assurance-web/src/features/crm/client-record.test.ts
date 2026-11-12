import { describe, expect, it } from "vitest";
import type { ClientResponse } from "@/features/production/types";
import { clientProfileSections, clientRecordDraft } from "./client-record";

describe("client record editing", () => {
  it("shows personal identity and validity dates without company identifiers", () => {
    const sections = clientProfileSections({ id: "1", typeClient: "PERSONNE_PHYSIQUE", cin: "AD101076",
      cinValidite: "2030-01-04", dateNaissance: "1980-03-20", nationalite: "Marocaine", genre: "FEMME",
      passport: "P123", passportValidite: "2032-05-06", rc: "not-personal", ice: "not-personal",
      numeroPermis: "07/017871", dateDelivrancePermis: "2000-04-12", dateValiditePermis: "2030-04-12", conducteurHabituel: false });
    expect(sections.map(section => section.title)).toEqual(["Identité", "Permis de conduire"]);
    const fields = sections.flatMap(section => section.fields);
    expect(fields).toContainEqual({ label: "Validité CIN", value: "04/01/2030" });
    expect(fields).toContainEqual({ label: "Date de naissance", value: "20/03/1980" });
    expect(fields).toContainEqual({ label: "Validité passeport", value: "06/05/2032" });
    expect(fields).toContainEqual({ label: "Date de délivrance", value: "12/04/2000" });
    expect(fields).toContainEqual({ label: "Date de validité", value: "12/04/2030" });
    expect(fields).toContainEqual({ label: "Conducteur habituel", value: "Non" });
    expect(fields.some(field => field.label === "RC" || field.label === "ICE")).toBe(false);
  });

  it("shows all company identifiers and never personal dates or driving data", () => {
    const sections = clientProfileSections({ id: "2", typeClient: "PERSONNE_MORALE", raisonSociale: "Société test",
      rc: "123", ice: "456", iff: "789", cnss: "987", patente: "654", dateNaissance: "1980-01-01", numeroPermis: "unused" });
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Identification de l’entreprise");
    expect(sections[0].fields.map(field => field.label)).toEqual(["Raison sociale", "RC", "ICE", "Identifiant fiscal (IF)", "CNSS", "Patente"]);
  });

  it("omits empty optional sections and does not mistake a default driver flag for a licence", () => {
    expect(clientProfileSections({ id: "3", typeClient: "PERSONNE_PHYSIQUE", conducteurHabituel: true, nom: " " })).toEqual([]);
    expect(clientProfileSections({ id: "4", typeClient: "PERSONNE_PHYSIQUE", dateValiditePermis: "2030-01-01" })[0])
      .toMatchObject({ title: "Permis de conduire", fields: [{ label: "Date de validité", value: "01/01/2030" }] });
  });

  it("preserves fields outside the compact editor without resubmitting display metadata", () => {
    const client: ClientResponse = {
      id: "42", agenceId: "7", typeClient: "PERSONNE_PHYSIQUE", codeClient: "C000042",
      clientParentId: "12", categorieClientId: "3", carteResidence: "RES-1", patente: "PAT-1",
      prenom: "Test", nom: "Client", villeId: "331", ville: "Tiznit", telephone: "0600000000",
      passport: "PASS-1", passportValidite: "2030-01-01", nationalite: "Marocaine",
      numeroPermis: "PER-1", dateDelivrancePermis: "2000-01-01", dateValiditePermis: "2030-01-01",
      dateNaissance: "1980-01-01", conducteurHabituel: false,
      groupe: { id: "8", code: "G1", libelle: "Groupe", typeRelation: "FILIALE" },
      telephones: [{ id: "15", numero: "0611111111", principal: true, whatsapp: true }],
    };
    const draft = clientRecordDraft(client);
    expect(draft).toMatchObject({ clientParentId: "12", categorieClientId: "3", carteResidence: "RES-1", patente: "PAT-1",
      passport: "PASS-1", passportValidite: "2030-01-01", nationalite: "Marocaine", numeroPermis: "PER-1",
      dateDelivrancePermis: "2000-01-01", dateValiditePermis: "2030-01-01", dateNaissance: "1980-01-01", conducteurHabituel: false });
    expect(draft.telephones).toEqual([{ numero: "0611111111", principal: true, whatsapp: true }]);
    for (const key of ["id", "agenceId", "codeClient", "ville", "groupe", "acquisition"]) expect(draft).not.toHaveProperty(key);
  });

  it("keeps a legacy single phone editable without inventing an empty number", () => {
    const client: ClientResponse = { id: "1", typeClient: "PERSONNE_MORALE", telephone: "0600000000" };
    expect(clientRecordDraft(client).telephones).toEqual([{ numero: "0600000000", principal: true, whatsapp: false }]);
    expect(clientRecordDraft({ ...client, telephone: undefined }).telephones).toEqual([]);
  });

  it("preserves foreign residence and the selected identity when reopening the editor", () => {
    const draft = clientRecordDraft({ id: "5", typeClient: "PERSONNE_PHYSIQUE",
      typePieceIdentite: "CARTE_RESIDENCE", carteResidence: "CS123", carteResidenceValidite: "2031-01-01",
      paysResidence: "FR", villeEtrangere: "Lyon", adresse: "Rue 1" });
    expect(draft).toMatchObject({ typePieceIdentite: "CARTE_RESIDENCE", carteResidenceValidite: "2031-01-01",
      paysResidence: "FR", villeEtrangere: "Lyon", adresse: "Rue 1" });
  });

  it("preserves the foreign-client flag for a CIN holder residing in Morocco", () => {
    const draft = clientRecordDraft({ id: "6", typeClient: "PERSONNE_PHYSIQUE", clientEtranger: true,
      typePieceIdentite: "CIN", cin: "AB123", cinValidite: "2031-01-01", paysResidence: "MA", villeId: "1" });
    expect(draft).toMatchObject({ clientEtranger: true, typePieceIdentite: "CIN", paysResidence: "MA" });
  });
});
