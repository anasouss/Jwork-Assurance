import { describe, expect, it } from "vitest";
import { normalizePremiumReceiptOptions } from "./premium-receipt-options";

const policy = { key: "C:1", descriptions: ["POL-1\nAssureur"], montant: 50 };
const archive = { id: "all", numero: "2026000001", dateEmission: "2026-10-31" };

describe("premium receipt options", () => {
  it("normalizes the omitted null selection of a full-payment archive", () => {
    const result = normalizePremiumReceiptOptions({ policies: [policy], archives: [archive] });
    expect(result.archives[0].policyKeys).toBeNull();
  });

  it("accepts explicit null selections and empty result sets", () => {
    expect(normalizePremiumReceiptOptions({ policies: [], archives: [] })).toEqual({ policies: [], archives: [] });
    expect(normalizePremiumReceiptOptions({ policies: [policy], archives: [{ ...archive, policyKeys: null }] })
      .archives[0].policyKeys).toBeNull();
  });

  it("preserves the exact policy keys and allocated amount of a selected receipt", () => {
    const selected = { ...archive, id: "12", policyKeys: ["C:1"] };
    const result = normalizePremiumReceiptOptions({ policies: [policy], archives: [selected] });
    expect(result.archives[0]).toEqual(selected);
    expect(result.policies[0].montant).toBe(50);
  });

  it.each([undefined, null, []])("rejects incomplete specific selections instead of treating them as all policies: %s", keys => {
    expect(() => normalizePremiumReceiptOptions({ policies: [policy], archives: [{ ...archive, id: "12", policyKeys: keys }] }))
      .toThrow("réponse des quittances");
  });

  it("rejects missing policy descriptions and missing result lists before rendering", () => {
    expect(() => normalizePremiumReceiptOptions({ policies: [{ key: "C:1", montant: 50 }], archives: [] })).toThrow();
    expect(() => normalizePremiumReceiptOptions({ policies: [] })).toThrow();
  });
});
