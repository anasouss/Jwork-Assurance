type QueryParams = Record<string, unknown> | null | undefined;

export const referenceKeys = {
  all: ["referentiel"] as const,
  lists: () => [...referenceKeys.all, "list"] as const,
  list: (resource: string, params?: QueryParams) => [...referenceKeys.lists(), resource, params ?? {}] as const,
};

export const contractKeys = {
  all: ["contrats"] as const,
  lists: () => [...contractKeys.all, "list"] as const,
  list: (params?: QueryParams) => [...contractKeys.lists(), params ?? {}] as const,
  prospections: (params?: QueryParams) => [...contractKeys.all, "prospections", params ?? {}] as const,
  details: () => [...contractKeys.all, "detail"] as const,
  detail: (id: string, params?: QueryParams) => [...contractKeys.details(), id, params ?? {}] as const,
  dueDates: (params?: QueryParams) => [...contractKeys.all, "due-dates", params ?? {}] as const,
};

export const accountingKeys = {
  all: ["compta"] as const,
  quittanceAllocations: (params?: QueryParams) => [...accountingKeys.all, "quittance-allocations", params ?? {}] as const,
};

export const amendmentKeys = {
  all: ["avenant"] as const,
  context: (contractId: string) => [...amendmentKeys.all, contractId, "context"] as const,
  detail: (contractId: string, movementId: string) => [...amendmentKeys.all, contractId, "detail", movementId] as const,
  draft: (contractId: string, code: string) => [...amendmentKeys.all, contractId, "draft", code] as const,
  rectification: (contractId: string, movementId: string) => [...amendmentKeys.all, contractId, "rectification", movementId] as const,
};

export const attestationStockKeys = {
  all: ["attestations-stock"] as const,
  dashboard: () => [...attestationStockKeys.all, "dashboard"] as const,
  searches: () => [...attestationStockKeys.all, "search"] as const,
  search: (params?: QueryParams) => [...attestationStockKeys.searches(), params ?? {}] as const,
  deliveries: () => ["livraisons-attestations"] as const,
  deliveryList: (source: string) => [...attestationStockKeys.deliveries(), source] as const,
};
