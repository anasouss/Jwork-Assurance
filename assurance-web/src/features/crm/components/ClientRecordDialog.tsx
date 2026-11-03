import { useQuery } from "@tanstack/react-query";
import { clientApi } from "@/features/production/api/clients";
import { ClientDetailsDialog } from "./ClientDetailsDialog";

export function ClientRecordDialog({ clientId, name, onClose }: {
  clientId: string;
  name?: string;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["crm-client", clientId],
    queryFn: () => clientApi.getClientCrm(clientId),
  });
  const client = query.data?.client;
  const displayName = client?.nomAffichage || client?.raisonSociale
    || [client?.prenom, client?.nom].filter(Boolean).join(" ") || name || "Client";
  return <ClientDetailsDialog
    name={displayName}
    data={client ? {
      groupe: client.groupe?.libelle,
      clients: [{
        ...client,
        nom: displayName,
        code: client.codeClient,
      }],
    } : undefined}
    loading={query.isPending}
    error={query.isError ? query.error instanceof Error ? query.error.message : "Chargement impossible" : undefined}
    onRetry={() => void query.refetch()}
    onClose={onClose}
  />;
}
