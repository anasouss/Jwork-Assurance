import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { AttestationStockItem } from "../types";

type Props = {
  attestation: AttestationStockItem | null;
  reason: string;
  pending: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function AttestationCancelDialog({
  attestation,
  reason,
  pending,
  onReasonChange,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog
      open={attestation !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Annuler l’attestation</DialogTitle>
          <DialogDescription>
            L’attestation {attestation?.numero} ne pourra plus être utilisée ni comptée comme disponible.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-700 dark:text-neutral-300">
          <span>Motif d’annulation</span>
          <Textarea
            value={reason}
            maxLength={1000}
            rows={4}
            placeholder="Ex. attestation perdue, détériorée ou inutilisable"
            onChange={(event) => onReasonChange(event.target.value)}
          />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Fermer
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!reason.trim() || pending}
            onClick={onConfirm}
          >
            <Ban className="size-4" />
            Confirmer l’annulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
