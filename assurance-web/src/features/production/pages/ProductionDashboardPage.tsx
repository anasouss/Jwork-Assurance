import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  Boxes,
  Calculator,
  CalendarDays,
  FilePlus2,
  Files,
  FileText,
  List,
  Plus,
  Target,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { productionApi } from "../api";
import { useAuthStore } from "@/store/auth-store";

export default function ProductionDashboardPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const contrats = useQuery({ queryKey: ["contrats"], queryFn: productionApi.listContrats });

  const actions = [
    { title: "Ajouter un dossier", icon: FilePlus2, href: "/app/production/ajouter-dossier", permission: "contrat:create" },
    { title: "Ajouter un avenant", icon: Plus, href: "/app/production/contrats", permission: "contrat:update" },
    { title: "Liste des dossiers", icon: List, href: "/app/production/contrats", permission: "contrat:view" },
    { title: "Gestion des échéances", icon: CalendarDays, href: "/app/production/contrats", permission: "contrat:view" },
    { title: "Registre de production", icon: FileText, href: "/app/production/contrats", permission: "contrat:view" },
    { title: "Portefeuille client", icon: Users, href: "/app/production/contrats", permission: "client:view" },
    { title: "Prospection", icon: Target, href: "/app/production", permission: "contrat:view", disabled: true },
    { title: "Gestion du stock", icon: Archive, href: "/app/production/attestations-stock", permission: "contrat:view" },
  ].filter((item) => !item.permission || permissions.includes(item.permission));

  const items = [
    { title: "Contrats", value: contrats.data?.length ?? 0, icon: Files, href: "/app/production/contrats" },
    { title: "Stock attestations", value: "ACTIF", icon: Boxes, href: "/app/production/attestations-stock" },
    { title: "Quittances", value: "COMPTA", icon: Calculator, href: "/app/compta/quittances" },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Production</div>
        <div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Tableau de bord production</h1>
          <p className="text-sm text-muted-foreground">Vue opérationnelle des contrats automobile.</p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {actions.map((item) => {
          const content = (
            <>
              <item.icon className="size-4" />
              <span>{item.title}</span>
            </>
          );
          const className = "flex h-11 items-center gap-3 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700";

          if (item.disabled) {
            return (
              <button
                key={item.title}
                type="button"
                disabled
                className="flex h-11 items-center gap-3 rounded-md bg-muted px-4 text-sm font-semibold text-muted-foreground"
              >
                {content}
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

      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <Link key={item.title} to={item.href}>
            <Card className="h-full border-border/70 shadow-none transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <item.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{item.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="border-border/70 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Derniers contrats</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(contrats.data ?? []).slice(0, 6).map((contrat) => (
            <Link key={contrat.id} to="/app/production/contrats" className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50">
              <div>
                <div className="font-medium">{contrat.numeroContrat}</div>
                <div className="text-xs text-muted-foreground">{contrat.usageCode} {contrat.usageLibelle}</div>
              </div>
              <Badge variant="outline">{contrat.statut}</Badge>
            </Link>
          ))}
          {!contrats.isLoading && !contrats.data?.length ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucun contrat créé.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
