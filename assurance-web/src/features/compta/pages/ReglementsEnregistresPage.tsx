import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ReceiptText, RotateCcw, Search, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import type {
  ClientPayment,
  ClientPaymentMode,
  PaymentInstrument,
  TreasuryAccount,
} from "../types";

const PAGE_SIZE = 25;
const TODAY = new Date().toISOString().slice(0, 10);

type InstrumentDraft = {
  mode: ClientPaymentMode;
  dateInstrument: string;
  dateEcheance: string;
  referenceInstrument: string;
  banqueEmettrice: string;
  compteTresorerieId: string;
};

const MODE_LABELS: Record<ClientPaymentMode, string> = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  EFFET: "Effet",
  VIREMENT: "Virement",
  VERSEMENT_BANCAIRE: "Versement bancaire",
  CARTE: "Carte",
  PRELEVEMENT: "Prélèvement",
};

export default function ReglementsEnregistresPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("reglement-client:manage");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentToCancel, setPaymentToCancel] = useState<ClientPayment>();
  const [cancelReason, setCancelReason] = useState("");
  const [instrumentToReplace, setInstrumentToReplace] = useState<PaymentInstrument>();
  const [replacement, setReplacement] = useState<InstrumentDraft>(newReplacement());

  const payments = useQuery({
    queryKey: ["compta", "client-payments", appliedSearch, dateFrom, dateTo, page],
    queryFn: () => comptaApi.clientPayments({
      search: appliedSearch || undefined,
      dateDu: dateFrom || undefined,
      dateAu: dateTo || undefined,
      page,
      size: PAGE_SIZE,
    }),
  });

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
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

  const replaceInstrument = useMutation({
    mutationFn: () => comptaApi.replacePaymentInstrument(instrumentToReplace!.id, {
      mode: replacement.mode,
      montant: instrumentToReplace!.montant,
      dateInstrument: replacement.dateInstrument || TODAY,
      dateEcheance: replacement.dateEcheance || undefined,
      referenceInstrument: replacement.referenceInstrument.trim() || undefined,
      banqueEmettrice: replacement.banqueEmettrice.trim() || undefined,
      compteTresorerieId: replacement.compteTresorerieId || undefined,
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
  }

  function resetFilters() {
    setSearch("");
    setAppliedSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">
            Comptabilité
          </div>
          <h1 className="mt-1 text-xl font-semibold">Règlements enregistrés</h1>
          <p className="text-sm text-muted-foreground">
            Historique, annulations et remplacement des moyens de paiement rejetés.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/compta/reglements">
            <ReceiptText className="size-4" />
            Créances ouvertes
          </Link>
        </Button>
      </header>

      <section className="grid gap-3 rounded-md border bg-card p-4 lg:grid-cols-[1fr_180px_180px_auto]">
        <div className="grid gap-2">
          <Label htmlFor="payment-search">Payeur, numéro ou référence</Label>
          <Input
            id="payment-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setAppliedSearch(search.trim());
                setPage(0);
              }
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>Date du</Label>
          <DatePicker
            date={dateFrom}
            onSelect={(value) => {
              setDateFrom(toDateOnly(value) ?? "");
              setPage(0);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>Date au</Label>
          <DatePicker
            date={dateTo}
            onSelect={(value) => {
              setDateTo(toDateOnly(value) ?? "");
              setPage(0);
            }}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            size="icon"
            title="Rechercher"
            onClick={() => {
              setAppliedSearch(search.trim());
              setPage(0);
            }}
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
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white">
              <tr>
                <th className="px-4 py-3 text-left">N° règlement</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Payeur</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-left">Moyens</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.isLoading ? (
                <TableRowsSkeleton colSpan={7} rows={8} />
              ) : (payments.data?.rows ?? []).map((payment) => (
                <tr key={payment.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{payment.numero}</td>
                  <td className="px-4 py-3">{formatDate(payment.dateReglement)}</td>
                  <td className="px-4 py-3">{payment.payeurNom}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatAccountingAmount(payment.montantTotal)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {payment.instruments.map((instrument) => (
                        <span key={instrument.id} className="inline-flex items-center gap-1.5">
                          <Badge variant="outline">{MODE_LABELS[instrument.mode]}</Badge>
                          <InstrumentStatusBadge value={instrument.statut} />
                          {instrument.statut === "REJETE" && canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInstrumentToReplace(instrument);
                                setReplacement(newReplacement());
                              }}
                            >
                              Remplacer
                            </Button>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={payment.statut === "VALIDE" ? "default" : "destructive"}>
                      {payment.statut === "VALIDE" ? "Validé" : "Annulé"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {payment.statut === "VALIDE" && canManage ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Annuler le règlement"
                        onClick={() => setPaymentToCancel(payment)}
                      >
                        <XCircle className="size-4 text-red-600" />
                      </Button>
                    ) : "-"}
                  </td>
                </tr>
              ))}
              {!payments.isLoading && (payments.data?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Aucun règlement ne correspond à la recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {payments.data && (
          <ServerPagination
            page={payments.data.page.number}
            totalPages={payments.data.page.totalPages}
            totalElements={payments.data.page.totalElements}
            loading={payments.isFetching}
            onPageChange={setPage}
          />
        )}
      </section>

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
            <DialogTitle>Remplacer le moyen de paiement rejeté</DialogTitle>
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
            {replacement.mode === "EFFET" && (
              <div className="grid gap-2">
                <Label>Échéance</Label>
                <DatePicker
                  date={replacement.dateEcheance}
                  onSelect={(value) => setReplacement((current) => ({
                    ...current,
                    dateEcheance: toDateOnly(value) ?? "",
                  }))}
                />
              </div>
            )}
            {replacement.mode === "ESPECES" ? (
              <AccountSelect
                accounts={accounts.data ?? []}
                value={replacement.compteTresorerieId}
                onChange={(value) => setReplacement((current) => ({
                  ...current,
                  compteTresorerieId: value,
                }))}
              />
            ) : (
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
                <div className="grid gap-2">
                  <Label>Banque émettrice</Label>
                  <Input
                    value={replacement.banqueEmettrice}
                    onChange={(event) => setReplacement((current) => ({
                      ...current,
                      banqueEmettrice: event.target.value,
                    }))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeReplacement}>Annuler</Button>
            <Button
              disabled={replaceInstrument.isPending
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
  value,
  onChange,
}: {
  accounts: TreasuryAccount[];
  value: string;
  onChange: (value: string) => void;
}) {
  const options = accounts.filter(
    (account) => account.actif && account.typeCompte === "CAISSE"
  );
  return (
    <div className="grid gap-2">
      <Label>Caisse</Label>
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
          Aucune caisse active disponible
        </p>
      )}
    </div>
  );
}

function InstrumentStatusBadge({ value }: { value: PaymentInstrument["statut"] }) {
  const labels: Record<PaymentInstrument["statut"], string> = {
    EN_ATTENTE: "En attente",
    CONFIRME: "Confirmé",
    REJETE: "Rejeté",
    REMPLACE: "Remplacé",
  };
  const variant = value === "REJETE"
    ? "destructive"
    : value === "CONFIRME"
      ? "default"
      : "secondary";
  return <Badge variant={variant}>{labels[value]}</Badge>;
}

function newReplacement(): InstrumentDraft {
  return {
    mode: "ESPECES",
    dateInstrument: TODAY,
    dateEcheance: "",
    referenceInstrument: "",
    banqueEmettrice: "",
    compteTresorerieId: "",
  };
}

function replacementValid(row: InstrumentDraft, accounts: TreasuryAccount[]) {
  if (row.mode === "ESPECES") {
    return accounts.some(
      (account) => account.id === row.compteTresorerieId
        && account.actif
        && account.typeCompte === "CAISSE"
    );
  }
  const referenceRequired = [
    "CHEQUE",
    "EFFET",
    "VIREMENT",
    "VERSEMENT_BANCAIRE",
  ].includes(row.mode);
  if (referenceRequired && !row.referenceInstrument.trim()) return false;
  return row.mode !== "EFFET" || Boolean(row.dateEcheance);
}

function formatDate(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}

async function invalidateAccountingQueries(
  queryClient: QueryClient
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
  ]);
}
