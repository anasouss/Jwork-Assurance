import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range";
import { useAuthStore } from "@/store/auth-store";
import { dashboardApi } from "../api";
import { DashboardCollectionSummary } from "../components/DashboardCollectionSummary";
import { DashboardFilters } from "../components/DashboardFilters";
import { DashboardPortfolio } from "../components/DashboardPortfolio";
import { DashboardRecentMovements } from "../components/DashboardRecentMovements";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DashboardWorkQueue } from "../components/DashboardWorkQueue";
import { ProductionCategoryBreakdown } from "../components/ProductionCategoryBreakdown";
import { ProductionKpis } from "../components/ProductionKpis";
import { ProductionTrendChart } from "../components/ProductionTrendChart";

export default function AgencyDashboardPage() {
  const queryClient = useQueryClient();
  const range = useDashboardDateRange("30d");
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const agenceId = useAuthStore((state) => state.user?.agenceId);
  const dashboard = useQuery({
    queryKey: ["agency-dashboard", agenceId, range.fromStr, range.toStr],
    queryFn: () => dashboardApi.get({ dateDu: range.fromStr, dateAu: range.toStr }),
    staleTime: 60_000,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === agenceId ? previousData : undefined,
  });

  if (dashboard.isLoading) {
    return <DashboardSkeleton />;
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <div className="grid max-w-md justify-items-center gap-3 text-center">
          <AlertTriangle className="size-8 text-amber-600" />
          <div>
            <h1 className="font-semibold">Tableau de bord indisponible</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {dashboard.error instanceof Error
                ? dashboard.error.message
                : "Les indicateurs n'ont pas pu être chargés."}
            </p>
          </div>
          <Button variant="outline" onClick={() => dashboard.refetch()}>
            <RefreshCw className="size-4" />
            Réessayer
          </Button>
          {range.activePreset !== "30d" && (
            <Button variant="ghost" onClick={() => range.setPreset("30d")}>Revenir aux 30 derniers jours</Button>
          )}
        </div>
      </div>
    );
  }

  const data = dashboard.data;

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-6" aria-busy={dashboard.isFetching}>
      <header className="flex flex-col justify-between gap-4 border-b pb-5 xl:flex-row xl:items-end">
        <div className="shrink-0">
          <h1 className="text-2xl font-semibold">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">Production et suivi de l’agence</p>
        </div>
        <DashboardFilters range={range} isFetching={dashboard.isFetching}
          canCreate={permissions.includes("contrat:create")}
          onRefresh={() => void queryClient.invalidateQueries({ queryKey: ["agency-dashboard"] })} />
      </header>

      <ProductionKpis data={data} isFetching={dashboard.isFetching} />
      <DashboardWorkQueue data={data} permissions={permissions} />

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]" aria-label="Analyse de la production sur la période">
        <ProductionTrendChart rows={data.productionEvolution} dateFrom={data.dateDu} dateTo={data.dateAu} />
        <ProductionCategoryBreakdown rows={data.productionParCategorie} />
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-2" aria-label="Encaissements et portefeuille">
        <DashboardCollectionSummary dateReference={data.dateReference} />
        <DashboardPortfolio rows={data.portefeuilleParBranche} contractTypes={data.portefeuilleParType}
          total={data.kpis.contratsActifs} activeAssistances={data.kpis.assistancesActives} date={data.dateAu} />
      </section>

      <DashboardRecentMovements rows={data.activitesRecentes} canView={permissions.includes("contrat:view")}
        dateFrom={data.dateDu} dateTo={data.dateAu} />
    </div>
  );
}
