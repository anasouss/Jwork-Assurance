import { describe, expect, it } from "vitest";
import type { ClientResponse } from "@/features/production/types";
import { clientRecordDraft } from "./client-record";

describe("client record editing", () => {
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
});
