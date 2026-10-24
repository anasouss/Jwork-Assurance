import { apiFetch } from "@/lib/api/base";
import type {
  ApiResponse,
  AssistanceDraftResponse,
  AssistanceVoyageCreationResponse,
  AssistanceVoyageQuote,
  CreateAssistanceVoyageRequest,
} from "../types";
import { unwrapApiResponse as unwrap } from "./response";

export const assistanceVoyageApi = {
  async saveDraftSection(
    contratId: string | undefined,
    section: "souscripteur" | "assures",
    request: {
      compagnieAssistanceId: string;
      produitAssistanceId: string;
      souscripteur?: CreateAssistanceVoyageRequest["souscripteur"];
      assures?: CreateAssistanceVoyageRequest["assures"];
      assureIdentiqueSouscripteur?: boolean;
    },
  ) {
    const path = contratId
      ? `/api/v1/contrats/drafts/${contratId}/assistance-voyage/${section}`
      : `/api/v1/contrats/assistance-voyage/brouillons/${section}`;
    return unwrap(await apiFetch<ApiResponse<AssistanceDraftResponse>>(path, {
      method: contratId ? "PUT" : "POST",
      body: JSON.stringify(request),
    }));
  },

  async quote(request: {
    compagnieAssistanceId: string;
    produitAssistanceId: string;
    dateEffet: string;
    dureeMois: number;
    codePromo?: string;
    datesNaissanceAssures: string[];
  }) {
    return unwrap(await apiFetch<ApiResponse<AssistanceVoyageQuote>>(
      "/api/v1/contrats/assistance-voyage/tarification",
      { method: "POST", body: JSON.stringify(request) }
    ));
  },

  async create(request: CreateAssistanceVoyageRequest) {
    return normalizeCreationResponse(unwrap(await apiFetch<ApiResponse<AssistanceVoyageCreationResponse>>(
      "/api/v1/contrats/assistance-voyage",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    )));
  },

  async finalizeDraft(contratId: string, request: CreateAssistanceVoyageRequest) {
    return normalizeCreationResponse(unwrap(await apiFetch<ApiResponse<AssistanceVoyageCreationResponse>>(
      `/api/v1/contrats/drafts/${contratId}/assistance-voyage/finaliser`,
      { method: "POST", body: JSON.stringify(request) },
    )));
  },

  async update(contratId: string, request: CreateAssistanceVoyageRequest) {
    return normalizeCreationResponse(unwrap(await apiFetch<ApiResponse<AssistanceVoyageCreationResponse>>(
      `/api/v1/contrats/${contratId}/assistance-voyage`,
      {
        method: "PUT",
        body: JSON.stringify(request),
      }
    )));
  },

  async renew(contratId: string, request: CreateAssistanceVoyageRequest) {
    return normalizeCreationResponse(unwrap(await apiFetch<ApiResponse<AssistanceVoyageCreationResponse>>(
      `/api/v1/contrats/${contratId}/assistance-voyage/renouvellements`,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    )));
  },
};

function normalizeCreationResponse(response: AssistanceVoyageCreationResponse): AssistanceVoyageCreationResponse {
  return {
    ...response,
    contratId: String(response.contratId),
    assistanceId: String(response.assistanceId),
  };
}
