import { Link } from "react-router-dom";
import {
  Archive,
  CalendarDays,
  FilePlus2,
  FileText,
  List,
  Plus,
  Target,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export default function ProductionDashboardPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);

  const actions = [
    { title: "Ajouter un dossier", icon: FilePlus2, href: "/app/production/ajouter-dossier", permission: "contrat:create", primary: true },
    { title: "Ajouter un avenant", icon: Plus, href: "/app/production/contrats", permission: "contrat:update" },
    { title: "Liste des dossiers", icon: List, href: "/app/production/contrats", permission: "contrat:view" },
    { title: "Gestion des échéances", icon: CalendarDays, href: "/app/production/contrats", permission: "contrat:view" },
    { title: "Registre de production", icon: FileText, href: "/app/production/contrats", permission: "contrat:view" },
    { title: "Portefeuille client", icon: Users, href: "/app/production/contrats", permission: "client:view" },
    { title: "Prospection", icon: Target, href: "/app/production", permission: "contrat:view", disabled: true },
    { title: "Gestion du stock", icon: Archive, href: "/app/production/attestations-stock", permission: "contrat:view" },
  ].filter((item) => !item.permission || permissions.includes(item.permission));

  return (
    <div className="grid gap-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Production</div>
        <div className="mt-1">
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Module production</h1>
          <p className="text-sm text-muted-foreground">Choisissez l'opération à effectuer.</p>
        </div>
      </div>

      <section className="-mx-4 border-y bg-card px-4 py-5">
        <div className="mx-auto grid w-full max-w-7xl gap-3 md:grid-cols-2 xl:grid-cols-4">
          {actions.map((item) => {
            const content = (
              <>
                <span className={item.primary ? "text-white" : "text-emerald-700 dark:text-emerald-400"}>
                  <item.icon className="size-4" />
                </span>
                <span>{item.title}</span>
              </>
            );
            const className = item.primary
              ? "flex h-12 items-center gap-3 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              : "flex h-12 items-center gap-3 rounded-md border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-200";

            if (item.disabled) {
              return (
                <button
                  key={item.title}
                  type="button"
                  disabled
                  className="flex h-12 items-center gap-3 rounded-md border border-dashed bg-muted/30 px-4 text-sm font-semibold text-muted-foreground"
                >
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
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
