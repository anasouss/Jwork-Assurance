import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/download";
import { comptaApi } from "../api";

export function RemittanceSlipPdfDialog({ id, numero, onClose }: {
  id: string;
  numero?: string | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const pdf = useQuery({
    queryKey: ["compta", "treasury", "remittance-slip-pdf", id],
    queryFn: () => comptaApi.remittanceSlipPdf(id),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!pdf.data) return;
    const objectUrl = URL.createObjectURL(pdf.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pdf.data]);

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex h-[90dvh] max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
      <DialogHeader className="shrink-0 border-b bg-orange-50/70 p-4 pr-12 text-left dark:bg-orange-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DialogTitle className="min-w-0 break-words text-base">Bordereau de remise{numero ? ` N° ${numero}` : ""}</DialogTitle>
          <Button type="button" size="sm" variant="outline" disabled={!pdf.data || !url || pdf.isError}
            onClick={() => { if (pdf.data) downloadBlob(pdf.data, `${numero || `bordereau-${id}`}.pdf`); }}>
            <Download className="size-4" />Télécharger
          </Button>
        </div>
        <DialogDescription className="sr-only">PDF du bordereau de remise bancaire</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 bg-muted/30">
        {pdf.isError ? <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
          <p className="text-destructive">{pdf.error instanceof Error ? pdf.error.message : "Chargement du PDF impossible."}</p>
          <Button type="button" variant="outline" disabled={pdf.isFetching} onClick={() => void pdf.refetch()}>Réessayer</Button>
        </div> : !url ? <div role="status" className="flex h-full items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />Chargement du bordereau...
        </div> : <iframe title={`Bordereau de remise ${numero || id}`} src={`${url}#view=FitH`} className="h-full w-full border-0" />}
      </div>
      <DialogFooter className="shrink-0 border-t px-4 py-3">
        <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
