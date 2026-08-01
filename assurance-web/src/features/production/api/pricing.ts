import { apiFetch } from "@/lib/api/base";
import type {
  ApiResponse,
  BulkUpdateTarifUsageRequest,
  ReferenceOption,
  UpsertFormuleGarantiePersonneRequest,
  UpsertGrilleTarifaireRequest,
  UpsertGrilleUsageConfigurationRequest,
  UpsertLigneGrilleTarifaireRequest,
  UpsertTarifUsageRequest,
} from "../types";

import { unwrapApiResponse as unwrap } from "./response";

async function writeReference<T>(path: string, method: "POST" | "PUT", payload: T) {
  return unwrap(
    await apiFetch<ApiResponse<ReferenceOption>>(path, {
      method,
      body: JSON.stringify(payload),
    }),
  );
}

export const pricingApi = {
  createUsageRate: (payload: UpsertTarifUsageRequest) =>
    writeReference("/api/v1/referentiel/tarifs-usage", "POST", payload),
  updateUsageRate: (id: string, payload: UpsertTarifUsageRequest) =>
    writeReference(`/api/v1/referentiel/tarifs-usage/${id}`, "PUT", payload),
  async deleteUsageRate(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/referentiel/tarifs-usage/${id}`, {
        method: "DELETE",
      }),
    );
  },
  async bulkUpdateUsageNetPremium(payload: BulkUpdateTarifUsageRequest) {
    return unwrap(
      await apiFetch<ApiResponse<{ updatedRows: number }>>(
        "/api/v1/referentiel/tarifs-usage/bulk-prime-nette",
        { method: "POST", body: JSON.stringify(payload) },
      ),
    );
  },
  createGrid: (payload: UpsertGrilleTarifaireRequest) =>
    writeReference("/api/v1/referentiel/grilles-tarifaires", "POST", payload),
  updateGrid: (id: string, payload: UpsertGrilleTarifaireRequest) =>
    writeReference(`/api/v1/referentiel/grilles-tarifaires/${id}`, "PUT", payload),
  createGridLine: (gridId: string, payload: UpsertLigneGrilleTarifaireRequest) =>
    writeReference(`/api/v1/referentiel/grilles-tarifaires/${gridId}/lignes`, "POST", payload),
  updateGridLine: (id: string, payload: UpsertLigneGrilleTarifaireRequest) =>
    writeReference(`/api/v1/referentiel/lignes-grille-tarifaire/${id}`, "PUT", payload),
  async replaceUsageConfiguration(
    gridId: string,
    usageId: string,
    payload: UpsertGrilleUsageConfigurationRequest,
  ) {
    return unwrap(
      await apiFetch<ApiResponse<{ lignes: ReferenceOption[]; formulesPersonne: ReferenceOption[] }>>(
        `/api/v1/referentiel/grilles-tarifaires/${gridId}/usages/${usageId}/configuration`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    );
  },
  createPersonGuaranteeFormula: (
    gridId: string,
    payload: UpsertFormuleGarantiePersonneRequest,
  ) => writeReference(
    `/api/v1/referentiel/grilles-tarifaires/${gridId}/formules-personne`,
    "POST",
    payload,
  ),
  updatePersonGuaranteeFormula: (
    id: string,
    payload: UpsertFormuleGarantiePersonneRequest,
  ) => writeReference(
    `/api/v1/referentiel/formules-garantie-personne/${id}`,
    "PUT",
    payload,
  ),
};
