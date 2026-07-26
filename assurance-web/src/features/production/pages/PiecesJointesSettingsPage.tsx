import type React from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import type { TypeClient, TypeContrat, TypePieceJointe, UpsertTypePieceJointeRequest } from "../types";

const ALL = "__ALL__";
const TYPE_CONTRATS: TypeContrat[] = ["PARTICULIER", "CONVENTION", "FLOTTE"];
const TYPE_CLIENTS: TypeClient[] = ["PERSONNE_PHYSIQUE", "PERSONNE_MORALE"];

const EMPTY_FORM: FormState = {
  libelle: "",
  typeContrat: ALL,
  typeClient: ALL,
  typeMouvementId: ALL,
  obligatoire: false,
  actif: true,
  ordreAffichage: "",
};

type FormState = {
  libelle: string;
  typeContrat: string;
  typeClient: string;
  typeMouvementId: string;
  obligatoire: boolean;
  actif: boolean;
  ordreAffichage: string;
};

export default function PiecesJointesSettingsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<TypePieceJointe | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const typesQuery = useQuery({
    queryKey: ["pieces-jointes-types", true],
    queryFn: () => productionApi.listTypesPieceJointe(true),
  });
  const mouvementsQuery = useQuery({
    queryKey: ["pieces-jointes-types-mouvements"],
    queryFn: productionApi.listTypesMouvementPieceJointe,
  });
  const mouvementMap = useMemo(() => new Map((mouvementsQuery.data ?? []).map((item) => [item.id, item])), [mouvementsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpsertTypePieceJointeRequest) =>
      editing ? productionApi.updateTypePieceJointe(editing.id, payload) : productionApi.createTypePieceJointe(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pieces-jointes-types"] });
      setEditing(null);
      setForm(EMPTY_FORM);
      toast.success("Type de pièce jointe enregistré");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const deleteMutation = useMutation({
    mutationFn: productionApi.deleteTypePieceJointe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pieces-jointes-types"] });
      toast.success("Type de pièce jointe désactivé");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Désactivation impossible"),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    saveMutation.mutate(toPayload(form));
  }

  function edit(type: TypePieceJointe) {
    setEditing(type);
    setForm({
      libelle: type.libelle,
      typeContrat: type.typeContrat ?? ALL,
      typeClient: type.typeClient ?? ALL,
      typeMouvementId: type.typeMouvementId ?? ALL,
      obligatoire: Boolean(type.obligatoire),
      actif: type.actif !== false,
      ordreAffichage: type.ordreAffichage == null ? "" : String(type.ordreAffichage),
    });
  }

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
        <h1 className="text-xl font-semibold tracking-tight">Types de pièces jointes</h1>
        <p className="text-sm text-muted-foreground">Définissez les documents attendus selon le mouvement, le contrat et le client.</p>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="border-b bg-emerald-50/70 py-3 dark:bg-emerald-950/30">
          <CardTitle className="text-sm">{editing ? "Modifier le type" : "Nouveau type"}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr_120px_120px_auto]" onSubmit={submit}>
            <Field label="Libellé">
              <Input value={form.libelle} onChange={(event) => setForm((current) => ({ ...current, libelle: event.target.value }))} required />
            </Field>
            <Field label="Contrat">
              <Select value={form.typeContrat} onValueChange={(value) => setForm((current) => ({ ...current, typeContrat: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous</SelectItem>
                  {TYPE_CONTRATS.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Client">
              <Select value={form.typeClient} onValueChange={(value) => setForm((current) => ({ ...current, typeClient: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous</SelectItem>
                  {TYPE_CLIENTS.map((type) => <SelectItem key={type} value={type}>{clientLabel(type)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mouvement">
              <Select value={form.typeMouvementId} onValueChange={(value) => setForm((current) => ({ ...current, typeMouvementId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous</SelectItem>
                  {(mouvementsQuery.data ?? []).map((type) => <SelectItem key={type.id} value={type.id}>{type.libelle}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ordre">
              <Input value={form.ordreAffichage} inputMode="numeric" onChange={(event) => setForm((current) => ({ ...current, ordreAffichage: event.target.value }))} />
            </Field>
            <div className="grid content-end gap-2 pb-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.obligatoire} onChange={(event) => setForm((current) => ({ ...current, obligatoire: event.target.checked }))} />
                Obligatoire
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.actif} onChange={(event) => setForm((current) => ({ ...current, actif: event.target.checked }))} />
                Actif
              </label>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                <Plus className="size-4" />
                {editing ? "Modifier" : "Ajouter"}
              </Button>
              {editing ? <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}>Annuler</Button> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="border-b bg-emerald-50/70 py-3 dark:bg-emerald-950/30">
          <CardTitle className="text-sm">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50">
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Contrat</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Mouvement</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(typesQuery.data ?? []).map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.libelle}</TableCell>
                  <TableCell>{type.typeContrat ?? "Tous"}</TableCell>
                  <TableCell>{type.typeClient ? clientLabel(type.typeClient) : "Tous"}</TableCell>
                  <TableCell>{type.typeMouvementId ? mouvementMap.get(type.typeMouvementId)?.libelle ?? type.typeMouvementLibelle : "Tous"}</TableCell>
                  <TableCell>
                    <span className="flex gap-1">
                      {type.obligatoire ? <Badge>Obligatoire</Badge> : <Badge variant="secondary">Optionnel</Badge>}
                      {type.actif === false ? <Badge variant="destructive">Inactif</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => edit(type)} title="Modifier">
                      <Edit2 className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => deleteMutation.mutate(type.id)} title="Désactiver">
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-700 dark:text-neutral-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function toPayload(form: FormState): UpsertTypePieceJointeRequest {
  return {
    libelle: form.libelle.trim(),
    typeContrat: form.typeContrat === ALL ? null : form.typeContrat as TypeContrat,
    typeClient: form.typeClient === ALL ? null : form.typeClient as TypeClient,
    typeMouvementId: form.typeMouvementId === ALL ? null : form.typeMouvementId,
    obligatoire: form.obligatoire,
    actif: form.actif,
    ordreAffichage: form.ordreAffichage.trim() ? Number(form.ordreAffichage) : null,
  };
}

function clientLabel(type: TypeClient) {
  return type === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique";
}
