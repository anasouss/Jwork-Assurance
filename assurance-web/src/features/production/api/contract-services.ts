import { apiFetch, buildQueryString } from "@/lib/api/base";
import type {
  ApiResponse,
  AssistanceContrat,
  AssistanceContratContext,
  CarteVerte,
  CarteVerteContext,
  UpsertAssistanceContratRequest,
  UpsertCarteVerteRequest,
} from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export const contractServiceApi = {
  async getAssistanceContext(
    contratId: string,
    params?: { mouvementId?: string | null; dateSouscription?: string | null }
  ) {
    return unwrap(
      await apiFetch<ApiResponse<AssistanceContratContext>>(
        `/api/v1/contrats/${contratId}/assistances${buildQueryString({
          mouvementId: params?.mouvementId ?? undefined,
          dateSouscription: params?.dateSouscription ?? undefined,
        })}`
      )
    );
  },

  async saveAssistance(contratId: string, request: UpsertAssistanceContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<AssistanceContrat>>(
        `/api/v1/contrats/${contratId}/assistances`,
        { method: "POST", body: JSON.stringify(request) }
      )
    );
  },

  async deleteAssistance(contratId: string, assistanceId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(
        `/api/v1/contrats/${contratId}/assistances/${assistanceId}`,
        { method: "DELETE" }
      )
    );
  },

  async getCarteVerteContext(
    contratId: string,
    params?: { mouvementId?: string | null }
  ) {
    return unwrap(
      await apiFetch<ApiResponse<CarteVerteContext>>(
        `/api/v1/contrats/${contratId}/cartes-vertes${buildQueryString({
          mouvementId: params?.mouvementId ?? undefined,
        })}`
      )
    );
  },

  async saveCarteVerte(contratId: string, request: UpsertCarteVerteRequest) {
    return unwrap(
      await apiFetch<ApiResponse<CarteVerte>>(`/api/v1/contrats/${contratId}/cartes-vertes`, {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async deleteCarteVerte(contratId: string, carteVerteId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(
        `/api/v1/contrats/${contratId}/cartes-vertes/${carteVerteId}`,
        { method: "DELETE" }
      )
    );
  },
};
