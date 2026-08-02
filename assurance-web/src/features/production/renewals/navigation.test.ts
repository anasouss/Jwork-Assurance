import { describe, expect, it } from "vitest";
import { renewalDraftPath, renewalReturnPath } from "./navigation";

describe("renewal navigation", () => {
  it.each([
    ["FLOTTE", "flotte"],
    ["CONVENTION", "convention"],
    ["PARTICULIER", "particulier"],
  ] as const)("builds the %s editor path", (typeContrat, segment) => {
    expect(renewalDraftPath(
      { id: "42", typeContrat },
      "/app/production/echeances?page=2"
    )).toBe(
      `/app/production/renouvellements/${segment}/42?returnTo=${encodeURIComponent("/app/production/echeances?page=2")}`
    );
  });

  it("only accepts an échéance page as the return target", () => {
    expect(renewalReturnPath("/app/production/echeances?typeContrat=FLOTTE"))
      .toBe("/app/production/echeances?typeContrat=FLOTTE");
    expect(renewalReturnPath("https://example.com"))
      .toBe("/app/production/echeances");
    expect(renewalReturnPath(null)).toBe("/app/production/echeances");
  });
});
