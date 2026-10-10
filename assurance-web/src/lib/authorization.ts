export type PermissionRequirement = {
  anyOf?: readonly string[];
  anyPrefix?: readonly string[];
};

type RoutePermissionRule = PermissionRequirement & {
  matches: (pathname: string) => boolean;
};

const startsWith = (prefix: string) => (pathname: string) => pathname.startsWith(prefix);

export const MODULE_PERMISSION_PREFIXES = {
  production: ["contrat", "avenant", "attestation-stock", "carte-verte", "piece-jointe", "assistance", "referentiel", "garantie", "grille-tarifaire", "regle-fiscale", "vehicule"],
  sinistre: ["sinistre"],
  companies: ["referentiel", "grille-tarifaire", "contact-compagnie"],
  crm: ["client"],
  compta: ["quittance", "reglement-client", "tresorerie", "bordereau-compagnie", "reglement-compagnie"],
  administration: ["user", "role", "agence", "audit", "config"],
} as const;

const routePermissionRules: readonly RoutePermissionRule[] = [
  {
    matches: startsWith("/app/sinistre/declarer"),
    anyOf: ["sinistre:create"],
  },
  {
    matches: startsWith("/app/sinistre/referentiels"),
    anyOf: ["sinistre:referentiel"],
  },
  {
    matches: startsWith("/app/sinistre"),
    anyPrefix: MODULE_PERMISSION_PREFIXES.sinistre,
  },
  {
    matches: startsWith("/app/companies/contacts"),
    anyOf: ["contact-compagnie:view", "contact-compagnie:manage"],
  },
  {
    matches: startsWith("/app/companies/grilles-tarifaires"),
    anyOf: ["grille-tarifaire:view", "grille-tarifaire:manage", "referentiel:manage"],
  },
  {
    matches: startsWith("/app/production/renouvellements/"),
    anyOf: ["contrat:renew", "contrat:update"],
  },
  {
    matches: (pathname) => pathname.includes("/avenants/"),
    anyOf: [
      "avenant:view",
      "avenant:create",
      "avenant:rectify",
      "contrat:view",
      "contrat:update",
    ],
  },
  {
    matches: startsWith("/app/production/ajouter-dossier"),
    anyOf: ["contrat:create"],
  },
  {
    matches: startsWith("/app/production/prospection"),
    anyOf: ["contrat:create", "contrat:view"],
  },
  {
    matches: startsWith("/app/production/attestations-stock"),
    anyOf: ["attestation-stock:view", "attestation-stock:manage"],
  },
  {
    matches: startsWith("/app/production/parametres/regles-fiscales"),
    anyOf: ["regle-fiscale:view", "regle-fiscale:manage", "config:manage"],
  },
  {
    matches: startsWith("/app/production/parametres"),
    anyOf: ["referentiel:view", "referentiel:manage"],
  },
  {
    matches: startsWith("/app/production"),
    anyPrefix: MODULE_PERMISSION_PREFIXES.production,
  },
  {
    matches: startsWith("/app/compta/reglements"),
    anyOf: ["reglement-client:view", "reglement-client:create", "reglement-client:manage"],
  },
  {
    matches: startsWith("/app/compta/bordereaux-compagnies"),
    anyOf: [
      "bordereau-compagnie:view",
      "bordereau-compagnie:create",
      "bordereau-compagnie:validate",
      "bordereau-compagnie:transmit",
      "bordereau-compagnie:reconcile",
      "bordereau-compagnie:cancel",
      "reglement-compagnie:view",
      "reglement-compagnie:create",
      "reglement-compagnie:manage",
    ],
  },
  {
    matches: startsWith("/app/compta/tresorerie"),
    anyOf: ["tresorerie:view", "tresorerie:manage"],
  },
  {
    matches: startsWith("/app/compta/parametres"),
    anyOf: ["tresorerie:view", "tresorerie:manage"],
  },
  {
    matches: startsWith("/app/compta"),
    anyPrefix: MODULE_PERMISSION_PREFIXES.compta,
  },
  {
    matches: startsWith("/app/crm/parametres"),
    anyOf: ["client:manage"],
  },
  {
    matches: startsWith("/app/crm"),
    anyPrefix: MODULE_PERMISSION_PREFIXES.crm,
  },
  {
    matches: startsWith("/app/companies"),
    anyPrefix: MODULE_PERMISSION_PREFIXES.companies,
  },
  {
    matches: startsWith("/app/admin"),
    anyPrefix: MODULE_PERMISSION_PREFIXES.administration,
  },
];

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
  const rule = routePermissionRules.find((candidate) => candidate.matches(pathname));
  return rule ? { anyOf: rule.anyOf, anyPrefix: rule.anyPrefix } : null;
}
