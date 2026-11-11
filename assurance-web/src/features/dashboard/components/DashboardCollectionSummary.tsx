import { useQuery } from "@tanstack/react-query";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { comptaApi } from "@/features/compta/api";
import { formatMoney } from "@/features/production/utils/format";
import { useAuthStore } from "@/store/auth-store";
import { formatTreasuryDate } from "@/features/compta/pages/treasury-format";

export function DashboardCollectionSummary({ dateReference }: { dateReference: string }) {
  const user = useAuthStore(state => state.user);
  const canReadBalances = user?.permissions.includes("quittance:view") ?? false;
  const canReadTreasury = user?.permissions.includes("tresorerie:view") ?? false;
  const balances = useQuery({
    queryKey: ["agency-dashboard", "collections", user?.agenceId, "balances"],
    queryFn: () => comptaApi.searchClientDocumentSources({ page: 0, size: 1 }),
    enabled: canReadBalances,
    staleTime: 60_000,
  });
  const cheques = useQuery({
    queryKey: ["agency-dashboard", "collections", user?.agenceId, "cheques"],
    queryFn: () => comptaApi.paymentInstruments({
      mode: "CHEQUE", statuts: ["EN_ATTENTE", "REMIS_EN_BANQUE"], page: 0, size: 1,
    }),
    enabled: canReadTreasury,
    staleTime: 60_000,
  });
  const rejections = useQuery({
    queryKey: ["agency-dashboard", "collections", user?.agenceId, "rejections"],
    queryFn: () => comptaApi.bankRejections({ page: 0, size: 1 }),
    enabled: canReadTreasury,
    staleTime: 60_000,
  });
  if (!canReadBalances && !canReadTreasury) return null;
  const indicators = [
    ...(canReadBalances ? [{
      label: "Reste à encaisser", detail: "Créances facturées et non facturées",
      value: balances.data ? formatMoney(balances.data.summary.soldeImpaye) : undefined,
      href: "/app/compta/releves-factures?tab=sources", query: balances,
    }] : []),
    ...(canReadTreasury ? [{
      label: "Chèques à encaisser", detail: "En attente ou remis en banque",
      value: cheques.data?.page.totalElements.toLocaleString("fr-FR"),
      href: "/app/compta/tresorerie/encaissements-en-attente?mode=CHEQUE&recherche=1", query: cheques,
    }, {
      label: "Rejets bancaires", detail: "Chèques et effets du registre des rejets",
      value: rejections.data?.page.totalElements.toLocaleString("fr-FR"),
      href: "/app/compta/tresorerie/impayes-clients", query: rejections,
    }] : []),
  ];
  return <section aria-labelledby="collection-summary-title" className="min-w-0 border-y bg-card">
    <div className="border-b bg-foreground/[0.06] px-4 py-3">
      <h2 id="collection-summary-title" className="text-base font-semibold">Encaissements actuels</h2>
      <p className="mt-1 text-xs text-muted-foreground">Situation au {formatTreasuryDate(dateReference)}</p>
    </div>
    <div className="divide-y px-4">
      {indicators.map(indicator => <div key={indicator.label} className="min-w-0">
        <Link to={indicator.href} className="group grid grid-cols-[minmax(0,1fr)_16px] items-center gap-x-3 gap-y-2 rounded-sm py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_16px]">
          <div className="min-w-0">
            <p className="text-sm font-medium group-hover:underline">{indicator.label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{indicator.detail}</p>
          </div>
          <div className="col-start-1 row-start-2 break-words text-lg font-semibold tabular-nums sm:col-start-2 sm:row-start-1 sm:text-right">{indicator.query.isPending ? <Skeleton className="h-6 w-20" /> : indicator.query.isError ? "-" : indicator.value}</div>
          <ArrowRight aria-hidden="true" className="col-start-2 row-start-1 size-4 shrink-0 text-muted-foreground sm:col-start-3" />
        </Link>
        {indicator.query.isError && <div role="alert" className="mt-1 flex items-center gap-2 text-xs text-destructive">
          Indicateur indisponible
          <Button variant="ghost" size="icon" className="size-7" aria-label={`Recharger : ${indicator.label}`} title="Réessayer" onClick={() => void indicator.query.refetch()}>
            <RefreshCw className="size-3.5" />
          </Button>
        </div>}
      </div>)}
    </div>
  </section>;
}
