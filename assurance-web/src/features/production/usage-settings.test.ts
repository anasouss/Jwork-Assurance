import { describe, expect, it } from "vitest";
import { usageSettingsSchema } from "./schemas";

describe("usage period settings", () => {
  const usage = { code: "A", libelle: "TOURISME", fermeUniquement: false };

  it("stores standard periods using the existing unrestricted representation", () => {
    const result = usageSettingsSchema.parse({ ...usage, modePeriodes: "STANDARD" });
    expect(result.periodesAutorisees).toEqual([]);
    expect(result).not.toHaveProperty("modePeriodes");
  });

  it("clears custom restrictions when switching to standard", () => {
    const result = usageSettingsSchema.parse({
      ...usage, modePeriodes: "STANDARD", periodesAutorisees: ["J5", "M1"],
    });
    expect(result.periodesAutorisees).toEqual([]);
  });

  it.each([undefined, []])("rejects custom mode without selected periods (%s)", (periodesAutorisees) => {
    const result = usageSettingsSchema.safeParse({ ...usage, modePeriodes: "CUSTOM", periodesAutorisees });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["periodesAutorisees"]);
  });

  it("preserves the configured Frontier restrictions", () => {
    const result = usageSettingsSchema.parse({
      code: "F", libelle: "FRONTIERE", fermeUniquement: true,
      modePeriodes: "CUSTOM", periodesAutorisees: ["J5", "J10", "M1", "M3", "M6"],
    });
    expect(result.fermeUniquement).toBe(true);
    expect(result.periodesAutorisees).toEqual(["J5", "J10", "M1", "M3", "M6"]);
    expect(result).not.toHaveProperty("modePeriodes");
  });
});
