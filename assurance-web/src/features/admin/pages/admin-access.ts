import { useAuthStore } from "@/store/auth-store";

export type AdminSection = {
  key: string;
  label: string;
  title: string;
  description: string;
};

export function useAdminAccess() {
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions ?? [];
  const canViewUsers = hasAny(permissions, "user:view", "config:view", "config:manage");
  const canViewRoles = hasAny(permissions, "role:view", "config:view", "config:manage");
  const canViewAudit = permissions.includes("audit:view");
  const canViewActivity = permissions.includes("activity:view");
  const capability = (code: string) => hasAny(permissions, code, "config:manage");
  const userRights = {
    create: capability("user:create"),
    update: capability("user:update"),
    deactivate: capability("user:deactivate"),
    resetPassword: capability("user:reset-password"),
    revokeSession: capability("user:revoke-session"),
    assignRole: capability("user:assign-role"),
  };
  const roleRights = {
    create: capability("role:create"),
    update: capability("role:update"),
    delete: capability("role:delete"),
    assignPermissions: capability("role:assign-permissions"),
  };
  const canManagePlatformAgencies = hasAny(permissions, "agence:update", "config:manage");
  const canManageOwnAgency = permissions.includes("agence:manage-self");
  const canViewAgencies = hasAny(permissions, "agence:view", "config:view");
  const canAccessAgencySettings = canViewAgencies || canManageOwnAgency || canManagePlatformAgencies;
  const isPlatformAdmin = Boolean(user?.platformAdmin);
  const isPlatformMode = isPlatformAdmin && user?.operatingMode === "PLATFORM";
  const agencySection = isPlatformMode ? "agences" : "agence";

  const sections: AdminSection[] = [
    canViewUsers ? { key: "utilisateurs", label: "Utilisateurs", title: "Utilisateurs", description: "Comptes, rôles et appareils connectés de l’agence." } : null,
    canViewRoles ? { key: "roles", label: "Rôles & permissions", title: "Rôles et permissions", description: "Autorisations par module et périmètre d’agence." } : null,
    canViewAudit ? { key: "audit", label: "Audit technique", title: "Journal d’audit technique", description: "Traces techniques et changements des données de l’application." } : null,
    canViewActivity ? { key: "activite", label: "Activité métier", title: "Activité métier", description: "Opérations réalisées dans les modules et informations concernées." } : null,
    canAccessAgencySettings ? { key: agencySection, label: isPlatformMode ? "Agences" : "Mon agence", title: isPlatformMode ? "Agences" : "Mon agence", description: isPlatformMode ? "Organisation et identité des agences de la plateforme." : "Identité, coordonnées et documents de l’agence." } : null,
    isPlatformMode ? { key: "administrateurs-plateforme", label: "Administrateurs plateforme", title: "Administrateurs plateforme", description: "Comptes disposant d’un accès global à la plateforme." } : null,
  ].filter((item): item is AdminSection => Boolean(item));

  return {
    user,
    sections,
    defaultPath: `/app/admin/${sections[0]?.key ?? "utilisateurs"}`,
    agencySection,
    canViewUsers,
    canViewRoles,
    canViewAudit,
    canViewActivity,
    userRights,
    roleRights,
    canCreateAgencies: capability("agence:create"),
    canManagePlatformAgencies,
    canManageOwnAgency,
    canAccessAgencySettings,
    isPlatformMode,
  };
}

function hasAny(permissions: readonly string[], ...expected: string[]) {
  return expected.some((permission) => permissions.includes(permission));
}
