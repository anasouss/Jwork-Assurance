import { ArrowLeft, ShieldX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div className="grid min-h-[50vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <ShieldX className="mx-auto size-10 text-destructive" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">Accès refusé</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre rôle ne permet pas d’accéder à cette page.
        </p>
        <Button className="mt-5" variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
          Retour
        </Button>
      </div>
    </div>
  );
}
