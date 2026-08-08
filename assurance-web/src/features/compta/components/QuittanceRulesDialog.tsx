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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toDateOnly } from "@/features/production/date";
import { accountingKeys } from "@/lib/query-keys";
import { comptaApi } from "../api";
import { formatAccountingMoney } from "../format";
import type { ModeCalculCommission, ModeVentilationQuittance, Rule, RuleRequest, TypeContrat } from "../types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCompanyId?: string;
  initialTypeContrat?: TypeContrat;
  initialRule?: Rule | null;
};

type RuleForm = {
  compagnieAssuranceId: string;
  typeContrat: TypeContrat;
  modeVentilation: ModeVentilationQuittance;
  modeCalculCommission: ModeCalculCommission;
  tauxCommissionAutomobile?: number;
  tauxCommissionEvcat?: number;
  tauxCommissionCorporel?: number;
  tauxTvaIncluseCommission?: number;
  retenueParDefaut: boolean;
  tauxRetenue?: number;
  seuilAvertissementEcart?: number;
  margeManquanteMaximale?: number;
  margeDepassementMaximale?: number;
  dateDebut: string;
  dateFin: string;
  excelFeuille: string;
  excelLigneEntete: number;
  excelColonneNumeroPolice: string;
  excelColonneNumeroQuittance: string;
  excelColonneDateEffet: string;
  excelColonneDateEcheance: string;
  excelColonnePrimeNette: string;
  excelColonneTaxes: string;
  excelColonneAccessoires: string;
  excelColonneMontantTtc: string;
  excelColonneCommissionNette: string;
  excelColonneNetCompagnie: string;
  excelColonneActe: string;
  excelColonneCategorie: string;
  excelColonneStatut: string;
  actif: boolean;
};

const RULES_PAGE_SIZE = 10;

const DEFAULT_EXCEL_MAPPING = {
  excelFeuille: "",
  excelLigneEntete: 1,
  excelColonneNumeroPolice: "",
  excelColonneNumeroQuittance: "N° Quittance | No Quittance | Numero Quittance",
  excelColonneDateEffet: "Date effet | Date d'effet",
  excelColonneDateEcheance: "Date échéance | Date echeance | Date fin",
  excelColonnePrimeNette: "Prime nette | P nette",
  excelColonneTaxes: "Taxe | Taxes | Montant taxes",
  excelColonneAccessoires: "Accessoires | Accessoire",
  excelColonneMontantTtc: "Montant TTC | TTC",
  excelColonneCommissionNette: "Commission nette",
  excelColonneNetCompagnie: "Net compagnie | Net à payer compagnie",
  excelColonneActe: "Acte | Mouvement",
  excelColonneCategorie: "Catégorie | Categorie",
  excelColonneStatut: "Statut",
};

const EMPTY_FORM: RuleForm = {
  compagnieAssuranceId: "",
  typeContrat: "PARTICULIER",
  modeVentilation: "GLOBALE",
  modeCalculCommission: "TAUX_NET",
  retenueParDefaut: false,
  seuilAvertissementEcart: 0.01,
  margeManquanteMaximale: 20,
  margeDepassementMaximale: 50,
  dateDebut: "",
  dateFin: "",
  ...DEFAULT_EXCEL_MAPPING,
  actif: true,
};

export function QuittanceRulesDialog({
  open,
  onOpenChange,
  initialCompanyId,
  initialTypeContrat,
  initialRule,
}: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Rule | null>(null);
  const [page, setPage] = useState(0);

  const companies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance", "compta"],
    queryFn: comptaApi.companies,
    enabled: open,
  });
  const rules = useQuery({
    queryKey: ["compta", "regles-quittances", page, RULES_PAGE_SIZE],
    queryFn: () => comptaApi.rules({ page, size: RULES_PAGE_SIZE }),
    enabled: open,
  });

  const sortedRules = useMemo(
    () =>
      [...(rules.data?.rows ?? [])].sort(
        (left, right) =>
          left.compagnie.localeCompare(right.compagnie) ||
          left.typeContrat.localeCompare(right.typeContrat) ||
          right.dateDebut.localeCompare(left.dateDebut)
      ),
    [rules.data]
  );
  const totalPages = Math.max(1, rules.data?.page.totalPages ?? 1);
  const currentPage = Math.min(rules.data?.page.number ?? page, totalPages - 1);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setShowForm(false);
      setPendingDelete(null);
      setPage(0);
      return;
    }
    if (initialRule) {
      setEditing(initialRule);
      setForm(ruleToForm(initialRule));
      setShowForm(true);
    } else if (initialCompanyId || initialTypeContrat) {
      const typeContrat = initialTypeContrat ?? "PARTICULIER";
      setForm({
        ...EMPTY_FORM,
        compagnieAssuranceId: initialCompanyId ?? "",
        typeContrat,
        modeVentilation: typeContrat === "FLOTTE" ? "GLOBALE" : EMPTY_FORM.modeVentilation,
      });
      setShowForm(true);
    }
  }, [initialCompanyId, initialRule, initialTypeContrat, open]);

  useEffect(() => {
    const availablePages = rules.data?.page.totalPages;
    if (availablePages != null && availablePages > 0 && page >= availablePages) {
      setPage(availablePages - 1);
    }
  }, [page, rules.data?.page.totalPages]);

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
        queryClient.invalidateQueries({ queryKey: accountingKeys.quittanceAllocationLists() }),
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
      if ((rules.data?.rows.length ?? 0) === 1 && page > 0) {
        setPage((current) => current - 1);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "regles-quittances"] }),
        queryClient.invalidateQueries({ queryKey: accountingKeys.quittanceAllocationLists() }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Suppression impossible"),
  });

  function startCreate() {
    const typeContrat = initialTypeContrat ?? "PARTICULIER";
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      compagnieAssuranceId: initialCompanyId ?? "",
      typeContrat,
      modeVentilation: typeContrat === "FLOTTE" ? "GLOBALE" : EMPTY_FORM.modeVentilation,
    });
    setShowForm(true);
  }

  function startEdit(rule: Rule) {
    setEditing(rule);
    setForm(ruleToForm(rule));
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
                        modeVentilation: typeContrat === "FLOTTE" ? "GLOBALE" : current.modeVentilation,
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
                  <Field label="Ventilation compagnie" required>
                    <Select
                      value={form.modeVentilation}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, modeVentilation: value as ModeVentilationQuittance }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GLOBALE">Une quittance globale</SelectItem>
                        <SelectItem value="PAR_CATEGORIE">Une quittance par catégorie</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
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
              {form.typeContrat === "FLOTTE" ? (
                <div className="grid gap-4 border-t pt-4">
                  <div>
                    <h3 className="text-sm font-semibold">Tolérance d’écart d’affectation</h3>
                    <p className="text-sm text-muted-foreground">
                      La marge sans alerte s’applique dans les deux sens. Les montants manquants et les dépassements ont chacun leur propre limite de blocage.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3 xl:max-w-4xl">
                    <AmountField
                      label="Marge sans alerte (MAD)"
                      value={form.seuilAvertissementEcart}
                      onChange={(value) => setForm((current) => ({ ...current, seuilAvertissementEcart: value }))}
                    />
                    <AmountField
                      label="Manquant maximal (MAD)"
                      value={form.margeManquanteMaximale}
                      onChange={(value) => setForm((current) => ({ ...current, margeManquanteMaximale: value }))}
                    />
                    <AmountField
                      label="Dépassement maximal (MAD)"
                      value={form.margeDepassementMaximale}
                      onChange={(value) => setForm((current) => ({ ...current, margeDepassementMaximale: value }))}
                    />
                  </div>
                </div>
              ) : null}
              {form.typeContrat === "FLOTTE" ? (
                <div className="grid gap-4 border-t pt-4">
                  <div>
                    <h3 className="text-sm font-semibold">Colonnes de l’import Excel</h3>
                    <p className="text-sm text-muted-foreground">
                      La casse, les accents, les espaces et la ponctuation sont ignorés.
                      Séparez plusieurs titres acceptés avec le caractère |.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <ExcelTitleField
                      label="Feuille"
                      value={form.excelFeuille}
                      placeholder="Première feuille"
                      onChange={(value) => setForm((current) => ({ ...current, excelFeuille: value }))}
                    />
                    <Field label="Ligne d’en-tête" required>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={form.excelLigneEntete}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          excelLigneEntete: Number(event.target.value),
                        }))}
                      />
                    </Field>
                    <ExcelTitleField
                      label="N° quittance"
                      required
                      value={form.excelColonneNumeroQuittance}
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneNumeroQuittance: value }))}
                    />
                    <ExcelTitleField
                      label="N° police"
                      value={form.excelColonneNumeroPolice}
                      placeholder="Optionnel"
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneNumeroPolice: value }))}
                    />
                    <ExcelTitleField
                      label="Date effet"
                      required
                      value={form.excelColonneDateEffet}
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneDateEffet: value }))}
                    />
                    <ExcelTitleField
                      label="Date échéance"
                      value={form.excelColonneDateEcheance}
                      placeholder="Optionnel"
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneDateEcheance: value }))}
                    />
                    <ExcelTitleField
                      label="Prime nette"
                      required
                      value={form.excelColonnePrimeNette}
                      onChange={(value) => setForm((current) => ({ ...current, excelColonnePrimeNette: value }))}
                    />
                    <ExcelTitleField
                      label="Taxes"
                      required
                      value={form.excelColonneTaxes}
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneTaxes: value }))}
                    />
                    <ExcelTitleField
                      label="Accessoires"
                      value={form.excelColonneAccessoires}
                      placeholder="Optionnel - 0 par défaut"
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneAccessoires: value }))}
                    />
                    <ExcelTitleField
                      label="Montant TTC"
                      value={form.excelColonneMontantTtc}
                      placeholder="Optionnel - calculé automatiquement"
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneMontantTtc: value }))}
                    />
                    <ExcelTitleField
                      label="Commission nette"
                      required
                      value={form.excelColonneCommissionNette}
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneCommissionNette: value }))}
                    />
                    <ExcelTitleField
                      label="Net compagnie"
                      value={form.excelColonneNetCompagnie}
                      placeholder="Optionnel - calculé automatiquement"
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneNetCompagnie: value }))}
                    />
                    <ExcelTitleField
                      label="Acte"
                      value={form.excelColonneActe}
                      placeholder="Optionnel"
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneActe: value }))}
                    />
                    <ExcelTitleField
                      label="Catégorie"
                      value={form.excelColonneCategorie}
                      placeholder="Optionnel"
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneCategorie: value }))}
                    />
                    <ExcelTitleField
                      label="Statut"
                      value={form.excelColonneStatut}
                      placeholder="Optionnel"
                      onChange={(value) => setForm((current) => ({ ...current, excelColonneStatut: value }))}
                    />
                  </div>
                </div>
              ) : null}
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
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Compagnie</th>
                  <th className="px-3 py-2">Contrat</th>
                  <th className="px-3 py-2">Affectation</th>
                  <th className="px-3 py-2">Ventilation</th>
                  <th className="px-3 py-2 text-right">Auto</th>
                  <th className="px-3 py-2 text-right">EVCAT</th>
                  <th className="px-3 py-2 text-right">Corporel</th>
                  <th className="px-3 py-2 text-right">Sans alerte / manque / dépassement</th>
                  <th className="px-3 py-2">Période</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index} className="border-t">
                      <td colSpan={11} className="px-3 py-3"><Skeleton className="h-8 w-full" /></td>
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
                      <td className="px-3 py-3">
                        {rule.typeContrat === "FLOTTE"
                          ? "—"
                          : rule.modeVentilation === "PAR_CATEGORIE"
                            ? "Par catégorie"
                            : "Globale"}
                      </td>
                      <td className="px-3 py-3 text-right">{rule.typeContrat === "FLOTTE" ? "—" : rateLabel(rule.tauxCommissionAutomobile)}</td>
                      <td className="px-3 py-3 text-right">{rule.typeContrat === "FLOTTE" ? "—" : rateLabel(rule.tauxCommissionEvcat)}</td>
                      <td className="px-3 py-3 text-right">{rule.typeContrat === "FLOTTE" ? "—" : rateLabel(rule.tauxCommissionCorporel)}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        {rule.typeContrat === "FLOTTE"
                          ? `${moneyLabel(rule.seuilAvertissementEcart)} / ${moneyLabel(rule.margeManquanteMaximale)} / ${moneyLabel(rule.margeDepassementMaximale)}`
                          : "—"}
                      </td>
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
                  <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">Aucune règle configurée.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} / {totalPages} · {rules.data?.page.totalElements ?? 0} règle(s)
            </span>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={currentPage <= 0 || rules.isLoading}
                    className={currentPage <= 0 || rules.isLoading ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.max(0, current - 1));
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={currentPage >= totalPages - 1 || rules.isLoading}
                    className={currentPage >= totalPages - 1 || rules.isLoading ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.min(totalPages - 1, current + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
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

function AmountField({
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
        step="0.01"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      />
    </Field>
  );
}

function ExcelTitleField({
  label,
  value,
  placeholder,
  required,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} required={required}>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
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
  const excelComplete =
    form.typeContrat !== "FLOTTE" ||
    (
      form.excelLigneEntete >= 1 &&
      Boolean(
        form.excelColonneNumeroQuittance.trim() &&
        form.excelColonneDateEffet.trim() &&
        form.excelColonnePrimeNette.trim() &&
        form.excelColonneTaxes.trim() &&
        form.excelColonneCommissionNette.trim()
      )
    );
  return Boolean(
    form.compagnieAssuranceId &&
      form.dateDebut &&
      commissionComplete &&
      excelComplete &&
      form.tauxRetenue != null &&
      form.seuilAvertissementEcart != null &&
      form.margeManquanteMaximale != null &&
      form.margeDepassementMaximale != null &&
      form.seuilAvertissementEcart >= 0 &&
      form.margeManquanteMaximale >= 0 &&
      form.margeDepassementMaximale >= 0 &&
      form.seuilAvertissementEcart <= form.margeManquanteMaximale &&
      form.seuilAvertissementEcart <= form.margeDepassementMaximale &&
      (!form.dateFin || form.dateFin >= form.dateDebut)
  );
}

function ruleToForm(rule: Rule): RuleForm {
  return {
    compagnieAssuranceId: rule.compagnieAssuranceId,
    typeContrat: rule.typeContrat,
    modeVentilation: rule.typeContrat === "FLOTTE" ? "GLOBALE" : rule.modeVentilation ?? "GLOBALE",
    modeCalculCommission: rule.modeCalculCommission,
    tauxCommissionAutomobile: rule.tauxCommissionAutomobile,
    tauxCommissionEvcat: rule.tauxCommissionEvcat,
    tauxCommissionCorporel: rule.tauxCommissionCorporel,
    tauxTvaIncluseCommission: rule.tauxTvaIncluseCommission,
    retenueParDefaut: rule.retenueParDefaut,
    tauxRetenue: rule.tauxRetenue,
    seuilAvertissementEcart: rule.seuilAvertissementEcart,
    margeManquanteMaximale: rule.margeManquanteMaximale,
    margeDepassementMaximale: rule.margeDepassementMaximale,
    dateDebut: rule.dateDebut,
    dateFin: rule.dateFin ?? "",
    excelFeuille: rule.excelFeuille ?? "",
    excelLigneEntete: rule.excelLigneEntete ?? 1,
    excelColonneNumeroPolice: rule.excelColonneNumeroPolice ?? "",
    excelColonneNumeroQuittance: rule.excelColonneNumeroQuittance ?? "",
    excelColonneDateEffet: rule.excelColonneDateEffet ?? "",
    excelColonneDateEcheance: rule.excelColonneDateEcheance ?? "",
    excelColonnePrimeNette: rule.excelColonnePrimeNette ?? "",
    excelColonneTaxes: rule.excelColonneTaxes ?? "",
    excelColonneAccessoires: rule.excelColonneAccessoires ?? "",
    excelColonneMontantTtc: rule.excelColonneMontantTtc ?? "",
    excelColonneCommissionNette: rule.excelColonneCommissionNette ?? "",
    excelColonneNetCompagnie: rule.excelColonneNetCompagnie ?? "",
    excelColonneActe: rule.excelColonneActe ?? "",
    excelColonneCategorie: rule.excelColonneCategorie ?? "",
    excelColonneStatut: rule.excelColonneStatut ?? "",
    actif: rule.actif,
  };
}

function toRequest(form: RuleForm): RuleRequest {
  if (!isComplete(form)) {
    throw new Error("Complétez tous les paramètres obligatoires");
  }
  const isFleet = form.typeContrat === "FLOTTE";
  return {
    compagnieAssuranceId: form.compagnieAssuranceId,
    typeContrat: form.typeContrat,
    modeAffectation: form.typeContrat === "FLOTTE" ? "MANUEL_OU_IMPORT" : "AUTOMATIQUE",
    modeVentilation: form.typeContrat === "FLOTTE" ? "GLOBALE" : form.modeVentilation,
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
    seuilAvertissementEcart: form.seuilAvertissementEcart!,
    margeManquanteMaximale: form.margeManquanteMaximale!,
    margeDepassementMaximale: form.margeDepassementMaximale!,
    dateDebut: form.dateDebut,
    dateFin: form.dateFin || null,
    excelFeuille: isFleet ? form.excelFeuille.trim() || null : null,
    excelLigneEntete: isFleet ? form.excelLigneEntete : 1,
    excelColonneNumeroPolice: isFleet ? form.excelColonneNumeroPolice.trim() || null : null,
    excelColonneNumeroQuittance: isFleet ? form.excelColonneNumeroQuittance.trim() || null : null,
    excelColonneDateEffet: isFleet ? form.excelColonneDateEffet.trim() || null : null,
    excelColonneDateEcheance: isFleet ? form.excelColonneDateEcheance.trim() || null : null,
    excelColonnePrimeNette: isFleet ? form.excelColonnePrimeNette.trim() || null : null,
    excelColonneTaxes: isFleet ? form.excelColonneTaxes.trim() || null : null,
    excelColonneAccessoires: isFleet ? form.excelColonneAccessoires.trim() || null : null,
    excelColonneMontantTtc: isFleet ? form.excelColonneMontantTtc.trim() || null : null,
    excelColonneCommissionNette: isFleet ? form.excelColonneCommissionNette.trim() || null : null,
    excelColonneNetCompagnie: isFleet ? form.excelColonneNetCompagnie.trim() || null : null,
    excelColonneActe: isFleet ? form.excelColonneActe.trim() || null : null,
    excelColonneCategorie: isFleet ? form.excelColonneCategorie.trim() || null : null,
    excelColonneStatut: isFleet ? form.excelColonneStatut.trim() || null : null,
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

function moneyLabel(value: number) {
  return formatAccountingMoney(value);
}
