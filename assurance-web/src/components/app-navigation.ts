import {
  BadgeCheck,
  Boxes,
  Building2,
  Calculator,
  FilePlus2,
  Files,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppModule = {
  title: string;
  url: string;
  icon: LucideIcon;
  exact?: boolean;
  disabled?: boolean;
  permission?: string;
};

export type AppNavigationItem = AppModule & {
  module: "dashboard" | "production" | "sinistre" | "companies" | "crm" | "compta" | "admin";
};

export const appModules: AppModule[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, exact: true },
  { title: "Production", url: "/app/production", icon: BadgeCheck, permission: "contrat:view" },
  { title: "Sinistre", url: "/app/sinistre", icon: LifeBuoy, disabled: true },
  { title: "Companies", url: "/app/companies", icon: Building2, permission: "config:view" },
  { title: "CRM", url: "/app/crm", icon: Users, disabled: true },
  { title: "Compta", url: "/app/compta/quittances", icon: Calculator, permission: "quittance:view" },
  { title: "Admin", url: "/app/admin", icon: Settings, disabled: true, permission: "config:view" },
];

export const appNavigation: AppNavigationItem[] = [
  { module: "dashboard", title: "Vue générale", url: "/app", icon: LayoutDashboard, exact: true },
  { module: "production", title: "Tableau de bord", url: "/app/production", icon: ShieldCheck, exact: true, permission: "contrat:view" },
  { module: "production", title: "Ajouter dossier", url: "/app/production/ajouter-dossier", icon: FilePlus2, permission: "contrat:create" },
  { module: "production", title: "Contrats", url: "/app/production/contrats", icon: Files, permission: "contrat:view" },
  { module: "production", title: "Stock attestations", url: "/app/production/attestations-stock", icon: Boxes, permission: "contrat:view" },
  { module: "production", title: "Paramètres", url: "/app/production/parametres", icon: Settings, permission: "config:view" },
  { module: "companies", title: "Compagnies", url: "/app/companies", icon: Building2, permission: "config:view" },
  { module: "compta", title: "Quittances", url: "/app/compta/quittances", icon: Calculator, permission: "quittance:view" },
];

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
    case "production":
      return "bg-emerald-600 text-white";
    case "sinistre":
      return "bg-sky-600 text-white";
    case "companies":
      return "bg-amber-600 text-white";
    case "crm":
      return "bg-blue-600 text-white";
    case "compta":
      return "bg-orange-600 text-white";
    case "admin":
      return "bg-fuchsia-700 text-white";
    default:
      return "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950";
  }
}
