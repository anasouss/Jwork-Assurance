import { describe, expect, it } from "vitest";
import {
  hasAnyPermission,
  permissionRequirementForPath,
} from "./authorization";

describe("route authorization", () => {
  it("uses the most specific production rule", () => {
    expect(
      permissionRequirementForPath("/app/production/ajouter-dossier/convention/1")
    ).toEqual({ anyOf: ["contrat:create"] });
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
      anyOf: ["attestation-stock:view", "attestation-stock:manage"],
    });
    expect(hasAnyPermission(["contrat:view"], requirement?.anyOf ?? [])).toBe(false);
  });

  it("allows any one of the accepted permissions", () => {
    expect(hasAnyPermission(["contrat:view"], ["contrat:create", "contrat:view"])).toBe(true);
    expect(hasAnyPermission(["client:view"], ["contrat:create", "contrat:view"])).toBe(false);
  });
});
