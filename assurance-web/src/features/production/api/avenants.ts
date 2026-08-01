import { apiFetch, buildQueryString } from "@/lib/api/base";
import type {
  ApiResponse,
  AvenantContext,
  AvenantDetail,
  AvenantDraft,
  AvenantRequest,
  QuittancePreview,
} from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export const avenantApi = {
  async getAvenantContext(contratId: string) {
    return unwrap(await apiFetch<ApiResponse<AvenantContext>>(`/api/v1/contrats/${contratId}/avenants/context`));
  },

  async getAvenantDetail(contratId: string, mouvementId: string) {
    return unwrap(await apiFetch<ApiResponse<AvenantDetail>>(`/api/v1/contrats/${contratId}/avenants/${mouvementId}`));
  },

  async getAvenantDraft(contratId: string, codeTypeMouvement: string) {
    return unwrap(
      await apiFetch<ApiResponse<AvenantDraft | null>>(
        `/api/v1/contrats/${contratId}/avenants/${encodeURIComponent(codeTypeMouvement)}/brouillon`
      )
    );
  },

  async saveAvenantDraft(contratId: string, request: AvenantRequest) {
    return unwrap(
      await apiFetch<ApiResponse<AvenantDraft>>(
        `/api/v1/contrats/${contratId}/avenants/${encodeURIComponent(request.codeTypeMouvement)}/brouillon`,
        { method: "PUT", body: JSON.stringify(request) }
      )
    );
  },

  async deleteAvenantDraft(contratId: string, codeTypeMouvement: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(
        `/api/v1/contrats/${contratId}/avenants/${encodeURIComponent(codeTypeMouvement)}/brouillon`,
        { method: "DELETE" }
      )
    );
  },

  async previewAvenant(contratId: string, request: AvenantRequest, mouvementId?: string | null) {
    return unwrap(
      await apiFetch<ApiResponse<QuittancePreview>>(
        `/api/v1/contrats/${contratId}/avenants/${encodeURIComponent(request.codeTypeMouvement)}/preview${buildQueryString({ mouvementId })}`,
        { method: "POST", body: JSON.stringify(request) }
      )
    );
  },

  async createAvenant(contratId: string, request: AvenantRequest) {
    return unwrap(
      await apiFetch<ApiResponse<QuittancePreview>>(
        `/api/v1/contrats/${contratId}/avenants/${encodeURIComponent(request.codeTypeMouvement)}`,
        { method: "POST", body: JSON.stringify(request) }
      )
    );
  },

  async getAvenantRectification(contratId: string, mouvementId: string) {
    return unwrap(
      await apiFetch<ApiResponse<AvenantRequest>>(
        `/api/v1/contrats/${contratId}/avenants/${mouvementId}/rectification`
      )
    );
  },

  async rectifyAvenant(contratId: string, mouvementId: string, request: AvenantRequest) {
    return unwrap(
      await apiFetch<ApiResponse<QuittancePreview>>(
        `/api/v1/contrats/${contratId}/avenants/${mouvementId}/${encodeURIComponent(request.codeTypeMouvement)}/rectification`,
        { method: "PUT", body: JSON.stringify(request) }
      )
    );
  },
};
