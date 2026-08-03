import { apiFetch, buildQueryString } from "@/lib/api/base";
import type {
  AddLotAttestationRequest,
  AddLotsAttestationRequest,
  ApiResponse,
  AttestationNumeroValidation,
  AttestationStockDashboard,
  AttestationStockItem,
  AttestationStockStatus,
  PagedResponse,
  CreateLivraisonAttestationRequest,
  LivraisonAttestation,
  SeuilStockAttestation,
  UpsertSeuilStockAttestationRequest,
} from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export const attestationStockApi = {
  async listLivraisonsAttestation(params: {
    source?: "COMMANDE" | "RECEPTION_DIRECTE";
    compagnieAssuranceId?: string;
    annee?: string;
  } = {}) {
    return unwrap(
      await apiFetch<ApiResponse<LivraisonAttestation[]>>(
        `/api/v1/attestations-stock/livraisons${buildQueryString({
          source: params.source ?? "COMMANDE",
          compagnieAssuranceId: params.compagnieAssuranceId,
          annee: params.annee,
        })}`
      )
    );
  },

  async createLivraisonAttestation(payload: CreateLivraisonAttestationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<LivraisonAttestation>>(
        "/api/v1/attestations-stock/livraisons",
        { method: "POST", body: JSON.stringify(payload) }
      )
    );
  },

  async addLotAttestation(livraisonId: string, payload: AddLotAttestationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<LivraisonAttestation>>(
        `/api/v1/attestations-stock/livraisons/${livraisonId}/lots`,
        { method: "POST", body: JSON.stringify(payload) }
      )
    );
  },

  async addLotsAttestation(livraisonId: string, payload: AddLotsAttestationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<LivraisonAttestation>>(
        `/api/v1/attestations-stock/livraisons/${livraisonId}/reception`,
        { method: "POST", body: JSON.stringify(payload) }
      )
    );
  },

  async validateLivraisonAttestation(livraisonId: string) {
    return unwrap(
      await apiFetch<ApiResponse<LivraisonAttestation>>(
        `/api/v1/attestations-stock/livraisons/${livraisonId}/valider`,
        { method: "POST" }
      )
    );
  },

  async attestationsDisponibles(params: {
    contratId: string;
    usageId: string;
    fragment: string;
  }) {
    return unwrap(
      await apiFetch<ApiResponse<string[]>>(
        `/api/v1/attestations-stock/disponibles${buildQueryString(params)}`
      )
    );
  },

  async suggestionsAttestation(params: {
    compagnieAssuranceId?: string;
    usageId?: string;
    fragment?: string;
  }) {
    return unwrap(
      await apiFetch<ApiResponse<string[]>>(
        `/api/v1/attestations-stock/suggestions${buildQueryString(params)}`
      )
    );
  },

  async validateAttestationNumero(params: {
    compagnieAssuranceId?: string;
    usageId?: string;
    numero?: string;
    numeroCourant?: string;
  }) {
    return unwrap(
      await apiFetch<ApiResponse<AttestationNumeroValidation>>(
        `/api/v1/attestations-stock/validation${buildQueryString(params)}`
      )
    );
  },

  async dashboardAttestationsStock() {
    return unwrap(
      await apiFetch<ApiResponse<AttestationStockDashboard>>(
        "/api/v1/attestations-stock/dashboard"
      )
    );
  },

  async searchAttestationsStock(params: {
    compagnieAssuranceId?: string;
    groupeUsageAttestationId?: string;
    statut?: AttestationStockStatus | "";
    numero?: string;
    page?: number;
    size?: number;
  }) {
    return unwrap(
      await apiFetch<ApiResponse<PagedResponse<AttestationStockItem>>>(
        `/api/v1/attestations-stock/attestations${buildQueryString(params)}`
      )
    );
  },

  async cancelAttestationStock(id: string, payload: { motif: string }) {
    return unwrap(
      await apiFetch<ApiResponse<AttestationStockItem>>(
        `/api/v1/attestations-stock/attestations/${id}/annuler`,
        { method: "POST", body: JSON.stringify(payload) }
      )
    );
  },

  async updateAttestationsStockSettings(payload: { controleStockActif: boolean }) {
    return unwrap(
      await apiFetch<ApiResponse<{ controleStockActif: boolean }>>(
        "/api/v1/attestations-stock/settings",
        { method: "PUT", body: JSON.stringify(payload) }
      )
    );
  },

  async createSeuilStockAttestation(payload: UpsertSeuilStockAttestationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<SeuilStockAttestation>>("/api/v1/attestations-stock/seuils", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateSeuilStockAttestation(
    id: string,
    payload: UpsertSeuilStockAttestationRequest
  ) {
    return unwrap(
      await apiFetch<ApiResponse<SeuilStockAttestation>>(`/api/v1/attestations-stock/seuils/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },
};
