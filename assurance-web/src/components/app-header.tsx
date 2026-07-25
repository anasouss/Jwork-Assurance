import { Link, NavLink, useLocation } from "react-router-dom";
import { BadgeCheck, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { appModules, moduleActiveClass, moduleForPath } from "@/components/app-navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAuthStore } from "@/store/auth-store";

const titles: Record<string, string> = {
  "/app": "Tableau de bord",
  "/app/production": "Production",
  "/app/production/ajouter-dossier": "Ajouter dossier",
  "/app/production/contrats": "Contrats",
  "/app/production/attestations-stock": "Stock attestations",
  "/app/compta/quittances": "Quittances",
  "/app/production/parametres": "Paramètres production",
};

export function AppHeader() {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const title = titles[pathname] ?? "Production";
  const canCreateContrat = user?.permissions?.includes("contrat:create") ?? false;
  const permissions = user?.permissions ?? [];
  const activeModule = moduleForPath(pathname);

  return (
    <header className="sticky top-0 z-20 flex min-h-16 shrink-0 flex-col border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-h-16 w-full items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ms-1" />
          <Link to="/app" className="flex min-w-0 items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BadgeCheck className="size-5" />
            </span>
            <span className="hidden min-w-0 leading-tight sm:grid">
              <span className="truncate text-sm font-semibold">Assurance</span>
              <span className="truncate text-xs text-muted-foreground">Plateforme agence</span>
            </span>
          </Link>
          <Separator orientation="vertical" className="hidden h-5 md:block" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to="/app">Assurance</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden text-right text-xs text-muted-foreground md:block">
            <div className="font-medium text-foreground">{user?.agenceName ?? "Agence"}</div>
            <div>{user?.roleName ?? user?.roleCode}</div>
          </div>
          {canCreateContrat ? (
            <Button asChild size="sm">
              <Link to="/app/production/ajouter-dossier">
                <FilePlus2 className="size-4" />
                Ajouter dossier
              </Link>
            </Button>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
      <nav className="flex min-h-11 items-center gap-1 overflow-x-auto px-4 pb-2">
        {appModules
          .filter((item) => !item.permission || permissions.includes(item.permission))
          .map((item) => {
            if (item.disabled) {
              return (
                <button
                  key={item.url}
                  type="button"
                  disabled
                  className="flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground/55"
                >
                  <item.icon className="size-4" />
                  {item.title}
                </button>
              );
            }

            const itemModule = moduleForPath(item.url);
            const isActive = activeModule === itemModule;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={[
                  "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors",
                  isActive ? moduleActiveClass(itemModule) : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <item.icon className="size-4" />
                {item.title}
              </NavLink>
            );
          })}
      </nav>
    </header>
  );
}
