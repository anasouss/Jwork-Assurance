import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { formuleGarantiePersonneSchema, ligneGrilleTarifaireSchema } from "../schemas";
import { money, text } from "../utils/format";
import { FormuleGarantiePersonneDialog } from "./FormuleGarantiePersonneDialog";
import { LigneGrilleTarifaireDialog } from "./LigneGrilleTarifaireDialog";
import type { ReferenceOption, UpsertFormuleGarantiePersonneRequest, UpsertLigneGrilleTarifaireRequest } from "../types";

type Props = {
  grille: ReferenceOption;
  garanties: ReferenceOption[];
  usages: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  allowedUsageIds?: string[];
  queryScope?: string;
};

export function GrilleTarifaireConfigurator({
  grille,
  garanties,
  usages,
  categoriesTransport,
  allowedUsageIds,
  queryScope = "grille-config",
}: Props) {
  const queryClient = useQueryClient();
  const [selectedUsageId, setSelectedUsageId] = useState("");
  const [ligneDialogOpen, setLigneDialogOpen] = useState(false);
  const [editingLigne, setEditingLigne] = useState<ReferenceOption | null>(null);
  const [formuleDialogOpen, setFormuleDialogOpen] = useState(false);
  const [editingFormule, setEditingFormule] = useState<ReferenceOption | null>(null);

  const lignes = useQuery({
    queryKey: ["lignes-grille", queryScope, grille.id],
    queryFn: () => productionApi.lignesGrille({ grilleId: grille.id }),
    enabled: Boolean(grille.id),
  });

  const formules = useQuery({
    queryKey: ["formules-garantie-personne", queryScope, grille.id],
    queryFn: () => productionApi.formulesGarantiePersonne({ grilleId: grille.id }),
    enabled: Boolean(grille.id),
  });

  const allowedUsageSet = useMemo(
    () => (allowedUsageIds?.length ? new Set(allowedUsageIds) : null),
    [allowedUsageIds]
  );

  const usageTabs = useMemo(() => {
    if (allowedUsageSet) {
      return usages.filter((usage) => allowedUsageSet.has(usage.id));
    }
    const usageIds = new Set<string>();
    for (const ligne of lignes.data ?? []) {
      if (ligne.usageId) usageIds.add(String(ligne.usageId));
    }
    for (const formule of formules.data ?? []) {
      if (formule.usageId) usageIds.add(String(formule.usageId));
    }
    return usages.filter((usage) => usageIds.has(usage.id));
  }, [allowedUsageSet, formules.data, lignes.data, usages]);

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

  const saveLigne = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertLigneGrilleTarifaireRequest }) =>
      id ? productionApi.updateLigneGrilleTarifaire(id, payload) : productionApi.createLigneGrilleTarifaire(grille.id, payload),
    onSuccess: async () => {
      setLigneDialogOpen(false);
      setEditingLigne(null);
      await queryClient.invalidateQueries({ queryKey: ["lignes-grille"] });
      toast.success("Ligne de grille enregistrée");
    },
    onError: showError,
  });

  const saveFormule = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertFormuleGarantiePersonneRequest }) =>
      id ? productionApi.updateFormuleGarantiePersonne(id, payload) : productionApi.createFormuleGarantiePersonne(grille.id, payload),
    onSuccess: async () => {
      setFormuleDialogOpen(false);
      setEditingFormule(null);
      await queryClient.invalidateQueries({ queryKey: ["formules-garantie-personne"] });
      toast.success("Formule personne enregistrée");
    },
    onError: showError,
  });

  return (
    <div className="grid gap-4">
      <div className="rounded-md border bg-card p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{grille.libelle}</div>
            <div className="text-xs text-muted-foreground">{text(grille.compagnieAssuranceLibelle)} · {text(grille.description)}</div>
          </div>
          <Badge variant="outline">{usageTabs.length} usage{usageTabs.length > 1 ? "s" : ""}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {usageTabs.map((usage) => {
          const active = usage.id === activeUsageId;
          return (
            <Button
              key={usage.id}
              type="button"
              variant={active ? "default" : "outline"}
              className={active ? "bg-amber-600 text-white hover:bg-amber-700" : ""}
              onClick={() => setSelectedUsageId(usage.id)}
            >
              {usage.code ? `Usage ${usage.code}` : usage.libelle}
            </Button>
          );
        })}
        <Button
          type="button"
          size="icon"
          className="bg-amber-600 text-white hover:bg-amber-700"
          disabled={!activeUsageId}
          onClick={() => {
            setEditingLigne(null);
            setLigneDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-semibold text-blue-600">Garanties véhicule</div>
          {activeUsage ? <Badge variant="outline">{activeUsage.code ? `Usage ${activeUsage.code}` : activeUsage.libelle}</Badge> : null}
        </div>
        <div className="grid gap-4 p-3 xl:grid-cols-[minmax(420px,1fr)_minmax(520px,1fr)]">
          <TauxLinesTable
            lines={tauxLignes}
            emptyText={!activeUsageId ? "Aucun usage sélectionné." : "Aucune garantie par taux pour cet usage."}
            onEdit={(ligne) => {
              setEditingLigne(ligne);
              setLigneDialogOpen(true);
            }}
          />
          <CapitalLinesTable
            lines={capitalLignes}
            emptyText={!activeUsageId ? "Aucun usage sélectionné." : "Aucune garantie par capital ou prime pour cet usage."}
            onEdit={(ligne) => {
              setEditingLigne(ligne);
              setLigneDialogOpen(true);
            }}
          />
        </div>
      </div>

      <PersonnesLinesTable
        formules={visibleFormules}
        emptyText={!activeUsageId ? "Aucun usage sélectionné." : "Aucune formule personne pour cet usage."}
        canAdd={Boolean(activeUsageId)}
        onAdd={() => {
          setEditingFormule(null);
          setFormuleDialogOpen(true);
        }}
        onEdit={(formule) => {
          setEditingFormule(formule);
          setFormuleDialogOpen(true);
        }}
      />

      <LigneGrilleTarifaireDialog
        open={ligneDialogOpen}
        onOpenChange={setLigneDialogOpen}
        ligne={editingLigne}
        garanties={garanties}
        usages={usageTabs}
        categoriesTransport={categoriesTransport}
        defaultUsageId={activeUsageId}
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
        garanties={garanties}
        usages={usageTabs.filter((usage) => Boolean(usage.garantiesPersonne))}
        defaultUsageId={activeUsageId}
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
    </div>
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
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{emptyText}</TableCell>
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
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{emptyText}</TableCell>
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
              <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">{emptyText}</TableCell>
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
  return code !== "-" ? code : text(ligne.libelle);
}

function percentValue(value: unknown) {
  const rendered = money(value);
  return rendered === "-" ? "-" : rendered;
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
