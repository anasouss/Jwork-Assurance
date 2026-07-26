import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ambulance, Edit, Package, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TableRowActions } from "@/components/shared/table-row-actions";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { Field } from "../components/Field";
import type { ReferenceOption, UpsertCompagnieAssistanceRequest } from "../types";

export default function AssistanceSettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [companySearch, setCompanySearch] = useState("");
  const [editingCompany, setEditingCompany] = useState<ReferenceOption | null>(null);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [companyPayload, setCompanyPayload] = useState<UpsertCompagnieAssistanceRequest>(emptyCompany());

  const companies = useQuery({
    queryKey: ["referentiel", "compagnies-assistance", "settings"],
    queryFn: () => productionApi.referentiel("compagnies-assistance", { includeInactive: "true" }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!companyDialogOpen) return;
    setCompanyPayload(editingCompany ? companyToPayload(editingCompany) : emptyCompany());
  }, [companyDialogOpen, editingCompany]);

  const filteredCompanies = useMemo(() => {
    const term = companySearch.trim().toLowerCase();
    return (companies.data ?? []).filter((company) => {
      if (!term) return true;
      return [company.code, company.libelle, refString(company, "email"), refString(company, "telephone")]
        .some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [companies.data, companySearch]);

  const saveCompany = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertCompagnieAssistanceRequest }) =>
      id ? productionApi.updateCompagnieAssistance(id, value) : productionApi.createCompagnieAssistance(value),
    onSuccess: async () => {
      setCompanyDialogOpen(false);
      setEditingCompany(null);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "compagnies-assistance"] });
      toast.success("Compagnie d'assistance enregistrée");
    },
    onError: showError,
  });

  const deleteCompany = useMutation({
    mutationFn: (id: string) => productionApi.deleteCompagnieAssistance(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "compagnies-assistance"] });
      toast.success("Compagnie d'assistance désactivée");
    },
    onError: showError,
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Compagnies</p>
          <h1 className="text-xl font-semibold tracking-tight">Compagnies assistance</h1>
          <p className="text-sm text-muted-foreground">Référentiel des prestataires utilisés dans la ligne assistance des contrats.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/app/companies/assistance/produits")}>
            <Package className="size-4" />
            Produits assistance
          </Button>
          <Button onClick={() => { setEditingCompany(null); setCompanyDialogOpen(true); }}>
            <Plus className="size-4" />
            Compagnie assistance
          </Button>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Compagnies d'assistance</h2>
            <p className="text-sm text-muted-foreground">Gérez uniquement les compagnies ici. Les produits et tarifs ont leur propre page.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Filtrer compagnie" value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader className="bg-amber-600 text-white [&_th]:text-white">
              <TableRow className="hover:bg-amber-600">
                <TableHead>Code</TableHead>
                <TableHead>Compagnie</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.code}</TableCell>
                  <TableCell>{company.libelle}</TableCell>
                  <TableCell>{refString(company, "telephone") || "-"}</TableCell>
                  <TableCell>{refString(company, "email") || "-"}</TableCell>
                  <TableCell>{company.actif === false ? "Non" : "Oui"}</TableCell>
                  <TableCell className="text-right">
                    <TableRowActions
                      label={`Actions ${company.libelle}`}
                      actions={[
                        {
                          label: "Produits",
                          icon: Package,
                          onSelect: () => navigate(`/app/companies/assistance/produits?compagnieId=${company.id}`),
                        },
                        {
                          label: "Modifier",
                          icon: Edit,
                          onSelect: () => { setEditingCompany(company); setCompanyDialogOpen(true); },
                        },
                        {
                          label: "Désactiver",
                          icon: Trash2,
                          destructive: true,
                          disabled: company.actif === false || deleteCompany.isPending,
                          onSelect: () => deleteCompany.mutate(company.id),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!companies.isLoading && filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucune compagnie d'assistance.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={companyDialogOpen} onOpenChange={(open) => { setCompanyDialogOpen(open); if (!open) setEditingCompany(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ambulance className="size-5 text-amber-600" />
              {editingCompany ? "Modifier compagnie assistance" : "Ajouter compagnie assistance"}
            </DialogTitle>
            <DialogDescription>Ces compagnies alimentent le choix assistance dans les contrats.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" required>
              <Input value={companyPayload.code} onChange={(event) => setCompanyPayload((current) => ({ ...current, code: event.target.value }))} />
            </Field>
            <Field label="Nom" required>
              <Input value={companyPayload.nom} onChange={(event) => setCompanyPayload((current) => ({ ...current, nom: event.target.value }))} />
            </Field>
            <Field label="Téléphone">
              <Input value={companyPayload.telephone ?? ""} onChange={(event) => setCompanyPayload((current) => ({ ...current, telephone: event.target.value }))} />
            </Field>
            <Field label="Email">
              <Input value={companyPayload.email ?? ""} onChange={(event) => setCompanyPayload((current) => ({ ...current, email: event.target.value }))} />
            </Field>
            <label className="flex min-h-9 items-center gap-2 self-end rounded-md border border-slate-300 bg-slate-50/70 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950/70">
              <Checkbox checked={companyPayload.actif !== false} onCheckedChange={(value) => setCompanyPayload((current) => ({ ...current, actif: Boolean(value) }))} />
              <span>Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>Annuler</Button>
            <Button disabled={saveCompany.isPending} onClick={() => submitCompany(editingCompany, companyPayload, saveCompany.mutate)}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function emptyCompany(): UpsertCompagnieAssistanceRequest {
  return { code: "", nom: "", actif: true };
}

function companyToPayload(company: ReferenceOption): UpsertCompagnieAssistanceRequest {
  return {
    code: company.code ?? "",
    nom: refString(company, "nom") || company.libelle,
    email: refString(company, "email"),
    telephone: refString(company, "telephone"),
    actif: company.actif !== false,
  };
}

function submitCompany(
  editing: ReferenceOption | null,
  payload: UpsertCompagnieAssistanceRequest,
  mutate: (variables: { id?: string; value: UpsertCompagnieAssistanceRequest }) => void
) {
  const value = {
    ...payload,
    code: payload.code.trim(),
    nom: payload.nom.trim(),
    email: cleanOptional(payload.email),
    telephone: cleanOptional(payload.telephone),
  };
  if (!value.code || !value.nom) {
    toast.error("Code et nom sont obligatoires.");
    return;
  }
  mutate({ id: editing?.id, value });
}

function refString(item: ReferenceOption | Record<string, unknown>, key: string) {
  const value = item[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function cleanOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
