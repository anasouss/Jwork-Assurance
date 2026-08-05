import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { statusLabels } from "../format";
import type { StatutSinistre } from "../types";

const NEXT: Record<StatutSinistre, StatutSinistre[]> = {
  BROUILLON: ["DECLARE", "ANNULE"],
  DECLARE: ["DOSSIER_INCOMPLET", "TRANSMIS_COMPAGNIE", "ANNULE"],
  DOSSIER_INCOMPLET: ["DECLARE", "TRANSMIS_COMPAGNIE", "ANNULE"],
  TRANSMIS_COMPAGNIE: ["EXPERTISE", "EN_ATTENTE_REGLEMENT", "REJETE"],
  EXPERTISE: ["EN_ATTENTE_REGLEMENT", "REJETE"],
  EN_ATTENTE_REGLEMENT: ["PARTIELLEMENT_REGLE", "REGLE", "REJETE"],
  PARTIELLEMENT_REGLE: ["EN_ATTENTE_REGLEMENT", "REGLE", "CLOTURE"],
  REGLE: ["CLOTURE", "ROUVERT"],
  CLOTURE: ["ROUVERT"],
  REJETE: ["CLOTURE", "ROUVERT"],
  ANNULE: [],
  ROUVERT: [
    "DOSSIER_INCOMPLET",
    "TRANSMIS_COMPAGNIE",
    "EXPERTISE",
    "EN_ATTENTE_REGLEMENT",
  ],
};

export function SinistreTransitionDialog({
  open,
  current,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  current: StatutSinistre;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (statut: StatutSinistre, motif?: string) => void;
}) {
  const [statut, setStatut] = useState<StatutSinistre | "">("");
  const [motif, setMotif] = useState("");
  useEffect(() => {
    if (open) {
      setStatut("");
      setMotif("");
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Faire évoluer le dossier</DialogTitle>
          <DialogDescription>
            Le changement est historisé avec son auteur et sa date.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Nouveau statut</Label>
            <Select
              value={statut}
              onValueChange={(value) => setStatut(value as StatutSinistre)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {NEXT[current].map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Motif / observation</Label>
            <Textarea
              value={motif}
              maxLength={500}
              onChange={(event) => setMotif(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!statut || saving}
            onClick={() => {
              if (statut) onSubmit(statut, motif.trim() || undefined);
            }}
          >
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function hasAvailableTransition(statut: StatutSinistre) {
  return NEXT[statut].length > 0;
}
