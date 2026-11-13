import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PdfPaperPreview({ blob, onReadyChange }: {
  blob: Blob;
  onReadyChange: (ready: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [readyPages, setReadyPages] = useState<{ width: number; pages: Set<number> }>(() => ({ width: 0, pages: new Set() }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      setWidth((current) => current === next ? current : next);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    setDocument(null);
    setReadyPages({ width: 0, pages: new Set() });
    setError("");

    async function load() {
      const [pdfjs, buffer] = await Promise.all([import("pdfjs-dist"), blob.arrayBuffer()]);
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
      const loaded = await loadingTask.promise;
      if (!cancelled) setDocument(loaded);
    }

    void load().catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Affichage du PDF impossible.");
    });
    return () => {
      cancelled = true;
      void loadingTask?.destroy().catch(() => {});
    };
  }, [blob, attempt]);

  const pageReady = useCallback((page: number, ready: boolean) => {
    setReadyPages((current) => {
      const next = current.width === width ? new Set(current.pages) : new Set<number>();
      if (ready) next.add(page);
      else next.delete(page);
      return { width, pages: next };
    });
  }, [width]);

  useEffect(() => {
    onReadyChange(Boolean(document && !error && readyPages.width === width && readyPages.pages.size === document.numPages));
  }, [document, error, readyPages, width, onReadyChange]);

  return <div ref={containerRef} className="mx-auto grid w-full max-w-[960px] gap-5">
    {error ? <div role="alert" className="grid min-h-48 justify-items-center content-center gap-3 p-4 text-center text-sm">
      <p className="text-destructive">{error}</p>
      <Button type="button" variant="outline" onClick={() => setAttempt((current) => current + 1)}>Réessayer</Button>
    </div> : !document || !width ? <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />Chargement des pages...
    </div> : Array.from({ length: document.numPages }, (_, index) => <PdfPage
      key={`${index + 1}-${width}`} document={document} number={index + 1} width={width}
      onReady={pageReady} onError={setError} />)}
  </div>;
}

function PdfPage({ document, number, width, onReady, onError }: {
  document: PDFDocumentProxy;
  number: number;
  width: number;
  onReady: (page: number, ready: boolean) => void;
  onError: (error: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | undefined;
    const canvas = canvasRef.current;
    onReady(number, false);

    async function render() {
      const page = await document.getPage(number);
      if (!canvas || cancelled) return;
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / original.width });
      const density = Math.min(Math.max(window.devicePixelRatio || 1, 2, original.width * 3 / viewport.width),
        Math.sqrt(8_000_000 / (viewport.width * viewport.height)));
      canvas.width = Math.ceil(viewport.width * density);
      canvas.height = Math.ceil(viewport.height * density);
      canvas.dataset.pageWidth = String(original.width);
      canvas.dataset.pageHeight = String(original.height);
      task = page.render({ canvas, viewport, transform: [density, 0, 0, density, 0, 0] });
      await task.promise;
      if (!cancelled) {
        setReady(true);
        onReady(number, true);
      }
    }

    void render().catch((reason: unknown) => {
      if (!cancelled) onError(reason instanceof Error ? reason.message : `Affichage de la page ${number} impossible.`);
    });
    return () => {
      cancelled = true;
      task?.cancel();
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [document, number, width, onReady, onError]);

  return <figure aria-label={`Page ${number} sur ${document.numPages}`} className="relative m-0 min-w-0 bg-white shadow-sm">
    {!ready ? <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-neutral-600">
      <LoaderCircle className="size-4 animate-spin" />Page {number}...
    </div> : null}
    <canvas ref={canvasRef} data-pdf-page={number} role="img" aria-label={`Page ${number} du document PDF`}
      className={`h-auto w-full ${ready ? "block" : "hidden"}`} />
  </figure>;
}
