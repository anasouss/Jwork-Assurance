import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <p className="text-sm text-muted-foreground">La page demandée n’existe pas dans le module assurance.</p>
      <Button asChild>
        <Link to="/app">Retour tableau de bord</Link>
      </Button>
    </div>
  );
}
