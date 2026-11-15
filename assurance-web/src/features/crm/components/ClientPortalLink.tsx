import { Link } from "react-router-dom";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientPortalAvailability } from "../client-portal-api";

export function ClientPortalLink({ clientId, onClick }: { clientId: string; onClick?: () => void }) {
  const feature = useClientPortalAvailability();
  if (!feature.data?.enabled || feature.isError) return null;
  return <Button asChild variant="outline" size="sm">
    <Link to={`/app/crm/clients/${encodeURIComponent(clientId)}/portail`} onClick={onClick}>
      <Smartphone className="size-4" />Portail client
    </Link>
  </Button>;
}
