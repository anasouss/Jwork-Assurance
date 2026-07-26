import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { numberValue, text, toNumber } from "../utils/format";
import type {
  ReferenceOption,
  UpsertFormuleGarantiePersonneRequest,
  UpsertGrilleUsageConfigurationRequest,
  UpsertLigneGrilleTarifaireRequest,
} from "../types";

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

type PersonneMatrixLine = UpsertFormuleGarantiePersonneRequest & {
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
  const [personneDrafts, setPersonneDrafts] = useState<PersonneMatrixLine[]>([]);

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
  const draftGroups = useMemo(
    () => vehicleGaranties.map((garantie) => ({
      garantie,
      drafts: drafts.filter((draft) => draft.garantieId === garantie.id),
    })),
    [drafts, vehicleGaranties]
  );
  const personneDraftGroups = useMemo(
    () => personneGaranties.map((garantie) => ({
      garantie,
      drafts: personneDrafts.filter((draft) => draft.garantieId === garantie.id),
    })),
    [personneDrafts, personneGaranties]
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

  useEffect(() => {
    setPersonneDrafts(buildPersonneDrafts(
      personneGaranties,
      (formules.data ?? []).filter((formule) => String(formule.usageId ?? "") === activeUsageId)
    ));
  }, [activeUsageId, formules.data, personneGaranties]);

  const saveConfiguration = useMutation({
    mutationFn: (payload: UpsertGrilleUsageConfigurationRequest) =>
      productionApi.replaceGrilleUsageConfiguration(grille.id, activeUsageId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lignes-grille"] });
      await queryClient.invalidateQueries({ queryKey: ["formules-garantie-personne"] });
      toast.success("Configuration de l'usage enregistrée");
    },
    onError: showError,
  });

  const updateDraft = (localKey: string, patch: Partial<MatrixLine>) => {
    setDrafts((current) => current.map((draft) => draft.localKey === localKey ? { ...draft, ...patch } : draft));
  };

  const updatePersonneDraft = (localKey: string, patch: Partial<PersonneMatrixLine>) => {
    setPersonneDrafts((current) => current.map((draft) => draft.localKey === localKey ? { ...draft, ...patch } : draft));
  };

  const setPersonneGarantieEnabled = (garantieId: string, checked: boolean) => {
    setPersonneDrafts((current) => current.map((draft) => draft.garantieId === garantieId ? { ...draft, checked } : draft));
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
    setDrafts((current) => current.filter((item) => item.localKey !== draft.localKey));
  };

  const addPersonneDraft = (garantie: ReferenceOption) => {
    setPersonneDrafts((current) => [
      ...current,
      {
        localKey: newLocalKey(),
        checked: true,
        baseRow: false,
        garantieId: garantie.id,
        usageId: activeUsageId,
        formule: nextFormuleLabel(current, garantie.id),
        ordreAffichage: nextPersonneOrder(current, garantie.id),
        actif: true,
      },
    ]);
  };

  const removePersonneDraft = (draft: PersonneMatrixLine) => {
    if (draft.baseRow) {
      updatePersonneDraft(draft.localKey, { checked: false });
      return;
    }
    setPersonneDrafts((current) => current.filter((item) => item.localKey !== draft.localKey));
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
    saveConfiguration.mutate({
      lignes: selected.map((draft) => cleanDraft(draft, activeUsageId, garantieById.get(draft.garantieId))),
      formulesPersonne: usageAllowsGarantiesPersonne(activeUsage)
        ? personneDrafts
            .filter((draft) => draft.checked)
            .map((draft) => cleanPersonneDraft(draft, activeUsageId))
        : undefined,
    });
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
            {draftGroups.map(({ garantie, drafts: groupDrafts }) => {
              const baseDraft = groupDrafts.find((draft) => draft.baseRow) ?? emptyDraft(garantie);
              const extraDrafts = groupDrafts.filter((draft) => !draft.baseRow);
              const mode = baseDraft.modeTarification || defaultMode(garantie);
              const enabled = baseDraft.checked;
              const multiEntry = canAddMultipleRows(garantie, mode);
              return (
                <TableRow key={garantie.id}>
                  <TableCell>
                    <Checkbox checked={enabled} onCheckedChange={(checked) => updateDraft(baseDraft.localKey, { checked: checked === true })} />
                  </TableCell>
                  <TableCell className="align-top font-semibold">
                    <div className="pt-2">{garantieLabel(garantie)}</div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="grid gap-2">
                      <ModeCell
                        garantie={garantie}
                        value={mode}
                        disabled={!enabled}
                        onChange={(value) => {
                          updateDraft(baseDraft.localKey, normalizeModePatch(value));
                          if (!canAddMultipleRows(garantie, value)) {
                            setDrafts((current) => current.filter((draft) => draft.garantieId !== garantie.id || draft.baseRow));
                          }
                        }}
                      />
                      {extraDrafts.map((draft) => (
                        <ModeCell
                          key={draft.localKey}
                          garantie={garantie}
                          value={draft.modeTarification || defaultMode(garantie)}
                          disabled={!enabled}
                          onChange={(value) => updateDraft(draft.localKey, normalizeModePatch(value))}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <DraftNumberStack
                      drafts={[baseDraft, ...extraDrafts]}
                      enabled={enabled}
                      field="taux"
                      disabledFor={(draft) => (draft.modeTarification || defaultMode(garantie)) !== "TAUX"}
                      updateDraft={updateDraft}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <DraftNumberStack
                      drafts={[baseDraft, ...extraDrafts]}
                      enabled={enabled}
                      field="tauxFranchise"
                      disabledFor={() => !hasFranchise(garantie)}
                      updateDraft={updateDraft}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <DraftNumberStack
                      drafts={[baseDraft, ...extraDrafts]}
                      enabled={enabled}
                      field="franchiseMinimale"
                      disabledFor={() => !hasFranchise(garantie)}
                      updateDraft={updateDraft}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <DraftNumberStack
                      drafts={[baseDraft, ...extraDrafts]}
                      enabled={enabled}
                      field="capital"
                      disabledFor={(draft) => (draft.modeTarification || defaultMode(garantie)) !== "CAPITAL"}
                      updateDraft={updateDraft}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <DraftNumberStack
                      drafts={[baseDraft, ...extraDrafts]}
                      enabled={enabled}
                      field="prime"
                      disabledFor={(draft) => {
                        const rowMode = draft.modeTarification || defaultMode(garantie);
                        return rowMode !== "CAPITAL" && rowMode !== "PRIME_FIXE";
                      }}
                      updateDraft={updateDraft}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="grid gap-2 pt-1">
                      {multiEntry ? (
                        <Button type="button" variant="ghost" size="icon" disabled={!enabled} onClick={() => addDraft(garantie)}>
                          <Plus className="size-4" />
                        </Button>
                      ) : null}
                      {extraDrafts.map((draft) => (
                        <Button
                          key={draft.localKey}
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={!enabled}
                          onClick={() => removeDraft(draft)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {usageAllowsGarantiesPersonne(activeUsage) ? (
        <PersonnesLinesTable
          groups={personneDraftGroups}
          activeUsage={activeUsage}
          updateDraft={updatePersonneDraft}
          setGarantieEnabled={setPersonneGarantieEnabled}
          addDraft={addPersonneDraft}
          removeDraft={removePersonneDraft}
        />
      ) : null}
    </div>
  );
}

function PersonnesLinesTable({
  groups,
  activeUsage,
  updateDraft,
  setGarantieEnabled,
  addDraft,
  removeDraft,
}: {
  groups: { garantie: ReferenceOption; drafts: PersonneMatrixLine[] }[];
  activeUsage: ReferenceOption | null;
  updateDraft: (localKey: string, patch: Partial<PersonneMatrixLine>) => void;
  setGarantieEnabled: (garantieId: string, checked: boolean) => void;
  addDraft: (garantie: ReferenceOption) => void;
  removeDraft: (draft: PersonneMatrixLine) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div className="text-sm font-semibold text-blue-600">Garanties personnes</div>
        {activeUsage ? <Badge variant="outline">{activeUsage.code ? `Usage ${activeUsage.code}` : activeUsage.libelle}</Badge> : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Garantie</TableHead>
            <TableHead className="min-w-32">Formule</TableHead>
            <TableHead className="text-right">Décès</TableHead>
            <TableHead className="text-right">Invalidité</TableHead>
            <TableHead className="text-right">Frais médicaux</TableHead>
            <TableHead className="text-right">Frais hospitalisation</TableHead>
            <TableHead className="text-right">Frais funéraires</TableHead>
            <TableHead className="text-right">Frais chirurgie</TableHead>
            <TableHead className="text-right">Prime</TableHead>
            <TableHead className="text-right">Accessoire</TableHead>
            <TableHead className="w-16 text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">Aucune garantie personne disponible.</TableCell>
            </TableRow>
          ) : (
            groups.map(({ garantie, drafts: groupDrafts }) => {
              const baseDraft = groupDrafts.find((draft) => draft.baseRow) ?? emptyPersonneDraft(garantie);
              const extraDrafts = groupDrafts.filter((draft) => !draft.baseRow);
              const groupEnabled = baseDraft.checked;
              const allDrafts = [baseDraft, ...extraDrafts];
              return (
              <TableRow key={garantie.id}>
                <TableCell>
                  <Checkbox
                    checked={groupEnabled}
                    onCheckedChange={(value) => setGarantieEnabled(garantie.id, value === true)}
                  />
                </TableCell>
                <TableCell className="align-top font-semibold">
                  <div className="pt-2">{garantie.code || garantie.libelle}</div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="grid gap-2">
                    {allDrafts.map((draft) => (
                      <Input
                        key={`${draft.localKey}-formule`}
                        className="h-9"
                        disabled={!groupEnabled}
                        value={draft.formule ?? ""}
                        onChange={(event) => updateDraft(draft.localKey, { formule: event.target.value })}
                      />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <PersonneNumberStack drafts={allDrafts} enabled={groupEnabled} field="montantDeces" updateDraft={updateDraft} />
                </TableCell>
                <TableCell className="align-top">
                  <PersonneNumberStack drafts={allDrafts} enabled={groupEnabled} field="montantInvalidite" updateDraft={updateDraft} />
                </TableCell>
                <TableCell className="align-top">
                  <PersonneNumberStack drafts={allDrafts} enabled={groupEnabled} field="montantFraisMedicaux" updateDraft={updateDraft} />
                </TableCell>
                <TableCell className="align-top">
                  <PersonneNumberStack drafts={allDrafts} enabled={groupEnabled} field="montantFraisHospitalisation" updateDraft={updateDraft} />
                </TableCell>
                <TableCell className="align-top">
                  <PersonneNumberStack drafts={allDrafts} enabled={groupEnabled} field="montantFraisFuneraires" updateDraft={updateDraft} />
                </TableCell>
                <TableCell className="align-top">
                  <PersonneNumberStack drafts={allDrafts} enabled={groupEnabled} field="montantFraisChirurgie" updateDraft={updateDraft} />
                </TableCell>
                <TableCell className="align-top">
                  <PersonneNumberStack drafts={allDrafts} enabled={groupEnabled} field="primeNette" updateDraft={updateDraft} />
                </TableCell>
                <TableCell className="align-top">
                  <PersonneNumberStack drafts={allDrafts} enabled={groupEnabled} field="accessoire" updateDraft={updateDraft} />
                </TableCell>
                <TableCell className="align-top">
                  <div className="grid gap-2 pt-1">
                    {canAddMultipleRows(garantie) ? (
                      <Button type="button" variant="ghost" size="icon" disabled={!groupEnabled} onClick={() => addDraft(garantie)}>
                        <Plus className="size-4" />
                      </Button>
                    ) : null}
                    {extraDrafts.map((draft) => (
                      <Button
                        key={draft.localKey}
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={!groupEnabled}
                        onClick={() => removeDraft(draft)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
              );
            })
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

function DraftNumberStack({
  drafts,
  enabled,
  field,
  disabledFor,
  updateDraft,
}: {
  drafts: MatrixLine[];
  enabled: boolean;
  field: "taux" | "tauxFranchise" | "franchiseMinimale" | "capital" | "prime";
  disabledFor: (draft: MatrixLine) => boolean;
  updateDraft: (localKey: string, patch: Partial<MatrixLine>) => void;
}) {
  return (
    <div className="grid gap-2">
      {drafts.map((draft) => (
        <NumberCell
          key={`${draft.localKey}-${field}`}
          disabled={!enabled || disabledFor(draft)}
          value={draft[field]}
          onChange={(value) => updateDraft(draft.localKey, { [field]: value })}
        />
      ))}
    </div>
  );
}

function PersonneNumberStack({
  drafts,
  enabled,
  field,
  updateDraft,
}: {
  drafts: PersonneMatrixLine[];
  enabled: boolean;
  field:
    | "montantDeces"
    | "montantInvalidite"
    | "montantFraisMedicaux"
    | "montantFraisHospitalisation"
    | "montantFraisFuneraires"
    | "montantFraisChirurgie"
    | "primeNette"
    | "accessoire";
  updateDraft: (localKey: string, patch: Partial<PersonneMatrixLine>) => void;
}) {
  return (
    <div className="grid gap-2">
      {drafts.map((draft) => (
        <NumberCell
          key={`${draft.localKey}-${field}`}
          disabled={!enabled}
          value={draft[field]}
          onChange={(value) => updateDraft(draft.localKey, { [field]: value })}
        />
      ))}
    </div>
  );
}

function buildPersonneDrafts(garanties: ReferenceOption[], formules: ReferenceOption[]): PersonneMatrixLine[] {
  const result: PersonneMatrixLine[] = [];
  const byGarantie = new Map<string, ReferenceOption[]>();
  for (const formule of formules) {
    const garantieId = String(formule.garantieId ?? "");
    if (garantieId) {
      byGarantie.set(garantieId, [...(byGarantie.get(garantieId) ?? []), formule]);
    }
  }
  for (const garantie of garanties) {
    const existing = byGarantie.get(garantie.id) ?? [];
    if (!existing.length) {
      result.push(emptyPersonneDraft(garantie));
      continue;
    }
    existing.forEach((formule, index) => {
      result.push({
        localKey: newLocalKey(),
        checked: true,
        baseRow: index === 0,
        id: formule.id,
        garantieId: garantie.id,
        usageId: String(formule.usageId ?? ""),
        formule: stringValue(formule.libelle) || defaultFormuleLabel(index),
        montantDeces: toNumber(formule.montantDeces),
        montantInvalidite: toNumber(formule.montantInvalidite),
        montantFraisMedicaux: toNumber(formule.montantFraisMedicaux),
        montantFraisHospitalisation: toNumber(formule.montantFraisHospitalisation),
        montantFraisFuneraires: toNumber(formule.montantFraisFuneraires),
        montantFraisChirurgie: toNumber(formule.montantFraisChirurgie),
        primeNette: toNumber(formule.primeNette),
        accessoire: toNumber(formule.accessoire),
        ordreAffichage: toNumber(formule.ordreAffichage) ?? toNumber(garantie.ordreAffichage),
        actif: true,
      });
    });
  }
  return result;
}

function emptyPersonneDraft(garantie: ReferenceOption): PersonneMatrixLine {
  return {
    localKey: newLocalKey(),
    checked: false,
    baseRow: true,
    garantieId: garantie.id,
    formule: defaultFormuleLabel(0),
    ordreAffichage: toNumber(garantie.ordreAffichage),
    actif: true,
  };
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

function cleanPersonneDraft(draft: PersonneMatrixLine, usageId: string): UpsertFormuleGarantiePersonneRequest {
  return {
    id: draft.id,
    garantieId: draft.garantieId,
    usageId,
    formule: draft.formule || undefined,
    montantDeces: draft.montantDeces,
    montantInvalidite: draft.montantInvalidite,
    montantFraisMedicaux: draft.montantFraisMedicaux,
    montantFraisHospitalisation: draft.montantFraisHospitalisation,
    montantFraisFuneraires: draft.montantFraisFuneraires,
    montantFraisChirurgie: draft.montantFraisChirurgie,
    primeNette: draft.primeNette,
    accessoire: draft.accessoire,
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

function canAddMultipleRows(garantie?: ReferenceOption, mode?: string) {
  const configuredModes = Array.isArray(garantie?.modesTarificationMultiple)
    ? garantie.modesTarificationMultiple.map((item) => String(item))
    : [];
  if (!mode) {
    return configuredModes.length > 0 || Boolean(garantie?.tarificationMultiple);
  }
  return configuredModes.includes(mode);
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

function usageAllowsGarantiesPersonne(usage?: ReferenceOption | null) {
  return Boolean(usage?.garantiesPersonne);
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

function nextPersonneOrder(drafts: PersonneMatrixLine[], garantieId: string) {
  const existing = drafts.filter((draft) => draft.garantieId === garantieId);
  const max = Math.max(0, ...existing.map((draft) => draft.ordreAffichage ?? 0));
  return max + 1;
}

function nextFormuleLabel(drafts: PersonneMatrixLine[], garantieId: string) {
  const count = drafts.filter((draft) => draft.garantieId === garantieId).length;
  return defaultFormuleLabel(count);
}

function defaultFormuleLabel(index: number) {
  return `Formule ${index + 1}`;
}

function newLocalKey() {
  return Math.random().toString(36).slice(2);
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
