import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download";
import { contractApi } from "../api/contracts";
import { referenceApi } from "../api/references";
import { contractPdfFilename, generateContratPdfDocument } from "./ContratShowPage";

export default function ContratPdfPage() {
  const { contratId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const mouvementId = searchParams.get("mouvementId");
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string>();

  const pdf = useQuery({
    queryKey: ["contrat-pdf", contratId, mouvementId],
    enabled: Boolean(contratId),
    queryFn: async () => {
      const contrat = await contractApi.getContrat(contratId, { mouvementId });
      const filename = contractPdfFilename(contrat, mouvementId);
      if (contrat.typeContrat === "FLOTTE") {
        return {
          blob: await contractApi.downloadFlottePolicyPdf(contratId, mouvementId),
          filename,
        };
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
      return {
        blob: await generateContratPdfDocument(contrat, compagnies, conventions, mouvementId),
        filename,
      };
    },
  });

  useEffect(() => {
    if (!pdf.data) return;
    const url = URL.createObjectURL(pdf.data.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdf.data]);

  useEffect(() => {
    if (!pdf.data?.filename) return;
    const previousTitle = document.title;
    document.title = pdf.data.filename;
    return () => {
      document.title = previousTitle;
    };
  }, [pdf.data?.filename]);

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

  if (!pdf.data || !previewUrl) return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="grid justify-items-center gap-3">
        <LoaderCircle className="size-7 animate-spin text-emerald-600" />
        <p className="font-medium">Génération du PDF...</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[640px] flex-1 flex-col overflow-hidden rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/app/production/contrats/${contratId}${mouvementId ? `?mouvementId=${encodeURIComponent(mouvementId)}` : ""}`}>
            <ArrowLeft className="size-4" />
            Retour au dossier
          </Link>
        </Button>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden max-w-[40vw] truncate text-sm text-muted-foreground sm:inline" title={pdf.data.filename}>
            {pdf.data.filename}
          </span>
          <Button type="button" size="sm" onClick={() => downloadBlob(pdf.data.blob, pdf.data.filename)}>
            <Download className="size-4" />
            Télécharger
          </Button>
        </div>
      </div>
      <iframe
        className="min-h-0 w-full flex-1 border-0 bg-slate-200 dark:bg-slate-900"
        src={`${previewUrl}#toolbar=0&navpanes=0`}
        title={pdf.data.filename}
      />
    </div>
  );
}
