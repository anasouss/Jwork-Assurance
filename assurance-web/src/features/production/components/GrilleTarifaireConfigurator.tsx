import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { formuleGarantiePersonneSchema } from "../schemas";
import { money, numberValue, text, toNumber } from "../utils/format";
import { FormuleGarantiePersonneDialog } from "./FormuleGarantiePersonneDialog";
import type { ReferenceOption, UpsertFormuleGarantiePersonneRequest, UpsertLigneGrilleTarifaireRequest } from "../types";

type Props = {
  grille: ReferenceOption;
  garanties: ReferenceOption[];
  usages: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  allowedUsageIds?: string[];
  queryScope?: string;
};

type MatrixLine = UpsertLigneGrilleTarifaireRequest & {
  localKey: string;
  checked: boolean;
  baseRow: boolean;
};

export function GrilleTarifaireConfigurator({
  grille,
  garanties,
  usages,
  allowedUsageIds,
  queryScope = "grille-config",
}: Props) {
  const queryClient = useQueryClient();
  const [selectedUsageId, setSelectedUsageId] = useState("");
  const [drafts, setDrafts] = useState<MatrixLine[]>([]);
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
    return usageIds.size ? usages.filter((usage) => usageIds.has(usage.id)) : usages;
  }, [allowedUsageSet, formules.data, lignes.data, usages]);

  const activeUsageId = selectedUsageId || usageTabs[0]?.id || "";
  const activeUsage = usageTabs.find((usage) => usage.id === activeUsageId) ?? null;
  const vehicleGaranties = useMemo(
    () => garanties
      .filter(isConfigurableVehicleGarantie)
      .sort((left, right) => (toNumber(left.ordreAffichage) ?? 9999) - (toNumber(right.ordreAffichage) ?? 9999)),
    [garanties]
  );
  const personneGaranties = useMemo(
    () => garanties
      .filter((garantie) => text(garantie.typeGarantie) === "PERSONNE")
      .sort((left, right) => (toNumber(left.ordreAffichage) ?? 9999) - (toNumber(right.ordreAffichage) ?? 9999)),
    [garanties]
  );
  const garantieById = useMemo(
    () => new Map(garanties.map((garantie) => [garantie.id, garantie])),
    [garanties]
  );
  const visibleFormules = (formules.data ?? []).filter(
    (formule) => String(formule.usageId ?? "") === activeUsageId
  );

  useEffect(() => {
    if (selectedUsageId && usageTabs.some((usage) => usage.id === selectedUsageId)) {
      return;
    }
    setSelectedUsageId(usageTabs[0]?.id ?? "");
  }, [selectedUsageId, usageTabs]);

  useEffect(() => {
    setDrafts(buildDrafts(vehicleGaranties, (lignes.data ?? []).filter((ligne) => String(ligne.usageId ?? "") === activeUsageId)));
  }, [activeUsageId, lignes.data, vehicleGaranties]);

  const saveConfiguration = useMutation({
    mutationFn: (payload: UpsertLigneGrilleTarifaireRequest[]) =>
      productionApi.replaceGrilleUsageConfiguration(grille.id, activeUsageId, { lignes: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lignes-grille"] });
      toast.success("Configuration de l'usage enregistrée");
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

  const updateDraft = (localKey: string, patch: Partial<MatrixLine>) => {
    setDrafts((current) => current.map((draft) => draft.localKey === localKey ? { ...draft, ...patch } : draft));
  };

  const addDraft = (garantie: ReferenceOption) => {
    setDrafts((current) => [
      ...current,
      {
        localKey: newLocalKey(),
        checked: true,
        baseRow: false,
        garantieId: garantie.id,
        usageId: activeUsageId,
        modeTarification: defaultMode(garantie),
        ordreAffichage: nextOrder(current, garantie.id),
      },
    ]);
  };

  const removeDraft = (draft: MatrixLine) => {
    if (draft.baseRow) {
      updateDraft(draft.localKey, { checked: false });
      return;
    }
    setDrafts((current) => {
      const next = current.filter((item) => item.localKey !== draft.localKey);
      if (next.some((item) => item.garantieId === draft.garantieId)) {
        return next;
      }
      const garantie = garantieById.get(draft.garantieId);
      return garantie ? [...next, emptyDraft(garantie)] : next;
    });
  };

  const submitMatrix = () => {
    if (!activeUsageId) {
      toast.error("Usage obligatoire");
      return;
    }
    const selected = drafts.filter((draft) => draft.checked);
    const invalid = selected.find((draft) => !hasRequiredPricing(draft, garantieById.get(draft.garantieId)));
    if (invalid) {
      const garantie = garantieById.get(invalid.garantieId);
      toast.error(`Valeurs manquantes pour ${garantieLabel(garantie)}`);
      return;
    }
    saveConfiguration.mutate(selected.map((draft) => cleanDraft(draft, activeUsageId, garantieById.get(draft.garantieId))));
  };

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

      <div className="flex flex-wrap items-center justify-between gap-3">
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
        </div>
        <Button type="button" disabled={!activeUsageId || saveConfiguration.isPending} onClick={submitMatrix}>
          <Save className="size-4" />
          Enregistrer l'usage
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-semibold text-blue-600">Garanties véhicule</div>
          {activeUsage ? <Badge variant="outline">{activeUsage.code ? `Usage ${activeUsage.code}` : activeUsage.libelle}</Badge> : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Garantie</TableHead>
              <TableHead className="min-w-32">Mode</TableHead>
              <TableHead className="min-w-32 text-right">Taux de valeur</TableHead>
              <TableHead className="min-w-32 text-right">Taux franchise</TableHead>
              <TableHead className="min-w-32 text-right">Franchise minimale</TableHead>
              <TableHead className="min-w-32 text-right">Capital</TableHead>
              <TableHead className="min-w-32 text-right">Prime</TableHead>
              <TableHead className="w-16 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map((draft) => {
              const garantie = garantieById.get(draft.garantieId);
              const mode = draft.modeTarification || defaultMode(garantie);
              const enabled = draft.checked;
              const multiEntry = canAddMultipleRows(garantie);
              return (
                <TableRow key={draft.localKey}>
                  <TableCell>
                    <Checkbox checked={enabled} onCheckedChange={(checked) => updateDraft(draft.localKey, { checked: checked === true })} />
                  </TableCell>
                  <TableCell className="font-semibold">
                    <div>{garantieLabel(garantie)}</div>
                    {draft.libelleOption ? <div className="text-xs font-normal text-muted-foreground">{draft.libelleOption}</div> : null}
                  </TableCell>
                  <TableCell>
                    <ModeCell
                      garantie={garantie}
                      value={mode}
                      disabled={!enabled}
                      onChange={(value) => updateDraft(draft.localKey, normalizeModePatch(value))}
                    />
                  </TableCell>
                  <TableCell><NumberCell disabled={!enabled || mode !== "TAUX"} value={draft.taux} onChange={(value) => updateDraft(draft.localKey, { taux: value })} /></TableCell>
                  <TableCell><NumberCell disabled={!enabled || !hasFranchise(garantie)} value={draft.tauxFranchise} onChange={(value) => updateDraft(draft.localKey, { tauxFranchise: value })} /></TableCell>
                  <TableCell><NumberCell disabled={!enabled || !hasFranchise(garantie)} value={draft.franchiseMinimale} onChange={(value) => updateDraft(draft.localKey, { franchiseMinimale: value })} /></TableCell>
                  <TableCell><NumberCell disabled={!enabled || mode !== "CAPITAL"} value={draft.capital} onChange={(value) => updateDraft(draft.localKey, { capital: value })} /></TableCell>
                  <TableCell><NumberCell disabled={!enabled || (mode !== "CAPITAL" && mode !== "PRIME_FIXE")} value={draft.prime} onChange={(value) => updateDraft(draft.localKey, { prime: value })} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {draft.baseRow && multiEntry ? (
                        <Button type="button" variant="ghost" size="icon" disabled={!enabled} onClick={() => garantie && addDraft(garantie)}>
                          <Plus className="size-4" />
                        </Button>
                      ) : null}
                      {!draft.baseRow ? (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeDraft(draft)}>
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PersonnesLinesTable
        formules={visibleFormules}
        emptyText={!activeUsageId ? "Aucun usage sélectionné." : "Aucune formule personne pour cet usage."}
        canAdd={Boolean(activeUsageId && activeUsage?.garantiesPersonne)}
        onAdd={() => {
          setEditingFormule(null);
          setFormuleDialogOpen(true);
        }}
        onEdit={(formule) => {
          setEditingFormule(formule);
          setFormuleDialogOpen(true);
        }}
      />

      <FormuleGarantiePersonneDialog
        open={formuleDialogOpen}
        onOpenChange={setFormuleDialogOpen}
        formule={editingFormule}
        garanties={personneGaranties}
        usages={usageTabs.filter((usage) => Boolean(usage.garantiesPersonne))}
        defaultUsageId={activeUsageId}
        submitting={saveFormule.isPending}
        onSubmit={(payload) => {
          const parsed = formuleGarantiePersonneSchema.safeParse(payload);
          if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
            return;
          }
          saveFormule.mutate({ id: editingFormule?.id, payload: { ...payload, usageId: activeUsageId } });
        }}
      />
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

function ModeCell({
  garantie,
  value,
  disabled,
  onChange,
}: {
  garantie?: ReferenceOption;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const modes = allowedModes(garantie);
  if (modes.length <= 1) {
    return <Badge variant="outline">{modeLabel(value)}</Badge>;
  }
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder="Mode" /></SelectTrigger>
      <SelectContent>
        {modes.map((mode) => (
          <SelectItem key={mode} value={mode}>{modeLabel(mode)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NumberCell({
  value,
  disabled,
  onChange,
}: {
  value?: number;
  disabled: boolean;
  onChange: (value?: number) => void;
}) {
  return (
    <Input
      type="number"
      className="h-9 text-right"
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) => onChange(numberValue(event.target.value))}
    />
  );
}

function buildDrafts(garanties: ReferenceOption[], lignes: ReferenceOption[]): MatrixLine[] {
  const result: MatrixLine[] = [];
  const byGarantie = new Map<string, ReferenceOption[]>();
  for (const ligne of lignes) {
    const garantieId = String(ligne.garantieId ?? "");
    if (!garantieId) continue;
    byGarantie.set(garantieId, [...(byGarantie.get(garantieId) ?? []), ligne]);
  }
  for (const garantie of garanties) {
    const existing = byGarantie.get(garantie.id) ?? [];
    if (!existing.length) {
      result.push(emptyDraft(garantie));
      continue;
    }
    for (const ligne of existing) {
      const index = existing.indexOf(ligne);
      result.push({
        localKey: newLocalKey(),
        checked: true,
        baseRow: index === 0,
        id: ligne.id,
        garantieId: garantie.id,
        usageId: String(ligne.usageId ?? ""),
        categorieTransportId: stringValue(ligne.categorieTransportId),
        puissanceFiscaleMin: toNumber(ligne.puissanceFiscaleMin),
        puissanceFiscaleMax: toNumber(ligne.puissanceFiscaleMax),
        nombrePlacesMin: toNumber(ligne.nombrePlacesMin),
        nombrePlacesMax: toNumber(ligne.nombrePlacesMax),
        ptcMin: toNumber(ligne.ptcMin),
        ptcMax: toNumber(ligne.ptcMax),
        sousClasse: stringValue(ligne.sousClasse),
        carburant: stringValue(ligne.carburant),
        modeTarification: stringValue(ligne.modeTarification) || defaultMode(garantie),
        libelleOption: stringValue(ligne.libelleOption),
        prime: toNumber(ligne.prime),
        capital: toNumber(ligne.capital),
        taux: toNumber(ligne.taux),
        tauxFranchise: toNumber(ligne.tauxFranchise),
        franchiseMinimale: toNumber(ligne.franchiseMinimale),
        ordreAffichage: toNumber(ligne.ordreAffichage),
      });
    }
  }
  return result;
}

function emptyDraft(garantie: ReferenceOption): MatrixLine {
  return {
    localKey: newLocalKey(),
    checked: false,
    baseRow: true,
    garantieId: garantie.id,
    modeTarification: defaultMode(garantie),
    ordreAffichage: toNumber(garantie.ordreAffichage),
  };
}

function cleanDraft(draft: MatrixLine, usageId: string, garantie?: ReferenceOption): UpsertLigneGrilleTarifaireRequest {
  const mode = draft.modeTarification || "TAUX";
  const franchise = hasFranchise(garantie);
  return {
    id: draft.id,
    garantieId: draft.garantieId,
    usageId,
    categorieTransportId: draft.categorieTransportId || undefined,
    puissanceFiscaleMin: draft.puissanceFiscaleMin,
    puissanceFiscaleMax: draft.puissanceFiscaleMax,
    nombrePlacesMin: draft.nombrePlacesMin,
    nombrePlacesMax: draft.nombrePlacesMax,
    ptcMin: draft.ptcMin,
    ptcMax: draft.ptcMax,
    sousClasse: draft.sousClasse || undefined,
    carburant: draft.carburant || undefined,
    modeTarification: mode,
    libelleOption: draft.libelleOption || undefined,
    taux: mode === "TAUX" ? draft.taux : undefined,
    tauxFranchise: franchise ? draft.tauxFranchise : undefined,
    franchiseMinimale: franchise ? draft.franchiseMinimale : undefined,
    capital: mode === "CAPITAL" ? draft.capital : undefined,
    prime: mode === "CAPITAL" || mode === "PRIME_FIXE" ? draft.prime : undefined,
    ordreAffichage: draft.ordreAffichage,
    actif: true,
  };
}

function normalizeModePatch(mode: string): Partial<MatrixLine> {
  return {
    modeTarification: mode,
    taux: undefined,
    capital: undefined,
    prime: undefined,
  };
}

function hasRequiredPricing(draft: MatrixLine, garantie?: ReferenceOption) {
  const mode = draft.modeTarification || defaultMode(garantie);
  if (mode === "TAUX") return draft.taux !== undefined;
  if (mode === "CAPITAL") return draft.capital !== undefined && draft.prime !== undefined;
  if (mode === "PRIME_FIXE") return draft.prime !== undefined;
  return true;
}

function isConfigurableVehicleGarantie(garantie: ReferenceOption) {
  return text(garantie.typeGarantie) !== "PERSONNE"
    && !Boolean(garantie.responsabiliteCivile);
}

function canAddMultipleRows(garantie?: ReferenceOption) {
  return Boolean(garantie?.tarificationMultiple);
}

function allowedModes(garantie?: ReferenceOption) {
  const raw = Array.isArray(garantie?.modesAutorises) && garantie?.modesAutorises.length
    ? garantie.modesAutorises
    : [garantie?.modeParDefaut ?? "TAUX"];
  return [...new Set(raw.map((mode) => String(mode)).filter((mode) => mode !== "PROTECTION"))];
}

function defaultMode(garantie?: ReferenceOption) {
  const configured = stringValue(garantie?.modeParDefaut);
  if (configured && configured !== "PROTECTION") return configured;
  return allowedModes(garantie)[0] ?? "TAUX";
}

function hasFranchise(garantie?: ReferenceOption) {
  return Boolean(garantie?.avecFranchise);
}

function modeLabel(mode: string) {
  const labels: Record<string, string> = {
    TAUX: "Taux",
    CAPITAL: "Capital",
    PRIME_FIXE: "Prime fixe",
  };
  return labels[mode] ?? mode;
}

function garantieLabel(garantie?: ReferenceOption) {
  if (!garantie) return "Garantie";
  return garantie.code ? `${garantie.code} - ${garantie.libelle}` : garantie.libelle;
}

function stringValue(value: unknown) {
  return value === undefined || value === null ? undefined : String(value);
}

function nextOrder(drafts: MatrixLine[], garantieId: string) {
  const existing = drafts.filter((draft) => draft.garantieId === garantieId);
  const max = Math.max(0, ...existing.map((draft) => draft.ordreAffichage ?? 0));
  return max + 1;
}

function newLocalKey() {
  return Math.random().toString(36).slice(2);
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
