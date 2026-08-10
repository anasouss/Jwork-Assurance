import { apiFetch, buildQueryString } from "@/lib/api/base";
import type { ApiResponse, GrilleTarifaireCatalogueItem, ReferenceOption } from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export const referenceApi = {
  async list(path: string, params?: Record<string, string | undefined>): Promise<ReferenceOption[]> {
    return normalizeReferenceOptions(
      unwrap(
        await apiFetch<ApiResponse<ReferenceOption[]>>(
          `/api/v1/referentiel/${path}${buildQueryString(params ?? {})}`,
        ),
      ),
    );
  },

  async pricingLines(params: { grilleId?: string; usageId?: string; garantieId?: string }) {
    return normalizeReferenceOptions(
      unwrap(
        await apiFetch<ApiResponse<ReferenceOption[]>>(
          `/api/v1/referentiel/lignes-grille-tarifaire${buildQueryString(params)}`,
        ),
      ),
    );
  },

  async personGuaranteeFormulas(params: { grilleId?: string; usageId?: string; garantieId?: string }) {
    return normalizeReferenceOptions(
      unwrap(
        await apiFetch<ApiResponse<ReferenceOption[]>>(
          `/api/v1/referentiel/formules-garantie-personne${buildQueryString(params)}`,
        ),
      ),
    );
  },

  async configuredGuarantees() {
    return normalizeReferenceOptions(
      unwrap(
        await apiFetch<ApiResponse<ReferenceOption[]>>(
          "/api/v1/referentiel/garanties/parametrage",
        ),
      ),
    );
  },

  async pricingGridCatalogue(params: Record<string, string | undefined>) {
    const items = unwrap(
      await apiFetch<ApiResponse<GrilleTarifaireCatalogueItem[]>>(
        `/api/v1/referentiel/grilles-tarifaires/catalogue${buildQueryString(params)}`,
      ),
    );
    return items.map((item) => ({
      ...item,
      id: String(item.id),
      compagnieAssuranceId: String(item.compagnieAssuranceId),
      conventions: item.conventions.map((convention) => ({ ...convention, id: String(convention.id) })),
      usages: item.usages.map((usage) => ({ ...usage, id: String(usage.id) })),
    }));
  },
};

function normalizeReferenceOptions(options: ReferenceOption[]) {
  return options.map(normalizeReferenceOption);
}

function normalizeReferenceOption(option: ReferenceOption): ReferenceOption {
  return Object.fromEntries(
    Object.entries(option).map(([key, value]) => [key, normalizeReferenceValue(key, value)]),
  ) as ReferenceOption;
}

function normalizeReferenceValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (key === "id" || key.endsWith("Id")) return String(value);
  if (key.endsWith("Ids") && Array.isArray(value)) return value.map(String);
  return value;
}
