import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronsUpDown, Edit, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TableRowActions } from "@/components/shared/table-row-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toDateOnly } from "../date";
import { productionApi } from "../api";
import { Field } from "../components/Field";
import type {
  ReferenceOption,
  UpsertProduitAssistanceRequest,
  UpsertTarifProduitAssistanceRequest,
} from "../types";

const ALL = "__all__";
const NONE = "__none__";

export default function AssistanceProductsSettingsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [productSearch, setProductSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(searchParams.get("compagnieId") || ALL);
  const [editingProduct, setEditingProduct] = useState<ReferenceOption | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productPayload, setProductPayload] = useState<UpsertProduitAssistanceRequest>(emptyProduct(""));
  const [tarifProduct, setTarifProduct] = useState<ReferenceOption | null>(null);
  const [editingTarif, setEditingTarif] = useState<ReferenceOption | null>(null);
  const [tarifPayload, setTarifPayload] = useState<UpsertTarifProduitAssistanceRequest>(emptyTarif());

  const companies = useQuery({
    queryKey: ["referentiel", "compagnies-assistance", "settings"],
    queryFn: () => productionApi.referentiel("compagnies-assistance", { includeInactive: "true" }),
    staleTime: 60_000,
  });

  const products = useQuery({
    queryKey: ["referentiel", "produits-assistance", "settings"],
    queryFn: () => productionApi.referentiel("produits-assistance", { includeInactive: "true" }),
    staleTime: 60_000,
  });

  const categories = useQuery({
    queryKey: ["referentiel", "categories-client"],
    queryFn: () => productionApi.referentiel("categories-client"),
    staleTime: 60_000,
  });

  const usages = useQuery({
    queryKey: ["referentiel", "usages"],
    queryFn: () => productionApi.referentiel("usages"),
    staleTime: 60_000,
  });

  const tarifs = useQuery({
    queryKey: ["referentiel", "produits-assistance", tarifProduct?.id, "tarifs"],
    queryFn: () => tarifProduct ? productionApi.listTarifsProduitAssistance(tarifProduct.id) : Promise.resolve([]),
    enabled: Boolean(tarifProduct),
    staleTime: 30_000,
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCompanyId === ALL) {
      params.delete("compagnieId");
    } else {
      params.set("compagnieId", selectedCompanyId);
    }
    setSearchParams(params, { replace: true });
  }, [selectedCompanyId, setSearchParams]);

  useEffect(() => {
    if (!productDialogOpen) return;
    const defaultCompany = selectedCompanyId === ALL ? "" : selectedCompanyId;
    setProductPayload(editingProduct ? productToPayload(editingProduct) : emptyProduct(defaultCompany));
  }, [editingProduct, productDialogOpen, selectedCompanyId]);

  useEffect(() => {
    setTarifPayload(editingTarif ? tarifToPayload(editingTarif) : emptyTarif());
  }, [editingTarif, tarifProduct]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return (products.data ?? []).filter((product) => {
      if (selectedCompanyId !== ALL && refString(product, "compagnieAssistanceId") !== selectedCompanyId) return false;
      if (!term) return true;
      return [
        product.libelle,
        refString(product, "type"),
        refString(product, "compagnieAssistanceLibelle"),
        refString(product, "categorieClientLibelle"),
        refString(product, "prestations"),
        refArray(product, "usageCodes").join(" "),
      ].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [productSearch, products.data, selectedCompanyId]);

  const productUsages = useMemo(
    () => usagesForCategory(usages.data ?? [], categories.data ?? [], productPayload.categorieClientId),
    [categories.data, productPayload.categorieClientId, usages.data]
  );

  const saveProduct = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertProduitAssistanceRequest }) =>
      id ? productionApi.updateProduitAssistance(id, value) : productionApi.createProduitAssistance(value),
    onSuccess: async () => {
      setProductDialogOpen(false);
      setEditingProduct(null);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "produits-assistance"] });
      toast.success("Produit d'assistance enregistré");
    },
    onError: showError,
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => productionApi.deleteProduitAssistance(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "produits-assistance"] });
      toast.success("Produit d'assistance désactivé");
    },
    onError: showError,
  });

  const saveTarif = useMutation({
    mutationFn: ({ productId, tarifId, value }: { productId: string; tarifId?: string; value: UpsertTarifProduitAssistanceRequest }) =>
      tarifId
        ? productionApi.updateTarifProduitAssistance(productId, tarifId, value)
        : productionApi.createTarifProduitAssistance(productId, value),
    onSuccess: async () => {
      setEditingTarif(null);
      setTarifPayload(emptyTarif());
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "produits-assistance"] });
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "produits-assistance", tarifProduct?.id, "tarifs"] });
      toast.success("Tarif assistance enregistré");
    },
    onError: showError,
  });

  const deleteTarif = useMutation({
    mutationFn: ({ productId, tarifId }: { productId: string; tarifId: string }) => productionApi.deleteTarifProduitAssistance(productId, tarifId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "produits-assistance"] });
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "produits-assistance", tarifProduct?.id, "tarifs"] });
      toast.success("Tarif assistance supprimé");
    },
    onError: showError,
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Assistance</p>
          <h1 className="text-xl font-semibold tracking-tight">Produits assistance</h1>
          <p className="text-sm text-muted-foreground">Produits par compagnie, catégorie, usages couverts et périodes tarifaires.</p>
        </div>
        <Button onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }}>
          <Plus className="size-4" />
          Produit assistance
        </Button>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_280px_280px]">
          <div>
            <h2 className="font-semibold">Liste des produits</h2>
            <p className="text-sm text-muted-foreground">Les tarifs se gèrent depuis l'action Tarifs de chaque produit.</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Filtrer produit" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} />
          </div>
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les compagnies</SelectItem>
              {(companies.data ?? []).map((company) => (
                <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader className="bg-amber-600 text-white [&_th]:text-white">
              <TableRow className="hover:bg-amber-600">
                <TableHead>Produit</TableHead>
                <TableHead>Compagnie</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Usages</TableHead>
                <TableHead className="text-right">HT</TableHead>
                <TableHead className="text-right">TTC</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="font-medium">{product.libelle}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">{refString(product, "prestations") || "-"}</div>
                  </TableCell>
                  <TableCell>{refString(product, "compagnieAssistanceLibelle") || "-"}</TableCell>
                  <TableCell>{refString(product, "type") || "-"}</TableCell>
                  <TableCell>{refString(product, "categorieClientLibelle") || "Toutes"}</TableCell>
                  <TableCell className="max-w-64">
                    <span className="line-clamp-2 text-xs text-muted-foreground">{refArray(product, "usageCodes").join(", ") || "Tous les usages"}</span>
                  </TableCell>
                  <TableCell className="text-right">{money(refNumber(product, "montantHt"))}</TableCell>
                  <TableCell className="text-right font-medium">{money(refNumber(product, "montantTtc"))}</TableCell>
                  <TableCell>{periodLabel(product)}</TableCell>
                  <TableCell>{product.actif === false ? "Non" : "Oui"}</TableCell>
                  <TableCell className="text-right">
                    <TableRowActions
                      label={`Actions ${product.libelle}`}
                      actions={[
                        {
                          label: "Tarifs",
                          icon: CalendarDays,
                          onSelect: () => { setTarifProduct(product); setEditingTarif(null); },
                        },
                        {
                          label: "Modifier",
                          icon: Edit,
                          onSelect: () => { setEditingProduct(product); setProductDialogOpen(true); },
                        },
                        {
                          label: "Désactiver",
                          icon: Trash2,
                          destructive: true,
                          disabled: product.actif === false || deleteProduct.isPending,
                          onSelect: () => deleteProduct.mutate(product.id),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!products.isLoading && filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Aucun produit assistance.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={productDialogOpen} onOpenChange={(open) => { setProductDialogOpen(open); if (!open) setEditingProduct(null); }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Modifier produit assistance" : "Ajouter produit assistance"}</DialogTitle>
            <DialogDescription>Le tarif est géré séparément par périodes afin de conserver l'historique.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Compagnie assistance" required>
              <Select value={productPayload.compagnieAssistanceId || NONE} onValueChange={(value) => setProductPayload((current) => ({ ...current, compagnieAssistanceId: value === NONE ? "" : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Choisir</SelectItem>
                  {(companies.data ?? []).filter((company) => company.actif !== false || company.id === productPayload.compagnieAssistanceId).map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Type">
              <Select value={productPayload.type || NONE} onValueChange={(value) => setProductPayload((current) => ({ ...current, type: value === NONE ? undefined : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun</SelectItem>
                  <SelectItem value="Assistance Automobile">Assistance Automobile</SelectItem>
                  <SelectItem value="Assistance Voyage">Assistance Voyage</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Produit" required>
              <Input value={productPayload.libelle} onChange={(event) => setProductPayload((current) => ({ ...current, libelle: event.target.value }))} />
            </Field>
            <Field label="Catégorie client">
              <Select value={productPayload.categorieClientId || NONE} onValueChange={(value) => {
                const categorieClientId = value === NONE ? undefined : value;
                const allowedUsages = usagesForCategory(usages.data ?? [], categories.data ?? [], categorieClientId);
                const allowedIds = new Set(allowedUsages.map((usage) => usage.id));
                setProductPayload((current) => ({
                  ...current,
                  categorieClientId,
                  usageIds: (current.usageIds ?? []).filter((usageId) => allowedIds.has(usageId)),
                }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Toutes les catégories</SelectItem>
                  {(categories.data ?? []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Usages couverts">
              <UsagesMultiSelect
                usages={productUsages}
                value={productPayload.usageIds ?? []}
                onChange={(usageIds) => setProductPayload((current) => ({ ...current, usageIds }))}
              />
            </Field>
            <Field label="Prestations">
              <Textarea rows={6} value={productPayload.prestations ?? ""} onChange={(event) => setProductPayload((current) => ({ ...current, prestations: event.target.value }))} />
            </Field>
            <label className="flex min-h-9 items-center gap-2 self-end rounded-md border border-slate-300 bg-slate-50/70 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950/70">
              <Checkbox checked={productPayload.actif !== false} onCheckedChange={(value) => setProductPayload((current) => ({ ...current, actif: Boolean(value) }))} />
              <span>Actif</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>Annuler</Button>
            <Button disabled={saveProduct.isPending} onClick={() => submitProduct(editingProduct, productPayload, saveProduct.mutate)}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(tarifProduct)} onOpenChange={(open) => { if (!open) { setTarifProduct(null); setEditingTarif(null); } }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tarifs produit assistance</DialogTitle>
            <DialogDescription>{tarifProduct?.libelle} - {refString(tarifProduct ?? {}, "compagnieAssistanceLibelle")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
            <Field label="Date début" required>
              <DatePicker date={tarifPayload.dateDebut} onSelect={(date) => setTarifPayload((current) => ({ ...current, dateDebut: toDateOnly(date) ?? "" }))} />
            </Field>
            <Field label="Date fin">
              <DatePicker date={tarifPayload.dateFin} onSelect={(date) => setTarifPayload((current) => ({ ...current, dateFin: toDateOnly(date) }))} />
            </Field>
            <Field label="Montant HT" required>
              <Input type="number" min={0} step="0.01" value={tarifPayload.montantHt || ""} onChange={(event) => setTarifPayload((current) => ({ ...current, montantHt: numberValue(event.target.value) }))} />
            </Field>
            <Field label="Montant TTC" required>
              <Input type="number" min={0} step="0.01" value={tarifPayload.montantTtc || ""} onChange={(event) => setTarifPayload((current) => ({ ...current, montantTtc: numberValue(event.target.value) }))} />
            </Field>
            <div className="flex gap-2 md:col-span-4">
              <Button disabled={saveTarif.isPending || !tarifProduct} onClick={() => submitTarif(tarifProduct, editingTarif, tarifPayload, saveTarif.mutate)}>
                {editingTarif ? "Mettre à jour" : "Ajouter période"}
              </Button>
              <Button variant="outline" onClick={() => { setEditingTarif(null); setTarifPayload(emptyTarif()); }}>Réinitialiser</Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-amber-600 text-white [&_th]:text-white">
                <TableRow className="hover:bg-amber-600">
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Montant HT</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tarifs.data ?? []).map((tarif) => (
                  <TableRow key={tarif.id}>
                    <TableCell>{periodLabelFromDates(refString(tarif, "dateDebut"), refString(tarif, "dateFin"))}</TableCell>
                    <TableCell className="text-right">{money(refNumber(tarif, "montantHt"))}</TableCell>
                    <TableCell className="text-right font-medium">{money(refNumber(tarif, "montantTtc"))}</TableCell>
                    <TableCell className="text-right">
                      <TableRowActions
                        label="Actions tarif"
                        actions={[
                          {
                            label: "Modifier tarif",
                            icon: Edit,
                            onSelect: () => setEditingTarif(tarif),
                          },
                          {
                            label: "Supprimer tarif",
                            icon: Trash2,
                            destructive: true,
                            disabled: !tarifProduct || deleteTarif.isPending,
                            onSelect: () => tarifProduct && deleteTarif.mutate({ productId: tarifProduct.id, tarifId: tarif.id }),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {!tarifs.isLoading && (tarifs.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Aucun tarif pour ce produit.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function emptyProduct(compagnieAssistanceId: string): UpsertProduitAssistanceRequest {
  return { compagnieAssistanceId, libelle: "", type: "Assistance Automobile", usageIds: [], actif: true };
}

function emptyTarif(): UpsertTarifProduitAssistanceRequest {
  return { dateDebut: "", montantHt: 0, montantTtc: 0, actif: true };
}

function productToPayload(product: ReferenceOption): UpsertProduitAssistanceRequest {
  return {
    compagnieAssistanceId: refString(product, "compagnieAssistanceId"),
    categorieClientId: refString(product, "categorieClientId") || undefined,
    libelle: product.libelle,
    type: refString(product, "type") || undefined,
    prestations: refString(product, "prestations") || undefined,
    usageIds: refArray(product, "usageIds"),
    actif: product.actif !== false,
  };
}

function tarifToPayload(tarif: ReferenceOption): UpsertTarifProduitAssistanceRequest {
  return {
    dateDebut: refString(tarif, "dateDebut"),
    dateFin: refString(tarif, "dateFin") || undefined,
    montantHt: refNumber(tarif, "montantHt") ?? 0,
    montantTtc: refNumber(tarif, "montantTtc") ?? 0,
    actif: tarif.actif !== false,
  };
}

function submitProduct(
  editing: ReferenceOption | null,
  payload: UpsertProduitAssistanceRequest,
  mutate: (variables: { id?: string; value: UpsertProduitAssistanceRequest }) => void
) {
  const value = {
    ...payload,
    libelle: payload.libelle.trim(),
    type: cleanOptional(payload.type),
    prestations: cleanOptional(payload.prestations),
    categorieClientId: cleanOptional(payload.categorieClientId),
    usageIds: payload.usageIds ?? [],
  };
  if (!value.compagnieAssistanceId || !value.libelle) {
    toast.error("Compagnie assistance et produit sont obligatoires.");
    return;
  }
  mutate({ id: editing?.id, value });
}

function submitTarif(
  product: ReferenceOption | null,
  editing: ReferenceOption | null,
  payload: UpsertTarifProduitAssistanceRequest,
  mutate: (variables: { productId: string; tarifId?: string; value: UpsertTarifProduitAssistanceRequest }) => void
) {
  if (!product) return;
  if (!payload.dateDebut || payload.montantHt < 0 || payload.montantTtc < 0) {
    toast.error("Date début et montants positifs sont obligatoires.");
    return;
  }
  mutate({ productId: product.id, tarifId: editing?.id, value: { ...payload, dateFin: payload.dateFin || undefined } });
}

function UsagesMultiSelect({
  usages,
  value,
  onChange,
}: {
  usages: ReferenceOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const selected = usages.filter((usage) => value.includes(usage.id));
  const label = selected.length === 0
    ? "Tous les usages"
    : selected.length === 1
      ? usageLabel(selected[0])
      : `${selected.length} usages sélectionnés`;

  const toggle = (usageId: string) => {
    const ids = new Set(value);
    if (ids.has(usageId)) {
      ids.delete(usageId);
    } else {
      ids.add(usageId);
    }
    onChange(Array.from(ids));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between border-slate-300 bg-slate-50/70 px-3 font-normal shadow-none dark:border-neutral-700 dark:bg-neutral-950/70"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Rechercher usage..." />
          <CommandList
            className="max-h-72 overscroll-contain"
            onWheelCapture={(event) => {
              event.currentTarget.scrollTop += event.deltaY;
              event.stopPropagation();
            }}
          >
            <CommandEmpty>Aucun usage.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => onChange([])}>
                <Check className={cn("size-4", value.length === 0 ? "opacity-100" : "opacity-0")} />
                Tous les usages
              </CommandItem>
              {usages.map((usage) => {
                const checked = value.includes(usage.id);
                return (
                  <CommandItem key={usage.id} value={usageLabel(usage)} onSelect={() => toggle(usage.id)}>
                    <Check className={cn("size-4", checked ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{usageLabel(usage)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function usageLabel(usage: ReferenceOption) {
  return `${usage.code ? `${usage.code} - ` : ""}${usage.libelle}`;
}

function usagesForCategory(usages: ReferenceOption[], categories: ReferenceOption[], categorieClientId?: string) {
  if (!categorieClientId) return usages;
  const category = categories.find((item) => item.id === categorieClientId);
  const allowedIds = new Set(refArray(category ?? {}, "usageIds"));
  if (allowedIds.size === 0) return usages;
  return usages.filter((usage) => allowedIds.has(usage.id));
}

function refString(item: ReferenceOption | Record<string, unknown>, key: string) {
  const value = item[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function refNumber(item: ReferenceOption, key: string) {
  const value = item[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return undefined;
}

function refArray(item: ReferenceOption | Record<string, unknown>, key: string) {
  const value = item[key];
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry));
}

function numberValue(value: string) {
  return value.trim() === "" ? 0 : Number(value);
}

function cleanOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function money(value?: number) {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function periodLabel(product: ReferenceOption) {
  return periodLabelFromDates(refString(product, "dateDebutTarif"), refString(product, "dateFinTarif"));
}

function periodLabelFromDates(start?: string, end?: string) {
  if (!start && !end) return "-";
  return `${formatDate(start)} -> ${end ? formatDate(end) : "ouverte"}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
