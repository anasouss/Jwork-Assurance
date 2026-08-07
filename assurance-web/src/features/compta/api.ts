import { apiFetch, apiFetchBlob, apiUpload, buildQueryString } from "@/lib/api/base";
import type { ApiResponse } from "@/lib/types";
import type {
  AllocationRequest,
  BatchAllocationRequest,
  BatchAllocationResponse,
  ClientDocument,
  ClientDocumentPage,
  ClientDocumentSourcePage,
  ClientDocumentStatus,
  ClientDocumentType,
  ConventionBillingPage,
  ConventionBillingStatus,
  CreateConventionInvoiceRequest,
  CreateClientDocumentRequest,
  ImportPreview,
  QuittanceAllocation,
  QuittancePage,
  ReferenceOption,
  Rule,
  RulePage,
  RuleRequest,
  TypeContrat,
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
};

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
