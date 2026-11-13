import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, Plus, Search, Wrench, UserRoundSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableRowsSkeleton } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { referenceApi } from "@/features/production/api/references";
import { sinistreApi, sinistreKeys } from "../api";
import {
  SinistreIntervenantDialog,
  type IntervenantKind,
} from "../components/SinistreIntervenantDialog";
import type { Intervenant } from "../types";

export default function SinistreIntervenantsPage({ kind }: { kind: IntervenantKind }) {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Intervenant | null>(null);
  const directory = useQuery({
    queryKey: kind === "EXPERT" ? sinistreKeys.experts(includeInactive) : sinistreKeys.garages(includeInactive),
    queryFn: () => kind === "EXPERT" ? sinistreApi.experts(includeInactive) : sinistreApi.garages(includeInactive),
  });
  const cities = useQuery({
    queryKey: ["referentiel", "villes", "sinistre"],
    queryFn: () => referenceApi.list("villes"),
    staleTime: 60_000,
  });
  const save = useMutation({
    mutationFn: (request: object) =>
      kind === "EXPERT"
        ? sinistreApi.saveExpert(editing?.id ?? null, request)
        : sinistreApi.saveGarage(editing?.id ?? null, request),
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({
        queryKey:
          kind === "EXPERT"
            ? [...sinistreKeys.all, "experts"]
            : [...sinistreKeys.all, "garages"],
      });
      toast.success(
        kind === "EXPERT" ? "Expert enregistré" : "Garage enregistré",
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible",
      ),
  });

  const filter = (items: Intervenant[]) => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    if (!normalized) return items;
    return items.filter((item) =>
      [item.code, item.nom, item.telephone, item.email, item.ville]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("fr").includes(normalized)),
    );
  };
  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (item: Intervenant) => {
    setEditing(item);
    setDialogOpen(true);
  };

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">Sinistres</p>
          <h1 className="text-xl font-semibold">{kind === "EXPERT" ? "Experts" : "Garages"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/app/sinistre"><ArrowLeft className="size-4" />Module sinistres</Link></Button>
          <Button disabled={save.isPending} onClick={openCreate}><Plus className="size-4" />{kind === "EXPERT" ? "Ajouter un expert" : "Ajouter un garage"}</Button>
        </div>
      </header>
      <section aria-label="Filtres" className="flex flex-col gap-3 border-y bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              className="pl-9"
              placeholder="Code, nom, ville, téléphone ou e-mail"
              aria-label={kind === "EXPERT" ? "Rechercher un expert" : "Rechercher un garage"}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            Inclure les inactifs
            <Switch
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
          </label>
      </section>
      {directory.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
        <span>{directory.error instanceof Error ? directory.error.message : "Chargement du répertoire impossible."}</span>
        <Button variant="outline" disabled={directory.isFetching} onClick={() => directory.refetch()}>Réessayer</Button>
      </div> : null}
      <IntervenantTable kind={kind} items={filter(directory.data ?? [])} loading={directory.isPending}
        error={directory.isError} saving={save.isPending} onEdit={openEdit} />
      <SinistreIntervenantDialog
        open={dialogOpen}
        kind={kind}
        intervenant={editing}
        cities={cities.data ?? []}
        saving={save.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setEditing(null);
          }
        }}
        onSubmit={(request) => {
          if (dialogOpen && !save.isPending) save.mutate(request);
        }}
      />
    </div>
  );
}

function IntervenantTable({
  kind,
  items,
  loading,
  error,
  saving,
  onEdit,
}: {
  kind: IntervenantKind;
  items: Intervenant[];
  loading: boolean;
  error: boolean;
  saving: boolean;
  onEdit: (item: Intervenant) => void;
}) {
  const Icon = kind === "EXPERT" ? UserRoundSearch : Wrench;
  const columnCount = kind === "GARAGE" ? 7 : 6;
  return (
    <section aria-label={kind === "EXPERT" ? "Liste des experts" : "Liste des garages"} className="min-w-0 border">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-sky-700 [&_th]:text-white">
              <TableRow className="hover:bg-sky-700">
                <TableHead>Code</TableHead>
                <TableHead>{kind === "EXPERT" ? "Expert" : "Garage"}</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Adresse</TableHead>
                {kind === "GARAGE" ? <TableHead>Convention</TableHead> : null}
                <TableHead>Statut</TableHead>
                <TableHead className="w-20 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRowsSkeleton rows={5} colSpan={columnCount} /> : null}
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.code}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal font-medium">{item.nom}</TableCell>
                  <TableCell>
                    <div>{item.telephone || "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.email || "-"}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {[item.adresse, item.ville].filter(Boolean).join(", ") ||
                      "-"}
                  </TableCell>
                  {kind === "GARAGE" ? <TableCell><Badge variant="outline" className={item.conventionne ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200" : "text-muted-foreground"}>{item.conventionne ? "Conventionné" : "Non conventionné"}</Badge></TableCell> : null}
                  <TableCell>
                    <Badge variant="outline" className={item.actif ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "text-muted-foreground"}>
                      {item.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${kind === "EXPERT" ? "Modifier l’expert" : "Modifier le garage"} ${item.nom}`}
                      title={kind === "EXPERT" ? "Modifier l’expert" : "Modifier le garage"}
                      disabled={saving}
                      onClick={() => onEdit(item)}
                    >
                      <Edit className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !error && items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="py-10 text-center text-muted-foreground"
                  >
                    <Icon className="mx-auto mb-2 size-5" /> {kind === "EXPERT" ? "Aucun expert ne correspond aux critères." : "Aucun garage ne correspond aux critères."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
    </section>
  );
}
