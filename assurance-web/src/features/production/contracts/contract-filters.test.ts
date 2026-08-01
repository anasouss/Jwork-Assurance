import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTRACT_FILTERS,
  contractFiltersFromSearchParams,
  contractFiltersToSearchParams,
  contractPageFromSearchParams,
  contractSearchParams,
} from "./contract-filters";

describe("contract filter URL state", () => {
  it("uses stable defaults for an empty URL", () => {
    expect(contractFiltersFromSearchParams(new URLSearchParams())).toEqual(DEFAULT_CONTRACT_FILTERS);
  });

  it("round-trips active filters and trims free text", () => {
    const params = contractFiltersToSearchParams({
      typeContrat: "CONVENTION",
      typeDate: "ECHEANCE",
      du: "2026-01-01",
      au: "2026-12-31",
      codeClient: "  C000123  ",
      compagnieId: "4",
      numeroPolice: "  P-42 ",
      clientId: "9",
    });

    expect(contractFiltersFromSearchParams(params)).toEqual({
      typeContrat: "CONVENTION",
      typeDate: "ECHEANCE",
      du: "2026-01-01",
      au: "2026-12-31",
      codeClient: "C000123",
      compagnieId: "4",
      numeroPolice: "P-42",
      clientId: "9",
    });
  });

  it("drops defaults and rejects unsupported route values", () => {
    expect(contractFiltersToSearchParams(DEFAULT_CONTRACT_FILTERS).toString()).toBe("");
    expect(contractFiltersFromSearchParams(new URLSearchParams("typeContrat=OTHER&typeDate=OTHER"))).toMatchObject({
      typeContrat: "ALL",
      typeDate: "EFFET",
    });
  });

  it("stores pagination as a one-based URL value", () => {
    const params = contractSearchParams(DEFAULT_CONTRACT_FILTERS, 2);
    expect(params.get("page")).toBe("3");
    expect(contractPageFromSearchParams(params)).toBe(2);
    expect(contractPageFromSearchParams(new URLSearchParams("page=invalid"))).toBe(0);
  });
});
