import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { ConventionInvoiceLines } from "../components/ConventionInvoiceLines";
import { AccessDenied } from "@/components/shared";
import { ConventionWorkspaceHeader } from "../components/ConventionWorkspaceHeader";
import { ConventionBillingSources, billingSelectionKey, type ConventionBillingSource } from "../components/ConventionBillingSources";
import type { ConventionProductionFilters } from "../types";

export default function FacturationConventionsPage() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canView = permissions.includes("quittance:view");
  const canCollect = permissions.includes("reglement-client:view");
  const navigate = useNavigate();
  const canIssue = permissions.includes("quittance:create") || permissions.includes("quittance:manage");
  const queryClient = useQueryClient();
  const [conventionId, setConventionId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [movement, setMovement] = useState<ConventionProductionFilters["categorieMouvement"]>();
  const [premiumDirection, setPremiumDirection] = useState<ConventionProductionFilters["sensPrime"]>();
  const [year, setYear] = useState(new Date().getFullYear());
  const [periodNumber, setPeriodNumber] = useState("ALL");
  const [issueOpen, setIssueOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const validYear = Number.isInteger(year) && year >= 1900 && year <= 2200;
  const options = useQuery({
    queryKey: ["compta", "convention-billing-options", year],
    queryFn: () => comptaApi.conventionBillingOptions(year),
    enabled: canView && validYear,
  });
  const convention = options.data?.find(item => item.id === conventionId);
  const companies = useQuery({ queryKey: ["compta", "companies"], queryFn: comptaApi.companies, enabled: canView });
  const effectiveCompanyId = convention?.compagnieId ?? companyId;
  const conventionOptions = options.data?.filter(item => !companyId || item.compagnieId === companyId);
  const period = convention?.periodes.find(item => String(item.numero) === periodNumber);
  const readyScope = Boolean(canView && validYear && convention && (periodNumber === "ALL" || period) && !convention.blocage);
  const scope = `${conventionId}:${year}:${periodNumber}:${effectiveCompanyId}:${movement}:${premiumDirection}`;
  const preparation = useQuery({
    queryKey: ["compta", "convention-billing-preparation", conventionId, year, periodNumber, effectiveCompanyId, movement, premiumDirection],
    queryFn: () => comptaApi.prepareConventionInvoice({ conventionId, annee: year, periode: periodNumber === "ALL" ? undefined : Number(periodNumber),
      compagnieId: effectiveCompanyId || undefined, categorieMouvement: movement, sensPrime: premiumDirection }),
    enabled: readyScope,
    staleTime: 0,
  });
  const rows = readyScope ? preparation.data?.lignes ?? [] : [];
  const selectedRows = rows.filter(row => selected.has(row.echeanceId));
  const selectedIds = selectedRows.map(row => row.echeanceId);
  const selectedKey = selectedIds.join(",");
  const selectedPayerKey = selectedRows[0] ? billingSelectionKey(selectedRows[0]) : undefined;
  const invoicePreview = useQuery({
    queryKey: ["compta", "convention-invoice-preview", selectedIds],
    queryFn: () => comptaApi.previewConventionInvoice(selectedIds),
    enabled: canIssue && issueOpen && selectedIds.length > 0,
    staleTime: 0,
  });
  const preview = invoicePreview.data;
  const hasLines = Boolean(preview?.lignes.length && selectedIds.length);
  const dueDateProposal = useQuery({
    queryKey: ["compta", "convention-invoice-due-date", selectedIds],
    queryFn: () => comptaApi.proposeConventionInvoiceDueDate(selectedIds),
    enabled: canIssue && issueOpen && selectedIds.length > 0 && !preparation.isError,
  });
  const hasPaymentCondition = dueDateProposal.data?.delaiJours != null;
  const effectiveDueDate = dueDate || dueDateProposal.data?.dateEcheanceProposee || "";
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  useEffect(() => {
    setDueDate("");
    setNotes("");
    setIssueOpen(false);
    setSelected(new Set());
  }, [scope]);

  useEffect(() => {
    setDueDate("");
    setNotes("");
    setIssueOpen(false);
  }, [selectedKey]);

  const issue = useMutation({
    mutationFn: () => {
      if (!preview || !hasLines) throw new Error("Aucune ligne à facturer");
      return comptaApi.createConventionInvoice({
        echeanceIds: selectedIds,
        montantAttendu: preview.total,
        dateEcheance: hasPaymentCondition ? effectiveDueDate || undefined : undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: async document => {
      setIssueOpen(false);
      setDueDate("");
      setNotes("");
      setSelected(new Set());
      toast.success(`${document.totalDocument < 0 ? "Facture de ristourne" : "Facture"} ${document.numero} émise`, {
        action: { label: "Ouvrir", onClick: () => navigate(canCollect
          ? `/app/compta/conventions/encaissements?documentId=${document.id}`
          : `/app/compta/releves-factures?documentId=${document.id}`) },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "convention-billing-preparation"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "convention-billing"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "convention-invoice-receivables"] }),
      ]);
    },
    onError: error => {
      setIssueOpen(false);
      toast.error(error instanceof Error ? error.message : "Émission impossible");
      void preparation.refetch();
      void invoicePreview.refetch();
      void queryClient.invalidateQueries({ queryKey: ["compta", "convention-invoice-due-date"] });
    },
  });
  const compatibleSelection = selectedRows.length > 0 && selectedRows.every(row => !row.blocage && billingSelectionKey(row) === selectedPayerKey);
  const canConfirm = canIssue && hasLines && compatibleSelection && (preview?.total ?? 0) !== 0
    && !issue.isPending && !options.isFetching && !preparation.isFetching && !preparation.isError
    && !invoicePreview.isFetching && !invoicePreview.isError
    && !dueDateProposal.isFetching && !dueDateProposal.isError && Boolean(dueDateProposal.data)
    && (!hasPaymentCondition || Boolean(effectiveDueDate));
  const canSelect = canIssue && readyScope && !preparation.isFetching && !preparation.isError && !issue.isPending;
  const canPrepare = canSelect && compatibleSelection;

  function toggleRow(row: ConventionBillingSource, checked: boolean) {
    if (checked && selectedPayerKey && billingSelectionKey(row) !== selectedPayerKey) return;
    setSelected(current => {
      const next = new Set(current);
      if (checked) next.add(row.echeanceId);
      else next.delete(row.echeanceId);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    if (!checked) { setSelected(new Set()); return; }
    const first = selectedRows[0] ?? rows.find(row => !row.blocage && row.details.length);
    if (!first) return;
    setSelected(new Set(rows.filter(row => !row.blocage && row.details.length && billingSelectionKey(row) === billingSelectionKey(first)).map(row => row.echeanceId)));
  }

  if (!canView) return <AccessDenied />;
  return <div className="mx-auto grid w-full max-w-[1600px] gap-4">
    <ConventionWorkspaceHeader title="Établissement des factures" />

    <section className="border-y bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid w-full min-w-0 gap-1.5 sm:max-w-[320px] sm:flex-[1_1_220px]">
          <Label htmlFor="billing-company">Compagnie</Label>
          <Select value={effectiveCompanyId || "ALL"} disabled={issue.isPending || !!conventionId || companies.isPending || companies.isError}
            onValueChange={value => { setCompanyId(value === "ALL" ? "" : value); setConventionId(""); setPeriodNumber("ALL"); }}>
            <SelectTrigger id="billing-company"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les compagnies</SelectItem>
              {convention?.compagnieId && !companies.data?.some(item => item.id === convention.compagnieId) ? <SelectItem value={convention.compagnieId}>{convention.compagnie || "-"}</SelectItem> : null}
              {companies.data?.map(item => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-full min-w-0 gap-1.5 sm:max-w-[320px] sm:flex-[1_1_220px]">
          <Label htmlFor="billing-convention">Convention</Label>
          <Select value={conventionId} disabled={issue.isPending || options.isLoading} onValueChange={value => {
            setConventionId(value === "NONE" ? "" : value); setPeriodNumber("ALL");
            if (value !== "NONE") setCompanyId(options.data?.find(item => item.id === value)?.compagnieId ?? "");
          }}>
            <SelectTrigger id="billing-convention"><SelectValue placeholder="Sélectionner une convention" /></SelectTrigger>
            <SelectContent><SelectItem value="NONE">Aucune convention sélectionnée</SelectItem>{conventionOptions?.map(item => <SelectItem key={item.id} value={item.id}>{item.intitule}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid w-28 shrink-0 gap-1.5">
          <Label htmlFor="billing-year">Année du cycle</Label>
          <Input id="billing-year" type="number" min={1900} max={2200} value={year} disabled={issue.isPending}
            onChange={event => { setYear(Number(event.target.value)); setPeriodNumber("ALL"); }} />
        </div>
        <div className="grid w-full min-w-0 gap-1.5 sm:max-w-[440px] sm:flex-[1.5_1_320px]">
          <Label htmlFor="billing-period">Période à facturer</Label>
          <Select value={periodNumber} disabled={issue.isPending || !convention?.periodes.length} onValueChange={setPeriodNumber}>
            <SelectTrigger id="billing-period"><SelectValue placeholder="Sélectionner une période" /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">Toutes les périodes</SelectItem>{convention?.periodes.map(item => <SelectItem key={item.numero} value={String(item.numero)}>
              {periodLabel(convention.fractionnement, item.numero)} · {shortDate(item.debut)} au {shortDate(item.fin)}
            </SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid w-full min-w-0 gap-1.5 sm:max-w-[280px] sm:flex-[1_1_200px]"><Label>Mouvement</Label>
          <Select value={movement ?? "ALL"} disabled={issue.isPending} onValueChange={value => setMovement(value === "ALL" ? undefined : value as ConventionProductionFilters["categorieMouvement"])}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les mouvements</SelectItem><SelectItem value="AFFAIRE_NOUVELLE">Affaire nouvelle</SelectItem><SelectItem value="RENOUVELLEMENT">Renouvellement / Terme</SelectItem><SelectItem value="AVENANT">Avenant</SelectItem></SelectContent>
          </Select></div>
        <div className="grid w-full min-w-0 gap-1.5 sm:max-w-[280px] sm:flex-[1_1_200px]"><Label>Sens de prime</Label>
          <Select value={premiumDirection ?? "ALL"} disabled={issue.isPending} onValueChange={value => setPremiumDirection(value === "ALL" ? undefined : value as ConventionProductionFilters["sensPrime"])}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les sens</SelectItem><SelectItem value="PRIME_A_PAYER">Prime à payer</SelectItem><SelectItem value="RISTOURNE">Ristourne</SelectItem><SelectItem value="SANS_INCIDENCE">Sans incidence</SelectItem></SelectContent>
          </Select></div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="icon" title="Actualiser" aria-label="Actualiser"
            disabled={issue.isPending || options.isFetching || preparation.isFetching} onClick={() => {
              void options.refetch();
              if (readyScope) void preparation.refetch();
            }}><RefreshCw className="size-4" /></Button>
          <Button type="button" variant="outline" size="icon" title="Réinitialiser" aria-label="Réinitialiser" disabled={issue.isPending}
            onClick={() => { setConventionId(""); setCompanyId(""); setMovement(undefined); setPremiumDirection(undefined); setPeriodNumber("ALL"); setYear(new Date().getFullYear()); }}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>
      {!validYear && <p role="alert" className="mt-3 text-sm text-destructive">Sélectionnez une année entre 1900 et 2200.</p>}
      {options.isError && <p role="alert" className="mt-3 text-sm text-destructive">{options.error.message}</p>}
      {companies.isError && <p role="alert" className="mt-3 text-sm text-destructive">{companies.error.message}</p>}
      {convention?.blocage && <p role="alert" className="mt-3 text-sm text-destructive">{convention.blocage}</p>}
    </section>

    <section className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Lignes à facturer</h2>
          {readyScope && preparation.data && <p className="mt-1 text-sm text-muted-foreground">
            {preparation.data.convention} · {periodNumber === "ALL" ? "Toutes les périodes" : periodLabel(convention?.fractionnement ?? null, Number(periodNumber))} · {year}
            {` · du ${shortDate(preparation.data.periodeDebut)} au ${shortDate(preparation.data.periodeFin)}`}
          </p>}
        </div>
        <span className="text-xs text-muted-foreground">Montants en MAD</span>
      </div>
      <ConventionBillingSources
        rows={rows} selected={selected} selectionKey={selectedPayerKey} canSelect={canSelect}
        onToggle={toggleRow} onTogglePage={togglePage}
        error={preparation.isError && readyScope ? preparation.error.message : undefined}
        loading={Boolean(readyScope && preparation.isPending)}
        emptyMessage={readyScope ? "Aucune ligne à facturer pour ces critères." : "Sélectionnez une convention."}
      />
      {readyScope && !preparation.isPending && !preparation.isError && !rows.length && <div>
        <Button asChild variant="outline"><Link to={canCollect ? "/app/compta/conventions/encaissements" : "/app/compta/releves-factures"}>Consulter les factures émises</Link></Button>
      </div>}
    </section>

    {canIssue && rows.length > 0 && !preparation.isError && <section className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-sm text-muted-foreground">{selectedRows.length ? `${selectedRows[0].payeurNom} · ${selectedRows.length} échéance(s) sélectionnée(s)` : "Aucune sélection"}</p>
      <Button type="button" disabled={!canPrepare} onClick={() => setIssueOpen(true)}><FilePlus2 className="size-4" />Préparer la facture</Button>
    </section>}

    <Dialog open={issueOpen} onOpenChange={open => { if (!issue.isPending) setIssueOpen(open); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[min(1400px,96vw)]">
        <DialogHeader>
          <DialogTitle>{(preview?.total ?? 0) < 0 ? "Émettre la facture de ristourne" : "Émettre la facture convention"}</DialogTitle>
          <DialogDescription>{preview ? `${preview.convention} · ${preview.payeur} · du ${shortDate(preview.periodeDebut)} au ${shortDate(preview.periodeFin)}` : "Préparation de la facture sélectionnée"}</DialogDescription>
        </DialogHeader>
        <ConventionInvoiceLines
          preview={preview ?? { convention: "", payeur: null, periodeDebut: "", periodeFin: "", total: 0, lignes: [] }}
          headerTone="accounting" loading={invoicePreview.isPending} error={invoicePreview.isError ? invoicePreview.error.message : undefined}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {hasPaymentCondition && <div className="grid content-start gap-1.5">
            <Label>Date limite de paiement</Label>
            <DatePicker date={effectiveDueDate || undefined} minDate={today} disabled={issue.isPending}
              maxDate={dueDateProposal.data?.dateEcheanceProposee ? parseLocalDate(dueDateProposal.data.dateEcheanceProposee) : undefined}
              onSelect={date => setDueDate(toDateOnly(date) ?? "")} />
          </div>}
          <div className={`grid gap-1.5 ${!hasPaymentCondition ? "sm:col-span-2" : ""}`}>
            <Label htmlFor="billing-notes">Notes</Label>
            <Textarea id="billing-notes" value={notes} maxLength={1000} disabled={issue.isPending} onChange={event => setNotes(event.target.value)} />
          </div>
        </div>
        {dueDateProposal.isError && <p role="alert" className="text-sm text-destructive">{dueDateProposal.error.message}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={issue.isPending} onClick={() => setIssueOpen(false)}>Annuler</Button>
          <Button type="button" disabled={!canConfirm} onClick={() => issue.mutate()}>{issue.isPending ? "Émission..." : "Émettre la facture"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function periodLabel(frequency: string | null, number: number) {
  const label = frequency === "TRIMESTRIEL" ? "Trimestre" : frequency === "SEMESTRIEL" ? "Semestre" : frequency === "MENSUEL" ? "Mois" : "Année";
  return `${label} ${number}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`));
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
