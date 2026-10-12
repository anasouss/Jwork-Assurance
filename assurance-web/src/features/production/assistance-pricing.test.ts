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

    expect(resolveAssistanceDraftTotal(product, "2026-10-01", "2027-09-30")).toBe(329);
    expect(resolveAssistanceDraftTotal(product, "2026-10-01", "2026-12-31")).toBe(82.25);
  });
});
