import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Plus, Settings2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyInput } from "@/features/production/components/MoneyInput";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import { classifyAllocationDifference } from "../allocation-tolerance";
import type {
  AllocationLine,
  AllocationRequest,
  AllocationRequestLine,
  ImportPreview,
  QuittanceAllocation,
  SourceAffectation,
} from "../types";

type Props = {
  quittanceId?: string;
  open: boolean;
  readOnly?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigureRule?: (data: QuittanceAllocation) => void;
};

type FleetMode = "MANUEL" | "IMPORT";

type FleetLine = {
  key: string;
  numeroQuittanceCompagnie: string;
  dateEffet: string;
  dateEcheance: string;
  acteSource?: string | null;
  categorieSource?: string | null;
  categorieQuittance?: AllocationLine["categorieQuittance"];
  statutSource?: string | null;
  fichierSource?: string | null;
  primeNette?: number;
  montantTaxes?: number;
  accessoires?: number;
  montantTtc?: number;
  commissionNette?: number;
  montantRetenue?: number;
  netCompagnie?: number;
};

export function AffectationQuittanceDialog({
  quittanceId,
  open,
  readOnly = false,
  onOpenChange,
  onConfigureRule,
}: Props) {
  const queryClient = useQueryClient();
  const [avecRetenue, setAvecRetenue] = useState<boolean | undefined>();
  const [numero, setNumero] = useState("");
  const [fleetMode, setFleetMode] = useState<FleetMode>("MANUEL");
  const [fleetLines, setFleetLines] = useState<FleetLine[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [initializedId, setInitializedId] = useState<string | null>(null);

  const savedDetail = useQuery({
    queryKey: ["compta", "affectation-quittance", quittanceId],
    queryFn: () => comptaApi.allocation(quittanceId!),
    enabled: open && Boolean(quittanceId),
  });

  const retentionPreview = useQuery({
    queryKey: ["compta", "affectation-quittance-preview", quittanceId, avecRetenue],
    queryFn: () => comptaApi.allocation(quittanceId!, avecRetenue),
    enabled:
      open &&
      Boolean(quittanceId) &&
      avecRetenue != null &&
      initializedId === quittanceId &&
      avecRetenue !== savedDetail.data?.avecRetenue,
  });

  const detailData = retentionPreview.data ?? savedDetail.data;
  const enteredTtc = fleetLines.reduce((sum, line) => sum + (line.montantTtc ?? 0), 0);
  const calculatedTolerance = classifyAllocationDifference(
    enteredTtc - (detailData?.montantTtc ?? 0),
    detailData?.regle
  );
  const tolerance = importPreview
    ? {
        level: importPreview.niveauEcart,
        allowed: importPreview.validationAutorisee,
        warningThreshold: importPreview.seuilAvertissementEcart,
        blockingThreshold: importPreview.seuilBlocageEcart,
      }
    : calculatedTolerance;

  useEffect(() => {
    if (!open) {
      setAvecRetenue(undefined);
      setNumero("");
      setFleetMode("MANUEL");
      setFleetLines([]);
      setFile(null);
      setImportPreview(null);
      setInitializedId(null);
      setConfirmClear(false);
      return;
    }
    const data = savedDetail.data;
    if (!data || initializedId === data.quittanceId) return;
    setAvecRetenue(data.avecRetenue);
    setNumero(data.lignes[0]?.numeroQuittanceCompagnie ?? "");
    setFleetLines(data.lignes.map(toFleetLine));
    setFleetMode(data.lignes[0]?.source === "IMPORT" ? "IMPORT" : "MANUEL");
    setInitializedId(data.quittanceId);
  }, [initializedId, open, savedDetail.data]);

  useEffect(() => {
    const data = retentionPreview.data;
    if (!data || data.typeContrat === "FLOTTE" || data.regle?.modeVentilation !== "PAR_CATEGORIE") return;
    setFleetLines((current) =>
      data.lignes.map((line, index) => ({
        ...toFleetLine(line),
        numeroQuittanceCompagnie: current[index]?.numeroQuittanceCompagnie ?? line.numeroQuittanceCompagnie ?? "",
      }))
    );
  }, [retentionPreview.data]);

  const save = useMutation({
    mutationFn: async () => {
      const data = detailData;
      if (!data || avecRetenue == null) throw new Error("Données de la quittance indisponibles");
      return comptaApi.saveAllocation(data.quittanceId, buildRequest(data, avecRetenue, numero, fleetMode, fleetLines, importPreview));
    },
    onSuccess: async () => {
      toast.success("Affectation enregistrée");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "affectation-quittances"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "affectation-quittance", quittanceId] }),
      ]);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const clear = useMutation({
    mutationFn: () => comptaApi.clearAllocation(quittanceId!),
    onSuccess: async () => {
      toast.success("Affectation supprimée");
      setConfirmClear(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "affectation-quittances"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "affectation-quittance", quittanceId] }),
      ]);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Suppression impossible"),
  });

  const previewFile = useMutation({
    mutationFn: async () => {
      if (!quittanceId || !file || avecRetenue == null) throw new Error("Sélectionnez un fichier Excel");
      return comptaApi.previewImport(quittanceId, file, avecRetenue);
    },
    onSuccess: (preview) => {
      setImportPreview(preview);
      setFleetLines(preview.lignes.map(toFleetLine));
      if (preview.erreurs.length) {
        toast.warning(`${preview.erreurs.length} anomalie(s) détectée(s)`);
      } else {
        toast.success(`${preview.lignesLues} ligne(s) importée(s)`);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Import impossible"),
  });

  const hasAllocation = Boolean(savedDetail.data?.lignes.some((line) => line.id));
  const canSave = useMemo(() => {
    if (!detailData || avecRetenue == null) return false;
    if (detailData.typeContrat !== "FLOTTE") {
      if (detailData.regle?.modeVentilation === "PAR_CATEGORIE") {
        return fleetLines.length > 0 && fleetLines.every(isCompleteAutomaticCategoryLine);
      }
      return Boolean(numero.trim());
    }
    return (
      fleetLines.length > 0 &&
      fleetLines.every(isCompleteFleetLine) &&
      tolerance.allowed &&
      (
        fleetMode !== "IMPORT" ||
        (
          Boolean(importPreview?.fichier || fleetLines[0]?.fichierSource) &&
          (importPreview?.erreurs.length ?? 0) === 0
        )
      )
    );
  }, [avecRetenue, detailData, fleetLines, fleetMode, importPreview, numero, tolerance.allowed]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[94vh] sm:!max-w-[min(96vw,1400px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Affectation de la quittance compagnie</DialogTitle>
            <DialogDescription>
              {detailData
                ? `${detailData.dossier} · ${detailData.mouvement} · ${detailData.compagnie}`
                : "Chargement de la quittance..."}
            </DialogDescription>
          </DialogHeader>

          {savedDetail.isLoading ? (
            <AllocationSkeleton />
          ) : savedDetail.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Impossible d'ouvrir l'affectation</AlertTitle>
              <AlertDescription>
                {savedDetail.error instanceof Error ? savedDetail.error.message : "Une erreur est survenue"}
              </AlertDescription>
            </Alert>
          ) : detailData ? (
            <div className="grid gap-5">
              <QuittanceSummary data={detailData} />

              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={avecRetenue ?? false}
                  disabled={readOnly}
                  onCheckedChange={(value) => {
                    setAvecRetenue(value === true);
                    setImportPreview(null);
                  }}
                />
                Appliquer la retenue à la source
              </label>

              {detailData.typeContrat === "FLOTTE" ? (
                <div className="grid gap-4">
                  <AllocationDifference
                    difference={enteredTtc - detailData.montantTtc}
                    blockingThreshold={tolerance.blockingThreshold}
                    level={tolerance.level}
                  />
                  <Tabs value={fleetMode} onValueChange={(value) => setFleetMode(value as FleetMode)}>
                  <TabsList>
                    <TabsTrigger value="MANUEL">Saisie manuelle</TabsTrigger>
                    <TabsTrigger value="IMPORT">Import Excel</TabsTrigger>
                  </TabsList>
                  <TabsContent value="MANUEL" className="grid gap-3 pt-3">
                    {!readOnly ? <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setFleetLines((current) => [
                            ...current,
                            emptyFleetLine(detailData.dateEffet, detailData.dateEcheance ?? ""),
                          ])
                        }
                      >
                        <Plus className="size-4" />
                        Ajouter une ligne
                      </Button>
                    </div> : null}
                    <FleetLinesEditor lines={fleetLines} onChange={setFleetLines} readOnly={readOnly} />
                  </TabsContent>
                  <TabsContent value="IMPORT" className="grid gap-4 pt-3">
                    {!readOnly ? (
                      <div className="grid gap-3 border-y py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Profil Excel compagnie</p>
                            <p className="text-sm text-muted-foreground">
                              Feuille {detailData.regle?.excelFeuille || "1"} · en-tête ligne{" "}
                              {detailData.regle?.excelLigneEntete ?? 1}
                            </p>
                          </div>
                          {onConfigureRule ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onConfigureRule(detailData)}
                            >
                              <Settings2 className="size-4" />
                              Configurer les colonnes
                            </Button>
                          ) : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <Field label="Fichier Excel (.xlsx)">
                            <FileDropzone
                              file={file}
                              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                              title="Déposer le fichier Excel ici"
                              description="Format .xlsx uniquement · un fichier à la fois"
                              onFileChange={(selected) => {
                                if (selected && !selected.name.toLowerCase().endsWith(".xlsx")) {
                                  toast.error("Le fichier doit être au format .xlsx");
                                  return;
                                }
                                setFile(selected);
                                setImportPreview(null);
                                setFleetLines([]);
                              }}
                            />
                          </Field>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={!file || previewFile.isPending}
                            onClick={() => previewFile.mutate()}
                          >
                            <Upload className="size-4" />
                            Analyser le fichier
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    {importPreview ? <ImportResult preview={importPreview} /> : null}
                    {fleetLines.length ? (
                      <FleetLinesEditor lines={fleetLines} onChange={setFleetLines} imported readOnly={readOnly} />
                    ) : null}
                  </TabsContent>
                  </Tabs>
                </div>
              ) : detailData.regle?.modeVentilation === "PAR_CATEGORIE" ? (
                <AutomaticCategoryAllocation lines={fleetLines} onChange={setFleetLines} readOnly={readOnly} />
              ) : (
                <AutomaticAllocation
                  data={detailData}
                  numero={numero}
                  readOnly={readOnly}
                  onNumeroChange={setNumero}
                />
              )}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {hasAllocation && !readOnly ? (
                <Button type="button" variant="destructive" onClick={() => setConfirmClear(true)}>
                  <Trash2 className="size-4" />
                  Supprimer l'affectation
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {readOnly ? "Fermer" : "Annuler"}
              </Button>
              {!readOnly ? (
                <Button type="button" disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
                  Enregistrer
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'affectation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les numéros et montants compagnie enregistrés pour cette quittance seront supprimés. La quittance de production reste intacte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clear.isPending}
              onClick={(event) => {
                event.preventDefault();
                clear.mutate();
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function QuittanceSummary({ data }: { data: QuittanceAllocation }) {
  return (
    <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Produit" value={contractLabel(data.typeContrat)} />
      <Metric label="Police" value={data.police || "—"} />
      <Metric label="Prime nette" value={money(data.primeNette)} />
      <Metric label="Montant TTC" value={money(data.montantTtc)} />
    </div>
  );
}

function AutomaticAllocation({
  data,
  numero,
  readOnly,
  onNumeroChange,
}: {
  data: QuittanceAllocation;
  numero: string;
  readOnly: boolean;
  onNumeroChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 border-y py-4">
      <div className="overflow-x-auto border">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase">
            <tr>
              <th className="px-3 py-2">N° quittance compagnie</th>
              <th className="px-3 py-2 text-right">Montant TTC</th>
              <th className="px-3 py-2 text-right">Prime nette</th>
              <th className="px-3 py-2 text-right">Commission nette</th>
              <th className="px-3 py-2 text-right">Retenue source</th>
              <th className="px-3 py-2 text-right">Net compagnie</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="min-w-56 px-3 py-2">
                <Input
                  aria-label="N° quittance compagnie"
                  readOnly={readOnly}
                  value={numero}
                  onChange={(event) => onNumeroChange(event.target.value)}
                />
              </td>
              <MoneyValue value={data.montantTtc} strong />
              <MoneyValue value={data.primeNette} />
              <MoneyValue value={data.commissionCalculee} />
              <MoneyValue value={data.retenueCalculee} />
              <MoneyValue value={data.netCompagnieCalcule} strong />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Les montants sont calculés par le serveur à partir des lignes de la quittance et de la règle effective.
      </p>
    </div>
  );
}

function AutomaticCategoryAllocation({
  lines,
  readOnly,
  onChange,
}: {
  lines: FleetLine[];
  readOnly: boolean;
  onChange: (lines: FleetLine[]) => void;
}) {
  function update(key: string, patch: Partial<FleetLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <div className="grid gap-3 border-y py-4">
      <div className="overflow-x-auto border">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase">
            <tr>
              <th className="px-3 py-2">Catégorie</th>
              <th className="px-3 py-2">N° quittance compagnie</th>
              <th className="px-3 py-2 text-right">Montant TTC</th>
              <th className="px-3 py-2 text-right">Prime nette</th>
              <th className="px-3 py-2 text-right">Commission nette</th>
              <th className="px-3 py-2 text-right">Retenue source</th>
              <th className="px-3 py-2 text-right">Net compagnie</th>
            </tr>
          </thead>
          <tbody>
            {lines.length ? (
              lines.map((line) => (
                <tr key={line.key} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    {line.categorieSource || categoryLabel(line.categorieQuittance)}
                  </td>
                  <td className="min-w-56 px-3 py-2">
                    <Input
                      aria-label={`N° quittance compagnie ${categoryLabel(line.categorieQuittance)}`}
                      readOnly={readOnly}
                      value={line.numeroQuittanceCompagnie}
                      onChange={(event) => update(line.key, { numeroQuittanceCompagnie: event.target.value })}
                    />
                  </td>
                  <MoneyValue value={line.montantTtc} strong />
                  <MoneyValue value={line.primeNette} />
                  <MoneyValue value={line.commissionNette} />
                  <MoneyValue value={line.montantRetenue} />
                  <MoneyValue value={line.netCompagnie} strong />
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Aucune ligne de catégorie à affecter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Une ligne est créée uniquement pour les catégories comptables réelles de la quittance. Le total général reste un résumé et n'est pas affecté.
      </p>
    </div>
  );
}

function FleetLinesEditor({
  lines,
  onChange,
  imported = false,
  readOnly = false,
}: {
  lines: FleetLine[];
  onChange: (lines: FleetLine[]) => void;
  imported?: boolean;
  readOnly?: boolean;
}) {
  function update(key: string, patch: Partial<FleetLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <div className="overflow-x-auto border">
      <table className="w-full min-w-[1320px] text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase">
          <tr>
            <th className="px-2 py-2">N° quittance</th>
            <th className="px-2 py-2">Date effet</th>
            <th className="px-2 py-2">Date échéance</th>
            <th className="px-2 py-2 text-right">Prime nette</th>
            <th className="px-2 py-2 text-right">Taxes</th>
            <th className="px-2 py-2 text-right">Accessoires</th>
            <th className="px-2 py-2 text-right">TTC</th>
            <th className="px-2 py-2 text-right">Commission nette</th>
            <th className="px-2 py-2 text-right">Retenue</th>
            <th className="px-2 py-2 text-right">Net compagnie</th>
            <th className="w-12 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {lines.length ? (
            lines.map((line) => (
              <tr key={line.key} className="border-t align-top">
                <td className="min-w-44 px-2 py-2">
                  <Input
                    value={line.numeroQuittanceCompagnie}
                    readOnly={imported || readOnly}
                    onChange={(event) => update(line.key, { numeroQuittanceCompagnie: event.target.value })}
                  />
                </td>
                <td className="min-w-40 px-2 py-2">
                  <DatePicker
                    date={line.dateEffet}
                    disabled={imported || readOnly}
                    onSelect={(date) => update(line.key, { dateEffet: toDateOnly(date) ?? "" })}
                  />
                </td>
                <td className="min-w-40 px-2 py-2">
                  <DatePicker
                    date={line.dateEcheance}
                    disabled={imported || readOnly}
                    onSelect={(date) => update(line.key, { dateEcheance: toDateOnly(date) ?? "" })}
                  />
                </td>
                <MoneyCell value={line.primeNette} readOnly={imported || readOnly} onChange={(value) => update(line.key, { primeNette: value })} />
                <MoneyCell value={line.montantTaxes} readOnly={imported || readOnly} onChange={(value) => update(line.key, { montantTaxes: value })} />
                <MoneyCell value={line.accessoires} readOnly={imported || readOnly} onChange={(value) => update(line.key, { accessoires: value })} />
                <MoneyCell value={line.montantTtc} readOnly={imported || readOnly} onChange={(value) => update(line.key, { montantTtc: value })} />
                <MoneyCell value={line.commissionNette} readOnly={imported || readOnly} onChange={(value) => update(line.key, { commissionNette: value })} />
                <td className="whitespace-nowrap px-2 py-3 text-right">{line.montantRetenue == null ? "—" : money(line.montantRetenue)}</td>
                <td className="whitespace-nowrap px-2 py-3 text-right">{line.netCompagnie == null ? "—" : money(line.netCompagnie)}</td>
                <td className="px-2 py-2 text-right">
                  {!imported && !readOnly ? (
                    <Button type="button" size="icon" variant="ghost" title="Retirer la ligne" onClick={() => onChange(lines.filter((item) => item.key !== line.key))}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Aucune ligne.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ImportResult({ preview }: { preview: ImportPreview }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileSpreadsheet className="size-4" />
        <span className="font-medium">{preview.fichier}</span>
        <Badge variant="secondary">{preview.lignesLues} ligne(s)</Badge>
        <ToleranceBadge preview={preview} />
      </div>
      {!preview.validationAutorisee ? (
        <Alert variant="destructive">
          <AlertTitle>Écart supérieur au seuil autorisé</AlertTitle>
          <AlertDescription>L’écart absolu dépasse {money(preview.seuilBlocageEcart)}. Corrigez le fichier avant d’enregistrer.</AlertDescription>
        </Alert>
      ) : null}
      {preview.erreurs.length ? (
        <Alert variant="destructive">
          <AlertTitle>Le fichier contient des anomalies</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 grid gap-1">
              {preview.erreurs.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function AllocationDifference({ difference, blockingThreshold, level }: {
  difference: number;
  blockingThreshold: number;
  level: ImportPreview["niveauEcart"];
}) {
  const tone = level === "BLOQUANT"
    ? "text-destructive"
    : level === "AVERTISSEMENT"
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";
  return (
    <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2">
      <Metric label="Écart" value={money(difference)} valueClassName={tone} />
      <Metric label="Seuil de blocage" value={money(blockingThreshold)} />
    </div>
  );
}

function ToleranceBadge({ preview }: { preview: ImportPreview }) {
  if (preview.niveauEcart === "BLOQUANT") return <Badge variant="destructive">Écart {money(preview.ecart)}</Badge>;
  if (preview.niveauEcart === "AVERTISSEMENT") return <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">Écart {money(preview.ecart)}</Badge>;
  return <Badge className="bg-emerald-600 text-white">Écart {money(preview.ecart)}</Badge>;
}

function MoneyValue({ value, strong = false }: { value?: number | null; strong?: boolean }) {
  return (
    <td className="min-w-36 px-3 py-2">
      <Input
        aria-label="Montant calculé"
        className={`text-right ${strong ? "font-semibold" : ""}`}
        readOnly
        value={value == null ? "" : money(value)}
      />
    </td>
  );
}

function MoneyCell({
  value,
  readOnly,
  onChange,
}: {
  value?: number;
  readOnly: boolean;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <td className="min-w-36 px-2 py-2">
      <MoneyInput value={value} readOnly={readOnly} onValueChange={onChange} className="text-right" />
    </td>
  );
}

function Metric({ label, value, strong, valueClassName = "" }: { label: string; value: string; strong?: boolean; valueClassName?: string }) {
  return (
    <div className="min-w-0 bg-background px-4 py-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`${strong ? "mt-1 truncate font-semibold" : "mt-1 truncate font-medium"} ${valueClassName}`}>{value}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid min-w-[220px] gap-1.5">
      <Label className="text-xs uppercase">
        {label}{required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

function AllocationSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function emptyFleetLine(dateEffet: string, dateEcheance: string): FleetLine {
  return {
    key: crypto.randomUUID(),
    numeroQuittanceCompagnie: "",
    dateEffet,
    dateEcheance,
  };
}

function toFleetLine(line: AllocationLine): FleetLine {
  return {
    key: line.id ?? `${line.categorieQuittance ?? "line"}-${crypto.randomUUID()}`,
    numeroQuittanceCompagnie: line.numeroQuittanceCompagnie ?? "",
    dateEffet: line.dateEffet,
    dateEcheance: line.dateEcheance ?? "",
    acteSource: line.acteSource,
    categorieSource: line.categorieSource,
    categorieQuittance: line.categorieQuittance,
    statutSource: line.statutSource,
    fichierSource: line.fichierSource,
    primeNette: line.primeNette,
    montantTaxes: line.montantTaxes,
    accessoires: line.accessoires,
    montantTtc: line.montantTtc,
    commissionNette: line.commissionNette,
    montantRetenue: line.montantRetenue,
    netCompagnie: line.netCompagnie,
  };
}

function isCompleteFleetLine(line: FleetLine) {
  return Boolean(
    line.numeroQuittanceCompagnie.trim() &&
      line.dateEffet &&
      line.primeNette != null &&
      line.montantTaxes != null &&
      line.accessoires != null &&
      line.montantTtc != null &&
      line.commissionNette != null
  );
}

function isCompleteAutomaticCategoryLine(line: FleetLine) {
  return Boolean(
    line.categorieQuittance &&
      line.numeroQuittanceCompagnie.trim() &&
      line.dateEffet &&
      line.primeNette != null &&
      line.montantTaxes != null &&
      line.accessoires != null &&
      line.montantTtc != null &&
      line.commissionNette != null
  );
}

function buildRequest(
  data: QuittanceAllocation,
  avecRetenue: boolean,
  numero: string,
  fleetMode: FleetMode,
  fleetLines: FleetLine[],
  importPreview: ImportPreview | null
): AllocationRequest {
  if (data.typeContrat !== "FLOTTE") {
    if (data.regle?.modeVentilation === "PAR_CATEGORIE") {
      if (!fleetLines.length || !fleetLines.every(isCompleteAutomaticCategoryLine)) {
        throw new Error("Renseignez un numéro de quittance compagnie pour chaque catégorie");
      }
      return {
        source: "AUTOMATIQUE",
        avecRetenue,
        lignes: fleetLines.map(toRequestLine),
      };
    }
    return {
      source: "AUTOMATIQUE",
      avecRetenue,
      numeroQuittanceCompagnie: numero.trim(),
      lignes: [],
    };
  }
  if (!fleetLines.length || !fleetLines.every(isCompleteFleetLine)) {
    throw new Error("Complétez toutes les lignes de quittance flotte");
  }
  const source: SourceAffectation = fleetMode === "IMPORT" ? "IMPORT" : "MANUEL";
  return {
    source,
    avecRetenue,
    fichierSource: source === "IMPORT" ? importPreview?.fichier ?? fleetLines[0]?.fichierSource ?? undefined : undefined,
    lignes: fleetLines.map(toRequestLine),
  };
}

function toRequestLine(line: FleetLine): AllocationRequestLine {
  return {
    numeroQuittanceCompagnie: line.numeroQuittanceCompagnie.trim(),
    dateEffet: line.dateEffet,
    dateEcheance: line.dateEcheance || null,
    acteSource: line.acteSource,
    categorieSource: line.categorieSource,
    categorieQuittance: line.categorieQuittance,
    statutSource: line.statutSource,
    primeNette: line.primeNette!,
    montantTaxes: line.montantTaxes!,
    accessoires: line.accessoires!,
    montantTtc: line.montantTtc!,
    commissionNette: line.commissionNette!,
  };
}

function contractLabel(type: QuittanceAllocation["typeContrat"]) {
  if (type === "PARTICULIER") return "Mono";
  if (type === "CONVENTION") return "Convention";
  return "Flotte";
}

function categoryLabel(category?: AllocationLine["categorieQuittance"]) {
  if (category === "AUTOMOBILE") return "Automobile";
  if (category === "EVCAT") return "EVCAT";
  if (category === "CORPOREL") return "Corporel";
  if (category === "ASSISTANCE") return "Assistance";
  if (category === "TOTAL") return "Total";
  return "Catégorie";
}

function money(value: number) {
  return `${new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} MAD`;
}
