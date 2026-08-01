import { describe, expect, it } from "vitest";
import {
  ALL_STOCK_FILTERS,
  attestationStockFiltersFromSearchParams,
  attestationStockPageFromSearchParams,
  attestationStockSearchParams,
} from "./stock-filters";

describe("attestation stock filters", () => {
  it("uses safe defaults for an empty or invalid URL", () => {
    const filters = attestationStockFiltersFromSearchParams(new URLSearchParams("statut=UNKNOWN"));
    expect(filters).toEqual({
      compagnieAssuranceId: ALL_STOCK_FILTERS,
      groupeUsageAttestationId: ALL_STOCK_FILTERS,
      statut: "DISPONIBLE",
      numero: "",
    });
  });

  it("round-trips submitted filters and a one-based URL page", () => {
    const params = attestationStockSearchParams({
      compagnieAssuranceId: "4",
      groupeUsageAttestationId: "2",
      statut: "ANNULEE",
      numero: " 90A12 ",
    }, 2);

    expect(params.toString()).toBe("compagnieId=4&groupeId=2&statut=ANNULEE&numero=90A12&page=3");
    expect(attestationStockPageFromSearchParams(params)).toBe(2);
    expect(attestationStockFiltersFromSearchParams(params)).toEqual({
      compagnieAssuranceId: "4",
      groupeUsageAttestationId: "2",
      statut: "ANNULEE",
      numero: "90A12",
    });
  });
});
