import { describe, expect, it } from "vitest";
import { resolveAssistanceDraftTotal, resolveAssistanceQuarterCount } from "./assistance-pricing";

describe("assistance pricing preview", () => {
  it("uses the same quarterly prorata boundaries as the backend", () => {
    expect(resolveAssistanceQuarterCount("2026-10-01", "2027-09-30")).toBe(4);
    expect(resolveAssistanceQuarterCount("2026-10-01", "2026-12-31")).toBe(1);
    expect(resolveAssistanceQuarterCount("2026-01-31", "2026-04-30")).toBe(2);
  });

  it("updates the TTC amount from the selected product", () => {
    const product = { id: "5", libelle: "Premium", montantTtc: 329 };

    expect(resolveAssistanceDraftTotal(product, "2026-10-01", "2026-10-01", "2027-09-30")).toBe(329);
    expect(resolveAssistanceDraftTotal(product, "2026-10-01", "2026-10-01", "2026-12-31")).toBe(82.25);
  });

  it("selects the tariff period from the subscription date", () => {
    const product = {
      id: "5",
      libelle: "Premium",
      montantTtc: 405,
      tarifs: [
        { id: "3", libelle: "2026", dateDebut: "2026-01-01", dateFin: "2026-12-31", montantTtc: 405 },
        { id: "2", libelle: "2025", dateDebut: "2025-01-01", dateFin: "2025-12-31", montantTtc: 399 },
        { id: "1", libelle: "2024", dateDebut: "2023-01-01", dateFin: "2024-12-31", montantTtc: 329 },
      ],
    };

    expect(resolveAssistanceDraftTotal(product, "2024-10-29", "2026-10-29", "2027-10-28")).toBe(329);
  });
});
