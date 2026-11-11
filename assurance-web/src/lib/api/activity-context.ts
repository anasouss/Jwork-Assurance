/** Screen context is descriptive; the backend determines the business action. */
export function activitySurfaceForPath(path: string) {
  if (/^\/app\/production\/contrats\/[^/]+\/avenants(?:\/|$)/.test(path)) return "CONTRACT_AMENDMENT";
  if (/^\/app\/production\/ajouter-dossier\/assistance-/.test(path)
      || /^\/app\/production\/contrats\/[^/]+\/assistance/.test(path)) return "ASSISTANCE_CREATION";
  if (/^\/app\/production\/contrats\/[^/]+\/cartes-vertes(?:\/|$)/.test(path)) return "GREEN_CARDS";
  if (path.startsWith("/app/production/ajouter-dossier") || path.startsWith("/app/production/renouvellements")
      || path.startsWith("/app/production/prospection")) return "CONTRACT_CREATION";
  if (path.startsWith("/app/production/attestations-stock")) return "ATTESTATION_STOCK";
  if (path.startsWith("/app/production/parametres")) return "PRODUCTION_SETTINGS";
  if (path.startsWith("/app/production")) return "CONTRACT_REGISTER";
  if (path.startsWith("/app/crm/parametres")) return "CRM_SETTINGS";
  if (/^\/app\/crm\/clients\/[^/]+/.test(path)) return "CLIENT_RECORD";
  if (path.startsWith("/app/crm")) return "CLIENT_REGISTER";
  if (path.startsWith("/app/compta/releves-factures")) return "CLIENT_ACCOUNTING";
  if (path.startsWith("/app/compta/facturation-conventions")) return "CONVENTION_BILLING";
  if (path.startsWith("/app/compta/conventions/production")) return "CONVENTION_BILLING";
  if (path.startsWith("/app/compta/reglements")) return "CLIENT_PAYMENTS";
  if (path.startsWith("/app/compta/bordereaux-compagnies")) return "COMPANY_ACCOUNTING";
  if (path.startsWith("/app/compta/quittances")) return "COMPANY_ASSIGNMENTS";
  if (path.startsWith("/app/compta/tresorerie/bordereaux-remise")) return "BANK_REMITTANCES";
  if (path.startsWith("/app/compta/tresorerie/impayes-clients")) return "BANK_REJECTIONS";
  if (path.startsWith("/app/compta/tresorerie/rapprochement-bancaire")) return "BANK_RECONCILIATION";
  if (path.startsWith("/app/compta")) return "TREASURY";
  if (/^\/app\/sinistre\/dossiers\/[^/]+/.test(path)) return "CLAIM_FILE";
  if (path.startsWith("/app/sinistre/declarer")) return "CLAIM_DECLARATION";
  if (path.startsWith("/app/sinistre/referentiels")) return "CLAIM_SETTINGS";
  if (path.startsWith("/app/sinistre")) return "CLAIM_REGISTER";
  if (path.startsWith("/app/companies")) return "COMPANY_SETTINGS";
  if (path.startsWith("/app/admin")) return "ADMINISTRATION";
  return "OTHER_APPLICATION";
}
