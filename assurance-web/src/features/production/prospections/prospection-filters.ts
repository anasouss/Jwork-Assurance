export type ProspectionFilters = {
  compagnieId: "ALL" | string;
  du?: string;
  au?: string;
  codeClient: string;
  numeroDevis: string;
};

export const DEFAULT_PROSPECTION_FILTERS: ProspectionFilters = {
  compagnieId: "ALL",
  codeClient: "",
  numeroDevis: "",
};

export function prospectionFiltersFromSearchParams(searchParams: URLSearchParams): ProspectionFilters {
  return {
    compagnieId: searchParams.get("compagnieId") ?? "ALL",
    du: searchParams.get("du") || undefined,
    au: searchParams.get("au") || undefined,
    codeClient: searchParams.get("client") ?? "",
    numeroDevis: searchParams.get("numeroDevis") ?? "",
  };
}

export function prospectionPageFromSearchParams(searchParams: URLSearchParams) {
  const value = Number(searchParams.get("page"));
  return Number.isInteger(value) && value > 0 ? value - 1 : 0;
}

export function prospectionSearchParams(filters: ProspectionFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.compagnieId !== "ALL") params.set("compagnieId", filters.compagnieId);
  if (filters.du) params.set("du", filters.du);
  if (filters.au) params.set("au", filters.au);
  if (filters.codeClient.trim()) params.set("client", filters.codeClient.trim());
  if (filters.numeroDevis.trim()) params.set("numeroDevis", filters.numeroDevis.trim());
  if (page > 0) params.set("page", String(page + 1));
  return params;
}
