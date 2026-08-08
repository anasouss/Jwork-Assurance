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
import type { SinistreDetail, StatutSinistre } from "../types";

export function SinistreTransitionDialog({
  open,
  transitions,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  transitions: SinistreDetail["workflow"]["transitions"];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (statut: StatutSinistre, motif?: string) => void;
}) {
  const [statut, setStatut] = useState<StatutSinistre | "">("");
  const [motif, setMotif] = useState("");
  const selected = transitions.find((item) => item.statut === statut);
  const reasonRequired =
    statut === "ANNULE" || statut === "REJETE" || statut === "ROUVERT";
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
                {transitions.map((item) => (
                  <SelectItem
                    key={item.statut}
                    value={item.statut}
                    disabled={!item.autorisee}
                  >
                    {statusLabels[item.statut]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>
              Motif / observation{reasonRequired ? " *" : ""}
            </Label>
            <Textarea
              value={motif}
              maxLength={500}
              onChange={(event) => setMotif(event.target.value)}
            />
          </div>
          {selected && !selected.autorisee ? (
            <ul className="grid gap-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {selected.blocages.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={
              !statut ||
              !selected?.autorisee ||
              (reasonRequired && !motif.trim()) ||
              saving
            }
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
