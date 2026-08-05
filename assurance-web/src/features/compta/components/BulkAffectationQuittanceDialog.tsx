import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyInput } from "@/features/production/components/MoneyInput";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import type { AllocationLine, ImportPreview, QuittanceAllocation } from "../types";

type BatchLine = {
  key: string;
  quittanceId: string;
  numeroQuittanceCompagnie: string;
  dateEffet: string;
  dateEcheance: string;
  acteSource?: string | null;
  categorieSource?: string | null;
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

type Props = {
  rows: QuittanceAllocation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function BulkAffectationQuittanceDialog({ rows, open, onOpenChange, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"MANUEL" | "IMPORT">("MANUEL");
  const [avecRetenue, setAvecRetenue] = useState(false);
  const [lines, setLines] = useState<BatchLine[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const ids = useMemo(() => rows.map((row) => row.quittanceId), [rows]);
  const expected = useMemo(() => rows.reduce((sum, row) => sum + row.montantTtc, 0), [rows]);
  const entered = useMemo(() => lines.reduce((sum, line) => sum + (line.montantTtc ?? 0), 0), [lines]);
  const difference = entered - expected;
  const targets = rows.map((row) => ({
    id: row.quittanceId,
    label: `${row.mouvement} · ${dateLabel(row.dateEffet)} · ${money(row.montantTtc)}`,
  }));

  const importFile = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Sélectionnez un fichier Excel");
      return comptaApi.previewBatchImport(ids, file, avecRetenue);
    },
    onSuccess: (result) => {
      setPreview(result);
      setLines(result.lignes.map(toBatchLine));
      result.erreurs.length
        ? toast.warning(`${result.erreurs.length} anomalie(s) détectée(s)`)
        : toast.success(`${result.lignesLues} ligne(s) importée(s)`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Import impossible"),
  });

  const save = useMutation({
    mutationFn: () => comptaApi.saveBatchAllocation({
      quittanceIds: ids,
      source: mode,
      avecRetenue,
      fichierSource: mode === "IMPORT" ? preview?.fichier : undefined,
      lignes: lines.map((line) => ({
        quittanceId: line.quittanceId,
        numeroQuittanceCompagnie: line.numeroQuittanceCompagnie.trim(),
        dateEffet: line.dateEffet,
        dateEcheance: line.dateEcheance || null,
        acteSource: line.acteSource,
        categorieSource: line.categorieSource,
        statutSource: line.statutSource,
        primeNette: line.primeNette!,
        montantTaxes: line.montantTaxes!,
        accessoires: line.accessoires!,
        montantTtc: line.montantTtc!,
        commissionNette: line.commissionNette!,
      })),
    }),
    onSuccess: async () => {
      toast.success("Affectation groupée enregistrée");
      await queryClient.invalidateQueries({ queryKey: ["compta", "affectation-quittances"] });
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const complete = lines.length > 0
    && lines.every((line) => line.quittanceId && line.numeroQuittanceCompagnie.trim() && line.dateEffet
      && line.primeNette != null && line.montantTaxes != null && line.accessoires != null
      && line.montantTtc != null && line.commissionNette != null)
    && rows.every((row) => lines.some((line) => line.quittanceId === row.quittanceId))
    && Math.abs(difference) < 0.005
    && (mode !== "IMPORT" || Boolean(preview && !preview.erreurs.length));

  function close(value: boolean) {
    if (!value) {
      setMode("MANUEL");
      setAvecRetenue(false);
      setLines([]);
      setFile(null);
      setPreview(null);
    }
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:!max-w-[min(96vw,1500px)]">
        <DialogHeader>
          <DialogTitle>Affectation groupée de la flotte</DialogTitle>
          <DialogDescription>
            {rows.length} mouvement(s) · {rows[0]?.police} · les lignes compagnie sont partagées par toute la sélection.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-3">
            <Metric label="Mouvements sélectionnés" value={String(rows.length)} />
            <Metric label="TTC attendu" value={money(expected)} />
            <Metric label="Écart" value={money(difference)} error={Math.abs(difference) >= 0.005} />
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox checked={avecRetenue} onCheckedChange={(value) => setAvecRetenue(value === true)} />
            Appliquer la retenue à la source
          </label>

          <Tabs value={mode} onValueChange={(value) => { setMode(value as "MANUEL" | "IMPORT"); setLines([]); setPreview(null); }}>
            <TabsList>
              <TabsTrigger value="MANUEL">Saisie manuelle</TabsTrigger>
              <TabsTrigger value="IMPORT">Import Excel</TabsTrigger>
            </TabsList>
            <TabsContent value="MANUEL" className="grid gap-3 pt-3">
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="outline" onClick={() => setLines((current) => [
                  ...current,
                  emptyLine(rows[0]),
                ])}>
                  <Plus className="size-4" /> Ajouter une ligne
                </Button>
              </div>
              <BatchLinesTable lines={lines} targets={targets} onChange={setLines} />
            </TabsContent>
            <TabsContent value="IMPORT" className="grid gap-3 pt-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <FileDropzone
                  file={file}
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  title="Déposer le relevé compagnie ici"
                  description="Un fichier .xlsx partagé par les mouvements sélectionnés"
                  onFileChange={(selected) => {
                    if (selected && !selected.name.toLowerCase().endsWith(".xlsx")) {
                      toast.error("Le fichier doit être au format .xlsx");
                      return;
                    }
                    setFile(selected); setPreview(null); setLines([]);
                  }}
                />
                <Button type="button" variant="outline" disabled={!file || importFile.isPending} onClick={() => importFile.mutate()}>
                  <Upload className="size-4" /> Analyser le fichier
                </Button>
              </div>
              {preview ? <ImportSummary preview={preview} /> : null}
              <BatchLinesTable lines={lines} targets={targets} imported onChange={setLines} />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>Annuler</Button>
          <Button type="button" disabled={!complete || save.isPending} onClick={() => save.mutate()}>
            Enregistrer l’affectation groupée
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchLinesTable({ lines, targets, imported = false, onChange }: {
  lines: BatchLine[];
  targets: Array<{ id: string; label: string }>;
  imported?: boolean;
  onChange: (lines: BatchLine[]) => void;
}) {
  const update = (key: string, patch: Partial<BatchLine>) => onChange(lines.map((line) => line.key === key ? { ...line, ...patch } : line));
  return (
    <div className="overflow-x-auto border">
      <table className="w-full min-w-[1580px] text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase"><tr>
          <th className="px-2 py-2">Mouvement cible</th><th className="px-2 py-2">N° quittance</th>
          <th className="px-2 py-2">Date effet</th><th className="px-2 py-2">Date échéance</th>
          <th className="px-2 py-2 text-right">Prime nette</th><th className="px-2 py-2 text-right">Taxes</th>
          <th className="px-2 py-2 text-right">Accessoires</th><th className="px-2 py-2 text-right">TTC</th>
          <th className="px-2 py-2 text-right">Commission nette</th><th className="px-2 py-2 text-right">Net compagnie</th><th />
        </tr></thead>
        <tbody>{lines.length ? lines.map((line) => <tr key={line.key} className="border-t align-top">
          <td className="min-w-64 px-2 py-2"><Select value={line.quittanceId} onValueChange={(value) => update(line.key, { quittanceId: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{targets.map((target) => <SelectItem key={target.id} value={target.id}>{target.label}</SelectItem>)}</SelectContent>
          </Select></td>
          <td className="min-w-44 px-2 py-2"><Input readOnly={imported} value={line.numeroQuittanceCompagnie} onChange={(event) => update(line.key, { numeroQuittanceCompagnie: event.target.value })} /></td>
          <td className="min-w-40 px-2 py-2"><DatePicker disabled={imported} date={line.dateEffet} onSelect={(date) => update(line.key, { dateEffet: toDateOnly(date) ?? "" })} /></td>
          <td className="min-w-40 px-2 py-2"><DatePicker disabled={imported} date={line.dateEcheance} onSelect={(date) => update(line.key, { dateEcheance: toDateOnly(date) ?? "" })} /></td>
          <MoneyCell value={line.primeNette} readOnly={imported} onChange={(value) => update(line.key, { primeNette: value })} />
          <MoneyCell value={line.montantTaxes} readOnly={imported} onChange={(value) => update(line.key, { montantTaxes: value })} />
          <MoneyCell value={line.accessoires} readOnly={imported} onChange={(value) => update(line.key, { accessoires: value })} />
          <MoneyCell value={line.montantTtc} readOnly={imported} onChange={(value) => update(line.key, { montantTtc: value })} />
          <MoneyCell value={line.commissionNette} readOnly={imported} onChange={(value) => update(line.key, { commissionNette: value })} />
          <td className="whitespace-nowrap px-2 py-3 text-right">{line.netCompagnie == null ? "—" : money(line.netCompagnie)}</td>
          <td className="px-2 py-2">{!imported ? <Button type="button" size="icon" variant="ghost" title="Retirer" onClick={() => onChange(lines.filter((item) => item.key !== line.key))}><Trash2 className="size-4 text-destructive" /></Button> : null}</td>
        </tr>) : <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Aucune ligne compagnie.</td></tr>}</tbody>
      </table>
    </div>
  );
}

function MoneyCell({ value, readOnly, onChange }: { value?: number; readOnly: boolean; onChange: (value?: number) => void }) {
  return <td className="min-w-36 px-2 py-2"><MoneyInput className="text-right" value={value} readOnly={readOnly} onValueChange={onChange} /></td>;
}

function ImportSummary({ preview }: { preview: ImportPreview }) {
  return <div className="grid gap-2">
    <div className="flex flex-wrap items-center gap-2"><FileSpreadsheet className="size-4" /><span className="font-medium">{preview.fichier}</span><Badge variant="secondary">{preview.lignesLues} ligne(s)</Badge><Badge variant={preview.equilibre ? "default" : "destructive"}>Écart {money(preview.ecart)}</Badge></div>
    {preview.erreurs.length ? <Alert variant="destructive"><AlertTitle>Anomalies d’import</AlertTitle><AlertDescription>{preview.erreurs.join(" · ")}</AlertDescription></Alert> : null}
  </div>;
}

function Metric({ label, value, error = false }: { label: string; value: string; error?: boolean }) {
  return <div className="bg-background px-4 py-3"><div className="text-xs uppercase text-muted-foreground">{label}</div><div className={error ? "mt-1 font-semibold text-destructive" : "mt-1 font-semibold"}>{value}</div></div>;
}

function emptyLine(row?: QuittanceAllocation): BatchLine {
  return { key: crypto.randomUUID(), quittanceId: row?.quittanceId ?? "", numeroQuittanceCompagnie: "", dateEffet: row?.dateEffet ?? "", dateEcheance: row?.dateEcheance ?? "" };
}

function toBatchLine(line: AllocationLine): BatchLine {
  return { key: line.id ?? crypto.randomUUID(), quittanceId: line.quittanceId ?? "", numeroQuittanceCompagnie: line.numeroQuittanceCompagnie, dateEffet: line.dateEffet, dateEcheance: line.dateEcheance ?? "", acteSource: line.acteSource, categorieSource: line.categorieSource, statutSource: line.statutSource, fichierSource: line.fichierSource, primeNette: line.primeNette, montantTaxes: line.montantTaxes, accessoires: line.accessoires, montantTtc: line.montantTtc, commissionNette: line.commissionNette, montantRetenue: line.montantRetenue, netCompagnie: line.netCompagnie };
}

function money(value: number) { return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(value); }
function dateLabel(value?: string | null) { return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`)) : "—"; }
