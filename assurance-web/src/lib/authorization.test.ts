import { describe, expect, it } from "vitest";
import {
  hasAnyPermission,
  canAccessPath,
  permissionRequirementForPath,
} from "./authorization";

describe("route authorization", () => {
  it("uses the most specific production rule", () => {
    expect(
      permissionRequirementForPath("/app/production/ajouter-dossier/convention/1")
    ).toEqual({ anyOf: ["contrat:create", "contrat:update"] });
  });

  it("requires amendment-related access on amendment routes", () => {
    expect(
      permissionRequirementForPath("/app/production/contrats/3/avenants/CHV_M")
        ?.anyOf
    ).toContain("avenant:create");
  });

  it("requires a dedicated stock permission on the stock route", () => {
    const requirement = permissionRequirementForPath(
      "/app/production/attestations-stock"
    );

    expect(requirement).toEqual({
      anyOf: ["attestation-stock:view"],
    });
    expect(hasAnyPermission(["contrat:view"], requirement?.anyOf ?? [])).toBe(false);
  });

  it("allows any one of the accepted permissions", () => {
    expect(hasAnyPermission(["contrat:view"], ["contrat:create", "contrat:view"])).toBe(true);
    expect(hasAnyPermission(["client:view"], ["contrat:create", "contrat:view"])).toBe(false);
  });

  it("does not match a creation route as a generic detail route", () => {
    for (const [path, read, create] of [
      ["/app/compta/bordereaux-compagnies/nouveau", "bordereau-compagnie:view", "bordereau-compagnie:create"],
      ["/app/compta/tresorerie/bordereaux-remise/nouveau", "bordereau-remise:view", "bordereau-remise:create"],
      ["/app/compta/reglements/nouveau", "reglement-client:view", "reglement-client:create"],
    ]) {
      expect(canAccessPath([read], path)).toBe(false);
      expect(canAccessPath([create], path)).toBe(true);
    }
  });

  it("keeps convention document and payment workspaces separate", () => {
    expect(canAccessPath(["facture-convention:view"], "/app/compta/conventions/factures")).toBe(true);
    expect(canAccessPath(["document-client:view"], "/app/compta/conventions/factures")).toBe(false);
    expect(canAccessPath(["reglement-client:view"], "/app/compta/conventions/encaissements")).toBe(true);
  });

  it("denies unregistered operational routes and retired capabilities", () => {
    expect(canAccessPath(["contrat:view"], "/app/production/unknown")).toBe(false);
    expect(canAccessPath(["tresorerie:manage"], "/app/compta/tresorerie/comptes")).toBe(false);
    expect(canAccessPath(["contrat:update"], "/app/production/renouvellements/flotte/12")).toBe(false);
    expect(canAccessPath(["contrat:renew"], "/app/production/renouvellements/flotte/12")).toBe(true);
  });
});
