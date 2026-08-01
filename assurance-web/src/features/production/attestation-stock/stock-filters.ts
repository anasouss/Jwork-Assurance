import type { AttestationStockStatus } from "../types";

export const ALL_STOCK_FILTERS = "__ALL__";

export type AttestationStockFilters = {
  compagnieAssuranceId: string;
  groupeUsageAttestationId: string;
  statut: AttestationStockStatus | typeof ALL_STOCK_FILTERS;
  numero: string;
};

export const DEFAULT_ATTESTATION_STOCK_FILTERS: AttestationStockFilters = {
  compagnieAssuranceId: ALL_STOCK_FILTERS,
  groupeUsageAttestationId: ALL_STOCK_FILTERS,
  statut: "DISPONIBLE",
  numero: "",
};

const STOCK_STATUSES = new Set<AttestationStockStatus>([
  "DISPONIBLE",
  "RESERVEE",
  "UTILISEE",
  "ANNULEE",
  "DESACTIVEE",
]);

export function attestationStockFiltersFromSearchParams(searchParams: URLSearchParams): AttestationStockFilters {
  const statut = searchParams.get("statut");
  return {
    compagnieAssuranceId: searchParams.get("compagnieId") || ALL_STOCK_FILTERS,
    groupeUsageAttestationId: searchParams.get("groupeId") || ALL_STOCK_FILTERS,
    statut: statut === ALL_STOCK_FILTERS || STOCK_STATUSES.has(statut as AttestationStockStatus)
      ? statut as AttestationStockFilters["statut"]
      : DEFAULT_ATTESTATION_STOCK_FILTERS.statut,
    numero: searchParams.get("numero") ?? "",
  };
}

export function attestationStockPageFromSearchParams(searchParams: URLSearchParams) {
  const value = Number(searchParams.get("page"));
  return Number.isInteger(value) && value > 0 ? value - 1 : 0;
}

export function attestationStockSearchParams(filters: AttestationStockFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.compagnieAssuranceId !== ALL_STOCK_FILTERS) {
    params.set("compagnieId", filters.compagnieAssuranceId);
  }
  if (filters.groupeUsageAttestationId !== ALL_STOCK_FILTERS) {
    params.set("groupeId", filters.groupeUsageAttestationId);
  }
  if (filters.statut !== DEFAULT_ATTESTATION_STOCK_FILTERS.statut) {
    params.set("statut", filters.statut);
  }
  if (filters.numero.trim()) params.set("numero", filters.numero.trim());
  if (page > 0) params.set("page", String(page + 1));
  return params;
}
