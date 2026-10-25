import { useState } from "react";
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
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { contractCreationApi } from "../api/contract-creation";
import type { GarantieInput, QuittancePreview, ReferenceOption, VehicleImportPreview, VehiculeInput } from "../types";
import type { ContractPricingMode, ContractTarget } from "./ContractTargetsSection";
import { VehicleGuaranteeImportReview } from "./VehicleGuaranteeImportReview";

const MAX_IMPORT_SIZE = 5 * 1024 * 1024;

export function VehicleExcelImportDialog({
  draftId,
  existingVehicles,
  garanties,
  lignes,
  formulesPersonne,
  usages,
  grilleSelected,
  pricingMode,
  calculationPreview,
  previewingGuarantees,
  onPreviewGuarantees,
  onApply,
}: {
  draftId?: string;
  existingVehicles: VehiculeInput[];
  garanties: ReferenceOption[];
  lignes: ReferenceOption[];
  formulesPersonne: ReferenceOption[];
  usages: ReferenceOption[];
  grilleSelected: boolean;
  pricingMode: ContractPricingMode;
  calculationPreview?: QuittancePreview | null;
  previewingGuarantees?: boolean;
  onPreviewGuarantees: (vehicles: VehiculeInput[], target: ContractTarget, garanties: GarantieInput[]) => void;
  onApply: (vehicles: VehiculeInput[], garanties: GarantieInput[]) => void;
}) {
  const hasSubmittedVehicles = existingVehicles.some((vehicle) => vehicle.vehiculeId != null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<VehicleImportPreview | null>(null);
  const [selectedGaranties, setSelectedGaranties] = useState<GarantieInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setSelectedGaranties([]);
  };

  const selectFile = (selected: File | null) => {
    setPreview(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!/\.(xlsx|xls)$/i.test(selected.name)) {
      setFile(null);
      toast.error("Sélectionnez un fichier Excel au format XLSX ou XLS");
      return;
    }
    if (selected.size > MAX_IMPORT_SIZE) {
      setFile(null);
      toast.error("Le fichier Excel ne doit pas dépasser 5 Mo");
      return;
    }
    setFile(selected);
  };

  const previewFile = async () => {
    if (!draftId || !file) return;
    setLoading(true);
    try {
      const result = await contractCreationApi.previewVehicleImport(draftId, file);
      const checked = withLocalDuplicateErrors(result, existingVehicles);
      setPreview(checked);
      setSelectedGaranties(checked.garanties ?? []);
      const imported = checked.lignes.flatMap((row) => row.vehicule ? [row.vehicule] : []);
      if (imported[0] && checked.garanties?.length) {
        onPreviewGuarantees(imported, importedVehicleTarget(imported[0], 0, usages), checked.garanties);
      }
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
    onApply(imported, selectedGaranties);
    toast.success(`${imported.length} véhicule${imported.length > 1 ? "s" : ""} ajouté${imported.length > 1 ? "s" : ""}`);
    setOpen(false);
    reset();
  };

  const importedVehicles = preview?.lignes.flatMap((row) => row.vehicule ? [row.vehicule] : []) ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-background text-foreground hover:bg-muted disabled:text-muted-foreground"
          disabled={!draftId}
          onClick={() => setOpen(true)}
        >
          <FileSpreadsheet className="size-4" />
          Importer Excel
        </Button>
        {hasSubmittedVehicles ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-background text-foreground hover:bg-muted disabled:text-muted-foreground"
            title="Exporter les véhicules enregistrés"
            disabled={!draftId || exporting}
            onClick={exportVehicles}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            Exporter Excel
          </Button>
        ) : null}
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
            <div className="grid gap-3">
              <FileDropzone
                file={file}
                onFileChange={selectFile}
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                disabled={loading}
                title="Glissez votre fichier Excel ici"
                description="ou cliquez pour le sélectionner · XLSX ou XLS · 5 Mo maximum"
              />
              <div className="flex items-center">
                <Button type="button" variant="outline" disabled={downloading || loading} onClick={downloadTemplate}>
                  {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Télécharger le modèle
                </Button>
              </div>
            </div>

            {preview ? (
              <Tabs defaultValue="vehicles" className="grid gap-3">
                <TabsList className="w-fit">
                  <TabsTrigger value="vehicles">Véhicules ({preview.totalLignes})</TabsTrigger>
                  <TabsTrigger value="guarantees">Garanties ({selectedGaranties.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="vehicles" className="mt-0 grid gap-3">
                  <div className="grid overflow-hidden rounded-md border sm:grid-cols-3">
                    <Metric label="Lignes analysées" value={preview.totalLignes} />
                    <Metric label="Véhicules valides" value={preview.lignesValides} tone="success" />
                    <Metric label="Lignes en erreur" value={preview.lignesEnErreur} tone={preview.lignesEnErreur ? "danger" : "default"} />
                  </div>
                  <VehiclePreviewTable preview={preview} />
                </TabsContent>
                <TabsContent value="guarantees" className="mt-0 grid gap-3">
                  <div className="grid overflow-hidden rounded-md border sm:grid-cols-3">
                    <Metric label="Véhicules analysés" value={preview.totalLignesGaranties} />
                    <Metric label="Lignes valides" value={preview.lignesGarantiesValides} tone="success" />
                    <Metric label="Lignes en erreur" value={preview.lignesGarantiesEnErreur} tone={preview.lignesGarantiesEnErreur ? "danger" : "default"} />
                  </div>
                  <VehicleGuaranteeImportReview
                    preview={preview}
                    vehicles={importedVehicles}
                    garanties={garanties}
                    lignes={lignes}
                    formulesPersonne={formulesPersonne}
                    usages={usages}
                    grilleSelected={grilleSelected}
                    pricingMode={pricingMode}
                    selected={selectedGaranties}
                    setSelected={setSelectedGaranties}
                    calculationPreview={calculationPreview}
                    previewing={previewingGuarantees}
                    onRequestCalculation={(target, next) => onPreviewGuarantees(importedVehicles, target, next)}
                  />
                </TabsContent>
              </Tabs>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              type="button"
              disabled={preview
                ? preview.lignesEnErreur > 0 || preview.lignesGarantiesEnErreur > 0 || preview.lignesValides === 0
                : !file || loading}
              onClick={preview ? apply : previewFile}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : preview ? <CheckCircle2 className="size-4" /> : <Upload className="size-4" />}
              {preview ? "Ajouter véhicules et garanties" : "Analyser le fichier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VehiclePreviewTable({ preview }: { preview: VehicleImportPreview }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-emerald-800 text-xs uppercase text-white">
          <tr>
            <th className="px-3 py-2.5 text-left">Ligne</th>
            <th className="px-3 py-2.5 text-left">Immatriculation</th>
            <th className="px-3 py-2.5 text-left">N° attestation</th>
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
              <td className="px-3 py-2.5">{row.numeroAttestation || "-"}</td>
              <td className="px-3 py-2.5">{row.usage || "-"}</td>
              <td className="px-3 py-2.5">{row.marque || "-"}</td>
              <td className="px-3 py-2.5">
                {row.erreurs.length ? (
                  <div className="grid gap-1 text-red-700 dark:text-red-300">
                    {row.erreurs.map((error) => (
                      <div key={error} className="flex items-start gap-1.5">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        {error}
                      </div>
                    ))}
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

function importedVehicleTarget(
  vehicle: VehiculeInput,
  index: number,
  usages: ReferenceOption[]
): ContractTarget {
  return {
    kind: "vehicule",
    index,
    label: vehicle.immatriculation?.trim() || `Véhicule ${index + 1}`,
    usageId: vehicle.usageId,
    usageCode: usages.find((usage) => usage.id === vehicle.usageId)?.code ?? undefined,
    categorieTransportId: vehicle.categorieTransportId,
    valeurVenale: vehicle.valeurVenale,
    valeurNeuf: vehicle.valeurNeuf,
    valeurGlace: vehicle.valeurGlace,
  };
}
