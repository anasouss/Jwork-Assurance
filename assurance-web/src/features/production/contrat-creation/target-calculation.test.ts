import { describe, expect, it } from "vitest";
import type { QuittancePreview, ReferenceOption } from "../types";
import {
  previewForTarget,
  previewGuaranteeLine,
  remapAssistancesAfterVehicleRemoval,
  targetQuittanceSummary,
} from "./target-calculation";

function quittance(overrides: Partial<QuittancePreview> = {}): QuittancePreview {
  return {
    primeNette: 0,
    taxe: 0,
    taxeParafiscale: 0,
    accessoire: 0,
    cnpac: 0,
    primeTotale: 0,
    lignes: [],
    ...overrides,
  };
}

describe("contract target calculations", () => {
  it("uses the backend target summary without recomputing its values", () => {
    const preview = quittance({
      targetSummaries: [{
        kind: "VEHICULE",
        vehiculeIndex: 0,
        automobilePrimeNette: -51.81,
        evcatPrimeNette: -1.81,
        taxe: -8.03,
        taxeParafiscale: 0,
        cnpac: 17,
        primeTotale: -44.65,
      }],
    });

    expect(targetQuittanceSummary(preview, { kind: "vehicule", index: 0 })).toMatchObject({
      totalNet: -51.81,
      evcat: -1.81,
      taxe: -8.03,
      cnpac: 17,
      totalAPayer: -44.65,
    });
  });

  it("keeps the general preview when a target preview contains another target", () => {
    const general = quittance();
    const targetPreview = quittance({
      garanties: [{ garantieId: "1", vehiculeIndex: 1 }],
    });

    expect(previewForTarget(general, targetPreview, { kind: "vehicule", index: 0 })).toBe(general);
  });

  it("matches a saved guarantee line by target and tariff line", () => {
    const preview = quittance({
      garanties: [
        { garantieId: "4", vehiculeIndex: 0, ligneGrilleTarifaireId: "3", primeNette: 22.6 },
        { garantieId: "4", vehiculeIndex: 1, ligneGrilleTarifaireId: "3", primeNette: 30 },
      ],
    });

    expect(previewGuaranteeLine(
      preview,
      { id: "4", libelle: "Bris de glace", typeGarantie: "VEHICULE" } satisfies ReferenceOption,
      { kind: "vehicule", index: 0 },
      { garantieId: "4", vehiculeIndex: 0, ligneGrilleTarifaireId: "3" }
    )?.primeNette).toBe(22.6);
  });

  it("reindexes vehicle assistance drafts after removal", () => {
    expect(remapAssistancesAfterVehicleRemoval({
      "vehicule:0": { enabled: true },
      "vehicule:1": { enabled: false },
      "vehicule:2": { enabled: true },
      "remorque:0": { enabled: true },
    }, 1)).toEqual({
      "vehicule:0": { enabled: true },
      "vehicule:1": { enabled: true },
      "remorque:0": { enabled: true },
    });
  });
});
