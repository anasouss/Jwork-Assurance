import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Eye, Pencil, Search, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import type { ClientPayment } from "../types";

const TODAY = toDateOnly(new Date())!;
const PAGE_SIZE = 25;

export default function ValidationReglementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions ?? [];
  const canValidate = permissions.includes("reglement-client:validate");
  const canManage = permissions.includes("reglement-client:manage");
  const canEdit = permissions.includes("reglement-client:create") || canManage;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateDu") ?? TODAY);
  const [dateTo, setDateTo] = useState(searchParams.get("dateAu") ?? TODAY);
  const [appliedSearch, setAppliedSearch] = useState(searchParams.get("search") ?? "");
  const [appliedDateFrom, setAppliedDateFrom] = useState(searchParams.get("dateDu") ?? TODAY);
  const [appliedDateTo, setAppliedDateTo] = useState(searchParams.get("dateAu") ?? TODAY);
  const [paymentToValidate, setPaymentToValidate] = useState<ClientPayment>();
  const [bulkValidationOpen, setBulkValidationOpen] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [paymentToCancel, setPaymentToCancel] = useState<ClientPayment>();
  const [cancelReason, setCancelReason] = useState("");

  const payments = useQuery({
    queryKey: ["compta", "client-payments", "validation", appliedSearch, appliedDateFrom, appliedDateTo, page],
    queryFn: () => comptaApi.clientPayments({
      dateDu: appliedDateFrom,
      dateAu: appliedDateTo,
      search: appliedSearch || undefined,
      statut: "A_VALIDER",
      sortBy: "dateReglement",
      sortDirection: "asc",
      page,
      size: PAGE_SIZE,
    }),
  });

  const validatePayment = useMutation({
    mutationFn: () => comptaApi.validateClientPayment(paymentToValidate!.id),
    onSuccess: async (payment) => {
      setPaymentToValidate(undefined);
      setSelectedPaymentIds(new Set());
      toast.success(`Règlement ${payment.numero} validé`);
      await invalidatePayments(queryClient);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Validation impossible"),
  });

  const validatePayments = useMutation({
    mutationFn: () => comptaApi.validateClientPayments([...selectedPaymentIds]),
    onSuccess: async (validatedPayments) => {
      setBulkValidationOpen(false);
      setSelectedPaymentIds(new Set());
      toast.success(`${validatedPayments.length} règlement(s) validé(s)`);
      await invalidatePayments(queryClient);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Validation impossible"),
  });

  const cancelPayment = useMutation({
    mutationFn: () => comptaApi.cancelClientPayment(paymentToCancel!.id, cancelReason.trim()),
    onSuccess: async (payment) => {
      setPaymentToCancel(undefined);
      setCancelReason("");
      setSelectedPaymentIds(new Set());
      toast.success(`Règlement ${payment.numero} annulé`);
      await invalidatePayments(queryClient);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Annulation impossible"),
  });

  function applyFilters() {
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      toast.error("Renseignez une période valide");
      return;
    }
    const normalizedSearch = search.trim();
    setAppliedSearch(normalizedSearch);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setPage(0);
    setSelectedPaymentIds(new Set());
    const next = new URLSearchParams({ dateDu: dateFrom, dateAu: dateTo });
    if (normalizedSearch) next.set("search", normalizedSearch);
    setSearchParams(next, { replace: true });
  }

  const visibleEligiblePayments = useMemo(
    () => (payments.data?.rows ?? []).filter((payment) => payment.creeParId !== user?.id),
    [payments.data?.rows, user?.id]
  );
  const allVisibleSelected = visibleEligiblePayments.length > 0
    && visibleEligiblePayments.every((payment) => selectedPaymentIds.has(payment.id));
  const someVisibleSelected = visibleEligiblePayments.some((payment) => selectedPaymentIds.has(payment.id));
  const selectedPayments = (payments.data?.rows ?? []).filter((payment) => selectedPaymentIds.has(payment.id));
  const selectedTotal = selectedPayments.reduce((sum, payment) => sum + payment.montantTotal, 0);

  function toggleAllVisible(checked: boolean) {
    setSelectedPaymentIds(checked
      ? new Set(visibleEligiblePayments.map((payment) => payment.id))
      : new Set());
  }

  function togglePayment(paymentId: string, checked: boolean) {
    setSelectedPaymentIds((current) => {
      const next = new Set(current);
      if (checked) next.add(paymentId);
      else next.delete(paymentId);
      return next;
    });
  }

  function changePage(nextPage: number) {
    setSelectedPaymentIds(new Set());
    setPage(nextPage);
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
          <h1 className="mt-1 text-xl font-semibold">Validation des règlements</h1>
          <p className="text-sm text-muted-foreground">
            Contrôlez les règlements saisis avant leur prise en compte comptable.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/compta/reglements/historique">
            <ArrowLeft className="size-4" />
            Règlements enregistrés
          </Link>
        </Button>
      </header>

      <section className="grid gap-3 rounded-md border bg-card p-4 lg:grid-cols-[1fr_180px_180px_auto]">
        <div className="grid gap-2">
          <Label htmlFor="pending-payment-search">Payeur ou numéro</Label>
          <Input
            id="pending-payment-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && applyFilters()}
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
        <div className="flex items-end">
          <Button size="icon" title="Rechercher" onClick={applyFilters}>
            <Search className="size-4" />
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
          <div className="text-sm text-muted-foreground">
            {selectedPaymentIds.size > 0
              ? `${selectedPaymentIds.size} règlement(s) sélectionné(s)`
              : "Sélectionnez les règlements contrôlés à valider."}
          </div>
          {canValidate && (
            <Button
              size="sm"
              disabled={selectedPaymentIds.size === 0}
              onClick={() => setBulkValidationOpen(true)}
            >
              <CheckCircle2 className="size-4" />
              Valider la sélection ({selectedPaymentIds.size})
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white">
              <tr>
                <th className="w-12 px-4 py-3 text-center">
                  <Checkbox
                    aria-label="Sélectionner tous les règlements affichés"
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    disabled={!canValidate || visibleEligiblePayments.length === 0}
                    onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                    className="border-white/80 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-orange-700"
                  />
                </th>
                <th className="px-4 py-3 text-left">N° règlement</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Payeur</th>
                <th className="px-4 py-3 text-left">Saisi par</th>
                <th className="px-4 py-3 text-left">Moyens</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.isLoading ? <TableRowsSkeleton colSpan={8} rows={6} /> : null}
              {!payments.isLoading && (payments.data?.rows ?? []).map((payment) => {
                const ownPayment = payment.creeParId === user?.id;
                return (
                  <tr key={payment.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-center">
                      <Checkbox
                        aria-label={`Sélectionner le règlement ${payment.numero}`}
                        checked={selectedPaymentIds.has(payment.id)}
                        disabled={!canValidate || ownPayment}
                        title={ownPayment
                          ? "Le créateur ne peut pas valider son propre règlement"
                          : "Sélectionner le règlement"}
                        onCheckedChange={(checked) => togglePayment(payment.id, checked === true)}
                      />
                    </td>
                    <td className="px-4 py-2.5 font-semibold">{payment.numero}</td>
                    <td className="px-4 py-2.5">{formatDate(payment.dateReglement)}</td>
                    <td className="px-4 py-2.5">{payment.payeurNom}</td>
                    <td className="px-4 py-2.5">{payment.creePar}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {payment.instruments.map((instrument) => (
                          <Badge key={instrument.id} variant="outline">
                            {modeLabel(instrument.mode)} · {formatAccountingAmount(instrument.montant)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {formatAccountingAmount(payment.montantTotal)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" title="Consulter">
                          <Link to={`/app/compta/reglements/${payment.id}`}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        {canEdit && ownPayment && (
                          <Button asChild variant="ghost" size="icon" title="Modifier">
                            <Link to={`/app/compta/reglements/${payment.id}/modifier`}>
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            title="Annuler"
                            onClick={() => setPaymentToCancel(payment)}
                          >
                            <XCircle className="size-4" />
                          </Button>
                        )}
                        {canValidate && (
                          <Button
                            size="sm"
                            disabled={ownPayment}
                            title={ownPayment
                              ? "Le créateur ne peut pas valider son propre règlement"
                              : "Valider le règlement"}
                            onClick={() => setPaymentToValidate(payment)}
                          >
                            <CheckCircle2 className="size-4" />
                            Valider
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!payments.isLoading && (payments.data?.rows.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Aucun règlement à valider pour cette période.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {payments.data && (
          <ServerPagination
            page={payments.data.page.number}
            totalPages={payments.data.page.totalPages}
            totalElements={payments.data.page.totalElements}
            loading={payments.isFetching}
            onPageChange={changePage}
          />
        )}
      </section>

      <AlertDialog open={Boolean(paymentToValidate)} onOpenChange={(open) => !open && setPaymentToValidate(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider {paymentToValidate?.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              Les espèces seront confirmées et comptabilisées. Les chèques et effets conserveront leur circuit d’encaissement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={validatePayment.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={validatePayment.isPending} onClick={() => validatePayment.mutate()}>
              Valider le règlement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkValidationOpen} onOpenChange={setBulkValidationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider la sélection</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez valider {selectedPaymentIds.size} règlement(s) pour un total de {formatAccountingAmount(selectedTotal)}.
              Les espèces seront comptabilisées immédiatement. Les chèques et effets conserveront leur circuit d’encaissement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={validatePayments.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={validatePayments.isPending || selectedPaymentIds.size === 0}
              onClick={() => validatePayments.mutate()}
            >
              Valider {selectedPaymentIds.size} règlement(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(paymentToCancel)} onOpenChange={(open) => {
        if (!open) {
          setPaymentToCancel(undefined);
          setCancelReason("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler {paymentToCancel?.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              Le règlement restera dans l’historique et ses réservations seront libérées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="pending-cancel-reason">Motif</Label>
            <Textarea
              id="pending-cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelPayment.isPending}>Retour</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelPayment.isPending || !cancelReason.trim()}
              onClick={() => cancelPayment.mutate()}
            >
              Confirmer l’annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

async function invalidatePayments(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
  ]);
}

function modeLabel(mode: ClientPayment["instruments"][number]["mode"]) {
  return {
    ESPECES: "Espèces",
    CHEQUE: "Chèque",
    EFFET: "Effet",
    VIREMENT: "Virement",
    VERSEMENT_BANCAIRE: "Versement",
    CARTE: "Carte",
    PRELEVEMENT: "Prélèvement",
  }[mode];
}

function formatDate(value: string) {
  return value.split("-").reverse().join("/");
}
