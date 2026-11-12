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
  EtapeSuiviSinistre,
  OpeningDocument,
  SinistreListParams,
  SinistreOpeningRequest,
  SinistreContractOption,
  PagedResponse,
  SinistreDashboard,
  SinistreDetail,
  SinistreDuplicate,
  SinistreGestionnaire,
  SinistreTreasuryAccount,
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
  contracts: (brancheId: string, query: string) =>
    [...sinistreKeys.all, "contracts", brancheId, query] as const,
  duplicates: (contractId: string, vehicleId: string | undefined, date: string) =>
    [...sinistreKeys.all, "duplicates", contractId, vehicleId, date] as const,
  experts: (includeInactive: boolean, villeId?: string) =>
    [...sinistreKeys.all, "experts", includeInactive, villeId] as const,
  garages: (includeInactive: boolean) =>
    [...sinistreKeys.all, "garages", includeInactive] as const,
  managers: () => [...sinistreKeys.all, "managers"] as const,
  treasuryAccounts: () => [...sinistreKeys.all, "treasury-accounts"] as const,
};

export const sinistreApi = {
  async lookupContracts(brancheId: string, query: string) {
    return unwrap(await apiFetch<ApiResponse<SinistreContractOption[]>>(
      `/api/v1/sinistres/contrats${buildQueryString({ brancheId, query })}`,
    ));
  },
  async treasuryAccounts() {
    return unwrap(
      await apiFetch<ApiResponse<SinistreTreasuryAccount[]>>(
        "/api/v1/sinistres/comptes-tresorerie",
      ),
    ).map((item) => ({ ...item, id: String(item.id) }));
  },
  async managers() {
    return unwrap(
      await apiFetch<ApiResponse<SinistreGestionnaire[]>>(
        "/api/v1/sinistres/gestionnaires",
      ),
    ).map((item) => ({ ...item, id: String(item.id) }));
  },
  async dashboard() {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDashboard>>(
        "/api/v1/sinistres/dashboard",
      ),
    );
  },

  exportRegister(params: SinistreListParams) {
    const filters = { ...params };
    delete filters.page;
    delete filters.size;
    return apiFetchBlob(`/api/v1/sinistres/registre/export${buildQueryString(filters)}`);
  },

  async list(params: SinistreListParams) {
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

  async duplicates(contratId: string, vehiculeId: string | undefined, dateSinistre: string) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDuplicate[]>>(
        `/api/v1/sinistres/doublons${buildQueryString({ contratId, vehiculeId, dateSinistre })}`,
      ),
    ).map((item) => ({ ...item, id: String(item.id) }));
  },

  async create(request: object) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>("/api/v1/sinistres", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  },

  async open(request: SinistreOpeningRequest, documents: OpeningDocument[]) {
    const form = new FormData();
    form.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
    form.append("documents", new Blob([JSON.stringify(documents.map((document) => ({
      type: document.type,
      dateDocument: document.dateDocument,
      reference: document.reference,
      commentaire: document.commentaire,
    })))], { type: "application/json" }));
    documents.forEach(({ file }) => form.append("files", file));
    return unwrap(await apiUpload<ApiResponse<SinistreDetail>>("/api/v1/sinistres/ouverture", form));
  },

  async changeStage(id: string, etapeSuivi: EtapeSuiviSinistre, motif: string | undefined, version: number) {
    return unwrap(await apiFetch<ApiResponse<SinistreDetail>>(`/api/v1/sinistres/${id}/etape`, {
      method: "POST",
      body: JSON.stringify({ etapeSuivi, motif, version }),
    }));
  },

  async get(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(`/api/v1/sinistres/${id}`),
    );
  },

  async deleteEarlyClaim(id: string) {
    return apiFetch<ApiResponse<null>>(`/api/v1/sinistres/${id}`, {
      method: "DELETE",
    });
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

  async updateGuarantees(id: string, guarantees: object[]) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/garanties`,
        {
          method: "PUT",
          body: JSON.stringify({ garanties: guarantees }),
        },
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

  async updateParty(id: string, partyId: string, request: object) {
    return unwrap(
      await apiFetch<ApiResponse<SinistreDetail>>(
        `/api/v1/sinistres/${id}/parties/${partyId}`,
        { method: "PUT", body: JSON.stringify(request) },
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
    metadata?: {
      dateDocument?: string;
      reference?: string;
      montant?: string;
      emetteur?: string;
      sinistreGarantieId?: string;
      missionExpertiseId?: string;
      garageId?: string;
    },
  ) {
    const form = new FormData();
    form.append("type", type);
    if (commentaire.trim()) form.append("commentaire", commentaire.trim());
    Object.entries(metadata ?? {}).forEach(([key, value]) => {
      if (value?.trim()) form.append(key, value.trim());
    });
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

  async experts(includeInactive = false, villeId?: string) {
    return unwrap(
      await apiFetch<ApiResponse<Intervenant[]>>(
        `/api/v1/sinistres/referentiels/experts${buildQueryString({ includeInactive, villeId })}`,
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
