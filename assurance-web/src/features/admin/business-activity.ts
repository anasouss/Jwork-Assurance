import { apiFetch, buildQueryString } from "@/lib/api/base";
import type { ApiResponse } from "@/lib/types";
import type { AdminAuditPage } from "./types";

export const activityModules = {
  PRODUCTION: "Production", CRM: "CRM", COMPTABILITE_CLIENT: "Comptabilité client",
  COMPTABILITE_COMPAGNIE: "Comptabilité compagnie", TRESORERIE: "Trésorerie",
  SINISTRES: "Sinistres", STOCK_ATTESTATIONS: "Stock d’attestations", COMPAGNIES: "Compagnies",
  REFERENTIELS: "Référentiels", ADMINISTRATION: "Administration",
} as const;

export const activityActions = {
  CREATED: "Création", SAVED: "Enregistrement", UPDATED: "Modification", VALIDATED: "Validation",
  CANCELLED: "Annulation", DELETED: "Suppression", ARCHIVED: "Archivage", REPLACED: "Remplacement",
  ISSUED: "Émission", RENEWED: "Renouvellement", IMPORTED: "Import", RECALCULATED: "Recalcul",
  REMITTED: "Remise en banque", CONFIRMED: "Confirmation", REJECTED: "Rejet", ALLOCATED: "Affectation",
  RECONCILED: "Rapprochement", TRANSMITTED: "Transmission", OPENED: "Ouverture", CLOSED: "Clôture",
  RESTORED: "Restauration", ASSIGNED: "Attribution", UNASSIGNED: "Retrait", SELECTED: "Sélection",
  CONTEXT_CHANGED: "Changement de contexte",
} as const;

export type ActivityReference = { type: string; id: string; label: string };
export type BusinessActivity = {
  id: string;
  agenceId: string | null;
  actorUserId: string | null;
  actorName: string;
  occurredAt: string;
  module: keyof typeof activityModules;
  action: keyof typeof activityActions;
  title: string;
  origin: string;
  surface: string;
  surfaceLabel: string;
  subject: ActivityReference;
  references: ActivityReference[];
  changes: { label: string; beforeValue: string | null; afterValue: string | null }[];
};
export type ActivityFilters = {
  search?: string;
  module?: keyof typeof activityModules;
  action?: keyof typeof activityActions;
  actorUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
};
export type BusinessActivityPage = { items: BusinessActivity[]; page: AdminAuditPage["page"] };
export const activityKeys = {
  all: ["business-activities"] as const,
  scope: (agencyId?: string | null) => ["business-activities", agencyId ?? "platform"] as const,
  list: (agencyId: string | null | undefined, filters: ActivityFilters) =>
    [...activityKeys.scope(agencyId), "list", filters] as const,
  detail: (agencyId: string | null | undefined, id?: string) =>
    [...activityKeys.scope(agencyId), "detail", id] as const,
};

export async function searchBusinessActivities(filters: ActivityFilters) {
  return (await apiFetch<ApiResponse<BusinessActivityPage>>(
    `/api/v1/business-activities${buildQueryString(filters)}`
  )).data;
}

export async function getBusinessActivity(id: string) {
  return (await apiFetch<ApiResponse<BusinessActivity>>(`/api/v1/business-activities/${encodeURIComponent(id)}`)).data;
}
