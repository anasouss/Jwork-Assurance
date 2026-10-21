import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileDown, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { contractCreationApi } from "../api/contract-creation";
import type { VehicleImportPreview, VehiculeInput } from "../types";

export function VehicleExcelImportDialog({
  draftId,
  existingVehicles,
  onApply,
}: {
  draftId?: string;
  existingVehicles: VehiculeInput[];
  onApply: (vehicles: VehiculeInput[]) => void;
}) {
  const hasSubmittedVehicles = existingVehicles.some((vehicle) => vehicle.vehiculeId != null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<VehicleImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const previewFile = async () => {
    if (!draftId || !file) return;
    setLoading(true);
    try {
      const result = await contractCreationApi.previewVehicleImport(draftId, file);
      setPreview(withLocalDuplicateErrors(result, existingVehicles));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import Excel impossible");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    if (!draftId) return;
    setDownloading(true);
    try {
      const blob = await contractCreationApi.downloadVehicleImportTemplate(draftId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "modele-import-vehicules.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléchargement impossible");
    } finally {
      setDownloading(false);
    }
  };

  const exportVehicles = async () => {
    if (!draftId) return;
    setExporting(true);
    try {
      const blob = await contractCreationApi.exportSubmittedVehicles(draftId);
      downloadBlob(blob, "vehicules-flotte.xlsx");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export Excel impossible");
    } finally {
      setExporting(false);
    }
  };

  const apply = () => {
    if (!preview || preview.lignesEnErreur > 0) return;
    const imported = preview.lignes.flatMap((row) => row.vehicule ? [row.vehicule] : []);
    onApply(imported);
    toast.success(`${imported.length} véhicule${imported.length > 1 ? "s" : ""} ajouté${imported.length > 1 ? "s" : ""}`);
    setOpen(false);
    reset();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!draftId} onClick={() => setOpen(true)}>
          <FileSpreadsheet className="size-4" />
          Importer Excel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          title={hasSubmittedVehicles ? "Exporter les véhicules enregistrés" : "Enregistrez d’abord les véhicules"}
          disabled={!draftId || !hasSubmittedVehicles || exporting}
          onClick={exportVehicles}
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          Exporter Excel
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}>
        <DialogContent className="max-h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Importer des véhicules</DialogTitle>
            <DialogDescription>
              Vérifiez toutes les lignes avant de les ajouter au brouillon. Aucune donnée n’est enregistrée à cette étape.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 gap-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid min-w-[280px] flex-1 gap-1.5">
                <label htmlFor="vehicle-import-file" className="text-sm font-medium">Fichier Excel</label>
                <Input
                  ref={inputRef}
                  id="vehicle-import-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setPreview(null);
                  }}
                />
              </div>
              <Button type="button" variant="outline" disabled={downloading} onClick={downloadTemplate}>
                {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Modèle Excel
              </Button>
              <Button type="button" disabled={!file || loading} onClick={previewFile}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Analyser
              </Button>
            </div>

            {preview ? (
              <>
                <div className="grid overflow-hidden rounded-md border sm:grid-cols-3">
                  <Metric label="Lignes analysées" value={preview.totalLignes} />
                  <Metric label="Véhicules valides" value={preview.lignesValides} tone="success" />
                  <Metric label="Lignes en erreur" value={preview.lignesEnErreur} tone={preview.lignesEnErreur ? "danger" : "default"} />
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-emerald-800 text-xs uppercase text-white">
                      <tr>
                        <th className="px-3 py-2.5 text-left">Ligne</th>
                        <th className="px-3 py-2.5 text-left">Immatriculation</th>
                        <th className="px-3 py-2.5 text-left">Usage</th>
                        <th className="px-3 py-2.5 text-left">Marque</th>
                        <th className="px-3 py-2.5 text-left">Résultat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.lignes.map((row) => (
                        <tr key={row.numeroLigne} className={row.erreurs.length ? "bg-red-50/60 dark:bg-red-950/20" : undefined}>
                          <td className="px-3 py-2.5 font-medium">{row.numeroLigne}</td>
                          <td className="px-3 py-2.5">{row.immatriculation || "-"}</td>
                          <td className="px-3 py-2.5">{row.usage || "-"}</td>
                          <td className="px-3 py-2.5">{row.marque || "-"}</td>
                          <td className="px-3 py-2.5">
                            {row.erreurs.length ? (
                              <div className="grid gap-1 text-red-700 dark:text-red-300">
                                {row.erreurs.map((error) => <div key={error} className="flex items-start gap-1.5"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>)}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="size-4" /> Prêt à importer
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="button" disabled={!preview || preview.lignesEnErreur > 0 || preview.lignesValides === 0} onClick={apply}>
              Ajouter les véhicules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "danger" }) {
  const toneClass = tone === "success"
    ? "bg-emerald-50/70 dark:bg-emerald-950/20"
    : tone === "danger" ? "bg-red-50/70 dark:bg-red-950/20" : "";
  return <div className={`border-b p-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${toneClass}`}><div className="text-xs uppercase text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>;
}

function withLocalDuplicateErrors(preview: VehicleImportPreview, existingVehicles: VehiculeInput[]): VehicleImportPreview {
  const existing = new Set(existingVehicles.map((vehicle) => normalizeRegistration(vehicle.immatriculation)).filter(Boolean));
  const lignes = preview.lignes.map((row) => {
    const duplicate = row.vehicule && existing.has(normalizeRegistration(row.vehicule.immatriculation));
    if (!duplicate || row.erreurs.some((error) => error.includes("déjà présente"))) return row;
    return { ...row, vehicule: null, erreurs: [...row.erreurs, "Immatriculation déjà présente dans le formulaire"] };
  });
  const valid = lignes.filter((row) => row.erreurs.length === 0).length;
  return { ...preview, lignes, lignesValides: valid, lignesEnErreur: lignes.length - valid };
}

function normalizeRegistration(value?: string) {
  return (value ?? "").toLocaleLowerCase("fr").replace(/[^a-z0-9]/g, "");
}
