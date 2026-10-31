import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CornerDownLeft, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import { requiresBankAccountAtEntry, requiresPaymentReference, showsOriginatingBank } from "../client-payment-methods";
import { replacementAmountCents, replacementAmountInput, replacementTotalCents } from "../payment-instrument-replacement";
import type { ClientPaymentMode, PaymentInstrument } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY } from "../pages/treasury-format";
import { BankSelect } from "./BankSelect";

const MODES: ClientPaymentMode[] = ["ESPECES", "CHEQUE", "EFFET", "VIREMENT", "VERSEMENT_BANCAIRE"];
type ReplacementRow = {
  key: string;
  mode: ClientPaymentMode;
  amount: string;
  dueDate: string;
  reference: string;
  bankId: string;
  accountId: string;
};

function newRow(mode: ClientPaymentMode, cents: number): ReplacementRow {
  return { key: crypto.randomUUID(), mode, amount: cents > 0 ? replacementAmountInput(cents) : "", dueDate: "", reference: "", bankId: "", accountId: "" };
}

export function ReplacePaymentInstrumentDialog({ instrument, onClose, onReplaced }: {
  instrument: PaymentInstrument;
  onClose: () => void;
  onReplaced?: (instrumentId: string) => void;
}) {
  const queryClient = useQueryClient();
  const sourceCents = Math.round(instrument.montant * 100);
  const [rows, setRows] = useState<ReplacementRow[]>(() => [newRow(instrument.mode, sourceCents)]);
  const [editingKey, setEditingKey] = useState<string | null>(() => rows[0]?.key ?? null);
  const [date, setDate] = useState(TODAY);
  const [reason, setReason] = useState("");
  const needsAccount = rows.some((row) => requiresBankAccountAtEntry(row.mode));
  const needsBank = rows.some((row) => showsOriginatingBank(row.mode));
  const accounts = useQuery({ queryKey: ["compta", "treasury-accounts"], queryFn: comptaApi.treasuryAccounts, enabled: needsAccount });
  const banks = useQuery({ queryKey: ["compta", "banks", "active"], queryFn: () => comptaApi.banks(), enabled: needsBank });
  const bankAccounts = (accounts.data ?? []).filter((account) => account.actif && account.typeCompte === "BANQUE");
  const earliestDate = instrument.statut === "REJETE" ? instrument.dateRejet || instrument.dateStatut : undefined;
  const totalCents = replacementTotalCents(rows.map((row) => row.amount));
  const remainingCents = totalCents === null ? null : sourceCents - totalCents;
  const invalid = !instrument.remplacementPossible || !date || date > TODAY
    || Boolean(earliestDate && date < earliestDate) || !reason.trim()
    || rows.length === 0 || rows.length > 50 || totalCents !== sourceCents
    || rows.some((row) => !rowComplete(row));
  const editingRow = rows.find((row) => row.key === editingKey);
  const cannotAdd = rows.length >= 50 || Boolean(editingRow && !rowComplete(editingRow));

  function rowComplete(row: ReplacementRow) {
    const cents = replacementAmountCents(row.amount);
    return cents !== null && cents > 0
      && ((row.mode !== "CHEQUE" && row.mode !== "EFFET") || Boolean(row.dueDate))
      && (!requiresPaymentReference(row.mode) || Boolean(row.reference.trim()))
      && (!showsOriginatingBank(row.mode) || (banks.data ?? []).some((bank) => bank.id === row.bankId))
      && (!requiresBankAccountAtEntry(row.mode) || bankAccounts.some((account) => account.id === row.accountId));
  }
  const replace = useMutation({
    mutationFn: () => comptaApi.replacePaymentInstrument(instrument.id, {
      dateRemplacement: date,
      motif: reason.trim(),
      instruments: rows.map((row) => ({
        mode: row.mode,
        montant: replacementAmountCents(row.amount)! / 100,
        dateEcheance: row.mode === "CHEQUE" || row.mode === "EFFET" ? row.dueDate : undefined,
        referenceInstrument: row.mode !== "ESPECES" ? row.reference.trim() || undefined : undefined,
        banqueEmettriceId: showsOriginatingBank(row.mode) ? row.bankId : undefined,
        compteTresorerieId: requiresBankAccountAtEntry(row.mode) ? row.accountId : undefined,
      })),
    }),
    onSuccess: async () => {
      onReplaced?.(instrument.id);
      onClose();
      toast.success("Moyens de remplacement enregistrés");
      await queryClient.invalidateQueries({ queryKey: ["compta"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Remplacement impossible"),
  });

  function updateRow(key: string, patch: Partial<Omit<ReplacementRow, "key">>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  function assignRemaining(key: string) {
    const others = replacementTotalCents(rows.filter((row) => row.key !== key).map((row) => row.amount));
    if (others !== null) updateRow(key, { amount: replacementAmountInput(Math.max(0, sourceCents - others)) });
  }

  function addRow(mode: ClientPaymentMode) {
    if (cannotAdd || replace.isPending) return;
    const next = newRow(mode, Math.max(0, remainingCents ?? 0));
    setRows((current) => [...current, next]);
    setEditingKey(next.key);
  }

  function removeRow(key: string) {
    if (rows.length === 1 || replace.isPending) return;
    const next = rows.filter((row) => row.key !== key);
    setRows(next);
    if (editingKey === key) setEditingKey(next[next.length - 1]?.key ?? null);
  }

  return <Dialog open onOpenChange={(open) => !open && !replace.isPending && onClose()}>
    <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[1440px]">
      <DialogHeader>
        <DialogTitle>Remplacer le moyen de paiement</DialogTitle>
        <DialogDescription>{instrument.payeurNom} · {paymentModeLabel(instrument.mode)} {instrument.referenceInstrument || ""} · {formatTreasuryMoney(instrument.montant)}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="grid content-start gap-2"><Label>Date du remplacement</Label><DatePicker date={date} disabled={replace.isPending} minDate={earliestDate ? new Date(`${earliestDate}T00:00:00`) : undefined} maxDate={new Date(`${TODAY}T00:00:00`)} onSelect={(value) => setDate(toDateOnly(value) ?? "")} /></div>
        <div className="grid gap-2"><Label htmlFor="replacement-reason">Motif du remplacement *</Label><Textarea id="replacement-reason" maxLength={500} value={reason} disabled={replace.isPending} onChange={(event) => setReason(event.target.value)} /></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <h3 className="text-sm font-semibold">Nouveaux moyens de règlement</h3>
        <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" disabled={replace.isPending || cannotAdd}><Plus className="size-4" /> Ajouter un moyen</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">{MODES.map((mode) => <DropdownMenuItem key={mode} onSelect={() => addRow(mode)}>{paymentModeLabel(mode)}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="divide-y">
        {rows.map((row, index) => {
          const complete = rowComplete(row);
          const cents = replacementAmountCents(row.amount);
          const bank = (banks.data ?? []).find((item) => item.id === row.bankId)?.libelle;
          const account = bankAccounts.find((item) => item.id === row.accountId)?.libelle;
          if (editingKey !== row.key) return <section key={row.key} aria-label={`Moyen de remplacement ${index + 1}`} className={`grid items-center gap-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(140px,0.8fr)_repeat(4,minmax(0,1fr))_auto] ${complete ? "bg-emerald-50/40 dark:bg-emerald-950/10" : "bg-amber-50/50 dark:bg-amber-950/10"}`}>
            <div className="flex min-w-0 items-center gap-2.5"><span className={`flex size-7 shrink-0 items-center justify-center rounded-sm border text-xs font-bold text-white ${complete ? "border-emerald-700 bg-emerald-600" : "border-amber-700 bg-amber-600"}`}>{index + 1}</span><div className="min-w-0"><div className="text-sm font-semibold">{paymentModeLabel(row.mode)}</div><div className={`text-xs ${complete ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{complete ? "Ajouté" : "À compléter"}</div></div></div>
            <ReplacementSummaryValue label="Référence" value={row.reference || "-"} />
            <ReplacementSummaryValue label="Montant" value={cents === null ? "-" : formatTreasuryMoney(cents / 100)} />
            <ReplacementSummaryValue label={row.mode === "CHEQUE" ? "Date du chèque" : "Échéance"} value={formatTreasuryDate(row.dueDate)} />
            <ReplacementSummaryValue label={row.mode === "VIREMENT" ? "Banque d’origine" : showsOriginatingBank(row.mode) ? "Banque émettrice" : "Compte crédité"} value={bank || account || "-"} detail={bank && account ? account : undefined} />
            <div className="flex justify-end gap-1"><Button type="button" size="icon" variant="ghost" title="Modifier" aria-label={`Modifier le moyen ${index + 1}`} disabled={replace.isPending} onClick={() => setEditingKey(row.key)}><Pencil className="size-4" /></Button><Button type="button" size="icon" variant="ghost" title="Supprimer" aria-label={`Supprimer le moyen ${index + 1}`} disabled={replace.isPending || rows.length === 1} onClick={() => removeRow(row.key)}><Trash2 className="size-4" /></Button></div>
          </section>;
          return <section key={row.key} aria-label={`Moyen de remplacement ${index + 1}`} className="bg-orange-50/30 px-3 py-3 dark:bg-orange-950/10">
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(150px,1fr)_minmax(120px,1fr)_minmax(160px,1.1fr)_minmax(170px,1.2fr)_auto]">
            <div className="grid gap-2"><Label htmlFor={`replacement-mode-${row.key}`}>Mode {index + 1}</Label><Select value={row.mode} disabled={replace.isPending} onValueChange={(value) => updateRow(row.key, { mode: value as ClientPaymentMode, accountId: "", bankId: "", reference: "", dueDate: "" })}>
              <SelectTrigger id={`replacement-mode-${row.key}`}><SelectValue /></SelectTrigger><SelectContent>{MODES.map((mode) => <SelectItem key={mode} value={mode}>{paymentModeLabel(mode)}</SelectItem>)}</SelectContent>
            </Select></div>
            <div className="grid gap-2"><Label htmlFor={`replacement-amount-${row.key}`}>Montant (MAD) *</Label><div className="flex gap-2"><Input id={`replacement-amount-${row.key}`} inputMode="decimal" value={row.amount} disabled={replace.isPending} onChange={(event) => updateRow(row.key, { amount: event.target.value })} /><Button type="button" size="icon" variant="outline" title="Affecter le solde" aria-label={`Affecter le solde au moyen ${index + 1}`} disabled={replace.isPending} onClick={() => assignRemaining(row.key)}><CornerDownLeft className="size-4" /></Button></div></div>
            {row.mode !== "ESPECES" && <div className="grid gap-2"><Label htmlFor={`replacement-reference-${row.key}`}>{row.mode === "VERSEMENT_BANCAIRE" ? "N° bordereau banque" : "Référence"}{requiresPaymentReference(row.mode) ? " *" : ""}</Label><Input id={`replacement-reference-${row.key}`} maxLength={120} value={row.reference} disabled={replace.isPending} onChange={(event) => updateRow(row.key, { reference: event.target.value })} /></div>}
            {(row.mode === "CHEQUE" || row.mode === "EFFET") && <div className="grid gap-2"><Label>{row.mode === "CHEQUE" ? "Date du chèque *" : "Date d’échéance *"}</Label><DatePicker date={row.dueDate} disabled={replace.isPending} onSelect={(value) => updateRow(row.key, { dueDate: toDateOnly(value) ?? "" })} /></div>}
            {showsOriginatingBank(row.mode) && <BankSelect banks={banks.data ?? []} value={row.bankId} label={row.mode === "VIREMENT" ? "Banque d’origine" : "Banque émettrice"} onChange={(bankId) => updateRow(row.key, { bankId })} disabled={replace.isPending || banks.isLoading} />}
            {requiresBankAccountAtEntry(row.mode) && <div className="grid gap-2"><Label htmlFor={`replacement-account-${row.key}`}>Compte bancaire crédité *</Label><Select value={row.accountId} disabled={replace.isPending || accounts.isLoading} onValueChange={(accountId) => updateRow(row.key, { accountId })}>
              <SelectTrigger id={`replacement-account-${row.key}`}><SelectValue placeholder="Choisir un compte" /></SelectTrigger><SelectContent>{bankAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent>
            </Select>{!accounts.isLoading && !accounts.isError && bankAccounts.length === 0 && <p className="text-xs text-muted-foreground">Aucun compte bancaire actif disponible.</p>}</div>}
            <div className="flex h-9 items-center justify-end gap-1 sm:col-span-2 xl:col-span-1 xl:col-start-6">
              <Button type="button" size="icon" variant="outline" title="Terminer la saisie" aria-label={`Terminer la saisie du moyen ${index + 1}`} disabled={replace.isPending || !complete} onClick={() => setEditingKey(null)}><Check className="size-4" /></Button>
              <Button type="button" size="icon" variant="outline" title="Ajouter un moyen du même type" aria-label={`Ajouter un autre ${paymentModeLabel(row.mode).toLowerCase()}`} disabled={replace.isPending || cannotAdd} onClick={() => addRow(row.mode)}><Plus className="size-4" /></Button>
              <Button type="button" size="icon" variant="ghost" title="Supprimer" aria-label={`Supprimer le moyen ${index + 1}`} disabled={replace.isPending || rows.length === 1} onClick={() => removeRow(row.key)}><Trash2 className="size-4" /></Button>
            </div>
          </div>
        </section>;
        })}
      </div>
      {needsBank && banks.isError && <p role="alert" className="text-sm text-destructive">Chargement des banques impossible. <Button variant="link" size="sm" onClick={() => void banks.refetch()}>Réessayer</Button></p>}
      {needsAccount && accounts.isError && <p role="alert" className="text-sm text-destructive">Chargement des comptes impossible. <Button variant="link" size="sm" onClick={() => void accounts.refetch()}>Réessayer</Button></p>}
      <dl aria-live="polite" className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
        <div><dt className="text-muted-foreground">À remplacer</dt><dd className="mt-1 font-semibold tabular-nums">{formatTreasuryMoney(instrument.montant)}</dd></div>
        <div><dt className="text-muted-foreground">Total saisi</dt><dd className="mt-1 font-semibold tabular-nums">{totalCents === null ? "-" : formatTreasuryMoney(totalCents / 100)}</dd></div>
        <div><dt className="text-muted-foreground">Écart</dt><dd className={`mt-1 font-semibold tabular-nums ${remainingCents !== null && remainingCents !== 0 ? "text-destructive" : ""}`}>{remainingCents === null ? "-" : formatTreasuryMoney(remainingCents / 100)}</dd></div>
      </dl>
      <DialogFooter><Button variant="outline" disabled={replace.isPending} onClick={onClose}>Annuler</Button><Button disabled={invalid || replace.isPending} onClick={() => replace.mutate()}><RotateCcw className="size-4" />{replace.isPending ? "Enregistrement..." : "Enregistrer le remplacement"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function ReplacementSummaryValue({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0">
    <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
    <div className="break-words text-sm font-medium tabular-nums">{value}</div>
    {detail && <div className="break-words text-xs text-muted-foreground">{detail}</div>}
  </div>;
}
