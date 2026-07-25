import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Edit, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { Field } from "../components/Field";
import { compagnieAssuranceSchema } from "../schemas";
import type { ReferenceOption, UpsertCompagnieAssuranceRequest } from "../types";

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const compagnies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance"],
    queryFn: () => productionApi.referentiel("compagnies-assurance"),
    staleTime: 60_000,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState<UpsertCompagnieAssuranceRequest>(emptyCompany());

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }
    setPayload(editing ? companyPayload(editing) : emptyCompany());
  }, [dialogOpen, editing]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (compagnies.data ?? []).filter((compagnie) => {
      const active = compagnie.actif !== false;
      if (status === "active" && !active) return false;
      if (status === "inactive" && active) return false;
      if (!term) return true;
      return [
        compagnie.code,
        compagnie.libelle,
        companyField(compagnie, "ville"),
        companyField(compagnie, "rc"),
        companyField(compagnie, "ice"),
      ].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [compagnies.data, search, status]);

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertCompagnieAssuranceRequest }) =>
      id ? productionApi.updateCompagnieAssurance(id, value) : productionApi.createCompagnieAssurance(value),
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "compagnies-assurance"] });
      toast.success("Compagnie enregistrée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Companies</p>
          <h1 className="text-xl font-semibold tracking-tight">Compagnies d'assurance</h1>
          <p className="text-sm text-muted-foreground">Référentiel des assureurs utilisés en production, stock et grilles.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter compagnie
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filtrer par nom, code, ville, RC ou ICE"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actives</SelectItem>
              <SelectItem value="inactive">Inactives</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Compagnie</TableHead>
                <TableHead className="text-right">Ordre</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>RC</TableHead>
                <TableHead>ICE</TableHead>
                <TableHead>Préfixe</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((compagnie) => (
                <TableRow key={compagnie.id}>
                  <TableCell className="font-medium">{compagnie.code ?? "-"}</TableCell>
                  <TableCell>
                    <div className="font-medium">{compagnie.libelle}</div>
                    <div className="text-xs text-muted-foreground">{companyField(compagnie, "adresse") || "-"}</div>
                  </TableCell>
                  <TableCell className="text-right">{companyNumber(compagnie, "ordreAffichage") ?? "-"}</TableCell>
                  <TableCell>{companyField(compagnie, "ville") || "-"}</TableCell>
                  <TableCell>{companyField(compagnie, "telephone") || "-"}</TableCell>
                  <TableCell>{companyField(compagnie, "rc") || "-"}</TableCell>
                  <TableCell>{companyField(compagnie, "ice") || "-"}</TableCell>
                  <TableCell>{companyField(compagnie, "prefixeAttestation") || "-"}</TableCell>
                  <TableCell>{compagnie.actif === false ? "Non" : "Oui"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(compagnie); setDialogOpen(true); }}>
                      <Edit className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!compagnies.isLoading && filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Aucune compagnie.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-amber-600" />
              {editing ? "Modifier compagnie" : "Ajouter compagnie"}
            </DialogTitle>
            <DialogDescription>Les champs RC et ICE restent optionnels quand l'information n'est pas disponible.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Code" required>
              <Input value={payload.code} onChange={(event) => update(setPayload, { code: event.target.value })} />
            </Field>
            <Field label="Nom" required>
              <Input value={payload.nom} onChange={(event) => update(setPayload, { nom: event.target.value })} />
            </Field>
            <Field label="RC">
              <Input value={payload.rc ?? ""} onChange={(event) => update(setPayload, { rc: event.target.value })} />
            </Field>
            <Field label="ICE">
              <Input value={payload.ice ?? ""} onChange={(event) => update(setPayload, { ice: event.target.value })} />
            </Field>
            <Field label="Téléphone">
              <Input value={payload.telephone ?? ""} onChange={(event) => update(setPayload, { telephone: event.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={payload.email ?? ""} onChange={(event) => update(setPayload, { email: event.target.value })} />
            </Field>
            <Field label="Ville">
              <Input value={payload.ville ?? ""} onChange={(event) => update(setPayload, { ville: event.target.value })} />
            </Field>
            <Field label="Préfixe attestation">
              <Input value={payload.prefixeAttestation ?? ""} onChange={(event) => update(setPayload, { prefixeAttestation: event.target.value })} />
            </Field>
            <Field label="Ordre d'affichage">
              <Input
                type="number"
                value={payload.ordreAffichage ?? ""}
                onChange={(event) => update(setPayload, { ordreAffichage: event.target.value === "" ? undefined : Number(event.target.value) })}
              />
            </Field>
            <Field label="Adresse">
              <Input value={payload.adresse ?? ""} onChange={(event) => update(setPayload, { adresse: event.target.value })} />
            </Field>
            <label className="flex min-h-9 items-center gap-2 self-end rounded-md border border-slate-300 bg-slate-50/70 px-3 text-sm dark:border-slate-600 dark:bg-slate-900">
              <Checkbox checked={payload.actif !== false} onCheckedChange={(value) => update(setPayload, { actif: Boolean(value) })} />
              <span>Actif</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button disabled={save.isPending} onClick={() => saveCompany(editing, payload, save.mutate)}>
              {editing ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function saveCompany(
  editing: ReferenceOption | null,
  payload: UpsertCompagnieAssuranceRequest,
  mutate: (variables: { id?: string; value: UpsertCompagnieAssuranceRequest }) => void
) {
  const parsed = compagnieAssuranceSchema.safeParse(cleanCompanyPayload(payload));
  if (!parsed.success) {
    toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
    return;
  }
  mutate({ id: editing?.id, value: parsed.data });
}

function emptyCompany(): UpsertCompagnieAssuranceRequest {
  return { code: "", nom: "", ordreAffichage: 100, actif: true };
}

function companyPayload(compagnie: ReferenceOption): UpsertCompagnieAssuranceRequest {
  return {
    code: compagnie.code ?? "",
    nom: companyField(compagnie, "nom") || compagnie.libelle,
    adresse: companyField(compagnie, "adresse"),
    ville: companyField(compagnie, "ville"),
    email: companyField(compagnie, "email"),
    telephone: companyField(compagnie, "telephone"),
    rc: companyField(compagnie, "rc"),
    ice: companyField(compagnie, "ice"),
    prefixeAttestation: companyField(compagnie, "prefixeAttestation"),
    ordreAffichage: companyNumber(compagnie, "ordreAffichage") ?? 100,
    actif: compagnie.actif !== false,
  };
}

function companyField(compagnie: ReferenceOption, key: string) {
  const value = compagnie[key];
  return typeof value === "string" ? value : "";
}

function companyNumber(compagnie: ReferenceOption, key: string) {
  const value = compagnie[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function cleanCompanyPayload(payload: UpsertCompagnieAssuranceRequest): UpsertCompagnieAssuranceRequest {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, typeof value === "string" && value.trim() === "" ? undefined : value])
  ) as UpsertCompagnieAssuranceRequest;
}

function update(
  setPayload: (updater: (current: UpsertCompagnieAssuranceRequest) => UpsertCompagnieAssuranceRequest) => void,
  patch: Partial<UpsertCompagnieAssuranceRequest>
) {
  setPayload((current) => ({ ...current, ...patch }));
}
