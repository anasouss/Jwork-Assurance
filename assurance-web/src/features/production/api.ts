import { apiFetch, buildQueryString } from "@/lib/api/base";
import type {
  ApiResponse,
  AddLotAttestationRequest,
  AttestationStockDashboard,
  AttestationStockItem,
  AttestationStockStatus,
  ContratSummary,
  CreateLivraisonAttestationRequest,
  CreateContratRequest,
  ClientResponse,
  ElementFacturable,
  LivraisonAttestation,
  QuittancePreview,
  ReferenceOption,
  UpsertGrilleTarifaireRequest,
  UpsertGrilleUsageConfigurationRequest,
  UpsertGroupeUsageAttestationRequest,
  BulkUpdateTarifUsageRequest,
  UpsertCompagnieAssuranceRequest,
  UpsertCompagnieAssistanceRequest,
  UpsertCategorieClientRequest,
  UpsertConventionRequest,
  UpsertFormuleGarantiePersonneRequest,
  UpsertGarantieRequest,
  UpsertLigneGrilleTarifaireRequest,
  UpsertProduitAssistanceRequest,
  UpsertCodeReferenceRequest,
  UpsertReferenceRequest,
  UpsertSeuilStockAttestationRequest,
  UpsertTarifProduitAssistanceRequest,
  UpsertTarifUsageRequest,
  UpsertUsageRequest,
} from "./types";

const unwrap = <T>(response: ApiResponse<T>) => response.data;

export const productionApi = {
  async referentiel(path: string, params?: Record<string, string | undefined>): Promise<ReferenceOption[]> {
    return unwrap(await apiFetch<ApiResponse<ReferenceOption[]>>(`/api/v1/referentiel/${path}${buildQueryString(params ?? {})}`));
  },

  async lignesGrille(params: { grilleId?: string; usageId?: string; garantieId?: string }) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption[]>>(
        `/api/v1/referentiel/lignes-grille-tarifaire${buildQueryString(params)}`
      )
    );
  },

  async formulesGarantiePersonne(params: { grilleId?: string; usageId?: string; garantieId?: string }) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption[]>>(
        `/api/v1/referentiel/formules-garantie-personne${buildQueryString(params)}`
      )
    );
  },

  async garantiesParametrage() {
    return unwrap(await apiFetch<ApiResponse<ReferenceOption[]>>("/api/v1/referentiel/garanties/parametrage"));
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

  async dashboardAttestationsStock() {
    return unwrap(await apiFetch<ApiResponse<AttestationStockDashboard>>("/api/v1/attestations-stock/dashboard"));
  },

  async searchAttestationsStock(params: {
    compagnieAssuranceId?: string;
    groupeUsageAttestationId?: string;
    statut?: AttestationStockStatus | "";
    numero?: string;
    limit?: string;
  }) {
    return unwrap(
      await apiFetch<ApiResponse<AttestationStockItem[]>>(`/api/v1/attestations-stock/attestations${buildQueryString(params)}`)
    );
  },

  async updateAttestationsStockSettings(payload: { controleStockActif: boolean }) {
    return unwrap(
      await apiFetch<ApiResponse<{ controleStockActif: boolean }>>("/api/v1/attestations-stock/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createSeuilStockAttestation(payload: UpsertSeuilStockAttestationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<unknown>>("/api/v1/attestations-stock/seuils", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateSeuilStockAttestation(id: string, payload: UpsertSeuilStockAttestationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<unknown>>(`/api/v1/attestations-stock/seuils/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
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

  async updateCategorieTransport(id: string, payload: { code: string; libelle: string; description?: string; actif?: boolean }) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/categories-transport/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createCategorieClient(payload: UpsertCategorieClientRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/categories-client", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateCategorieClient(id: string, payload: UpsertCategorieClientRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/categories-client/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createTarifUsage(payload: UpsertTarifUsageRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/tarifs-usage", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateTarifUsage(id: string, payload: UpsertTarifUsageRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/tarifs-usage/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async deleteTarifUsage(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/referentiel/tarifs-usage/${id}`, {
        method: "DELETE",
      })
    );
  },

  async bulkUpdateTarifUsagePrimeNette(payload: BulkUpdateTarifUsageRequest) {
    return unwrap(
      await apiFetch<ApiResponse<{ updatedRows: number }>>("/api/v1/referentiel/tarifs-usage/bulk-prime-nette", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async createCompagnieAssurance(payload: UpsertCompagnieAssuranceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/compagnies-assurance", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateCompagnieAssurance(id: string, payload: UpsertCompagnieAssuranceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/compagnies-assurance/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createCompagnieAssistance(payload: UpsertCompagnieAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/compagnies-assistance", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateCompagnieAssistance(id: string, payload: UpsertCompagnieAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/compagnies-assistance/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async deleteCompagnieAssistance(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/referentiel/compagnies-assistance/${id}`, {
        method: "DELETE",
      })
    );
  },

  async createProduitAssistance(payload: UpsertProduitAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/produits-assistance", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateProduitAssistance(id: string, payload: UpsertProduitAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/produits-assistance/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async deleteProduitAssistance(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/referentiel/produits-assistance/${id}`, {
        method: "DELETE",
      })
    );
  },

  async listTarifsProduitAssistance(produitId: string) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption[]>>(`/api/v1/referentiel/produits-assistance/${produitId}/tarifs`)
    );
  },

  async createTarifProduitAssistance(produitId: string, payload: UpsertTarifProduitAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/produits-assistance/${produitId}/tarifs`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateTarifProduitAssistance(produitId: string, tarifId: string, payload: UpsertTarifProduitAssistanceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/produits-assistance/${produitId}/tarifs/${tarifId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async deleteTarifProduitAssistance(produitId: string, tarifId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/referentiel/produits-assistance/${produitId}/tarifs/${tarifId}`, {
        method: "DELETE",
      })
    );
  },

  async createConvention(payload: UpsertConventionRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/conventions", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateConvention(id: string, payload: UpsertConventionRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/conventions/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createUsage(payload: UpsertUsageRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/usages", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateUsage(id: string, payload: UpsertUsageRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/usages/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createGroupeUsageAttestation(payload: UpsertGroupeUsageAttestationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/groupes-usage-attestation", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateGroupeUsageAttestation(id: string, payload: UpsertGroupeUsageAttestationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/groupes-usage-attestation/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createGarantie(payload: UpsertGarantieRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/garanties", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateGarantie(id: string, payload: UpsertGarantieRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/garanties/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createMarque(payload: UpsertReferenceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/marques", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateMarque(id: string, payload: UpsertReferenceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/marques/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createCarrosserie(payload: UpsertReferenceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/carrosseries", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateCarrosserie(id: string, payload: UpsertReferenceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/carrosseries/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createCarburant(payload: UpsertCodeReferenceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/carburants", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateCarburant(id: string, payload: UpsertCodeReferenceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/carburants/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },

  async createSousClasse(payload: UpsertCodeReferenceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>("/api/v1/referentiel/sous-classes", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateSousClasse(id: string, payload: UpsertCodeReferenceRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/sous-classes/${id}`, {
        method: "PUT",
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

  async replaceGrilleUsageConfiguration(grilleId: string, usageId: string, payload: UpsertGrilleUsageConfigurationRequest) {
    return unwrap(
      await apiFetch<ApiResponse<{ lignes: ReferenceOption[]; formulesPersonne: ReferenceOption[] }>>(
        `/api/v1/referentiel/grilles-tarifaires/${grilleId}/usages/${usageId}/configuration`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      )
    );
  },

  async createFormuleGarantiePersonne(grilleId: string, payload: UpsertFormuleGarantiePersonneRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/grilles-tarifaires/${grilleId}/formules-personne`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  },

  async updateFormuleGarantiePersonne(id: string, payload: UpsertFormuleGarantiePersonneRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/formules-garantie-personne/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
  },
};
