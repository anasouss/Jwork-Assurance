import { describe, expect, it } from "vitest";
import { normalizePremiumReceiptOptions } from "./premium-receipt-options";

const policy = { key: "C:1", descriptions: ["POL-1\nAssureur"], montant: 50, eligible: true };
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
  it("preserves backend eligibility and disables issuance if an older backend omits it", () => {
    expect(normalizePremiumReceiptOptions({ policies: [policy], archives: [] }).policies[0].eligible).toBe(true);
    expect(normalizePremiumReceiptOptions({ policies: [{ ...policy, eligible: false }], archives: [] }).policies[0].eligible).toBe(false);
    expect(normalizePremiumReceiptOptions({ policies: [{ key: "C:1", descriptions: ["P1"], montant: 50 }], archives: [] }).policies[0].eligible).toBe(false);
  });

  it("preserves every movement under its policy with dates, amounts and collection status", () => {
    const mouvements = [
      { elementFacturableId: "9007199254740993", libelle: "Affaire nouvelle", dateDebut: "2026-10-28", dateFin: "2027-08-27", montant: 5940.21, statut: "EN_ATTENTE_ENCAISSEMENT" },
      { elementFacturableId: "9007199254740994", documentClientId: "10", libelle: "Extension garanties", dateDebut: "2026-10-29", dateFin: "2027-08-27", montant: 137.78, statut: "EN_ATTENTE_ENCAISSEMENT" },
    ];
    const result = normalizePremiumReceiptOptions({ policies: [{ ...policy, montant: 6077.99, eligible: false, mouvements }], archives: [archive] });
    expect(result.policies[0].mouvements).toEqual(mouvements);
    expect(result.archives[0].id).toBe("all");
  });

  it("handles omitted movement details from older backends without crashing", () => {
    expect(normalizePremiumReceiptOptions({ policies: [policy], archives: [] }).policies[0].mouvements).toEqual([]);
  });

  it("rejects malformed movement details instead of dropping movements silently", () => {
    expect(() => normalizePremiumReceiptOptions({ policies: [{ ...policy, mouvements: [{ libelle: "Extension garanties" }] }], archives: [] })).toThrow();
  });
});
