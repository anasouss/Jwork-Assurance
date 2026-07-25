import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { grilleTarifaireSchema, ligneGrilleTarifaireSchema, transportCategorySchema } from "../schemas";
import { GrilleTarifaireDialog } from "../components/GrilleTarifaireDialog";
import { LigneGrilleTarifaireDialog } from "../components/LigneGrilleTarifaireDialog";
import type { ReferenceOption, UpsertGrilleTarifaireRequest, UpsertLigneGrilleTarifaireRequest } from "../types";

export default function ProductionSettingsPage() {
  const queryClient = useQueryClient();
  const categories = useReference("categories-transport");
  const compagnies = useReference("compagnies-assurance");
  const grilles = useReference("grilles-tarifaires");
  const garanties = useReference("garanties");
  const usages = useReference("usages");
  const [selectedGrilleId, setSelectedGrilleId] = useState("");
  const selectedGrille = grilles.data?.find((grille) => grille.id === selectedGrilleId) ?? null;
  const lignes = useQuery({
    queryKey: ["lignes-grille-settings", selectedGrilleId],
    queryFn: () => productionApi.lignesGrille({ grilleId: selectedGrilleId }),
    enabled: Boolean(selectedGrilleId),
  });

  const [code, setCode] = useState("");
  const [libelle, setLibelle] = useState("");
  const [description, setDescription] = useState("");
  const [grilleDialogOpen, setGrilleDialogOpen] = useState(false);
  const [editingGrille, setEditingGrille] = useState<ReferenceOption | null>(null);
  const [ligneDialogOpen, setLigneDialogOpen] = useState(false);
  const [editingLigne, setEditingLigne] = useState<ReferenceOption | null>(null);

  const createCategorie = useMutation({
    mutationFn: productionApi.createCategorieTransport,
    onSuccess: async () => {
      setCode("");
      setLibelle("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "categories-transport"] });
      toast.success("Catégorie transport créée");
    },
    onError: showError,
  });

  const saveGrille = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertGrilleTarifaireRequest }) =>
      id ? productionApi.updateGrilleTarifaire(id, payload) : productionApi.createGrilleTarifaire(payload),
    onSuccess: async (grille) => {
      setGrilleDialogOpen(false);
      setEditingGrille(null);
      setSelectedGrilleId(grille.id);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "grilles-tarifaires"] });
      toast.success("Grille tarifaire enregistrée");
    },
    onError: showError,
  });

  const saveLigne = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertLigneGrilleTarifaireRequest }) =>
      id
        ? productionApi.updateLigneGrilleTarifaire(id, payload)
        : productionApi.createLigneGrilleTarifaire(selectedGrilleId, payload),
    onSuccess: async () => {
      setLigneDialogOpen(false);
      setEditingLigne(null);
      await queryClient.invalidateQueries({ queryKey: ["lignes-grille-settings", selectedGrilleId] });
      toast.success("Ligne de grille enregistrée");
    },
    onError: showError,
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Paramètres production</h1>
        <p className="text-sm text-muted-foreground">Paramétrage réutilisable des catégories, grilles et lignes tarifaires.</p>
      </div>

      <Tabs defaultValue="grilles">
        <TabsList>
          <TabsTrigger value="grilles">Grilles tarifaires</TabsTrigger>
          <TabsTrigger value="transport">Catégories transport</TabsTrigger>
        </TabsList>

        <TabsContent value="grilles" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Card className="border-border/70 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Grilles</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingGrille(null);
                    setGrilleDialogOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Ajouter
                </Button>
              </CardHeader>
              <CardContent className="grid gap-2">
                {(grilles.data ?? []).map((grille) => (
                  <button
                    key={grille.id}
                    type="button"
                    className={`rounded-lg border p-3 text-left text-sm hover:bg-muted/50 ${selectedGrilleId === grille.id ? "border-primary bg-muted" : ""}`}
                    onClick={() => setSelectedGrilleId(grille.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{grille.libelle}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingGrille(grille);
                          setGrilleDialogOpen(true);
                        }}
                      >
                        <Edit className="size-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">{grille.compagnieAssuranceLibelle ?? grille.code}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  {selectedGrille ? `Lignes - ${selectedGrille.libelle}` : "Lignes de grille"}
                </CardTitle>
                <Button
                  size="sm"
                  disabled={!selectedGrilleId}
                  onClick={() => {
                    setEditingLigne(null);
                    setLigneDialogOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Ligne
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Option</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Prime</TableHead>
                      <TableHead>Capital</TableHead>
                      <TableHead>Taux</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(lignes.data ?? []).map((ligne) => (
                      <TableRow key={ligne.id}>
                        <TableCell>{ligne.libelle}</TableCell>
                        <TableCell>{String(ligne.modeTarification ?? "-")}</TableCell>
                        <TableCell>{String(ligne.prime ?? "-")}</TableCell>
                        <TableCell>{String(ligne.capital ?? "-")}</TableCell>
                        <TableCell>{String(ligne.taux ?? "-")}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingLigne(ligne);
                              setLigneDialogOpen(true);
                            }}
                          >
                            <Edit className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transport" className="mt-4">
          <Card className="border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Catégories transport</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[160px_1fr_1fr_auto]">
                <Input placeholder="Code" value={code} onChange={(event) => setCode(event.target.value)} />
                <Input placeholder="Libellé" value={libelle} onChange={(event) => setLibelle(event.target.value)} />
                <Input placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
                <Button
                  onClick={() => {
                    const payload = { code, libelle, description };
                    const parsed = transportCategorySchema.safeParse(payload);
                    if (!parsed.success) {
                      toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
                      return;
                    }
                    createCategorie.mutate(payload);
                  }}
                >
                  <Plus className="size-4" />
                  Ajouter
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(categories.data ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.code}</TableCell>
                      <TableCell>{item.libelle}</TableCell>
                      <TableCell>{item.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <GrilleTarifaireDialog
        open={grilleDialogOpen}
        onOpenChange={setGrilleDialogOpen}
        grille={editingGrille}
        compagnies={compagnies.data ?? []}
        submitting={saveGrille.isPending}
        onSubmit={(payload) => {
          const parsed = grilleTarifaireSchema.safeParse(payload);
          if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
            return;
          }
          saveGrille.mutate({ id: editingGrille?.id, payload });
        }}
      />

      <LigneGrilleTarifaireDialog
        open={ligneDialogOpen}
        onOpenChange={setLigneDialogOpen}
        ligne={editingLigne}
        garanties={garanties.data ?? []}
        usages={usages.data ?? []}
        categoriesTransport={categories.data ?? []}
        submitting={saveLigne.isPending}
        onSubmit={(payload) => {
          const parsed = ligneGrilleTarifaireSchema.safeParse(payload);
          if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
            return;
          }
          saveLigne.mutate({ id: editingLigne?.id, payload });
        }}
      />
    </div>
  );
}

function useReference(path: string) {
  return useQuery({
    queryKey: ["referentiel", path],
    queryFn: () => productionApi.referentiel(path),
    staleTime: 60_000,
  });
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
