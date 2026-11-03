import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { comptaApi } from "../api";
import { ClientPaymentDetails } from "../components/ClientPaymentDetails";

export default function ReglementClientDetailPage() {
  const { reglementId = "" } = useParams();
  const payment = useQuery({
    queryKey: ["compta", "client-payment", reglementId],
    queryFn: () => comptaApi.clientPayment(reglementId),
    enabled: Boolean(reglementId),
  });

  if (payment.isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Chargement du règlement...</div>;
  }
  if (payment.isError || !payment.data) {
    return <div role="alert" className="space-y-3 py-16 text-center text-sm text-muted-foreground">
      <p>{payment.error instanceof Error ? payment.error.message : "Règlement introuvable."}</p>
      <Button variant="outline" onClick={() => void payment.refetch()}>Réessayer</Button>
    </div>;
  }

  return <div className="grid gap-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <Button asChild variant="ghost" className="mb-2 -ml-3">
          <Link to="/app/compta/reglements/historique"><ArrowLeft className="size-4" />Retour aux règlements</Link>
        </Button>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
        <h1 className="mt-1 text-xl font-semibold">{payment.data.numero}</h1>
        <p className="text-sm text-muted-foreground">Détail du règlement client.</p>
      </div>
      <Badge variant={payment.data.statut === "VALIDE" ? "success" : "red"}>{payment.data.statut === "VALIDE" ? "Enregistré" : "Annulé"}</Badge>
    </header>
    <ClientPaymentDetails payment={payment.data} />
  </div>;
}

