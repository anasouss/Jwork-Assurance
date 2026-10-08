import {
  BadgeCheck,
  Boxes,
  Building2,
  Calculator,
  ClipboardList,
  FilePlus2,
  FileText,
  Files,
  Hourglass,
  LayoutDashboard,
  LifeBuoy,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MODULE_PERMISSION_PREFIXES } from "@/lib/authorization";

export type AppModule = {
  title: string;
  url: string;
  icon: LucideIcon;
  exact?: boolean;
  disabled?: boolean;
  permission?: string;
  permissions?: readonly string[];
  permissionPrefixes?: readonly string[];
  requiresAgencyContext?: boolean;
  platformOnly?: boolean;
};

export type AppNavigationItem = AppModule & {
  module: "dashboard" | "production" | "sinistre" | "companies" | "crm" | "compta" | "admin";
};

export const appModules: AppModule[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, exact: true, permissions: ["contrat:view", "quittance:view"] },
  { title: "Production", url: "/app/production", icon: BadgeCheck, permissionPrefixes: MODULE_PERMISSION_PREFIXES.production },
  { title: "Sinistre", url: "/app/sinistre", icon: LifeBuoy, permissionPrefixes: MODULE_PERMISSION_PREFIXES.sinistre },
  { title: "Compagnies", url: "/app/companies", icon: Building2, permissionPrefixes: MODULE_PERMISSION_PREFIXES.companies },
  { title: "CRM", url: "/app/crm", icon: Users, permissionPrefixes: MODULE_PERMISSION_PREFIXES.crm },
  {
    title: "Compta",
    url: "/app/compta",
    icon: Calculator,
    permissionPrefixes: MODULE_PERMISSION_PREFIXES.compta,
  },
  { title: "Administration", url: "/app/admin", icon: Settings, permissionPrefixes: MODULE_PERMISSION_PREFIXES.administration },
];

export const appNavigation: AppNavigationItem[] = [
  { module: "dashboard", title: "Vue plateforme", url: "/app/platform", icon: LayoutDashboard, platformOnly: true },
  { module: "dashboard", title: "Vue générale", url: "/app", icon: LayoutDashboard, exact: true, permissions: ["contrat:view", "quittance:view"], requiresAgencyContext: true },
  { module: "production", title: "Tableau de bord", url: "/app/production", icon: ShieldCheck, exact: true, permission: "contrat:view" },
  { module: "production", title: "Ajouter dossier", url: "/app/production/ajouter-dossier", icon: FilePlus2, permission: "contrat:create" },
  { module: "production", title: "Contrats", url: "/app/production/contrats", icon: Files, permission: "contrat:view" },
  { module: "production", title: "Stock attestations", url: "/app/production/attestations-stock", icon: Boxes, permission: "attestation-stock:view" },
  { module: "production", title: "Commandes attestations", url: "/app/production/attestations-stock/commandes", icon: ClipboardList, permission: "attestation-stock:view" },
  { module: "production", title: "Réceptions attestations", url: "/app/production/attestations-stock/receptions", icon: Truck, permission: "attestation-stock:view" },
  { module: "production", title: "Paramètres", url: "/app/production/parametres", icon: Settings, permission: "referentiel:view" },
  { module: "sinistre", title: "Tableau de bord", url: "/app/sinistre", icon: LayoutDashboard, exact: true, permissions: ["sinistre:view", "sinistre:manage", "sinistre:finance"] },
  { module: "sinistre", title: "Dossiers sinistre", url: "/app/sinistre/dossiers", icon: Files, permissions: ["sinistre:view", "sinistre:manage", "sinistre:finance"] },
  { module: "sinistre", title: "Déclarer", url: "/app/sinistre/declarer", icon: FilePlus2, permission: "sinistre:create" },
  { module: "sinistre", title: "Experts & garages", url: "/app/sinistre/referentiels", icon: Users, permission: "sinistre:referentiel" },
  { module: "companies", title: "Module compagnies", url: "/app/companies", icon: Building2, exact: true, permissionPrefixes: MODULE_PERMISSION_PREFIXES.companies },
  { module: "companies", title: "Liste des compagnies", url: "/app/companies/liste", icon: Building2, permission: "referentiel:view" },
  { module: "companies", title: "Conventions", url: "/app/companies/conventions", icon: Files, permission: "referentiel:view" },
  { module: "companies", title: "Grilles tarifaires", url: "/app/companies/grilles-tarifaires", icon: Calculator, permissions: ["grille-tarifaire:view", "grille-tarifaire:manage", "referentiel:manage"] },
  { module: "companies", title: "Contacts", url: "/app/companies/contacts", icon: Users, permissions: ["contact-compagnie:view", "contact-compagnie:manage"] },
  { module: "crm", title: "Portefeuille client", url: "/app/crm", icon: Users, exact: true, permission: "client:view" },
  { module: "crm", title: "Paramètres", url: "/app/crm/parametres", icon: Settings, permission: "client:manage" },
  { module: "compta", title: "Tableau de bord", url: "/app/compta", icon: LayoutDashboard, exact: true, permissions: ["quittance:view", "reglement-client:view", "tresorerie:view", "bordereau-compagnie:view", "reglement-compagnie:view"] },
  { module: "compta", title: "Affectation des quittances", url: "/app/compta/quittances", icon: Calculator, permission: "quittance:view" },
  { module: "compta", title: "Relevés et factures", url: "/app/compta/releves-factures", icon: FileText, permission: "quittance:view" },
  { module: "compta", title: "Facturation conventions", url: "/app/compta/facturation-conventions", icon: ReceiptText, permission: "quittance:view" },
  { module: "compta", title: "Encaissements en attente", url: "/app/compta/tresorerie/encaissements-en-attente", icon: Hourglass, permission: "tresorerie:view" },
  { module: "compta", title: "Bordereaux de remise", url: "/app/compta/tresorerie/bordereaux-remise", icon: ScrollText, permission: "tresorerie:view" },
  { module: "compta", title: "Bordereaux compagnies", url: "/app/compta/bordereaux-compagnies", icon: Building2, permission: "bordereau-compagnie:view" },
  { module: "compta", title: "Paramètres", url: "/app/compta/parametres", icon: Settings, permission: "tresorerie:view" },
  { module: "admin", title: "Utilisateurs", url: "/app/admin/utilisateurs", icon: Users, permissions: ["user:view", "user:manage", "config:view", "config:manage"] },
  { module: "admin", title: "Rôles & permissions", url: "/app/admin/roles", icon: UserCog, permissions: ["role:view", "role:manage", "config:view", "config:manage"] },
  { module: "admin", title: "Audit", url: "/app/admin/audit", icon: ClipboardList, permission: "audit:view" },
  { module: "admin", title: "Mon agence", url: "/app/admin/agence", icon: Building2, permissions: ["agence:view", "agence:manage-self", "config:view"], requiresAgencyContext: true },
  { module: "admin", title: "Agences", url: "/app/admin/agences", icon: Building2, permissions: ["agence:view", "agence:create", "config:view", "config:manage"], platformOnly: true },
  { module: "admin", title: "Administrateurs plateforme", url: "/app/admin/administrateurs-plateforme", icon: ShieldCheck, platformOnly: true },
];

export function canSeeNavigationItem(
  item: AppModule,
  userPermissions: readonly string[],
  context?: { platformAdmin: boolean; hasAgencyContext: boolean }
) {
  if (context) {
    if (item.url === "/app" && item.exact && context.platformAdmin && !context.hasAgencyContext) {
      return true;
    }
    const agencyRequired = item.requiresAgencyContext || routeRequiresAgencyContext(item.url);
    if (agencyRequired && !context.hasAgencyContext) {
      return false;
    }
    if (item.platformOnly && (!context.platformAdmin || context.hasAgencyContext)) {
      return false;
    }
  }
  if (item.permissions?.length) {
    return item.permissions.some((permission) => userPermissions.includes(permission));
  }
  if (item.permissionPrefixes?.length) {
    return item.permissionPrefixes.some((prefix) =>
      userPermissions.some((permission) => permission.startsWith(`${prefix}:`))
    );
  }
  return !item.permission || userPermissions.includes(item.permission);
}

export function moduleLandingPath(
  module: AppNavigationItem["module"],
  userPermissions: readonly string[],
  context: { platformAdmin: boolean; hasAgencyContext: boolean }
) {
  return appNavigation.find((item) =>
    item.module === module && canSeeNavigationItem(item, userPermissions, context)
  )?.url ?? appModules.find((item) => moduleForPath(item.url) === module)?.url ?? "/app";
}

export function firstAccessibleAgencyPath(
  userPermissions: readonly string[],
  context: { platformAdmin: boolean; hasAgencyContext: boolean }
) {
  return appNavigation.find((item) =>
    item.module !== "dashboard" && canSeeNavigationItem(item, userPermissions, context)
  )?.url ?? "/app/profile";
}

export function routeRequiresAgencyContext(pathname: string) {
  return ["/app/production", "/app/sinistre", "/app/companies", "/app/crm", "/app/compta"]
    .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function moduleForPath(pathname: string): AppNavigationItem["module"] {
  if (pathname.startsWith("/app/compta")) {
    return "compta";
  }
  if (pathname.startsWith("/app/production")) {
    return "production";
  }
  if (pathname.startsWith("/app/admin")) {
    return "admin";
  }
  if (pathname.startsWith("/app/sinistre")) {
    return "sinistre";
  }
  if (pathname.startsWith("/app/companies")) {
    return "companies";
  }
  if (pathname.startsWith("/app/crm")) {
    return "crm";
  }
  return "dashboard";
}

export function moduleTitle(module: AppNavigationItem["module"]) {
  return appModules.find((item) => moduleForPath(item.url) === module)?.title ?? "Module";
}

export function moduleActiveClass(module: AppNavigationItem["module"]) {
  switch (module) {
    case "dashboard":
      return "bg-blue-600 text-white";
    case "production":
      return "bg-emerald-600 text-white";
    case "sinistre":
      return "bg-sky-700 text-white";
    case "companies":
      return "bg-amber-600 text-white";
    case "crm":
      return "bg-blue-600 text-white";
    case "compta":
      return "bg-orange-600 text-white";
    case "admin":
      return "bg-fuchsia-700 text-white";
    default:
      return "bg-blue-600 text-white";
  }
}
