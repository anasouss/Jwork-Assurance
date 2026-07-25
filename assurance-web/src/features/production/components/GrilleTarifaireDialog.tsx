import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import type { ReferenceOption, UpsertGrilleTarifaireRequest } from "../types";

export function GrilleTarifaireDialog({
  open,
  onOpenChange,
  grille,
  compagnies,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grille?: ReferenceOption | null;
  compagnies: ReferenceOption[];
  onSubmit: (payload: UpsertGrilleTarifaireRequest) => void;
  submitting?: boolean;
}) {
  const [compagnieAssuranceId, setCompagnieAssuranceId] = useState("");
  const [libelle, setLibelle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setCompagnieAssuranceId(grille?.compagnieAssuranceId ?? "");
    setLibelle(grille?.libelle ?? "");
    setDescription(grille?.description ?? "");
  }, [grille, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{grille ? "Modifier grille tarifaire" : "Ajouter grille tarifaire"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Compagnie">
            <Select value={compagnieAssuranceId} onValueChange={setCompagnieAssuranceId}>
              <SelectTrigger><SelectValue placeholder="Compagnie" /></SelectTrigger>
              <SelectContent>
                {compagnies.map((compagnie) => (
                  <SelectItem key={compagnie.id} value={compagnie.id}>{compagnie.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Libellé">
            <Input value={libelle} onChange={(event) => setLibelle(event.target.value)} />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            disabled={submitting}
            onClick={() => onSubmit({ compagnieAssuranceId, libelle, description, actif: true })}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
