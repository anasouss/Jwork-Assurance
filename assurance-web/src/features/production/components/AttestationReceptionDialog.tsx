import type { FormEvent } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LivraisonAttestation, ReferenceOption } from "../types";
import { AttestationUsageSelectionTable } from "./AttestationUsageSelectionTable";

export type AttestationReceptionLine = {
  id: string;
  groupeUsageAttestationCode: string;
  quantite: string;
  numeroDebut: string;
  numeroFin: string;
};

type Props = {
  open: boolean;
  livraison: LivraisonAttestation | undefined;
  groupes: ReferenceOption[];
  lines: AttestationReceptionLine[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleUsage: (groupe: ReferenceOption, checked: boolean) => void;
  onQuantityChange: (line: AttestationReceptionLine, value: string) => void;
  onRangeChange: (
    line: AttestationReceptionLine,
    patch: { numeroDebut?: string; numeroFin?: string }
  ) => void;
};

export function AttestationReceptionDialog({
  open,
  livraison,
  groupes,
  lines,
  pending,
  onOpenChange,
  onSubmit,
  onToggleUsage,
  onQuantityChange,
  onRangeChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Réceptionner la commande</DialogTitle>
          <DialogDescription>
            {livraison
              ? `${livraison.referenceCommande ?? livraison.id} · ${livraison.compagnieAssuranceNom}`
              : "Sélectionnez une commande."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={onSubmit}>
          {livraison ? (
            <div className="grid gap-3 border-y bg-muted/20 p-4 sm:grid-cols-3">
              <ReceptionSummary label="Commandé" value={livraison.quantiteDemandee} />
              <ReceptionSummary label="Déjà reçu" value={livraison.quantiteRecue} />
              <ReceptionSummary
                label="Reste à recevoir"
                value={Math.max(0, livraison.quantiteDemandee - livraison.quantiteRecue)}
              />
            </div>
          ) : null}
          <AttestationUsageSelectionTable
            groupes={groupes}
            lines={lines}
            showRanges
            disabled={!livraison}
            quantityValue={(line) => line.quantite}
            onToggle={onToggleUsage}
            onQuantityChange={onQuantityChange}
            onRangeChange={onRangeChange}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !livraison}>
              <PackagePlus className="size-4" />
              Enregistrer la réception
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceptionSummary({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{new Intl.NumberFormat("fr-FR").format(value)}</div>
    </div>
  );
}
