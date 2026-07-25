import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus } from "lucide-react";
import { toast } from "sonner";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { Field } from "../components/Field";
import { FormuleGarantiePersonneDialog } from "../components/FormuleGarantiePersonneDialog";
import { GrilleTarifaireDialog } from "../components/GrilleTarifaireDialog";
import { LigneGrilleTarifaireDialog } from "../components/LigneGrilleTarifaireDialog";
import { SectionCard } from "../components/SectionCard";
import { formuleGarantiePersonneSchema, grilleTarifaireSchema, ligneGrilleTarifaireSchema } from "../schemas";
import { money, text } from "../utils/format";
import type {
  ReferenceOption,
  UpsertFormuleGarantiePersonneRequest,
  UpsertGrilleTarifaireRequest,
  UpsertLigneGrilleTarifaireRequest,
} from "../types";
import type { ContratCreationFormState } from "./useContratCreationForm";

export function TariffGridSection({ form }: { form: ContratCreationFormState }) {
  const queryClient = useQueryClient();
  const [grilleDialogOpen, setGrilleDialogOpen] = useState(false);
  const [editingGrille, setEditingGrille] = useState<ReferenceOption | null>(null);
  const [ligneDialogOpen, setLigneDialogOpen] = useState(false);
  const [editingLigne, setEditingLigne] = useState<ReferenceOption | null>(null);
  const [formuleDialogOpen, setFormuleDialogOpen] = useState(false);
  const [editingFormule, setEditingFormule] = useState<ReferenceOption | null>(null);

  const filteredGrilles = (form.refs.grilles.data ?? []).filter(
    (grille) => !form.compagnieAssuranceId || grille.compagnieAssuranceId === form.compagnieAssuranceId
  );
  const selectedGrille = filteredGrilles.find((grille) => grille.id === form.grilleTarifaireId) ?? null;

  const lignes = useQuery({
    queryKey: ["lignes-grille-contrat", form.grilleTarifaireId],
    queryFn: () => productionApi.lignesGrille({ grilleId: form.grilleTarifaireId }),
    enabled: Boolean(form.grilleTarifaireId),
  });
  const formules = useQuery({
    queryKey: ["formules-garantie-personne-contrat", form.grilleTarifaireId],
    queryFn: () => productionApi.formulesGarantiePersonne({ grilleId: form.grilleTarifaireId }),
    enabled: Boolean(form.grilleTarifaireId),
  });

  const saveGrille = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertGrilleTarifaireRequest }) =>
      id ? productionApi.updateGrilleTarifaire(id, payload) : productionApi.createGrilleTarifaire(payload),
    onSuccess: async (grille) => {
      form.setGrilleTarifaireId(grille.id);
      setGrilleDialogOpen(false);
      setEditingGrille(null);
      await queryClient.invalidateQueries({ queryKey: ["referentiel", "grilles-tarifaires"] });
      toast.success("Grille tarifaire enregistrée");
    },
    onError: showError,
  });

  const saveLigne = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertLigneGrilleTarifaireRequest }) =>
      id
        ? productionApi.updateLigneGrilleTarifaire(id, payload)
        : productionApi.createLigneGrilleTarifaire(form.grilleTarifaireId, payload),
    onSuccess: async () => {
      setLigneDialogOpen(false);
      setEditingLigne(null);
      await queryClient.invalidateQueries({ queryKey: ["lignes-grille-contrat", form.grilleTarifaireId] });
      await queryClient.invalidateQueries({ queryKey: ["lignes-grille"] });
      toast.success("Ligne de grille enregistrée");
    },
    onError: showError,
  });

  const saveFormule = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertFormuleGarantiePersonneRequest }) =>
      id
        ? productionApi.updateFormuleGarantiePersonne(id, payload)
        : productionApi.createFormuleGarantiePersonne(form.grilleTarifaireId, payload),
    onSuccess: async () => {
      setFormuleDialogOpen(false);
      setEditingFormule(null);
      await queryClient.invalidateQueries({ queryKey: ["formules-garantie-personne-contrat", form.grilleTarifaireId] });
      await queryClient.invalidateQueries({ queryKey: ["formules-garantie-personne"] });
      toast.success("Formule personne enregistrée");
    },
    onError: showError,
  });

  return (
    <SectionCard
      title="Grille tarifaire"
      badge={selectedGrille ? selectedGrille.libelle : "Obligatoire"}
      tone="production"
      action={
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              if (!form.compagnieAssuranceId) {
                toast.error("Choisissez une compagnie dans la section contrat avant de créer une grille");
                return;
              }
              setEditingGrille(selectedGrille);
              setGrilleDialogOpen(true);
            }}
          >
            {selectedGrille ? <Edit className="size-4" /> : <Plus className="size-4" />}
            {selectedGrille ? "Modifier grille" : "Créer grille"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!form.grilleTarifaireId}
            onClick={() => {
              setEditingLigne(null);
              setLigneDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Ligne
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!form.grilleTarifaireId}
            onClick={() => {
              setEditingFormule(null);
              setFormuleDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Formule personne
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-[minmax(260px,420px)_1fr]">
          <Field label="Grille tarifaire" required>
            <AutocompleteSelect
              value={form.grilleTarifaireId}
              onValueChange={form.setGrilleTarifaireId}
              options={filteredGrilles.map((grille) => ({
                value: grille.id,
                label: grille.libelle,
                keywords: [grille.code, grille.compagnieAssuranceLibelle, grille.description].filter(Boolean).join(" "),
              }))}
              placeholder="Sélectionner une grille"
              emptyText="Aucune grille pour cette compagnie"
              invalidText="Sélectionnez une grille existante ou créez-en une."
            />
          </Field>
          <div className="flex items-end text-sm text-muted-foreground">
            {selectedGrille ? (
              <div className="flex flex-wrap items-center gap-2">
                {selectedGrille.compagnieAssuranceLibelle ? <Badge variant="outline">{selectedGrille.compagnieAssuranceLibelle}</Badge> : null}
                {selectedGrille.description ? <span>{selectedGrille.description}</span> : <span>Modèle tarifaire sélectionné pour ce contrat flotte.</span>}
              </div>
            ) : (
              <span>Choisissez une grille existante ou créez une grille avant de renseigner les garanties.</span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <div className="border-b px-3 py-2 text-sm font-semibold">Garanties véhicule</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Garantie</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Prime</TableHead>
                <TableHead>Capital</TableHead>
                <TableHead>Taux</TableHead>
                <TableHead>Franchise</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!form.grilleTarifaireId ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Aucune grille sélectionnée.
                  </TableCell>
                </TableRow>
              ) : (lignes.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Cette grille ne contient pas encore de lignes tarifaires.
                  </TableCell>
                </TableRow>
              ) : (
                (lignes.data ?? []).map((ligne) => (
                  <TableRow key={ligne.id}>
                    <TableCell className="font-medium">{labelFromRefs(ligne, form.refs.garanties.data ?? [], "garantie")}</TableCell>
                    <TableCell>{labelFromRefs(ligne, form.refs.usages.data ?? [], "usage")}</TableCell>
                    <TableCell>{labelFromRefs(ligne, form.refs.categoriesTransport.data ?? [], "categorieTransport")}</TableCell>
                    <TableCell>{modeLabel(text(ligne.modeTarification))}</TableCell>
                    <TableCell>{money(ligne.prime)}</TableCell>
                    <TableCell>{money(ligne.capital)}</TableCell>
                    <TableCell>{money(ligne.taux)}</TableCell>
                    <TableCell>{franchise(ligne)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
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
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <div className="border-b px-3 py-2 text-sm font-semibold">Garanties personne</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Garantie</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Formule</TableHead>
                <TableHead>Décès</TableHead>
                <TableHead>Invalidité</TableHead>
                <TableHead>Frais médicaux</TableHead>
                <TableHead>Prime nette</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!form.grilleTarifaireId ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Aucune grille sélectionnée.
                  </TableCell>
                </TableRow>
              ) : (formules.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Aucune formule personne. Activez "garanties personne" sur les usages concernés puis ajoutez PP/PC.
                  </TableCell>
                </TableRow>
              ) : (
                (formules.data ?? []).map((formule) => (
                  <TableRow key={formule.id}>
                    <TableCell className="font-medium">{text(formule.garantieCode)} - {text(formule.garantieLibelle)}</TableCell>
                    <TableCell>{text(formule.usageCode) !== "-" ? `${text(formule.usageCode)} - ${text(formule.usageLibelle)}` : "Tous usages autorisés"}</TableCell>
                    <TableCell>{formule.libelle}</TableCell>
                    <TableCell>{money(formule.montantDeces)}</TableCell>
                    <TableCell>{money(formule.montantInvalidite)}</TableCell>
                    <TableCell>{money(formule.montantFraisMedicaux)}</TableCell>
                    <TableCell>{money(formule.primeNette)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingFormule(formule);
                          setFormuleDialogOpen(true);
                        }}
                      >
                        <Edit className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <GrilleTarifaireDialog
        open={grilleDialogOpen}
        onOpenChange={setGrilleDialogOpen}
        grille={editingGrille}
        defaultCompagnieAssuranceId={form.compagnieAssuranceId}
        hideCompagnie
        compagnies={form.refs.compagnies.data ?? []}
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
        garanties={form.refs.garanties.data ?? []}
        usages={form.refs.usages.data ?? []}
        categoriesTransport={form.refs.categoriesTransport.data ?? []}
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

      <FormuleGarantiePersonneDialog
        open={formuleDialogOpen}
        onOpenChange={setFormuleDialogOpen}
        formule={editingFormule}
        garanties={form.refs.garanties.data ?? []}
        usages={(form.refs.usages.data ?? []).filter((usage) => Boolean(usage.garantiesPersonne))}
        submitting={saveFormule.isPending}
        onSubmit={(payload) => {
          const parsed = formuleGarantiePersonneSchema.safeParse(payload);
          if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
            return;
          }
          saveFormule.mutate({ id: editingFormule?.id, payload });
        }}
      />
    </SectionCard>
  );
}

function labelFromRefs(ligne: ReferenceOption, refs: ReferenceOption[], key: "garantie" | "usage" | "categorieTransport") {
  const direct = text(ligne[`${key}Libelle`]);
  if (direct !== "-") {
    return direct;
  }
  const id = text(ligne[`${key}Id`]);
  return refs.find((item) => item.id === id)?.libelle ?? "-";
}

function franchise(ligne: ReferenceOption) {
  const taux = text(ligne.tauxFranchise);
  const min = text(ligne.franchiseMinimale);
  if (taux === "-" && min === "-") {
    return "-";
  }
  return `${taux !== "-" ? `${taux}%` : "-"} / ${min}`;
}

function modeLabel(mode: string) {
  const labels: Record<string, string> = {
    TAUX: "Taux",
    CAPITAL: "Capital",
    PRIME_FIXE: "Prime fixe",
    PROTECTION: "Protection",
  };
  return labels[mode] ?? mode;
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
