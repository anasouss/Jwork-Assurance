import { apiFetch, apiUpload, buildQueryString } from "@/lib/api/base";
import type { ApiResponse } from "@/lib/types";
import type {
  AllocationRequest,
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
    lignes: allocation.lignes.map((line) => ({
      ...line,
      id: line.id == null ? undefined : String(line.id),
    })),
  };
}
