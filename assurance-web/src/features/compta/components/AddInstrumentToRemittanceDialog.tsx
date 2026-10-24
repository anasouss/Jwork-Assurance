import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Landmark } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import type { PaymentInstrument, RemittanceSlipType } from "../types";
import { formatAccountingAmount } from "../format";

const TODAY = toDateOnly(new Date())!;
const CREATE_NEW = "NEW";

type Props = {
  instrument?: PaymentInstrument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddInstrumentToRemittanceDialog({ instrument, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const type = instrument?.mode as Exclude<RemittanceSlipType, "VERSEMENT_ESPECES"> | undefined;
  const [target, setTarget] = useState(CREATE_NEW);
  const [accountId, setAccountId] = useState("");
  const [slipDate, setSlipDate] = useState(TODAY);
  const [notes, setNotes] = useState("");

  const drafts = useQuery({
    queryKey: ["compta", "treasury", "remittance-slips", "draft", type],
    queryFn: () => comptaApi.remittanceSlips({
      type,
      statut: "BROUILLON",
      page: 0,
      size: 100,
    }),
    enabled: open && Boolean(type),
  });
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
    enabled: open,
  });
  const bankAccounts = useMemo(
    () => (accounts.data ?? []).filter((account) => account.actif && account.typeCompte === "BANQUE"),
    [accounts.data],
  );
  const compatibleDrafts = useMemo(
    () => (drafts.data?.rows ?? []).filter((draft) => draft.nombreLignes < 200),
    [drafts.data],
  );

  useEffect(() => {
    if (!open) return;
    setTarget(CREATE_NEW);
    setSlipDate(TODAY);
    setNotes("");
  }, [instrument?.id, open]);

  useEffect(() => {
    if (!open || drafts.isLoading) return;
    setTarget((current) => current === CREATE_NEW && compatibleDrafts.length > 0
      ? compatibleDrafts[0].id
      : current);
  }, [compatibleDrafts, drafts.isLoading, open]);

  useEffect(() => {
    if (!open) return;
    if (bankAccounts.length === 1) {
      setAccountId(bankAccounts[0].id);
    } else if (accountId && !bankAccounts.some((account) => account.id === accountId)) {
      setAccountId("");
    }
  }, [accountId, bankAccounts, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!instrument || !type) throw new Error("Instrument indisponible");
      if (target !== CREATE_NEW) {
        return comptaApi.addInstrumentsToRemittanceSlip(target, [instrument.id]);
      }
      if (!accountId) throw new Error("Sélectionnez le compte bancaire de destination");
      return comptaApi.createRemittanceSlip({
        type,
        dateBordereau: slipDate,
        compteDestinationId: accountId,
        notes: notes.trim() || undefined,
        instrumentIds: [instrument.id],
      });
    },
    onSuccess: async (slip) => {
      toast.success(`Instrument ajouté au bordereau ${slip.numero}`);
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["compta"] });
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Ajout au bordereau impossible"
    ),
  });

  const creating = target === CREATE_NEW;
  const label = type === "EFFET" ? "effet" : "chèque";

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter le {label} à un bordereau</DialogTitle>
          <DialogDescription>
            Le {label} restera en attente jusqu’à la remise effective du bordereau à la banque.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 text-sm">
            <div><div className="text-xs uppercase text-muted-foreground">Référence</div><div className="font-medium">{instrument?.referenceInstrument || "-"}</div></div>
            <div className="text-right"><div className="text-xs uppercase text-muted-foreground">Montant</div><div className="font-semibold">{formatAccountingAmount(instrument?.montant ?? 0)}</div></div>
          </div>

          <div className="grid gap-2">
            <Label>Bordereau provisoire</Label>
            <Select value={target} onValueChange={setTarget} disabled={drafts.isLoading}>
              <SelectTrigger><SelectValue placeholder="Choisir un bordereau" /></SelectTrigger>
              <SelectContent>
                {compatibleDrafts.map((draft) => (
                  <SelectItem key={draft.id} value={draft.id}>
                    {draft.numero} · {draft.compteDestination} · {draft.nombreLignes} ligne{draft.nombreLignes > 1 ? "s" : ""}
                  </SelectItem>
                ))}
                <SelectItem value={CREATE_NEW}>Créer un nouveau bordereau</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {creating && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Date du bordereau</Label>
                  <DatePicker date={slipDate} onSelect={(value) => setSlipDate(toDateOnly(value) ?? "")} />
                </div>
                <div className="grid gap-2">
                  <Label>Compte bancaire</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="remittance-notes">Notes <span className="text-muted-foreground">(facultatif)</span></Label>
                <Textarea id="remittance-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            disabled={!instrument || save.isPending || (creating && (!slipDate || !accountId))}
            onClick={() => save.mutate()}
          >
            {creating ? <FilePlus2 className="size-4" /> : <Landmark className="size-4" />}
            {save.isPending ? "Enregistrement..." : creating ? "Créer et ajouter" : "Ajouter au bordereau"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
