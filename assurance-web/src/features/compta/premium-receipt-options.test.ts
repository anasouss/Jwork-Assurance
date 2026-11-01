import { describe, expect, it } from "vitest";
import { normalizePremiumReceiptOptions, premiumReceiptBlockReason } from "./premium-receipt-options";

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

describe("premium receipt action messages", () => {
  const base = {
    policies: normalizePremiumReceiptOptions({ policies: [policy], archives: [] }).policies,
    hasArchive: false, canIssue: true, cancelled: false, hasRejectedInstrument: false,
  };

  it("allows fully covered registered payments even before bank collection", () => {
    const pending = normalizePremiumReceiptOptions({ policies: [{ ...policy, mouvements: [{
      elementFacturableId: "1", libelle: "Affaire nouvelle", montant: 50, statut: "EN_ATTENTE_ENCAISSEMENT",
    }] }], archives: [] }).policies;
    expect(premiumReceiptBlockReason({ ...base, policies: pending })).toBeUndefined();
  });

  it("explains empty selections, missing permission and cancelled payments", () => {
    expect(premiumReceiptBlockReason({ ...base, keys: [] })).toContain("Sélectionnez");
    expect(premiumReceiptBlockReason({ ...base, canIssue: false })).toContain("autorisation");
    expect(premiumReceiptBlockReason({ ...base, cancelled: true, hasArchive: true })).toContain("annulé");
  });

  it("explains insufficient coverage and rejected payment instruments", () => {
    expect(premiumReceiptBlockReason({ ...base, policies: base.policies.map(p => ({ ...p, eligible: false })) })).toContain("pas entièrement couverte");
    expect(premiumReceiptBlockReason({ ...base, hasRejectedInstrument: true })).toContain("rejeté");
  });

  it("does not block a valid specific selection because another policy has a rejection", () => {
    expect(premiumReceiptBlockReason({ ...base, keys: ["C:1"], hasRejectedInstrument: true })).toBeUndefined();
  });

  it("preserves access to an existing archive without allowing a new issue", () => {
    expect(premiumReceiptBlockReason({ ...base, hasArchive: true, canIssue: false, hasRejectedInstrument: true })).toBeUndefined();
  });
});
