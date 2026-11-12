import { describe, expect, it } from "vitest";
import { coverageExpiration, coveragePeriodLabel, periodesForUsage } from "./coverage-periods";

describe("usage coverage periods", () => {
  it.each([
    ["M1", "1 mois", "Mensuelle"],
    ["M3", "3 mois", "Trimestrielle"],
    ["M6", "6 mois", "Semestrielle"],
    ["M12", "12 mois", "Annuelle"],
    ["J5", "5 jours", "5 jours"],
    ["J10", "10 jours", "10 jours"],
  ] as const)("labels %s according to the contract type", (period, duration, frequency) => {
    expect(coveragePeriodLabel(period, "ferme")).toBe(duration);
    expect(coveragePeriodLabel(period, "renouvelable")).toBe(frequency);
    expect(coveragePeriodLabel(period)).toBe(duration);
  });

  it("shows only the configured periods in chronological order", () => {
    expect(periodesForUsage({ periodesAutorisees: ["M6", "J5", "M3", "J10", "M1"] })
      .map((periode) => periode.value)).toEqual(["J5", "J10", "M1", "M3", "M6"]);
    expect(periodesForUsage({})).toEqual([]);
  });

  it.each([
    ["2026-12-29", "J5", "2027-01-02"],
    ["2026-12-29", "J10", "2027-01-07"],
    ["2026-01-31", "M1", "2026-02-27"],
    ["2028-01-31", "M1", "2028-02-28"],
    ["2026-11-12", "M3", "2027-02-11"],
    ["2026-11-12", "M6", "2027-05-11"],
  ])("previews %s plus %s inclusively", (date, period, expected) => {
    expect(coverageExpiration(date, period)).toBe(expected);
  });

  it("does not invent an expiry for missing or invalid periods", () => {
    expect(coverageExpiration(undefined, "J5")).toBeUndefined();
    expect(coverageExpiration("2026-11-12", "invalid")).toBeUndefined();
  });
});
