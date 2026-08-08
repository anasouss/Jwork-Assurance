import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Banknote,
  FileText,
  History,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { formatAccountingAmount, parseAccountingAmount } from "../format";
import type {
  ClientPaymentMode,
  ClientReceivable,
  CreateClientPaymentRequest,
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
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });

  const selectedRows = Object.values(selected);
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.soldeOuvert, 0);
  const instrumentTotal = instruments.reduce((sum, row) => sum + numeric(row.montant), 0);
  const payerKey = selectedRows[0] ? sourcePayerKey(selectedRows[0]) : null;
  const remainingAmount = round(selectedTotal - instrumentTotal);
  const activeCashAccounts = (accounts.data ?? []).filter(
    (account) => account.actif && account.typeCompte === "CAISSE"
  );

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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">
            Comptabilité
          </div>
          <h1 className="mt-1 text-xl font-semibold">Règlements clients</h1>
          <p className="text-sm text-muted-foreground">
            Créances ouvertes, paiements partiels et moyens de règlement.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/compta/reglements/historique">
            <History className="size-4" />
            Règlements enregistrés
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 rounded-md border bg-card p-4">
        <Tabs
          value={receivableKind}
          onValueChange={(value) => {
            setReceivableKind(value as ReceivableKind);
            setPage(0);
          }}
        >
          <TabsList aria-label="Origine des créances">
            <TabsTrigger value="DIRECT">
              <ReceiptText className="size-4" />
              Écritures directes
            </TabsTrigger>
            <TabsTrigger value="INVOICE">
              <FileText className="size-4" />
              Factures émises
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid min-w-72 flex-1 gap-2">
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
          <div className="flex items-end gap-2">
            <Button
              onClick={() => {
                setPage(0);
                setAppliedSearch(search.trim());
              }}
            >
              <Search className="size-4" /> Rechercher
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setSearch("");
                setAppliedSearch("");
                setPage(0);
              }}
              title="Réinitialiser"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
        {selectedRows.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {selectedRows.length} créance(s) sélectionnée(s), pour {money(selectedTotal)}.
            Vous pouvez changer d’onglet pour compléter ce règlement avec la même cible.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
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
            <div className="grid border-y bg-muted/25 sm:grid-cols-4">
              <SummaryCell label="Créances" value={String(receivables.data?.summary.total ?? 0)} />
              <SummaryCell
                label="Montant initial"
                value={money(receivables.data?.summary.montantInitial ?? 0)}
              />
              <SummaryCell
                label="Déjà confirmé"
                value={money(receivables.data?.summary.montantConfirme ?? 0)}
              />
              <SummaryCell
                label="En attente"
                value={money(receivables.data?.summary.montantEnAttente ?? 0)}
              />
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
                      <tr key={receivableTargetKey(row)} className="hover:bg-muted/30">
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
                  {!receivables.isLoading && (receivables.data?.rows.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                        Aucune créance ouverte ne correspond à la recherche.
                      </td>
                    </tr>
                  )}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[1120px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1120px]">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>Enregistrer un règlement</DialogTitle>
            <DialogDescription>
              {selectedRows[0]?.source.payeurNom} · {selectedRows.length} créance(s) sélectionnée(s)
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-6 py-5">
            <div className="grid overflow-hidden rounded-md border sm:grid-cols-4">
              <SummaryCell label="Créances" value={String(selectedRows.length)} />
              <SummaryCell label="Total sélectionné" value={money(selectedTotal)} />
              <SummaryCell label="Montant du règlement" value={money(instrumentTotal)} />
              <SummaryCell
                label={remainingAmount >= 0 ? "Solde restant" : "Dépassement"}
                value={money(Math.abs(remainingAmount))}
                tone={remainingAmount < 0 ? "danger" : "default"}
              />
            </div>

            <section className="overflow-hidden rounded-md border">
              <div className="border-b bg-muted/30 px-4 py-2.5">
                <h3 className="text-sm font-semibold">Créances sélectionnées</h3>
              </div>
              <div className="max-h-44 overflow-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="sticky top-0 bg-background text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Police</th>
                      <th className="px-4 py-2 text-left">Nature</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-right">Solde ouvert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedRows.map((row) => (
                      <tr key={receivableTargetKey(row)}>
                        <td className="px-4 py-2.5 font-medium">{row.source.police || "-"}</td>
                        <td className="px-4 py-2.5">
                          {row.source.mouvement}
                          <div className="text-xs text-muted-foreground">
                            {row.source.reference || row.source.nature || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">{date(row.source.dateEffet)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {money(row.soldeOuvert)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid gap-2 sm:max-w-56">
              <Label>Date du règlement</Label>
              <DatePicker
                date={dateReglement}
                onSelect={(value) => setDateReglement(toDateOnly(value) ?? "")}
              />
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Moyens de règlement</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setInstruments((current) => [...current, newInstrument()])}
                >
                  <Plus className="size-4" />
                  Ajouter un moyen
                </Button>
              </div>
              {instruments.map((instrument, index) => (
                <section key={instrument.key} className="grid gap-4 rounded-md border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold">Moyen {index + 1}</h4>
                      <p className="text-xs text-muted-foreground">
                        {modeLabels[instrument.mode]}
                      </p>
                    </div>
                    {instruments.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Supprimer ce moyen"
                        onClick={() => setInstruments((current) => current.filter(
                          (item) => item.key !== instrument.key
                        ))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="grid gap-2">
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
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Montant</Label>
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto px-0 py-0 text-xs"
                          onClick={() => {
                            const otherTotal = instruments.reduce(
                              (sum, row) => row.key === instrument.key
                                ? sum
                                : sum + numeric(row.montant),
                              0
                            );
                            updateInstrument(instrument.key, {
                              montant: String(round(Math.max(0, selectedTotal - otherTotal))),
                            });
                          }}
                        >
                          Affecter le solde
                        </Button>
                      </div>
                      <Input
                        inputMode="decimal"
                        value={instrument.montant}
                        onChange={(event) => updateInstrument(
                          instrument.key,
                          { montant: event.target.value }
                        )}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Date du moyen de paiement</Label>
                      <DatePicker
                        date={instrument.dateInstrument}
                        onSelect={(value) => updateInstrument(instrument.key, {
                          dateInstrument: toDateOnly(value) ?? "",
                        })}
                      />
                    </div>
                    {instrument.mode === "EFFET" && (
                      <div className="grid gap-2">
                        <Label>Date d’échéance</Label>
                        <DatePicker
                          date={instrument.dateEcheance}
                          onSelect={(value) => updateInstrument(instrument.key, {
                            dateEcheance: toDateOnly(value) ?? "",
                          })}
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
                        <div className="grid gap-2">
                          <Label>Référence</Label>
                          <Input
                            value={instrument.referenceInstrument}
                            onChange={(event) => updateInstrument(
                              instrument.key,
                              { referenceInstrument: event.target.value }
                            )}
                          />
                        </div>
                        <div className="grid gap-2">
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
                  {instrument.mode === "ESPECES" && activeCashAccounts.length === 0 && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      <AlertCircle className="size-4 shrink-0" />
                      Aucune caisse active n’est disponible.
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <div className="mr-auto text-sm text-muted-foreground">
              {remainingAmount > 0.001
                ? `Paiement partiel · reste ${money(remainingAmount)}`
                : remainingAmount < -0.001
                  ? `Le montant dépasse le solde de ${money(Math.abs(remainingAmount))}`
                  : "Le règlement couvre la sélection"}
            </div>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!canSubmit || createPayment.isPending}
              onClick={() => createPayment.mutate()}
            >
              <Banknote className="size-4" />
              Enregistrer le règlement
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
    <div className="grid gap-2">
      <Label>{type === "CAISSE" ? "Caisse" : "Compte bancaire"}</Label>
      <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
        <SelectContent>
          {options.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {options.length === 0 && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          Aucun compte actif disponible
        </p>
      )}
    </div>
  );
}

type SummaryCellProps = {
  label: string;
  value: string;
  tone?: "default" | "danger";
};

function SummaryCell({ label, value, tone = "default" }: SummaryCellProps) {
  return (
    <div className="border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={tone === "danger" ? "mt-1 font-semibold text-red-600" : "mt-1 font-semibold"}>
        {value}
      </div>
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
  return parseAccountingAmount(value);
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: number) {
  return formatAccountingAmount(value);
}

function date(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}
