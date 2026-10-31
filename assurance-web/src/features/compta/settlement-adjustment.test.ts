import { describe, expect, it } from "vitest";
import { distributeSettlementAdjustment } from "./settlement-adjustment";

describe("settlement adjustment preview", () => {
  it("settles a 329 balance with a real payment of 320 and a separate adjustment of 9", () => {
    const result = distributeSettlementAdjustment([{ elementFacturableId: "1", soldeOuvert: 329, montantRegle: 320 }], 9, " Commercial ");
    expect(result).toEqual({ total: 9, unassigned: 0, ecarts: [{ elementFacturableId: "1", documentClientId: undefined, montant: 9, motif: "Commercial" }] });
  });
  it("does not assign an adjustment to a completely unpaid item", () => {
    expect(distributeSettlementAdjustment([{ elementFacturableId: "2", soldeOuvert: 9, montantRegle: 0 }], 9, "Motif").unassigned).toBe(9);
  });
  it("preserves invoice and source identities and never exceeds the remaining amount", () => {
    const result = distributeSettlementAdjustment([{ elementFacturableId: "9007199254740993", documentClientId: "9007199254740994", soldeOuvert: 329, montantRegle: 320 }], 10, "Motif");
    expect(result.total).toBe(9);
    expect(result.unassigned).toBe(1);
    expect(result.ecarts[0].elementFacturableId).toBe("9007199254740993");
    expect(result.ecarts[0].documentClientId).toBe("9007199254740994");
  });
  it("keeps cents exact and zero adjustments empty", () => {
    expect(distributeSettlementAdjustment([{ elementFacturableId: "1", soldeOuvert: 0.3, montantRegle: 0.2 }], 0.1, "Arrondi").total).toBe(0.1);
    expect(distributeSettlementAdjustment([], 0, "").ecarts).toEqual([]);
  });
  it("does not generate invalid amounts from non-finite input", () => {
    expect(distributeSettlementAdjustment([], Number.NaN, "")).toEqual({ ecarts: [], unassigned: 0, total: 0 });
    expect(distributeSettlementAdjustment([], Number.POSITIVE_INFINITY, "")).toEqual({ ecarts: [], unassigned: 0, total: 0 });
  });
});
