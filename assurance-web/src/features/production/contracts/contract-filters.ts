import type { TypeContrat } from "../types";

export type ContractFilters = {
  brancheId: "ALL" | string;
  typeContrat: "ALL" | TypeContrat;
  typeAssistance: "ALL" | "Assistance Voyage" | "Assistance Automobile";
  typeDate: "EFFET" | "ECHEANCE";
  du?: string;
  au?: string;
  codeClient: string;
  compagnieId: "ALL" | string;
  produitAssistanceId: "ALL" | string;
  numeroPolice: string;
  clientId: string;
  contratId: string;
};

export const DEFAULT_CONTRACT_FILTERS: ContractFilters = {
  brancheId: "ALL",
  typeContrat: "ALL",
  typeAssistance: "ALL",
  typeDate: "EFFET",
  codeClient: "",
  compagnieId: "ALL",
  produitAssistanceId: "ALL",
  numeroPolice: "",
  clientId: "",
  contratId: "",
};

export function contractFiltersFromSearchParams(searchParams: URLSearchParams): ContractFilters {
  const typeContrat = searchParams.get("typeContrat");
  const typeAssistance = searchParams.get("typeAssistance");
  const typeDate = searchParams.get("typeDate");
  return {
    brancheId: searchParams.get("brancheId") ?? "ALL",
    typeContrat: typeContrat === "PARTICULIER" || typeContrat === "CONVENTION" || typeContrat === "FLOTTE"
      ? typeContrat
      : "ALL",
    typeAssistance: typeAssistance === "Assistance Voyage" || typeAssistance === "Assistance Automobile"
      ? typeAssistance
      : "ALL",
    typeDate: typeDate === "ECHEANCE" ? "ECHEANCE" : "EFFET",
    du: searchParams.get("du") || undefined,
    au: searchParams.get("au") || undefined,
    codeClient: searchParams.get("client") ?? "",
    compagnieId: searchParams.get("compagnieId") ?? "ALL",
    produitAssistanceId: searchParams.get("produitAssistanceId") ?? "ALL",
    numeroPolice: searchParams.get("numeroPolice") ?? "",
    clientId: searchParams.get("clientId") ?? "",
    contratId: searchParams.get("contratId") ?? "",
  };
}

export function contractFiltersToSearchParams(filters: ContractFilters) {
  const params = new URLSearchParams();
  if (filters.brancheId !== "ALL") params.set("brancheId", filters.brancheId);
  if (filters.typeContrat !== "ALL") params.set("typeContrat", filters.typeContrat);
  if (filters.typeAssistance !== "ALL") params.set("typeAssistance", filters.typeAssistance);
  if (filters.typeDate !== "EFFET") params.set("typeDate", filters.typeDate);
  if (filters.du) params.set("du", filters.du);
  if (filters.au) params.set("au", filters.au);
  if (filters.codeClient.trim()) params.set("client", filters.codeClient.trim());
  if (filters.compagnieId !== "ALL") params.set("compagnieId", filters.compagnieId);
  if (filters.produitAssistanceId !== "ALL") params.set("produitAssistanceId", filters.produitAssistanceId);
  if (filters.numeroPolice.trim()) params.set("numeroPolice", filters.numeroPolice.trim());
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.contratId) params.set("contratId", filters.contratId);
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
