import { apiFetch, apiFetchBlob, apiUpload, buildQueryString } from "@/lib/api/base";
import type {
  ApiResponse,
  AssistanceContrat,
  AssistanceContratContext,
  AddLotAttestationRequest,
  AttestationStockDashboard,
  AttestationStockItem,
  AttestationStockStatus,
  AttestationNumeroValidation,
  ContratSummary,
  CreateLivraisonAttestationRequest,
  CreateContratRequest,
  ClientResponse,
  ElementFacturable,
  EcheanceAutomobileResponse,
  AvenantContext,
  AvenantRequest,
  LivraisonAttestation,
  PieceJointe,
  PiecesJointesContrat,
  QuittancePreview,
  ReferenceOption,
  TypeContrat,
  TypePieceJointe,
  UpsertGrilleTarifaireRequest,
  UpsertGrilleUsageConfigurationRequest,
  UpsertGroupeUsageAttestationRequest,
  BulkUpdateTarifUsageRequest,
  CarteVerte,
  CarteVerteContext,
  UpsertCompagnieAssuranceRequest,
  UpsertCompagnieAssistanceRequest,
  UpsertAssistanceContratRequest,
  UpsertCarteVerteRequest,
  UpsertCategorieClientRequest,
  UpsertConventionRequest,
  UpsertFormuleGarantiePersonneRequest,
  UpsertGarantieRequest,
  UpsertTypePieceJointeRequest,
  UpsertLigneGrilleTarifaireRequest,
  UpsertProduitAssistanceRequest,
  UpsertCodeReferenceRequest,
  UpsertReferenceRequest,
  UpsertSeuilStockAttestationRequest,
  UpsertTarifProduitAssistanceRequest,
  UpsertTarifUsageRequest,
  UpsertUsageRequest,
  VehiculeResponse,
} from "./types";

const unwrap = <T>(response: ApiResponse<T>) => response.data;

export const productionApi = {
  async referentiel(path: string, params?: Record<string, string | undefined>): Promise<ReferenceOption[]> {
    return normalizeReferenceOptions(
      unwrap(await apiFetch<ApiResponse<ReferenceOption[]>>(`/api/v1/referentiel/${path}${buildQueryString(params ?? {})}`))
    );
  },

  async lignesGrille(params: { grilleId?: string; usageId?: string; garantieId?: string }) {
    return normalizeReferenceOptions(unwrap(
      await apiFetch<ApiResponse<ReferenceOption[]>>(
        `/api/v1/referentiel/lignes-grille-tarifaire${buildQueryString(params)}`
      )
    ));
  },

  async formulesGarantiePersonne(params: { grilleId?: string; usageId?: string; garantieId?: string }) {
    return normalizeReferenceOptions(unwrap(
      await apiFetch<ApiResponse<ReferenceOption[]>>(
        `/api/v1/referentiel/formules-garantie-personne${buildQueryString(params)}`
      )
    ));
  },

  async garantiesParametrage() {
    return normalizeReferenceOptions(unwrap(await apiFetch<ApiResponse<ReferenceOption[]>>("/api/v1/referentiel/garanties/parametrage")));
  },

  async listTypesPieceJointe(includeInactive = false) {
    return unwrap(
      await apiFetch<ApiResponse<TypePieceJointe[]>>(
        `/api/v1/pieces-jointes/types${buildQueryString({ includeInactive: String(includeInactive) })}`
      )
    );
  },

  async listTypesMouvementPieceJointe() {
    return unwrap(await apiFetch<ApiResponse<ReferenceOption[]>>("/api/v1/pieces-jointes/types-mouvements"));
  },

  async createTypePieceJointe(request: UpsertTypePieceJointeRequest) {
    return unwrap(
      await apiFetch<ApiResponse<TypePieceJointe>>("/api/v1/pieces-jointes/types", {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async updateTypePieceJointe(id: string, request: UpsertTypePieceJointeRequest) {
    return unwrap(
      await apiFetch<ApiResponse<TypePieceJointe>>(`/api/v1/pieces-jointes/types/${id}`, {
        method: "PUT",
        body: JSON.stringify(request),
      })
    );
  },

  async deleteTypePieceJointe(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/pieces-jointes/types/${id}`, {
        method: "DELETE",
      })
    );
  },

  async listContrats() {
    return unwrap(await apiFetch<ApiResponse<ContratSummary[]>>("/api/v1/contrats"));
  },

  async getContrat(contratId: string, params?: { mouvementId?: string | null }) {
    return unwrap(await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/${contratId}${buildQueryString({
      mouvementId: params?.mouvementId ?? undefined,
    })}`));
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
      await apiFetch<ApiResponse<void>>(`/api/v1/contrats/${contratId}/mouvements/${mouvementId}`, {
        method: "DELETE",
      })
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
    return apiFetchBlob(`/api/v1/contrats/echeances/automobile/export${buildQueryString(params)}`);
  },

  async listProspections() {
    return unwrap(await apiFetch<ApiResponse<ContratSummary[]>>("/api/v1/contrats/prospections"));
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
      await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/${contratId}/convertir-prospection`, {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async downloadDevisPdf(contratId: string, filter?: { vehiculeIds?: string[]; usageIds?: string[] }) {
    return apiFetchBlob(`/api/v1/contrats/${contratId}/devis-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filter ?? {}),
    });
  },

  async getAvenantContext(contratId: string) {
    return unwrap(await apiFetch<ApiResponse<AvenantContext>>(`/api/v1/contrats/${contratId}/avenants`));
  },

  async previewAvenant(contratId: string, request: AvenantRequest) {
    return unwrap(
      await apiFetch<ApiResponse<QuittancePreview>>(`/api/v1/contrats/${contratId}/avenants/previsualisation-quittance`, {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async createAvenant(contratId: string, request: AvenantRequest) {
    return unwrap(
      await apiFetch<ApiResponse<QuittancePreview>>(`/api/v1/contrats/${contratId}/avenants`, {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async getAssistanceContext(contratId: string, params?: { mouvementId?: string | null; dateSouscription?: string | null }) {
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
      await apiFetch<ApiResponse<AssistanceContrat>>(`/api/v1/contrats/${contratId}/assistances`, {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async deleteAssistance(contratId: string, assistanceId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/contrats/${contratId}/assistances/${assistanceId}`, {
        method: "DELETE",
      })
    );
  },

  async getCarteVerteContext(contratId: string, params?: { mouvementId?: string | null }) {
    return unwrap(
      await apiFetch<ApiResponse<CarteVerteContext>>(
        `/api/v1/contrats/${contratId}/cartes-vertes${buildQueryString({ mouvementId: params?.mouvementId ?? undefined })}`
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
      await apiFetch<ApiResponse<void>>(`/api/v1/contrats/${contratId}/cartes-vertes/${carteVerteId}`, {
        method: "DELETE",
      })
    );
  },

  async getContratPiecesJointes(contratId: string, mouvementId?: string | null) {
    return unwrap(
      await apiFetch<ApiResponse<PiecesJointesContrat>>(
        `/api/v1/contrats/${contratId}/pieces-jointes${buildQueryString({ mouvementId: mouvementId ?? undefined })}`
      )
    );
  },

  async uploadPieceJointe(contratId: string, payload: { typePieceJointeId: string; mouvementId?: string | null; files: File[] }) {
    const formData = new FormData();
    formData.append("typePieceJointeId", payload.typePieceJointeId);
    if (payload.mouvementId) {
      formData.append("mouvementId", payload.mouvementId);
    }
    payload.files.forEach((file) => formData.append("files", file));
    return unwrap(await apiUpload<ApiResponse<PieceJointe>>(`/api/v1/contrats/${contratId}/pieces-jointes`, formData));
  },

  async downloadPieceJointe(contratId: string, pieceId: string) {
    return apiFetchBlob(`/api/v1/contrats/${contratId}/pieces-jointes/${pieceId}/download`);
  },

  async deletePieceJointe(contratId: string, pieceId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/contrats/${contratId}/pieces-jointes/${pieceId}`, {
        method: "DELETE",
      })
    );
  },

  async searchClient(params: { cin?: string; rc?: string }) {
    return unwrap(await apiFetch<ApiResponse<ClientResponse | null>>(`/api/v1/clients/search${buildQueryString(params)}`));
  },

  async searchVehicule(params: { immatriculation?: string }) {
    return unwrap(await apiFetch<ApiResponse<VehiculeResponse | null>>(`/api/v1/vehicules/search${buildQueryString(params)}`));
  },

  async createContrat(request: CreateContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>("/api/v1/contrats", {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async createContratDraft(request: CreateContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>("/api/v1/contrats/drafts", {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async getContratDraft(id: string) {
    return unwrap(await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/drafts/${id}`));
  },

  async updateContratDraft(id: string, request: CreateContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/drafts/${id}`, {
        method: "PUT",
        body: JSON.stringify(request),
      })
    );
  },

  async saveDraftVehicule(id: string, index: number, vehicule: CreateContratRequest["vehicules"][number]) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/drafts/${id}/vehicules/${index}`, {
        method: "PUT",
        body: JSON.stringify(vehicule),
      })
    );
  },

  async saveDraftVehiculeGaranties(id: string, index: number, garanties: CreateContratRequest["garanties"]) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/drafts/${id}/vehicules/${index}/garanties`, {
        method: "PUT",
        body: JSON.stringify(garanties),
      })
    );
  },

  async saveDraftRemorque(id: string, index: number, remorque: CreateContratRequest["remorques"][number]) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/drafts/${id}/remorques/${index}`, {
        method: "PUT",
        body: JSON.stringify(remorque),
      })
    );
  },

  async saveDraftRemorqueGaranties(id: string, index: number, garanties: CreateContratRequest["garanties"]) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/drafts/${id}/remorques/${index}/garanties`, {
        method: "PUT",
        body: JSON.stringify(garanties),
      })
    );
  },

  async finalizeContratDraft(id: string, request: CreateContratRequest) {
    return unwrap(
      await apiFetch<ApiResponse<ContratSummary>>(`/api/v1/contrats/drafts/${id}/finaliser`, {
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

  async suggestionsAttestation(params: { compagnieAssuranceId?: string; usageId?: string; fragment?: string }) {
    return unwrap(
      await apiFetch<ApiResponse<string[]>>(`/api/v1/attestations-stock/suggestions${buildQueryString(params)}`)
    );
  },

  async validateAttestationNumero(params: {
    compagnieAssuranceId?: string;
    usageId?: string;
    numero?: string;
    numeroCourant?: string;
  }) {
    return unwrap(
      await apiFetch<ApiResponse<AttestationNumeroValidation>>(
        `/api/v1/attestations-stock/validation${buildQueryString(params)}`
      )
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

function normalizeReferenceOptions(options: ReferenceOption[]) {
  return options.map(normalizeReferenceOption);
}

function normalizeReferenceOption(option: ReferenceOption): ReferenceOption {
  return Object.fromEntries(
    Object.entries(option).map(([key, value]) => [key, normalizeReferenceValue(key, value)])
  ) as ReferenceOption;
}

function normalizeReferenceValue(key: string, value: unknown): unknown {
  if (value == null) {
    return value;
  }
  if (key === "id" || key.endsWith("Id")) {
    return String(value);
  }
  if (key.endsWith("Ids") && Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return value;
}
