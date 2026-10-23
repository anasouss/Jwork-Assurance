import { apiFetch } from "@/lib/api/base";
import type {
  ApiResponse,
  AssistanceDraftResponse,
  AssistanceAutomobileCreationResponse,
  AssistanceAutomobileQuote,
  CreateAssistanceAutomobileRequest,
} from "../types";
import { unwrapApiResponse as unwrap } from "./response";

export const assistanceAutomobileApi = {
  async saveDraftSection(
    contratId: string | undefined,
    section: "souscripteur" | "proprietaire" | "vehicule",
    request: {
      compagnieAssistanceId: string;
      personne?: CreateAssistanceAutomobileRequest["souscripteur"];
      categorieClientId?: string;
      vehicule?: CreateAssistanceAutomobileRequest["vehicule"];
    },
  ) {
    const path = contratId
      ? `/api/v1/contrats/drafts/${contratId}/assistance-automobile/${section}`
      : `/api/v1/contrats/assistance-automobile/brouillons/${section}`;
    return unwrap(await apiFetch<ApiResponse<AssistanceDraftResponse>>(path, {
      method: contratId ? "PUT" : "POST",
      body: JSON.stringify(request),
    }));
  },

  async quote(request: {
    compagnieAssistanceId: string;
    produitAssistanceId: string;
    categorieClientId: string;
    usageId: string;
    dateSouscription: string;
    dateEffet: string;
    dureeMois: number;
    codePromo?: string;
  }) {
    return unwrap(await apiFetch<ApiResponse<AssistanceAutomobileQuote>>(
      "/api/v1/contrats/assistance-automobile/tarification",
      { method: "POST", body: JSON.stringify(request) },
    ));
  },

  async create(request: CreateAssistanceAutomobileRequest) {
    return unwrap(await apiFetch<ApiResponse<AssistanceAutomobileCreationResponse>>(
      "/api/v1/contrats/assistance-automobile",
      { method: "POST", body: JSON.stringify(request) },
    ));
  },

  async finalizeDraft(contratId: string, request: CreateAssistanceAutomobileRequest) {
    return unwrap(await apiFetch<ApiResponse<AssistanceAutomobileCreationResponse>>(
      `/api/v1/contrats/drafts/${contratId}/assistance-automobile/finaliser`,
      { method: "POST", body: JSON.stringify(request) },
    ));
  },

  async update(contratId: string, request: CreateAssistanceAutomobileRequest) {
    return unwrap(await apiFetch<ApiResponse<AssistanceAutomobileCreationResponse>>(
      `/api/v1/contrats/${contratId}/assistance-automobile`,
      { method: "PUT", body: JSON.stringify(request) },
    ));
  },

  async renew(contratId: string, request: CreateAssistanceAutomobileRequest) {
    return unwrap(await apiFetch<ApiResponse<AssistanceAutomobileCreationResponse>>(
      `/api/v1/contrats/${contratId}/assistance-automobile/renouvellements`,
      { method: "POST", body: JSON.stringify(request) },
    ));
  },
};
