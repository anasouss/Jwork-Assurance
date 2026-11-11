import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FilePlus2, RotateCcw, Search } from "lucide-react";
import { toast } from "@/lib/toast";
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
import { ConventionInvoiceLines } from "../components/ConventionInvoiceLines";
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
  conventionId: string;
  annee: number;
  periode: string;
};

const INITIAL_FILTERS: Filters = {
  search: "",
  statut: "ALL",
  compagnieId: "ALL",
  dateDu: "",
  dateAu: "",
  conventionId: "",
  annee: new Date().getFullYear(),
  periode: "",
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
  const conventions = useQuery({
    queryKey: ["compta", "convention-billing-options", filters.annee],
    queryFn: () => comptaApi.conventionBillingOptions(filters.annee),
  });
  const convention = conventions.data?.find(item => item.id === filters.conventionId);
  const params = useMemo(() => ({
    statut: applied.statut === "ALL" ? undefined : applied.statut,
    compagnieId: applied.compagnieId === "ALL" ? undefined : applied.compagnieId,
    conventionId: applied.conventionId || undefined,
    dateDu: applied.dateDu || undefined,
    dateAu: applied.dateAu || undefined,
    search: applied.search.trim() || undefined,
    page,
    size: PAGE_SIZE,
  }), [applied, page]);
  const installments = useQuery({
    queryKey: ["compta", "convention-billing", params],
    queryFn: () => comptaApi.conventionBillingInstallments(params),
    enabled: Boolean(applied.conventionId && applied.dateDu && applied.dateAu),
  });

  const selectedRows = Object.values(selected);
  const selectedIds = selectedRows.map((row) => row.id);
  const selectedKey = selectedIds.join(",");
  const selectableRows = (installments.data?.rows ?? []).filter(isSelectable);
  const allPageSelected = selectableRows.length > 0
    && selectableRows.every((row) => Boolean(selected[row.id]));
  const preview = useQuery({
    queryKey: ["compta", "convention-invoice-preview", selectedIds],
    queryFn: () => comptaApi.previewConventionInvoice(selectedIds),
    enabled: issueOpen && selectedIds.length > 0,
    staleTime: 0,
  });
  const dueDateProposal = useQuery({
    queryKey: ["compta", "convention-invoice-due-date", selectedIds],
    queryFn: () => comptaApi.proposeConventionInvoiceDueDate(selectedIds),
    enabled: issueOpen && selectedIds.length > 0,
  });
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const maximumDueDate = dueDateProposal.data?.dateEcheanceProposee
    ? parseLocalDate(dueDateProposal.data.dateEcheanceProposee)
    : undefined;
  const hasPaymentCondition = dueDateProposal.data?.delaiJours != null;

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
      montantAttendu: preview.data!.total,
      dateEcheance: hasPaymentCondition ? dueDate || undefined : undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: async (document) => {
      toast.success(`Facture ${document.numero} émise`, {
        action: { label: "Ouvrir", onClick: () => window.open(`/app/compta/releves-factures?documentId=${document.id}`, "_blank", "noopener,noreferrer") },
      });
      setIssueOpen(false);
      setSelected({});
      setDueDate("");
      setNotes("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "convention-billing"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-documents"] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Émission impossible");
      void preview.refetch();
    },
  });

  function applyFilters() {
    const period = convention?.periodes.find(item => String(item.numero) === filters.periode);
    if (!period) {
      toast.error(convention?.blocage || "Sélectionnez une convention et une période de facturation.");
      return;
    }
    setPage(0);
    setSelected({});
    setApplied({ ...filters, dateDu: period.debut, dateAu: period.debut });
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
    const payerKey = selectionKey(row);
    const incompatible = selectedRows.some(
      (item) => selectionKey(item) !== payerKey
    );
    if (incompatible) {
      toast.error("Sélectionnez une seule convention, une seule période et un même payeur.");
      return;
    }
    setSelected((current) => ({ ...current, [row.id]: row }));
  }

  function togglePage(checked: boolean) {
    if (!checked) {
      setSelected(current => Object.fromEntries(Object.entries(current).filter(([id]) => !selectableRows.some(row => row.id === id))));
      return;
    }
    const first = selectedRows[0] ?? selectableRows[0];
    if (!first) return;
    const payerKey = selectionKey(first);
    setSelected(current => ({ ...current, ...Object.fromEntries(
      selectableRows
        .filter((row) => selectionKey(row) === payerKey)
        .map((row) => [row.id, row])
    ) }));
  }

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
        <h1 className="mt-1 text-xl font-semibold">Facturation conventions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Échéances contractuelles et factures des conventions réglées sur facture.
        </p>
        </div>
        <Button asChild variant="outline"><Link to="/app/compta/conventions/production">Consultation de la production</Link></Button>
      </header>

      <section className="border-y bg-card px-4 py-4">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[1440px]:grid-cols-[minmax(160px,1fr)_112px_minmax(300px,1.5fr)_minmax(200px,1fr)_minmax(130px,0.8fr)_160px_auto] [&>div]:min-w-0">
          <div className="grid gap-1.5"><Label>Convention</Label>
            <Select value={filters.conventionId} onValueChange={value => setFilters(current => ({ ...current, conventionId: value, periode: "" }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une convention" /></SelectTrigger>
              <SelectContent>{conventions.data?.map(item => <SelectItem key={item.id} value={item.id}>{item.intitule}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="billing-year">Année du cycle</Label>
            <Input id="billing-year" type="number" min={1900} max={2200} value={filters.annee}
              onChange={event => setFilters(current => ({ ...current, annee: Number(event.target.value), periode: "" }))} />
          </div>
          <div className="grid gap-1.5"><Label>Période à facturer</Label>
            <Select value={filters.periode} disabled={!convention?.periodes.length}
              onValueChange={value => setFilters(current => ({ ...current, periode: value }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une période" /></SelectTrigger>
              <SelectContent>{convention?.periodes.map(period => <SelectItem key={period.numero} value={String(period.numero)}>
                {periodLabel(convention.fractionnement, period.numero)} · {shortDate(period.debut)} au {shortDate(period.fin)}
              </SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="billing-search">Destinataire, dossier ou police</Label>
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
          <div className="grid gap-1.5">
            <Label htmlFor="billing-status">Statut</Label>
            <Select
              value={filters.statut}
              onValueChange={(value) => setFilters((current) => ({
                ...current,
                statut: value as Filters["statut"],
              }))}
            >
              <SelectTrigger id="billing-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="A_FACTURER">À facturer</SelectItem>
                <SelectItem value="FACTUREE">Facturées</SelectItem>
                <SelectItem value="ANNULEE">Annulées</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" onClick={applyFilters} title="Rechercher">
              <Search className="size-4" />
            </Button>
            <Button type="button" variant="outline" onClick={resetFilters} title="Réinitialiser">
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
        {convention?.blocage && <p className="mt-3 text-sm text-destructive">{convention.blocage}</p>}
        {conventions.isError && <p className="mt-3 text-sm text-destructive">{conventions.error.message}</p>}
      </section>

      <section className="grid grid-cols-2 divide-x border md:grid-cols-4">
        <Metric label="Échéances" value={String(installments.data?.summary.total ?? 0)} />
        <Metric label="À facturer" value={String(installments.data?.summary.aFacturer ?? 0)} />
        <Metric label="Facturées" value={String(installments.data?.summary.facturees ?? 0)} />
        <Metric label="Montant à facturer" value={money(installments.data?.summary.montantAFacturer ?? 0)} />
      </section>

      <section className="overflow-hidden border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="font-semibold">Échéances de facturation <span className="font-normal text-muted-foreground">· MAD</span></h2>
          {canIssue ? (
            <Button
              type="button"
              disabled={!selectedRows.length}
              onClick={() => setIssueOpen(true)}
            >
              <FilePlus2 className="size-4" />
              Préparer la facture ({selectedRows.length})
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
                <th className="px-3 py-3 text-left">Destinataire</th>
                <th className="px-3 py-3 text-left">Convention / contrat</th>
                <th className="px-3 py-3 text-left">Compagnie</th>
                <th className="px-3 py-3 text-left">Période</th>
                <th className="px-3 py-3 text-right">Montant bulletin</th>
                <th className="px-3 py-3 text-right">Montant à payer</th>
                <th className="px-3 py-3 text-center">Statut</th>
                <th className="w-14 px-3 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {installments.isLoading ? (
                <TableRowsSkeleton colSpan={9} rows={8} />
              ) : installments.isError ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-destructive">
                  {installments.error instanceof Error ? installments.error.message : "Chargement impossible"}
                </td></tr>
              ) : !installments.data?.rows.length ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  {applied.conventionId ? "Aucune échéance ne correspond aux filtres." : "Sélectionnez une convention et une période."}
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
                    {row.mouvementId && <div className="text-xs text-muted-foreground">Avenant {row.numeroMouvement || row.mouvementId}</div>}
                    {row.numeroBonCommande && <div className="text-xs text-muted-foreground">BC : {row.numeroBonCommande}</div>}
                  </td>
                  <td className="px-3 py-3">{row.compagnie || "-"}</td>
                  <td className="px-3 py-3">
                    <div>{shortDate(row.periodeDebut)} au {shortDate(row.periodeFin)}</div>
                    <div className="text-xs text-muted-foreground">{periodLabel(row.fractionnement, row.numeroPeriode)}</div>
                    {row.blocage && <div className="text-xs text-destructive">{row.blocage}</div>}
                  </td>
                  <Amount value={row.montantBulletin} />
                  <Amount value={row.montantTtc} strong />
                  <td className="px-3 py-3 text-center"><StatusBadge status={row.statut} /></td>
                  <td className="px-3 py-3 text-center">
                    {row.documentId ? (
                      <a
                        href={`/app/compta/releves-factures?documentId=${row.documentId}`}
                        target="_blank" rel="noopener noreferrer"
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
          }}
        />
      </section>

      <Dialog open={issueOpen} onOpenChange={open => { if (!issue.isPending) setIssueOpen(open); }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[min(1400px,96vw)]">
          <DialogHeader>
            <DialogTitle>Émettre la facture convention</DialogTitle>
            <DialogDescription>
              {preview.data ? `${preview.data.convention} · ${preview.data.payeur} · du ${shortDate(preview.data.periodeDebut)} au ${shortDate(preview.data.periodeFin)}` : "Aperçu de la facture"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {preview.isLoading && <p className="text-sm text-muted-foreground">Chargement du détail...</p>}
            {preview.isError && <p className="text-sm text-destructive">{preview.error.message}</p>}
            {preview.data && <ConventionInvoiceLines preview={preview.data} />}
            <div className="grid gap-1.5">
              {dueDateProposal.isLoading ? (
                <p className="text-xs text-muted-foreground">Calcul de l’échéance applicable...</p>
              ) : dueDateProposal.isError ? (
                <p className="text-xs text-destructive">Impossible de déterminer le délai applicable.</p>
              ) : hasPaymentCondition && dueDateProposal.data ? (
                <>
                  <Label>Date limite de paiement</Label>
                  <DatePicker
                    date={dueDate || undefined}
                    minDate={today}
                    maxDate={maximumDueDate}
                    onSelect={(date) => setDueDate(toDateOnly(date) ?? "")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {dueDateProposal.data.origine === "CONDITION_GROUPE"
                      ? "Condition du groupe"
                      : "Condition du client"}
                    {` : ${dueDateProposal.data.delaiJours} jours maximum.`}
                  </p>
                </>
              ) : dueDateProposal.data?.dateEcheanceProposee ? (
                <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                  Date d’échéance contractuelle : {shortDate(dueDateProposal.data.dateEcheanceProposee)}.
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
            <Button type="button" variant="outline" disabled={issue.isPending} onClick={() => setIssueOpen(false)}>Annuler</Button>
            <Button
              type="button"
              disabled={issue.isPending
                || preview.isFetching || preview.isError || !preview.data?.lignes.length
                || dueDateProposal.isLoading
                || dueDateProposal.isError
                || (hasPaymentCondition && !dueDate)}
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

function selectionKey(row: ConventionBillingInstallment) {
  return `${row.conventionId}:${row.periodeDebut}:${row.periodeFin}:${row.payeurType}:${row.payeurId}`;
}

function periodLabel(frequency: string | null, number: number) {
  const label = frequency === "TRIMESTRIEL" ? "Trimestre" : frequency === "SEMESTRIEL" ? "Semestre" : frequency === "MENSUEL" ? "Mois" : "Année";
  return `${label} ${number}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Amount({ value, strong = false }: { value: number | null; strong?: boolean }) {
  return <td className={`px-3 py-3 text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{value == null ? "-" : money(value)}</td>;
}

function StatusBadge({ status }: { status: ConventionBillingStatus }) {
  if (status === "FACTUREE") return <Badge variant="success">Facturée</Badge>;
  if (status === "ANNULEE") return <Badge variant="gray">Annulée</Badge>;
  return <Badge variant="warning">À facturer</Badge>;
}

function isSelectable(row: ConventionBillingInstallment) {
  return row.statut === "A_FACTURER" && row.montantTtc !== 0 && !row.blocage;
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
