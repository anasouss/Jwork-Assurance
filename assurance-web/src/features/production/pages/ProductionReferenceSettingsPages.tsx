import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Edit, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { productionApi } from "../api";
import { clientCategorySchema, codeReferenceSchema, garantieSchema, groupeUsageAttestationSchema, referenceSchema, transportCategorySchema, usageSchema } from "../schemas";
import { Field } from "../components/Field";
import { numberValue, toNumber } from "../utils/format";
import type { ReferenceOption, UpsertCategorieClientRequest, UpsertCodeReferenceRequest, UpsertGarantieRequest, UpsertGroupeUsageAttestationRequest, UpsertReferenceRequest, UpsertUsageRequest } from "../types";

export function MarquesSettingsPage() {
  return (
    <SimpleReferencePage
      title="Marques"
      description="Référentiel des marques véhicule."
      path="marques"
      create={productionApi.createMarque}
      update={productionApi.updateMarque}
    />
  );
}

export function CarrosseriesSettingsPage() {
  return (
    <SimpleReferencePage
      title="Carrosseries"
      description="Référentiel des carrosseries véhicule."
      path="carrosseries"
      create={productionApi.createCarrosserie}
      update={productionApi.updateCarrosserie}
    />
  );
}

export function CarburantsSettingsPage() {
  return (
    <CodeReferencePage
      title="Carburants"
      description="Types de carburant utilisés par les véhicules et les tarifs RC."
      path="carburants"
      create={productionApi.createCarburant}
      update={productionApi.updateCarburant}
    />
  );
}

export function SousClassesSettingsPage() {
  return (
    <CodeReferencePage
      title="Sous-classes"
      description="Référentiel des sous-classes Skay, utilisé par les usages qui tarifent sur sous-classe."
      path="sous-classes"
      create={productionApi.createSousClasse}
      update={productionApi.updateSousClasse}
    />
  );
}

export function CategoriesTransportSettingsPage() {
  const queryClient = useQueryClient();
  const query = useReference("categories-transport");
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState({ code: "", libelle: "", description: "", actif: true });

  useEffect(() => {
    setPayload(editing ? {
      code: editing.code ?? "",
      libelle: editing.libelle,
      description: editing.description ?? "",
      actif: editing.actif !== false,
    } : { code: "", libelle: "", description: "", actif: true });
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: TransportCategoryPayload }) =>
      id ? productionApi.updateCategorieTransport(id, cleanTextPayload(value)) : productionApi.createCategorieTransport(cleanTextPayload(value)),
    onSuccess: async () => {
      setEditing(null);
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "categories-transport"] });
      toast.success("Catégorie transport enregistrée");
    },
    onError: showError,
  });

  return (
    <ReferenceShell title="Catégories transport" description="Catégories utilisées par les usages et les tarifs RC.">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setPayload({ code: "", libelle: "", description: "", actif: true }); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter catégorie
        </Button>
      </div>
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier catégorie" : "Ajouter catégorie"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 lg:grid-cols-2">
          <Field label="Code" required>
            <Input value={payload.code} onChange={(event) => setPayload((current) => ({ ...current, code: event.target.value }))} />
          </Field>
          <Field label="Libellé" required>
            <Input value={payload.libelle} onChange={(event) => setPayload((current) => ({ ...current, libelle: event.target.value }))} />
          </Field>
          <Field label="Description">
            <Input value={payload.description} onChange={(event) => setPayload((current) => ({ ...current, description: event.target.value }))} />
          </Field>
          <Flag label="Actif" checked={payload.actif} onChange={(actif) => setPayload((current) => ({ ...current, actif }))} />
          <div className="flex items-end gap-2">
            <Button disabled={save.isPending} onClick={() => {
              const parsed = transportCategorySchema.safeParse(cleanTextPayload(payload));
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                return;
              }
              save.mutate({ id: editing?.id, value: parsed.data });
            }}>
              <Plus className="size-4" />
              {editing ? "Modifier" : "Ajouter"}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      <ReferenceTable query={query} columns={["Code", "Libellé", "Description", "Actif"]} onEdit={(item) => { setEditing(item); setDialogOpen(true); }} />
    </ReferenceShell>
  );
}

export function CategoriesClientSettingsPage() {
  const queryClient = useQueryClient();
  const categories = useReference("categories-client");
  const usages = useReference("usages");
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState<UpsertCategorieClientRequest>(emptyCategorieClient());

  useEffect(() => {
    setPayload(editing ? {
      code: editing.code ?? "",
      libelle: editing.libelle,
      usageIds: refArray(editing, "usageIds"),
      actif: editing.actif !== false,
    } : emptyCategorieClient());
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertCategorieClientRequest }) =>
      id ? productionApi.updateCategorieClient(id, value) : productionApi.createCategorieClient(value),
    onSuccess: async () => {
      setEditing(null);
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "categories-client"] });
      toast.success("Catégorie client enregistrée");
    },
    onError: showError,
  });

  return (
    <ReferenceShell
      title="Catégories client"
      description="Catégories qui limitent les usages autorisés pour conventions, flottes et produits d'assistance."
    >
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setPayload(emptyCategorieClient()); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter catégorie
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier catégorie client" : "Ajouter catégorie client"}</DialogTitle>
            <DialogDescription>Les usages cochés seront les seuls proposés pour cette catégorie. Aucun usage sélectionné signifie aucun filtre.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Code" required>
              <Input value={payload.code} onChange={(event) => setPayload((current) => ({ ...current, code: event.target.value }))} />
            </Field>
            <Field label="Libellé" required>
              <Input value={payload.libelle} onChange={(event) => setPayload((current) => ({ ...current, libelle: event.target.value }))} />
            </Field>
            <Field label="Usages autorisés">
              <UsageMultiSelect
                usages={usages.data ?? []}
                value={payload.usageIds ?? []}
                onChange={(usageIds) => setPayload((current) => ({ ...current, usageIds }))}
              />
            </Field>
            <Flag label="Actif" checked={payload.actif} onChange={(actif) => setPayload((current) => ({ ...current, actif }))} />
            <div className="flex items-end gap-2 lg:col-span-2">
              <Button disabled={save.isPending} onClick={() => {
                const parsed = clientCategorySchema.safeParse(cleanTextPayload(payload));
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                  return;
                }
                save.mutate({ id: editing?.id, value: parsed.data });
              }}>
                <Plus className="size-4" />
                {editing ? "Modifier" : "Ajouter"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-border/70 shadow-none">
        <CardHeader><CardTitle className="text-base">Liste des catégories client</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
                <TableRow className="hover:bg-emerald-700">
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Usages autorisés</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(categories.data ?? []).map((categorie) => (
                  <TableRow key={categorie.id}>
                    <TableCell className="font-medium">{categorie.code ?? "-"}</TableCell>
                    <TableCell>{categorie.libelle}</TableCell>
                    <TableCell>{categoryUsageSummary(categorie)}</TableCell>
                    <TableCell>{categorie.actif === false ? "Non" : "Oui"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(categorie); setDialogOpen(true); }} aria-label={`Modifier ${categorie.libelle}`}>
                        <Edit className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!categories.isLoading && (categories.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aucune catégorie client.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReferenceShell>
  );
}

export function GroupesUsageAttestationSettingsPage() {
  const queryClient = useQueryClient();
  const groupes = useReference("groupes-usage-attestation/parametrage");
  const compagnies = useReference("compagnies-assurance");
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState<UpsertGroupeUsageAttestationRequest>(emptyGroupeUsageAttestation());

  useEffect(() => {
    setPayload(editing ? {
      code: editing.code ?? "",
      libelle: editing.libelle,
      couleur: String(editing.couleur ?? "#059669"),
      compagnieRestrictionIds: refArray(editing, "compagnieRestrictionIds"),
      visibleStock: editing.visibleStock !== false,
      actif: editing.actif !== false,
    } : emptyGroupeUsageAttestation());
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertGroupeUsageAttestationRequest }) =>
      id ? productionApi.updateGroupeUsageAttestation(id, cleanTextPayload(value)) : productionApi.createGroupeUsageAttestation(cleanTextPayload(value)),
    onSuccess: async () => {
      setEditing(null);
      setDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["referentiel", "groupes-usage-attestation/parametrage"] }),
        queryClient.invalidateQueries({ queryKey: ["referentiel", "groupes-usage-attestation"] }),
        queryClient.invalidateQueries({ queryKey: ["attestations-stock", "dashboard"] }),
      ]);
      toast.success("Groupe stock enregistré");
    },
    onError: showError,
  });

  return (
    <ReferenceShell
      title="Groupes stock attestations"
      description="Groupes utilisés par le stock d'attestations. La couleur pilote les segments des graphiques."
    >
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setPayload(emptyGroupeUsageAttestation()); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter groupe
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier groupe stock" : "Ajouter groupe stock"}</DialogTitle>
            <DialogDescription>La couleur est enregistrée en base et utilisée par les graphiques de gestion du stock.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Code" required>
              <Input value={payload.code} onChange={(event) => setPayload((current) => ({ ...current, code: event.target.value }))} />
            </Field>
            <Field label="Libellé" required>
              <Input value={payload.libelle} onChange={(event) => setPayload((current) => ({ ...current, libelle: event.target.value }))} />
            </Field>
            <Field label="Couleur">
              <div className="flex gap-2">
                <Input
                  type="color"
                  className="h-10 w-14 shrink-0 p-1"
                  value={normalizeColor(payload.couleur)}
                  onChange={(event) => setPayload((current) => ({ ...current, couleur: event.target.value }))}
                />
                <Input
                  value={payload.couleur ?? ""}
                  onChange={(event) => setPayload((current) => ({ ...current, couleur: event.target.value }))}
                  placeholder="#059669"
                />
              </div>
            </Field>
            <Field label="Restriction compagnie">
              <CompanyRestrictionSelect
                value={payload.compagnieRestrictionIds ?? []}
                compagnies={compagnies.data ?? []}
                onChange={(compagnieRestrictionIds) => setPayload((current) => ({ ...current, compagnieRestrictionIds }))}
              />
            </Field>
            <Flag label="Visible dans le stock" checked={payload.visibleStock !== false} onChange={(visibleStock) => setPayload((current) => ({ ...current, visibleStock }))} />
            <Flag label="Actif" checked={payload.actif !== false} onChange={(actif) => setPayload((current) => ({ ...current, actif }))} />
            <div className="flex items-end gap-2 lg:col-span-2">
              <Button disabled={save.isPending} onClick={() => {
                const parsed = groupeUsageAttestationSchema.safeParse(cleanTextPayload(payload));
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                  return;
                }
                save.mutate({ id: editing?.id, value: parsed.data });
              }}>
                <Plus className="size-4" />
                {editing ? "Modifier" : "Ajouter"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-border/70 shadow-none">
        <CardHeader><CardTitle className="text-base">Liste des groupes stock</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
                <TableRow className="hover:bg-emerald-700">
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Couleur</TableHead>
                  <TableHead>Restriction</TableHead>
                  <TableHead>Visible stock</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(groupes.data ?? []).map((groupe) => (
                  <TableRow key={groupe.id}>
                    <TableCell className="font-medium">{groupe.code ?? "-"}</TableCell>
                    <TableCell>{groupe.libelle}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="size-4 rounded-sm border" style={{ backgroundColor: normalizeColor(String(groupe.couleur ?? "")) }} />
                        <span>{String(groupe.couleur ?? "-")}</span>
                      </div>
                    </TableCell>
                    <TableCell>{refArray(groupe, "compagnieRestrictionLibelles").join(", ") || "Aucune restriction"}</TableCell>
                    <TableCell>{groupe.visibleStock === false ? "Non" : "Oui"}</TableCell>
                    <TableCell>{groupe.actif === false ? "Non" : "Oui"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(groupe); setDialogOpen(true); }} aria-label={`Modifier ${groupe.libelle}`}>
                        <Edit className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!groupes.isLoading && (groupes.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Aucun groupe stock.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReferenceShell>
  );
}

type TransportCategoryPayload = {
  code: string;
  libelle: string;
  description?: string;
  actif?: boolean;
};

function emptyCategorieClient(): UpsertCategorieClientRequest {
  return { code: "", libelle: "", usageIds: [], actif: true };
}

function emptyGroupeUsageAttestation(): UpsertGroupeUsageAttestationRequest {
  return { code: "", libelle: "", couleur: "#059669", compagnieRestrictionIds: [], visibleStock: true, actif: true };
}

function CompanyRestrictionSelect({
  value,
  compagnies,
  onChange,
}: {
  value: string[];
  compagnies: ReferenceOption[];
  onChange: (value: string[]) => void;
}) {
  const selected = new Set(value);
  const selectedLabels = compagnies
    .filter((compagnie) => selected.has(String(compagnie.id)))
    .map((compagnie) => compagnie.libelle);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(Array.from(next));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-10 w-full justify-between font-normal">
          <span className="truncate">{selectedLabels.length ? selectedLabels.join(", ") : "Aucune restriction"}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Filtrer compagnie" />
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty>Aucune compagnie.</CommandEmpty>
            <CommandGroup>
              {compagnies.map((compagnie) => {
                const id = String(compagnie.id);
                const checked = selected.has(id);
                return (
                  <CommandItem key={id} value={`${compagnie.code ?? ""} ${compagnie.libelle}`} onSelect={() => toggle(id)}>
                    <Check className={cn("size-4", checked ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{compagnie.code ? `${compagnie.code} - ` : ""}{compagnie.libelle}</span>
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

export function UsagesSettingsPage() {
  const queryClient = useQueryClient();
  const usages = useReference("usages");
  const groupes = useReference("groupes-usage-attestation");
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState<UpsertUsageRequest>(emptyUsage());

  useEffect(() => {
    setPayload(editing ? {
      code: editing.code ?? "",
      libelle: editing.libelle,
      criteria: String(editing.criteria ?? ""),
      groupeUsageAttestationId: String(editing.groupeUsageAttestationId ?? ""),
      consommeAttestation: editing.consommeAttestation !== false,
      byCarburantAndPf: Boolean(editing.byCarburantAndPf),
      bySousClasse: Boolean(editing.bySousClasse),
      byPtc: Boolean(editing.byPtc),
      byPrime: Boolean(editing.byPrime),
      byCategorieTransport: Boolean(editing.byCategorieTransport),
      garantiesPersonne: Boolean(editing.garantiesPersonne),
      actif: editing.actif !== false,
    } : emptyUsage());
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertUsageRequest }) =>
      id ? productionApi.updateUsage(id, value) : productionApi.createUsage(value),
    onSuccess: async () => {
      setEditing(null);
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "usages"] });
      toast.success("Usage enregistré");
    },
    onError: showError,
  });

  return (
    <ReferenceShell title="Usages" description="Critères qui pilotent les champs visibles, le stock d'attestations et les garanties personne.">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setPayload(emptyUsage()); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter usage
        </Button>
      </div>
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier usage" : "Ajouter usage"}</DialogTitle>
            <DialogDescription>Ces paramètres pilotent les champs visibles dans la création de contrat et le calcul RC.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <Field label="Code" required>
              <Input value={payload.code} onChange={(event) => setPayload((current) => ({ ...current, code: event.target.value }))} />
            </Field>
            <Field label="Libellé" required>
              <Input value={payload.libelle} onChange={(event) => setPayload((current) => ({ ...current, libelle: event.target.value }))} />
            </Field>
            <Field label="Critère">
              <Input value={payload.criteria ?? ""} onChange={(event) => setPayload((current) => ({ ...current, criteria: event.target.value }))} />
            </Field>
            <Field label="Groupe attestation">
              <Select
                value={payload.groupeUsageAttestationId || "__none"}
                onValueChange={(value) => setPayload((current) => ({ ...current, groupeUsageAttestationId: value === "__none" ? undefined : value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Aucun</SelectItem>
                  {(groupes.data ?? []).map((groupe) => <SelectItem key={groupe.id} value={groupe.id}>{groupe.code} - {groupe.libelle}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Flag label="Consomme attestation" checked={payload.consommeAttestation} onChange={(value) => setPayload((current) => ({ ...current, consommeAttestation: value }))} />
            <Flag label="Carburant + PF" checked={payload.byCarburantAndPf} onChange={(value) => setPayload((current) => ({ ...current, byCarburantAndPf: value }))} />
            <Flag label="Sous-classe" checked={payload.bySousClasse} onChange={(value) => setPayload((current) => ({ ...current, bySousClasse: value }))} />
            <Flag label="PTC" checked={payload.byPtc} onChange={(value) => setPayload((current) => ({ ...current, byPtc: value }))} />
            <Flag label="Places / prime" checked={payload.byPrime} onChange={(value) => setPayload((current) => ({ ...current, byPrime: value }))} />
            <Flag label="Catégorie transport" checked={payload.byCategorieTransport} onChange={(value) => setPayload((current) => ({ ...current, byCategorieTransport: value }))} />
            <Flag label="Garanties personne" checked={payload.garantiesPersonne} onChange={(value) => setPayload((current) => ({ ...current, garantiesPersonne: value }))} />
            <Flag label="Actif" checked={payload.actif} onChange={(value) => setPayload((current) => ({ ...current, actif: value }))} />
          </div>
          <div className="flex gap-2">
            <Button disabled={save.isPending} onClick={() => {
              const parsed = usageSchema.safeParse(cleanTextPayload(payload));
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                return;
              }
              save.mutate({ id: editing?.id, value: parsed.data });
            }}>
              <Plus className="size-4" />
              {editing ? "Modifier" : "Ajouter"}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      <Card className="border-border/70 shadow-none">
        <CardHeader><CardTitle className="text-base">Liste des usages</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
                <TableRow className="hover:bg-emerald-700">
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Critère</TableHead>
                  <TableHead>Attestation</TableHead>
                  <TableHead>Garanties personne</TableHead>
                  <TableHead>Critères tarif</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usages.data ?? []).map((usage) => (
                  <TableRow key={usage.id}>
                    <TableCell className="font-medium">{usage.code ?? "-"}</TableCell>
                    <TableCell>{usage.libelle}</TableCell>
                    <TableCell>{String(usage.criteria ?? "-")}</TableCell>
                    <TableCell>{usage.consommeAttestation === false ? "Non" : "Oui"}</TableCell>
                    <TableCell>{usage.garantiesPersonne ? "Oui" : "Non"}</TableCell>
                    <TableCell>{usageCriteria(usage)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(usage); setDialogOpen(true); }} aria-label={`Modifier ${usage.libelle}`}>
                        <Edit className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReferenceShell>
  );
}

const GARANTIE_TYPES = ["VEHICULE", "PERSONNE"] as const;
const MODES_TARIFICATION = ["TAUX", "CAPITAL", "PRIME_FIXE", "PROTECTION"] as const;
const VEHICULE_MODES_TARIFICATION = MODES_TARIFICATION.filter((mode) => mode !== "PROTECTION");
const SOURCES_VALEUR = ["VENALE", "NEUF", "GLACE", "MANUEL"] as const;
const SOURCES_VALEUR_WITH_NONE = ["AUCUNE", ...SOURCES_VALEUR] as const;

export function GarantiesSettingsPage() {
  const queryClient = useQueryClient();
  const garanties = useQuery({
    queryKey: ["referentiel", "garanties-parametrage"],
    queryFn: productionApi.garantiesParametrage,
    staleTime: 60_000,
  });
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState<UpsertGarantieRequest>(emptyGarantie());

  useEffect(() => {
    setPayload(editing ? normalizeGarantiePayload(garantiePayloadFromReference(editing)) : emptyGarantie());
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertGarantieRequest }) =>
      id ? productionApi.updateGarantie(id, value) : productionApi.createGarantie(value),
    onSuccess: async () => {
      setEditing(null);
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "garanties"] });
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "garanties-parametrage"] });
      toast.success("Garantie enregistrée");
    },
    onError: showError,
  });

  const update = (patch: Partial<UpsertGarantieRequest>) => {
    setPayload((current) => ({ ...current, ...patch }));
  };

  const setModeAllowed = (mode: string, checked: boolean) => {
    setPayload((current) => {
      const allowed = availableModesForType(current.typeGarantie);
      if (!allowed.includes(mode)) {
        return current;
      }
      const modes = toggleArray(current.modesAutorises ?? [], mode, checked).filter((item) => allowed.includes(item));
      if (!modes.length) {
        return current;
      }
      const modeParDefaut = modes.includes(current.modeParDefaut ?? "") ? current.modeParDefaut : modes[0];
      const modesTarificationMultiple = (current.modesTarificationMultiple ?? []).filter((item) => modes.includes(item));
      return { ...current, modesAutorises: modes, modeParDefaut, modesTarificationMultiple, tarificationMultiple: modesTarificationMultiple.length > 0 };
    });
  };

  const setTarificationMultiple = (checked: boolean) => {
    setPayload((current) => {
      if (!checked) {
        return { ...current, tarificationMultiple: false, modesTarificationMultiple: [] };
      }
      const fallbackMode = current.modeParDefaut && current.modeParDefaut !== "PROTECTION"
        ? current.modeParDefaut
        : (current.modesAutorises ?? []).find((mode) => mode !== "PROTECTION");
      return {
        ...current,
        tarificationMultiple: Boolean(fallbackMode),
        modesTarificationMultiple: fallbackMode ? [fallbackMode] : [],
      };
    });
  };

  const setMultipleModeAllowed = (mode: string, checked: boolean) => {
    setPayload((current) => {
      if (!(current.modesAutorises ?? []).includes(mode)) {
        return current;
      }
      const modesTarificationMultiple = checked ? [mode] : [];
      return {
        ...current,
        tarificationMultiple: modesTarificationMultiple.length > 0,
        modesTarificationMultiple,
      };
    });
  };

  const setSourceAllowed = (source: string, checked: boolean) => {
    setPayload((current) => {
      const sources = toggleArray(current.sourcesValeurAutorisees ?? [], source, checked);
      const sourceValeurParDefaut = current.sourceValeurParDefaut && (current.sourceValeurParDefaut === "AUCUNE" || sources.includes(current.sourceValeurParDefaut))
        ? current.sourceValeurParDefaut
        : "AUCUNE";
      return { ...current, sourcesValeurAutorisees: sources, sourceValeurParDefaut };
    });
  };

  const applyType = (typeGarantie: string) => {
    if (typeGarantie === "PERSONNE") {
      update({
        typeGarantie,
        modesAutorises: ["PROTECTION"],
        modeParDefaut: "PROTECTION",
        sourcesValeurAutorisees: [],
        sourceValeurParDefaut: "AUCUNE",
        requiertValeurVenale: false,
        requiertValeurNeuf: false,
        requiertValeurGlace: false,
        avecFranchise: false,
        avecCapital: true,
        tarificationMultiple: false,
        modesTarificationMultiple: [],
      });
      return;
    }
    update({
      typeGarantie,
      modesAutorises: ["TAUX"],
      modeParDefaut: "TAUX",
      tarificationMultiple: false,
      modesTarificationMultiple: [],
    });
  };

  return (
    <ReferenceShell title="Garanties" description="Paramétrage central des garanties, modes de tarification, sources de valeur et comportement des grilles.">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setPayload(emptyGarantie()); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter garantie
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier garantie" : "Ajouter garantie"}</DialogTitle>
            <DialogDescription>Ces champs pilotent les grilles tarifaires, la création flotte/convention et les formules personnes.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[75vh] gap-4 overflow-y-auto pr-1">
            <div className="grid gap-3 lg:grid-cols-5">
              <Field label="Code" required>
                <Input value={payload.code} onChange={(event) => update({ code: event.target.value })} />
              </Field>
              <Field label="Libellé" required>
                <Input value={payload.libelle} onChange={(event) => update({ libelle: event.target.value })} />
              </Field>
              <Field label="Branche">
                <Input value={payload.branche ?? ""} onChange={(event) => update({ branche: event.target.value })} />
              </Field>
              <Field label="Type">
                <Select value={payload.typeGarantie ?? "VEHICULE"} onValueChange={applyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GARANTIE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Ordre">
                <Input type="number" value={payload.ordreAffichage ?? ""} onChange={(event) => update({ ordreAffichage: numberValue(event.target.value) })} />
              </Field>
              <Field label="Description">
                <Input value={payload.description ?? ""} onChange={(event) => update({ description: event.target.value })} />
              </Field>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Flag label="Obligatoire" checked={payload.obligatoire} onChange={(value) => update({ obligatoire: value })} />
              <Flag label="Responsabilité civile" checked={payload.responsabiliteCivile} onChange={(value) => update({ responsabiliteCivile: value })} />
              <Flag label="Défense et recours" checked={payload.defenseRecours} onChange={(value) => update({ defenseRecours: value })} />
              <Flag label="Avec capital" checked={payload.avecCapital} onChange={(value) => update({ avecCapital: value })} />
              <Flag label="Taux franchise" checked={payload.avecFranchise} onChange={(value) => update({ avecFranchise: value, avecFranchiseMinimale: value ? payload.avecFranchiseMinimale : false })} />
              <Flag label="Franchise minimale" checked={payload.avecFranchiseMinimale} onChange={(value) => update({ avecFranchiseMinimale: value, avecFranchise: value ? true : payload.avecFranchise })} />
              <Flag label="Tarification multiple" checked={(payload.modesTarificationMultiple ?? []).length > 0} onChange={setTarificationMultiple} />
              <Flag label="Saisie manuelle" checked={payload.saisieManuelleAutorisee} onChange={(value) => update({ saisieManuelleAutorisee: value })} />
              <Flag label="Verrouillée" checked={payload.verrouillee} onChange={(value) => update({ verrouillee: value })} />
              <Flag label="Active" checked={payload.actif} onChange={(value) => update({ actif: value })} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="grid gap-3 rounded-md border p-3">
                <div className="text-sm font-semibold">Modes de tarification</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableModesForType(payload.typeGarantie).map((mode) => (
                    <Flag
                      key={mode}
                      label={modeLabel(mode)}
                      checked={(payload.modesAutorises ?? []).includes(mode)}
                      onChange={(checked) => setModeAllowed(mode, checked)}
                    />
                  ))}
                </div>
                <Field label="Mode par défaut">
                  <Select value={payload.modeParDefaut ?? ""} onValueChange={(value) => update({ modeParDefaut: value })}>
                    <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
                    <SelectContent>
                      {(payload.modesAutorises ?? []).filter((mode) => availableModesForType(payload.typeGarantie).includes(mode)).map((mode) => <SelectItem key={mode} value={mode}>{modeLabel(mode)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                {(payload.modesAutorises ?? []).filter((mode) => mode !== "PROTECTION").length > 0 ? (
                  <div className="grid gap-2">
                    <div className="text-xs font-medium text-muted-foreground">Modes avec plusieurs formules</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(payload.modesAutorises ?? []).filter((mode) => mode !== "PROTECTION").map((mode) => (
                        <Flag
                          key={mode}
                          label={modeLabel(mode)}
                          checked={(payload.modesTarificationMultiple ?? []).includes(mode)}
                          onChange={(checked) => setMultipleModeAllowed(mode, checked)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 rounded-md border p-3">
                <div className="text-sm font-semibold">Valeur assurée</div>
                <div className="text-xs font-medium text-muted-foreground">Champs obligatoires sur le véhicule</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Flag label="Valeur vénale" checked={payload.requiertValeurVenale} onChange={(value) => update({ requiertValeurVenale: value })} />
                  <Flag label="Valeur à neuf" checked={payload.requiertValeurNeuf} onChange={(value) => update({ requiertValeurNeuf: value })} />
                  <Flag label="Valeur glace" checked={payload.requiertValeurGlace} onChange={(value) => update({ requiertValeurGlace: value })} />
                </div>
                <div className="text-xs font-medium text-muted-foreground">Sources autorisées pour calculer le capital</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SOURCES_VALEUR.map((source) => (
                    <Flag
                      key={source}
                      label={sourceChoiceLabel(source)}
                      checked={(payload.sourcesValeurAutorisees ?? []).includes(source)}
                      onChange={(checked) => setSourceAllowed(source, checked)}
                    />
                  ))}
                </div>
                <Field label="Source par défaut">
                  <Select value={payload.sourceValeurParDefaut ?? "AUCUNE"} onValueChange={(value) => update({ sourceValeurParDefaut: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SOURCES_VALEUR_WITH_NONE
                        .filter((source) => source === "AUCUNE" || (payload.sourcesValeurAutorisees ?? []).includes(source))
                        .map((source) => <SelectItem key={source} value={source}>{sourceLabel(source)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <GarantieGrillePreview payload={payload} />

            <div className="flex gap-2">
              <Button disabled={save.isPending} onClick={() => {
                const parsed = garantieSchema.safeParse(cleanTextPayload(normalizeGarantiePayload(payload)));
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                  return;
                }
                save.mutate({ id: editing?.id, value: parsed.data });
              }}>
                <Plus className="size-4" />
                {editing ? "Modifier" : "Ajouter"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-border/70 shadow-none">
        <CardHeader><CardTitle className="text-base">Liste des garanties</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
                <TableRow className="hover:bg-emerald-700">
                  <TableHead>Ordre</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Grille</TableHead>
                  <TableHead>Valeurs</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(garanties.data ?? []).map((garantie) => (
                  <TableRow key={garantie.id}>
                    <TableCell>{toNumber(garantie.ordreAffichage) ?? "-"}</TableCell>
                    <TableCell className="font-medium">{garantie.code ?? "-"}</TableCell>
                    <TableCell>{garantie.libelle}</TableCell>
                    <TableCell>{String(garantie.typeGarantie ?? "VEHICULE")}</TableCell>
                    <TableCell>{String(garantie.modeParDefaut ?? "-")}</TableCell>
                    <TableCell>{garantieTags(garantie).join(", ") || "-"}</TableCell>
                    <TableCell>{valueTags(garantie).join(", ") || "-"}</TableCell>
                    <TableCell>{garantie.actif === false ? "Non" : "Oui"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(garantie); setDialogOpen(true); }} aria-label={`Modifier ${garantie.libelle}`}>
                        <Edit className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!garanties.isLoading && (garanties.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Aucune garantie.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ReferenceShell>
  );
}

function GarantieGrillePreview({ payload }: { payload: UpsertGarantieRequest }) {
  const code = payload.code?.trim() || "CODE";
  const libelle = payload.libelle?.trim() || "Libellé";
  const isPersonne = payload.typeGarantie === "PERSONNE";
  const allowed = availableModesForType(payload.typeGarantie);
  const modes = (payload.modesAutorises?.length ? payload.modesAutorises : [payload.modeParDefaut || allowed[0]])
    .filter((mode) => allowed.includes(mode));
  const mode = modes.includes(payload.modeParDefaut ?? "") ? payload.modeParDefaut! : modes[0] ?? allowed[0] ?? "TAUX";
  const multipleModes = (payload.modesTarificationMultiple ?? []).filter((item) => modes.includes(item));
  const multiple = multipleModes.length > 0;
  const [enabled, setEnabled] = useState(true);
  const [vehicleRows, setVehicleRows] = useState<PreviewVehicleRow[]>(() => [emptyPreviewVehicleRow(mode)]);
  const [personneRows, setPersonneRows] = useState<PreviewPersonneRow[]>(() => [emptyPreviewPersonneRow()]);
  const vehicleMode = vehicleRows[0]?.mode ?? mode;
  const canAddVehicleRow = multipleModes.includes(vehicleMode);

  useEffect(() => {
    setEnabled(true);
    setVehicleRows([emptyPreviewVehicleRow(mode)]);
    setPersonneRows([emptyPreviewPersonneRow()]);
  }, [code, isPersonne, mode, multiple, modes.join("|")]);

  const updateVehicleRow = (id: string, patch: Partial<PreviewVehicleRow>) => {
    setVehicleRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const updatePersonneRow = (id: string, patch: Partial<PreviewPersonneRow>) => {
    setPersonneRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  if (!isPersonne && payload.responsabiliteCivile) {
    return (
      <div className="grid gap-3 rounded-md border border-dashed p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-blue-600">Aperçu grille tarifaire</div>
          <span className="rounded-md border px-2 py-1 text-xs font-medium">RC</span>
        </div>
        <div className="rounded-md border bg-slate-50 px-3 py-4 text-sm text-muted-foreground dark:bg-slate-900">
          {code} - {libelle} ne sera pas affichée dans la grille configurable.
        </div>
      </div>
    );
  }

  if (isPersonne) {
    return (
      <div className="grid gap-3 rounded-md border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-blue-600">Aperçu grille tarifaire</div>
          <span className="rounded-md border px-2 py-1 text-xs font-medium">Garanties personnes</span>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Garantie</TableHead>
                <TableHead className="min-w-32">Formule</TableHead>
                <TableHead className="text-right">Décès</TableHead>
                <TableHead className="text-right">Invalidité</TableHead>
                <TableHead className="text-right">Frais médicaux</TableHead>
                <TableHead className="text-right">Frais hospitalisation</TableHead>
                <TableHead className="text-right">Frais funéraires</TableHead>
                <TableHead className="text-right">Frais chirurgie</TableHead>
                <TableHead className="text-right">Prime</TableHead>
                <TableHead className="text-right">Accessoire</TableHead>
                <TableHead className="w-16 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Checkbox checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} />
                </TableCell>
                <TableCell className="align-top font-semibold"><div className="pt-2">{code} - {libelle}</div></TableCell>
                <TableCell className="align-top"><PreviewPersonneStack rows={personneRows} enabled={enabled} field="formule" updateRow={updatePersonneRow} /></TableCell>
                <TableCell className="align-top"><PreviewPersonneStack rows={personneRows} enabled={enabled} field="deces" updateRow={updatePersonneRow} /></TableCell>
                <TableCell className="align-top"><PreviewPersonneStack rows={personneRows} enabled={enabled} field="invalidite" updateRow={updatePersonneRow} /></TableCell>
                <TableCell className="align-top"><PreviewPersonneStack rows={personneRows} enabled={enabled} field="fraisMedicaux" updateRow={updatePersonneRow} /></TableCell>
                <TableCell className="align-top"><PreviewPersonneStack rows={personneRows} enabled={enabled} field="fraisHospitalisation" updateRow={updatePersonneRow} /></TableCell>
                <TableCell className="align-top"><PreviewPersonneStack rows={personneRows} enabled={enabled} field="fraisFuneraires" updateRow={updatePersonneRow} /></TableCell>
                <TableCell className="align-top"><PreviewPersonneStack rows={personneRows} enabled={enabled} field="fraisChirurgie" updateRow={updatePersonneRow} /></TableCell>
                <TableCell className="align-top"><PreviewPersonneStack rows={personneRows} enabled={enabled} field="prime" updateRow={updatePersonneRow} /></TableCell>
                <TableCell className="align-top"><PreviewPersonneStack rows={personneRows} enabled={enabled} field="accessoire" updateRow={updatePersonneRow} /></TableCell>
                <TableCell className="align-top">
                  {multiple ? (
                    <div className="grid gap-2 pt-1">
                      <Button type="button" variant="ghost" size="icon" disabled={!enabled} onClick={() => setPersonneRows((rows) => [...rows, emptyPreviewPersonneRow(rows.length)])}>
                        <Plus className="size-4" />
                      </Button>
                      {personneRows.slice(1).map((row) => (
                        <Button key={row.id} type="button" variant="ghost" size="icon" disabled={!enabled} onClick={() => setPersonneRows((rows) => rows.filter((item) => item.id !== row.id))}>
                          <Trash2 className="size-4" />
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-blue-600">Aperçu grille tarifaire</div>
        <span className="rounded-md border px-2 py-1 text-xs font-medium">Garanties véhicule</span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Garantie</TableHead>
              <TableHead className="min-w-32">Mode</TableHead>
              <TableHead className="min-w-32 text-right">Taux de valeur</TableHead>
              <TableHead className="min-w-32 text-right">Taux franchise</TableHead>
              <TableHead className="min-w-32 text-right">Franchise minimale</TableHead>
              <TableHead className="min-w-32 text-right">Capital</TableHead>
              <TableHead className="min-w-32 text-right">Prime</TableHead>
              <TableHead className="w-16 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <Checkbox checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} />
              </TableCell>
              <TableCell className="align-top font-semibold"><div className="pt-2">{code} - {libelle}</div></TableCell>
              <TableCell className="align-top">
                <PreviewVehicleModeStack rows={vehicleRows} modes={modes} enabled={enabled} updateRow={updateVehicleRow} />
              </TableCell>
              <TableCell className="align-top"><PreviewVehicleNumberStack rows={vehicleRows} enabled={enabled} field="taux" disabledFor={(row) => row.mode !== "TAUX"} updateRow={updateVehicleRow} /></TableCell>
              <TableCell className="align-top"><PreviewVehicleNumberStack rows={vehicleRows} enabled={enabled} field="tauxFranchise" disabledFor={() => !payload.avecFranchise} updateRow={updateVehicleRow} /></TableCell>
              <TableCell className="align-top"><PreviewVehicleNumberStack rows={vehicleRows} enabled={enabled} field="franchiseMinimale" disabledFor={() => !payload.avecFranchiseMinimale} updateRow={updateVehicleRow} /></TableCell>
              <TableCell className="align-top"><PreviewVehicleNumberStack rows={vehicleRows} enabled={enabled} field="capital" disabledFor={(row) => row.mode !== "CAPITAL"} updateRow={updateVehicleRow} /></TableCell>
              <TableCell className="align-top"><PreviewVehicleNumberStack rows={vehicleRows} enabled={enabled} field="prime" disabledFor={(row) => row.mode !== "CAPITAL" && row.mode !== "PRIME_FIXE"} updateRow={updateVehicleRow} /></TableCell>
              <TableCell className="align-top">
                {canAddVehicleRow ? (
                  <div className="grid gap-2 pt-1">
                    <Button type="button" variant="ghost" size="icon" disabled={!enabled} onClick={() => setVehicleRows((rows) => [...rows, emptyPreviewVehicleRow(vehicleMode)])}>
                      <Plus className="size-4" />
                    </Button>
                    {vehicleRows.slice(1).map((row) => (
                      <Button key={row.id} type="button" variant="ghost" size="icon" disabled={!enabled} onClick={() => setVehicleRows((rows) => rows.filter((item) => item.id !== row.id))}>
                        <Trash2 className="size-4" />
                      </Button>
                    ))}
                  </div>
                ) : null}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

type PreviewVehicleRow = {
  id: string;
  mode: string;
  taux?: string;
  tauxFranchise?: string;
  franchiseMinimale?: string;
  capital?: string;
  prime?: string;
};

type PreviewPersonneRow = {
  id: string;
  formule?: string;
  deces?: string;
  invalidite?: string;
  fraisMedicaux?: string;
  fraisHospitalisation?: string;
  fraisFuneraires?: string;
  fraisChirurgie?: string;
  prime?: string;
  accessoire?: string;
};

function PreviewVehicleModeStack({
  rows,
  modes,
  enabled,
  updateRow,
}: {
  rows: PreviewVehicleRow[];
  modes: string[];
  enabled: boolean;
  updateRow: (id: string, patch: Partial<PreviewVehicleRow>) => void;
}) {
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        modes.length > 1 ? (
          <Select key={row.id} value={row.mode} disabled={!enabled} onValueChange={(value) => updateRow(row.id, { mode: value, taux: undefined, capital: undefined, prime: undefined })}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Mode" /></SelectTrigger>
            <SelectContent>
              {modes.map((mode) => <SelectItem key={mode} value={mode}>{modeLabel(mode)}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span key={row.id} className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-slate-50/70 px-3 text-sm dark:border-slate-600 dark:bg-slate-900">
            {modeLabel(row.mode)}
          </span>
        )
      ))}
    </div>
  );
}

function PreviewVehicleNumberStack({
  rows,
  enabled,
  field,
  disabledFor,
  updateRow,
}: {
  rows: PreviewVehicleRow[];
  enabled: boolean;
  field: "taux" | "tauxFranchise" | "franchiseMinimale" | "capital" | "prime";
  disabledFor: (row: PreviewVehicleRow) => boolean;
  updateRow: (id: string, patch: Partial<PreviewVehicleRow>) => void;
}) {
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <Input
          key={`${row.id}-${field}`}
          className="h-8 min-w-28 text-right"
          type="number"
          disabled={!enabled || disabledFor(row)}
          value={row[field] ?? ""}
          onChange={(event) => updateRow(row.id, { [field]: event.target.value })}
        />
      ))}
    </div>
  );
}

function PreviewPersonneStack({
  rows,
  enabled,
  field,
  updateRow,
}: {
  rows: PreviewPersonneRow[];
  enabled: boolean;
  field: keyof Omit<PreviewPersonneRow, "id">;
  updateRow: (id: string, patch: Partial<PreviewPersonneRow>) => void;
}) {
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <Input
          key={`${row.id}-${field}`}
          className={`h-8 min-w-28 ${field === "formule" ? "" : "text-right"}`}
          type={field === "formule" ? "text" : "number"}
          disabled={!enabled}
          value={row[field] ?? ""}
          onChange={(event) => updateRow(row.id, { [field]: event.target.value })}
        />
      ))}
    </div>
  );
}

function emptyPreviewVehicleRow(mode: string): PreviewVehicleRow {
  return {
    id: `${Date.now()}-${Math.random()}`,
    mode,
  };
}

function emptyPreviewPersonneRow(index = 0): PreviewPersonneRow {
  return {
    id: `${Date.now()}-${Math.random()}`,
    formule: `Formule ${index + 1}`,
  };
}

function SimpleReferencePage({
  title,
  description,
  path,
  create,
  update,
}: {
  title: string;
  description: string;
  path: string;
  create: (payload: UpsertReferenceRequest) => Promise<ReferenceOption>;
  update: (id: string, payload: UpsertReferenceRequest) => Promise<ReferenceOption>;
}) {
  const queryClient = useQueryClient();
  const query = useReference(path);
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState<UpsertReferenceRequest>({ libelle: "", actif: true });

  useEffect(() => {
    setPayload(editing ? { libelle: editing.libelle, actif: editing.actif !== false } : { libelle: "", actif: true });
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertReferenceRequest }) => id ? update(id, value) : create(value),
    onSuccess: async () => {
      setEditing(null);
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", path] });
      toast.success(`${title} enregistré`);
    },
    onError: showError,
  });

  return (
    <ReferenceShell title={title} description={description}>
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setPayload({ libelle: "", actif: true }); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier" : "Ajouter"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
          <Field label="Libellé" required>
            <Input value={payload.libelle} onChange={(event) => setPayload((current) => ({ ...current, libelle: event.target.value }))} />
          </Field>
          <Flag label="Actif" checked={payload.actif} onChange={(actif) => setPayload((current) => ({ ...current, actif }))} />
          <div className="flex items-end gap-2">
            <Button disabled={save.isPending} onClick={() => {
              const parsed = referenceSchema.safeParse(cleanTextPayload(payload));
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                return;
              }
              save.mutate({ id: editing?.id, value: parsed.data });
            }}>
              <Plus className="size-4" />
              {editing ? "Modifier" : "Ajouter"}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      <ReferenceTable query={query} columns={["Libellé", "Actif"]} onEdit={(item) => { setEditing(item); setDialogOpen(true); }} />
    </ReferenceShell>
  );
}

function CodeReferencePage({
  title,
  description,
  path,
  create,
  update,
}: {
  title: string;
  description: string;
  path: string;
  create: (payload: UpsertCodeReferenceRequest) => Promise<ReferenceOption>;
  update: (id: string, payload: UpsertCodeReferenceRequest) => Promise<ReferenceOption>;
}) {
  const queryClient = useQueryClient();
  const query = useReference(path);
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState<UpsertCodeReferenceRequest>({ code: "", libelle: "", actif: true });

  useEffect(() => {
    setPayload(editing
      ? { code: editing.code ?? "", libelle: editing.libelle, actif: editing.actif !== false }
      : { code: "", libelle: "", actif: true });
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertCodeReferenceRequest }) => id ? update(id, value) : create(value),
    onSuccess: async () => {
      setEditing(null);
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", path] });
      toast.success(`${title} enregistré`);
    },
    onError: showError,
  });

  return (
    <ReferenceShell title={title} description={description}>
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setPayload({ code: "", libelle: "", actif: true }); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier" : "Ajouter"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
          <Field label="Code" required>
            <Input value={payload.code} onChange={(event) => setPayload((current) => ({ ...current, code: event.target.value }))} />
          </Field>
          <Field label="Libellé" required>
            <Input value={payload.libelle} onChange={(event) => setPayload((current) => ({ ...current, libelle: event.target.value }))} />
          </Field>
          <Flag label="Actif" checked={payload.actif} onChange={(actif) => setPayload((current) => ({ ...current, actif }))} />
          <div className="flex items-end gap-2">
            <Button disabled={save.isPending} onClick={() => {
              const parsed = codeReferenceSchema.safeParse(cleanTextPayload(payload));
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                return;
              }
              save.mutate({ id: editing?.id, value: parsed.data });
            }}>
              <Plus className="size-4" />
              {editing ? "Modifier" : "Ajouter"}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      <ReferenceTable query={query} columns={["Code", "Libellé", "Actif"]} onEdit={(item) => { setEditing(item); setDialogOpen(true); }} />
    </ReferenceShell>
  );
}

function ReferenceShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Paramètres production</p>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ReferenceTable({
  query,
  columns,
  onEdit,
}: {
  query: ReturnType<typeof useReference>;
  columns: string[];
  onEdit: (item: ReferenceOption) => void;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader><CardTitle className="text-base">Liste</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
              <TableRow className="hover:bg-emerald-700">
                {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((item) => (
                <TableRow key={item.id}>
                  {columns.includes("Code") ? <TableCell className="font-medium">{item.code ?? "-"}</TableCell> : null}
                  <TableCell>{item.libelle}</TableCell>
                  {columns.includes("Description") ? <TableCell>{item.description ?? "-"}</TableCell> : null}
                  <TableCell>{item.actif === false ? "Non" : "Oui"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => onEdit(item)} aria-label={`Modifier ${item.libelle}`}>
                      <Edit className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!query.isLoading && (query.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="py-8 text-center text-muted-foreground">Aucune donnée.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
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

function UsageMultiSelect({
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
          className="h-9 w-full justify-between border-slate-300 bg-slate-50/70 px-3 font-normal shadow-none dark:border-slate-600 dark:bg-slate-900"
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

function useReference(path: string) {
  return useQuery({
    queryKey: ["referentiel", path],
    queryFn: () => productionApi.referentiel(path),
    staleTime: 60_000,
  });
}

function emptyUsage(): UpsertUsageRequest {
  return {
    code: "",
    libelle: "",
    criteria: "",
    groupeUsageAttestationId: undefined,
    consommeAttestation: true,
    byCarburantAndPf: false,
    bySousClasse: false,
    byPtc: false,
    byPrime: false,
    byCategorieTransport: false,
    garantiesPersonne: false,
    actif: true,
  };
}

function emptyGarantie(): UpsertGarantieRequest {
  return {
    code: "",
    libelle: "",
    description: "",
    branche: "Automobile",
    typeGarantie: "VEHICULE",
    obligatoire: false,
    responsabiliteCivile: false,
    defenseRecours: false,
    requiertValeurVenale: false,
    requiertValeurNeuf: false,
    requiertValeurGlace: false,
    avecFranchise: false,
    avecFranchiseMinimale: false,
    avecCapital: false,
    tarificationMultiple: false,
    modesTarificationMultiple: [],
    modesAutorises: ["TAUX"],
    modeParDefaut: "TAUX",
    sourcesValeurAutorisees: [],
    sourceValeurParDefaut: "AUCUNE",
    saisieManuelleAutorisee: false,
    verrouillee: false,
    ordreAffichage: 100,
    actif: true,
  };
}

function garantiePayloadFromReference(garantie: ReferenceOption): UpsertGarantieRequest {
  return {
    code: garantie.code ?? "",
    libelle: garantie.libelle,
    description: String(garantie.description ?? ""),
    branche: String(garantie.branche ?? "Automobile"),
    typeGarantie: String(garantie.typeGarantie ?? "VEHICULE"),
    obligatoire: Boolean(garantie.obligatoire),
    responsabiliteCivile: Boolean(garantie.responsabiliteCivile),
    defenseRecours: Boolean(garantie.defenseRecours),
    requiertValeurVenale: Boolean(garantie.requiertValeurVenale),
    requiertValeurNeuf: Boolean(garantie.requiertValeurNeuf),
    requiertValeurGlace: Boolean(garantie.requiertValeurGlace),
    avecFranchise: Boolean(garantie.avecFranchise),
    avecFranchiseMinimale: Boolean(garantie.avecFranchiseMinimale),
    avecCapital: Boolean(garantie.avecCapital),
    tarificationMultiple: Boolean(garantie.tarificationMultiple),
    modesTarificationMultiple: stringArray(garantie.modesTarificationMultiple),
    modesAutorises: stringArray(garantie.modesAutorises, String(garantie.modeParDefaut ?? "TAUX")),
    modeParDefaut: String(garantie.modeParDefaut ?? "TAUX"),
    sourcesValeurAutorisees: stringArray(garantie.sourcesValeurAutorisees),
    sourceValeurParDefaut: String(garantie.sourceValeurParDefaut ?? "AUCUNE"),
    saisieManuelleAutorisee: Boolean(garantie.saisieManuelleAutorisee),
    verrouillee: Boolean(garantie.verrouillee),
    ordreAffichage: toNumber(garantie.ordreAffichage),
    actif: garantie.actif !== false,
  };
}

function normalizeGarantiePayload(payload: UpsertGarantieRequest): UpsertGarantieRequest {
  const typeGarantie = payload.typeGarantie === "PERSONNE" ? "PERSONNE" : "VEHICULE";
  const allowedModes = availableModesForType(typeGarantie);
  const modesAutorises = (payload.modesAutorises?.length ? payload.modesAutorises : [payload.modeParDefaut ?? allowedModes[0]])
    .filter((mode) => allowedModes.includes(mode));
  const normalizedModes = modesAutorises.length ? modesAutorises : [allowedModes[0]];
  const modeParDefaut = normalizedModes.includes(payload.modeParDefaut ?? "") ? payload.modeParDefaut : normalizedModes[0];
  const modesTarificationMultiple = (payload.modesTarificationMultiple ?? []).filter((mode) => normalizedModes.includes(mode));
  const normalizedMultipleModes = modesTarificationMultiple.slice(0, 1);

  if (typeGarantie === "PERSONNE") {
    return {
      ...payload,
      typeGarantie,
      modesAutorises: ["PROTECTION"],
      modeParDefaut: "PROTECTION",
      sourcesValeurAutorisees: [],
      sourceValeurParDefaut: "AUCUNE",
      requiertValeurVenale: false,
      requiertValeurNeuf: false,
      requiertValeurGlace: false,
      avecFranchise: false,
      avecFranchiseMinimale: false,
      avecCapital: true,
      tarificationMultiple: false,
      modesTarificationMultiple: [],
    };
  }

  const sourcesValeurAutorisees = (payload.sourcesValeurAutorisees ?? []).filter((source) => SOURCES_VALEUR.includes(source as typeof SOURCES_VALEUR[number]));
  const sourceValeurParDefaut = payload.sourceValeurParDefaut && (payload.sourceValeurParDefaut === "AUCUNE" || sourcesValeurAutorisees.includes(payload.sourceValeurParDefaut))
    ? payload.sourceValeurParDefaut
    : "AUCUNE";

  return {
    ...payload,
    typeGarantie,
    modesAutorises: normalizedModes,
    modeParDefaut,
    avecFranchiseMinimale: Boolean(payload.avecFranchise && payload.avecFranchiseMinimale),
    tarificationMultiple: normalizedMultipleModes.length > 0,
    modesTarificationMultiple: normalizedMultipleModes,
    sourcesValeurAutorisees,
    sourceValeurParDefaut,
  };
}

function availableModesForType(typeGarantie?: string) {
  return typeGarantie === "PERSONNE" ? ["PROTECTION"] : VEHICULE_MODES_TARIFICATION;
}

function stringArray(value: unknown, fallback?: string) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  return fallback ? [fallback] : [];
}

function toggleArray(values: string[], value: string, checked: boolean) {
  const set = new Set(values);
  if (checked) {
    set.add(value);
  } else {
    set.delete(value);
  }
  return Array.from(set);
}

function garantieTags(garantie: ReferenceOption) {
  return [
    garantie.obligatoire ? "Obligatoire" : null,
    garantie.responsabiliteCivile ? "RC" : null,
    garantie.avecCapital ? "Capital" : null,
    garantie.avecFranchise ? "Taux franchise" : null,
    garantie.avecFranchiseMinimale ? "Franchise min." : null,
    garantie.tarificationMultiple ? "Multiple" : null,
  ].filter(Boolean) as string[];
}

function valueTags(garantie: ReferenceOption) {
  return [
    garantie.requiertValeurVenale ? "Vénale" : null,
    garantie.requiertValeurNeuf ? "Neuf" : null,
    garantie.requiertValeurGlace ? "Glace" : null,
    garantie.saisieManuelleAutorisee ? "Manuelle" : null,
  ].filter(Boolean) as string[];
}

function modeLabel(mode: string) {
  const labels: Record<string, string> = {
    TAUX: "Taux",
    CAPITAL: "Capital",
    PRIME_FIXE: "Prime fixe",
    PROTECTION: "Protection",
  };
  return labels[mode] ?? mode;
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    AUCUNE: "Aucune",
    VENALE: "Valeur vénale",
    NEUF: "Valeur à neuf",
    GLACE: "Valeur glace",
    MANUEL: "Manuelle",
  };
  return labels[source] ?? source;
}

function sourceChoiceLabel(source: string) {
  const labels: Record<string, string> = {
    VENALE: "Depuis valeur vénale",
    NEUF: "Depuis valeur à neuf",
    GLACE: "Depuis valeur glace",
    MANUEL: "Saisie manuelle",
  };
  return labels[source] ?? sourceLabel(source);
}

function usageCriteria(usage: ReferenceOption) {
  const flags = [
    usage.byCarburantAndPf ? "Carburant+PF" : null,
    usage.bySousClasse ? "Sous-classe" : null,
    usage.byPtc ? "PTC" : null,
    usage.byPrime ? "Places" : null,
    usage.byCategorieTransport ? "Catégorie transport" : null,
  ].filter(Boolean);
  return flags.length ? flags.join(", ") : "-";
}

function usageLabel(usage: ReferenceOption) {
  return `${usage.code ? `${usage.code} - ` : ""}${usage.libelle}`;
}

function categoryUsageSummary(category: ReferenceOption) {
  const codes = refArray(category, "usageCodes").filter(Boolean);
  const libelles = refArray(category, "usageLibelles").filter(Boolean);
  if (codes.length === 0 && libelles.length === 0) {
    return "Tous les usages";
  }
  return codes.length > 0 ? codes.join(", ") : libelles.join(", ");
}

function refArray(item: ReferenceOption | Record<string, unknown>, key: string) {
  const value = item[key];
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry));
}

function cleanTextPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, typeof value === "string" && value.trim() === "" ? undefined : value])
  ) as T;
}

function normalizeColor(value?: string) {
  return value && /^#([0-9a-fA-F]{6})$/.test(value.trim()) ? value.trim() : "#059669";
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
