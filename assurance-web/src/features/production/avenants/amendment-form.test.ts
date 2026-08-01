import { describe, expect, it } from "vitest";
import {
  buildAvenantAssistances,
  ensureRcGaranties,
  mapCurrentGaranties,
  scopeGarantiesForTarget,
} from "./amendment-form";
import type { ContratSummary, GarantieInput, ReferenceOption } from "../types";

describe("amendment form adapters", () => {
  it("adds one mandatory RC guarantee per target without duplicating existing RC", () => {
    const rc: ReferenceOption = {
      id: "1",
      code: "RC",
      libelle: "Responsabilite Civile",
      responsabiliteCivile: true,
      modeParDefaut: "TAUX",
    };
    const selected: GarantieInput[] = [{
      garantieId: "1",
      vehiculeIndex: 0,
      modeSelectionne: "TAUX",
      sourceValeurSelectionnee: "AUCUNE",
    }];

    expect(ensureRcGaranties(selected, 2, 1, [rc])).toMatchObject([
      selected[0],
      { garantieId: "1", vehiculeIndex: 1, modeSelectionne: "TAUX" },
      { garantieId: "1", remorqueIndex: 0, modeSelectionne: "TAUX" },
    ]);
  });

  it("scopes a target preview payload to index zero without mutating the source", () => {
    const selected: GarantieInput[] = [
      { garantieId: "1", vehiculeIndex: 0 },
      { garantieId: "4", vehiculeIndex: 2, prime: 22.6 },
      { garantieId: "7", remorqueIndex: 0 },
    ];

    expect(scopeGarantiesForTarget(selected, { kind: "vehicule", index: 2 })).toEqual([
      expect.objectContaining({ garantieId: "4", vehiculeIndex: 0, remorqueIndex: undefined, prime: 22.6 }),
    ]);
    expect(selected[1].vehiculeIndex).toBe(2);
  });

  it("serializes only modified assistance deltas when requested", () => {
    const result = buildAvenantAssistances({
      "vehicule:0": { enabled: true, modified: false, assistanceId: "10" },
      "vehicule:1": {
        enabled: false,
        modified: true,
        assistanceId: "11",
        compagnieAssistanceId: "3",
        produitAssistanceId: "8",
      },
    }, { includeDisabled: true, onlyModified: true });

    expect(result).toEqual([
      expect.objectContaining({
        assistanceId: "11",
        vehiculeIndex: 1,
        enabled: false,
        typeQuittance: "AVENANT",
      }),
    ]);
  });

  it("preserves persisted guarantee financial values while mapping target indexes", () => {
    const garanties = [{
      garantieId: "1",
      vehiculeId: "22",
      modeSelectionne: "TAUX",
      sourceValeurSelectionnee: "AUCUNE",
      capital: 50_000_000,
      prime: -51.81,
      taux: 1,
    }] as NonNullable<ContratSummary["garanties"]>;

    expect(mapCurrentGaranties(garanties, [{ vehiculeId: "22", typeVehicule: "AUTOMOBILE" }], [])).toEqual([
      expect.objectContaining({
        garantieId: "1",
        vehiculeIndex: 0,
        capital: 50_000_000,
        prime: -51.81,
        taux: 1,
      }),
    ]);
  });
});
