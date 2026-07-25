import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Save } from "lucide-react";
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
  const [selectedUsageId, setSelectedUsageId] = useState("");

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
  const usageTabs = useMemo(() => {
    const usageIds = new Set<string>();
    for (const ligne of lignes.data ?? []) {
      if (ligne.usageId) usageIds.add(String(ligne.usageId));
    }
    for (const formule of formules.data ?? []) {
      if (formule.usageId) usageIds.add(String(formule.usageId));
    }
    const usages = form.refs.usages.data ?? [];
    return usages.filter((usage) => usageIds.has(usage.id));
  }, [form.refs.usages.data, formules.data, lignes.data]);
  const activeUsageId = selectedUsageId || usageTabs[0]?.id || "";
  const activeUsage = usageTabs.find((usage) => usage.id === activeUsageId) ?? null;
  const visibleLignes = (lignes.data ?? []).filter(
    (ligne) => !activeUsageId || !ligne.usageId || String(ligne.usageId) === activeUsageId
  );
  const tauxLignes = visibleLignes.filter(isTauxLine);
  const capitalLignes = visibleLignes.filter((ligne) => !isTauxLine(ligne));
  const visibleFormules = (formules.data ?? []).filter(
    (formule) => !activeUsageId || !formule.usageId || String(formule.usageId) === activeUsageId
  );

  useEffect(() => {
    if (selectedUsageId && usageTabs.some((usage) => usage.id === selectedUsageId)) {
      return;
    }
    setSelectedUsageId(usageTabs[0]?.id ?? "");
  }, [selectedUsageId, usageTabs]);

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
      badge={form.savedSections.grille ? "Validé" : selectedGrille ? selectedGrille.libelle : "Obligatoire"}
      tone="production"
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
            {form.validationErrors.grilleTarifaireId ? <span className="text-xs text-red-600">{form.validationErrors.grilleTarifaireId}</span> : null}
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
          <Button type="button" size="sm" onClick={() => form.handleSaveSection("grille")}>
            <Save className="size-4" />
            Enregistrer
          </Button>
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

        {form.grilleTarifaireId ? (
          <div className="flex flex-wrap items-center gap-2">
            {usageTabs.map((usage) => {
              const active = usage.id === activeUsageId;
              return (
                <Button
                  key={usage.id}
                  type="button"
                  variant={active ? "default" : "outline"}
                  className={active ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}
                  onClick={() => setSelectedUsageId(usage.id)}
                >
                  {usage.code ? `Usage ${usage.code}` : usage.libelle}
                </Button>
              );
            })}
            <Button
              type="button"
              size="icon"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                setEditingLigne(null);
                setLigneDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        ) : null}

        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="text-sm font-semibold text-blue-600">Garanties véhicule</div>
            {activeUsage ? <Badge variant="outline">{activeUsage.code ? `Usage ${activeUsage.code}` : activeUsage.libelle}</Badge> : null}
          </div>
          <div className="grid gap-4 p-3 xl:grid-cols-[minmax(420px,1fr)_minmax(520px,1fr)]">
            <TauxLinesTable
              lines={tauxLignes}
              emptyText={!form.grilleTarifaireId ? "Aucune grille sélectionnée." : "Aucune garantie par taux pour cet usage."}
              onEdit={(ligne) => {
                setEditingLigne(ligne);
                setLigneDialogOpen(true);
              }}
            />
            <CapitalLinesTable
              lines={capitalLignes}
              emptyText={!form.grilleTarifaireId ? "Aucune grille sélectionnée." : "Aucune garantie par capital ou prime pour cet usage."}
              onEdit={(ligne) => {
                setEditingLigne(ligne);
                setLigneDialogOpen(true);
              }}
            />
          </div>
        </div>

        <PersonnesLinesTable
          formules={visibleFormules}
          emptyText={!form.grilleTarifaireId ? "Aucune grille sélectionnée." : "Aucune formule personne pour cet usage."}
          canAdd={Boolean(form.grilleTarifaireId)}
          onAdd={() => {
            setEditingFormule(null);
            setFormuleDialogOpen(true);
          }}
          onEdit={(formule) => {
            setEditingFormule(formule);
            setFormuleDialogOpen(true);
          }}
        />
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

function TauxLinesTable({
  lines,
  emptyText,
  onEdit,
}: {
  lines: ReferenceOption[];
  emptyText: string;
  onEdit: (ligne: ReferenceOption) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Garantie</TableHead>
            <TableHead className="text-right">Taux de valeur</TableHead>
            <TableHead className="text-right">Franchise taux</TableHead>
            <TableHead className="text-right">Franchise minimum</TableHead>
            <TableHead className="w-12 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            lines.map((ligne) => (
              <TableRow key={ligne.id}>
                <TableCell className="font-semibold">{lineLabel(ligne)}</TableCell>
                <TableCell className="text-right">{percentValue(ligne.taux)}</TableCell>
                <TableCell className="text-right">{percentValue(ligne.tauxFranchise)}</TableCell>
                <TableCell className="text-right">{money(ligne.franchiseMinimale)}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(ligne)}>
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CapitalLinesTable({
  lines,
  emptyText,
  onEdit,
}: {
  lines: ReferenceOption[];
  emptyText: string;
  onEdit: (ligne: ReferenceOption) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Garantie</TableHead>
            <TableHead className="text-right">Capital</TableHead>
            <TableHead className="text-right">Prime</TableHead>
            <TableHead className="text-right">Franchise taux</TableHead>
            <TableHead className="text-right">Franchise minimum</TableHead>
            <TableHead className="w-12 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            lines.map((ligne) => (
              <TableRow key={ligne.id}>
                <TableCell className="font-semibold">{lineLabel(ligne)}</TableCell>
                <TableCell className="text-right">{money(ligne.capital)}</TableCell>
                <TableCell className="text-right">{money(ligne.prime)}</TableCell>
                <TableCell className="text-right">{percentValue(ligne.tauxFranchise)}</TableCell>
                <TableCell className="text-right">{money(ligne.franchiseMinimale)}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(ligne)}>
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function PersonnesLinesTable({
  formules,
  emptyText,
  canAdd,
  onAdd,
  onEdit,
}: {
  formules: ReferenceOption[];
  emptyText: string;
  canAdd: boolean;
  onAdd: () => void;
  onEdit: (formule: ReferenceOption) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div className="text-sm font-semibold text-blue-600">Garanties personnes</div>
        <Button type="button" size="sm" variant="outline" disabled={!canAdd} onClick={onAdd}>
          <Plus className="size-4" />
          Ajouter formule
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Garantie</TableHead>
            <TableHead>Formule</TableHead>
            <TableHead className="text-right">Décès</TableHead>
            <TableHead className="text-right">Invalidité</TableHead>
            <TableHead className="text-right">Frais médicaux</TableHead>
            <TableHead className="text-right">Frais hospitalisation</TableHead>
            <TableHead className="text-right">Frais funéraires</TableHead>
            <TableHead className="text-right">Frais chirurgie</TableHead>
            <TableHead className="text-right">Prime</TableHead>
            <TableHead className="text-right">Accessoire</TableHead>
            <TableHead className="w-12 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {formules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            formules.map((formule) => (
              <TableRow key={formule.id}>
                <TableCell className="font-semibold">{text(formule.garantieCode)}</TableCell>
                <TableCell>{formule.libelle}</TableCell>
                <TableCell className="text-right">{money(formule.montantDeces)}</TableCell>
                <TableCell className="text-right">{money(formule.montantInvalidite)}</TableCell>
                <TableCell className="text-right">{money(formule.montantFraisMedicaux)}</TableCell>
                <TableCell className="text-right">{money(formule.montantFraisHospitalisation)}</TableCell>
                <TableCell className="text-right">{money(formule.montantFraisFuneraires)}</TableCell>
                <TableCell className="text-right">{money(formule.montantFraisChirurgie)}</TableCell>
                <TableCell className="text-right">{money(formule.primeNette)}</TableCell>
                <TableCell className="text-right">{money(formule.accessoire)}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(formule)}>
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function isTauxLine(ligne: ReferenceOption) {
  const mode = text(ligne.modeTarification);
  return mode === "TAUX" || (mode === "-" && text(ligne.taux) !== "-");
}

function lineLabel(ligne: ReferenceOption) {
  const code = text(ligne.garantieCode);
  if (code !== "-") {
    return code;
  }
  return text(ligne.libelle);
}

function percentValue(value: unknown) {
  const rendered = money(value);
  return rendered === "-" ? "-" : rendered;
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
