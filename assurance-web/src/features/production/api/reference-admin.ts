import { apiFetch } from "@/lib/api/base";
import type {
  ApiResponse,
  ReferenceOption,
  UpsertCategorieClientRequest,
  UpsertCodeReferenceRequest,
  UpsertCompagnieAssuranceRequest,
  UpsertConventionRequest,
  UpsertGarantieRequest,
  UpsertGroupeExclusionGarantieRequest,
  UpsertGroupeUsageAttestationRequest,
  UpsertReferenceRequest,
  UpsertUsageRequest,
} from "../types";

type CategoryTransportRequest = {
  code: string;
  libelle: string;
  description?: string;
  actif?: boolean;
};

import { unwrapApiResponse as unwrap } from "./response";

async function createReference<T>(resource: string, payload: T) {
  return unwrap(
    await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/${resource}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

async function updateReference<T>(resource: string, id: string, payload: T) {
  return unwrap(
    await apiFetch<ApiResponse<ReferenceOption>>(`/api/v1/referentiel/${resource}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  );
}

export const referenceAdminApi = {
  createCategoryTransport: (payload: CategoryTransportRequest) =>
    createReference("categories-transport", payload),
  updateCategoryTransport: (id: string, payload: CategoryTransportRequest) =>
    updateReference("categories-transport", id, payload),
  createClientCategory: (payload: UpsertCategorieClientRequest) =>
    createReference("categories-client", payload),
  updateClientCategory: (id: string, payload: UpsertCategorieClientRequest) =>
    updateReference("categories-client", id, payload),
  createInsuranceCompany: (payload: UpsertCompagnieAssuranceRequest) =>
    createReference("compagnies-assurance", payload),
  updateInsuranceCompany: (id: string, payload: UpsertCompagnieAssuranceRequest) =>
    updateReference("compagnies-assurance", id, payload),
  createConvention: (payload: UpsertConventionRequest) =>
    createReference("conventions", payload),
  updateConvention: (id: string, payload: UpsertConventionRequest) =>
    updateReference("conventions", id, payload),
  createUsage: (payload: UpsertUsageRequest) => createReference("usages", payload),
  updateUsage: (id: string, payload: UpsertUsageRequest) =>
    updateReference("usages", id, payload),
  createAttestationUsageGroup: (payload: UpsertGroupeUsageAttestationRequest) =>
    createReference("groupes-usage-attestation", payload),
  updateAttestationUsageGroup: (id: string, payload: UpsertGroupeUsageAttestationRequest) =>
    updateReference("groupes-usage-attestation", id, payload),
  createGuaranteeExclusionGroup: (payload: UpsertGroupeExclusionGarantieRequest) =>
    createReference("groupes-exclusion-garanties", payload),
  updateGuaranteeExclusionGroup: (id: string, payload: UpsertGroupeExclusionGarantieRequest) =>
    updateReference("groupes-exclusion-garanties", id, payload),
  createGuarantee: (payload: UpsertGarantieRequest) =>
    createReference("garanties", payload),
  updateGuarantee: (id: string, payload: UpsertGarantieRequest) =>
    updateReference("garanties", id, payload),
  createBrand: (payload: UpsertReferenceRequest) => createReference("marques", payload),
  updateBrand: (id: string, payload: UpsertReferenceRequest) =>
    updateReference("marques", id, payload),
  createBodyType: (payload: UpsertReferenceRequest) =>
    createReference("carrosseries", payload),
  updateBodyType: (id: string, payload: UpsertReferenceRequest) =>
    updateReference("carrosseries", id, payload),
  createFuel: (payload: UpsertCodeReferenceRequest) =>
    createReference("carburants", payload),
  updateFuel: (id: string, payload: UpsertCodeReferenceRequest) =>
    updateReference("carburants", id, payload),
  createSubclass: (payload: UpsertCodeReferenceRequest) =>
    createReference("sous-classes", payload),
  updateSubclass: (id: string, payload: UpsertCodeReferenceRequest) =>
    updateReference("sous-classes", id, payload),
};
