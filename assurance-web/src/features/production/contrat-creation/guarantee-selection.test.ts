import { describe, expect, it } from "vitest";
import type { GarantieInput, ReferenceOption } from "../types";
import {
  removeGuaranteeExclusionConflicts,
  sameGuaranteeTarget,
  targetedGuaranteeInput,
} from "./guarantee-selection";

describe("guarantee target selection", () => {
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
