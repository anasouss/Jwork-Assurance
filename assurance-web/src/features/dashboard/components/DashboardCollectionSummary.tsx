import { useQuery } from "@tanstack/react-query";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { comptaApi } from "@/features/compta/api";
import { formatMoney } from "@/features/production/utils/format";
import { useAuthStore } from "@/store/auth-store";

export function DashboardCollectionSummary() {
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
  return <section aria-label="Encaissements actuels" className="border-y py-4">
    <h2 className="mb-3 text-sm font-semibold">Encaissements · situation actuelle</h2>
    <div className="grid gap-4 md:grid-cols-3">
      {indicators.map(indicator => <div key={indicator.label} className="min-w-0">
        <Link to={indicator.href} className="group flex items-start justify-between gap-3 rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="min-w-0">
            <p className="text-sm font-medium group-hover:underline">{indicator.label}</p>
            <div className="mt-1 break-words text-xl font-semibold tabular-nums">{indicator.query.isPending ? <Skeleton className="h-7 w-24" /> : indicator.query.isError ? "-" : indicator.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{indicator.detail}</p>
          </div>
          <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
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
