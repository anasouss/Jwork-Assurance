import { useQuery } from "@tanstack/react-query";
import { ClientDetailsDialog } from "@/features/crm/components/ClientDetailsDialog";
import { comptaApi } from "../api";
import type { PaymentInstrument } from "../types";

export function BankRejectionPayerDialog({ instrument, onClose }: { instrument: PaymentInstrument; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["compta", "treasury", "bank-rejections", instrument.id, "payer"],
    queryFn: () => comptaApi.bankRejectionPayer(instrument.id),
  });
  return <ClientDetailsDialog
    name={instrument.payeurNom}
    data={query.data}
    loading={query.isPending}
    error={query.isError ? query.error instanceof Error ? query.error.message : "Chargement impossible" : undefined}
    onRetry={() => void query.refetch()}
    onClose={onClose}
  />;
}
