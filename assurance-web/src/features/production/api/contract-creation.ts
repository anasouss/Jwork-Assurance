import { apiFetch } from "@/lib/api/base";
import type {
  ApiResponse,
  ContratSummary,
  CreateContratRequest,
  QuittancePreview,
} from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export const contractCreationApi = {
  async createContrat(request: CreateContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>("/api/v1/contrats", {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async createContratDraft(request: CreateContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>("/api/v1/contrats/drafts", {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async getContratDraft(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/drafts/${id}`)
    );
  },

  async updateContratDraft(id: string, request: CreateContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/drafts/${id}`, {
        method: "PUT",
        body: JSON.stringify(request),
      })
    );
  },

  async saveDraftVehicule(
    id: string,
    index: number,
    vehicule: CreateContratRequest["vehicules"][number]
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(
        `/api/v1/contrats/drafts/${id}/vehicules/${index}`,
        { method: "PUT", body: JSON.stringify(vehicule) }
      )
    );
  },

  async saveDraftVehiculeGaranties(
    id: string,
    index: number,
    garanties: CreateContratRequest["garanties"]
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(
        `/api/v1/contrats/drafts/${id}/vehicules/${index}/garanties`,
        { method: "PUT", body: JSON.stringify(garanties) }
      )
    );
  },

  async saveDraftRemorque(
    id: string,
    index: number,
    remorque: CreateContratRequest["remorques"][number]
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(
        `/api/v1/contrats/drafts/${id}/remorques/${index}`,
        { method: "PUT", body: JSON.stringify(remorque) }
      )
    );
  },

  async saveDraftRemorqueGaranties(
    id: string,
    index: number,
    garanties: CreateContratRequest["garanties"]
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(
        `/api/v1/contrats/drafts/${id}/remorques/${index}/garanties`,
        { method: "PUT", body: JSON.stringify(garanties) }
      )
    );
  },

  async finalizeContratDraft(id: string, request: CreateContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(
        `/api/v1/contrats/drafts/${id}/finaliser`,
        { method: "POST", body: JSON.stringify(request) }
      )
    );
  },

  async previewQuittance(request: CreateContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<QuittancePreview>>("/api/v1/contrats/previsualisation-quittance", {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },
};
