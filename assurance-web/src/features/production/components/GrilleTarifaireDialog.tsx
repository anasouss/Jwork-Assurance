import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import type { ReferenceOption, UpsertGrilleTarifaireRequest } from "../types";

export function GrilleTarifaireDialog({
  open,
  onOpenChange,
  grille,
  defaultCompagnieAssuranceId,
  hideCompagnie = false,
  compagnies,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grille?: ReferenceOption | null;
  defaultCompagnieAssuranceId?: string;
  hideCompagnie?: boolean;
  compagnies: ReferenceOption[];
  onSubmit: (payload: UpsertGrilleTarifaireRequest) => void;
  submitting?: boolean;
}) {
  const [compagnieAssuranceId, setCompagnieAssuranceId] = useState("");
  const [libelle, setLibelle] = useState("");
  const [description, setDescription] = useState("");
  const [actif, setActif] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCompagnieAssuranceId(grille?.compagnieAssuranceId ?? defaultCompagnieAssuranceId ?? "");
    setLibelle(grille?.libelle ?? "");
    setDescription(grille?.description ?? "");
    setActif(grille?.actif !== false);
  }, [defaultCompagnieAssuranceId, grille, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{grille ? "Modifier grille tarifaire" : "Ajouter grille tarifaire"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {hideCompagnie ? null : (
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
          )}
          <Field label="Libellé">
            <Input value={libelle} onChange={(event) => setLibelle(event.target.value)} />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={actif} onCheckedChange={(checked) => setActif(checked === true)} />
            Grille active
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            disabled={submitting}
            onClick={() => onSubmit({ compagnieAssuranceId, libelle, description, actif })}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
