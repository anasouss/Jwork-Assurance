import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus } from "lucide-react";
import { toast } from "sonner";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { productionApi } from "../api";
import { Field } from "../components/Field";
import { GrilleTarifaireConfigurator } from "../components/GrilleTarifaireConfigurator";
import { GrilleTarifaireDialog } from "../components/GrilleTarifaireDialog";
import { SectionCard } from "../components/SectionCard";
import { grilleTarifaireSchema } from "../schemas";
import type { ReferenceOption, UpsertGrilleTarifaireRequest } from "../types";
import type { ContratCreationFormState, ContratSectionKey } from "./useContratCreationForm";

export function TariffGridSection({
  form,
  openSection,
  onSectionOpenChange,
}: {
  form: ContratCreationFormState;
  openSection?: ContratSectionKey;
  onSectionOpenChange?: (section: ContratSectionKey, open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [grilleDialogOpen, setGrilleDialogOpen] = useState(false);
  const [editingGrille, setEditingGrille] = useState<ReferenceOption | null>(null);

  const filteredGrilles = (form.refs.grilles.data ?? []).filter(
    (grille) => !form.compagnieAssuranceId || grille.compagnieAssuranceId === form.compagnieAssuranceId
  );
  const selectedGrille = filteredGrilles.find((grille) => grille.id === form.grilleTarifaireId) ?? null;
  const usageOptions = form.availableUsages.length > 0 ? form.availableUsages : form.refs.usages.data ?? [];
  const allowedUsageIds = usageOptions.map((usage) => usage.id);

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

  return (
    <SectionCard
      title="Grille tarifaire"
      badge={form.savedSections.grille ? "Validé" : selectedGrille ? selectedGrille.libelle : "Obligatoire"}
      tone="production"
      open={openSection === "grille"}
      onOpenChange={(open) => onSectionOpenChange?.("grille", open)}
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
            {form.validationErrors.grilleTarifaireId ? (
              <span className="text-xs text-red-600">{form.validationErrors.grilleTarifaireId}</span>
            ) : null}
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

        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
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
        </div>

        {selectedGrille ? (
          <GrilleTarifaireConfigurator
            grille={selectedGrille}
            garanties={form.refs.garanties.data ?? []}
            usages={usageOptions}
            categoriesTransport={form.refs.categoriesTransport.data ?? []}
            allowedUsageIds={allowedUsageIds}
            queryScope={`flotte-${form.draftId ?? selectedGrille.id}`}
          />
        ) : (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Sélectionnez ou créez une grille pour configurer les garanties véhicule et personnes par usage.
          </div>
        )}
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
    </SectionCard>
  );
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
