import { describe, expect, it } from "vitest";
import { activitySurfaceForPath } from "./activity-context";

describe("activity screen context", () => {
  it.each([
    ["/app/production/ajouter-dossier/convention/99", "CONTRACT_CREATION"],
    ["/app/production/contrats/99/avenants/CHV_M", "CONTRACT_AMENDMENT"],
    ["/app/production/ajouter-dossier/assistance-voyage/99", "ASSISTANCE_CREATION"],
    ["/app/production/contrats/99/assistance", "ASSISTANCE_CREATION"],
    ["/app/production/contrats/99/cartes-vertes", "GREEN_CARDS"],
    ["/app/production/contrats", "CONTRACT_REGISTER"],
    ["/app/production/attestations-stock", "ATTESTATION_STOCK"],
    ["/app/crm", "CLIENT_REGISTER"],
    ["/app/crm/parametres/origines-commerciales", "CRM_SETTINGS"],
    ["/app/compta/tresorerie/impayes-clients", "BANK_REJECTIONS"],
    ["/app/compta/tresorerie/rapprochement-bancaire", "BANK_RECONCILIATION"],
    ["/app/compta/tresorerie/bordereaux-remise/12", "BANK_REMITTANCES"],
    ["/app/compta/releves-factures", "CLIENT_ACCOUNTING"],
    ["/app/compta/reglements/12", "CLIENT_PAYMENTS"],
    ["/app/compta/bordereaux-compagnies/12", "COMPANY_ACCOUNTING"],
    ["/app/compta/quittances", "COMPANY_ASSIGNMENTS"],
    ["/app/sinistre/dossiers/12", "CLAIM_FILE"],
    ["/app/sinistre/declarer", "CLAIM_DECLARATION"],
    ["/app/sinistre/referentiels", "CLAIM_SETTINGS"],
    ["/app/admin/activite", "ADMINISTRATION"],
  ])("maps %s without inferring any business outcome", (path, surface) => {
    expect(activitySurfaceForPath(path)).toBe(surface);
  });

  it("does not store arbitrary URLs or identifiers as context", () => {
    expect(activitySurfaceForPath("/unknown/secret-value")).toBe("OTHER_APPLICATION");
  });
});
