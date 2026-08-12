import { apiFetch, apiFetchBlob, apiUpload, buildQueryString } from "@/lib/api/base";
import type { ApiResponse } from "@/lib/types";
import type {
  AllocationRequest,
  BatchAllocationRequest,
  BatchAllocationResponse,
  BankStatementImport,
  BankStatementImportConfiguration,
  BankStatementImportPage,
  BankStatementImportProfile,
  ClientDocument,
  ClientDocumentPage,
  ClientDocumentSourcePage,
  ClientDocumentStatus,
  ClientDocumentType,
  ConventionBillingPage,
  ConventionBillingStatus,
  CreateConventionInvoiceRequest,
  CreateClientDocumentRequest,
  ClientPayment,
  ClientPaymentPage,
  ClientReceivable,
  ClientReceivablePage,
  CompanyBordereau,
  CompanyBordereauBase,
  CompanyBordereauPage,
  CompanyBordereauSource,
  CompanyBordereauStatus,
  CompanyPayment,
  CreateCompanyPaymentRequest,
  CreateClientPaymentRequest,
  ImportPreview,
  QuittanceAllocation,
  QuittancePage,
  ReferenceOption,
  Rule,
  RulePage,
  RuleRequest,
  TypeContrat,
  PaymentInstrument,
  PaymentInstrumentPage,
  ReplacePaymentInstrumentRequest,
  TreasuryAccount,
  TreasuryAccountAssignment,
  TreasuryAccessLevel,
  TreasuryUser,
  CashSession,
  TreasuryOperation,
  TreasuryOperationPage,
  TreasuryOperationType,
  CreateTreasuryTransferRequest,
  CreateTreasuryAdjustmentRequest,
  TreasuryMovement,
  TreasuryMovementPage,
  UpsertCompanyBordereauRequest,
  UpsertTreasuryAccountRequest,
  SaveBankReconciliationsRequest,
} from "./types";

const unwrap = <T,>(response: ApiResponse<T>) => response.data;

export const comptaApi = {
  async companies() {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption[]>>("/api/v1/referentiel/compagnies-assurance")
    ).map(normalizeReference);
  },

  async insuranceBranches() {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption[]>>("/api/v1/referentiel/branches-assurance")
    ).map(normalizeReference);
  },

  async conventionBillingInstallments(params: {
    statut?: ConventionBillingStatus;
    dateDu?: string;
    dateAu?: string;
    compagnieId?: string;
    conventionId?: string;
    payeurId?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    const result = unwrap(
      await apiFetch<ApiResponse<ConventionBillingPage>>(
        `/api/v1/compta/facturation-conventions/echeances${buildQueryString(params)}`
      )
    );
    return {
      ...result,
      rows: result.rows.map((row) => ({
        ...row,
        id: String(row.id),
        contratId: String(row.contratId),
        documentId: row.documentId == null ? null : String(row.documentId),
        payeurId: String(row.payeurId),
        compagnieId: row.compagnieId == null ? null : String(row.compagnieId),
        conventionId: row.conventionId == null ? null : String(row.conventionId),
      })),
    };
  },

  async createConventionInvoice(request: CreateConventionInvoiceRequest) {
    return normalizeClientDocument(
      unwrap(await apiFetch<ApiResponse<ClientDocument>>(
        "/api/v1/compta/facturation-conventions/factures",
        { method: "POST", body: JSON.stringify(request) }
      ))
    );
  },

  async searchQuittances(params: {
    compagnieId?: string;
    typeContrat?: TypeContrat;
    avecQuittance?: boolean;
    dateDu?: string;
    dateAu?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    const page = unwrap(
      await apiFetch<ApiResponse<QuittancePage>>(
        `/api/v1/compta/quittances${buildQueryString(params)}`
      )
    );
    return { ...page, rows: page.rows.map(normalizeAllocation) };
  },

  async exportQuittances(params: {
    compagnieId?: string;
    typeContrat?: TypeContrat;
    avecQuittance?: boolean;
    dateDu?: string;
    dateAu?: string;
    search?: string;
  }) {
    return apiFetchBlob(`/api/v1/compta/quittances/export${buildQueryString(params)}`);
  },

  async allocation(quittanceId: string, avecRetenue?: boolean) {
    return normalizeAllocation(unwrap(
      await apiFetch<ApiResponse<QuittanceAllocation>>(
        `/api/v1/compta/quittances/${quittanceId}/affectation${buildQueryString({
          avecRetenue,
        })}`
      )
    ));
  },

  async saveAllocation(quittanceId: string, request: AllocationRequest) {
    return normalizeAllocation(unwrap(
      await apiFetch<ApiResponse<QuittanceAllocation>>(
        `/api/v1/compta/quittances/${quittanceId}/affectation`,
        {
          method: "PUT",
          body: JSON.stringify(request),
        }
      )
    ));
  },

  async clearAllocation(quittanceId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(
        `/api/v1/compta/quittances/${quittanceId}/affectation`,
        { method: "DELETE" }
      )
    );
  },

  async saveBatchAllocation(request: BatchAllocationRequest) {
    const response = unwrap(
      await apiFetch<ApiResponse<BatchAllocationResponse>>(
        "/api/v1/compta/quittances/affectations/lot",
        { method: "PUT", body: JSON.stringify(request) }
      )
    );
    return {
      ...response,
      quittances: response.quittances.map(normalizeAllocation),
      lignes: response.lignes.map(normalizeAllocationLine),
    };
  },

  async previewImport(quittanceId: string, file: File, avecRetenue: boolean) {
    const data = new FormData();
    data.append("file", file);
    const preview = unwrap(
      await apiUpload<ApiResponse<ImportPreview>>(
        `/api/v1/compta/quittances/${quittanceId}/imports/previsualisation${buildQueryString({
          avecRetenue,
        })}`,
        data
      )
    );
    return {
      ...preview,
      lignes: preview.lignes.map((line) => ({
        ...line,
        id: line.id == null ? undefined : String(line.id),
      })),
    };
  },

  async previewBatchImport(quittanceIds: string[], file: File, avecRetenue: boolean) {
    const data = new FormData();
    data.append("file", file);
    const preview = unwrap(
      await apiUpload<ApiResponse<ImportPreview>>(
        `/api/v1/compta/quittances/affectations/lot/imports/previsualisation${buildQueryString({
          quittanceIds,
          avecRetenue,
        })}`,
        data
      )
    );
    return { ...preview, lignes: preview.lignes.map(normalizeAllocationLine) };
  },

  async rules(params: { page: number; size: number }) {
    const result = unwrap(
      await apiFetch<ApiResponse<RulePage>>(
        `/api/v1/compta/regles-quittances${buildQueryString(params)}`
      )
    );
    return { ...result, rows: result.rows.map(normalizeRule) };
  },

  async createRule(request: RuleRequest) {
    return normalizeRule(unwrap(
      await apiFetch<ApiResponse<Rule>>("/api/v1/compta/regles-quittances", {
        method: "POST",
        body: JSON.stringify(request),
      })
    ));
  },

  async updateRule(id: string, request: RuleRequest) {
    return normalizeRule(unwrap(
      await apiFetch<ApiResponse<Rule>>(`/api/v1/compta/regles-quittances/${id}`, {
        method: "PUT",
        body: JSON.stringify(request),
      })
    ));
  },

  async deleteRule(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/compta/regles-quittances/${id}`, {
        method: "DELETE",
      })
    );
  },

  async searchClientDocumentSources(params: {
    payeurType?: "CLIENT" | "GROUPE";
    payeurId?: string;
    brancheId?: string;
    typeContrat?: TypeContrat;
    dateDu?: string;
    dateAu?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    const result = unwrap(
      await apiFetch<ApiResponse<ClientDocumentSourcePage>>(
        `/api/v1/compta/documents-clients/sources${buildQueryString(params)}`
      )
    );
    return {
      ...result,
      rows: result.rows.map((row) => ({
        ...row,
        elementFacturableId: String(row.elementFacturableId),
        quittanceId: row.quittanceId == null ? null : String(row.quittanceId),
        contratId: String(row.contratId),
        mouvementId: row.mouvementId == null ? null : String(row.mouvementId),
        payeurId: String(row.payeurId),
        souscripteurId: row.souscripteurId == null ? null : String(row.souscripteurId),
      })),
    };
  },

  async searchClientDocuments(params: {
    payeurType?: "CLIENT" | "GROUPE";
    payeurId?: string;
    type?: ClientDocumentType;
    statut?: ClientDocumentStatus;
    dateDu?: string;
    dateAu?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    const result = unwrap(
      await apiFetch<ApiResponse<ClientDocumentPage>>(
        `/api/v1/compta/documents-clients${buildQueryString(params)}`
      )
    );
    return { ...result, rows: result.rows.map(normalizeClientDocument) };
  },

  async clientDocument(id: string) {
    return normalizeClientDocument(
      unwrap(
        await apiFetch<ApiResponse<ClientDocument>>(
          `/api/v1/compta/documents-clients/${id}`
        )
      )
    );
  },

  async createClientDocument(request: CreateClientDocumentRequest) {
    return normalizeClientDocument(
      unwrap(
        await apiFetch<ApiResponse<ClientDocument>>("/api/v1/compta/documents-clients", {
          method: "POST",
          body: JSON.stringify(request),
        })
      )
    );
  },

  async cancelClientDocument(id: string, motif: string) {
    return normalizeClientDocument(
      unwrap(
        await apiFetch<ApiResponse<ClientDocument>>(
          `/api/v1/compta/documents-clients/${id}/annulation`,
          {
            method: "POST",
            body: JSON.stringify({ motif }),
          }
        )
      )
    );
  },

  async deleteClientDocument(id: string) {
    await apiFetch<ApiResponse<null>>(`/api/v1/compta/documents-clients/${id}`, {
      method: "DELETE",
    });
  },

  async clientDocumentPdf(id: string, avecSignature = false) {
    return apiFetchBlob(
      `/api/v1/compta/documents-clients/${id}/pdf${buildQueryString({ avecSignature })}`
    );
  },

  async clientReceivables(params: {
    payeurType?: "CLIENT" | "GROUPE";
    payeurId?: string;
    brancheId?: string;
    typeContrat?: TypeContrat;
    dateDu?: string;
    dateAu?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    return normalizeClientReceivablePage(unwrap(await apiFetch<ApiResponse<ClientReceivablePage>>(
      `/api/v1/compta/reglements-clients/creances${buildQueryString(params)}`
    )));
  },

  async clientInvoiceReceivables(params: {
    payeurType?: "CLIENT" | "GROUPE";
    payeurId?: string;
    dateDu?: string;
    dateAu?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    return normalizeClientReceivablePage(unwrap(await apiFetch<ApiResponse<ClientReceivablePage>>(
      `/api/v1/compta/reglements-clients/creances/factures${buildQueryString(params)}`
    )));
  },

  async selectedClientReceivables(request: {
    elementFacturableIds: string[];
    documentClientIds: string[];
  }) {
    return unwrap(await apiFetch<ApiResponse<ClientReceivable[]>>(
      "/api/v1/compta/reglements-clients/creances/selection",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    )).map(normalizeClientReceivable);
  },

  async clientPayments(params: {
    dateDu?: string;
    dateAu?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    return normalizeClientPaymentPage(unwrap(await apiFetch<ApiResponse<ClientPaymentPage>>(
      `/api/v1/compta/reglements-clients${buildQueryString(params)}`
    )));
  },

  async createClientPayment(request: CreateClientPaymentRequest) {
    return normalizeClientPayment(unwrap(await apiFetch<ApiResponse<ClientPayment>>(
      "/api/v1/compta/reglements-clients",
      { method: "POST", body: JSON.stringify(request) }
    )));
  },

  async cancelClientPayment(id: string, motif: string) {
    return normalizeClientPayment(unwrap(await apiFetch<ApiResponse<ClientPayment>>(
      `/api/v1/compta/reglements-clients/${id}/annulation`,
      { method: "POST", body: JSON.stringify({ motif }) }
    )));
  },

  async pendingPaymentInstruments() {
    return unwrap(await apiFetch<ApiResponse<PaymentInstrument[]>>(
      "/api/v1/compta/reglements-clients/instruments/en-attente"
    )).map(normalizePaymentInstrument);
  },

  async paymentInstruments(params: {
    statut: PaymentInstrument["statut"];
    dateDu?: string;
    dateAu?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    const result = unwrap(await apiFetch<ApiResponse<PaymentInstrumentPage>>(
      `/api/v1/compta/reglements-clients/instruments${buildQueryString(params)}`
    ));
    return {
      ...result,
      rows: result.rows.map(normalizePaymentInstrument),
    };
  },

  async changePaymentInstrumentStatus(
    id: string,
    request: {
      statut: "CONFIRME" | "REJETE";
      compteTresorerieId?: string;
      dateOperation?: string;
      motif?: string;
    }
  ) {
    return normalizeClientPayment(unwrap(await apiFetch<ApiResponse<ClientPayment>>(
      `/api/v1/compta/reglements-clients/instruments/${id}/statut`,
      { method: "PUT", body: JSON.stringify(request) }
    )));
  },

  async replacePaymentInstrument(
    id: string,
    request: ReplacePaymentInstrumentRequest
  ) {
    return normalizeClientPayment(unwrap(await apiFetch<ApiResponse<ClientPayment>>(
      `/api/v1/compta/reglements-clients/instruments/${id}/remplacement`,
      { method: "POST", body: JSON.stringify(request) }
    )));
  },

  async companyBordereauSources(params: {
    compagnieId?: string;
    base: CompanyBordereauBase;
    dateDu?: string;
    dateAu?: string;
    search?: string;
  }) {
    return unwrap(await apiFetch<ApiResponse<CompanyBordereauSource[]>>(
      `/api/v1/compta/bordereaux-compagnies/sources${buildQueryString(params)}`
    )).map(normalizeCompanyBordereauSource);
  },

  async companyBordereaux(params: {
    compagnieId?: string;
    statut?: CompanyBordereauStatus;
    dateDu?: string;
    dateAu?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    return normalizeCompanyBordereauPage(unwrap(
      await apiFetch<ApiResponse<CompanyBordereauPage>>(
        `/api/v1/compta/bordereaux-compagnies${buildQueryString(params)}`
      )
    ));
  },

  async companyBordereau(id: string) {
    return normalizeCompanyBordereau(unwrap(
      await apiFetch<ApiResponse<CompanyBordereau>>(
        `/api/v1/compta/bordereaux-compagnies/${id}`
      )
    ));
  },

  async createCompanyBordereau(request: UpsertCompanyBordereauRequest) {
    return normalizeCompanyBordereau(unwrap(
      await apiFetch<ApiResponse<CompanyBordereau>>(
        "/api/v1/compta/bordereaux-compagnies",
        { method: "POST", body: JSON.stringify(request) }
      )
    ));
  },

  async updateCompanyBordereau(id: string, request: UpsertCompanyBordereauRequest) {
    return normalizeCompanyBordereau(unwrap(
      await apiFetch<ApiResponse<CompanyBordereau>>(
        `/api/v1/compta/bordereaux-compagnies/${id}`,
        { method: "PUT", body: JSON.stringify(request) }
      )
    ));
  },

  async validateCompanyBordereau(id: string) {
    return normalizeCompanyBordereau(unwrap(
      await apiFetch<ApiResponse<CompanyBordereau>>(
        `/api/v1/compta/bordereaux-compagnies/${id}/validation`,
        { method: "POST" }
      )
    ));
  },

  async transmitCompanyBordereau(id: string, request: {
    dateTransmission: string;
    canalTransmission: string;
    referenceTransmission?: string;
  }) {
    return normalizeCompanyBordereau(unwrap(
      await apiFetch<ApiResponse<CompanyBordereau>>(
        `/api/v1/compta/bordereaux-compagnies/${id}/transmission`,
        { method: "POST", body: JSON.stringify(request) }
      )
    ));
  },

  async reconcileCompanyBordereau(id: string, request: {
    statut: "RAPPROCHE" | "AVEC_ECART";
    ecart: number;
    note?: string;
    dateAccuseReception?: string;
    referenceAccuseReception?: string;
  }) {
    return normalizeCompanyBordereau(unwrap(
      await apiFetch<ApiResponse<CompanyBordereau>>(
        `/api/v1/compta/bordereaux-compagnies/${id}/rapprochement`,
        { method: "POST", body: JSON.stringify(request) }
      )
    ));
  },

  async cancelCompanyBordereau(id: string, motif: string) {
    return normalizeCompanyBordereau(unwrap(
      await apiFetch<ApiResponse<CompanyBordereau>>(
        `/api/v1/compta/bordereaux-compagnies/${id}/annulation`,
        { method: "POST", body: JSON.stringify({ motif }) }
      )
    ));
  },

  async createCompanyPayment(request: CreateCompanyPaymentRequest) {
    return normalizeCompanyPayment(unwrap(
      await apiFetch<ApiResponse<CompanyPayment>>(
        "/api/v1/compta/bordereaux-compagnies/reglements",
        { method: "POST", body: JSON.stringify(request) }
      )
    ));
  },

  async companyPayment(id: string) {
    return normalizeCompanyPayment(unwrap(
      await apiFetch<ApiResponse<CompanyPayment>>(
        `/api/v1/compta/bordereaux-compagnies/reglements/${id}`
      )
    ));
  },

  async changeCompanyPaymentInstrumentStatus(
    id: string,
    request: {
      statut: "CONFIRME" | "REJETE";
      compteTresorerieId?: string;
      dateOperation?: string;
      motif?: string;
    }
  ) {
    return normalizeCompanyPayment(unwrap(
      await apiFetch<ApiResponse<CompanyPayment>>(
        `/api/v1/compta/bordereaux-compagnies/instruments/${id}/statut`,
        { method: "PUT", body: JSON.stringify(request) }
      )
    ));
  },

  async cancelCompanyPayment(id: string, motif: string) {
    return normalizeCompanyPayment(unwrap(
      await apiFetch<ApiResponse<CompanyPayment>>(
        `/api/v1/compta/bordereaux-compagnies/reglements/${id}/annulation`,
        { method: "POST", body: JSON.stringify({ motif }) }
      )
    ));
  },

  async treasuryAccounts() {
    return unwrap(await apiFetch<ApiResponse<TreasuryAccount[]>>(
      "/api/v1/compta/tresorerie/comptes"
    )).map(normalizeTreasuryAccount);
  },

  async treasuryAdministrationAccounts() {
    return unwrap(await apiFetch<ApiResponse<TreasuryAccount[]>>(
      "/api/v1/compta/tresorerie/comptes/administration"
    )).map(normalizeTreasuryAccount);
  },

  async treasuryUsers() {
    return unwrap(await apiFetch<ApiResponse<TreasuryUser[]>>(
      "/api/v1/compta/tresorerie/utilisateurs"
    )).map((user) => ({ ...user, id: String(user.id) }));
  },

  async treasuryAccountAssignments(accountId: string) {
    return unwrap(await apiFetch<ApiResponse<TreasuryAccountAssignment[]>>(
      `/api/v1/compta/tresorerie/comptes/${accountId}/affectations`
    )).map(normalizeTreasuryAssignment);
  },

  async saveTreasuryAccountAssignments(
    accountId: string,
    assignments: Array<{
      utilisateurId: string;
      niveauAcces: TreasuryAccessLevel;
      actif: boolean;
    }>
  ) {
    return unwrap(await apiFetch<ApiResponse<TreasuryAccountAssignment[]>>(
      `/api/v1/compta/tresorerie/comptes/${accountId}/affectations`,
      { method: "PUT", body: JSON.stringify({ affectations: assignments }) }
    )).map(normalizeTreasuryAssignment);
  },

  async cashSessions() {
    return unwrap(await apiFetch<ApiResponse<CashSession[]>>(
      "/api/v1/compta/tresorerie/sessions-caisse"
    )).map(normalizeCashSession);
  },

  async openCashSession(request: {
    compteTresorerieId: string;
    montantCompte: number;
    note?: string;
  }) {
    return normalizeCashSession(unwrap(await apiFetch<ApiResponse<CashSession>>(
      "/api/v1/compta/tresorerie/sessions-caisse",
      { method: "POST", body: JSON.stringify(request) }
    )));
  },

  async closeCashSession(id: string, request: { montantCompte: number; note?: string }) {
    return normalizeCashSession(unwrap(await apiFetch<ApiResponse<CashSession>>(
      `/api/v1/compta/tresorerie/sessions-caisse/${id}/cloture`,
      { method: "POST", body: JSON.stringify(request) }
    )));
  },

  async treasuryOperations(params: {
    compteId?: string;
    type?: TreasuryOperationType;
    dateDu?: string;
    dateAu?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    const result = unwrap(await apiFetch<ApiResponse<TreasuryOperationPage>>(
      `/api/v1/compta/tresorerie/operations${buildQueryString(params)}`
    ));
    return { ...result, rows: result.rows.map(normalizeTreasuryOperation) };
  },

  async createTreasuryTransfer(request: CreateTreasuryTransferRequest) {
    return normalizeTreasuryOperation(unwrap(await apiFetch<ApiResponse<TreasuryOperation>>(
      "/api/v1/compta/tresorerie/operations/transferts",
      { method: "POST", body: JSON.stringify(request) }
    )));
  },

  async createTreasuryAdjustment(request: CreateTreasuryAdjustmentRequest) {
    return normalizeTreasuryOperation(unwrap(await apiFetch<ApiResponse<TreasuryOperation>>(
      "/api/v1/compta/tresorerie/operations/ajustements",
      { method: "POST", body: JSON.stringify(request) }
    )));
  },

  async cancelTreasuryOperation(id: string, dateOperation: string, motif: string) {
    return normalizeTreasuryOperation(unwrap(await apiFetch<ApiResponse<TreasuryOperation>>(
      `/api/v1/compta/tresorerie/operations/${id}/annulation`,
      { method: "POST", body: JSON.stringify({ dateOperation, motif }) }
    )));
  },

  async createTreasuryAccount(request: UpsertTreasuryAccountRequest) {
    return normalizeTreasuryAccount(unwrap(await apiFetch<ApiResponse<TreasuryAccount>>(
      "/api/v1/compta/tresorerie/comptes",
      { method: "POST", body: JSON.stringify(request) }
    )));
  },

  async updateTreasuryAccount(id: string, request: UpsertTreasuryAccountRequest) {
    return normalizeTreasuryAccount(unwrap(await apiFetch<ApiResponse<TreasuryAccount>>(
      `/api/v1/compta/tresorerie/comptes/${id}`,
      { method: "PUT", body: JSON.stringify(request) }
    )));
  },

  async changeTreasuryAccountStatus(id: string, actif: boolean) {
    return normalizeTreasuryAccount(unwrap(await apiFetch<ApiResponse<TreasuryAccount>>(
      `/api/v1/compta/tresorerie/comptes/${id}/statut`,
      { method: "PUT", body: JSON.stringify({ actif }) }
    )));
  },

  async treasuryMovements() {
    return unwrap(await apiFetch<ApiResponse<TreasuryMovement[]>>(
      "/api/v1/compta/tresorerie/mouvements"
    )).map(normalizeTreasuryMovement);
  },

  async treasuryJournal(params: {
    compteId?: string;
    dateDu?: string;
    dateAu?: string;
    search?: string;
    page: number;
    size: number;
  }) {
    const result = unwrap(await apiFetch<ApiResponse<TreasuryMovementPage>>(
      `/api/v1/compta/tresorerie/journal${buildQueryString(params)}`
    ));
    return {
      ...result,
      rows: result.rows.map(normalizeTreasuryMovement),
    };
  },

  async previewBankStatement(file: File, configuration: BankStatementImportConfiguration) {
    return uploadBankStatement(
      "/api/v1/compta/tresorerie/releves-bancaires/previsualisation",
      file,
      configuration
    );
  },

  async importBankStatement(
    accountId: string,
    file: File,
    configuration: BankStatementImportConfiguration,
    profileId?: string
  ) {
    return uploadBankStatement(
      `/api/v1/compta/tresorerie/releves-bancaires${buildQueryString({
        compteId: accountId,
        profilId: profileId,
      })}`,
      file,
      configuration
    );
  },

  async bankStatementImports(accountId: string, page = 0, size = 20) {
    return unwrap(await apiFetch<ApiResponse<BankStatementImportPage>>(
      `/api/v1/compta/tresorerie/releves-bancaires${buildQueryString({
        compteId: accountId,
        page,
        size,
      })}`
    ));
  },

  async bankStatementProfiles(accountId: string) {
    return unwrap(await apiFetch<ApiResponse<BankStatementImportProfile[]>>(
      `/api/v1/compta/tresorerie/releves-bancaires/profils${buildQueryString({
        compteId: accountId,
      })}`
    ));
  },

  async bankStatementImport(id: string) {
    return unwrap(await apiFetch<ApiResponse<BankStatementImport>>(
      `/api/v1/compta/tresorerie/releves-bancaires/${id}`
    ));
  },

  async saveBankReconciliations(id: string, request: SaveBankReconciliationsRequest) {
    return unwrap(await apiFetch<ApiResponse<BankStatementImport>>(
      `/api/v1/compta/tresorerie/releves-bancaires/${id}/rapprochements`,
      { method: "PUT", body: JSON.stringify(request) }
    ));
  },

  async validateBankReconciliation(id: string) {
    return unwrap(await apiFetch<ApiResponse<BankStatementImport>>(
      `/api/v1/compta/tresorerie/releves-bancaires/${id}/validation`,
      { method: "POST" }
    ));
  },
};

async function uploadBankStatement(
  path: string,
  file: File,
  configuration: BankStatementImportConfiguration
) {
  const data = new FormData();
  data.append("file", file);
  data.append(
    "configuration",
    new Blob([JSON.stringify(configuration)], { type: "application/json" })
  );
  return unwrap(await apiUpload<ApiResponse<BankStatementImport>>(path, data));
}

function normalizeReference(option: ReferenceOption): ReferenceOption {
  return {
    ...option,
    id: String(option.id),
  };
}

function normalizeRule(rule: Rule): Rule {
  return {
    ...rule,
    id: String(rule.id),
    compagnieAssuranceId: String(rule.compagnieAssuranceId),
  };
}

function normalizeAllocation(allocation: QuittanceAllocation): QuittanceAllocation {
  return {
    ...allocation,
    quittanceId: String(allocation.quittanceId),
    contratId: String(allocation.contratId),
    mouvementId: allocation.mouvementId == null ? null : String(allocation.mouvementId),
    compagnieId: allocation.compagnieId == null ? null : String(allocation.compagnieId),
    regle: allocation.regle ? normalizeRule(allocation.regle) : null,
    lignes: allocation.lignes.map(normalizeAllocationLine),
  };
}

function normalizeAllocationLine(line: QuittanceAllocation["lignes"][number]) {
  return {
    ...line,
    id: line.id == null ? undefined : String(line.id),
    quittanceId: line.quittanceId == null ? null : String(line.quittanceId),
  };
}

function normalizeClientDocument(document: ClientDocument): ClientDocument {
  return {
    ...document,
    id: String(document.id),
    clientPayeurId: document.clientPayeurId == null ? null : String(document.clientPayeurId),
    groupePayeurId: document.groupePayeurId == null ? null : String(document.groupePayeurId),
    lignes: (document.lignes ?? []).map((line) => ({
      ...line,
      id: String(line.id),
      quittanceId: line.quittanceId == null ? null : String(line.quittanceId),
      elementFacturableId: line.elementFacturableId == null ? null : String(line.elementFacturableId),
      echeanceFacturationConventionId: line.echeanceFacturationConventionId == null
        ? null
        : String(line.echeanceFacturationConventionId),
      contratId: line.contratId == null ? "" : String(line.contratId),
      mouvementId: line.mouvementId == null ? null : String(line.mouvementId),
    })),
  };
}

function normalizeClientReceivablePage(page: ClientReceivablePage): ClientReceivablePage {
  return {
    ...page,
    rows: page.rows.map(normalizeClientReceivable),
  };
}

function normalizeClientReceivable(row: ClientReceivable): ClientReceivable {
  return {
    ...row,
    source: {
      ...row.source,
      elementFacturableId: row.source.elementFacturableId == null
        ? null
        : String(row.source.elementFacturableId),
      documentClientId: row.source.documentClientId == null
        ? null
        : String(row.source.documentClientId),
      quittanceId: row.source.quittanceId == null ? null : String(row.source.quittanceId),
      contratId: row.source.contratId == null ? "" : String(row.source.contratId),
      mouvementId: row.source.mouvementId == null ? null : String(row.source.mouvementId),
      payeurId: String(row.source.payeurId),
      souscripteurId: row.source.souscripteurId == null
        ? null
        : String(row.source.souscripteurId),
    },
  };
}

function normalizeClientPaymentPage(page: ClientPaymentPage): ClientPaymentPage {
  return {
    ...page,
    rows: page.rows.map(normalizeClientPayment),
  };
}

function normalizeClientPayment(payment: ClientPayment): ClientPayment {
  return {
    ...payment,
    id: String(payment.id),
    clientPayeurId: payment.clientPayeurId == null ? null : String(payment.clientPayeurId),
    groupePayeurId: payment.groupePayeurId == null ? null : String(payment.groupePayeurId),
    instruments: payment.instruments.map(normalizePaymentInstrument),
  };
}

function normalizePaymentInstrument(instrument: PaymentInstrument): PaymentInstrument {
  return {
    ...instrument,
    id: String(instrument.id),
    reglementId: String(instrument.reglementId),
    compteTresorerieId: instrument.compteTresorerieId == null
      ? null
      : String(instrument.compteTresorerieId),
    affectations: instrument.affectations.map((allocation) => ({
      ...allocation,
      id: String(allocation.id),
      elementFacturableId: allocation.elementFacturableId == null
        ? null
        : String(allocation.elementFacturableId),
      documentClientId: allocation.documentClientId == null
        ? null
        : String(allocation.documentClientId),
    })),
  };
}

function normalizeTreasuryAccount(account: TreasuryAccount): TreasuryAccount {
  return {
    ...account,
    id: String(account.id),
  };
}

function normalizeTreasuryMovement(movement: TreasuryMovement): TreasuryMovement {
  return {
    ...movement,
    id: String(movement.id),
    compteTresorerieId: String(movement.compteTresorerieId),
    instrumentReglementId: movement.instrumentReglementId == null
      ? null
      : String(movement.instrumentReglementId),
    instrumentReglementCompagnieId: movement.instrumentReglementCompagnieId == null
      ? null
      : String(movement.instrumentReglementCompagnieId),
    operationTresorerieId: movement.operationTresorerieId == null
      ? null
      : String(movement.operationTresorerieId),
    sessionCaisseId: movement.sessionCaisseId == null
      ? null
      : String(movement.sessionCaisseId),
  };
}

function normalizeTreasuryAssignment(
  assignment: TreasuryAccountAssignment
): TreasuryAccountAssignment {
  return {
    ...assignment,
    id: String(assignment.id),
    utilisateurId: String(assignment.utilisateurId),
  };
}

function normalizeCashSession(session: CashSession): CashSession {
  return {
    ...session,
    id: String(session.id),
    compteTresorerieId: String(session.compteTresorerieId),
    utilisateurId: String(session.utilisateurId),
  };
}

function normalizeTreasuryOperation(operation: TreasuryOperation): TreasuryOperation {
  return {
    ...operation,
    id: String(operation.id),
    compteSourceId: operation.compteSourceId == null ? null : String(operation.compteSourceId),
    compteDestinationId: operation.compteDestinationId == null
      ? null
      : String(operation.compteDestinationId),
    confirmeeParId: String(operation.confirmeeParId),
    operationExtourneeId: operation.operationExtourneeId == null
      ? null
      : String(operation.operationExtourneeId),
  };
}

function normalizeCompanyBordereauSource(
  source: CompanyBordereauSource
): CompanyBordereauSource {
  return {
    ...source,
    id: String(source.id),
    compagnieId: String(source.compagnieId),
    quittanceId: String(source.quittanceId),
  };
}

function normalizeCompanyBordereauPage(
  page: CompanyBordereauPage
): CompanyBordereauPage {
  return {
    ...page,
    rows: page.rows.map(normalizeCompanyBordereau),
  };
}

function normalizeCompanyBordereau(
  bordereau: CompanyBordereau
): CompanyBordereau {
  return {
    ...bordereau,
    id: String(bordereau.id),
    compagnieId: String(bordereau.compagnieId),
    lignes: (bordereau.lignes ?? []).map((line) => ({
      ...line,
      id: String(line.id),
      affectationId: String(line.affectationId),
    })),
    reglements: (bordereau.reglements ?? []).map((payment) => ({
      ...payment,
      reglementId: String(payment.reglementId),
      instrumentId: String(payment.instrumentId),
      compteTresorerieId: payment.compteTresorerieId == null
        ? null
        : String(payment.compteTresorerieId),
    })),
  };
}

function normalizeCompanyPayment(payment: CompanyPayment): CompanyPayment {
  return {
    ...payment,
    id: String(payment.id),
    compagnieId: String(payment.compagnieId),
    instruments: payment.instruments.map((instrument) => ({
      ...instrument,
      id: String(instrument.id),
      compteTresorerieId: instrument.compteTresorerieId == null
        ? null
        : String(instrument.compteTresorerieId),
      affectations: instrument.affectations.map((allocation) => ({
        ...allocation,
        bordereauId: String(allocation.bordereauId),
      })),
    })),
  };
}
