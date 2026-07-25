import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
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
import { GrilleTarifaireDialog } from "../components/GrilleTarifaireDialog";
import type { ReferenceOption, UpsertConventionRequest, UpsertGrilleTarifaireRequest } from "../types";

const ALL_COMPANIES = "__all__";
const NONE = "__none__";

export default function CompaniesConventionsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [compagnieId, setCompagnieIdState] = useState(searchParams.get("compagnieId") || ALL_COMPANIES);
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [grilleDialogOpen, setGrilleDialogOpen] = useState(false);
  const [payload, setPayload] = useState<UpsertConventionRequest>(emptyConvention(""));

  const compagnies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance"],
    queryFn: () => productionApi.referentiel("compagnies-assurance"),
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

  const grilles = useQuery({
    queryKey: ["referentiel", "grilles-tarifaires", payload.compagnieAssuranceId],
    queryFn: () => payload.compagnieAssuranceId
      ? productionApi.referentiel("grilles-tarifaires", { compagnieAssuranceId: payload.compagnieAssuranceId })
      : Promise.resolve([]),
    staleTime: 60_000,
  });

  const conventions = useQuery({
    queryKey: ["referentiel", "conventions"],
    queryFn: () => productionApi.referentiel("conventions"),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!dialogOpen) return;
    const defaultCompany = compagnieId === ALL_COMPANIES ? "" : compagnieId;
    setPayload(editing ? conventionPayload(editing) : emptyConvention(defaultCompany));
  }, [compagnieId, dialogOpen, editing]);

  const allowedUsageIds = useMemo(() => {
    const category = categories.data?.find((item) => item.id === payload.categorieClientId);
    const ids = referenceStringArray(category, "usageIds");
    return ids.length > 0 ? new Set(ids) : null;
  }, [categories.data, payload.categorieClientId]);

  const usageOptions = useMemo(() => {
    return (usages.data ?? []).filter((usage) => !allowedUsageIds || allowedUsageIds.has(usage.id));
  }, [allowedUsageIds, usages.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (conventions.data ?? []).filter((convention) => {
      if (compagnieId !== ALL_COMPANIES && conventionField(convention, "compagnieAssuranceId") !== compagnieId) {
        return false;
      }
      if (!term) return true;
      return [
        convention.code,
        convention.libelle,
        conventionField(convention, "compagnieAssuranceLibelle"),
        conventionField(convention, "categorieClientLibelle"),
        conventionField(convention, "grilleTarifaireLibelle"),
        conventionField(convention, "echeance"),
        conventionField(convention, "fractionnement"),
      ].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [compagnieId, conventions.data, search]);

  const saveConvention = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: UpsertConventionRequest }) =>
      id ? productionApi.updateConvention(id, value) : productionApi.createConvention(value),
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "conventions"] });
      toast.success("Convention enregistrée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Convention impossible à enregistrer"),
  });

  const saveGrille = useMutation({
    mutationFn: (value: UpsertGrilleTarifaireRequest) => productionApi.createGrilleTarifaire(value),
    onSuccess: async (grille) => {
      setGrilleDialogOpen(false);
      setPayload((current) => ({ ...current, grilleTarifaireId: grille.id }));
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "grilles-tarifaires"] });
      toast.success("Grille tarifaire créée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Grille impossible à créer"),
  });

  const setCompagnieId = (value: string) => {
    setCompagnieIdState(value);
    setSearchParams(value === ALL_COMPANIES ? {} : { compagnieId: value });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Compagnies</p>
          <h1 className="text-xl font-semibold tracking-tight">Conventions</h1>
          <p className="text-sm text-muted-foreground">Produits conventionnés disponibles pour les contrats automobile convention.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter convention
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_280px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filtrer par convention, compagnie, catégorie ou grille"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={compagnieId} onValueChange={setCompagnieId}>
            <SelectTrigger>
              <SelectValue placeholder="Compagnie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COMPANIES}>Toutes les compagnies</SelectItem>
              {(compagnies.data ?? []).map((compagnie) => (
                <SelectItem key={compagnie.id} value={compagnie.id}>{compagnie.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Convention</TableHead>
                <TableHead>Compagnie</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Grille</TableHead>
                <TableHead>Usages</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Fractionnement</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((convention) => (
                <TableRow key={convention.id}>
                  <TableCell className="font-medium">{convention.code ?? "-"}</TableCell>
                  <TableCell>
                    <div className="font-medium">{convention.libelle}</div>
                    <div className="text-xs text-muted-foreground">{conventionField(convention, "description") || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Building2 className="size-4 text-amber-600" />
                      {conventionField(convention, "compagnieAssuranceLibelle") || "-"}
                    </span>
                  </TableCell>
                  <TableCell>{conventionField(convention, "categorieClientLibelle") || "-"}</TableCell>
                  <TableCell>{conventionField(convention, "grilleTarifaireLibelle") || "-"}</TableCell>
                  <TableCell className="max-w-80">
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {referenceStringArray(convention, "usageLibelles").join(", ") || "-"}
                    </span>
                  </TableCell>
                  <TableCell>{formatEcheance(convention)}</TableCell>
                  <TableCell>{conventionField(convention, "fractionnement") || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(convention); setDialogOpen(true); }}>
                      <Edit className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!conventions.isLoading && filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Aucune convention.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier convention" : "Ajouter convention"}</DialogTitle>
            <DialogDescription>La grille et les usages autorisés pilotent le calcul automatique des garanties convention.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Compagnie" required>
              <Select
                value={payload.compagnieAssuranceId}
                onValueChange={(value) => setPayload((current) => ({ ...current, compagnieAssuranceId: value, grilleTarifaireId: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="Compagnie" /></SelectTrigger>
                <SelectContent>
                  {(compagnies.data ?? []).map((compagnie) => (
                    <SelectItem key={compagnie.id} value={compagnie.id}>{compagnie.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Code" required>
              <Input value={payload.code} onChange={(event) => updatePayload(setPayload, { code: event.target.value })} />
            </Field>
            <Field label="Intitulé" required>
              <Input value={payload.intitule} onChange={(event) => updatePayload(setPayload, { intitule: event.target.value })} />
            </Field>
            <Field label="Type d'échéance" required>
              <Select value={payload.typeEcheance} onValueChange={(value) => updatePayload(setPayload, { typeEcheance: value as UpsertConventionRequest["typeEcheance"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A_ECHEANCE">À échéance</SelectItem>
                  <SelectItem value="DATE_A_DATE">Date à date</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {payload.typeEcheance === "A_ECHEANCE" ? (
              <Field label="Échéance (jj/mm)" required>
                <Input maxLength={5} placeholder="JJ/MM" value={payload.echeance ?? ""} onChange={(event) => updatePayload(setPayload, { echeance: event.target.value })} />
              </Field>
            ) : null}
            <Field label="Catégorie" required>
              <Select
                value={payload.categorieClientId}
                onValueChange={(value) => setPayload((current) => ({ ...current, categorieClientId: value, usageIds: [] }))}
              >
                <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Grille tarifaire" required>
              <div className="flex gap-2">
                <Select
                  value={payload.grilleTarifaireId}
                  onValueChange={(value) => updatePayload(setPayload, { grilleTarifaireId: value })}
                  disabled={!payload.compagnieAssuranceId}
                >
                  <SelectTrigger><SelectValue placeholder="Grille" /></SelectTrigger>
                  <SelectContent>
                    {(grilles.data ?? []).map((grille) => (
                      <SelectItem key={grille.id} value={grille.id}>{grille.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" disabled={!payload.compagnieAssuranceId} onClick={() => setGrilleDialogOpen(true)}>
                  <Plus className="size-4" />
                  Grille
                </Button>
              </div>
            </Field>
            <Field label="Fractionnement">
              <Select
                value={payload.fractionnement ?? NONE}
                onValueChange={(value) => updatePayload(setPayload, { fractionnement: value === NONE ? undefined : value as UpsertConventionRequest["fractionnement"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun</SelectItem>
                  <SelectItem value="MENSUEL">Mensuel</SelectItem>
                  <SelectItem value="TRIMESTRIEL">Trimestriel</SelectItem>
                  <SelectItem value="SEMESTRIEL">Semestriel</SelectItem>
                  <SelectItem value="ANNUEL">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description">
              <Input value={payload.description ?? ""} onChange={(event) => updatePayload(setPayload, { description: event.target.value })} />
            </Field>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-semibold">Usages autorisés</div>
            <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {usageOptions.map((usage) => (
                <label key={usage.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                  <Checkbox
                    checked={payload.usageIds.includes(usage.id)}
                    onCheckedChange={(checked) => {
                      setPayload((current) => ({
                        ...current,
                        usageIds: checked
                          ? [...current.usageIds, usage.id]
                          : current.usageIds.filter((id) => id !== usage.id),
                      }));
                    }}
                  />
                  <span className="truncate">{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</span>
                </label>
              ))}
              {usageOptions.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sélectionnez une catégorie avec usages disponibles.</div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button disabled={saveConvention.isPending} onClick={() => submitConvention(editing, payload, saveConvention.mutate)}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GrilleTarifaireDialog
        open={grilleDialogOpen}
        onOpenChange={setGrilleDialogOpen}
        defaultCompagnieAssuranceId={payload.compagnieAssuranceId}
        hideCompagnie
        compagnies={compagnies.data ?? []}
        onSubmit={(value) => saveGrille.mutate(value)}
        submitting={saveGrille.isPending}
      />
    </div>
  );
}

function submitConvention(
  editing: ReferenceOption | null,
  payload: UpsertConventionRequest,
  mutate: (variables: { id?: string; value: UpsertConventionRequest }) => void
) {
  if (!payload.compagnieAssuranceId || !payload.code.trim() || !payload.intitule.trim() || !payload.categorieClientId || !payload.grilleTarifaireId) {
    toast.error("Convention incomplète");
    return;
  }
  if (payload.typeEcheance === "A_ECHEANCE" && !/^\d{2}\/\d{2}$/.test(payload.echeance ?? "")) {
    toast.error("Échéance invalide. Format attendu: JJ/MM");
    return;
  }
  if (payload.usageIds.length === 0) {
    toast.error("Sélectionnez au moins un usage");
    return;
  }
  mutate({
    id: editing?.id,
    value: {
      ...payload,
      code: payload.code.trim(),
      intitule: payload.intitule.trim(),
      description: payload.description?.trim() || undefined,
      echeance: payload.typeEcheance === "A_ECHEANCE" ? payload.echeance : undefined,
      actif: true,
    },
  });
}

function emptyConvention(compagnieAssuranceId: string): UpsertConventionRequest {
  return {
    compagnieAssuranceId,
    code: "",
    intitule: "",
    typeEcheance: "DATE_A_DATE",
    categorieClientId: "",
    grilleTarifaireId: "",
    usageIds: [],
    actif: true,
  };
}

function conventionPayload(convention: ReferenceOption): UpsertConventionRequest {
  return {
    compagnieAssuranceId: conventionField(convention, "compagnieAssuranceId"),
    code: convention.code ?? "",
    intitule: convention.libelle,
    description: conventionField(convention, "description"),
    organismeConventionne: conventionField(convention, "organismeConventionne"),
    typeEcheance: conventionField(convention, "typeEcheance") === "A_ECHEANCE" ? "A_ECHEANCE" : "DATE_A_DATE",
    echeance: conventionField(convention, "echeance"),
    fractionnement: parseFractionnement(conventionField(convention, "fractionnement")),
    categorieClientId: conventionField(convention, "categorieClientId"),
    grilleTarifaireId: conventionField(convention, "grilleTarifaireId"),
    usageIds: referenceStringArray(convention, "usageIds"),
    actif: convention.actif !== false,
  };
}

function parseFractionnement(value: string): UpsertConventionRequest["fractionnement"] {
  return ["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"].includes(value)
    ? value as UpsertConventionRequest["fractionnement"]
    : undefined;
}

function updatePayload(
  setPayload: Dispatch<SetStateAction<UpsertConventionRequest>>,
  patch: Partial<UpsertConventionRequest>
) {
  setPayload((current) => ({ ...current, ...patch }));
}

function conventionField(convention: ReferenceOption | undefined, key: string) {
  const value = convention?.[key];
  return typeof value === "string" ? value : "";
}

function referenceStringArray(option: ReferenceOption | undefined, key: string) {
  const value = option?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function formatEcheance(convention: ReferenceOption) {
  const typeEcheance = conventionField(convention, "typeEcheance");
  const echeance = conventionField(convention, "echeance");
  if (typeEcheance === "A_ECHEANCE") {
    return echeance || "-";
  }
  return "Date à date";
}
