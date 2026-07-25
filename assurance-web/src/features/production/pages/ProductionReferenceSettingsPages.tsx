import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { codeReferenceSchema, garantieSchema, referenceSchema, transportCategorySchema, usageSchema } from "../schemas";
import { Field } from "../components/Field";
import { numberValue, toNumber } from "../utils/format";
import type { ReferenceOption, UpsertCodeReferenceRequest, UpsertGarantieRequest, UpsertReferenceRequest, UpsertUsageRequest } from "../types";

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

type TransportCategoryPayload = {
  code: string;
  libelle: string;
  description?: string;
  actif?: boolean;
};

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
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-slate-50/70 px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
                value={payload.groupeUsageAttestationId ?? ""}
                onChange={(event) => setPayload((current) => ({ ...current, groupeUsageAttestationId: event.target.value || undefined }))}
              >
                <option value="">Aucun</option>
                {(groupes.data ?? []).map((groupe) => <option key={groupe.id} value={groupe.id}>{groupe.code} - {groupe.libelle}</option>)}
              </select>
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
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Critère</TableHead>
                  <TableHead>Attestation</TableHead>
                  <TableHead>Garanties personne</TableHead>
                  <TableHead>Critères tarif</TableHead>
                  <TableHead className="w-14" />
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
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(usage); setDialogOpen(true); }}>
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
    setPayload(editing ? garantiePayloadFromReference(editing) : emptyGarantie());
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
      const modes = toggleArray(current.modesAutorises ?? [], mode, checked);
      const modeParDefaut = modes.includes(current.modeParDefaut ?? "") ? current.modeParDefaut : modes[0];
      return { ...current, modesAutorises: modes, modeParDefaut };
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
      });
      return;
    }
    update({
      typeGarantie,
      modesAutorises: ["TAUX"],
      modeParDefaut: "TAUX",
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
              <Flag label="Avec franchise" checked={payload.avecFranchise} onChange={(value) => update({ avecFranchise: value })} />
              <Flag label="Tarification multiple" checked={payload.tarificationMultiple} onChange={(value) => update({ tarificationMultiple: value })} />
              <Flag label="Saisie manuelle" checked={payload.saisieManuelleAutorisee} onChange={(value) => update({ saisieManuelleAutorisee: value })} />
              <Flag label="Verrouillée" checked={payload.verrouillee} onChange={(value) => update({ verrouillee: value })} />
              <Flag label="Active" checked={payload.actif} onChange={(value) => update({ actif: value })} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="grid gap-3 rounded-md border p-3">
                <div className="text-sm font-semibold">Modes de tarification</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {MODES_TARIFICATION.map((mode) => (
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
                      {(payload.modesAutorises ?? []).map((mode) => <SelectItem key={mode} value={mode}>{modeLabel(mode)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-3 rounded-md border p-3">
                <div className="text-sm font-semibold">Valeur assurée</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Flag label="Valeur vénale" checked={payload.requiertValeurVenale} onChange={(value) => update({ requiertValeurVenale: value })} />
                  <Flag label="Valeur à neuf" checked={payload.requiertValeurNeuf} onChange={(value) => update({ requiertValeurNeuf: value })} />
                  <Flag label="Valeur glace" checked={payload.requiertValeurGlace} onChange={(value) => update({ requiertValeurGlace: value })} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SOURCES_VALEUR.map((source) => (
                    <Flag
                      key={source}
                      label={sourceLabel(source)}
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
                const parsed = garantieSchema.safeParse(cleanTextPayload(payload));
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
              <TableHeader>
                <TableRow>
                  <TableHead>Ordre</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Grille</TableHead>
                  <TableHead>Valeurs</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="w-14" />
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
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(garantie); setDialogOpen(true); }}>
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
  const mode = payload.modeParDefaut || (isPersonne ? "PROTECTION" : "TAUX");
  const modes = payload.modesAutorises?.length ? payload.modesAutorises : [mode];
  const multiple = Boolean(payload.tarificationMultiple);

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
                <TableCell><Checkbox checked disabled /></TableCell>
                <TableCell className="align-top font-semibold"><div className="pt-2">{code} - {libelle}</div></TableCell>
                <TableCell className="align-top"><PreviewInput active placeholder="Formule 1" align="left" /></TableCell>
                <TableCell className="align-top"><PreviewInput active /></TableCell>
                <TableCell className="align-top"><PreviewInput active /></TableCell>
                <TableCell className="align-top"><PreviewInput active /></TableCell>
                <TableCell className="align-top"><PreviewInput active /></TableCell>
                <TableCell className="align-top"><PreviewInput active /></TableCell>
                <TableCell className="align-top"><PreviewInput active /></TableCell>
                <TableCell className="align-top"><PreviewInput active /></TableCell>
                <TableCell className="align-top"><PreviewInput active /></TableCell>
                <TableCell className="align-top">
                  {multiple ? (
                    <Button type="button" variant="ghost" size="icon" disabled>
                      <Plus className="size-4" />
                    </Button>
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
              <TableCell><Checkbox checked disabled /></TableCell>
              <TableCell className="align-top font-semibold"><div className="pt-2">{code} - {libelle}</div></TableCell>
              <TableCell className="align-top">
                {modes.length > 1 ? (
                  <select
                    className="h-9 w-full rounded-md border border-slate-300 bg-slate-50/70 px-3 text-sm disabled:opacity-100 dark:border-slate-600 dark:bg-slate-900"
                    value={mode}
                    disabled
                  >
                    {modes.map((allowedMode) => <option key={allowedMode} value={allowedMode}>{modeLabel(allowedMode)}</option>)}
                  </select>
                ) : (
                  <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm">{modeLabel(mode)}</span>
                )}
              </TableCell>
              <TableCell className="align-top"><PreviewInput active={mode === "TAUX"} /></TableCell>
              <TableCell className="align-top"><PreviewInput active={Boolean(payload.avecFranchise)} /></TableCell>
              <TableCell className="align-top"><PreviewInput active={Boolean(payload.avecFranchise)} /></TableCell>
              <TableCell className="align-top"><PreviewInput active={mode === "CAPITAL" || Boolean(payload.avecCapital)} /></TableCell>
              <TableCell className="align-top"><PreviewInput active={mode === "CAPITAL" || mode === "PRIME_FIXE"} /></TableCell>
              <TableCell className="align-top">
                {multiple ? (
                  <Button type="button" variant="ghost" size="icon" disabled>
                    <Plus className="size-4" />
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PreviewInput({ active, placeholder, align = "right" }: { active: boolean; placeholder?: string; align?: "left" | "right" }) {
  return (
    <Input
      className={`h-8 min-w-28 ${align === "right" ? "text-right" : ""}`}
      disabled={!active}
      readOnly
      placeholder={active ? placeholder : ""}
    />
  );
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
            <TableHeader>
              <TableRow>
                {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((item) => (
                <TableRow key={item.id}>
                  {columns.includes("Code") ? <TableCell className="font-medium">{item.code ?? "-"}</TableCell> : null}
                  <TableCell>{item.libelle}</TableCell>
                  {columns.includes("Description") ? <TableCell>{item.description ?? "-"}</TableCell> : null}
                  <TableCell>{item.actif === false ? "Non" : "Oui"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
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
    avecCapital: false,
    tarificationMultiple: false,
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
    avecCapital: Boolean(garantie.avecCapital),
    tarificationMultiple: Boolean(garantie.tarificationMultiple),
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
    garantie.avecFranchise ? "Franchise" : null,
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

function cleanTextPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, typeof value === "string" && value.trim() === "" ? undefined : value])
  ) as T;
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
