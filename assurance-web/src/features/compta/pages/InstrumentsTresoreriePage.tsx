import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Ban, CheckCircle2, Clock3, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { PaymentInstrument } from "../types";
import {
  formatTreasuryDate,
  formatTreasuryMoney,
  paymentModeLabel,
  TODAY,
  TREASURY_PAGE_SIZE,
} from "./treasury-format";

type InstrumentRegisterStatus = "EN_ATTENTE" | "CONFIRME" | "REJETE";
type InstrumentAction = "CONFIRME" | "REJETE";

export default function InstrumentsTresoreriePage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<InstrumentRegisterStatus>("EN_ATTENTE");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeInstrument, setActiveInstrument] = useState<PaymentInstrument>();
  const [action, setAction] = useState<InstrumentAction>("CONFIRME");
  const [accountId, setAccountId] = useState("");
  const [operationDate, setOperationDate] = useState(TODAY);
  const [reason, setReason] = useState("");

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const instruments = useQuery({
    queryKey: [
      "compta",
      "treasury",
      "instruments",
      status,
      appliedSearch,
      dateFrom,
      dateTo,
      page,
    ],
    queryFn: () => comptaApi.paymentInstruments({
      statut: status,
      search: appliedSearch || undefined,
      dateDu: dateFrom || undefined,
      dateAu: dateTo || undefined,
      page,
      size: TREASURY_PAGE_SIZE,
    }),
  });

  const changeStatus = useMutation({
    mutationFn: () => comptaApi.changePaymentInstrumentStatus(activeInstrument!.id, {
      statut: action,
      compteTresorerieId: action === "CONFIRME" ? accountId : undefined,
      dateOperation: operationDate,
      motif: reason.trim() || undefined,
    }),
    onSuccess: async () => {
      toast.success(action === "CONFIRME" ? "Encaissement confirmé" : "Moyen de paiement rejeté");
      closeAction();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
      ]);
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Opération impossible"
    ),
  });

  const bankAccounts = (accounts.data ?? []).filter(
    (account) => account.actif && account.typeCompte === "BANQUE"
  );

  function openAction(instrument: PaymentInstrument, nextAction: InstrumentAction) {
    setAction(nextAction);
    setActiveInstrument(instrument);
    setAccountId(nextAction === "CONFIRME"
      ? instrument.compteTresorerieId ?? ""
      : "");
    setOperationDate(TODAY);
    setReason("");
  }

  function closeAction() {
    setActiveInstrument(undefined);
    setAccountId("");
    setReason("");
  }

  function resetFilters() {
    setSearch("");
    setAppliedSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  const pending = status === "EN_ATTENTE";
  const confirmed = status === "CONFIRME";
  const rejected = status === "REJETE";
  const filterDateLabel = pending
    ? "Date du moyen de paiement"
    : rejected
      ? "Date du rejet"
      : "Date de confirmation";

  return (
    <div className="grid gap-5">
      <header>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">
          Trésorerie
        </div>
        <h1 className="mt-1 text-xl font-semibold">Suivi des encaissements</h1>
        <p className="text-sm text-muted-foreground">
          Suivi des chèques, effets, virements, cartes et versements bancaires.
        </p>
      </header>

      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as InstrumentRegisterStatus);
          setPage(0);
        }}
      >
        <TabsList aria-label="Statut des moyens de paiement">
          <TabsTrigger value="EN_ATTENTE">
            <Clock3 className="size-4" /> À encaisser
          </TabsTrigger>
          <TabsTrigger value="CONFIRME">
            <CheckCircle2 className="size-4" /> Confirmés
          </TabsTrigger>
          <TabsTrigger value="REJETE">
            <Ban className="size-4" /> Rejetés
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <section className="grid gap-3 rounded-md border bg-card p-4 lg:grid-cols-[1fr_180px_180px_auto]">
        <div className="grid gap-2">
          <Label htmlFor="instrument-search">Payeur, règlement, banque ou référence</Label>
          <Input
            id="instrument-search"
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
          <Label>{filterDateLabel} du</Label>
          <DatePicker
            date={dateFrom}
            onSelect={(value) => {
              setDateFrom(toDateOnly(value) ?? "");
              setPage(0);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>{filterDateLabel} au</Label>
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
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white">
              <tr>
                <th className="px-4 py-3 text-left">Règlement</th>
                <th className="px-4 py-3 text-left">Payeur</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Référence</th>
                <th className="px-4 py-3 text-left">
                  {pending ? "Date du moyen" : rejected ? "Rejeté le" : "Confirmé le"}
                </th>
                <th className="px-4 py-3 text-left">
                  {pending ? "Échéance" : rejected ? "Motif" : "Compte crédité"}
                </th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {instruments.isLoading ? (
                <TableRowsSkeleton colSpan={8} rows={6} />
              ) : (instruments.data?.rows ?? []).map((instrument) => (
                <tr key={instrument.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{instrument.numeroReglement}</td>
                  <td className="px-4 py-3">{instrument.payeurNom}</td>
                  <td className="px-4 py-3">{paymentModeLabel(instrument.mode)}</td>
                  <td className="px-4 py-3">{instrument.referenceInstrument || "-"}</td>
                  <td className="px-4 py-3">
                    {formatTreasuryDate(pending
                      ? instrument.dateInstrument
                      : instrument.dateStatut)}
                  </td>
                  <td className="px-4 py-3">
                    {pending
                      ? formatTreasuryDate(instrument.dateEcheance)
                      : rejected
                        ? instrument.motifStatut || "-"
                        : instrument.compteTresorerie || "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatTreasuryMoney(instrument.montant)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {pending && (
                        <Button
                          size="sm"
                          disabled={!canManage}
                          onClick={() => openAction(instrument, "CONFIRME")}
                        >
                          Confirmer
                        </Button>
                      )}
                      {!rejected && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canManage}
                          onClick={() => openAction(instrument, "REJETE")}
                        >
                          {confirmed ? "Signaler un rejet" : "Rejeter"}
                        </Button>
                      )}
                      {rejected && <span className="text-muted-foreground">-</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {!instruments.isLoading && (instruments.data?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Aucun moyen de paiement ne correspond à la recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {instruments.data && (
          <ServerPagination
            page={instruments.data.page.number}
            totalPages={instruments.data.page.totalPages}
            totalElements={instruments.data.page.totalElements}
            loading={instruments.isFetching}
            onPageChange={setPage}
          />
        )}
      </section>

      <Dialog
        open={Boolean(activeInstrument)}
        onOpenChange={(open) => {
          if (!open) {
            closeAction();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {action === "CONFIRME"
                ? "Confirmer l’encaissement"
                : activeInstrument?.statut === "CONFIRME"
                  ? "Signaler un rejet bancaire"
                  : "Rejeter le moyen de paiement"}
            </DialogTitle>
            <DialogDescription>
              {activeInstrument?.numeroReglement} · {formatTreasuryMoney(activeInstrument?.montant ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {action === "REJETE" && activeInstrument?.statut === "CONFIRME" && (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Le rejet annulera l’encaissement et créera une écriture de sortie sur
                  {` ${activeInstrument.compteTresorerie || "le compte bancaire associé"}`}.
                </span>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Date d’opération</Label>
              <DatePicker
                date={operationDate}
                onSelect={(value) => setOperationDate(toDateOnly(value) ?? "")}
              />
            </div>
            {action === "CONFIRME" && (
              <div className="grid gap-2">
                <Label>Compte bancaire crédité</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un compte" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.libelle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bankAccounts.length === 0 && (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertCircle className="size-4 shrink-0" />
                    Aucun compte bancaire actif n’est disponible.
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label>{action === "REJETE" ? "Motif du rejet" : "Observation"}</Label>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAction}>Annuler</Button>
            <Button
              variant={action === "REJETE" ? "destructive" : "default"}
              disabled={changeStatus.isPending
                || !operationDate
                || (action === "CONFIRME" ? !accountId : !reason.trim())}
              onClick={() => changeStatus.mutate()}
            >
              {action === "CONFIRME"
                ? "Confirmer l’encaissement"
                : activeInstrument?.statut === "CONFIRME"
                  ? "Confirmer le rejet"
                  : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
