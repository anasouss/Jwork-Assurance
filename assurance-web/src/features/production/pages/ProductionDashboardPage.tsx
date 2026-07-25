import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Calculator, FilePlus2, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { productionApi } from "../api";
import { useAuthStore } from "@/store/auth-store";

export default function ProductionDashboardPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreateContrat = permissions.includes("contrat:create");
  const contrats = useQuery({ queryKey: ["contrats"], queryFn: productionApi.listContrats });
  const items = [
    { title: "Contrats", value: contrats.data?.length ?? 0, icon: Files, href: "/app/production/contrats" },
    { title: "Ajouter dossier", value: "AN", icon: FilePlus2, href: "/app/production/ajouter-dossier" },
    { title: "Stock attestations", value: "ACTIF", icon: Boxes, href: "/app/production/attestations-stock" },
    { title: "Quittances", value: "COMPTA", icon: Calculator, href: "/app/compta/quittances" },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tableau de bord production</h1>
          <p className="text-sm text-muted-foreground">Vue opérationnelle des contrats automobile.</p>
        </div>
        {canCreateContrat ? (
          <Button asChild>
            <Link to="/app/production/ajouter-dossier">
              <FilePlus2 className="size-4" />
              Ajouter dossier
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
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
