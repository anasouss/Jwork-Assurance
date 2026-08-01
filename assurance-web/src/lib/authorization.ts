export type PermissionRequirement = {
  anyOf: readonly string[];
};

type RoutePermissionRule = PermissionRequirement & {
  matches: (pathname: string) => boolean;
};

const startsWith = (prefix: string) => (pathname: string) => pathname.startsWith(prefix);

const routePermissionRules: readonly RoutePermissionRule[] = [
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
    matches: startsWith("/app/production/parametres"),
    anyOf: ["referentiel:view", "referentiel:manage"],
  },
  {
    matches: startsWith("/app/production"),
    anyOf: ["contrat:view", "contrat:create", "contrat:update"],
  },
  {
    matches: startsWith("/app/compta"),
    anyOf: ["quittance:view", "quittance:create", "quittance:manage"],
  },
  {
    matches: startsWith("/app/crm"),
    anyOf: ["client:view", "client:create", "client:manage"],
  },
  {
    matches: startsWith("/app/companies"),
    anyOf: ["referentiel:view", "referentiel:manage"],
  },
  {
    matches: startsWith("/app/admin"),
    anyOf: ["user:view", "user:manage", "config:view", "config:manage"],
  },
];

export function hasAnyPermission(
  permissions: readonly string[],
  required: readonly string[]
) {
  return required.some((permission) => permissions.includes(permission));
}

export function permissionRequirementForPath(
  pathname: string
): PermissionRequirement | null {
  const rule = routePermissionRules.find((candidate) => candidate.matches(pathname));
  return rule ? { anyOf: rule.anyOf } : null;
}
