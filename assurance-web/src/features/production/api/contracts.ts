import { apiFetch, apiFetchBlob, buildQueryString } from "@/lib/api/base";
import type {
  ApiResponse,
  ContratListGroup,
  ContratListItem,
  ContratSummary,
  EcheanceAutomobileResponse,
  PagedResponse,
  TypeContrat,
} from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export type ContractListParams = {
  typeContrat?: TypeContrat;
  typeDate?: "EFFET" | "ECHEANCE";
  dateDu?: string;
  dateAu?: string;
  search?: string;
  compagnieId?: string;
  numeroPolice?: string;
  clientId?: string;
  page?: number;
  size?: number;
};

export type ProspectionListParams = {
  compagnieId?: string;
  dateDu?: string;
  dateAu?: string;
  search?: string;
  numeroDevis?: string;
  page?: number;
  size?: number;
};

export const contractApi = {
  async listContrats(params: ContractListParams = {}) {
    return unwrap(
      await apiFetch<ApiResponse<PagedResponse<ContratListGroup>>>(
        `/api/v1/contrats${buildQueryString(params)}`
      )
    );
  },

  async getContrat(contratId: string, params?: { mouvementId?: string | null }) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(
        `/api/v1/contrats/${contratId}${buildQueryString({
          mouvementId: params?.mouvementId ?? undefined,
        })}`
      )
    );
  },

  async downloadFlottePolicyPdf(contratId: string, mouvementId?: string | null) {
    return apiFetchBlob(
      `/api/v1/contrats/${contratId}/police-flotte-pdf${buildQueryString({
        mouvementId: mouvementId ?? undefined,
      })}`
    );
  },

  async createRenouvellementDraft(
    contratId: string,
    modeTermeRenouvellement: "CABINET" | "COMPAGNIE"
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(
        `/api/v1/contrats/${contratId}/renouvellements/brouillon`,
        {
          method: "POST",
          body: JSON.stringify({ modeTermeRenouvellement }),
        }
      )
    );
  },

  async finalizeRenouvellementDraft(
    draftId: string,
    modeTermeRenouvellement: "CABINET" | "COMPAGNIE"
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(
        `/api/v1/contrats/renouvellements/${draftId}/finaliser`,
        {
          method: "POST",
          body: JSON.stringify({ modeTermeRenouvellement }),
        }
      )
    );
  },

  async downloadPreTermePdf(draftId: string, avecPrime: boolean) {
    return apiFetchBlob(
      `/api/v1/contrats/renouvellements/${draftId}/pre-terme-pdf${buildQueryString({ avecPrime })}`
    );
  },

  async deleteContrat(contratId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/contrats/${contratId}`, {
        method: "DELETE",
      })
    );
  },

  async deleteMouvement(contratId: string, mouvementId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(
        `/api/v1/contrats/${contratId}/mouvements/${mouvementId}`,
        { method: "DELETE" }
      )
    );
  },

  async searchEcheancesAutomobile(params: {
    dateDu: string;
    dateAu: string;
    compagnieId?: string;
    typeContrat?: TypeContrat;
    search?: string;
    page?: number;
    size?: number;
  }) {
    return unwrap(
      await apiFetch<ApiResponse<EcheanceAutomobileResponse>>(
        `/api/v1/contrats/echeances/automobile${buildQueryString(params)}`
      )
    );
  },

  async exportEcheancesAutomobile(params: {
    dateDu: string;
    dateAu: string;
    compagnieId?: string;
    typeContrat?: TypeContrat;
    search?: string;
  }) {
    return apiFetchBlob(
      `/api/v1/contrats/echeances/automobile/export${buildQueryString(params)}`
    );
  },

  async listProspections(params: ProspectionListParams = {}) {
    return unwrap(
      await apiFetch<ApiResponse<PagedResponse<ContratListItem>>>(
        `/api/v1/contrats/prospections${buildQueryString(params)}`
      )
    );
  },

  async convertProspection(
    contratId: string,
    request: {
      numeroPolice: string;
      vehicules?: { vehiculeId: string; numeroAttestation?: string }[];
      remorques?: { remorqueId: string; numeroAttestation?: string }[];
      assistances?: { assistanceId: string; numeroContratOuQuittance?: string }[];
    }
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(
        `/api/v1/contrats/${contratId}/convertir-prospection`,
        { method: "POST", body: JSON.stringify(request) }
      )
    );
  },

  async downloadDevisPdf(
    contratId: string,
    filter?: { vehiculeIds?: string[]; usageIds?: string[] }
  ) {
    return apiFetchBlob(`/api/v1/contrats/${contratId}/devis-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filter ?? {}),
    });
  },
};
