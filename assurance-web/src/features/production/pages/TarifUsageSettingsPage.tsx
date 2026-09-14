import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Edit, History, Plus, RotateCcw, Trash2 } from "lucide-react";
import { ServerPagination } from "@/components/shared";
import { TableRowActions } from "@/components/shared/table-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { pricingApi } from "../api/pricing";
import { referenceApi } from "../api/references";
import { bulkTarifUsageSchema, tarifUsageSchema } from "../schemas";
import { Field } from "../components/Field";
import { MoneyInput } from "../components/MoneyInput";
import { toDateOnly } from "../date";
import { money, numberValue, range, text, toNumber } from "../utils/format";
import type { BulkUpdateTarifUsageRequest, ReferenceOption, TarifUsageAdjustment, UpsertTarifUsageRequest } from "../types";

export default function TarifUsageSettingsPage() {
  const queryClient = useQueryClient();
  const tarifs = useReference("tarifs-usage");
  const usages = useReference("usages");
  const categoriesTransport = useReference("categories-transport");
  const carburants = useReference("carburants");
  const sousClasses = useReference("sous-classes");
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [payload, setPayload] = useState<UpsertTarifUsageRequest>(emptyTarifUsage());
  const [filterUsageId, setFilterUsageId] = useState("");
  const [tarifDialogOpen, setTarifDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPayload, setBulkPayload] = useState<BulkUpdateTarifUsageRequest>({
    typeOperation: "AJUSTEMENT",
    typeCalcul: "POURCENTAGE",
    sens: "HAUSSE",
    value: 0,
    dateDebut: toDateOnly(new Date())!,
  });
  const [resetPayload, setResetPayload] = useState<BulkUpdateTarifUsageRequest>({
    typeOperation: "REINITIALISATION",
    dateDebut: toDateOnly(new Date())!,
  });
  const selectedUsage = usages.data?.find((usage) => usage.id === payload.usageId);
  const filteredTarifs = useMemo(
    () => (tarifs.data ?? []).filter((tarif) => !filterUsageId || tarif.usageId === filterUsageId),
    [filterUsageId, tarifs.data]
  );
  const history = useQuery({
    queryKey: ["referentiel", "tarifs-usage", "ajustements", historyPage],
    queryFn: () => pricingApi.usageRateAdjustmentHistory(historyPage),
    enabled: historyDialogOpen,
  });
  const allFilteredSelected = filteredTarifs.length > 0
    && filteredTarifs.every((tarif) => selectedIds.includes(tarif.id));
  const someFilteredSelected = filteredTarifs.some((tarif) => selectedIds.includes(tarif.id));

  useEffect(() => {
    setPayload(editing ? tarifPayload(editing) : emptyTarifUsage());
  }, [editing]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredTarifs.some((tarif) => tarif.id === id)));
  }, [filteredTarifs]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertTarifUsageRequest }) =>
      id ? pricingApi.updateUsageRate(id, value) : pricingApi.createUsageRate(value),
    onSuccess: async () => {
      setEditing(null);
      setPayload(emptyTarifUsage());
      setTarifDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "tarifs-usage"] });
      toast.success("Tarif usage enregistré");
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: pricingApi.deleteUsageRate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "tarifs-usage"] });
      toast.success("Tarif usage supprimé");
    },
    onError: showError,
  });

  const bulk = useMutation({
    mutationFn: pricingApi.bulkUpdateUsageNetPremium,
    onSuccess: async (result) => {
      setSelectedIds([]);
      setBulkDialogOpen(false);
      setResetDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "tarifs-usage"] });
      toast.success(`${result.updatedRows} tarif(s) traité(s)`);
    },
    onError: showError,
  });

  const update = (patch: Partial<UpsertTarifUsageRequest>) => setPayload((current) => ({ ...current, ...patch }));

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Paramètres production</p>
        <h1 className="text-xl font-semibold tracking-tight">Tarifs par usage</h1>
        <p className="text-sm text-muted-foreground">Base de calcul RC par usage, alignée avec Skay params/tarifs-usage.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
        <Field label="Filtrer usage">
          <Select value={filterUsageId || "all"} onValueChange={(value) => setFilterUsageId(value === "all" ? "" : value)}>
            <SelectTrigger className="md:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les usages</SelectItem>
              {(usages.data ?? []).map((usage) => (
                <SelectItem key={usage.id} value={usage.id}>{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setHistoryPage(0); setHistoryDialogOpen(true); }}>
            <History className="size-4" />
            Historique
          </Button>
          <Button variant="outline" onClick={() => {
            setEditing(null);
            setPayload(emptyTarifUsage());
            setTarifDialogOpen(true);
          }}>
            <Plus className="size-4" />
            Ajouter tarif usage
          </Button>
          <Button variant="outline" onClick={() => setResetDialogOpen(true)}>
            <RotateCcw className="size-4" />
            Réinitialiser
          </Button>
          <Button onClick={() => setBulkDialogOpen(true)}>
            Ajuster les tarifs
          </Button>
        </div>
      </div>

      <Dialog open={tarifDialogOpen} onOpenChange={(open) => { setTarifDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier tarif usage" : "Ajouter tarif usage"}</DialogTitle>
            <DialogDescription>Les champs visibles dépendent du paramétrage de l'usage sélectionné.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 lg:grid-cols-4">
            <Field label="Usage" required>
              <Select
                value={payload.usageId || "__none"}
                onValueChange={(value) => {
                  const usageId = value === "__none" ? "" : value;
                  update({
                    usageId,
                    categorieTransportId: undefined,
                    carburant: undefined,
                    puissanceFiscaleMin: undefined,
                    puissanceFiscaleMax: undefined,
                    nombrePlacesMin: undefined,
                    nombrePlacesMax: undefined,
                    ptcMin: undefined,
                    ptcMax: undefined,
                    sousClasseId: undefined,
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                <SelectItem value="__none">Choisir</SelectItem>
                {(usages.data ?? []).map((usage) => (
                  <SelectItem key={usage.id} value={usage.id}>{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</SelectItem>
                ))}
                </SelectContent>
              </Select>
            </Field>
            {selectedUsage?.byCategorieTransport ? (
              <Field label="Catégorie transport">
                <Select
                  value={payload.categorieTransportId || "__none"}
                  onValueChange={(value) => update({ categorieTransportId: value === "__none" ? undefined : value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                  <SelectItem value="__none">Aucune</SelectItem>
                  {(categoriesTransport.data ?? []).map((categorie) => (
                    <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {selectedUsage?.byCarburantAndPf ? (
              <Field label="Carburant">
                <Select
                  value={payload.carburant || "__none"}
                  onValueChange={(value) => update({ carburant: value === "__none" ? undefined : value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                  <SelectItem value="__none">Aucun</SelectItem>
                  {(carburants.data ?? []).map((carburant) => (
                    <SelectItem key={carburant.id} value={carburant.code ?? carburant.libelle}>{carburant.libelle}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {selectedUsage?.byCarburantAndPf ? (
              <>
                <NumberField label="PF min" value={payload.puissanceFiscaleMin} onChange={(value) => update({ puissanceFiscaleMin: value })} />
                <NumberField label="PF max" value={payload.puissanceFiscaleMax} onChange={(value) => update({ puissanceFiscaleMax: value })} />
              </>
            ) : null}
            {selectedUsage?.byPrime ? (
              <>
                <NumberField label="Places min" value={payload.nombrePlacesMin} onChange={(value) => update({ nombrePlacesMin: value })} />
                <NumberField label="Places max" value={payload.nombrePlacesMax} onChange={(value) => update({ nombrePlacesMax: value })} />
              </>
            ) : null}
            {selectedUsage?.byPtc ? (
              <>
                <NumberField label="PTC min" value={payload.ptcMin} onChange={(value) => update({ ptcMin: value })} />
                <NumberField label="PTC max" value={payload.ptcMax} onChange={(value) => update({ ptcMax: value })} />
              </>
            ) : null}
            {selectedUsage?.bySousClasse ? (
              <Field label="Sous-classe" required>
                <Select
                  value={payload.sousClasseId || "__none"}
                  onValueChange={(value) => update({ sousClasseId: value === "__none" ? undefined : value })}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                  <SelectItem value="__none">Choisir</SelectItem>
                  {(sousClasses.data ?? []).filter((sousClasse) => sousClasse.actif !== false).map((sousClasse) => (
                    <SelectItem key={sousClasse.id} value={sousClasse.id}>
                      {sousClasse.code ? `${sousClasse.code} - ` : ""}{sousClasse.libelle}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <MoneyField label="Prime nette" required value={payload.primeNette} onChange={(value) => update({ primeNette: value })} />
            <MoneyField label="Prime par place" value={payload.primeParPlace} onChange={(value) => update({ primeParPlace: value })} />
            <Flag label="Actif" checked={payload.actif} onChange={(value) => update({ actif: value })} />
            <div className="flex items-end gap-2">
              <Button
                disabled={save.isPending}
                onClick={() => saveTarif(editing, payload, Boolean(selectedUsage?.bySousClasse), save.mutate)}
              >
                <Plus className="size-4" />
                {editing ? "Modifier" : "Ajouter"}
              </Button>
              <Button variant="outline" onClick={() => setTarifDialogOpen(false)}>Annuler</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Ajuster les tarifs</DialogTitle>
            <DialogDescription>
              Le calcul part toujours du tarif initial. Une opération plus récente prévaut lorsque les périodes se chevauchent.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-3">
            <Field label="Mode de calcul" required>
              <Select
                value={bulkPayload.typeCalcul}
                onValueChange={(value) => setBulkPayload((current) => ({ ...current, typeCalcul: value as "POURCENTAGE" | "MONTANT_FIXE" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POURCENTAGE">Pourcentage (%)</SelectItem>
                  <SelectItem value="MONTANT_FIXE">Montant fixe (DH)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sens" required>
              <Select
                value={bulkPayload.sens}
                onValueChange={(value) => setBulkPayload((current) => ({ ...current, sens: value as "HAUSSE" | "BAISSE" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HAUSSE">Augmentation</SelectItem>
                  <SelectItem value="BAISSE">Diminution</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumberField
              label={bulkPayload.typeCalcul === "POURCENTAGE" ? "Valeur (%)" : "Valeur (DH)"}
              value={bulkPayload.value}
              onChange={(value) => setBulkPayload((current) => ({ ...current, value: value ?? 0 }))}
              required
            />
            <DateField label="Date de début" value={bulkPayload.dateDebut} onChange={(dateDebut) => setBulkPayload((current) => ({ ...current, dateDebut }))} required />
            <DateField label="Date de fin" value={bulkPayload.dateFin} minDate={isoDate(bulkPayload.dateDebut)} onChange={(dateFin) => setBulkPayload((current) => ({ ...current, dateFin }))} />
            <div className="lg:col-span-3">
              <Field label="Motif">
                <Textarea value={bulkPayload.motif ?? ""} maxLength={500} onChange={(event) => setBulkPayload((current) => ({ ...current, motif: event.target.value }))} />
              </Field>
            </div>
            <TargetNotice selectedCount={selectedIds.length} usageFiltered={Boolean(filterUsageId)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Annuler</Button>
            <Button
              disabled={bulk.isPending}
              onClick={() => submitTariffOperation(bulkPayload, selectedIds, filterUsageId, bulk.mutate)}
            >
              Enregistrer l'ajustement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Réinitialiser les tarifs</DialogTitle>
            <DialogDescription>
              Les tarifs visés reprendront leur valeur initiale pendant la période indiquée. L'historique restera conservé.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="Date de début" value={resetPayload.dateDebut} onChange={(dateDebut) => setResetPayload((current) => ({ ...current, dateDebut }))} required />
            <DateField label="Date de fin" value={resetPayload.dateFin} minDate={isoDate(resetPayload.dateDebut)} onChange={(dateFin) => setResetPayload((current) => ({ ...current, dateFin }))} />
            <div className="sm:col-span-2">
              <Field label="Motif">
                <Textarea value={resetPayload.motif ?? ""} maxLength={500} onChange={(event) => setResetPayload((current) => ({ ...current, motif: event.target.value }))} />
              </Field>
            </div>
            <TargetNotice selectedCount={selectedIds.length} usageFiltered={Boolean(filterUsageId)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Annuler</Button>
            <Button
              disabled={bulk.isPending}
              onClick={() => submitTariffOperation(resetPayload, selectedIds, filterUsageId, bulk.mutate)}
            >
              <RotateCcw className="size-4" />
              Confirmer la réinitialisation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        rows={history.data?.items ?? []}
        loading={history.isLoading}
        page={history.data?.page.number ?? historyPage}
        totalPages={history.data?.page.totalPages ?? 0}
        totalElements={history.data?.page.totalElements ?? 0}
        expandedId={expandedHistoryId}
        onExpandedChange={setExpandedHistoryId}
        onPageChange={setHistoryPage}
      />

      <Card className="border-border/70 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Liste des tarifs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
                <TableRow className="hover:bg-emerald-700">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => setSelectedIds(checked ? filteredTarifs.map((tarif) => tarif.id) : [])}
                      aria-label="Sélectionner tous les tarifs filtrés"
                      className="border-white/80 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-emerald-700 data-[state=indeterminate]:border-white data-[state=indeterminate]:bg-white data-[state=indeterminate]:text-emerald-700"
                    />
                  </TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Carburant</TableHead>
                  <TableHead>PF</TableHead>
                  <TableHead>Places</TableHead>
                  <TableHead>PTC</TableHead>
                  <TableHead>Sous-classe</TableHead>
                  <TableHead>Prime place</TableHead>
                  <TableHead className="text-right">Tarif initial</TableHead>
                  <TableHead className="text-right">Tarif applicable</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTarifs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">Aucun tarif usage.</TableCell>
                  </TableRow>
                ) : filteredTarifs.map((tarif) => (
                  <TableRow key={tarif.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(tarif.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((current) => checked
                            ? [...new Set([...current, tarif.id])]
                            : current.filter((id) => id !== tarif.id));
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{text(tarif.usageCode)}</TableCell>
                    <TableCell>{text(tarif.categorieTransportLibelle)}</TableCell>
                    <TableCell>{text(tarif.carburant)}</TableCell>
                    <TableCell>{range(tarif.puissanceFiscaleMin, tarif.puissanceFiscaleMax)}</TableCell>
                    <TableCell>{range(tarif.nombrePlacesMin, tarif.nombrePlacesMax)}</TableCell>
                    <TableCell>{range(tarif.ptcMin, tarif.ptcMax)}</TableCell>
                    <TableCell>{text(tarif.sousClasseCode ?? tarif.sousClasseLibelle)}</TableCell>
                    <TableCell>{money(tarif.primeParPlace)}</TableCell>
                    <TableCell className="text-right">{money(tarif.primeNetteInitiale)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {money(tarif.primeNette)}
                      {toNumber(tarif.primeNette) !== toNumber(tarif.primeNetteInitiale) ? (
                        <Badge variant="secondary" className="ml-2">Ajusté</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <TableRowActions
                        label={`Actions tarif ${text(tarif.usageCode)}`}
                        actions={[
                          {
                            label: "Modifier",
                            icon: Edit,
                            onSelect: () => { setEditing(tarif); setTarifDialogOpen(true); },
                          },
                          {
                            label: "Supprimer",
                            icon: Trash2,
                            destructive: true,
                            onSelect: () => remove.mutate(tarif.id),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  required,
  minDate,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  required?: boolean;
  minDate?: Date;
}) {
  return (
    <Field label={label} required={required}>
      <DatePicker date={value} minDate={minDate} onSelect={(date) => onChange(toDateOnly(date) ?? "")} />
    </Field>
  );
}

function TargetNotice({ selectedCount, usageFiltered }: { selectedCount: number; usageFiltered: boolean }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm sm:col-span-2 lg:col-span-3">
      {selectedCount
        ? `${selectedCount} tarif(s) sélectionné(s).`
        : usageFiltered
          ? "Tous les tarifs actifs de l'usage filtré seront concernés."
          : "Tous les tarifs actifs de tous les usages seront concernés."}
    </div>
  );
}

function HistoryDialog({
  open,
  onOpenChange,
  rows,
  loading,
  page,
  totalPages,
  totalElements,
  expandedId,
  onExpandedChange,
  onPageChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: TarifUsageAdjustment[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalElements: number;
  expandedId?: string;
  onExpandedChange: (id?: string) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Historique des tarifs</DialogTitle>
          <DialogDescription>Chaque opération conserve le tarif initial et le tarif appliqué pour sa période.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-emerald-700 [&_th]:text-white">
              <TableRow className="hover:bg-emerald-700">
                <TableHead className="w-10" />
                <TableHead>Opération</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Valeur</TableHead>
                <TableHead>Tarifs</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Enregistré par</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">Aucun ajustement enregistré.</TableCell></TableRow>
              ) : rows.map((row) => (
                <TariffHistoryRows
                  key={row.id}
                  row={row}
                  expanded={expandedId === row.id}
                  onToggle={() => onExpandedChange(expandedId === row.id ? undefined : row.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <ServerPagination
          page={page}
          totalPages={totalPages}
          totalElements={totalElements}
          loading={loading}
          onPageChange={onPageChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function TariffHistoryRows({ row, expanded, onToggle }: { row: TarifUsageAdjustment; expanded: boolean; onToggle: () => void }) {
  const value = row.typeOperation === "REINITIALISATION"
    ? "Tarif initial"
    : `${row.sens === "BAISSE" ? "-" : "+"}${money(row.valeur)}${row.typeCalcul === "POURCENTAGE" ? " %" : " DH"}`;
  return (
    <>
      <TableRow>
        <TableCell>
          <Button type="button" variant="ghost" size="icon" onClick={onToggle} title="Voir les tarifs concernés">
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </TableCell>
        <TableCell>
          <Badge variant={row.typeOperation === "REINITIALISATION" ? "secondary" : "outline"}>
            {row.typeOperation === "REINITIALISATION" ? "Réinitialisation" : "Ajustement"}
          </Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap">{formatIsoDate(row.dateDebut)} au {row.dateFin ? formatIsoDate(row.dateFin) : "sans fin"}</TableCell>
        <TableCell>{value}</TableCell>
        <TableCell>{row.nombreTarifs}</TableCell>
        <TableCell className="max-w-64 truncate" title={row.motif}>{row.motif}</TableCell>
        <TableCell>
          <div>{row.createdByName || "Système"}</div>
          <div className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</div>
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} className="bg-muted/20 p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="px-4 py-2 text-left">Usage</th><th className="px-4 py-2 text-left">Critères</th><th className="px-4 py-2 text-right">Initial</th><th className="px-4 py-2 text-right">Appliqué</th></tr></thead>
              <tbody>{row.lignes.map((line) => (
                <tr key={line.tarifUsageId} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{line.usageCode || "-"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{line.description || "-"}</td>
                  <td className="px-4 py-2 text-right">{money(line.primeNetteInitiale)}</td>
                  <td className="px-4 py-2 text-right font-medium">{money(line.primeNetteAppliquee)}</td>
                </tr>
              ))}</tbody>
            </table>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function submitTariffOperation(
  payload: BulkUpdateTarifUsageRequest,
  selectedIds: string[],
  filterUsageId: string,
  mutate: (payload: BulkUpdateTarifUsageRequest) => void
) {
  const parsed = bulkTarifUsageSchema.safeParse({
    ...payload,
    dateFin: payload.dateFin || undefined,
    tarifIds: selectedIds.length ? selectedIds : undefined,
    usageIds: selectedIds.length ? undefined : filterUsageId ? [filterUsageId] : undefined,
  });
  if (!parsed.success) {
    toast.error(parsed.error.issues[0]?.message ?? "Opération incomplète");
    return;
  }
  mutate(parsed.data);
}

function formatIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function isoDate(value?: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR");
}

function NumberField({ label, value, onChange, required }: { label: string; value?: number; onChange: (value?: number) => void; required?: boolean }) {
  return (
    <Field label={label} required={required}>
      <Input type="number" value={value ?? ""} onChange={(event) => onChange(numberValue(event.target.value))} />
    </Field>
  );
}

function MoneyField({ label, value, onChange, required }: { label: string; value?: number; onChange: (value?: number) => void; required?: boolean }) {
  return (
    <Field label={label} required={required}>
      <MoneyInput value={value} onValueChange={onChange} />
    </Field>
  );
}

function Flag({ label, checked, onChange }: { label: string; checked?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-slate-50/70 px-3 text-sm dark:border-slate-600 dark:bg-slate-900">
      <Checkbox checked={Boolean(checked)} onCheckedChange={(value) => onChange(Boolean(value))} />
      <span>{label}</span>
    </label>
  );
}

function useReference(path: string) {
  return useQuery({
    queryKey: ["referentiel", path],
    queryFn: () => referenceApi.list(path),
    staleTime: 60_000,
  });
}

function saveTarif(
  editing: ReferenceOption | null,
  payload: UpsertTarifUsageRequest,
  sousClasseRequired: boolean,
  mutate: (variables: { id?: string; value: UpsertTarifUsageRequest }) => void
) {
  if (sousClasseRequired && !payload.sousClasseId) {
    toast.error("La sous-classe est obligatoire pour cet usage");
    return;
  }
  const parsed = tarifUsageSchema.safeParse(cleanPayload(payload));
  if (!parsed.success) {
    toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
    return;
  }
  mutate({ id: editing?.id, value: parsed.data });
}

function emptyTarifUsage(): UpsertTarifUsageRequest {
  return { usageId: "", actif: true };
}

function tarifPayload(tarif: ReferenceOption): UpsertTarifUsageRequest {
  return {
    usageId: String(tarif.usageId ?? ""),
    categorieTransportId: String(tarif.categorieTransportId ?? ""),
    puissanceFiscaleMin: toNumber(tarif.puissanceFiscaleMin),
    puissanceFiscaleMax: toNumber(tarif.puissanceFiscaleMax),
    nombrePlacesMin: toNumber(tarif.nombrePlacesMin),
    nombrePlacesMax: toNumber(tarif.nombrePlacesMax),
    ptcMin: toNumber(tarif.ptcMin),
    ptcMax: toNumber(tarif.ptcMax),
    sousClasseId: String(tarif.sousClasseId ?? ""),
    carburant: String(tarif.carburant ?? ""),
    primeNette: toNumber(tarif.primeNetteInitiale ?? tarif.primeNette),
    primeParPlace: toNumber(tarif.primeParPlace),
    actif: tarif.actif !== false,
  };
}

function cleanPayload(payload: UpsertTarifUsageRequest): UpsertTarifUsageRequest {
  return {
    ...payload,
    categorieTransportId: payload.categorieTransportId || undefined,
    carburant: payload.carburant || undefined,
    sousClasseId: payload.sousClasseId || undefined,
  };
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
