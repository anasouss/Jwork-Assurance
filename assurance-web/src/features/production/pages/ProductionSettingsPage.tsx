import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { formuleGarantiePersonneSchema, grilleTarifaireSchema, ligneGrilleTarifaireSchema, referenceSchema, transportCategorySchema, usageSchema } from "../schemas";
import { Field } from "../components/Field";
import { FormuleGarantiePersonneDialog } from "../components/FormuleGarantiePersonneDialog";
import { GrilleTarifaireDialog } from "../components/GrilleTarifaireDialog";
import { LigneGrilleTarifaireDialog } from "../components/LigneGrilleTarifaireDialog";
import type {
  ReferenceOption,
  UpsertFormuleGarantiePersonneRequest,
  UpsertGrilleTarifaireRequest,
  UpsertLigneGrilleTarifaireRequest,
  UpsertReferenceRequest,
  UpsertUsageRequest,
} from "../types";

export default function ProductionSettingsPage() {
  const queryClient = useQueryClient();
  const categories = useReference("categories-transport");
  const compagnies = useReference("compagnies-assurance");
  const grilles = useReference("grilles-tarifaires");
  const garanties = useReference("garanties");
  const usages = useReference("usages");
  const marques = useReference("marques");
  const carrosseries = useReference("carrosseries");
  const groupesUsage = useReference("groupes-usage-attestation");
  const [selectedGrilleId, setSelectedGrilleId] = useState("");
  const selectedGrille = grilles.data?.find((grille) => grille.id === selectedGrilleId) ?? null;
  const lignes = useQuery({
    queryKey: ["lignes-grille-settings", selectedGrilleId],
    queryFn: () => productionApi.lignesGrille({ grilleId: selectedGrilleId }),
    enabled: Boolean(selectedGrilleId),
  });
  const formules = useQuery({
    queryKey: ["formules-garantie-personne-settings", selectedGrilleId],
    queryFn: () => productionApi.formulesGarantiePersonne({ grilleId: selectedGrilleId }),
    enabled: Boolean(selectedGrilleId),
  });

  const [grilleDialogOpen, setGrilleDialogOpen] = useState(false);
  const [editingGrille, setEditingGrille] = useState<ReferenceOption | null>(null);
  const [ligneDialogOpen, setLigneDialogOpen] = useState(false);
  const [editingLigne, setEditingLigne] = useState<ReferenceOption | null>(null);
  const [formuleDialogOpen, setFormuleDialogOpen] = useState(false);
  const [editingFormule, setEditingFormule] = useState<ReferenceOption | null>(null);

  const saveGrille = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertGrilleTarifaireRequest }) =>
      id ? productionApi.updateGrilleTarifaire(id, payload) : productionApi.createGrilleTarifaire(payload),
    onSuccess: async (grille) => {
      setGrilleDialogOpen(false);
      setEditingGrille(null);
      setSelectedGrilleId(grille.id);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "grilles-tarifaires"] });
      toast.success("Grille tarifaire enregistrée");
    },
    onError: showError,
  });

  const saveLigne = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertLigneGrilleTarifaireRequest }) =>
      id
        ? productionApi.updateLigneGrilleTarifaire(id, payload)
        : productionApi.createLigneGrilleTarifaire(selectedGrilleId, payload),
    onSuccess: async () => {
      setLigneDialogOpen(false);
      setEditingLigne(null);
      await queryClient.invalidateQueries({ queryKey: ["lignes-grille-settings", selectedGrilleId] });
      toast.success("Ligne de grille enregistrée");
    },
    onError: showError,
  });

  const saveFormule = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertFormuleGarantiePersonneRequest }) =>
      id
        ? productionApi.updateFormuleGarantiePersonne(id, payload)
        : productionApi.createFormuleGarantiePersonne(selectedGrilleId, payload),
    onSuccess: async () => {
      setFormuleDialogOpen(false);
      setEditingFormule(null);
      await queryClient.invalidateQueries({ queryKey: ["formules-garantie-personne-settings", selectedGrilleId] });
      await queryClient.invalidateQueries({ queryKey: ["formules-garantie-personne"] });
      toast.success("Formule personne enregistrée");
    },
    onError: showError,
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Paramètres production</h1>
        <p className="text-sm text-muted-foreground">Référentiels et grilles utilisés par les dossiers automobiles.</p>
      </div>

      <Tabs defaultValue="grilles">
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="grilles">Grilles tarifaires</TabsTrigger>
          <TabsTrigger value="usages">Usages</TabsTrigger>
          <TabsTrigger value="marques">Marques</TabsTrigger>
          <TabsTrigger value="carrosseries">Carrosseries</TabsTrigger>
          <TabsTrigger value="transport">Catégories transport</TabsTrigger>
        </TabsList>

        <TabsContent value="grilles" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Card className="border-border/70 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Grilles</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingGrille(null);
                    setGrilleDialogOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Ajouter
                </Button>
              </CardHeader>
              <CardContent className="grid gap-2">
                {(grilles.data ?? []).map((grille) => (
                  <button
                    key={grille.id}
                    type="button"
                    className={`rounded-md border p-3 text-left text-sm hover:bg-muted/50 ${selectedGrilleId === grille.id ? "border-primary bg-muted" : ""}`}
                    onClick={() => setSelectedGrilleId(grille.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{grille.libelle}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingGrille(grille);
                          setGrilleDialogOpen(true);
                        }}
                      >
                        <Edit className="size-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">{grille.compagnieAssuranceLibelle ?? grille.code}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <GridLinesCard
                title={selectedGrille ? `Garanties véhicule - ${selectedGrille.libelle}` : "Garanties véhicule"}
                rows={lignes.data ?? []}
                emptyText={selectedGrilleId ? "Cette grille ne contient pas encore de lignes véhicule." : "Sélectionnez une grille."}
                action={
                  <Button
                    size="sm"
                    disabled={!selectedGrilleId}
                    onClick={() => {
                      setEditingLigne(null);
                      setLigneDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Ligne
                  </Button>
                }
                onEdit={(ligne) => {
                  setEditingLigne(ligne);
                  setLigneDialogOpen(true);
                }}
              />

              <PersonFormulasCard
                title="Garanties personne"
                rows={formules.data ?? []}
                emptyText={selectedGrilleId ? "Aucune formule PP/PC pour cette grille." : "Sélectionnez une grille."}
                action={
                  <Button
                    size="sm"
                    disabled={!selectedGrilleId}
                    onClick={() => {
                      setEditingFormule(null);
                      setFormuleDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Formule personne
                  </Button>
                }
                onEdit={(formule) => {
                  setEditingFormule(formule);
                  setFormuleDialogOpen(true);
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="usages" className="mt-4">
          <UsageSettings usages={usages.data ?? []} groupes={groupesUsage.data ?? []} />
        </TabsContent>

        <TabsContent value="marques" className="mt-4">
          <SimpleReferenceSettings
            title="Marques"
            rows={marques.data ?? []}
            saveNew={productionApi.createMarque}
            saveExisting={productionApi.updateMarque}
            queryKey={["referentiel", "marques"]}
          />
        </TabsContent>

        <TabsContent value="carrosseries" className="mt-4">
          <SimpleReferenceSettings
            title="Carrosseries"
            rows={carrosseries.data ?? []}
            saveNew={productionApi.createCarrosserie}
            saveExisting={productionApi.updateCarrosserie}
            queryKey={["referentiel", "carrosseries"]}
          />
        </TabsContent>

        <TabsContent value="transport" className="mt-4">
          <TransportCategorySettings rows={categories.data ?? []} />
        </TabsContent>
      </Tabs>

      <GrilleTarifaireDialog
        open={grilleDialogOpen}
        onOpenChange={setGrilleDialogOpen}
        grille={editingGrille}
        compagnies={compagnies.data ?? []}
        submitting={saveGrille.isPending}
        onSubmit={(payload) => {
          const parsed = grilleTarifaireSchema.safeParse(payload);
          if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
            return;
          }
          saveGrille.mutate({ id: editingGrille?.id, payload });
        }}
      />

      <LigneGrilleTarifaireDialog
        open={ligneDialogOpen}
        onOpenChange={setLigneDialogOpen}
        ligne={editingLigne}
        garanties={garanties.data ?? []}
        usages={usages.data ?? []}
        categoriesTransport={categories.data ?? []}
        submitting={saveLigne.isPending}
        onSubmit={(payload) => {
          const parsed = ligneGrilleTarifaireSchema.safeParse(payload);
          if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
            return;
          }
          saveLigne.mutate({ id: editingLigne?.id, payload });
        }}
      />

      <FormuleGarantiePersonneDialog
        open={formuleDialogOpen}
        onOpenChange={setFormuleDialogOpen}
        formule={editingFormule}
        garanties={garanties.data ?? []}
        usages={(usages.data ?? []).filter((usage) => Boolean(usage.garantiesPersonne))}
        submitting={saveFormule.isPending}
        onSubmit={(payload) => {
          const parsed = formuleGarantiePersonneSchema.safeParse(payload);
          if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
            return;
          }
          saveFormule.mutate({ id: editingFormule?.id, payload });
        }}
      />
    </div>
  );
}

function UsageSettings({ usages, groupes }: { usages: ReferenceOption[]; groupes: ReferenceOption[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [payload, setPayload] = useState<UpsertUsageRequest>(emptyUsage());

  useEffect(() => {
    setPayload(editing ? usagePayload(editing) : emptyUsage());
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertUsageRequest }) =>
      id ? productionApi.updateUsage(id, value) : productionApi.createUsage(value),
    onSuccess: async () => {
      setEditing(null);
      setPayload(emptyUsage());
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "usages"] });
      toast.success("Usage enregistré");
    },
    onError: showError,
  });

  const update = (patch: Partial<UpsertUsageRequest>) => setPayload((current) => ({ ...current, ...patch }));

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Usages</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 rounded-md border p-3 lg:grid-cols-4">
          <Field label="Code" required>
            <Input value={payload.code} onChange={(event) => update({ code: event.target.value })} />
          </Field>
          <Field label="Libellé" required>
            <Input value={payload.libelle} onChange={(event) => update({ libelle: event.target.value })} />
          </Field>
          <Field label="Famille attestation">
            <Select value={payload.groupeUsageAttestationId ?? ""} onValueChange={(value) => update({ groupeUsageAttestationId: value })}>
              <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
              <SelectContent>
                {groupes.map((groupe) => <SelectItem key={groupe.id} value={groupe.id}>{groupe.code ? `${groupe.code} - ` : ""}{groupe.libelle}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Critères">
            <Input value={payload.criteria ?? ""} onChange={(event) => update({ criteria: event.target.value })} />
          </Field>
          <Flag label="Consomme attestation" checked={payload.consommeAttestation} onChange={(value) => update({ consommeAttestation: value })} />
          <Flag label="Carburant + PF" checked={payload.byCarburantAndPf} onChange={(value) => update({ byCarburantAndPf: value })} />
          <Flag label="Sous-classe" checked={payload.bySousClasse} onChange={(value) => update({ bySousClasse: value })} />
          <Flag label="PTC" checked={payload.byPtc} onChange={(value) => update({ byPtc: value })} />
          <Flag label="Prime directe" checked={payload.byPrime} onChange={(value) => update({ byPrime: value })} />
          <Flag label="Catégorie transport" checked={payload.byCategorieTransport} onChange={(value) => update({ byCategorieTransport: value })} />
          <Flag label="Garanties personne" checked={payload.garantiesPersonne} onChange={(value) => update({ garantiesPersonne: value })} />
          <Flag label="Actif" checked={payload.actif} onChange={(value) => update({ actif: value })} />
          <div className="flex items-end gap-2">
            <Button
              disabled={save.isPending}
              onClick={() => {
                const parsed = usageSchema.safeParse(payload);
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                  return;
                }
                save.mutate({ id: editing?.id, value: parsed.data });
              }}
            >
              {editing ? "Modifier" : "Ajouter"}
            </Button>
            {editing ? <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button> : null}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Paramètres</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {usages.map((usage) => (
              <TableRow key={usage.id}>
                <TableCell className="font-medium">{usage.code}</TableCell>
                <TableCell>{usage.libelle}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[
                    usage.byCarburantAndPf ? "PF" : null,
                    usage.bySousClasse ? "Sous-classe" : null,
                    usage.byPtc ? "PTC" : null,
                    usage.byCategorieTransport ? "Catégorie transport" : null,
                    usage.garantiesPersonne ? "PP/PC" : null,
                  ].filter(Boolean).join(", ") || "-"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(usage)}>
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SimpleReferenceSettings({
  title,
  rows,
  saveNew,
  saveExisting,
  queryKey,
}: {
  title: string;
  rows: ReferenceOption[];
  saveNew: (payload: UpsertReferenceRequest) => Promise<ReferenceOption>;
  saveExisting: (id: string, payload: UpsertReferenceRequest) => Promise<ReferenceOption>;
  queryKey: string[];
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [payload, setPayload] = useState<UpsertReferenceRequest>({ libelle: "", actif: true });

  useEffect(() => {
    setPayload(editing ? { libelle: editing.libelle, actif: editing.actif !== false } : { libelle: "", actif: true });
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertReferenceRequest }) => id ? saveExisting(id, value) : saveNew(value),
    onSuccess: async () => {
      setEditing(null);
      setPayload({ libelle: "", actif: true });
      await queryClient.invalidateQueries({ queryKey });
      toast.success(`${title} enregistré`);
    },
    onError: showError,
  });

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <Input placeholder="Libellé" value={payload.libelle} onChange={(event) => setPayload((current) => ({ ...current, libelle: event.target.value }))} />
          <Flag label="Actif" checked={payload.actif} onChange={(value) => setPayload((current) => ({ ...current, actif: value }))} />
          <div className="flex gap-2">
            <Button
              disabled={save.isPending}
              onClick={() => {
                const parsed = referenceSchema.safeParse(payload);
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                  return;
                }
                save.mutate({ id: editing?.id, value: parsed.data });
              }}
            >
              <Plus className="size-4" />
              {editing ? "Modifier" : "Ajouter"}
            </Button>
            {editing ? <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button> : null}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.libelle}</TableCell>
                <TableCell>{row.actif === false ? "Inactif" : "Actif"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(row)}>
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TransportCategorySettings({ rows }: { rows: ReferenceOption[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [payload, setPayload] = useState<TransportCategoryPayload>({ code: "", libelle: "", description: "", actif: true });

  useEffect(() => {
    setPayload(editing
      ? { code: String(editing.code ?? ""), libelle: editing.libelle, description: String(editing.description ?? ""), actif: editing.actif !== false }
      : { code: "", libelle: "", description: "", actif: true });
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: TransportCategoryPayload }) =>
      id ? productionApi.updateCategorieTransport(id, value) : productionApi.createCategorieTransport(value),
    onSuccess: async () => {
      setEditing(null);
      setPayload({ code: "", libelle: "", description: "", actif: true });
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "categories-transport"] });
      toast.success("Catégorie transport enregistrée");
    },
    onError: showError,
  });

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Catégories transport</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-[160px_1fr_1fr_auto_auto]">
          <Input placeholder="Code" value={payload.code} onChange={(event) => setPayload((current) => ({ ...current, code: event.target.value }))} />
          <Input placeholder="Libellé" value={payload.libelle} onChange={(event) => setPayload((current) => ({ ...current, libelle: event.target.value }))} />
          <Input placeholder="Description" value={payload.description} onChange={(event) => setPayload((current) => ({ ...current, description: event.target.value }))} />
          <Flag label="Actif" checked={payload.actif} onChange={(value) => setPayload((current) => ({ ...current, actif: value }))} />
          <div className="flex gap-2">
            <Button
              disabled={save.isPending}
              onClick={() => {
                const parsed = transportCategorySchema.safeParse(payload);
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                  return;
                }
                save.mutate({ id: editing?.id, value: parsed.data });
              }}
            >
              <Plus className="size-4" />
              {editing ? "Modifier" : "Ajouter"}
            </Button>
            {editing ? <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button> : null}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.code}</TableCell>
                <TableCell>{item.libelle}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(item)}>
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GridLinesCard({
  title,
  rows,
  emptyText,
  action,
  onEdit,
}: {
  title: string;
  rows: ReferenceOption[];
  emptyText: string;
  action: ReactNode;
  onEdit: (row: ReferenceOption) => void;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Option</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Prime</TableHead>
              <TableHead>Capital</TableHead>
              <TableHead>Taux</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{emptyText}</TableCell>
              </TableRow>
            ) : rows.map((ligne) => (
              <TableRow key={ligne.id}>
                <TableCell>{ligne.libelle}</TableCell>
                <TableCell>{String(ligne.modeTarification ?? "-")}</TableCell>
                <TableCell>{money(ligne.prime)}</TableCell>
                <TableCell>{money(ligne.capital)}</TableCell>
                <TableCell>{money(ligne.taux)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(ligne)}>
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PersonFormulasCard({
  title,
  rows,
  emptyText,
  action,
  onEdit,
}: {
  title: string;
  rows: ReferenceOption[];
  emptyText: string;
  action: ReactNode;
  onEdit: (row: ReferenceOption) => void;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Garantie</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Formule</TableHead>
              <TableHead>Décès</TableHead>
              <TableHead>Invalidité</TableHead>
              <TableHead>Prime nette</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{emptyText}</TableCell>
              </TableRow>
            ) : rows.map((formule) => (
              <TableRow key={formule.id}>
                <TableCell className="font-medium">{text(formule.garantieCode)} - {text(formule.garantieLibelle)}</TableCell>
                <TableCell>{text(formule.usageCode) !== "-" ? `${text(formule.usageCode)} - ${text(formule.usageLibelle)}` : "Tous usages autorisés"}</TableCell>
                <TableCell>{formule.libelle}</TableCell>
                <TableCell>{money(formule.montantDeces)}</TableCell>
                <TableCell>{money(formule.montantInvalidite)}</TableCell>
                <TableCell>{money(formule.primeNette)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(formule)}>
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Flag({ label, checked, onChange }: { label: string; checked?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm">
      <Checkbox checked={Boolean(checked)} onCheckedChange={(value) => onChange(Boolean(value))} />
      <span>{label}</span>
    </label>
  );
}

function emptyUsage(): UpsertUsageRequest {
  return {
    code: "",
    libelle: "",
    criteria: "",
    groupeUsageAttestationId: "",
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

function usagePayload(usage: ReferenceOption): UpsertUsageRequest {
  return {
    code: String(usage.code ?? ""),
    libelle: usage.libelle,
    criteria: String(usage.criteria ?? ""),
    groupeUsageAttestationId: String(usage.groupeUsageAttestationId ?? ""),
    consommeAttestation: usage.consommeAttestation !== false,
    byCarburantAndPf: Boolean(usage.byCarburantAndPf),
    bySousClasse: Boolean(usage.bySousClasse),
    byPtc: Boolean(usage.byPtc),
    byPrime: Boolean(usage.byPrime),
    byCategorieTransport: Boolean(usage.byCategorieTransport),
    garantiesPersonne: Boolean(usage.garantiesPersonne),
    actif: usage.actif !== false,
  };
}

function useReference(path: string) {
  return useQuery({
    queryKey: ["referentiel", path],
    queryFn: () => productionApi.referentiel(path),
    staleTime: 60_000,
  });
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}

function money(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("fr-FR") : String(value);
}

function text(value: unknown) {
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

type TransportCategoryPayload = {
  code: string;
  libelle: string;
  description?: string;
  actif?: boolean;
};
