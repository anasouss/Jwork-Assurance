import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, RotateCcw, Search, SlidersHorizontal, TableProperties } from "lucide-react";
import { toast } from "sonner";
import { TableRowActions } from "@/components/shared/table-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthStore } from "@/store/auth-store";
import { pricingApi } from "../api/pricing";
import { referenceApi } from "../api/references";
import { GrilleTarifaireConfigurator } from "../components/GrilleTarifaireConfigurator";
import { GrilleTarifaireDialog } from "../components/GrilleTarifaireDialog";
import type {
  GrilleTarifaireCatalogueItem,
  ReferenceOption,
  UpsertGrilleTarifaireRequest,
} from "../types";

const ALL = "__all__";

type Filters = {
  query: string;
  compagnieId: string;
  conventionId: string;
  usageId: string;
  status: string;
};

const EMPTY_FILTERS: Filters = {
  query: "",
  compagnieId: ALL,
  conventionId: ALL,
  usageId: ALL,
  status: "active",
};

export default function CompaniesPricingGridsPage() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("referentiel:manage");
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<GrilleTarifaireCatalogueItem | null>(null);
  const [configuring, setConfiguring] = useState<GrilleTarifaireCatalogueItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const compagnies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance"],
    queryFn: () => referenceApi.list("compagnies-assurance"),
    staleTime: 60_000,
  });
  const conventions = useQuery({
    queryKey: ["referentiel", "conventions"],
    queryFn: () => referenceApi.list("conventions"),
    staleTime: 60_000,
  });
  const usages = useQuery({
    queryKey: ["referentiel", "usages"],
    queryFn: () => referenceApi.list("usages"),
    staleTime: 60_000,
  });
  const garanties = useQuery({
    queryKey: ["referentiel", "garanties"],
    queryFn: () => referenceApi.list("garanties"),
    staleTime: 60_000,
  });
  const categoriesTransport = useQuery({
    queryKey: ["referentiel", "categories-transport"],
    queryFn: () => referenceApi.list("categories-transport"),
    staleTime: 60_000,
  });

  const catalogueParams = useMemo(() => ({
    query: filters.query.trim() || undefined,
    compagnieAssuranceId: optionalFilter(filters.compagnieId),
    conventionId: optionalFilter(filters.conventionId),
    usageId: optionalFilter(filters.usageId),
    actif: filters.status === ALL ? undefined : String(filters.status === "active"),
  }), [filters]);

  const catalogue = useQuery({
    queryKey: ["referentiel", "grilles-tarifaires", "catalogue", catalogueParams],
    queryFn: () => referenceApi.pricingGridCatalogue(catalogueParams),
  });

  const conventionOptions = useMemo(() => (conventions.data ?? []).filter((convention) => (
    draftFilters.compagnieId === ALL
    || String(convention.compagnieAssuranceId ?? "") === draftFilters.compagnieId
  )), [conventions.data, draftFilters.compagnieId]);

  const saveGrid = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertGrilleTarifaireRequest }) => (
      id ? pricingApi.updateGrid(id, payload) : pricingApi.createGrid(payload)
    ),
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await invalidateCatalogue(queryClient);
      toast.success("Grille tarifaire enregistrée");
    },
    onError: showError,
  });

  const applyFilters = () => setFilters(draftFilters);
  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Compagnies</p>
          <h1 className="text-xl font-semibold tracking-tight">Grilles tarifaires</h1>
          <p className="text-sm text-muted-foreground">
            Consultez les grilles, leurs usages configurés et les conventions qui les utilisent.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="size-4" />
            Ajouter une grille
          </Button>
        ) : null}
      </div>

      <section className="grid gap-3 rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_repeat(4,minmax(170px,1fr))]">
          <Input
            aria-label="Rechercher une grille tarifaire"
            placeholder="Grille, compagnie ou convention"
            value={draftFilters.query}
            onChange={(event) => setDraftFilters((current) => ({ ...current, query: event.target.value }))}
            onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }}
          />
          <Select
            value={draftFilters.compagnieId}
            onValueChange={(value) => setDraftFilters((current) => ({
              ...current,
              compagnieId: value,
              conventionId: ALL,
            }))}
          >
            <SelectTrigger><SelectValue placeholder="Compagnie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les compagnies</SelectItem>
              {(compagnies.data ?? []).map((compagnie) => (
                <SelectItem key={compagnie.id} value={compagnie.id}>{compagnie.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={draftFilters.conventionId} onValueChange={(value) => setDraftFilters((current) => ({ ...current, conventionId: value }))}>
            <SelectTrigger><SelectValue placeholder="Convention" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les conventions</SelectItem>
              {conventionOptions.map((convention) => (
                <SelectItem key={convention.id} value={convention.id}>
                  {convention.code ? `${convention.code} - ` : ""}{convention.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={draftFilters.usageId} onValueChange={(value) => setDraftFilters((current) => ({ ...current, usageId: value }))}>
            <SelectTrigger><SelectValue placeholder="Usage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les usages</SelectItem>
              {(usages.data ?? []).map((usage) => (
                <SelectItem key={usage.id} value={usage.id}>{usage.code} - {usage.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={draftFilters.status} onValueChange={(value) => setDraftFilters((current) => ({ ...current, status: value }))}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actives</SelectItem>
              <SelectItem value="inactive">Inactives</SelectItem>
              <SelectItem value={ALL}>Tous les statuts</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon" title="Réinitialiser" onClick={resetFilters}>
            <RotateCcw className="size-4" />
          </Button>
          <Button onClick={applyFilters}>
            <Search className="size-4" />
            Rechercher
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Catalogue</h2>
            <p className="text-sm text-muted-foreground">{catalogue.data?.length ?? 0} grille(s)</p>
          </div>
          <TableProperties className="size-5 text-muted-foreground" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-amber-600 text-white [&_th]:text-white">
              <TableRow className="hover:bg-amber-600">
                <TableHead>Grille</TableHead>
                <TableHead>Compagnie</TableHead>
                <TableHead>Conventions</TableHead>
                <TableHead>Usages configurés</TableHead>
                <TableHead>Configuration</TableHead>
                <TableHead>Statut</TableHead>
                {canManage ? <TableHead className="w-20 text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(catalogue.data ?? []).map((grille) => (
                <TableRow key={grille.id}>
                  <TableCell className="min-w-56">
                    <div className="font-medium">{grille.libelle}</div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{grille.description || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{grille.compagnieAssuranceLibelle}</div>
                    <div className="text-xs text-muted-foreground">{grille.compagnieAssuranceCode || "-"}</div>
                  </TableCell>
                  <TableCell className="max-w-72">
                    <ReferenceList values={grille.conventions.map((convention) => (
                      convention.code ? `${convention.code} - ${convention.libelle}` : convention.libelle
                    ))} empty="Non utilisée" />
                  </TableCell>
                  <TableCell className="max-w-72">
                    <ReferenceList values={grille.usages.map((usage) => (
                      usage.code ? `${usage.code} - ${usage.libelle}` : usage.libelle
                    ))} empty="Aucun usage configuré" />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{grille.nombreLignes} ligne(s)</div>
                    <div className="text-xs text-muted-foreground">{grille.nombreFormulesPersonne} formule(s) personne</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={grille.actif ? "default" : "secondary"}>{grille.actif ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <TableRowActions
                        label={`Actions ${grille.libelle}`}
                        actions={[
                          { label: "Configurer", icon: SlidersHorizontal, onSelect: () => setConfiguring(grille) },
                          { label: "Modifier", icon: Edit, onSelect: () => { setEditing(grille); setDialogOpen(true); } },
                        ]}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {!catalogue.isLoading && (catalogue.data?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="py-10 text-center text-muted-foreground">
                    Aucune grille ne correspond aux filtres.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      <GrilleTarifaireDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}
        grille={editing ? toReferenceOption(editing) : null}
        compagnies={compagnies.data ?? []}
        onSubmit={(payload) => saveGrid.mutate({ id: editing?.id, payload })}
        submitting={saveGrid.isPending}
      />

      <Sheet open={Boolean(configuring)} onOpenChange={(open) => { if (!open) setConfiguring(null); }}>
        <SheetContent side="right" className="w-[min(96vw,1180px)] overflow-y-auto sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Configurer la grille tarifaire</SheetTitle>
            <SheetDescription>{configuring?.libelle} · {configuring?.compagnieAssuranceLibelle}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {configuring ? (
              <GrilleTarifaireConfigurator
                grille={toReferenceOption(configuring)}
                garanties={garanties.data ?? []}
                usages={usages.data ?? []}
                categoriesTransport={categoriesTransport.data ?? []}
                queryScope={`catalogue-${configuring.id}`}
                onSaved={() => invalidateCatalogue(queryClient)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ReferenceList({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) {
    return <span className="text-sm text-muted-foreground">{empty}</span>;
  }
  return <span className="line-clamp-3 text-sm">{values.join(", ")}</span>;
}

function optionalFilter(value: string) {
  return value === ALL ? undefined : value;
}

function toReferenceOption(grille: GrilleTarifaireCatalogueItem): ReferenceOption {
  return {
    id: grille.id,
    libelle: grille.libelle,
    description: grille.description,
    actif: grille.actif,
    compagnieAssuranceId: grille.compagnieAssuranceId,
    compagnieAssuranceLibelle: grille.compagnieAssuranceLibelle,
  };
}

async function invalidateCatalogue(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: ["referentiel", "grilles-tarifaires"] });
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Grille tarifaire impossible à enregistrer");
}
