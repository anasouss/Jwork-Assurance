import { apiFetch, buildQueryString } from "@/lib/api/base";
import type {
  ApiResponse,
  AddLotAttestationRequest,
  ContratSummary,
  CreateLivraisonAttestationRequest,
  CreateContratRequest,
  ClientResponse,
  ElementFacturable,
  LivraisonAttestation,
  QuittancePreview,
  ReferenceOption,
  UpsertGrilleTarifaireRequest,
  UpsertLigneGrilleTarifaireRequest,
} from "./types";

const unwrap = <T>(response: ApiResponse<T>) => response.data;

export const productionApi = {
  async referentiel(path: string): Promise<ReferenceOption[]> {
    return unwrap(await apiFetch<ApiResponse<ReferenceOption[]>>(`/api/v1/referentiel/${path}`));
  },

  async lignesGrille(params: { grilleId?: string; usageId?: string; garantieId?: string }) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption[]>>(
        `/api/v1/referentiel/lignes-grille-tarifaire${buildQueryString(params)}`
      )
    );
  },

  async listContrats() {
    return unwrap(await apiFetch<ApiResponse<ContratSummary[]>>("/api/v1/contrats"));
  },

  async searchClient(params: { cin?: string; rc?: string }) {
    return unwrap(await apiFetch<ApiResponse<ClientResponse | null>>(`/api/v1/clients/search${buildQueryString(params)}`));
  },

  async createContrat(request: CreateContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>("/api/v1/contrats", {
        method: "POST",
        body: JSON.stringify(request),
      })
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

  async listQuittances() {
    return unwrap(await apiFetch<ApiResponse<ElementFacturable[]>>("/api/v1/compta/elements-facturables"));
  },

  async listLivraisonsAttestation(source: "COMMANDE" | "RECEPTION_DIRECTE" = "COMMANDE") {
    return unwrap(
      await apiFetch<ApiResponse<LivraisonAttestation[]>>(
        `/api/v1/attestations-stock/livraisons${buildQueryString({ source })}`
      )
    );
  },

  async createLivraisonAttestation(payload: CreateLivraisonAttestationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<LivraisonAttestation>>("/api/v1/attestations-stock/livraisons", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async addLotAttestation(livraisonId: string, payload: AddLotAttestationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<LivraisonAttestation>>(`/api/v1/attestations-stock/livraisons/${livraisonId}/lots`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async validateLivraisonAttestation(livraisonId: string) {
    return unwrap(
      await apiFetch<ApiResponse<LivraisonAttestation>>(`/api/v1/attestations-stock/livraisons/${livraisonId}/valider`, {
        method: "POST",
      })
    );
  },

  async attestationsDisponibles(params: { contratId: string; usageId: string; fragment: string }) {
    return unwrap(
      await apiFetch<ApiResponse<string[]>>(`/api/v1/attestations-stock/disponibles${buildQueryString(params)}`)
    );
  },

  async createCategorieTransport(payload: { code: string; libelle: string; description?: string; actif?: boolean }) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/categories-transport", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async createGrilleTarifaire(payload: UpsertGrilleTarifaireRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/grilles-tarifaires", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateGrilleTarifaire(id: string, payload: UpsertGrilleTarifaireRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/grilles-tarifaires/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createLigneGrilleTarifaire(grilleId: string, payload: UpsertLigneGrilleTarifaireRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/grilles-tarifaires/${grilleId}/lignes`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateLigneGrilleTarifaire(id: string, payload: UpsertLigneGrilleTarifaireRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/lignes-grille-tarifaire/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },
};
