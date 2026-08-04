import { apiFetch } from "@/lib/api/base";
import type { ApiResponse } from "../types";
import { unwrapApiResponse as unwrap } from "./response";

export type FiscalRuleNature = "TAXE_ASSURANCE" | "TPF" | "EVCAT" | "CNPAC";
export type FiscalRuleMode = "TAUX" | "MONTANT_FIXE";
export type FiscalRuleBase = "PRIME_GARANTIE" | "PRIME_CATEGORIE" | "UNITE_ASSUREE";
export type QuittanceCategory = "AUTOMOBILE" | "CORPOREL" | "EVCAT" | "ASSISTANCE";
export type GuaranteeType = "VEHICULE" | "PERSONNE";
export type ContractType = "PARTICULIER" | "CONVENTION" | "FLOTTE";

export type FiscalRule = {
  id: string;
  code: string;
  libelle: string;
  nature: FiscalRuleNature;
  modeCalcul: FiscalRuleMode;
  valeur: number;
  baseCalcul: FiscalRuleBase;
  categorieBase?: QuittanceCategory | null;
  categorieResultat: QuittanceCategory;
  brancheAssuranceId: string;
  brancheAssuranceCode?: string | null;
  brancheAssuranceLibelle?: string | null;
  compagnieAssuranceId?: string | null;
  compagnieAssuranceLibelle?: string | null;
  categorieClientId?: string | null;
  categorieClientCode?: string | null;
  categorieClientLibelle?: string | null;
  garantieId?: string | null;
  garantieCode?: string | null;
  garantieLibelle?: string | null;
  typeGarantie?: GuaranteeType | null;
  usageId?: string | null;
  usageCode?: string | null;
  usageLibelle?: string | null;
  groupeUsageAttestationId?: string | null;
  groupeUsageAttestationCode?: string | null;
  typeContrat?: ContractType | null;
  dateDebut: string;
  dateFin?: string | null;
  applicable: boolean;
  priorite: number;
  actif: boolean;
  description?: string | null;
  referenceReglementaire?: string | null;
};

export type UpsertFiscalRule = Omit<
  FiscalRule,
  | "id"
  | "brancheAssuranceCode"
  | "brancheAssuranceLibelle"
  | "compagnieAssuranceLibelle"
  | "categorieClientCode"
  | "categorieClientLibelle"
  | "garantieCode"
  | "garantieLibelle"
  | "usageCode"
  | "usageLibelle"
  | "groupeUsageAttestationCode"
>;

export const fiscalRulesApi = {
  list: async () => normalizeRules(
    unwrap(await apiFetch<ApiResponse<FiscalRule[]>>("/api/v1/regles-fiscales")),
  ),
  create: async (payload: UpsertFiscalRule) =>
    normalizeRule(unwrap(await apiFetch<ApiResponse<FiscalRule>>("/api/v1/regles-fiscales", {
        method: "POST",
        body: JSON.stringify(payload),
      }))),
  update: async (id: string, payload: UpsertFiscalRule) =>
    normalizeRule(unwrap(await apiFetch<ApiResponse<FiscalRule>>(`/api/v1/regles-fiscales/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }))),
  deactivate: async (id: string) =>
    unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/regles-fiscales/${id}`, { method: "DELETE" })),
};

function normalizeRules(rules: FiscalRule[]) {
  return rules.map(normalizeRule);
}

function normalizeRule(rule: FiscalRule): FiscalRule {
  return {
    ...rule,
    id: String(rule.id),
    brancheAssuranceId: String(rule.brancheAssuranceId),
    compagnieAssuranceId: normalizeId(rule.compagnieAssuranceId),
    categorieClientId: normalizeId(rule.categorieClientId),
    garantieId: normalizeId(rule.garantieId),
    usageId: normalizeId(rule.usageId),
    groupeUsageAttestationId: normalizeId(rule.groupeUsageAttestationId),
  };
}

function normalizeId(value: string | number | null | undefined) {
  return value == null ? null : String(value);
}
