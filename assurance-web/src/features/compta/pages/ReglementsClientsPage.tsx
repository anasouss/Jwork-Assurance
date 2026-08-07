import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus, RotateCcw, Search, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type {
  ClientPayment,
  ClientPaymentMode,
  ClientReceivable,
  CreateClientPaymentRequest,
  PaymentInstrument,
  TreasuryAccount,
} from "../types";

const PAGE_SIZE = 25;
const today = new Date().toISOString().slice(0, 10);

type InstrumentDraft = {
  key: string;
  mode: ClientPaymentMode;
  montant: string;
  dateInstrument: string;
  dateEcheance: string;
  referenceInstrument: string;
  banqueEmettrice: string;
  compteTresorerieId: string;
};

type ReceivableKind = "DIRECT" | "INVOICE";

const modeLabels: Record<ClientPaymentMode, string> = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  EFFET: "Effet",
  VIREMENT: "Virement",
  VERSEMENT_BANCAIRE: "Versement bancaire",
  CARTE: "Carte",
  PRELEVEMENT: "Prélèvement",
};

export default function ReglementsClientsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreate = permissions.includes("reglement-client:create")
    || permissions.includes("reglement-client:manage");
  const canManage = permissions.includes("reglement-client:manage");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [receivableKind, setReceivableKind] = useState<ReceivableKind>("DIRECT");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, ClientReceivable>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateReglement, setDateReglement] = useState(today);
  const [notes, setNotes] = useState("");
  const [instruments, setInstruments] = useState<InstrumentDraft[]>([newInstrument()]);
  const [paymentToCancel, setPaymentToCancel] = useState<ClientPayment>();
  const [cancelReason, setCancelReason] = useState("");
  const [instrumentToReplace, setInstrumentToReplace] = useState<PaymentInstrument>();
  const [replacement, setReplacement] = useState<InstrumentDraft>(newInstrument());

  const receivables = useQuery({
    queryKey: ["compta", "client-receivables", receivableKind, appliedSearch, page],
    queryFn: () => receivableKind === "INVOICE"
      ? comptaApi.clientInvoiceReceivables({
        search: appliedSearch || undefined,
        page,
        size: PAGE_SIZE,
      })
      : comptaApi.clientReceivables({
        search: appliedSearch || undefined,
        page,
        size: PAGE_SIZE,
      }),
  });
  const payments = useQuery({
    queryKey: ["compta", "client-payments"],
    queryFn: () => comptaApi.clientPayments({ page: 0, size: PAGE_SIZE }),
  });
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });

  const selectedRows = Object.values(selected);
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.soldeOuvert, 0);
  const instrumentTotal = instruments.reduce((sum, row) => sum + numeric(row.montant), 0);
  const payerKey = selectedRows[0] ? sourcePayerKey(selectedRows[0]) : null;

  const createPayment = useMutation({
    mutationFn: () => comptaApi.createClientPayment(buildRequest(
      selectedRows,
      instruments,
      dateReglement,
      notes
    )),
    onSuccess: async (payment) => {
      toast.success(`Règlement ${payment.numero} enregistré`);
      setDialogOpen(false);
      setSelected({});
      setNotes("");
      setInstruments([newInstrument()]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Règlement impossible"),
  });

  const cancelPayment = useMutation({
    mutationFn: () => comptaApi.cancelClientPayment(paymentToCancel!.id, cancelReason.trim()),
    onSuccess: async (payment) => {
      toast.success(`Règlement ${payment.numero} annulé`);
      setPaymentToCancel(undefined);
      setCancelReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
      ]);
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Annulation impossible"
    ),
  });

  const replaceInstrument = useMutation({
    mutationFn: () => comptaApi.replacePaymentInstrument(instrumentToReplace!.id, {
      mode: replacement.mode,
      montant: instrumentToReplace!.montant,
      dateInstrument: replacement.dateInstrument || today,
      dateEcheance: replacement.dateEcheance || undefined,
      referenceInstrument: replacement.referenceInstrument.trim() || undefined,
      banqueEmettrice: replacement.banqueEmettrice.trim() || undefined,
      compteTresorerieId: replacement.compteTresorerieId || undefined,
    }),
    onSuccess: async () => {
      toast.success("Instrument remplacé");
      setInstrumentToReplace(undefined);
      setReplacement(newInstrument());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
      ]);
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Remplacement impossible"
    ),
  });

  function toggle(row: ClientReceivable, checked: boolean) {
    if (checked && payerKey && sourcePayerKey(row) !== payerKey) {
      toast.error("Sélectionnez uniquement les créances d’un même payeur");
      return;
    }
    setSelected((current) => {
      const next = { ...current };
      const key = receivableTargetKey(row);
      if (checked) {
        next[key] = row;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  function updateInstrument(key: string, patch: Partial<InstrumentDraft>) {
    setInstruments((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  const canSubmit = selectedRows.length > 0
    && instrumentTotal > 0
    && instrumentTotal <= selectedTotal + 0.001
    && instruments.every((row) => instrumentValid(row, accounts.data ?? []));

  return (
    <div className="grid gap-5">
      <header>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
        <h1 className="mt-1 text-xl font-semibold">Règlements clients</h1>
        <p className="text-sm text-muted-foreground">Encaissements, paiements partiels et moyens de règlement.</p>
      </header>

      <Tabs defaultValue="receivables">
        <TabsList>
          <TabsTrigger value="receivables">Créances ouvertes</TabsTrigger>
          <TabsTrigger value="payments">Règlements enregistrés</TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="grid gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={receivableKind === "DIRECT" ? "default" : "outline"}
              onClick={() => {
                setReceivableKind("DIRECT");
                setSelected({});
                setPage(0);
              }}
            >
              Écritures directes
            </Button>
            <Button
              variant={receivableKind === "INVOICE" ? "default" : "outline"}
              onClick={() => {
                setReceivableKind("INVOICE");
                setSelected({});
                setPage(0);
              }}
            >
              Factures émises
            </Button>
          </div>
          <section className="flex flex-wrap items-end gap-3 border-y bg-card px-4 py-4">
            <div className="min-w-72 flex-1">
              <Label htmlFor="receivable-search">
                {receivableKind === "INVOICE"
                  ? "Client, groupe ou numéro de facture"
                  : "Client, police, référence ou assistance"}
              </Label>
              <Input
                id="receivable-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setPage(0);
                    setAppliedSearch(search.trim());
                  }
                }}
              />
            </div>
            <Button onClick={() => { setPage(0); setAppliedSearch(search.trim()); }} title="Rechercher">
              <Search className="size-4" /> Rechercher
            </Button>
            <Button variant="outline" size="icon" onClick={() => { setSearch(""); setAppliedSearch(""); setPage(0); }} title="Réinitialiser">
              <RotateCcw className="size-4" />
            </Button>
          </section>

          <section className="overflow-hidden border-y bg-card">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <h2 className="font-semibold">Éléments à encaisser</h2>
                <p className="text-sm text-muted-foreground">
                  Solde ouvert de la page: {money(receivables.data?.summary.soldeOuvert ?? 0)}
                </p>
              </div>
              <Button disabled={!canCreate || !selectedRows.length} onClick={() => setDialogOpen(true)}>
                <Banknote className="size-4" /> Encaisser ({selectedRows.length})
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-orange-600 text-xs uppercase text-white">
                  <tr>
                    <th className="w-12 px-3 py-3" />
                    <th className="px-3 py-3 text-left">Payeur</th>
                    <th className="px-3 py-3 text-left">Police</th>
                    <th className="px-3 py-3 text-left">Nature</th>
                    <th className="px-3 py-3 text-left">Date</th>
                    <th className="px-3 py-3 text-right">TTC</th>
                    <th className="px-3 py-3 text-right">Confirmé</th>
                    <th className="px-3 py-3 text-right">En attente</th>
                    <th className="px-3 py-3 text-right">Solde</th>
                    <th className="px-3 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receivables.isLoading ? <TableRowsSkeleton colSpan={10} rows={8} /> :
                    (receivables.data?.rows ?? []).map((row) => (
                      <tr key={receivableTargetKey(row)}>
                        <td className="px-3 py-3 text-center">
                          <Checkbox
                            checked={Boolean(selected[receivableTargetKey(row)])}
                            onCheckedChange={(value) => toggle(row, value === true)}
                          />
                        </td>
                        <td className="px-3 py-3"><strong>{row.source.payeurNom}</strong></td>
                        <td className="px-3 py-3"><strong>{row.source.police || "-"}</strong></td>
                        <td className="px-3 py-3">
                          <strong>{row.source.mouvement}</strong>
                          <div className="text-xs text-muted-foreground">{row.source.reference || row.source.nature}</div>
                        </td>
                        <td className="px-3 py-3">{date(row.source.dateEffet)}</td>
                        <td className="px-3 py-3 text-right">{money(row.source.montantTtc)}</td>
                        <td className="px-3 py-3 text-right">{money(row.montantConfirme)}</td>
                        <td className="px-3 py-3 text-right">{money(row.montantEnAttente)}</td>
                        <td className="px-3 py-3 text-right font-semibold">{money(row.soldeOuvert)}</td>
                        <td className="px-3 py-3 text-center"><StatusBadge value={row.statut} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {receivables.data && (
              <ServerPagination
                page={receivables.data.page.number}
                totalPages={receivables.data.page.totalPages}
                totalElements={receivables.data.page.totalElements}
                loading={receivables.isFetching}
                onPageChange={setPage}
              />
            )}
          </section>
        </TabsContent>

        <TabsContent value="payments">
          <section className="overflow-x-auto border-y bg-card">
            <table className="w-full min-w-[900px] text-sm">
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
                {payments.isLoading ? <TableRowsSkeleton colSpan={7} rows={8} /> :
                  (payments.data?.rows ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-semibold">{row.numero}</td>
                      <td className="px-4 py-3">{date(row.dateReglement)}</td>
                      <td className="px-4 py-3">{row.payeurNom}</td>
                      <td className="px-4 py-3 text-right font-semibold">{money(row.montantTotal)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {row.instruments.map((item) => (
                            <span key={item.id} className="inline-flex items-center gap-1">
                              {modeLabels[item.mode]}
                              {item.statut === "REJETE" && canManage && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setInstrumentToReplace(item);
                                    setReplacement({
                                      ...newInstrument(),
                                      montant: String(item.montant),
                                    });
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
                        <Badge variant={row.statut === "VALIDE" ? "default" : "destructive"}>
                          {row.statut === "VALIDE" ? "Validé" : "Annulé"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.statut === "VALIDE" && canManage ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Annuler le règlement"
                            onClick={() => {
                              setPaymentToCancel(row);
                              setCancelReason("");
                            }}
                          >
                            <XCircle className="size-4 text-red-600" />
                          </Button>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Enregistrer un règlement</DialogTitle>
            <DialogDescription>
              {selectedRows[0]?.source.payeurNom} · {money(selectedTotal)} sélectionnés
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Date du règlement</Label>
                <Input
                  type="date"
                  value={dateReglement}
                  onChange={(event) => setDateReglement(event.target.value)}
                />
              </div>
              <div>
                <Label>Montant affecté</Label>
                <div className="h-9 rounded-md border px-3 py-2 font-semibold">
                  {money(instrumentTotal)} / {money(selectedTotal)}
                </div>
              </div>
            </div>
            {instruments.map((instrument, index) => (
              <div key={instrument.key} className="grid gap-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Moyen {index + 1}</h3>
                  {instruments.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setInstruments((current) => current.filter(
                        (item) => item.key !== instrument.key
                      ))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <Label>Mode</Label>
                    <Select
                      value={instrument.mode}
                      onValueChange={(value) => updateInstrument(instrument.key, {
                        mode: value as ClientPaymentMode,
                        compteTresorerieId: "",
                      })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(modeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Montant</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={instrument.montant}
                      onChange={(event) => updateInstrument(
                        instrument.key,
                        { montant: event.target.value }
                      )}
                    />
                  </div>
                  <div>
                    <Label>Date instrument</Label>
                    <Input
                      type="date"
                      value={instrument.dateInstrument}
                      onChange={(event) => updateInstrument(
                        instrument.key,
                        { dateInstrument: event.target.value }
                      )}
                    />
                  </div>
                  {instrument.mode === "EFFET" && (
                    <div>
                      <Label>Échéance</Label>
                      <Input
                        type="date"
                        value={instrument.dateEcheance}
                        onChange={(event) => updateInstrument(
                          instrument.key,
                          { dateEcheance: event.target.value }
                        )}
                      />
                    </div>
                  )}
                  {instrument.mode === "ESPECES" && (
                    <AccountSelect
                      accounts={accounts.data ?? []}
                      type="CAISSE"
                      value={instrument.compteTresorerieId}
                      onChange={(value) => updateInstrument(
                        instrument.key,
                        { compteTresorerieId: value }
                      )}
                    />
                  )}
                  {instrument.mode !== "ESPECES" && (
                    <>
                      <div>
                        <Label>Référence</Label>
                        <Input
                          value={instrument.referenceInstrument}
                          onChange={(event) => updateInstrument(
                            instrument.key,
                            { referenceInstrument: event.target.value }
                          )}
                        />
                      </div>
                      <div>
                        <Label>Banque émettrice</Label>
                        <Input
                          value={instrument.banqueEmettrice}
                          onChange={(event) => updateInstrument(
                            instrument.key,
                            { banqueEmettrice: event.target.value }
                          )}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => setInstruments((current) => [...current, newInstrument()])}
            >
              <Plus className="size-4" />
              Ajouter un moyen
            </Button>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!canSubmit || createPayment.isPending}
              onClick={() => createPayment.mutate()}
            >
              Enregistrer le règlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(paymentToCancel)}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentToCancel(undefined);
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler le règlement</DialogTitle>
            <DialogDescription>
              {paymentToCancel?.numero} · {money(paymentToCancel?.montantTotal ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="payment-cancel-reason">Motif d’annulation</Label>
            <Textarea
              id="payment-cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Motif obligatoire"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentToCancel(undefined)}>
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
          if (!open) {
            setInstrumentToReplace(undefined);
            setReplacement(newInstrument());
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remplacer l’instrument rejeté</DialogTitle>
            <DialogDescription>
              Le montant et les affectations sont conservés: {money(instrumentToReplace?.montant ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
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
                  {Object.entries(modeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={replacement.dateInstrument}
                onChange={(event) => setReplacement((current) => ({
                  ...current,
                  dateInstrument: event.target.value,
                }))}
              />
            </div>
            {replacement.mode === "EFFET" && (
              <div>
                <Label>Échéance</Label>
                <Input
                  type="date"
                  value={replacement.dateEcheance}
                  onChange={(event) => setReplacement((current) => ({
                    ...current,
                    dateEcheance: event.target.value,
                  }))}
                />
              </div>
            )}
            {replacement.mode === "ESPECES" ? (
              <AccountSelect
                accounts={accounts.data ?? []}
                type="CAISSE"
                value={replacement.compteTresorerieId}
                onChange={(value) => setReplacement((current) => ({
                  ...current,
                  compteTresorerieId: value,
                }))}
              />
            ) : (
              <>
                <div>
                  <Label>Référence</Label>
                  <Input
                    value={replacement.referenceInstrument}
                    onChange={(event) => setReplacement((current) => ({
                      ...current,
                      referenceInstrument: event.target.value,
                    }))}
                  />
                </div>
                <div>
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
            <Button variant="outline" onClick={() => setInstrumentToReplace(undefined)}>
              Annuler
            </Button>
            <Button
              disabled={replaceInstrument.isPending
                || !instrumentValid(replacement, accounts.data ?? [])}
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

type AccountSelectProps = {
  accounts: TreasuryAccount[];
  type: "CAISSE" | "BANQUE";
  value: string;
  onChange: (value: string) => void;
};

function AccountSelect({ accounts, type, value, onChange }: AccountSelectProps) {
  const options = accounts.filter((account) => account.actif && account.typeCompte === type);
  return (
    <div>
      <Label>{type === "CAISSE" ? "Caisse" : "Compte bancaire"}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
        <SelectContent>
          {options.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatusBadge({ value }: { value: ClientReceivable["statut"] }) {
  const labels: Record<ClientReceivable["statut"], string> = {
    IMPAYEE: "Impayée",
    PARTIELLEMENT_REGLEE: "Partielle",
    COUVERTE_EN_ATTENTE: "En attente",
    PAYEE: "Payée",
  };
  return (
    <Badge variant={value === "IMPAYEE" ? "secondary" : "outline"}>
      {labels[value]}
    </Badge>
  );
}

function buildRequest(
  rows: ClientReceivable[],
  instruments: InstrumentDraft[],
  dateReglement: string,
  notes: string
): CreateClientPaymentRequest {
  const remaining = rows.map((row) => ({
    elementFacturableId: row.source.elementFacturableId ?? undefined,
    documentClientId: row.source.documentClientId ?? undefined,
    amount: row.soldeOuvert,
  }));
  const mapped = instruments.map((instrument) => {
    let available = numeric(instrument.montant);
    const affectations: CreateClientPaymentRequest["instruments"][number]["affectations"] = [];
    for (const receivable of remaining) {
      if (available <= 0) {
        break;
      }
      const amount = Math.min(available, receivable.amount);
      if (amount > 0) {
        affectations.push({
          elementFacturableId: receivable.elementFacturableId,
          documentClientId: receivable.documentClientId,
          montant: round(amount),
        });
      }
      receivable.amount = round(receivable.amount - amount);
      available = round(available - amount);
    }
    return {
      mode: instrument.mode,
      montant: numeric(instrument.montant),
      dateInstrument: instrument.dateInstrument || dateReglement,
      dateEcheance: instrument.dateEcheance || undefined,
      referenceInstrument: instrument.referenceInstrument.trim() || undefined,
      banqueEmettrice: instrument.banqueEmettrice.trim() || undefined,
      compteTresorerieId: instrument.compteTresorerieId || undefined,
      affectations,
    };
  });
  const source = rows[0].source;
  return {
    dateReglement,
    clientPayeurId: source.payeurType === "CLIENT" ? source.payeurId : undefined,
    groupePayeurId: source.payeurType === "GROUPE" ? source.payeurId : undefined,
    notes: notes.trim() || undefined,
    instruments: mapped,
  };
}

function newInstrument(): InstrumentDraft {
  return {
    key: crypto.randomUUID(),
    mode: "ESPECES",
    montant: "",
    dateInstrument: today,
    dateEcheance: "",
    referenceInstrument: "",
    banqueEmettrice: "",
    compteTresorerieId: "",
  };
}

function instrumentValid(
  row: InstrumentDraft,
  accounts: TreasuryAccount[]
) {
  const amount = numeric(row.montant);
  if (amount <= 0) {
    return false;
  }
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
  if (referenceRequired && !row.referenceInstrument.trim()) {
    return false;
  }
  return row.mode !== "EFFET" || Boolean(row.dateEcheance);
}

function sourcePayerKey(row: ClientReceivable) {
  return `${row.source.payeurType}:${row.source.payeurId}`;
}

function receivableTargetKey(row: ClientReceivable) {
  if (row.source.documentClientId) {
    return `D:${row.source.documentClientId}`;
  }
  if (row.source.elementFacturableId) {
    return `E:${row.source.elementFacturableId}`;
  }
  throw new Error("Créance sans cible de règlement");
}

function numeric(value: string) {
  return Number(value.replace(",", ".")) || 0;
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function date(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}
