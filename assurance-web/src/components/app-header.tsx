import { Link, useLocation } from "react-router-dom";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
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

  return (
    <header className="flex h-16 shrink-0 items-center gap-2">
      <div className="flex w-full items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-2 h-4" />
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

        <div className="flex items-center gap-2">
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
    </header>
  );
}
