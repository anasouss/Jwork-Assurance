import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Landmark } from "lucide-react";
import { toast } from "sonner";
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
  instruments?: PaymentInstrument[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (instrumentIds: string[]) => void;
};

export function AddInstrumentToRemittanceDialog({ instrument, instruments, open, onOpenChange, onAdded }: Props) {
  const queryClient = useQueryClient();
  const candidates = useMemo(
    () => instruments?.length ? instruments : instrument ? [instrument] : [],
    [instrument, instruments],
  );
  const type = candidates[0]?.mode as Exclude<RemittanceSlipType, "VERSEMENT_ESPECES"> | undefined;
  const [target, setTarget] = useState(CREATE_NEW);
  const [targetManuallySelected, setTargetManuallySelected] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [slipDate, setSlipDate] = useState(TODAY);
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedInstruments = useMemo(
    () => candidates.filter((candidate) => selectedIds.has(candidate.id)),
    [candidates, selectedIds],
  );

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
    () => (drafts.data?.rows ?? []).filter(
      (draft) => draft.nombreLignes + selectedInstruments.length <= 200
    ),
    [drafts.data, selectedInstruments.length],
  );

  useEffect(() => {
    if (!open) return;
    setTarget(CREATE_NEW);
    setTargetManuallySelected(false);
    setSlipDate(TODAY);
    setNotes("");
    setSelectedIds(new Set(candidates.map((candidate) => candidate.id)));
  }, [candidates, open]);

  useEffect(() => {
    if (!open || drafts.isLoading) return;
    setTarget((current) => {
      if (current !== CREATE_NEW && !compatibleDrafts.some((draft) => draft.id === current)) {
        return CREATE_NEW;
      }
      return !targetManuallySelected && current === CREATE_NEW && compatibleDrafts.length > 0
        ? compatibleDrafts[0].id
        : current;
    });
  }, [compatibleDrafts, drafts.isLoading, open, targetManuallySelected]);

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
      if (!type || selectedInstruments.length === 0) {
        throw new Error("Sélectionnez au moins un instrument");
      }
      const instrumentIds = selectedInstruments.map((selected) => selected.id);
      if (target !== CREATE_NEW) {
        return comptaApi.addInstrumentsToRemittanceSlip(target, instrumentIds);
      }
      if (!accountId) throw new Error("Sélectionnez le compte bancaire de destination");
      return comptaApi.createRemittanceSlip({
        type,
        dateBordereau: slipDate,
        compteDestinationId: accountId,
        notes: notes.trim() || undefined,
        instrumentIds,
      });
    },
    onSuccess: async (slip) => {
      onAdded?.(selectedInstruments.map((selected) => selected.id));
      toast.success(`${selectedInstruments.length > 1 ? "Instruments ajoutés" : "Instrument ajouté"} au bordereau ${slip.numero}`);
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["compta"] });
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Ajout au bordereau impossible"
    ),
  });

  const creating = target === CREATE_NEW;
  const label = type === "EFFET" ? "effet" : "chèque";
  const pluralLabel = type === "EFFET" ? "effets" : "chèques";
  const total = selectedInstruments.reduce((sum, selected) => sum + selected.montant, 0);

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Ajouter {candidates.length > 1 ? `des ${pluralLabel}` : `le ${label}`} à un bordereau
          </DialogTitle>
          <DialogDescription>
            {candidates.length > 1 ? `Les ${pluralLabel} resteront` : `Le ${label} restera`} en attente
            jusqu’à la remise effective du bordereau à la banque.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 text-sm">
            <div>
              <div className="text-xs uppercase text-muted-foreground">
                {candidates.length > 1 ? "Sélection" : "Référence"}
              </div>
              <div className="font-medium">
                {candidates.length > 1
                  ? `${selectedInstruments.length} / ${candidates.length}`
                  : candidates[0]?.referenceInstrument || "-"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground">
                {candidates.length > 1 ? "Montant sélectionné" : "Montant"}
              </div>
              <div className="font-semibold">{formatAccountingAmount(total)}</div>
            </div>
          </div>

          {candidates.length > 1 && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Instruments</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set<string>(
                    selectedIds.size === candidates.length ? [] : candidates.map((candidate) => candidate.id)
                  ))}
                >
                  {selectedIds.size === candidates.length ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border">
                {candidates.map((candidate) => (
                  <label key={candidate.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/30">
                    <Checkbox
                      checked={selectedIds.has(candidate.id)}
                      onCheckedChange={(checked) => setSelectedIds((current) => {
                        const next = new Set(current);
                        if (checked === true) next.add(candidate.id);
                        else next.delete(candidate.id);
                        return next;
                      })}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{candidate.referenceInstrument || "Sans référence"}</span>
                    <span className="text-muted-foreground">{candidate.dateEcheance?.split("-").reverse().join("/") || "-"}</span>
                    <span className="w-28 text-right font-semibold tabular-nums">{formatAccountingAmount(candidate.montant)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Bordereau provisoire</Label>
            <Select
              value={target}
              onValueChange={(value) => {
                setTarget(value);
                setTargetManuallySelected(true);
              }}
              disabled={drafts.isLoading}
            >
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
            disabled={selectedInstruments.length === 0 || save.isPending || (creating && (!slipDate || !accountId))}
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
