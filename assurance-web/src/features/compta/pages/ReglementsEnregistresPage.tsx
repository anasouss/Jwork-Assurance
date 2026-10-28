import { useEffect, useState, type ReactNode } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Landmark,
  MoreHorizontal,
  Printer,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SortIcon } from "@/components/ui/sort-icon";
import { toDateOnly } from "@/features/production/date";
import { downloadBlob } from "@/lib/download";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { BankSelect } from "../components/BankSelect";
import { AddInstrumentToRemittanceDialog } from "../components/AddInstrumentToRemittanceDialog";
import { ClientPaymentsWorkspaceHeader } from "../components/ClientPaymentsWorkspaceHeader";
import {
  requiresBankAccountAtEntry,
  requiresPaymentReference,
  showsOriginatingBank,
} from "../client-payment-methods";
import { formatAccountingAmount } from "../format";
import type {
  ClientPayment,
  ClientPaymentMode,
  PaymentInstrument,
  TreasuryAccount,
} from "../types";

const PAGE_SIZE = 25;
const TODAY = toDateOnly(new Date())!;
type PaymentSortBy = "dateReglement" | "numero" | "payeurNom" | "montantTotal" | "statut";

type InstrumentDraft = {
  mode: ClientPaymentMode;
  dateInstrument: string;
  dateEcheance: string;
  referenceInstrument: string;
  banqueEmettriceId: string;
  compteTresorerieId: string;
};

const MODE_LABELS: Record<ClientPaymentMode, string> = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  EFFET: "Effet",
  VIREMENT: "Virement",
  VERSEMENT_BANCAIRE: "Versement bancaire",
};

const MODE_BADGE_VARIANTS: Record<ClientPaymentMode, "success" | "info" | "purple" | "accent" | "gray"> = {
  ESPECES: "success",
  CHEQUE: "info",
  EFFET: "purple",
  VIREMENT: "accent",
  VERSEMENT_BANCAIRE: "gray",
};

const INSTRUMENT_STATUS_LABELS: Record<PaymentInstrument["statut"], string> = {
  EN_ATTENTE: "En instance",
  REMIS_EN_BANQUE: "Remis en banque",
  CONFIRME: "Encaissé",
  REJETE: "Retourné / impayé",
  REMPLACE: "Remplacé",
};

const INSTRUMENT_STATUS_INDICATOR_STYLES: Record<
  PaymentInstrument["statut"],
  { dot: string; text: string }
> = {
  EN_ATTENTE: { dot: "bg-amber-500", text: "text-amber-800 dark:text-amber-300" },
  REMIS_EN_BANQUE: { dot: "bg-blue-500", text: "text-blue-800 dark:text-blue-300" },
  CONFIRME: { dot: "bg-emerald-500", text: "text-emerald-800 dark:text-emerald-300" },
  REJETE: { dot: "bg-red-500", text: "text-red-700 dark:text-red-300" },
  REMPLACE: { dot: "bg-gray-500", text: "text-gray-700 dark:text-gray-300" },
};

export default function ReglementsEnregistresPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get("search")?.trim() ?? "";
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("reglement-client:manage");
  const canManageTreasury = permissions.includes("tresorerie:manage");
  const canCreate = permissions.includes("reglement-client:create") || canManage;
  const canIssueInvoice = permissions.includes("quittance:create")
    || permissions.includes("quittance:manage");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<PaymentSortBy>("dateReglement");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState(initialSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialSearch);
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateDu") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateAu") ?? "");
  const [appliedDateFrom, setAppliedDateFrom] = useState(searchParams.get("dateDu") ?? "");
  const [appliedDateTo, setAppliedDateTo] = useState(searchParams.get("dateAu") ?? "");
  const [paymentMode, setPaymentMode] = useState<ClientPaymentMode | "ALL">(
    (searchParams.get("mode") as ClientPaymentMode | null) ?? "ALL"
  );
  const [instrumentStatus, setInstrumentStatus] = useState<PaymentInstrument["statut"] | "ALL">(
    (searchParams.get("statutInstrument") as PaymentInstrument["statut"] | null) ?? "ALL"
  );
  const [appliedPaymentMode, setAppliedPaymentMode] = useState(paymentMode);
  const [appliedInstrumentStatus, setAppliedInstrumentStatus] = useState(instrumentStatus);
  const [hasAppliedFilters, setHasAppliedFilters] = useState(() => Boolean(
    initialSearch
      || searchParams.get("dateDu")
      || searchParams.get("dateAu")
      || searchParams.get("mode")
      || searchParams.get("statutInstrument")
  ));
  const [paymentToCancel, setPaymentToCancel] = useState<ClientPayment>();
  const [paymentToInvoice, setPaymentToInvoice] = useState<ClientPayment>();
  const [openingPaymentId, setOpeningPaymentId] = useState<string>();
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const journalView = searchParams.get("vue") === "journal" || searchParams.get("journal") === "1";
  const [journalDateFrom, setJournalDateFrom] = useState(TODAY);
  const [journalDateTo, setJournalDateTo] = useState(TODAY);
  const [journalUserId, setJournalUserId] = useState("ALL");
  const [journalMode, setJournalMode] = useState<ClientPaymentMode | "ALL">("ALL");
  const [journalStatus, setJournalStatus] = useState<ClientPayment["statut"] | "ALL">("ALL");
  const [journalLoading, setJournalLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [instrumentToReplace, setInstrumentToReplace] = useState<PaymentInstrument>();
  const [instrumentToRemit, setInstrumentToRemit] = useState<PaymentInstrument>();
  const [replacement, setReplacement] = useState<InstrumentDraft>(newReplacement());
  const [replacementReason, setReplacementReason] = useState("");
  const replacementTargetId = searchParams.get("remplacer");
  const payments = useQuery({
    queryKey: [
      "compta", "client-payments", appliedSearch, appliedDateFrom, appliedDateTo,
      appliedPaymentMode, appliedInstrumentStatus,
      sortBy, sortDirection, page,
    ],
    queryFn: () => comptaApi.clientPayments({
      search: appliedSearch || undefined,
      dateDu: appliedDateFrom || undefined,
      dateAu: appliedDateTo || undefined,
      mode: appliedPaymentMode === "ALL" ? undefined : appliedPaymentMode,
      statutInstrument: appliedInstrumentStatus === "ALL" ? undefined : appliedInstrumentStatus,
      sortBy,
      sortDirection,
      page,
      size: PAGE_SIZE,
    }),
    enabled: !journalView && hasAppliedFilters,
  });

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const banks = useQuery({
    queryKey: ["compta", "banks", "active"],
    queryFn: () => comptaApi.banks(),
  });

  useEffect(() => {
    if (!replacementTargetId || instrumentToReplace || !payments.data) return;
    const target = payments.data.rows
      .flatMap((payment) => payment.instruments)
      .find((instrument) => instrument.id === replacementTargetId
        && instrument.statut === "REJETE");
    if (!target) return;
    setInstrumentToReplace(target);
    setReplacement(newReplacement());
    setReplacementReason("");
    const next = new URLSearchParams(searchParams);
    next.delete("remplacer");
    setSearchParams(next, { replace: true });
  }, [instrumentToReplace, payments.data, replacementTargetId, searchParams, setSearchParams]);

  const journalUsers = useQuery({
    queryKey: ["compta", "client-payment-journal-users"],
    queryFn: comptaApi.clientPaymentJournalUsers,
    enabled: journalView,
  });

  const cancelPayment = useMutation({
    mutationFn: () => comptaApi.cancelClientPayment(paymentToCancel!.id, cancelReason.trim()),
    onSuccess: async (payment) => {
      toast.success(`Règlement ${payment.numero} annulé`);
      closeCancellation();
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Annulation impossible"
    ),
  });

  const createInvoice = useMutation({
    mutationFn: () => comptaApi.createInvoiceFromClientPayment(paymentToInvoice!.id),
    onSuccess: async (invoice) => {
      setPaymentToInvoice(undefined);
      toast.success(`Facture ${invoice.numero} émise`);
      await invalidateAccountingQueries(queryClient);
      try {
        const pdf = await comptaApi.clientDocumentPdf(invoice.id);
        downloadBlob(pdf, `${invoice.numero}.pdf`);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "La facture est créée, mais son PDF n'a pas pu être téléchargé"
        );
      }
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Création de la facture impossible"
    ),
  });

  const replaceInstrument = useMutation({
    mutationFn: () => comptaApi.replacePaymentInstrument(instrumentToReplace!.id, {
      mode: replacement.mode,
      montant: instrumentToReplace!.montant,
      dateInstrument: replacement.dateInstrument || TODAY,
      dateEcheance: replacement.dateEcheance || undefined,
      referenceInstrument: replacement.referenceInstrument.trim() || undefined,
      banqueEmettriceId: replacement.banqueEmettriceId || undefined,
      compteTresorerieId: replacement.mode === "ESPECES"
        ? undefined
        : replacement.compteTresorerieId || undefined,
      motif: replacementReason.trim(),
    }),
    onSuccess: async () => {
      toast.success("Instrument remplacé");
      closeReplacement();
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Remplacement impossible"
    ),
  });

  function closeCancellation() {
    setPaymentToCancel(undefined);
    setCancelReason("");
  }

  function closeReplacement() {
    setInstrumentToReplace(undefined);
    setReplacement(newReplacement());
    setReplacementReason("");
  }

  function resetFilters() {
    setSearch("");
    setAppliedSearch("");
    setDateFrom("");
    setDateTo("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setPaymentMode("ALL");
    setInstrumentStatus("ALL");
    setAppliedPaymentMode("ALL");
    setAppliedInstrumentStatus("ALL");
    setHasAppliedFilters(false);
    setSortBy("dateReglement");
    setSortDirection("desc");
    setPage(0);
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  function applyFilters() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error("La date de début doit précéder la date de fin");
      return;
    }
    const nextSearch = search.trim();
    const hasCriteria = Boolean(
      nextSearch
        || dateFrom
        || dateTo
        || paymentMode !== "ALL"
        || instrumentStatus !== "ALL"
    );
    if (!hasCriteria) {
      resetFilters();
      toast.info("Renseignez au moins un critère de recherche");
      return;
    }
    setAppliedSearch(nextSearch);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setAppliedPaymentMode(paymentMode);
    setAppliedInstrumentStatus(instrumentStatus);
    setHasAppliedFilters(true);
    setPage(0);
    const next = new URLSearchParams();
    if (nextSearch) next.set("search", nextSearch);
    if (dateFrom) next.set("dateDu", dateFrom);
    if (dateTo) next.set("dateAu", dateTo);
    if (paymentMode !== "ALL") next.set("mode", paymentMode);
    if (instrumentStatus !== "ALL") next.set("statutInstrument", instrumentStatus);
    setSearchParams(next, { replace: true });
  }

  function changeSort(column: PaymentSortBy) {
    setSortDirection(sortBy === column && sortDirection === "desc" ? "asc" : "desc");
    setSortBy(column);
    setPage(0);
  }

  function togglePaymentDetails(paymentId: string) {
    setExpandedPayments((current) => {
      const next = new Set(current);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  }

  async function previewPayment(payment: ClientPayment) {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Autorisez les fenêtres contextuelles pour ouvrir le PDF");
      return;
    }
    previewWindow.opener = null;
    setOpeningPaymentId(payment.id);
    try {
      const blob = await comptaApi.clientPaymentPdf(payment.id);
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow.close();
      toast.error(error instanceof Error ? error.message : "Ouverture du PDF impossible");
    } finally {
      setOpeningPaymentId(undefined);
    }
  }

  async function previewJournal() {
    if (!journalDateFrom || !journalDateTo) {
      toast.error("Renseignez la période de l’état d’encaissement");
      return;
    }
    if (journalDateFrom > journalDateTo) {
      toast.error("La date de début doit précéder la date de fin");
      return;
    }
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Autorisez les fenêtres contextuelles pour ouvrir le PDF");
      return;
    }
    previewWindow.opener = null;
    setJournalLoading(true);
    try {
      const blob = await comptaApi.clientPaymentJournalPdf({
        dateDu: journalDateFrom,
        dateAu: journalDateTo,
        utilisateurId: journalUserId === "ALL" ? undefined : journalUserId,
        mode: journalMode === "ALL" ? undefined : journalMode,
        statut: journalStatus === "ALL" ? undefined : journalStatus,
      });
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow.close();
      toast.error(error instanceof Error ? error.message : "Génération du journal impossible");
    } finally {
      setJournalLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <ClientPaymentsWorkspaceHeader
        title={journalView ? "État d’encaissement journalier" : "Règlements enregistrés"}
        description={journalView
          ? "Générez l’état PDF selon la période, l’utilisateur, le moyen et le statut."
          : "Recherchez les règlements et suivez chaque moyen de paiement jusqu’à son dénouement."}
        canCreate={canCreate}
      />

      {!journalView ? <>
      <section className="grid gap-3 rounded-md border bg-card p-4 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.7fr)_170px_170px_190px_190px_auto] xl:items-end">
        <div className="grid gap-2">
          <Label htmlFor="payment-search">Payeur, numéro ou référence</Label>
          <Input
            id="payment-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters();
              }
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>Date du</Label>
          <DatePicker date={dateFrom} onSelect={(value) => setDateFrom(toDateOnly(value) ?? "")} />
        </div>
        <div className="grid gap-2">
          <Label>Date au</Label>
          <DatePicker date={dateTo} onSelect={(value) => setDateTo(toDateOnly(value) ?? "")} />
        </div>
        <div className="grid gap-2">
          <Label>Moyen</Label>
          <Select value={paymentMode} onValueChange={(value) => setPaymentMode(value as ClientPaymentMode | "ALL")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les moyens</SelectItem>
              {Object.entries(MODE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>État du moyen</Label>
          <Select value={instrumentStatus} onValueChange={(value) => setInstrumentStatus(value as PaymentInstrument["statut"] | "ALL")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les états</SelectItem>
              <SelectItem value="EN_ATTENTE">En instance</SelectItem>
              <SelectItem value="REMIS_EN_BANQUE">Remis en banque</SelectItem>
              <SelectItem value="CONFIRME">Encaissé</SelectItem>
              <SelectItem value="REJETE">Retourné / impayé</SelectItem>
              <SelectItem value="REMPLACE">Remplacé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button
            size="icon"
            title="Rechercher"
            onClick={applyFilters}
          >
            <Search className="size-4" />
          </Button>
          <Button size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white">
              <tr>
                <PaymentSortHeader column="numero" activeColumn={sortBy} direction={sortDirection} onSort={changeSort}>N° règlement</PaymentSortHeader>
                <PaymentSortHeader column="dateReglement" activeColumn={sortBy} direction={sortDirection} onSort={changeSort}>Date</PaymentSortHeader>
                <PaymentSortHeader column="payeurNom" activeColumn={sortBy} direction={sortDirection} onSort={changeSort}>Payeur</PaymentSortHeader>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-left">Moyen</th>
                <th className="px-4 py-3 text-left">Référence</th>
                <th className="px-4 py-3 text-left">Date de valeur</th>
                <th className="px-4 py-3 text-center">État de valeur</th>
                <PaymentSortHeader column="statut" activeColumn={sortBy} direction={sortDirection} onSort={changeSort} align="center">Règlement</PaymentSortHeader>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {hasAppliedFilters && payments.isLoading ? (
                <TableRowsSkeleton colSpan={10} rows={8} />
              ) : hasAppliedFilters ? (payments.data?.rows ?? []).flatMap((payment) => {
                const expanded = expandedPayments.has(payment.id);
                return [
                <tr key={payment.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">
                    <div className="flex items-center gap-1.5">
                      {payment.instruments.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Masquer" : "Afficher"} les moyens du règlement ${payment.numero}`}
                          title={expanded ? "Masquer les moyens" : "Afficher les moyens"}
                          onClick={() => togglePaymentDetails(payment.id)}
                        >
                          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </Button>
                      ) : <span className="inline-block w-7" />}
                      {payment.numero}
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDate(payment.dateReglement)}</td>
                  <td className="px-4 py-3">
                    <div className="max-w-64">{payment.payeurNom}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatAccountingAmount(payment.montantTotal)}</td>
                  <td className="px-4 py-3"><InstrumentModesSummary instruments={payment.instruments} /></td>
                  <td className="px-4 py-3 font-medium">{instrumentReferencesSummary(payment.instruments)}</td>
                  <td className="px-4 py-3">{instrumentDatesSummary(payment.instruments)}</td>
                  <td className="px-4 py-3 text-center"><InstrumentStatusesSummary instruments={payment.instruments} /></td>
                  <td className="px-4 py-3 text-center">
                    <PaymentStatusBadge value={payment.statut} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <PaymentActionsMenu
                        payment={payment}
                        canManage={canManage}
                        canManageTreasury={canManageTreasury}
                        canIssueInvoice={canIssueInvoice}
                        pdfLoading={openingPaymentId === payment.id}
                        onPreview={() => void previewPayment(payment)}
                        onInvoice={() => setPaymentToInvoice(payment)}
                        onCancel={() => setPaymentToCancel(payment)}
                        onReplace={(instrument) => {
                          setInstrumentToReplace(instrument);
                          setReplacement(newReplacement());
                          setReplacementReason("");
                        }}
                        onAddToRemittance={setInstrumentToRemit}
                      />
                    </div>
                  </td>
                </tr>,
                expanded ? (
                  <tr key={`${payment.id}-details`} className="bg-muted/20">
                    <td colSpan={10} className="px-10 py-3">
                      <PaymentInstrumentDetails payment={payment} />
                    </td>
                  </tr>
                ) : null,
                ];
              }) : null}
              {!hasAppliedFilters ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    Renseignez au moins un critère puis lancez la recherche.
                  </td>
                </tr>
              ) : !payments.isLoading && (payments.data?.rows.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    Aucun règlement ne correspond à la recherche.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {hasAppliedFilters && payments.data && (
          <ServerPagination
            page={payments.data.page.number}
            totalPages={payments.data.page.totalPages}
            totalElements={payments.data.page.totalElements}
            loading={payments.isFetching}
            onPageChange={setPage}
          />
        )}
      </section>

      <AddInstrumentToRemittanceDialog
        instrument={instrumentToRemit}
        open={Boolean(instrumentToRemit)}
        onOpenChange={(open) => !open && setInstrumentToRemit(undefined)}
      />

      </> : null}

      {journalView ? (
        <section className="grid gap-4 rounded-md border bg-card p-4">
          <div>
            <h2 className="font-semibold">Paramètres de l’état</h2>
            <p className="text-sm text-muted-foreground">
              Le PDF reprend uniquement les règlements correspondant aux critères ci-dessous.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Date du</Label>
              <DatePicker
                date={journalDateFrom}
                onSelect={(value) => setJournalDateFrom(toDateOnly(value) ?? "")}
              />
            </div>
            <div className="grid gap-2">
              <Label>Date au</Label>
              <DatePicker
                date={journalDateTo}
                onSelect={(value) => setJournalDateTo(toDateOnly(value) ?? "")}
              />
            </div>
            <div className="grid gap-2">
              <Label>Utilisateur</Label>
              <Select value={journalUserId} onValueChange={setJournalUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les utilisateurs</SelectItem>
                  {(journalUsers.data ?? []).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.nomComplet}{user.actif ? "" : " (inactif)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Mode de règlement</Label>
              <Select
                value={journalMode}
                onValueChange={(value) => setJournalMode(value as ClientPaymentMode | "ALL")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les modes</SelectItem>
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Statut du règlement</Label>
              <Select
                value={journalStatus}
                onValueChange={(value) => setJournalStatus(value as ClientPayment["statut"] | "ALL")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  <SelectItem value="VALIDE">Enregistrés</SelectItem>
                  <SelectItem value="ANNULE">Annulés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Les chèques et effets en attente restent distingués des montants définitivement encaissés.
          </div>
          <div className="flex justify-end">
            <Button
              disabled={journalLoading || !journalDateFrom || !journalDateTo}
              onClick={() => void previewJournal()}
            >
              <Printer className="size-4" />
              {journalLoading ? "Génération..." : "Imprimer l’état PDF"}
            </Button>
          </div>
        </section>
      ) : null}

      <Dialog
        open={Boolean(paymentToInvoice)}
        onOpenChange={(open) => {
          if (!open && !createInvoice.isPending) setPaymentToInvoice(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer la facture</DialogTitle>
            <DialogDescription>
              Une facture client standard sera émise à partir des écritures réglées directement.
              Le règlement existant lui sera automatiquement affecté.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-semibold">{paymentToInvoice?.numero}</div>
            <div className="mt-1 flex justify-between gap-4 text-muted-foreground">
              <span>{paymentToInvoice?.payeurNom}</span>
              <span className="font-semibold text-foreground">
                {formatAccountingAmount(paymentToInvoice?.montantTotal)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={createInvoice.isPending}
              onClick={() => setPaymentToInvoice(undefined)}
            >
              Annuler
            </Button>
            <Button
              disabled={createInvoice.isPending}
              onClick={() => createInvoice.mutate()}
            >
              <FileText className="size-4" />
              Émettre et télécharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(paymentToCancel)}
        onOpenChange={(open) => {
          if (!open) closeCancellation();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler le règlement</DialogTitle>
            <DialogDescription>
              {paymentToCancel?.numero} · {formatAccountingAmount(paymentToCancel?.montantTotal)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="payment-cancel-reason">Motif d’annulation</Label>
            <Textarea
              id="payment-cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Motif obligatoire"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCancellation}>
              Conserver le règlement
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || cancelPayment.isPending}
              onClick={() => cancelPayment.mutate()}
            >
              Annuler le règlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(instrumentToReplace)}
        onOpenChange={(open) => {
          if (!open) closeReplacement();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remplacer le moyen de paiement</DialogTitle>
            <DialogDescription>
              Le montant et les affectations sont conservés :{" "}
              {formatAccountingAmount(instrumentToReplace?.montant)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Mode</Label>
              <Select
                value={replacement.mode}
                onValueChange={(value) => setReplacement((current) => ({
                  ...current,
                  mode: value as ClientPaymentMode,
                  compteTresorerieId: "",
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <DatePicker
                date={replacement.dateInstrument}
                onSelect={(value) => setReplacement((current) => ({
                  ...current,
                  dateInstrument: toDateOnly(value) ?? "",
                }))}
              />
            </div>
            {(replacement.mode === "EFFET" || replacement.mode === "CHEQUE") && (
              <div className="grid gap-2">
                <Label>{replacement.mode === "CHEQUE" ? "Date portée sur le chèque" : "Date d’échéance"}</Label>
                <DatePicker
                  date={replacement.dateEcheance}
                  onSelect={(value) => setReplacement((current) => ({
                    ...current,
                    dateEcheance: toDateOnly(value) ?? "",
                  }))}
                />
              </div>
            )}
            {replacement.mode !== "ESPECES" ? (
              <>
                <div className="grid gap-2">
                  <Label>Référence</Label>
                  <Input
                    value={replacement.referenceInstrument}
                    onChange={(event) => setReplacement((current) => ({
                      ...current,
                      referenceInstrument: event.target.value,
                    }))}
                  />
                </div>
                {requiresBankAccountAtEntry(replacement.mode) && (
                  <AccountSelect
                    accounts={accounts.data ?? []}
                    type="BANQUE"
                    label="Compte bancaire crédité"
                    value={replacement.compteTresorerieId}
                    onChange={(value) => setReplacement((current) => ({
                      ...current,
                      compteTresorerieId: value,
                    }))}
                  />
                )}
                {showsOriginatingBank(replacement.mode) && (
                  <BankSelect
                    banks={banks.data ?? []}
                    value={replacement.banqueEmettriceId}
                    label={replacement.mode === "CHEQUE" || replacement.mode === "EFFET"
                      ? "Banque émettrice"
                      : "Banque d’origine"}
                    onChange={(value) => setReplacement((current) => ({
                      ...current,
                      banqueEmettriceId: value,
                    }))}
                    disabled={banks.isLoading}
                  />
                )}
              </>
            ) : null}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="replacement-reason">Motif du remplacement *</Label>
              <Textarea
                id="replacement-reason"
                value={replacementReason}
                onChange={(event) => setReplacementReason(event.target.value)}
                placeholder="Ex. chèque repris et remplacé par un paiement en espèces"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeReplacement}>Annuler</Button>
            <Button
              disabled={replaceInstrument.isPending
                || !replacementReason.trim()
                || !replacementValid(replacement, accounts.data ?? [])}
              onClick={() => replaceInstrument.mutate()}
            >
              Enregistrer le remplacement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountSelect({
  accounts,
  type,
  label,
  value,
  onChange,
}: {
  accounts: TreasuryAccount[];
  type: TreasuryAccount["typeCompte"];
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = accounts.filter(
    (account) => account.actif && account.typeCompte === type
  );
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
        <SelectContent>
          {options.map((account) => (
            <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {options.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Aucun {type === "CAISSE" ? "compte de caisse" : "compte bancaire"} actif disponible
        </p>
      )}
    </div>
  );
}

function PaymentActionsMenu({
  payment,
  canManage,
  canManageTreasury,
  canIssueInvoice,
  pdfLoading,
  onPreview,
  onInvoice,
  onCancel,
  onReplace,
  onAddToRemittance,
}: {
  payment: ClientPayment;
  canManage: boolean;
  canManageTreasury: boolean;
  canIssueInvoice: boolean;
  pdfLoading: boolean;
  onPreview: () => void;
  onInvoice: () => void;
  onCancel: () => void;
  onReplace: (instrument: PaymentInstrument) => void;
  onAddToRemittance: (instrument: PaymentInstrument) => void;
}) {
  const replaceableInstruments = canManage && payment.statut === "VALIDE" && !payment.multiPayeur
    ? payment.instruments.filter((instrument) => (instrument.statut === "REJETE"
      || (instrument.statut === "EN_ATTENTE" && !instrument.bordereauRemiseId))
      && (instrument.mode === "CHEQUE" || instrument.mode === "EFFET"))
    : [];
  const canCreateInvoice = payment.statut === "VALIDE"
    && canIssueInvoice
    && !payment.multiPayeur
    && hasDirectActiveAllocations(payment);
  const canReplaceInstrument = replaceableInstruments.length > 0;
  const remittableInstruments = canManageTreasury && payment.statut === "VALIDE"
    ? payment.instruments.filter((instrument) => instrument.statut === "EN_ATTENTE"
      && !instrument.bordereauRemiseId
      && (instrument.mode === "CHEQUE" || instrument.mode === "EFFET"))
    : [];
  const canCancelPayment = payment.statut !== "ANNULE" && canManage;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Actions pour le règlement ${payment.numero}`}
          title="Actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem asChild>
          <Link to={`/app/compta/reglements/${payment.id}`}>
            <Eye className="size-4" />
            Voir le détail
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pdfLoading} onSelect={onPreview}>
          <Printer className="size-4" />
          {pdfLoading ? "Ouverture..." : "Imprimer le PDF"}
        </DropdownMenuItem>
        {canCreateInvoice && (
          <DropdownMenuItem onSelect={onInvoice}>
            <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
            Créer la facture
          </DropdownMenuItem>
        )}
        {remittableInstruments.length > 0 && <DropdownMenuSeparator />}
        {remittableInstruments.map((instrument) => (
          <DropdownMenuItem
            key={instrument.id}
            onSelect={() => onAddToRemittance(instrument)}
          >
            <Landmark className="size-4 text-blue-600 dark:text-blue-400" />
            Ajouter {MODE_LABELS[instrument.mode].toLowerCase()}
            {instrument.referenceInstrument ? ` ${instrument.referenceInstrument}` : ""} au bordereau
          </DropdownMenuItem>
        ))}
        {canReplaceInstrument && <DropdownMenuSeparator />}
        {replaceableInstruments.map((instrument) => (
          <DropdownMenuItem
            key={instrument.id}
            onSelect={() => onReplace(instrument)}
          >
            <RotateCcw className="size-4 text-amber-600 dark:text-amber-400" />
            Remplacer {MODE_LABELS[instrument.mode].toLowerCase()}
            {instrument.referenceInstrument ? ` ${instrument.referenceInstrument}` : ""}
          </DropdownMenuItem>
        ))}
        {canCancelPayment && <DropdownMenuSeparator />}
        {canCancelPayment && (
          <DropdownMenuItem variant="destructive" onSelect={onCancel}>
            <XCircle className="size-4" />
            Annuler le règlement
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PaymentStatusBadge({ value }: { value: ClientPayment["statut"] }) {
  if (value === "VALIDE") return <Badge variant="success">Enregistré</Badge>;
  return <Badge variant="red">Annulé</Badge>;
}

function InstrumentStatusIndicator({
  value,
  count = 1,
}: {
  value: PaymentInstrument["statut"];
  count?: number;
}) {
  const styles = INSTRUMENT_STATUS_INDICATOR_STYLES[value];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${styles.text}`}>
      <span className={`size-2 shrink-0 rounded-full ${styles.dot}`} aria-hidden="true" />
      {count > 1 ? `${count} × ` : ""}{INSTRUMENT_STATUS_LABELS[value]}
    </span>
  );
}

function InstrumentModesSummary({ instruments }: { instruments: PaymentInstrument[] }) {
  const counts = countBy(instruments.map((instrument) => instrument.mode));
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from(counts.entries()).map(([mode, count]) => (
        <Badge key={mode} variant={MODE_BADGE_VARIANTS[mode as ClientPaymentMode]}>
          {count > 1 ? `${count} ` : ""}{MODE_LABELS[mode as ClientPaymentMode]}
        </Badge>
      ))}
    </div>
  );
}

function InstrumentStatusesSummary({ instruments }: { instruments: PaymentInstrument[] }) {
  const counts = countBy(instruments.map((instrument) => instrument.statut));
  if (counts.size === 1) {
    const [status, count] = Array.from(counts.entries())[0];
    return <InstrumentStatusIndicator value={status as PaymentInstrument["statut"]} count={count} />;
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-purple-700 dark:text-purple-300">
      <span className="size-2 shrink-0 rounded-full bg-purple-500" aria-hidden="true" />
      États mixtes
    </span>
  );
}

function PaymentInstrumentDetails({ payment }: { payment: ClientPayment }) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="border-b px-3 py-2 text-sm font-semibold">
        Moyens du règlement {payment.numero}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Payeur</th>
              <th className="px-3 py-2 text-left">Moyen</th>
              <th className="px-3 py-2 text-left">Référence</th>
              <th className="px-3 py-2 text-left">Date de valeur</th>
              <th className="px-3 py-2 text-center">État</th>
              <th className="px-3 py-2 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payment.instruments.map((instrument) => (
              <tr key={instrument.id}>
                <td className="px-3 py-2">{instrumentPayerLabel(payment, instrument)}</td>
                <td className="px-3 py-2">{MODE_LABELS[instrument.mode]}</td>
                <td className="px-3 py-2 font-medium">{instrument.referenceInstrument || "-"}</td>
                <td className="px-3 py-2">{formatDate(instrument.dateEcheance)}</td>
                <td className="px-3 py-2 text-center"><InstrumentStatusIndicator value={instrument.statut} /></td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatAccountingAmount(instrument.montant)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function instrumentReferencesSummary(instruments: PaymentInstrument[]) {
  const references = instruments
    .map((instrument) => instrument.referenceInstrument?.trim())
    .filter((reference): reference is string => Boolean(reference));
  if (references.length === 0) return "-";
  if (instruments.length === 1) return references[0];
  return `${references.length} référence${references.length > 1 ? "s" : ""}`;
}

function instrumentDatesSummary(instruments: PaymentInstrument[]) {
  const dates = Array.from(new Set(
    instruments
      .map((instrument) => instrument.dateEcheance)
      .filter((date): date is string => Boolean(date))
  )).sort();
  if (dates.length === 0) return "-";
  if (dates.length === 1) return formatDate(dates[0]);
  return `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

function newReplacement(): InstrumentDraft {
  return {
    mode: "ESPECES",
    dateInstrument: TODAY,
    dateEcheance: "",
    referenceInstrument: "",
    banqueEmettriceId: "",
    compteTresorerieId: "",
  };
}

function replacementValid(row: InstrumentDraft, accounts: TreasuryAccount[]) {
  if (row.mode === "ESPECES") {
    return true;
  }
  if (requiresBankAccountAtEntry(row.mode)) {
    const validBankAccount = accounts.some(
      (account) => account.id === row.compteTresorerieId
        && account.actif
        && account.typeCompte === "BANQUE"
    );
    if (!validBankAccount) return false;
  }
  if (requiresPaymentReference(row.mode)
    && !row.referenceInstrument.trim()) return false;
  if (showsOriginatingBank(row.mode) && !row.banqueEmettriceId) return false;
  return (row.mode !== "EFFET" && row.mode !== "CHEQUE") || Boolean(row.dateEcheance);
}

function formatDate(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}

function instrumentPayerLabel(payment: ClientPayment, instrument: PaymentInstrument) {
  if (!payment.multiPayeur) return payment.payeurNom;
  const names = Array.from(new Set(
    instrument.affectations
      .map((allocation) => allocation.payeurNom?.trim())
      .filter((name): name is string => Boolean(name))
  ));
  return names.length > 0 ? names.join(", ") : payment.payeurNom;
}

function PaymentSortHeader(props: {
  children: ReactNode;
  column: PaymentSortBy;
  activeColumn: PaymentSortBy;
  direction: "asc" | "desc";
  onSort: (column: PaymentSortBy) => void;
  align?: "right" | "center";
}) {
  const active = props.column === props.activeColumn;
  return (
    <th aria-sort={active ? props.direction === "asc" ? "ascending" : "descending" : "none"} className="px-4 py-3">
      <button
        type="button"
        onClick={() => props.onSort(props.column)}
        className={`inline-flex w-full items-center gap-1 hover:text-white/80 ${props.align === "right" ? "justify-end" : props.align === "center" ? "justify-center" : "justify-start"}`}
      >
        {props.children}<SortIcon isActive={active} direction={props.direction} />
      </button>
    </th>
  );
}

function hasDirectActiveAllocations(payment: ClientPayment) {
  return payment.instruments.some((instrument) => instrument.affectations.some(
    (allocation) => Boolean(allocation.elementFacturableId)
      && allocation.statut !== "ANNULEE"
  ));
}

async function invalidateAccountingQueries(
  queryClient: QueryClient
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "client-document-sources"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "client-documents"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
  ]);
}
