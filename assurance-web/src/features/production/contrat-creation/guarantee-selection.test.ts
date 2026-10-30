import { describe, expect, it } from "vitest";
import type { GarantieInput, ReferenceOption } from "../types";
import {
  isGuaranteeSelectionComplete,
  removeGuaranteeExclusionConflicts,
  sameGuaranteeTarget,
  samePersonneGuaranteeTarget,
  targetedGuaranteeInput,
} from "./guarantee-selection";

describe("guarantee target selection", () => {
  it("shows a contract-level person guarantee in the particulier vehicle editor without changing its target", () => {
    const pp: GarantieInput = { garantieId: "PP", modeSelectionne: "PROTECTION", montantDeces: 20000 };
    expect(samePersonneGuaranteeTarget(pp, { kind: "vehicule", index: 0 }, true)).toBe(true);
    expect(samePersonneGuaranteeTarget(pp, { kind: "vehicule", index: 0 })).toBe(false);
    expect(samePersonneGuaranteeTarget(pp, { kind: "remorque", index: 0 }, true)).toBe(false);
    expect(pp.vehiculeIndex).toBeUndefined();
  });

  it("does not match another vehicle or client-specific person coverage", () => {
    expect(samePersonneGuaranteeTarget({ garantieId: "PP", vehiculeIndex: 1 }, { kind: "vehicule", index: 0 }, true)).toBe(false);
    expect(samePersonneGuaranteeTarget({ garantieId: "PC", clientId: "42" }, { kind: "vehicule", index: 0 }, true)).toBe(false);
  });
  it("builds a guarantee input for the requested target", () => {
    const garantie: ReferenceOption = { id: "4", libelle: "Bris de glace", modeParDefaut: "CAPITAL" };

    expect(targetedGuaranteeInput(garantie, { kind: "remorque", index: 2 }, "ASSUREE")).toEqual({
      garantieId: "4",
      vehiculeIndex: undefined,
      remorqueIndex: 2,
      modeSelectionne: "CAPITAL",
      sourceValeurSelectionnee: "ASSUREE",
    });
  });

  it("matches only the same target kind and index", () => {
    const item = { garantieId: "4", vehiculeIndex: 1 } as GarantieInput;
    expect(sameGuaranteeTarget(item, { kind: "vehicule", index: 1 })).toBe(true);
    expect(sameGuaranteeTarget(item, { kind: "vehicule", index: 0 })).toBe(false);
    expect(sameGuaranteeTarget(item, { kind: "remorque", index: 1 })).toBe(false);
  });

  it("accepts a person guarantee with a formula even when it has no premium", () => {
    expect(isGuaranteeSelectionComplete({
      garantieId: "PP",
      modeSelectionne: "PROTECTION",
      formuleGarantiePersonneId: "14",
    })).toBe(true);
  });

  it("requires a premium for a priced vehicle guarantee", () => {
    expect(isGuaranteeSelectionComplete({
      garantieId: "RC",
      modeSelectionne: "TAUX",
    })).toBe(false);
  });

  it("removes an incompatible guarantee only from the active target", () => {
    const garanties: ReferenceOption[] = [
      { id: "V", libelle: "Vol", groupeExclusionId: "VOL", groupeExclusionActif: true },
      { id: "DV", libelle: "Dommages véhicule", groupeExclusionId: "VOL", groupeExclusionActif: true },
    ];
    const selected = [
      { garantieId: "DV", vehiculeIndex: 0 },
      { garantieId: "DV", vehiculeIndex: 1 },
    ] as GarantieInput[];

    expect(removeGuaranteeExclusionConflicts(
      selected,
      garanties,
      { kind: "vehicule", index: 0 },
      garanties[0]
    )).toEqual([{ garantieId: "DV", vehiculeIndex: 1 }]);
  });
});
