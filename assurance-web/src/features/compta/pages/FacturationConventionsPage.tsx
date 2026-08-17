import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FilePlus2, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import type {
  ConventionBillingInstallment,
  ConventionBillingStatus,
} from "../types";

const PAGE_SIZE = 25;

type Filters = {
  search: string;
  statut: "ALL" | ConventionBillingStatus;
  compagnieId: string;
  dateDu: string;
  dateAu: string;
};

const INITIAL_FILTERS: Filters = {
  search: "",
  statut: "ALL",
  compagnieId: "ALL",
  dateDu: "",
  dateAu: "",
};

export default function FacturationConventionsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canIssue = permissions.includes("quittance:create") || permissions.includes("quittance:manage");
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [applied, setApplied] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, ConventionBillingInstallment>>({});
  const [issueOpen, setIssueOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const companies = useQuery({
    queryKey: ["compta", "companies"],
    queryFn: comptaApi.companies,
    staleTime: 60_000,
  });
  const params = useMemo(() => ({
    statut: applied.statut === "ALL" ? undefined : applied.statut,
    compagnieId: applied.compagnieId === "ALL" ? undefined : applied.compagnieId,
    dateDu: applied.dateDu || undefined,
    dateAu: applied.dateAu || undefined,
    search: applied.search.trim() || undefined,
    page,
    size: PAGE_SIZE,
  }), [applied, page]);
  const installments = useQuery({
    queryKey: ["compta", "convention-billing", params],
    queryFn: () => comptaApi.conventionBillingInstallments(params),
  });

  const selectedRows = Object.values(selected);
  const selectedIds = selectedRows.map((row) => row.id);
  const selectedKey = selectedIds.join(",");
  const selectableRows = (installments.data?.rows ?? []).filter(isSelectable);
  const allPageSelected = selectableRows.length > 0
    && selectableRows.every((row) => Boolean(selected[row.id]));
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.montantTtc, 0);
  const dueDateProposal = useQuery({
    queryKey: ["compta", "convention-invoice-due-date", selectedIds],
    queryFn: () => comptaApi.proposeConventionInvoiceDueDate(selectedIds),
    enabled: issueOpen && selectedIds.length > 0,
  });
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const maximumDueDate = dueDateProposal.data?.dateEcheanceProposee
    ? parseLocalDate(dueDateProposal.data.dateEcheanceProposee)
    : undefined;

  useEffect(() => {
    if (!issueOpen) return;
    setDueDate("");
  }, [issueOpen, selectedKey]);

  useEffect(() => {
    if (!dueDate && dueDateProposal.data?.dateEcheanceProposee) {
      setDueDate(dueDateProposal.data.dateEcheanceProposee);
    }
  }, [dueDate, dueDateProposal.data]);

  const issue = useMutation({
    mutationFn: () => comptaApi.createConventionInvoice({
      echeanceIds: selectedIds,
      dateEcheance: dueDate || undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: async (document) => {
      toast.success(`Facture ${document.numero} émise`);
      setIssueOpen(false);
      setSelected({});
      setDueDate("");
      setNotes("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "convention-billing"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-documents"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Émission impossible"),
  });

  function applyFilters() {
    setPage(0);
    setSelected({});
    setApplied(filters);
  }

  function resetFilters() {
    setFilters(INITIAL_FILTERS);
    setApplied(INITIAL_FILTERS);
    setPage(0);
    setSelected({});
  }

  function toggleRow(row: ConventionBillingInstallment, checked: boolean) {
    if (!checked) {
      setSelected((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      return;
    }
    const payerKey = `${row.payeurType}:${row.payeurId}`;
    const incompatible = selectedRows.some(
      (item) => `${item.payeurType}:${item.payeurId}` !== payerKey
    );
    if (incompatible) {
      toast.error("Une facture ne peut regrouper que les échéances d'un même payeur.");
      return;
    }
    setSelected((current) => ({ ...current, [row.id]: row }));
  }

  function togglePage(checked: boolean) {
    if (!checked) {
      setSelected({});
      return;
    }
    const first = selectableRows[0];
    if (!first) return;
    const payerKey = `${first.payeurType}:${first.payeurId}`;
    setSelected(Object.fromEntries(
      selectableRows
        .filter((row) => `${row.payeurType}:${row.payeurId}` === payerKey)
        .map((row) => [row.id, row])
    ));
  }

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-4">
      <header>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
        <h1 className="mt-1 text-xl font-semibold">Facturation conventions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Échéances contractuelles et factures des conventions réglées sur facture.
        </p>
      </header>

      <section className="border-y bg-card px-4 py-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_180px_180px_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="billing-search">Cible, dossier, police ou convention</Label>
            <Input
              id="billing-search"
              value={filters.search}
              placeholder="Rechercher..."
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              onKeyDown={(event) => event.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Compagnie</Label>
            <Select
              value={filters.compagnieId}
              onValueChange={(value) => setFilters((current) => ({ ...current, compagnieId: value }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes</SelectItem>
                {(companies.data ?? []).map((company) => (
                  <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateFilter
            label="Échéance du"
            value={filters.dateDu}
            onChange={(value) => setFilters((current) => ({ ...current, dateDu: value }))}
          />
          <DateFilter
            label="Échéance au"
            value={filters.dateAu}
            onChange={(value) => setFilters((current) => ({ ...current, dateAu: value }))}
          />
          <div className="flex items-end gap-2">
            <Button type="button" onClick={applyFilters} title="Rechercher">
              <Search className="size-4" />
            </Button>
            <Button type="button" variant="outline" onClick={resetFilters} title="Réinitialiser">
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 w-56">
          <Select
            value={filters.statut}
            onValueChange={(value) => setFilters((current) => ({
              ...current,
              statut: value as Filters["statut"],
            }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              <SelectItem value="A_FACTURER">À facturer</SelectItem>
              <SelectItem value="FACTUREE">Facturées</SelectItem>
              <SelectItem value="ANNULEE">Annulées</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="grid grid-cols-2 divide-x border md:grid-cols-4">
        <Metric label="Échéances" value={String(installments.data?.summary.total ?? 0)} />
        <Metric label="À facturer" value={String(installments.data?.summary.aFacturer ?? 0)} />
        <Metric label="Facturées" value={String(installments.data?.summary.facturees ?? 0)} />
        <Metric label="Montant à facturer" value={money(installments.data?.summary.montantAFacturer ?? 0)} />
      </section>

      <section className="overflow-hidden border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="font-semibold">Échéances de facturation</h2>
          {canIssue ? (
            <Button
              type="button"
              disabled={!selectedRows.length}
              onClick={() => setIssueOpen(true)}
            >
              <FilePlus2 className="size-4" />
              Émettre la facture ({selectedRows.length})
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white">
              <tr>
                <th className="w-12 px-3 py-3 text-center">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={(value) => togglePage(value === true)}
                    aria-label="Sélectionner les échéances compatibles de la page"
                  />
                </th>
                <th className="px-3 py-3 text-left">Cible</th>
                <th className="px-3 py-3 text-left">Convention / contrat</th>
                <th className="px-3 py-3 text-left">Compagnie</th>
                <th className="px-3 py-3 text-left">Période</th>
                <th className="px-3 py-3 text-left">Échéance</th>
                <th className="px-3 py-3 text-right">Prime nette</th>
                <th className="px-3 py-3 text-right">Taxes</th>
                <th className="px-3 py-3 text-right">Accessoires</th>
                <th className="px-3 py-3 text-right">TTC</th>
                <th className="px-3 py-3 text-center">Statut</th>
                <th className="w-14 px-3 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {installments.isLoading ? (
                <TableRowsSkeleton colSpan={12} rows={8} />
              ) : installments.isError ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-destructive">
                  {installments.error instanceof Error ? installments.error.message : "Chargement impossible"}
                </td></tr>
              ) : !installments.data?.rows.length ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                  Aucune échéance ne correspond aux filtres.
                </td></tr>
              ) : installments.data.rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3 text-center">
                    <Checkbox
                      checked={Boolean(selected[row.id])}
                      disabled={!isSelectable(row)}
                      onCheckedChange={(value) => toggleRow(row, value === true)}
                      aria-label={`Sélectionner l'échéance ${row.numeroPeriode}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{row.payeurNom}</div>
                    <div className="text-xs text-muted-foreground">{row.payeurType === "GROUPE" ? "Groupe" : "Client"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{row.convention || "Convention"}</div>
                    <div className="text-xs text-muted-foreground">{row.numeroDossier || row.numeroPolice || "-"}</div>
                  </td>
                  <td className="px-3 py-3">{row.compagnie || "-"}</td>
                  <td className="px-3 py-3">
                    <div>{shortDate(row.periodeDebut)} au {shortDate(row.periodeFin)}</div>
                    <div className="text-xs text-muted-foreground">Période {row.numeroPeriode}/{row.nombrePeriodes}</div>
                  </td>
                  <td className="px-3 py-3">{shortDate(row.dateEcheance)}</td>
                  <Amount value={row.primeNette} />
                  <Amount value={row.taxes} />
                  <Amount value={row.accessoires} />
                  <Amount value={row.montantTtc} strong />
                  <td className="px-3 py-3 text-center"><StatusBadge status={row.statut} /></td>
                  <td className="px-3 py-3 text-center">
                    {row.documentId ? (
                      <a
                        href={`/app/compta/releves-factures?documentId=${row.documentId}`}
                        className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                        title="Voir le document"
                      >
                        <Eye className="size-4" />
                      </a>
                    ) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ServerPagination
          className="border-t px-4 py-3"
          page={installments.data?.page.number ?? page}
          totalPages={installments.data?.page.totalPages ?? 0}
          totalElements={installments.data?.page.totalElements ?? 0}
          loading={installments.isFetching}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            setSelected({});
          }}
        />
      </section>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Émettre la facture convention</DialogTitle>
            <DialogDescription>
              {selectedRows.length} échéance(s) pour {selectedRows[0]?.payeurNom}. Total : {money(selectedTotal)} MAD.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Date limite de paiement</Label>
              <DatePicker
                date={dueDate || undefined}
                minDate={today}
                maxDate={maximumDueDate}
                onSelect={(date) => setDueDate(toDateOnly(date) ?? "")}
              />
              {dueDateProposal.isLoading ? (
                <p className="text-xs text-muted-foreground">Calcul de l’échéance applicable...</p>
              ) : dueDateProposal.isError ? (
                <p className="text-xs text-destructive">Impossible de déterminer le délai applicable.</p>
              ) : dueDateProposal.data ? (
                <p className="text-xs text-muted-foreground">
                  {dueDateProposal.data.origine === "DEFAUT_60_JOURS"
                    ? "Délai par défaut"
                    : dueDateProposal.data.origine === "CONDITION_GROUPE"
                      ? "Condition du groupe"
                      : "Condition du client"}
                  {` : ${dueDateProposal.data.delaiJours} jours maximum.`}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-notes">Notes</Label>
              <Textarea
                id="invoice-notes"
                value={notes}
                maxLength={1000}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIssueOpen(false)}>Annuler</Button>
            <Button
              type="button"
              disabled={issue.isPending || !dueDate || dueDateProposal.isLoading || dueDateProposal.isError}
              onClick={() => issue.mutate()}
            >
              {issue.isPending ? "Émission..." : "Émettre la facture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <DatePicker
        date={value || undefined}
        onSelect={(date) => onChange(toDateOnly(date) ?? "")}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Amount({ value, strong = false }: { value: number; strong?: boolean }) {
  return <td className={`px-3 py-3 text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{money(value)}</td>;
}

function StatusBadge({ status }: { status: ConventionBillingStatus }) {
  if (status === "FACTUREE") return <Badge variant="success">Facturée</Badge>;
  if (status === "ANNULEE") return <Badge variant="gray">Annulée</Badge>;
  return <Badge variant="warning">À facturer</Badge>;
}

function isSelectable(row: ConventionBillingInstallment) {
  return row.statut === "A_FACTURER" && row.montantTtc !== 0;
}

function money(value: number) {
  return formatAccountingAmount(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`));
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
