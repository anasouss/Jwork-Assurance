import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import { requiresBankAccountAtEntry, requiresPaymentReference, showsOriginatingBank } from "../client-payment-methods";
import type { ClientPaymentMode, PaymentInstrument } from "../types";
import { formatTreasuryMoney, paymentModeLabel, TODAY } from "../pages/treasury-format";
import { BankSelect } from "./BankSelect";

const MODES: ClientPaymentMode[] = ["ESPECES", "CHEQUE", "EFFET", "VIREMENT", "VERSEMENT_BANCAIRE"];

export function ReplacePaymentInstrumentDialog({ instrument, onClose, onReplaced }: {
  instrument: PaymentInstrument;
  onClose: () => void;
  onReplaced?: (instrumentId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ClientPaymentMode>("ESPECES");
  const [date, setDate] = useState(TODAY);
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [bankId, setBankId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [reason, setReason] = useState("");
  const needsAccount = requiresBankAccountAtEntry(mode);
  const needsBank = showsOriginatingBank(mode);
  const needsDueDate = mode === "CHEQUE" || mode === "EFFET";
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"], queryFn: comptaApi.treasuryAccounts, enabled: needsAccount,
  });
  const banks = useQuery({
    queryKey: ["compta", "banks", "active"], queryFn: () => comptaApi.banks(), enabled: needsBank,
  });
  const bankAccounts = (accounts.data ?? []).filter((account) => account.actif && account.typeCompte === "BANQUE");
  const earliestDate = instrument.statut === "REJETE" ? instrument.dateRejet || instrument.dateStatut : undefined;
  const invalid = !instrument.remplacementPossible || !date || date > TODAY
    || Boolean(earliestDate && date < earliestDate) || !reason.trim()
    || (needsDueDate && !dueDate)
    || (requiresPaymentReference(mode) && !reference.trim())
    || (needsBank && !(banks.data ?? []).some((bank) => bank.id === bankId))
    || (needsAccount && !bankAccounts.some((account) => account.id === accountId));
  const replace = useMutation({
    mutationFn: () => comptaApi.replacePaymentInstrument(instrument.id, {
      mode, montant: instrument.montant, dateInstrument: date,
      dateEcheance: needsDueDate ? dueDate : undefined,
      referenceInstrument: mode !== "ESPECES" ? reference.trim() || undefined : undefined,
      banqueEmettriceId: needsBank ? bankId : undefined,
      compteTresorerieId: needsAccount ? accountId : undefined,
      motif: reason.trim(),
    }),
    onSuccess: async () => {
      onReplaced?.(instrument.id);
      onClose();
      toast.success("Moyen de paiement remplacé");
      await queryClient.invalidateQueries({ queryKey: ["compta"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Remplacement impossible"),
  });

  return <Dialog open onOpenChange={(open) => !open && !replace.isPending && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Remplacer le moyen de paiement</DialogTitle>
        <DialogDescription>{instrument.payeurNom} · {paymentModeLabel(instrument.mode)} {instrument.referenceInstrument || ""} · {formatTreasuryMoney(instrument.montant)}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="replacement-mode">Nouveau mode</Label><Select value={mode} disabled={replace.isPending} onValueChange={(value) => { setMode(value as ClientPaymentMode); setAccountId(""); }}>
          <SelectTrigger id="replacement-mode"><SelectValue /></SelectTrigger><SelectContent>{MODES.map((value) => <SelectItem key={value} value={value}>{paymentModeLabel(value)}</SelectItem>)}</SelectContent>
        </Select></div>
        <div className="grid gap-2"><Label>Date du remplacement</Label><DatePicker date={date} disabled={replace.isPending} minDate={earliestDate ? new Date(`${earliestDate}T00:00:00`) : undefined} maxDate={new Date(`${TODAY}T00:00:00`)} onSelect={(value) => setDate(toDateOnly(value) ?? "")} /></div>
        {needsDueDate && <div className="grid gap-2"><Label>{mode === "CHEQUE" ? "Date portée sur le chèque" : "Date d’échéance"}</Label><DatePicker date={dueDate} disabled={replace.isPending} onSelect={(value) => setDueDate(toDateOnly(value) ?? "")} /></div>}
        {mode !== "ESPECES" && <div className="grid gap-2"><Label htmlFor="replacement-reference">Référence{requiresPaymentReference(mode) ? " *" : ""}</Label><Input id="replacement-reference" maxLength={120} value={reference} disabled={replace.isPending} onChange={(event) => setReference(event.target.value)} /></div>}
        {needsAccount && <div className="grid gap-2"><Label htmlFor="replacement-account">Compte bancaire crédité *</Label><Select value={accountId} disabled={replace.isPending || accounts.isLoading} onValueChange={setAccountId}>
          <SelectTrigger id="replacement-account"><SelectValue placeholder="Choisir un compte" /></SelectTrigger><SelectContent>{bankAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent>
        </Select>{!accounts.isLoading && !accounts.isError && bankAccounts.length === 0 && <p className="text-xs text-muted-foreground">Aucun compte bancaire actif disponible.</p>}
          {accounts.isError && <p role="alert" className="text-xs text-destructive">Chargement des comptes impossible. <Button variant="link" size="sm" onClick={() => void accounts.refetch()}>Réessayer</Button></p>}
        </div>}
        {needsBank && <div className="grid gap-2"><BankSelect banks={banks.data ?? []} value={bankId} label={needsDueDate ? "Banque émettrice *" : "Banque d’origine *"} onChange={setBankId} disabled={replace.isPending || banks.isLoading} />
          {banks.isError && <p role="alert" className="text-xs text-destructive">Chargement des banques impossible. <Button variant="link" size="sm" onClick={() => void banks.refetch()}>Réessayer</Button></p>}
        </div>}
        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="replacement-reason">Motif du remplacement *</Label><Textarea id="replacement-reason" maxLength={500} value={reason} disabled={replace.isPending} onChange={(event) => setReason(event.target.value)} /></div>
      </div>
      <DialogFooter><Button variant="outline" disabled={replace.isPending} onClick={onClose}>Annuler</Button><Button disabled={invalid || replace.isPending} onClick={() => replace.mutate()}><RotateCcw className="size-4" />{replace.isPending ? "Enregistrement..." : "Enregistrer le remplacement"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
