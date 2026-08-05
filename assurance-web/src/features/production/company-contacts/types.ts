import type { PagedResponse } from "../types";

export const COMPANY_CONTACT_SERVICES = [
  "PRODUCTION", "COMPTABILITE", "SINISTRES", "RENOUVELLEMENTS",
  "ATTESTATIONS_STOCK", "COMMERCIAL", "DIRECTION", "AUTRE",
] as const;

export type CompanyContactService = (typeof COMPANY_CONTACT_SERVICES)[number];

export const COMPANY_CONTACT_SERVICE_LABELS: Record<CompanyContactService, string> = {
  PRODUCTION: "Production",
  COMPTABILITE: "Comptabilité",
  SINISTRES: "Sinistres",
  RENOUVELLEMENTS: "Renouvellements",
  ATTESTATIONS_STOCK: "Attestations et stock",
  COMMERCIAL: "Commercial",
  DIRECTION: "Direction",
  AUTRE: "Autre",
};

export type CompanyContact = {
  id: string;
  compagnieAssuranceId: string;
  compagnieAssuranceCode?: string | null;
  compagnieAssuranceNom: string;
  nom: string;
  prenom?: string | null;
  service: CompanyContactService;
  fonction?: string | null;
  email?: string | null;
  telephoneMobile?: string | null;
  telephoneFixe?: string | null;
  posteTelephonique?: string | null;
  whatsapp: boolean;
  fax?: string | null;
  principal: boolean;
  notes?: string | null;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompanyContactPage = PagedResponse<CompanyContact>;

export type UpsertCompanyContactRequest = {
  nom: string;
  prenom?: string;
  service: CompanyContactService;
  fonction?: string;
  email?: string;
  telephoneMobile?: string;
  telephoneFixe?: string;
  posteTelephonique?: string;
  whatsapp?: boolean;
  fax?: string;
  principal?: boolean;
  notes?: string;
};
