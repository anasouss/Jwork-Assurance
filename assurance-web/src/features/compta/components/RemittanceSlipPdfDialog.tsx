import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, LoaderCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/download";
import { toast } from "@/lib/toast";
import { PdfPaperPreview } from "@/components/shared/pdf-paper-preview";
import { comptaApi } from "../api";

export function RemittanceSlipPdfDialog({ id, numero, onClose }: {
  id: string;
  numero?: string | null;
  onClose: () => void;
}) {
  const paperRef = useRef<HTMLDivElement>(null);
  const [paperReady, setPaperReady] = useState(false);
  const [printing, setPrinting] = useState(false);
  const pdf = useQuery({
    queryKey: ["compta", "treasury", "remittance-slip-pdf", id],
    queryFn: () => comptaApi.remittanceSlipPdf(id),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  async function print() {
    if (!paperReady || printing || !paperRef.current) return;
    const pages = Array.from(paperRef.current.querySelectorAll<HTMLCanvasElement>("canvas[data-pdf-page]"));
    if (!pages.length) return;
    const printWindow = window.open("about:blank", "_blank");
    if (!printWindow) {
      toast.error("Autorisez les fenêtres contextuelles pour imprimer le bordereau");
      return;
    }
    printWindow.opener = null;
    setPrinting(true);
    try {
      const document = printWindow.document;
      document.title = numero || `Bordereau ${id}`;
      const style = document.createElement("style");
      style.textContent = "html,body{margin:0;background:white}section{break-after:page}section:last-child{break-after:auto}img{display:block;width:100%;height:100%}"
        + pages.map((page, index) => `@page paper${index}{size:${Number(page.dataset.pageWidth)}pt ${Number(page.dataset.pageHeight)}pt;margin:0}`).join("");
      document.head.appendChild(style);
      const images = pages.map((page, index) => {
        const section = document.createElement("section");
        section.style.page = `paper${index}`;
        section.style.width = `${Number(page.dataset.pageWidth)}pt`;
        section.style.height = `${Number(page.dataset.pageHeight)}pt`;
        const image = document.createElement("img");
        image.alt = `Page ${index + 1}`;
        image.src = page.toDataURL("image/png");
        section.appendChild(image);
        document.body.appendChild(section);
        return image;
      });
      await Promise.all(images.map((image) => image.decode()));
      if (printWindow.closed) return;
      printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      printWindow.close();
      toast.error(error instanceof Error ? error.message : "Impression du bordereau impossible.");
    } finally {
      setPrinting(false);
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex h-[90dvh] max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
      <DialogHeader className="shrink-0 border-b bg-orange-50/70 p-4 pr-12 text-left dark:bg-orange-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DialogTitle className="min-w-0 break-words text-base">Bordereau de remise{numero ? ` N° ${numero}` : ""}</DialogTitle>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!paperReady || printing || pdf.isError} onClick={() => void print()}>
              {printing ? <LoaderCircle className="size-4 animate-spin" /> : <Printer className="size-4" />}Imprimer
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!pdf.data || pdf.isError}
              onClick={() => { if (pdf.data) downloadBlob(pdf.data, `${numero || `bordereau-${id}`}.pdf`); }}>
              <Download className="size-4" />Télécharger
            </Button>
          </div>
        </div>
        <DialogDescription className="sr-only">PDF du bordereau de remise bancaire</DialogDescription>
      </DialogHeader>
      <div ref={paperRef} className="min-h-0 flex-1 overflow-y-auto bg-muted/40 p-3 sm:p-5">
        {pdf.isError ? <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
          <p className="text-destructive">{pdf.error instanceof Error ? pdf.error.message : "Chargement du PDF impossible."}</p>
          <Button type="button" variant="outline" disabled={pdf.isFetching} onClick={() => void pdf.refetch()}>Réessayer</Button>
        </div> : !pdf.data ? <div role="status" className="flex h-full items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />Chargement du bordereau...
        </div> : <PdfPaperPreview blob={pdf.data} onReadyChange={setPaperReady} />}
      </div>
      <DialogFooter className="shrink-0 border-t px-4 py-3">
        <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
