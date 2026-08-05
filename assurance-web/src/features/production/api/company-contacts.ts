import { apiFetch, buildQueryString } from "@/lib/api/base";
import type { ApiResponse } from "../types";
import type { CompanyContact, CompanyContactPage, CompanyContactService, UpsertCompanyContactRequest } from "../company-contacts/types";
import { unwrapApiResponse as unwrap } from "./response";

export const companyContactsApi = {
  async list(params: { q?: string; compagnieId?: string; service?: CompanyContactService; actif?: boolean; page: number; size: number }): Promise<CompanyContactPage> {
    return unwrap(await apiFetch<ApiResponse<CompanyContactPage>>(
      `/api/v1/compagnies-assurance/contacts${buildQueryString(params)}`,
    ));
  },

  async create(compagnieId: string, request: UpsertCompanyContactRequest): Promise<CompanyContact> {
    return unwrap(await apiFetch<ApiResponse<CompanyContact>>(
      `/api/v1/compagnies-assurance/${compagnieId}/contacts`,
      { method: "POST", body: JSON.stringify(request) },
    ));
  },

  async update(compagnieId: string, contactId: string, request: UpsertCompanyContactRequest): Promise<CompanyContact> {
    return unwrap(await apiFetch<ApiResponse<CompanyContact>>(
      `/api/v1/compagnies-assurance/${compagnieId}/contacts/${contactId}`,
      { method: "PUT", body: JSON.stringify(request) },
    ));
  },

  async updateStatus(compagnieId: string, contactId: string, actif: boolean): Promise<CompanyContact> {
    return unwrap(await apiFetch<ApiResponse<CompanyContact>>(
      `/api/v1/compagnies-assurance/${compagnieId}/contacts/${contactId}/statut`,
      { method: "PATCH", body: JSON.stringify({ actif }) },
    ));
  },
};
