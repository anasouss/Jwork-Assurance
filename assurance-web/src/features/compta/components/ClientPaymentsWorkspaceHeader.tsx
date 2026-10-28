import type { ReactNode } from "react";
import { Landmark } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PaymentsView = "receivables" | "saved" | "journal";

const VIEW_PATHS: Record<PaymentsView, string> = {
  receivables: "/app/compta/reglements",
  saved: "/app/compta/reglements/historique",
  journal: "/app/compta/reglements/historique?vue=journal",
};

export function ClientPaymentsWorkspaceHeader({
  title,
  description,
  canCreate = false,
  showViewSelector = true,
  actions,
}: {
  title: string;
  description: string;
  canCreate?: boolean;
  showViewSelector?: boolean;
  actions?: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const view = currentView(location.pathname, location.search);

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">
          Comptabilité
        </div>
        <h1 className="mt-1 text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {showViewSelector ? <div className="grid min-w-60 gap-1.5">
          <Label htmlFor="client-payments-view" className="text-xs text-muted-foreground">
            Vue
          </Label>
          <Select value={view} onValueChange={(value) => navigate(VIEW_PATHS[value as PaymentsView])}>
            <SelectTrigger id="client-payments-view" aria-label="Changer la vue des règlements clients">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receivables">Primes à encaisser</SelectItem>
              <SelectItem value="saved">Règlements enregistrés</SelectItem>
              <SelectItem value="journal">Journal des règlements</SelectItem>
            </SelectContent>
          </Select>
        </div> : null}
        {canCreate ? (
          <Button asChild>
            <Link to="/app/compta/reglements/versement-multi-clients">
              <Landmark className="size-4" />
              Nouveau versement multi-clients
            </Link>
          </Button>
        ) : null}
        {actions}
      </div>
    </header>
  );
}

function currentView(pathname: string, search: string): PaymentsView {
  if (pathname.endsWith("/historique")) {
    const params = new URLSearchParams(search);
    return params.get("vue") === "journal" || params.get("journal") === "1"
      ? "journal"
      : "saved";
  }
  return "receivables";
}
