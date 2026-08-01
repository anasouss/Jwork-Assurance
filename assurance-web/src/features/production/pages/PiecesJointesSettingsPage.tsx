import type React from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { attachmentSettingsApi } from "../api/attachment-settings";
import type { TypeClient, TypeContrat, TypePieceJointe, UpsertTypePieceJointeRequest } from "../types";

const ALL = "__ALL__";
const PAGE_SIZE = 10;
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
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);

  const typesQuery = useQuery({
    queryKey: ["pieces-jointes-types", true],
    queryFn: () => attachmentSettingsApi.listTypes(true),
  });
  const mouvementsQuery = useQuery({
    queryKey: ["pieces-jointes-types-mouvements"],
    queryFn: attachmentSettingsApi.listMovementTypes,
  });

  const mouvementMap = useMemo(() => new Map((mouvementsQuery.data ?? []).map((item) => [item.id, item])), [mouvementsQuery.data]);
  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data]);
  const totalPages = Math.max(1, Math.ceil(types.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedTypes = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return types.slice(start, start + PAGE_SIZE);
  }, [safePage, types]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpsertTypePieceJointeRequest) =>
      editing ? attachmentSettingsApi.updateType(editing.id, payload) : attachmentSettingsApi.createType(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pieces-jointes-types"] });
      closeModal();
      toast.success("Type de pièce jointe enregistré");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const toggleMutation = useMutation({
    mutationFn: (type: TypePieceJointe) => attachmentSettingsApi.updateType(type.id, typeToPayload(type, type.actif === false)),
    onSuccess: async (_, type) => {
      await queryClient.invalidateQueries({ queryKey: ["pieces-jointes-types"] });
      toast.success(type.actif === false ? "Type de pièce jointe activé" : "Type de pièce jointe désactivé");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Changement d'état impossible"),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    saveMutation.mutate(toPayload(form));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(type: TypePieceJointe) {
    setEditing(type);
    setForm(typeToForm(type));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
          <h1 className="text-xl font-semibold tracking-tight">Types de pièces jointes</h1>
          <p className="text-sm text-muted-foreground">Définissez les documents attendus selon le mouvement, le contrat et le client.</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          Ajouter un type
        </Button>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-emerald-50/70 py-3 dark:bg-emerald-950/30">
          <CardTitle className="text-sm">Configuration</CardTitle>
          <span className="text-xs text-muted-foreground">
            {types.length} type{types.length > 1 ? "s" : ""}
          </span>
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
              {typesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">Chargement...</TableCell>
                </TableRow>
              ) : pagedTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">Aucun type configuré.</TableCell>
                </TableRow>
              ) : (
                pagedTypes.map((type) => (
                  <TableRow key={type.id} className={type.actif === false ? "bg-muted/30 text-muted-foreground" : undefined}>
                    <TableCell className="font-medium">{type.libelle}</TableCell>
                    <TableCell>{type.typeContrat ?? "Tous"}</TableCell>
                    <TableCell>{type.typeClient ? clientLabel(type.typeClient) : "Tous"}</TableCell>
                    <TableCell>{type.typeMouvementId ? mouvementMap.get(type.typeMouvementId)?.libelle ?? type.typeMouvementLibelle : "Tous"}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {type.obligatoire ? <Badge>Obligatoire</Badge> : <Badge variant="secondary">Optionnel</Badge>}
                        {type.actif === false ? <Badge variant="destructive">Inactif</Badge> : <Badge variant="success">Actif</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => openEdit(type)} title="Modifier">
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={type.actif === false ? "size-8 text-emerald-700" : "size-8 text-destructive"}
                        disabled={toggleMutation.isPending && toggleMutation.variables?.id === type.id}
                        onClick={() => toggleMutation.mutate(type)}
                        title={type.actif === false ? "Activer" : "Désactiver"}
                      >
                        {type.actif === false ? <Power className="size-4" /> : <PowerOff className="size-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-2 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Page {safePage} / {totalPages}
            </div>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.max(1, current - 1));
                    }}
                    aria-disabled={safePage <= 1}
                    className={safePage <= 1 ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium">
                    {safePage}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.min(totalPages, current + 1));
                    }}
                    aria-disabled={safePage >= totalPages}
                    className={safePage >= totalPages ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => open ? setModalOpen(true) : closeModal()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le type" : "Ajouter un type"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Libellé">
                <Input value={form.libelle} onChange={(event) => setForm((current) => ({ ...current, libelle: event.target.value }))} required />
              </Field>
              <Field label="Ordre">
                <Input value={form.ordreAffichage} inputMode="numeric" onChange={(event) => setForm((current) => ({ ...current, ordreAffichage: event.target.value }))} />
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
              <div className="grid content-end gap-2 pb-1 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={form.obligatoire}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, obligatoire: checked === true }))}
                  />
                  Obligatoire
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={form.actif}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, actif: checked === true }))}
                  />
                  Actif
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editing ? "Modifier" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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

function typeToForm(type: TypePieceJointe): FormState {
  return {
    libelle: type.libelle,
    typeContrat: type.typeContrat ?? ALL,
    typeClient: type.typeClient ?? ALL,
    typeMouvementId: type.typeMouvementId ?? ALL,
    obligatoire: Boolean(type.obligatoire),
    actif: type.actif !== false,
    ordreAffichage: type.ordreAffichage == null ? "" : String(type.ordreAffichage),
  };
}

function typeToPayload(type: TypePieceJointe, actif: boolean): UpsertTypePieceJointeRequest {
  return {
    libelle: type.libelle,
    typeContrat: type.typeContrat ?? null,
    typeClient: type.typeClient ?? null,
    typeMouvementId: type.typeMouvementId ?? null,
    obligatoire: Boolean(type.obligatoire),
    actif,
    ordreAffichage: type.ordreAffichage ?? null,
  };
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
