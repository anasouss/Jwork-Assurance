import type { TypeContrat } from "../types";

export type ContractFilters = {
  typeContrat: "ALL" | TypeContrat;
  typeDate: "EFFET" | "ECHEANCE";
  du?: string;
  au?: string;
  codeClient: string;
  compagnieId: "ALL" | string;
  numeroPolice: string;
  clientId: string;
};

export const DEFAULT_CONTRACT_FILTERS: ContractFilters = {
  typeContrat: "ALL",
  typeDate: "EFFET",
  codeClient: "",
  compagnieId: "ALL",
  numeroPolice: "",
  clientId: "",
};

export function contractFiltersFromSearchParams(searchParams: URLSearchParams): ContractFilters {
  const typeContrat = searchParams.get("typeContrat");
  const typeDate = searchParams.get("typeDate");
  return {
    typeContrat: typeContrat === "PARTICULIER" || typeContrat === "CONVENTION" || typeContrat === "FLOTTE"
      ? typeContrat
      : "ALL",
    typeDate: typeDate === "ECHEANCE" ? "ECHEANCE" : "EFFET",
    du: searchParams.get("du") || undefined,
    au: searchParams.get("au") || undefined,
    codeClient: searchParams.get("client") ?? "",
    compagnieId: searchParams.get("compagnieId") ?? "ALL",
    numeroPolice: searchParams.get("numeroPolice") ?? "",
    clientId: searchParams.get("clientId") ?? "",
  };
}

export function contractFiltersToSearchParams(filters: ContractFilters) {
  const params = new URLSearchParams();
  if (filters.typeContrat !== "ALL") params.set("typeContrat", filters.typeContrat);
  if (filters.typeDate !== "EFFET") params.set("typeDate", filters.typeDate);
  if (filters.du) params.set("du", filters.du);
  if (filters.au) params.set("au", filters.au);
  if (filters.codeClient.trim()) params.set("client", filters.codeClient.trim());
  if (filters.compagnieId !== "ALL") params.set("compagnieId", filters.compagnieId);
  if (filters.numeroPolice.trim()) params.set("numeroPolice", filters.numeroPolice.trim());
  if (filters.clientId) params.set("clientId", filters.clientId);
  return params;
}

export function contractPageFromSearchParams(searchParams: URLSearchParams) {
  const value = Number(searchParams.get("page"));
  return Number.isInteger(value) && value > 0 ? value - 1 : 0;
}

export function contractSearchParams(filters: ContractFilters, page: number) {
  const params = contractFiltersToSearchParams(filters);
  if (page > 0) params.set("page", String(page + 1));
  return params;
}
