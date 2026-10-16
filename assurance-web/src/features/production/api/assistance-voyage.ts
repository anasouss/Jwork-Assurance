import { apiFetch } from "@/lib/api/base";
import type {
  ApiResponse,
  AssistanceVoyageCreationResponse,
  AssistanceVoyageQuote,
  CreateAssistanceVoyageRequest,
} from "../types";
import { unwrapApiResponse as unwrap } from "./response";

export const assistanceVoyageApi = {
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
    return unwrap(await apiFetch<ApiResponse<AssistanceVoyageCreationResponse>>(
      "/api/v1/contrats/assistance-voyage",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    ));
  },

  async update(contratId: string, request: CreateAssistanceVoyageRequest) {
    return unwrap(await apiFetch<ApiResponse<AssistanceVoyageCreationResponse>>(
      `/api/v1/contrats/${contratId}/assistance-voyage`,
      {
        method: "PUT",
        body: JSON.stringify(request),
      }
    ));
  },
};
