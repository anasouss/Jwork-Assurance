import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold text-balance">Page introuvable</h1>
      <p className="text-muted-foreground">
        La page demandée n'existe pas ou n'est plus disponible.
      </p>
      <Button asChild>
        <Link to="/">Retour à l'accueil</Link>
      </Button>
    </div>
  );
}
