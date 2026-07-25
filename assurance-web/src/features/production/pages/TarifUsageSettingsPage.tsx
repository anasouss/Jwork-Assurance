import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Edit, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { bulkTarifUsageSchema, tarifUsageSchema } from "../schemas";
import { Field } from "../components/Field";
import { money, numberValue, range, text, toNumber } from "../utils/format";
import type { BulkUpdateTarifUsageRequest, ReferenceOption, UpsertTarifUsageRequest } from "../types";

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPayload, setBulkPayload] = useState<BulkUpdateTarifUsageRequest>({
    adjustmentType: "PERCENT",
    direction: "INCREASE",
    value: 0,
  });
  const selectedUsage = usages.data?.find((usage) => usage.id === payload.usageId);
  const filteredTarifs = useMemo(
    () => (tarifs.data ?? []).filter((tarif) => !filterUsageId || tarif.usageId === filterUsageId),
    [filterUsageId, tarifs.data]
  );

  useEffect(() => {
    setPayload(editing ? tarifPayload(editing) : emptyTarifUsage());
  }, [editing]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredTarifs.some((tarif) => tarif.id === id)));
  }, [filteredTarifs]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertTarifUsageRequest }) =>
      id ? productionApi.updateTarifUsage(id, value) : productionApi.createTarifUsage(value),
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
    mutationFn: productionApi.deleteTarifUsage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "tarifs-usage"] });
      toast.success("Tarif usage supprimé");
    },
    onError: showError,
  });

  const bulk = useMutation({
    mutationFn: productionApi.bulkUpdateTarifUsagePrimeNette,
    onSuccess: async (result) => {
      setSelectedIds([]);
      setBulkDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "tarifs-usage"] });
      toast.success(`${result.updatedRows} tarif(s) mis à jour`);
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
          <Button variant="outline" onClick={() => {
            setEditing(null);
            setPayload(emptyTarifUsage());
            setTarifDialogOpen(true);
          }}>
            <Plus className="size-4" />
            Ajouter tarif usage
          </Button>
          <Button onClick={() => setBulkDialogOpen(true)}>
            Ajustement groupé prime nette
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
                    sousClasse: undefined,
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
            {selectedUsage?.byCarburantAndPf || selectedUsage?.bySousClasse ? (
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
              <Field label="Sous-classe">
                <Select
                  value={payload.sousClasse || "__none"}
                  onValueChange={(value) => update({ sousClasse: value === "__none" ? undefined : value })}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                  <SelectItem value="__none">Choisir</SelectItem>
                  {(sousClasses.data ?? []).map((sousClasse) => (
                    <SelectItem key={sousClasse.id} value={sousClasse.code ?? sousClasse.libelle}>{sousClasse.libelle}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <NumberField label="Prime nette" required value={payload.primeNette} onChange={(value) => update({ primeNette: value })} />
            <NumberField label="Prime par place" value={payload.primeParPlace} onChange={(value) => update({ primeParPlace: value })} />
            <Flag label="Actif" checked={payload.actif} onChange={(value) => update({ actif: value })} />
            <div className="flex items-end gap-2">
              <Button disabled={save.isPending} onClick={() => saveTarif(editing, payload, save.mutate)}>
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
            <DialogTitle>Ajustement groupé prime nette</DialogTitle>
            <DialogDescription>Applique un pourcentage ou un montant fixe aux lignes cochées, ou au filtre usage courant.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 lg:grid-cols-4">
          <Field label="Type">
            <Select
              value={bulkPayload.adjustmentType}
              onValueChange={(value) => setBulkPayload((current) => ({ ...current, adjustmentType: value as "PERCENT" | "FIXED" }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">Pourcentage (%)</SelectItem>
                <SelectItem value="FIXED">Montant fixe (DH)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sens">
            <Select
              value={bulkPayload.direction}
              onValueChange={(value) => setBulkPayload((current) => ({ ...current, direction: value as "INCREASE" | "DECREASE" }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INCREASE">Augmenter</SelectItem>
                <SelectItem value="DECREASE">Diminuer</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <NumberField
            label={bulkPayload.adjustmentType === "PERCENT" ? "Valeur (%)" : "Valeur (DH)"}
            value={bulkPayload.value}
            onChange={(value) => setBulkPayload((current) => ({ ...current, value: value ?? 0 }))}
            required
          />
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedIds(filteredTarifs.map((tarif) => tarif.id))}
              disabled={filteredTarifs.length === 0}
            >
              Tout cocher
            </Button>
            <Button
              disabled={bulk.isPending}
              onClick={() => {
                const parsed = bulkTarifUsageSchema.safeParse({
                  ...bulkPayload,
                  tarifIds: selectedIds.length ? selectedIds : undefined,
                  usageIds: selectedIds.length ? undefined : filterUsageId ? [filterUsageId] : undefined,
                });
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Ajustement incomplet");
                  return;
                }
                bulk.mutate(parsed.data);
              }}
            >
              Appliquer
            </Button>
          </div>
          <p className="lg:col-span-4 text-xs text-muted-foreground">
            Si aucune ligne n'est cochée, l'ajustement cible le filtre usage courant. Sans filtre, il cible tous les tarifs actifs.
          </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-border/70 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Liste des tarifs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Usage</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Carburant</TableHead>
                  <TableHead>PF</TableHead>
                  <TableHead>Places</TableHead>
                  <TableHead>PTC</TableHead>
                  <TableHead>Sous-classe</TableHead>
                  <TableHead>Prime place</TableHead>
                  <TableHead>Prime nette</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTarifs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">Aucun tarif usage.</TableCell>
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
                    <TableCell>{text(tarif.sousClasse)}</TableCell>
                    <TableCell>{money(tarif.primeParPlace)}</TableCell>
                    <TableCell>{money(tarif.primeNette)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(tarif); setTarifDialogOpen(true); }}>
                          <Edit className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove.mutate(tarif.id)}>
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </div>
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

function NumberField({ label, value, onChange, required }: { label: string; value?: number; onChange: (value?: number) => void; required?: boolean }) {
  return (
    <Field label={label} required={required}>
      <Input type="number" value={value ?? ""} onChange={(event) => onChange(numberValue(event.target.value))} />
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
    queryFn: () => productionApi.referentiel(path),
    staleTime: 60_000,
  });
}

function saveTarif(
  editing: ReferenceOption | null,
  payload: UpsertTarifUsageRequest,
  mutate: (variables: { id?: string; value: UpsertTarifUsageRequest }) => void
) {
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
    sousClasse: String(tarif.sousClasse ?? ""),
    carburant: String(tarif.carburant ?? ""),
    primeNette: toNumber(tarif.primeNette),
    primeParPlace: toNumber(tarif.primeParPlace),
    actif: tarif.actif !== false,
  };
}

function cleanPayload(payload: UpsertTarifUsageRequest): UpsertTarifUsageRequest {
  return {
    ...payload,
    categorieTransportId: payload.categorieTransportId || undefined,
    carburant: payload.carburant || undefined,
    sousClasse: payload.sousClasse || undefined,
  };
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
