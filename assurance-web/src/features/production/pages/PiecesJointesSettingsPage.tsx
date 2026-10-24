import type React from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, Power, PowerOff, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { referenceKeys } from "@/lib/query-keys";
import { attachmentSettingsApi } from "../api/attachment-settings";
import { referenceApi } from "../api/references";
import type { TypeClient, TypeContrat, TypePieceJointe, UpsertTypePieceJointeRequest } from "../types";

const ALL = "__ALL__";
const PAGE_SIZE = 10;
const TYPE_CONTRATS: TypeContrat[] = ["PARTICULIER", "CONVENTION", "FLOTTE"];
const TYPE_CLIENTS: TypeClient[] = ["PERSONNE_PHYSIQUE", "PERSONNE_MORALE"];

type DocumentGroup = {
  key: string;
  natureId: string | null;
  libelle: string;
  rules: TypePieceJointe[];
};

type FormState = {
  libelle: string;
  naturePieceJointeId: string | null;
  brancheAssuranceId: string;
  typeAssistance: string;
  typeContrat: string;
  typeClient: string;
  typeMouvementId: string;
  obligatoire: boolean;
  actif: boolean;
  ordreAffichage: string;
};

const EMPTY_FORM: FormState = {
  libelle: "",
  naturePieceJointeId: null,
  brancheAssuranceId: ALL,
  typeAssistance: ALL,
  typeContrat: ALL,
  typeClient: ALL,
  typeMouvementId: ALL,
  obligatoire: false,
  actif: true,
  ordreAffichage: "",
};

export default function PiecesJointesSettingsPage() {
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<TypePieceJointe | null>(null);
  const [selectedDocumentKey, setSelectedDocumentKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState(ALL);
  const [assistanceFilter, setAssistanceFilter] = useState(ALL);

  const typesQuery = useQuery({
    queryKey: ["pieces-jointes-types", true],
    queryFn: () => attachmentSettingsApi.listTypes(true),
  });
  const mouvementsQuery = useQuery({
    queryKey: ["pieces-jointes-types-mouvements"],
    queryFn: attachmentSettingsApi.listMovementTypes,
  });
  const branchesQuery = useQuery({
    queryKey: referenceKeys.list("branches-assurance"),
    queryFn: () => referenceApi.list("branches-assurance"),
  });

  const branches = branchesQuery.data ?? [];
  const branchMap = useMemo(() => new Map(branches.map((item) => [item.id, item])), [branches]);
  const assistanceBranchId = branches.find((item) => item.code?.toUpperCase() === "ASSISTANCE")?.id;
  const selectedFormBranch = branchMap.get(form.brancheAssuranceId);
  const assistanceForm = selectedFormBranch?.code?.toUpperCase() === "ASSISTANCE";
  const documents = useMemo(() => groupDocuments(typesQuery.data ?? []), [typesQuery.data]);
  const selectedDocument = selectedDocumentKey == null
    ? null
    : documents.find((document) => document.key === selectedDocumentKey) ?? null;

  const filteredDocuments = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("fr");
    return documents.filter((document) => {
      if (needle && !document.libelle.toLocaleLowerCase("fr").includes(needle)) return false;
      return document.rules.some((rule) => {
        if (branchFilter !== ALL
          && rule.brancheAssuranceId != null
          && rule.brancheAssuranceId !== branchFilter) return false;
        return assistanceFilter === ALL
          || rule.typeAssistance == null
          || rule.typeAssistance === assistanceFilter;
      });
    });
  }, [assistanceFilter, branchFilter, documents, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedDocuments = filteredDocuments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const saveMutation = useMutation({
    mutationFn: (payload: UpsertTypePieceJointeRequest) => editingRule
      ? attachmentSettingsApi.updateType(editingRule.id, payload)
      : attachmentSettingsApi.createType(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pieces-jointes-types"] });
      toast.success(editingRule ? "Règle mise à jour" : "Règle ajoutée");
      if (selectedDocumentKey == null) closeModal();
      else {
        setEditingRule(null);
        setRuleEditorOpen(false);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const toggleMutation = useMutation({
    mutationFn: (rule: TypePieceJointe) => attachmentSettingsApi.updateType(rule.id, typeToPayload(rule, rule.actif === false)),
    onSuccess: async (_, rule) => {
      await queryClient.invalidateQueries({ queryKey: ["pieces-jointes-types"] });
      toast.success(rule.actif === false ? "Règle activée" : "Règle désactivée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Changement d’état impossible"),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    saveMutation.mutate(toPayload(form));
  }

  function openCreateDocument() {
    setSelectedDocumentKey(null);
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setRuleEditorOpen(true);
    setModalOpen(true);
  }

  function openManage(document: DocumentGroup) {
    setSelectedDocumentKey(document.key);
    setEditingRule(null);
    setRuleEditorOpen(false);
    setModalOpen(true);
  }

  function openCreateRule() {
    if (!selectedDocument) return;
    setEditingRule(null);
    setForm({ ...EMPTY_FORM, libelle: selectedDocument.libelle, naturePieceJointeId: selectedDocument.natureId });
    setRuleEditorOpen(true);
  }

  function openEditRule(rule: TypePieceJointe) {
    setEditingRule(rule);
    setForm(typeToForm(rule));
    setRuleEditorOpen(true);
  }

  function closeRuleEditor() {
    if (selectedDocumentKey == null) closeModal();
    else {
      setEditingRule(null);
      setRuleEditorOpen(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedDocumentKey(null);
    setEditingRule(null);
    setRuleEditorOpen(false);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
          <h1 className="text-xl font-semibold tracking-tight">Pièces jointes</h1>
          <p className="text-sm text-muted-foreground">Un document peut être utilisé par plusieurs mouvements avec des règles différentes.</p>
        </div>
        <Button type="button" onClick={openCreateDocument}><Plus className="size-4" />Ajouter un document</Button>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-emerald-50/70 py-3 dark:bg-emerald-950/30">
          <CardTitle className="text-sm">Catalogue et règles</CardTitle>
          <span className="text-xs text-muted-foreground">{filteredDocuments.length} document{filteredDocuments.length > 1 ? "s" : ""}</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-3 border-b p-3 md:grid-cols-[minmax(220px,1fr)_220px_220px]">
            <Field label="Rechercher">
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={search} placeholder="Nom du document" onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }} />
              </span>
            </Field>
            <Field label="Branche">
              <Select value={branchFilter} onValueChange={(value) => {
                setBranchFilter(value);
                setAssistanceFilter(ALL);
                setPage(1);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Toutes les branches</SelectItem>
                  {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.libelle}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Parcours assistance">
              <Select value={assistanceFilter} disabled={branchFilter !== assistanceBranchId} onValueChange={(value) => {
                setAssistanceFilter(value);
                setPage(1);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les parcours</SelectItem>
                  <SelectItem value="VOYAGE">Assistance voyage</SelectItem>
                  <SelectItem value="AUTOMOBILE">Assistance automobile</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Table>
            <TableHeader className="bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50">
              <TableRow>
                <TableHead>Document</TableHead><TableHead>Règles</TableHead><TableHead>Branches</TableHead>
                <TableHead>Mouvements</TableHead><TableHead>Obligatoire</TableHead><TableHead>État</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typesQuery.isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : pagedDocuments.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Aucun document ne correspond aux filtres.</TableCell></TableRow>
              ) : pagedDocuments.map((document) => {
                const activeRules = document.rules.filter((rule) => rule.actif !== false);
                const requiredCount = activeRules.filter((rule) => rule.obligatoire).length;
                return (
                  <TableRow key={document.key}>
                    <TableCell className="font-medium">{document.libelle}</TableCell>
                    <TableCell>{document.rules.length}</TableCell>
                    <TableCell>{summarize(document.rules.map((rule) => rule.brancheAssuranceLibelle ?? "Toutes"))}</TableCell>
                    <TableCell>{summarize(document.rules.map((rule) => rule.typeMouvementLibelle ?? "Tous"))}</TableCell>
                    <TableCell>{requiredCount} / {activeRules.length}</TableCell>
                    <TableCell>{activeRules.length > 0 ? <Badge variant="success">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => openManage(document)}>
                        <Settings2 className="size-4" />Gérer
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t px-3 py-3">
            <span className="text-xs text-muted-foreground">Page {safePage} / {totalPages}</span>
            <Pagination className="mx-0 w-auto justify-end"><PaginationContent>
              <PaginationItem><PaginationPrevious href="#" aria-disabled={safePage <= 1} className={safePage <= 1 ? "pointer-events-none opacity-50" : undefined} onClick={(event) => {
                event.preventDefault();
                setPage((current) => Math.max(1, current - 1));
              }} /></PaginationItem>
              <PaginationItem><span className="flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium">{safePage}</span></PaginationItem>
              <PaginationItem><PaginationNext href="#" aria-disabled={safePage >= totalPages} className={safePage >= totalPages ? "pointer-events-none opacity-50" : undefined} onClick={(event) => {
                event.preventDefault();
                setPage((current) => Math.min(totalPages, current + 1));
              }} /></PaginationItem>
            </PaginationContent></Pagination>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => open ? setModalOpen(true) : closeModal()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader><DialogTitle>{selectedDocument?.libelle ?? "Ajouter un document"}</DialogTitle></DialogHeader>
          {selectedDocument && !ruleEditorOpen ? (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Chaque ligne définit un contexte dans lequel ce document est attendu.</p>
                <Button type="button" size="sm" onClick={openCreateRule}><Plus className="size-4" />Ajouter une règle</Button>
              </div>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Branche</TableHead><TableHead>Parcours / contrat</TableHead><TableHead>Client</TableHead>
                    <TableHead>Mouvement</TableHead><TableHead>État</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{selectedDocument.rules.map((rule) => (
                    <TableRow key={rule.id} className={rule.actif === false ? "bg-muted/30 text-muted-foreground" : undefined}>
                      <TableCell>{rule.brancheAssuranceLibelle ?? "Toutes"}</TableCell>
                      <TableCell>{ruleScopeLabel(rule)}</TableCell>
                      <TableCell>{rule.typeClient ? clientLabel(rule.typeClient) : "Tous"}</TableCell>
                      <TableCell>{rule.typeMouvementLibelle ?? "Tous"}</TableCell>
                      <TableCell><span className="flex flex-wrap gap-1">
                        {rule.obligatoire ? <Badge>Obligatoire</Badge> : <Badge variant="secondary">Optionnel</Badge>}
                        {rule.actif === false ? <Badge variant="destructive">Inactif</Badge> : <Badge variant="success">Actif</Badge>}
                        {rule.systeme ? <Badge variant="outline">Système</Badge> : null}
                      </span></TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="icon" className="size-8" title="Modifier" onClick={() => openEditRule(rule)}><Edit2 className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className={rule.actif === false ? "size-8 text-emerald-700" : "size-8 text-destructive"} title={rule.actif === false ? "Activer" : "Désactiver"} disabled={toggleMutation.isPending && toggleMutation.variables?.id === rule.id} onClick={() => toggleMutation.mutate(rule)}>
                          {rule.actif === false ? <Power className="size-4" /> : <PowerOff className="size-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
              <DialogFooter><Button type="button" variant="outline" onClick={closeModal}>Fermer</Button></DialogFooter>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={submit}>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedDocument == null ? (
                  <Field label="Document"><Input value={form.libelle} placeholder="Ex. CIN" required onChange={(event) => setForm((current) => ({ ...current, libelle: event.target.value }))} /></Field>
                ) : <Field label="Document"><Input value={selectedDocument.libelle} disabled /></Field>}
                <Field label="Ordre"><Input value={form.ordreAffichage} inputMode="numeric" onChange={(event) => setForm((current) => ({ ...current, ordreAffichage: event.target.value }))} /></Field>
                <Field label="Branche">
                  <Select value={form.brancheAssuranceId} onValueChange={(value) => {
                    const branch = branchMap.get(value);
                    const assistance = branch?.code?.toUpperCase() === "ASSISTANCE";
                    setForm((current) => ({ ...current, brancheAssuranceId: value, typeAssistance: ALL, typeContrat: assistance ? ALL : current.typeContrat }));
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value={ALL}>Toutes les branches</SelectItem>
                      {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                {assistanceForm ? (
                  <Field label="Parcours assistance"><Select value={form.typeAssistance} onValueChange={(value) => setForm((current) => ({ ...current, typeAssistance: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value={ALL}>Voyage et automobile</SelectItem><SelectItem value="VOYAGE">Assistance voyage</SelectItem><SelectItem value="AUTOMOBILE">Assistance automobile</SelectItem>
                    </SelectContent>
                  </Select></Field>
                ) : (
                  <Field label="Type de contrat"><Select value={form.typeContrat} onValueChange={(value) => setForm((current) => ({ ...current, typeContrat: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value={ALL}>Tous les types</SelectItem>{TYPE_CONTRATS.map((type) => <SelectItem key={type} value={type}>{contractTypeLabel(type)}</SelectItem>)}
                    </SelectContent>
                  </Select></Field>
                )}
                <Field label="Client"><Select value={form.typeClient} onValueChange={(value) => setForm((current) => ({ ...current, typeClient: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value={ALL}>Tous</SelectItem>{TYPE_CLIENTS.map((type) => <SelectItem key={type} value={type}>{clientLabel(type)}</SelectItem>)}
                  </SelectContent>
                </Select></Field>
                <Field label="Mouvement"><Select value={form.typeMouvementId} onValueChange={(value) => setForm((current) => ({ ...current, typeMouvementId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value={ALL}>Tous</SelectItem>{(mouvementsQuery.data ?? []).map((type) => <SelectItem key={type.id} value={type.id}>{type.libelle}</SelectItem>)}
                  </SelectContent>
                </Select></Field>
                <div className="grid content-end gap-2 pb-1 text-sm">
                  <label className="flex items-center gap-2"><Checkbox checked={form.obligatoire} onCheckedChange={(checked) => setForm((current) => ({ ...current, obligatoire: checked === true }))} />Obligatoire</label>
                  <label className="flex items-center gap-2"><Checkbox checked={form.actif} onCheckedChange={(checked) => setForm((current) => ({ ...current, actif: checked === true }))} />Actif</label>
                </div>
              </div>
              <DialogFooter><Button type="button" variant="outline" onClick={closeRuleEditor}>Annuler</Button><Button type="submit" disabled={saveMutation.isPending}>{editingRule ? "Modifier" : "Ajouter"}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-700 dark:text-neutral-300"><span>{label}</span>{children}</label>;
}

function groupDocuments(rules: TypePieceJointe[]) {
  const groups = new Map<string, DocumentGroup>();
  rules.forEach((rule) => {
    const fallback = rule.libelle.trim().toLocaleUpperCase("fr");
    const key = rule.naturePieceJointeId ? `nature:${rule.naturePieceJointeId}` : `legacy:${fallback}`;
    const current = groups.get(key);
    if (current) current.rules.push(rule);
    else groups.set(key, { key, natureId: rule.naturePieceJointeId ?? null, libelle: rule.naturePieceJointeLibelle ?? rule.libelle, rules: [rule] });
  });
  return [...groups.values()].sort((left, right) => left.libelle.localeCompare(right.libelle, "fr"));
}

function summarize(values: string[]) {
  const unique = [...new Set(values)];
  return unique.length <= 2 ? unique.join(", ") : `${unique.slice(0, 2).join(", ")} +${unique.length - 2}`;
}

function typeToForm(rule: TypePieceJointe): FormState {
  return {
    libelle: rule.naturePieceJointeLibelle ?? rule.libelle,
    naturePieceJointeId: rule.naturePieceJointeId ?? null,
    brancheAssuranceId: rule.brancheAssuranceId ?? ALL,
    typeAssistance: rule.typeAssistance ?? ALL,
    typeContrat: rule.typeContrat ?? ALL,
    typeClient: rule.typeClient ?? ALL,
    typeMouvementId: rule.typeMouvementId ?? ALL,
    obligatoire: Boolean(rule.obligatoire),
    actif: rule.actif !== false,
    ordreAffichage: rule.ordreAffichage == null ? "" : String(rule.ordreAffichage),
  };
}

function typeToPayload(rule: TypePieceJointe, actif: boolean): UpsertTypePieceJointeRequest {
  return {
    libelle: rule.naturePieceJointeLibelle ?? rule.libelle,
    naturePieceJointeId: rule.naturePieceJointeId ?? null,
    brancheAssuranceId: rule.brancheAssuranceId ?? null,
    typeAssistance: rule.typeAssistance ?? null,
    typeContrat: rule.typeContrat ?? null,
    typeClient: rule.typeClient ?? null,
    typeMouvementId: rule.typeMouvementId ?? null,
    obligatoire: Boolean(rule.obligatoire),
    actif,
    ordreAffichage: rule.ordreAffichage ?? null,
  };
}

function toPayload(form: FormState): UpsertTypePieceJointeRequest {
  return {
    libelle: form.libelle.trim(),
    naturePieceJointeId: form.naturePieceJointeId,
    brancheAssuranceId: form.brancheAssuranceId === ALL ? null : form.brancheAssuranceId,
    typeAssistance: form.typeAssistance === ALL ? null : form.typeAssistance as "VOYAGE" | "AUTOMOBILE",
    typeContrat: form.typeContrat === ALL ? null : form.typeContrat as TypeContrat,
    typeClient: form.typeClient === ALL ? null : form.typeClient as TypeClient,
    typeMouvementId: form.typeMouvementId === ALL ? null : form.typeMouvementId,
    obligatoire: form.obligatoire,
    actif: form.actif,
    ordreAffichage: form.ordreAffichage.trim() ? Number(form.ordreAffichage) : null,
  };
}

function ruleScopeLabel(rule: TypePieceJointe) {
  if (rule.brancheAssuranceCode?.toUpperCase() === "ASSISTANCE") return assistanceTypeLabel(rule.typeAssistance);
  return rule.typeContrat ? contractTypeLabel(rule.typeContrat) : "Tous";
}

function clientLabel(type: TypeClient) {
  return type === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique";
}

function contractTypeLabel(type: TypeContrat) {
  if (type === "PARTICULIER") return "Mono";
  if (type === "CONVENTION") return "Convention";
  return "Flotte";
}

function assistanceTypeLabel(type?: "VOYAGE" | "AUTOMOBILE" | null) {
  if (type === "VOYAGE") return "Assistance voyage";
  if (type === "AUTOMOBILE") return "Assistance automobile";
  return "Voyage et automobile";
}
