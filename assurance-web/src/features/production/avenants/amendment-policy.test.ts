import { describe, expect, it } from "vitest";
import {
  AMENDMENT_CODES,
  amendmentLabel,
  getAmendmentPolicy,
  isSupportedAmendmentCode,
  normalizeAmendmentCode,
} from "./amendment-policy";

describe("amendment policy", () => {
  it("defines one complete policy for every supported amendment", () => {
    expect(AMENDMENT_CODES).toHaveLength(18);
    for (const code of AMENDMENT_CODES) {
      const policy = getAmendmentPolicy(code);
      expect(policy?.code).toBe(code);
      expect(policy?.label).toBeTruthy();
    }
  });

  it("normalizes API and route codes before lookup", () => {
    expect(normalizeAmendmentCode(" chv_m ")).toBe("CHV_M");
    expect(isSupportedAmendmentCode(" chv_m ")).toBe(true);
    expect(amendmentLabel(" chv_m ")).toBe("Changement véhicule");
  });

  it("keeps financial and target behavior explicit", () => {
    expect(getAmendmentPolicy("CHV_M")).toMatchObject({
      operation: "TARGET_CREATION",
      target: "VEHICLE",
      differential: true,
      singleVehicle: true,
    });
    expect(getAmendmentPolicy("MOG_F")).toMatchObject({
      operation: "GUARANTEE_MODIFICATION",
      target: "EXISTING",
      differential: true,
    });
    expect(getAmendmentPolicy("RCH_M")).toMatchObject({
      operation: "CLOSURE",
      differential: false,
      closureAtTerm: true,
    });
  });

  it("rejects unknown movement codes", () => {
    expect(isSupportedAmendmentCode("UNKNOWN")).toBe(false);
    expect(getAmendmentPolicy("UNKNOWN")).toBeUndefined();
  });
});
