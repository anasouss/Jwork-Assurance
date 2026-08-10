import { Link } from "react-router-dom";
import { Ambulance, Building2, Handshake, Package, TableProperties, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

type CompanyAction = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  permission?: string;
  permissions?: readonly string[];
  primary?: boolean;
  disabled?: boolean;
};

export default function CompaniesDashboardPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);

  const actions: CompanyAction[] = [
    {
      title: "Liste des compagnies",
      description: "Assureurs, ordre d'affichage, RC, ICE et préfixes.",
      icon: Building2,
      href: "/app/companies/liste",
      permission: "referentiel:view",
      primary: true,
    },
    {
      title: "Conventions",
      description: "Produits conventionnés par compagnie.",
      icon: Handshake,
      href: "/app/companies/conventions",
      permission: "referentiel:view",
    },
    {
      title: "Grilles tarifaires",
      description: "Catalogue des grilles et configurations par usage.",
      icon: TableProperties,
      href: "/app/companies/grilles-tarifaires",
      permission: "referentiel:view",
    },
    {
      title: "Assistance",
      description: "Compagnies assistance.",
      icon: Ambulance,
      href: "/app/companies/assistance",
      permission: "referentiel:view",
    },
    {
      title: "Produits assistance",
      description: "Produits, usages et tarifs assistance.",
      icon: Package,
      href: "/app/companies/assistance/produits",
      permission: "referentiel:view",
    },
    {
      title: "Contacts",
      description: "Interlocuteurs compagnie.",
      icon: Users,
      href: "/app/companies/contacts",
      permissions: ["contact-compagnie:view", "contact-compagnie:manage"],
    },
  ].filter((item) => item.permissions?.some((permission) => permissions.includes(permission))
    ?? (!item.permission || permissions.includes(item.permission)));

  return (
    <div className="grid gap-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="text-sm font-medium text-amber-700 dark:text-amber-400">Compagnies</div>
        <div className="mt-1">
          <h1 className="text-xl font-semibold tracking-tight">Module compagnies</h1>
          <p className="text-sm text-muted-foreground">Configurez les assureurs et les produits utilisés par la production.</p>
        </div>
      </div>

      <section className="-mx-4 border-y bg-card px-4 py-5">
        <div className="mx-auto grid w-full max-w-7xl gap-3 md:grid-cols-2 lg:grid-cols-3">
          {actions.map((item) => {
            const content = (
              <>
                <span className={item.primary ? "text-white" : "text-amber-700 dark:text-amber-400"}>
                  <item.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{item.title}</span>
                  <span className={item.primary ? "block truncate text-xs font-normal text-white/80" : "block truncate text-xs font-normal text-muted-foreground"}>
                    {item.description}
                  </span>
                </span>
              </>
            );

            const className = item.primary
              ? "flex h-16 items-center gap-3 rounded-md bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
              : "flex h-16 items-center gap-3 rounded-md border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-900 dark:hover:border-amber-900 dark:hover:bg-amber-950/30 dark:hover:text-amber-200";

            if (item.disabled) {
              return (
                <button
                  key={item.title}
                  type="button"
                  disabled
                  className="flex h-16 items-center gap-3 rounded-md border border-dashed bg-muted/30 px-4 text-left text-sm font-semibold text-muted-foreground"
                >
                  <item.icon className="size-4" />
                  <span className="min-w-0">
                    <span className="block truncate">{item.title}</span>
                    <span className="block truncate text-xs font-normal">{item.description}</span>
                  </span>
                </button>
              );
            }

            return (
              <Link key={item.title} to={item.href} className={className}>
                {content}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
