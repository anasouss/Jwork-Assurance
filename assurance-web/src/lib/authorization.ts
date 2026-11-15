export type PermissionRequirement = {
  anyOf?: readonly string[];
  anyPrefix?: readonly string[];
};

export const MODULE_PERMISSION_PREFIXES = {
  production: ["contrat", "avenant", "assistance", "carte-verte", "piece-jointe", "attestation-stock", "vehicule", "garantie", "regle-fiscale", "usage", "marque", "carrosserie", "carburant", "sous-classe", "categorie-transport", "categorie-client", "groupe-usage-attestation", "tarif-usage", "type-piece-jointe"],
  sinistre: ["sinistre", "sinistre-document", "sinistre-mission", "sinistre-provision", "sinistre-operation", "prestataire-sinistre", "specialite-prestataire"],
  companies: ["compagnie-assurance", "compagnie-assistance", "convention", "grille-tarifaire", "contact-compagnie", "produit-assistance", "tarif-assistance", "promo-assistance"],
  crm: ["client", "groupe-client", "origine-commerciale", "acquisition-client", "condition-paiement", "document-crm", "client-portal-account", "client-portal-publication"],
  compta: ["quittance-affectation", "regle-quittance", "document-client", "production-convention", "facture-convention", "reglement-client", "instrument-reglement", "quittance-prime", "compte-tresorerie", "operation-tresorerie", "session-caisse", "bordereau-remise", "rapprochement-bancaire", "banque", "bordereau-compagnie", "reglement-compagnie"],
  administration: ["user", "role", "audit", "activity", "agence", "config"],
} as const;

type PagePermissionRule = {
  paths: readonly string[];
  requirement: PermissionRequirement;
};

const pagePermissionRules: readonly PagePermissionRule[] = [
  { paths: ["/app/production", "/app/production/portefeuille-clients"], requirement: { anyPrefix: MODULE_PERMISSION_PREFIXES.production } },
  { paths: ["/app/sinistre"], requirement: { anyPrefix: MODULE_PERMISSION_PREFIXES.sinistre } },
  { paths: ["/app/sinistre/dossiers", "/app/sinistre/registre", "/app/sinistre/statistiques", "/app/sinistre/dossiers/:sinistreId"], requirement: { anyOf: ["sinistre:view"] } },
  { paths: ["/app/sinistre/declarer"], requirement: { anyOf: ["sinistre:create"] } },
  { paths: ["/app/sinistre/referentiels", "/app/sinistre/experts", "/app/sinistre/garages", "/app/sinistre/prestataires"], requirement: { anyOf: ["prestataire-sinistre:view"] } },
  { paths: ["/app/sinistre/prestataires/specialites"], requirement: { anyOf: ["specialite-prestataire:view"] } },
  { paths: ["/app/production/ajouter-dossier", "/app/production/ajouter-dossier/assistance-voyage", "/app/production/ajouter-dossier/assistance-automobile", "/app/production/prospection/ajouter-devis"], requirement: { anyOf: ["contrat:create"] } },
  { paths: ["/app/production/contrats/:contratId/assistance-voyage/modifier", "/app/production/contrats/:contratId/assistance-automobile/modifier"], requirement: { anyOf: ["contrat:update","contrat:renew"] } },
  { paths: ["/app/production/prospection", "/app/production/contrats", "/app/production/registre", "/app/production/contrats/:contratId", "/app/production/contrats/:contratId/pdf", "/app/production/echeances"], requirement: { anyOf: ["contrat:view"] } },
  { paths: ["/app/production/prospection/devis/flotte/:draftId", "/app/production/ajouter-dossier/particulier", "/app/production/ajouter-dossier/particulier/:draftId", "/app/production/ajouter-dossier/flotte", "/app/production/ajouter-dossier/flotte/:draftId", "/app/production/ajouter-dossier/convention", "/app/production/ajouter-dossier/convention/:draftId"], requirement: { anyOf: ["contrat:create","contrat:update"] } },
  { paths: ["/app/production/renouvellements/particulier/:draftId", "/app/production/renouvellements/convention/:draftId", "/app/production/renouvellements/flotte/:draftId"], requirement: { anyOf: ["contrat:renew"] } },
  { paths: ["/app/production/portefeuille-clients/:clientId", "/app/crm"], requirement: { anyOf: ["client:view"] } },
  { paths: ["/app/crm/clients/:clientId/portail"], requirement: { anyOf: ["client-portal-account:view"] } },
  { paths: ["/app/production/contrats/:contratId/avenants/:code"], requirement: { anyOf: ["avenant:create","avenant:update-draft","avenant:rectify"] } },
  { paths: ["/app/production/contrats/:contratId/pieces-jointes"], requirement: { anyOf: ["piece-jointe:view","contrat:view"] } },
  { paths: ["/app/production/contrats/:contratId/assistance"], requirement: { anyOf: ["assistance:view"] } },
  { paths: ["/app/production/contrats/:contratId/cartes-vertes"], requirement: { anyOf: ["carte-verte:view"] } },
  { paths: ["/app/production/attestations-stock", "/app/production/attestations-stock/commandes", "/app/production/attestations-stock/receptions"], requirement: { anyOf: ["attestation-stock:view"] } },
  { paths: ["/app/compta"], requirement: { anyPrefix: MODULE_PERMISSION_PREFIXES.compta } },
  { paths: ["/app/compta/parametres"], requirement: { anyOf: ["banque:view","reglement-client:configure","compte-tresorerie:view","regle-quittance:view"] } },
  { paths: ["/app/compta/parametres/banques"], requirement: { anyOf: ["banque:view"] } },
  { paths: ["/app/compta/parametres/reglements-clients"], requirement: { anyOf: ["reglement-client:configure"] } },
  { paths: ["/app/compta/quittances"], requirement: { anyOf: ["quittance-affectation:view"] } },
  { paths: ["/app/compta/releves-factures"], requirement: { anyOf: ["document-client:view"] } },
  { paths: ["/app/compta/facturation-conventions", "/app/compta/conventions/factures"], requirement: { anyOf: ["facture-convention:view"] } },
  { paths: ["/app/compta/conventions"], requirement: { anyOf: ["production-convention:view","facture-convention:view","reglement-client:view"] } },
  { paths: ["/app/compta/conventions/encaissements", "/app/compta/reglements", "/app/compta/reglements/versement-multi-clients", "/app/compta/reglements/historique", "/app/compta/reglements/validation", "/app/compta/reglements/etat-encaissements", "/app/compta/reglements/:reglementId"], requirement: { anyOf: ["reglement-client:view"] } },
  { paths: ["/app/compta/conventions/encaissements/nouveau", "/app/compta/reglements/nouveau"], requirement: { anyOf: ["reglement-client:create","reglement-client:refund"] } },
  { paths: ["/app/compta/conventions/production"], requirement: { anyOf: ["production-convention:view"] } },
  { paths: ["/app/compta/bordereaux-compagnies", "/app/compta/bordereaux-compagnies/:bordereauId"], requirement: { anyOf: ["bordereau-compagnie:view"] } },
  { paths: ["/app/compta/bordereaux-compagnies/nouveau"], requirement: { anyOf: ["bordereau-compagnie:create"] } },
  { paths: ["/app/compta/bordereaux-compagnies/reglement"], requirement: { anyOf: ["reglement-compagnie:create"] } },
  { paths: ["/app/compta/bordereaux-compagnies/:bordereauId/modifier"], requirement: { anyOf: ["bordereau-compagnie:update"] } },
  { paths: ["/app/compta/tresorerie", "/app/compta/tresorerie/comptes", "/app/compta/tresorerie/comptes/:accountId"], requirement: { anyOf: ["compte-tresorerie:view"] } },
  { paths: ["/app/compta/tresorerie/instruments", "/app/compta/tresorerie/encaissements-en-attente", "/app/compta/tresorerie/impayes-clients"], requirement: { anyOf: ["instrument-reglement:view"] } },
  { paths: ["/app/compta/tresorerie/bordereaux-remise", "/app/compta/tresorerie/bordereaux-remise/:bordereauId"], requirement: { anyOf: ["bordereau-remise:view"] } },
  { paths: ["/app/compta/tresorerie/bordereaux-remise/nouveau"], requirement: { anyOf: ["bordereau-remise:create"] } },
  { paths: ["/app/compta/tresorerie/journal", "/app/compta/tresorerie/operations"], requirement: { anyOf: ["operation-tresorerie:view"] } },
  { paths: ["/app/compta/tresorerie/rapprochement-bancaire"], requirement: { anyOf: ["rapprochement-bancaire:view"] } },
  { paths: ["/app/compta/tresorerie/sessions-caisse"], requirement: { anyOf: ["session-caisse:view"] } },
  { paths: ["/app/crm/parametres", "/app/crm/parametres/origines-commerciales"], requirement: { anyOf: ["origine-commerciale:view"] } },
  { paths: ["/app/companies"], requirement: { anyPrefix: MODULE_PERMISSION_PREFIXES.companies } },
  { paths: ["/app/companies/liste"], requirement: { anyOf: ["compagnie-assurance:view"] } },
  { paths: ["/app/companies/conventions"], requirement: { anyOf: ["convention:view"] } },
  { paths: ["/app/companies/grilles-tarifaires"], requirement: { anyOf: ["grille-tarifaire:view"] } },
  { paths: ["/app/companies/contacts"], requirement: { anyOf: ["contact-compagnie:view"] } },
  { paths: ["/app/companies/assistance"], requirement: { anyOf: ["compagnie-assistance:view"] } },
  { paths: ["/app/companies/assistance/produits"], requirement: { anyOf: ["produit-assistance:view"] } },
  { paths: ["/app/admin"], requirement: { anyPrefix: MODULE_PERMISSION_PREFIXES.administration } },
  { paths: ["/app/admin/utilisateurs"], requirement: { anyOf: ["user:view","config:view"] } },
  { paths: ["/app/admin/roles", "/app/admin/roles/:roleId"], requirement: { anyOf: ["role:view","config:view"] } },
  { paths: ["/app/admin/audit"], requirement: { anyOf: ["audit:view"] } },
  { paths: ["/app/admin/activite"], requirement: { anyOf: ["activity:view"] } },
  { paths: ["/app/admin/agence", "/app/admin/agences"], requirement: { anyOf: ["agence:view","agence:manage-self","config:view"] } },
  { paths: ["/app/admin/administrateurs-plateforme"], requirement: { anyOf: ["config:manage"] } },
  { paths: ["/app/production/parametres"], requirement: { anyOf: ["usage:view","marque:view","carrosserie:view","carburant:view","sous-classe:view","categorie-transport:view","categorie-client:view","groupe-usage-attestation:view","tarif-usage:view","type-piece-jointe:view","garantie:view","regle-fiscale:view"] } },
  { paths: ["/app/production/parametres/tarifs-usage"], requirement: { anyOf: ["tarif-usage:view"] } },
  { paths: ["/app/production/parametres/usages"], requirement: { anyOf: ["usage:view"] } },
  { paths: ["/app/production/parametres/groupes-stock-attestations"], requirement: { anyOf: ["groupe-usage-attestation:view"] } },
  { paths: ["/app/production/parametres/categories-client"], requirement: { anyOf: ["categorie-client:view"] } },
  { paths: ["/app/production/parametres/garanties"], requirement: { anyOf: ["garantie:view"] } },
  { paths: ["/app/production/parametres/marques"], requirement: { anyOf: ["marque:view"] } },
  { paths: ["/app/production/parametres/carrosseries"], requirement: { anyOf: ["carrosserie:view"] } },
  { paths: ["/app/production/parametres/carburants"], requirement: { anyOf: ["carburant:view"] } },
  { paths: ["/app/production/parametres/sous-classes"], requirement: { anyOf: ["sous-classe:view"] } },
  { paths: ["/app/production/parametres/categories-transport"], requirement: { anyOf: ["categorie-transport:view"] } },
  { paths: ["/app/production/parametres/pieces-jointes"], requirement: { anyOf: ["type-piece-jointe:view"] } },
  { paths: ["/app/production/parametres/regles-fiscales"], requirement: { anyOf: ["regle-fiscale:view"] } },
];

function matchesRoute(pattern: string, pathname: string) {
  const expected = pattern.split("/");
  const actual = pathname.replace(/\/$/, "").split("/");
  return expected.length === actual.length
    && expected.every((part, index) => part.startsWith(":") ? Boolean(actual[index]) : part === actual[index]);
}

export function hasAnyPermission(
  permissions: readonly string[],
  required: readonly string[]
) {
  return required.some((permission) => permissions.includes(permission));
}

export function satisfiesPermissionRequirement(
  permissions: readonly string[],
  requirement: PermissionRequirement
) {
  const exactMatch = requirement.anyOf?.some((permission) => permissions.includes(permission)) ?? false;
  const prefixMatch = requirement.anyPrefix?.some((prefix) =>
    permissions.some((permission) => permission.startsWith(`${prefix}:`))
  ) ?? false;
  return exactMatch || prefixMatch;
}

export function permissionRequirementForPath(
  pathname: string
): PermissionRequirement | null {
  const rule = pagePermissionRules.flatMap(candidate => candidate.paths
    .filter(pattern => matchesRoute(pattern, pathname))
    .map(pattern => ({ requirement: candidate.requirement,
      specificity: pattern.split("/").filter(part => !part.startsWith(":")).length })))
    .sort((left, right) => right.specificity - left.specificity)[0];
  if (rule) return rule.requirement;
  // An unregistered operational page is denied until its policy is declared.
  return /^\/app\/(production|sinistre|companies|crm|compta|admin)(\/|$)/.test(pathname) ? { anyOf: [] } : null;
}

export function canAccessPath(permissions: readonly string[], pathname: string) {
  const requirement = permissionRequirementForPath(pathname);
  return requirement === null || satisfiesPermissionRequirement(permissions, requirement);
}
