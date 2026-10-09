import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { FileText, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contractApi } from "../api/contracts";
import { referenceApi } from "../api/references";
import { generateContratPdfDocument } from "./ContratShowPage";

export default function ContratPdfPage() {
  const { contratId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const mouvementId = searchParams.get("mouvementId");
  const queryClient = useQueryClient();

  const pdf = useQuery({
    queryKey: ["contrat-pdf", contratId, mouvementId],
    enabled: Boolean(contratId),
    queryFn: async () => {
      const contrat = await contractApi.getContrat(contratId, { mouvementId });
      if (contrat.typeContrat === "FLOTTE") {
        return contractApi.downloadFlottePolicyPdf(contratId, mouvementId);
      }
      const [compagnies, conventions] = await Promise.all([
        queryClient.ensureQueryData({
          queryKey: ["referentiel", "compagnies-assurance", "contrat-show"],
          queryFn: () => referenceApi.list("compagnies-assurance"),
        }),
        queryClient.ensureQueryData({
          queryKey: ["referentiel", "conventions", "contrat-show"],
          queryFn: () => referenceApi.list("conventions"),
        }),
      ]);
      return generateContratPdfDocument(contrat, compagnies, conventions, mouvementId);
    },
  });

  useEffect(() => {
    if (!pdf.data) return;
    window.location.replace(URL.createObjectURL(pdf.data));
  }, [pdf.data]);

  if (pdf.isError) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="grid max-w-md justify-items-center gap-3 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">PDF indisponible</h1>
          <p className="text-sm text-muted-foreground">
            {pdf.error instanceof Error ? pdf.error.message : "Le document n’a pas pu être généré."}
          </p>
          <Button asChild variant="outline">
            <Link to={`/app/production/contrats/${contratId}`}>Ouvrir le dossier</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="grid justify-items-center gap-3">
        <LoaderCircle className="size-7 animate-spin text-emerald-600" />
        <p className="font-medium">Génération du PDF...</p>
      </div>
    </div>
  );
}
