import { apiFetch } from "@/lib/api/base";
import type {
  ApiResponse,
  ReferenceOption,
  UpsertCompagnieAssistanceRequest,
  UpsertProduitAssistanceRequest,
  UpsertTarifProduitAssistanceRequest,
} from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export const assistanceProductApi = {
  async createCompany(payload: UpsertCompagnieAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/compagnies-assistance", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateCompany(id: string, payload: UpsertCompagnieAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/compagnies-assistance/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async deleteCompany(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/referentiel/compagnies-assistance/${id}`, {
        method: "DELETE",
      })
    );
  },

  async createProduct(payload: UpsertProduitAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/produits-assistance", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateProduct(id: string, payload: UpsertProduitAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/produits-assistance/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async deleteProduct(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/referentiel/produits-assistance/${id}`, {
        method: "DELETE",
      })
    );
  },

  async listProductRates(productId: string) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption[]>>(`/api/v1/referentiel/produits-assistance/${productId}/tarifs`)
    );
  },

  async createProductRate(productId: string, payload: UpsertTarifProduitAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/produits-assistance/${productId}/tarifs`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateProductRate(productId: string, rateId: string, payload: UpsertTarifProduitAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/produits-assistance/${productId}/tarifs/${rateId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async deleteProductRate(productId: string, rateId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/referentiel/produits-assistance/${productId}/tarifs/${rateId}`, {
        method: "DELETE",
      })
    );
  },
};
