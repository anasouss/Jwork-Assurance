import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { ConventionBillingSources, payerKey, type ConventionBillingSource } from "../components/ConventionBillingSources";

export default function FacturationConventionsPage() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canIssue = permissions.includes("quittance:create") || permissions.includes("quittance:manage");
  const queryClient = useQueryClient();
  const [conventionId, setConventionId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [periodNumber, setPeriodNumber] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const validYear = Number.isInteger(year) && year >= 1900 && year <= 2200;
  const options = useQuery({
    queryKey: ["compta", "convention-billing-options", year],
    queryFn: () => comptaApi.conventionBillingOptions(year),
    enabled: validYear,
  });
  const convention = options.data?.find(item => item.id === conventionId);
  const period = convention?.periodes.find(item => String(item.numero) === periodNumber);
  const readyScope = Boolean(validYear && period && !convention?.blocage);
  const scope = `${conventionId}:${year}:${periodNumber}`;
  const preparation = useQuery({
    queryKey: ["compta", "convention-billing-preparation", conventionId, year, periodNumber],
    queryFn: () => comptaApi.prepareConventionInvoice({ conventionId, annee: year, periode: Number(periodNumber) }),
    enabled: readyScope,
    staleTime: 0,
  });
  const rows = readyScope ? preparation.data?.lignes ?? [] : [];
  const selectedRows = rows.filter(row => selected.has(row.echeanceId));
  const selectedIds = selectedRows.map(row => row.echeanceId);
  const selectedKey = selectedIds.join(",");
  const selectedPayerKey = selectedRows[0] ? payerKey(selectedRows[0]) : undefined;
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
      toast.success(`Facture ${document.numero} émise`, {
        action: { label: "Ouvrir", onClick: () => window.open(`/app/compta/releves-factures?documentId=${document.id}`, "_blank", "noopener,noreferrer") },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "convention-billing-preparation"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "convention-billing"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-documents"] }),
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
  const compatibleSelection = selectedRows.length > 0 && selectedRows.every(row => !row.blocage && payerKey(row) === selectedPayerKey);
  const canConfirm = canIssue && hasLines && compatibleSelection && (preview?.total ?? 0) > 0
    && !issue.isPending && !options.isFetching && !preparation.isFetching && !preparation.isError
    && !invoicePreview.isFetching && !invoicePreview.isError
    && !dueDateProposal.isFetching && !dueDateProposal.isError && Boolean(dueDateProposal.data)
    && (!hasPaymentCondition || Boolean(effectiveDueDate));
  const canSelect = canIssue && readyScope && !preparation.isFetching && !preparation.isError && !issue.isPending;
  const canPrepare = canSelect && compatibleSelection;

  function toggleRow(row: ConventionBillingSource, checked: boolean) {
    if (checked && selectedPayerKey && payerKey(row) !== selectedPayerKey) return;
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
    setSelected(new Set(rows.filter(row => !row.blocage && row.details.length && payerKey(row) === payerKey(first)).map(row => row.echeanceId)));
  }

  return <div className="mx-auto grid w-full max-w-[1600px] gap-4">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
        <h1 className="mt-1 text-xl font-semibold">Facturation conventions</h1>
      </div>
      <Button asChild variant="outline"><Link to="/app/compta/conventions/production">Consultation de la production</Link></Button>
    </header>

    <section className="border-y bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid w-full min-w-0 gap-1.5 sm:max-w-[320px] sm:flex-[1_1_220px]">
          <Label htmlFor="billing-convention">Convention</Label>
          <Select value={conventionId} disabled={issue.isPending || options.isLoading} onValueChange={value => {
            setConventionId(value); setPeriodNumber("");
          }}>
            <SelectTrigger id="billing-convention"><SelectValue placeholder="Sélectionner une convention" /></SelectTrigger>
            <SelectContent>{options.data?.map(item => <SelectItem key={item.id} value={item.id}>{item.intitule}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid w-28 shrink-0 gap-1.5">
          <Label htmlFor="billing-year">Année du cycle</Label>
          <Input id="billing-year" type="number" min={1900} max={2200} value={year} disabled={issue.isPending}
            onChange={event => { setYear(Number(event.target.value)); setPeriodNumber(""); }} />
        </div>
        <div className="grid w-full min-w-0 gap-1.5 sm:max-w-[440px] sm:flex-[1.5_1_320px]">
          <Label htmlFor="billing-period">Période à facturer</Label>
          <Select value={periodNumber} disabled={issue.isPending || !convention?.periodes.length} onValueChange={setPeriodNumber}>
            <SelectTrigger id="billing-period"><SelectValue placeholder="Sélectionner une période" /></SelectTrigger>
            <SelectContent>{convention?.periodes.map(item => <SelectItem key={item.numero} value={String(item.numero)}>
              {periodLabel(convention.fractionnement, item.numero)} · {shortDate(item.debut)} au {shortDate(item.fin)}
            </SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="icon" title="Actualiser" aria-label="Actualiser"
            disabled={issue.isPending || options.isFetching || preparation.isFetching} onClick={() => {
              void options.refetch();
              if (period) void preparation.refetch();
            }}><RefreshCw className="size-4" /></Button>
          <Button type="button" variant="outline" size="icon" title="Réinitialiser" aria-label="Réinitialiser" disabled={issue.isPending}
            onClick={() => { setConventionId(""); setPeriodNumber(""); setYear(new Date().getFullYear()); }}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>
      {!validYear && <p role="alert" className="mt-3 text-sm text-destructive">Sélectionnez une année entre 1900 et 2200.</p>}
      {options.isError && <p role="alert" className="mt-3 text-sm text-destructive">{options.error.message}</p>}
      {convention?.blocage && <p role="alert" className="mt-3 text-sm text-destructive">{convention.blocage}</p>}
    </section>

    <section className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Lignes à facturer</h2>
          {readyScope && preparation.data && <p className="mt-1 text-sm text-muted-foreground">
            {preparation.data.convention} · {periodLabel(convention?.fractionnement ?? null, Number(periodNumber))} · {year}
            {` · du ${shortDate(preparation.data.periodeDebut)} au ${shortDate(preparation.data.periodeFin)}`}
          </p>}
        </div>
        <span className="text-xs text-muted-foreground">Montants en MAD</span>
      </div>
      <ConventionBillingSources
        rows={rows} selected={selected} selectionKey={selectedPayerKey} canSelect={canSelect}
        onToggle={toggleRow} onTogglePage={togglePage}
        error={preparation.isError && period ? preparation.error.message : undefined}
        loading={Boolean(period && preparation.isPending)}
        emptyMessage={period ? "Aucune ligne à facturer pour cette convention et cette période." : "Sélectionnez une convention et une période."}
      />
      {period && !preparation.isPending && !preparation.isError && !rows.length && <div>
        <Button asChild variant="outline"><Link to="/app/compta/releves-factures">Consulter les relevés et factures</Link></Button>
      </div>}
    </section>

    {canIssue && rows.length > 0 && !preparation.isError && <section className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-sm text-muted-foreground">{selectedRows.length ? `${selectedRows[0].payeurNom} · ${selectedRows.length} échéance(s) sélectionnée(s)` : "Aucune sélection"}</p>
      <Button type="button" disabled={!canPrepare} onClick={() => setIssueOpen(true)}><FilePlus2 className="size-4" />Préparer la facture</Button>
    </section>}

    <Dialog open={issueOpen} onOpenChange={open => { if (!issue.isPending) setIssueOpen(open); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[min(1400px,96vw)]">
        <DialogHeader>
          <DialogTitle>Émettre la facture convention</DialogTitle>
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
        {preview && preview.total <= 0 && <p role="alert" className="text-sm text-destructive">Le solde créditeur nécessite un avoir ; il ne peut pas être émis comme une facture positive.</p>}
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
