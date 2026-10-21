import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DeveloperCredit } from "@/components/shared/developer-credit";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col px-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-3xl font-semibold text-balance">Page introuvable</h1>
        <p className="text-muted-foreground">
          La page demandée n'existe pas ou n'est plus disponible.
        </p>
        <Button asChild>
          <Link to="/">Retour à l'accueil</Link>
        </Button>
      </div>
      <DeveloperCredit className="pb-4 text-right" />
    </div>
  );
}
