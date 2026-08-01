import { describe, expect, it } from "vitest";
import { tariffSelectionLabel } from "./tariff-selection-label";

describe("tariffSelectionLabel", () => {
  it("uses the premium rate for standard guarantees", () => {
    expect(tariffSelectionLabel({
      id: "bg-line",
      libelle: "Bris de glace",
      modeTarification: "TAUX",
      critereSelectionTarif: "TAUX_PRIME",
      taux: 1,
      tauxFranchise: 5,
    })).toBe("1 %");
  });

  it("uses the franchise rate when configured without changing the tariff line", () => {
    expect(tariffSelectionLabel({
      id: "dv-line",
      libelle: "Dommages au véhicule",
      modeTarification: "TAUX",
      critereSelectionTarif: "TAUX_FRANCHISE",
      taux: 0.4,
      tauxFranchise: 3,
    })).toBe("3 %");
  });
});
