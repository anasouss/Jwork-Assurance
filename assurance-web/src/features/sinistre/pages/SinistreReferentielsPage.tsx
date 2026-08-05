import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Search, Wrench, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { referenceApi } from "@/features/production/api/references";
import { sinistreApi, sinistreKeys } from "../api";
import {
  SinistreIntervenantDialog,
  type IntervenantKind,
} from "../components/SinistreIntervenantDialog";
import type { Intervenant } from "../types";

export default function SinistreReferentielsPage() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [query, setQuery] = useState("");
  const [dialogKind, setDialogKind] = useState<IntervenantKind | null>(null);
  const [editing, setEditing] = useState<Intervenant | null>(null);
  const experts = useQuery({
    queryKey: sinistreKeys.experts(includeInactive),
    queryFn: () => sinistreApi.experts(includeInactive),
  });
  const garages = useQuery({
    queryKey: sinistreKeys.garages(includeInactive),
    queryFn: () => sinistreApi.garages(includeInactive),
  });
  const cities = useQuery({
    queryKey: ["referentiel", "villes", "sinistre"],
    queryFn: () => referenceApi.list("villes"),
    staleTime: 60_000,
  });
  const save = useMutation({
    mutationFn: ({
      kind,
      request,
    }: {
      kind: IntervenantKind;
      request: object;
    }) =>
      kind === "EXPERT"
        ? sinistreApi.saveExpert(editing?.id ?? null, request)
        : sinistreApi.saveGarage(editing?.id ?? null, request),
    onSuccess: async (_, variables) => {
      setDialogKind(null);
      setEditing(null);
      await queryClient.invalidateQueries({
        queryKey:
          variables.kind === "EXPERT"
            ? [...sinistreKeys.all, "experts"]
            : [...sinistreKeys.all, "garages"],
      });
      toast.success(
        variables.kind === "EXPERT" ? "Expert enregistré" : "Garage enregistré",
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
  const openCreate = (kind: IntervenantKind) => {
    setEditing(null);
    setDialogKind(kind);
  };
  const openEdit = (kind: IntervenantKind, item: Intervenant) => {
    setEditing(item);
    setDialogKind(kind);
  };

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">
          Sinistres
        </p>
        <h1 className="text-xl font-semibold">Experts et garages</h1>
        <p className="text-sm text-muted-foreground">
          Intervenants disponibles pour les missions d’expertise de l’agence.
        </p>
      </div>
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              className="pl-9"
              placeholder="Code, nom, ville, téléphone ou e-mail"
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
        </CardContent>
      </Card>
      <Tabs defaultValue="experts" className="grid gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="experts">Experts</TabsTrigger>
          <TabsTrigger value="garages">Garages</TabsTrigger>
        </TabsList>
        <TabsContent value="experts">
          <IntervenantTable
            kind="EXPERT"
            items={filter(experts.data ?? [])}
            loading={experts.isLoading}
            onCreate={() => openCreate("EXPERT")}
            onEdit={(item) => openEdit("EXPERT", item)}
          />
        </TabsContent>
        <TabsContent value="garages">
          <IntervenantTable
            kind="GARAGE"
            items={filter(garages.data ?? [])}
            loading={garages.isLoading}
            onCreate={() => openCreate("GARAGE")}
            onEdit={(item) => openEdit("GARAGE", item)}
          />
        </TabsContent>
      </Tabs>
      <SinistreIntervenantDialog
        open={dialogKind !== null}
        kind={dialogKind ?? "EXPERT"}
        intervenant={editing}
        cities={cities.data ?? []}
        saving={save.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDialogKind(null);
            setEditing(null);
          }
        }}
        onSubmit={(request) => {
          if (dialogKind) save.mutate({ kind: dialogKind, request });
        }}
      />
    </div>
  );
}

function IntervenantTable({
  kind,
  items,
  loading,
  onCreate,
  onEdit,
}: {
  kind: IntervenantKind;
  items: Intervenant[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (item: Intervenant) => void;
}) {
  const Icon = kind === "EXPERT" ? UserRoundSearch : Wrench;
  return (
    <Card className="shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">
            {kind === "EXPERT" ? "Experts" : "Garages"}
          </h2>
          <Button size="sm" onClick={onCreate}>
            <Plus className="size-4" /> Ajouter
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>{kind === "EXPERT" ? "Expert" : "Garage"}</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-20 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.code}</TableCell>
                  <TableCell>{item.nom}</TableCell>
                  <TableCell>
                    <div>{item.telephone || "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.email || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {[item.adresse, item.ville].filter(Boolean).join(", ") ||
                      "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.actif ? "default" : "outline"}>
                      {item.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Modifier"
                      onClick={() => onEdit(item)}
                    >
                      <Edit className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    <Icon className="mx-auto mb-2 size-5" /> Aucun intervenant.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
