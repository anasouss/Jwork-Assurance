import {
  apiFetch,
  apiFetchBlob,
  apiUpload,
  buildQueryString,
} from "@/lib/api/base";
import type { ApiResponse } from "@/lib/types";
import type {
  CoveragePreview,
  Intervenant,
  NatureSinistre,
  PagedResponse,
  SinistreDashboard,
  SinistreDetail,
  SinistreSummary,
  StatutSinistre,
  TypeDocument,
} from "./types";

const unwrap = <T>(response: ApiResponse<T>) => response.data;

export const sinistreKeys = {
  all: ["sinistres"] as const,
  dashboard: () => [...sinistreKeys.all, "dashboard"] as const,
  lists: () => [...sinistreKeys.all, "list"] as const,
  list: (params: object) => [...sinistreKeys.lists(), params] as const,
  detail: (id: string) => [...sinistreKeys.all, "detail", id] as const,
  coverage: (contractId: string, date: string) =>
    [...sinistreKeys.all, "coverage", contractId, date] as const,
  experts: (includeInactive: boolean) =>
    [...sinistreKeys.all, "experts", includeInactive] as const,
  garages: (includeInactive: boolean) =>
    [...sinistreKeys.all, "garages", includeInactive] as const,
};

export const sinistreApi = {
  async dashboard() {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDashboard>>(
        "/api/v1/sinistres/dashboard",
      ),
    );
  },

  async list(params: {
    query?: string;
    clientId?: string;
    statut?: StatutSinistre;
    nature?: NatureSinistre;
    dateDu?: string;
    dateAu?: string;
    page: number;
    size: number;
  }) {
    return unwrap(
      await apiFetch<ApiResponse<PagedResponse<SinistreSummary>>>(
        `/api/v1/sinistres${buildQueryString(params)}`,
      ),
    );
  },

  async coverage(contratId: string, dateSinistre: string) {
    return unwrap(
      await apiFetch<ApiResponse<CoveragePreview>>(
        `/api/v1/sinistres/couverture${buildQueryString({ contratId, dateSinistre })}`,
      ),
    );
  },

  async create(request: object) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>("/api/v1/sinistres", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  },

  async get(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(`/api/v1/sinistres/${id}`),
    );
  },

  async update(id: string, request: object) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(`/api/v1/sinistres/${id}`, {
        method: "PUT",
        body: JSON.stringify(request),
      }),
    );
  },

  async transition(id: string, statut: StatutSinistre, motif?: string) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/transition`,
        {
          method: "POST",
          body: JSON.stringify({ statut, motif }),
        },
      ),
    );
  },

  async updateGuarantee(id: string, guaranteeId: string, request: object) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/garanties/${guaranteeId}`,
        { method: "PUT", body: JSON.stringify(request) },
      ),
    );
  },

  async addParty(id: string, request: object) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/parties`,
        {
          method: "POST",
          body: JSON.stringify(request),
        },
      ),
    );
  },

  async deleteParty(id: string, partyId: string) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/parties/${partyId}`,
        { method: "DELETE" },
      ),
    );
  },

  async addProvision(id: string, request: object) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/provisions`,
        {
          method: "POST",
          body: JSON.stringify(request),
        },
      ),
    );
  },

  async addOperation(id: string, request: object) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/operations`,
        {
          method: "POST",
          body: JSON.stringify(request),
        },
      ),
    );
  },

  async cancelOperation(id: string, operationId: string, motif?: string) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/operations/${operationId}/annulation${buildQueryString({ motif })}`,
        { method: "POST" },
      ),
    );
  },

  async saveMission(id: string, missionId: string | null, request: object) {
    const path = missionId
      ? `/api/v1/sinistres/${id}/missions/${missionId}`
      : `/api/v1/sinistres/${id}/missions`;
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(path, {
        method: missionId ? "PUT" : "POST",
        body: JSON.stringify(request),
      }),
    );
  },

  async uploadDocument(
    id: string,
    type: TypeDocument,
    commentaire: string,
    file: File,
  ) {
    const form = new FormData();
    form.append("type", type);
    if (commentaire.trim()) form.append("commentaire", commentaire.trim());
    form.append("file", file);
    return unwrap(
      await apiUpload<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/documents`,
        form,
      ),
    );
  },

  async reviewDocument(
    id: string,
    documentId: string,
    statut: "VALIDE" | "REJETE",
    commentaire?: string,
  ) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/documents/${documentId}/statut${buildQueryString({ statut, commentaire })}`,
        { method: "PUT" },
      ),
    );
  },

  downloadDocument(id: string, documentId: string) {
    return apiFetchBlob(
      `/api/v1/sinistres/${id}/documents/${documentId}/download`,
    );
  },

  async deleteDocument(id: string, documentId: string) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/documents/${documentId}`,
        { method: "DELETE" },
      ),
    );
  },

  async experts(includeInactive = false) {
    return unwrap(
      await apiFetch<ApiResponse<Intervenant[]>>(
        `/api/v1/sinistres/referentiels/experts${buildQueryString({ includeInactive })}`,
      ),
    );
  },

  async garages(includeInactive = false) {
    return unwrap(
      await apiFetch<ApiResponse<Intervenant[]>>(
        `/api/v1/sinistres/referentiels/garages${buildQueryString({ includeInactive })}`,
      ),
    );
  },

  async saveExpert(id: string | null, request: object) {
    return unwrap(
      await apiFetch<ApiResponse<Intervenant>>(
        id
          ? `/api/v1/sinistres/referentiels/experts/${id}`
          : "/api/v1/sinistres/referentiels/experts",
        { method: id ? "PUT" : "POST", body: JSON.stringify(request) },
      ),
    );
  },

  async saveGarage(id: string | null, request: object) {
    return unwrap(
      await apiFetch<ApiResponse<Intervenant>>(
        id
          ? `/api/v1/sinistres/referentiels/garages/${id}`
          : "/api/v1/sinistres/referentiels/garages",
        { method: id ? "PUT" : "POST", body: JSON.stringify(request) },
      ),
    );
  },
};
