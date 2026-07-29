import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyInput } from "@/features/production/components/MoneyInput";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import type { ModeCalculCommission, Rule, RuleRequest, TypeContrat } from "../types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCompanyId?: string;
  initialTypeContrat?: TypeContrat;
};

type RuleForm = {
  compagnieAssuranceId: string;
  typeContrat: TypeContrat;
  modeCalculCommission: ModeCalculCommission;
  tauxCommissionAutomobile?: number;
  tauxCommissionEvcat?: number;
  tauxCommissionCorporel?: number;
  tauxTvaIncluseCommission?: number;
  retenueParDefaut: boolean;
  tauxRetenue?: number;
  toleranceEcart?: number;
  dateDebut: string;
  dateFin: string;
  actif: boolean;
};

const EMPTY_FORM: RuleForm = {
  compagnieAssuranceId: "",
  typeContrat: "PARTICULIER",
  modeCalculCommission: "TAUX_NET",
  retenueParDefaut: false,
  dateDebut: "",
  dateFin: "",
  actif: true,
};

export function QuittanceRulesDialog({
  open,
  onOpenChange,
  initialCompanyId,
  initialTypeContrat,
}: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Rule | null>(null);

  const companies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance", "compta"],
    queryFn: comptaApi.companies,
    enabled: open,
  });
  const rules = useQuery({
    queryKey: ["compta", "regles-quittances"],
    queryFn: comptaApi.rules,
    enabled: open,
  });

  const sortedRules = useMemo(
    () =>
      [...(rules.data ?? [])].sort(
        (left, right) =>
          left.compagnie.localeCompare(right.compagnie) ||
          left.typeContrat.localeCompare(right.typeContrat) ||
          right.dateDebut.localeCompare(left.dateDebut)
      ),
    [rules.data]
  );

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setShowForm(false);
      setPendingDelete(null);
      return;
    }
    if (initialCompanyId || initialTypeContrat) {
      setForm({
        ...EMPTY_FORM,
        compagnieAssuranceId: initialCompanyId ?? "",
        typeContrat: initialTypeContrat ?? "PARTICULIER",
      });
      setShowForm(true);
    }
  }, [initialCompanyId, initialTypeContrat, open]);

  const saveRule = useMutation({
    mutationFn: async () => {
      const request = toRequest(form);
      return editing
        ? comptaApi.updateRule(editing.id, request)
        : comptaApi.createRule(request);
    },
    onSuccess: async () => {
      toast.success(editing ? "Règle modifiée" : "Règle créée");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "regles-quittances"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "affectation-quittances"] }),
      ]);
      setEditing(null);
      setForm(EMPTY_FORM);
      setShowForm(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => comptaApi.deleteRule(id),
    onSuccess: async () => {
      toast.success("Règle supprimée");
      setPendingDelete(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "regles-quittances"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "affectation-quittances"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Suppression impossible"),
  });

  function startCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      compagnieAssuranceId: initialCompanyId ?? "",
      typeContrat: initialTypeContrat ?? "PARTICULIER",
    });
    setShowForm(true);
  }

  function startEdit(rule: Rule) {
    setEditing(rule);
    setForm({
      compagnieAssuranceId: rule.compagnieAssuranceId,
      typeContrat: rule.typeContrat,
      modeCalculCommission: rule.modeCalculCommission,
      tauxCommissionAutomobile: rule.tauxCommissionAutomobile,
      tauxCommissionEvcat: rule.tauxCommissionEvcat,
      tauxCommissionCorporel: rule.tauxCommissionCorporel,
      tauxTvaIncluseCommission: rule.tauxTvaIncluseCommission,
      retenueParDefaut: rule.retenueParDefaut,
      tauxRetenue: rule.tauxRetenue,
      toleranceEcart: rule.toleranceEcart,
      dateDebut: rule.dateDebut,
      dateFin: rule.dateFin ?? "",
      actif: rule.actif,
    });
    setShowForm(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] sm:!max-w-[min(96vw,1400px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuration des quittances compagnie</DialogTitle>
            <DialogDescription>
              Les taux sont versionnés par compagnie, type de contrat et période d'effet.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={startCreate}>
              <Plus className="size-4" />
              Nouvelle règle
            </Button>
          </div>

          {showForm ? (
            <div className="grid gap-4 border-y py-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 className="size-4" />
                {editing ? "Modifier la règle" : "Nouvelle règle"}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Compagnie" required>
                  <Select
                    value={form.compagnieAssuranceId}
                    onValueChange={(value) => setForm((current) => ({ ...current, compagnieAssuranceId: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {(companies.data ?? []).map((company) => (
                        <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Type de contrat" required>
                  <Select
                    value={form.typeContrat}
                    onValueChange={(value) => {
                      const typeContrat = value as TypeContrat;
                      setForm((current) => ({
                        ...current,
                        typeContrat,
                        modeCalculCommission: typeContrat === "FLOTTE" ? "TAUX_NET" : current.modeCalculCommission,
                        tauxCommissionAutomobile: typeContrat === "FLOTTE" ? 0 : current.tauxCommissionAutomobile,
                        tauxCommissionEvcat: typeContrat === "FLOTTE" ? 0 : current.tauxCommissionEvcat,
                        tauxCommissionCorporel: typeContrat === "FLOTTE" ? 0 : current.tauxCommissionCorporel,
                        tauxTvaIncluseCommission: typeContrat === "FLOTTE" ? 0 : current.tauxTvaIncluseCommission,
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARTICULIER">Mono</SelectItem>
                      <SelectItem value="CONVENTION">Convention</SelectItem>
                      <SelectItem value="FLOTTE">Flotte</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {form.typeContrat !== "FLOTTE" ? (
                  <Field label="Mode de calcul" required>
                    <Select
                      value={form.modeCalculCommission}
                      onValueChange={(value) => {
                        const modeCalculCommission = value as ModeCalculCommission;
                        setForm((current) => ({
                          ...current,
                          modeCalculCommission,
                          tauxTvaIncluseCommission:
                            modeCalculCommission === "TAUX_NET" ? 0 : current.tauxTvaIncluseCommission,
                        }));
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TAUX_NET">Taux de commission nette</SelectItem>
                        <SelectItem value="TAUX_BRUT_TVA_INCLUSE">Taux brut avec TVA incluse</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                <Field label="Mode d'affectation">
                  <Input
                    readOnly
                    value={form.typeContrat === "FLOTTE" ? "Manuel ou import Excel" : "Calcul automatique"}
                  />
                </Field>
                {form.typeContrat !== "FLOTTE" ? (
                  <>
                    <RateField
                      label="Commission automobile (%)"
                      value={form.tauxCommissionAutomobile}
                      onChange={(value) => setForm((current) => ({ ...current, tauxCommissionAutomobile: value }))}
                    />
                    <RateField
                      label="Commission EVCAT (%)"
                      value={form.tauxCommissionEvcat}
                      onChange={(value) => setForm((current) => ({ ...current, tauxCommissionEvcat: value }))}
                    />
                    <RateField
                      label="Commission corporel / PTA (%)"
                      value={form.tauxCommissionCorporel}
                      onChange={(value) => setForm((current) => ({ ...current, tauxCommissionCorporel: value }))}
                    />
                    {form.modeCalculCommission === "TAUX_BRUT_TVA_INCLUSE" ? (
                      <RateField
                        label="TVA incluse sur commission (%)"
                        value={form.tauxTvaIncluseCommission}
                        onChange={(value) => setForm((current) => ({ ...current, tauxTvaIncluseCommission: value }))}
                      />
                    ) : null}
                  </>
                ) : null}
                <RateField
                  label="Retenue à la source (%)"
                  value={form.tauxRetenue}
                  onChange={(value) => setForm((current) => ({ ...current, tauxRetenue: value }))}
                />
                <Field label="Tolérance d'écart (MAD)" required>
                  <MoneyInput
                    value={form.toleranceEcart}
                    onValueChange={(value) => setForm((current) => ({ ...current, toleranceEcart: value }))}
                  />
                </Field>
                <Field label="Date de début" required>
                  <DatePicker
                    date={form.dateDebut}
                    onSelect={(date) => setForm((current) => ({ ...current, dateDebut: toDateOnly(date) ?? "" }))}
                  />
                </Field>
                <Field label="Date de fin">
                  <DatePicker
                    date={form.dateFin}
                    onSelect={(date) => setForm((current) => ({ ...current, dateFin: toDateOnly(date) ?? "" }))}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <CheckField
                  checked={form.retenueParDefaut}
                  label="Appliquer la retenue par défaut"
                  onChange={(checked) => setForm((current) => ({ ...current, retenueParDefaut: checked }))}
                />
                <CheckField
                  checked={form.actif}
                  label="Règle active"
                  onChange={(checked) => setForm((current) => ({ ...current, actif: checked }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    setShowForm(false);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  disabled={!isComplete(form) || saveRule.isPending}
                  onClick={() => saveRule.mutate()}
                >
                  Enregistrer
                </Button>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Compagnie</th>
                  <th className="px-3 py-2">Contrat</th>
                  <th className="px-3 py-2">Affectation</th>
                  <th className="px-3 py-2 text-right">Auto</th>
                  <th className="px-3 py-2 text-right">EVCAT</th>
                  <th className="px-3 py-2 text-right">Corporel</th>
                  <th className="px-3 py-2">Période</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index} className="border-t">
                      <td colSpan={9} className="px-3 py-3"><Skeleton className="h-8 w-full" /></td>
                    </tr>
                  ))
                ) : sortedRules.length ? (
                  sortedRules.map((rule) => (
                    <tr key={rule.id} className="border-t">
                      <td className="px-3 py-3 font-medium">{rule.compagnie}</td>
                      <td className="px-3 py-3">{contractLabel(rule.typeContrat)}</td>
                      <td className="px-3 py-3">
                        {rule.modeAffectation === "AUTOMATIQUE" ? "Automatique" : "Manuel / import"}
                      </td>
                      <td className="px-3 py-3 text-right">{rule.typeContrat === "FLOTTE" ? "—" : rateLabel(rule.tauxCommissionAutomobile)}</td>
                      <td className="px-3 py-3 text-right">{rule.typeContrat === "FLOTTE" ? "—" : rateLabel(rule.tauxCommissionEvcat)}</td>
                      <td className="px-3 py-3 text-right">{rule.typeContrat === "FLOTTE" ? "—" : rateLabel(rule.tauxCommissionCorporel)}</td>
                      <td className="px-3 py-3">{rule.dateDebut} → {rule.dateFin ?? "sans fin"}</td>
                      <td className="px-3 py-3">
                        <Badge variant={rule.actif ? "default" : "secondary"}>{rule.actif ? "Active" : "Inactive"}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="icon" variant="ghost" title="Modifier" onClick={() => startEdit(rule)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" title="Supprimer" onClick={() => setPendingDelete(rule)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Aucune règle configurée.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(value) => !value && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette règle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Seule une règle encore inutilisée peut être supprimée. Les quittances de cette période nécessiteront une autre règle effective.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRule.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) deleteRule.mutate(pendingDelete.id);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label className="text-xs uppercase">
        {label}{required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

function RateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Field label={label} required>
      <Input
        type="number"
        min="0"
        max="100"
        step="0.0001"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      />
    </Field>
  );
}

function CheckField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );
}

function isComplete(form: RuleForm) {
  const commissionComplete =
    form.typeContrat === "FLOTTE" ||
    (
      form.tauxCommissionAutomobile != null &&
      form.tauxCommissionEvcat != null &&
      form.tauxCommissionCorporel != null &&
      (
        form.modeCalculCommission === "TAUX_NET" ||
        form.tauxTvaIncluseCommission != null
      )
    );
  return Boolean(
    form.compagnieAssuranceId &&
      form.dateDebut &&
      commissionComplete &&
      form.tauxRetenue != null &&
      form.toleranceEcart != null &&
      (!form.dateFin || form.dateFin >= form.dateDebut)
  );
}

function toRequest(form: RuleForm): RuleRequest {
  if (!isComplete(form)) {
    throw new Error("Complétez tous les paramètres obligatoires");
  }
  return {
    compagnieAssuranceId: form.compagnieAssuranceId,
    typeContrat: form.typeContrat,
    modeAffectation: form.typeContrat === "FLOTTE" ? "MANUEL_OU_IMPORT" : "AUTOMATIQUE",
    modeCalculCommission: form.typeContrat === "FLOTTE" ? "TAUX_NET" : form.modeCalculCommission,
    tauxCommissionAutomobile: form.typeContrat === "FLOTTE" ? 0 : form.tauxCommissionAutomobile!,
    tauxCommissionEvcat: form.typeContrat === "FLOTTE" ? 0 : form.tauxCommissionEvcat!,
    tauxCommissionCorporel: form.typeContrat === "FLOTTE" ? 0 : form.tauxCommissionCorporel!,
    tauxTvaIncluseCommission:
      form.typeContrat === "FLOTTE" || form.modeCalculCommission === "TAUX_NET"
        ? 0
        : form.tauxTvaIncluseCommission!,
    retenueParDefaut: form.retenueParDefaut,
    tauxRetenue: form.tauxRetenue!,
    toleranceEcart: form.toleranceEcart!,
    dateDebut: form.dateDebut,
    dateFin: form.dateFin || null,
    actif: form.actif,
  };
}

function contractLabel(type: TypeContrat) {
  if (type === "PARTICULIER") return "Mono";
  if (type === "CONVENTION") return "Convention";
  return "Flotte";
}

function rateLabel(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(value)} %`;
}
