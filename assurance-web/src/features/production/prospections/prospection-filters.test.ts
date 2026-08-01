import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROSPECTION_FILTERS,
  prospectionFiltersFromSearchParams,
  prospectionPageFromSearchParams,
  prospectionSearchParams,
} from "./prospection-filters";

describe("prospection URL state", () => {
  it("uses stable defaults", () => {
    expect(prospectionFiltersFromSearchParams(new URLSearchParams())).toEqual(DEFAULT_PROSPECTION_FILTERS);
    expect(prospectionPageFromSearchParams(new URLSearchParams())).toBe(0);
  });

  it("round-trips filters and one-based pages", () => {
    const params = prospectionSearchParams({
      compagnieId: "4",
      du: "2026-01-01",
      au: "2026-12-31",
      codeClient: " C001 ",
      numeroDevis: " D001 ",
    }, 3);
    expect(prospectionFiltersFromSearchParams(params)).toEqual({
      compagnieId: "4",
      du: "2026-01-01",
      au: "2026-12-31",
      codeClient: "C001",
      numeroDevis: "D001",
    });
    expect(prospectionPageFromSearchParams(params)).toBe(3);
  });
});
