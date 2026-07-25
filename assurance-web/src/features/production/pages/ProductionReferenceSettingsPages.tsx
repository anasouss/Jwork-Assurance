import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { codeReferenceSchema, referenceSchema, transportCategorySchema, usageSchema } from "../schemas";
import { Field } from "../components/Field";
import type { ReferenceOption, UpsertCodeReferenceRequest, UpsertReferenceRequest, UpsertUsageRequest } from "../types";

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
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "categories-transport"] });
      toast.success("Catégorie transport enregistrée");
    },
    onError: showError,
  });

  return (
    <ReferenceShell title="Catégories transport" description="Catégories utilisées par les usages et les tarifs RC.">
      <Card className="border-border/70 shadow-none">
        <CardHeader><CardTitle className="text-base">{editing ? "Modifier catégorie" : "Ajouter catégorie"}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-4">
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
            {editing ? <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button> : null}
          </div>
        </CardContent>
      </Card>
      <ReferenceTable query={query} columns={["Code", "Libellé", "Description", "Actif"]} onEdit={setEditing} />
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
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "usages"] });
      toast.success("Usage enregistré");
    },
    onError: showError,
  });

  return (
    <ReferenceShell title="Usages" description="Critères qui pilotent les champs visibles, le stock d'attestations et les garanties personne.">
      <Card className="border-border/70 shadow-none">
        <CardHeader><CardTitle className="text-base">{editing ? "Modifier usage" : "Ajouter usage"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
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
            {editing ? <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button> : null}
          </div>
        </CardContent>
      </Card>
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
                      <Button variant="ghost" size="icon" onClick={() => setEditing(usage)}>
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
  const [payload, setPayload] = useState<UpsertReferenceRequest>({ libelle: "", actif: true });

  useEffect(() => {
    setPayload(editing ? { libelle: editing.libelle, actif: editing.actif !== false } : { libelle: "", actif: true });
  }, [editing]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertReferenceRequest }) => id ? update(id, value) : create(value),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", path] });
      toast.success(`${title} enregistré`);
    },
    onError: showError,
  });

  return (
    <ReferenceShell title={title} description={description}>
      <Card className="border-border/70 shadow-none">
        <CardHeader><CardTitle className="text-base">{editing ? "Modifier" : "Ajouter"}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
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
            {editing ? <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button> : null}
          </div>
        </CardContent>
      </Card>
      <ReferenceTable query={query} columns={["Libellé", "Actif"]} onEdit={setEditing} />
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
      await queryClient.invalidateQueries({ queryKey: ["referentiel", path] });
      toast.success(`${title} enregistré`);
    },
    onError: showError,
  });

  return (
    <ReferenceShell title={title} description={description}>
      <Card className="border-border/70 shadow-none">
        <CardHeader><CardTitle className="text-base">{editing ? "Modifier" : "Ajouter"}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[220px_1fr_auto_auto]">
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
            {editing ? <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button> : null}
          </div>
        </CardContent>
      </Card>
      <ReferenceTable query={query} columns={["Code", "Libellé", "Actif"]} onEdit={setEditing} />
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
