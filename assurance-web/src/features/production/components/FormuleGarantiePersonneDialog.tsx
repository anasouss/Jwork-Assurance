import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import { numberValue, toNumber } from "../utils/format";
import type { ReferenceOption, UpsertFormuleGarantiePersonneRequest } from "../types";

export function FormuleGarantiePersonneDialog({
  open,
  onOpenChange,
  formule,
  garanties,
  usages,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formule?: ReferenceOption | null;
  garanties: ReferenceOption[];
  usages: ReferenceOption[];
  onSubmit: (payload: UpsertFormuleGarantiePersonneRequest) => void;
  submitting?: boolean;
}) {
  const personneGaranties = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "") === "PERSONNE"),
    [garanties]
  );
  const [payload, setPayload] = useState<UpsertFormuleGarantiePersonneRequest>({ garantieId: "" });

  useEffect(() => {
    if (!open) return;
    setPayload({
      garantieId: String(formule?.garantieId ?? ""),
      usageId: String(formule?.usageId ?? ""),
      formule: formule?.libelle ?? "",
      montantDeces: toNumber(formule?.montantDeces),
      montantInvalidite: toNumber(formule?.montantInvalidite),
      montantFraisMedicaux: toNumber(formule?.montantFraisMedicaux),
      montantFraisHospitalisation: toNumber(formule?.montantFraisHospitalisation),
      montantFraisFuneraires: toNumber(formule?.montantFraisFuneraires),
      montantFraisChirurgie: toNumber(formule?.montantFraisChirurgie),
      primeNette: toNumber(formule?.primeNette),
      accessoire: toNumber(formule?.accessoire),
      actif: true,
    });
  }, [formule, open]);

  const update = (patch: Partial<UpsertFormuleGarantiePersonneRequest>) => {
    setPayload((current) => ({ ...current, ...patch }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{formule ? "Modifier formule personne" : "Ajouter formule personne"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Garantie">
            <Select value={payload.garantieId} onValueChange={(value) => update({ garantieId: value })}>
              <SelectTrigger><SelectValue placeholder="PP / PC" /></SelectTrigger>
              <SelectContent>
                {personneGaranties.map((garantie) => (
                  <SelectItem key={garantie.id} value={garantie.id}>
                    {garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Usage">
            <Select value={payload.usageId ?? ""} onValueChange={(value) => update({ usageId: value })}>
              <SelectTrigger><SelectValue placeholder="Usage concerné" /></SelectTrigger>
              <SelectContent>
                {usages.map((usage) => (
                  <SelectItem key={usage.id} value={usage.id}>{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Formule">
            <Input value={payload.formule ?? ""} onChange={(event) => update({ formule: event.target.value })} />
          </Field>
          <Field label="Décès">
            <Input type="number" value={payload.montantDeces ?? ""} onChange={(event) => update({ montantDeces: numberValue(event.target.value) })} />
          </Field>
          <Field label="Invalidité">
            <Input type="number" value={payload.montantInvalidite ?? ""} onChange={(event) => update({ montantInvalidite: numberValue(event.target.value) })} />
          </Field>
          <Field label="Frais médicaux">
            <Input type="number" value={payload.montantFraisMedicaux ?? ""} onChange={(event) => update({ montantFraisMedicaux: numberValue(event.target.value) })} />
          </Field>
          <Field label="Hospitalisation">
            <Input type="number" value={payload.montantFraisHospitalisation ?? ""} onChange={(event) => update({ montantFraisHospitalisation: numberValue(event.target.value) })} />
          </Field>
          <Field label="Frais funéraires">
            <Input type="number" value={payload.montantFraisFuneraires ?? ""} onChange={(event) => update({ montantFraisFuneraires: numberValue(event.target.value) })} />
          </Field>
          <Field label="Chirurgie">
            <Input type="number" value={payload.montantFraisChirurgie ?? ""} onChange={(event) => update({ montantFraisChirurgie: numberValue(event.target.value) })} />
          </Field>
          <Field label="Prime nette">
            <Input type="number" value={payload.primeNette ?? ""} onChange={(event) => update({ primeNette: numberValue(event.target.value) })} />
          </Field>
          <Field label="Accessoire">
            <Input type="number" value={payload.accessoire ?? ""} onChange={(event) => update({ accessoire: numberValue(event.target.value) })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={submitting} onClick={() => onSubmit(cleanPayload(payload))}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cleanPayload(payload: UpsertFormuleGarantiePersonneRequest): UpsertFormuleGarantiePersonneRequest {
  return {
    ...payload,
    usageId: payload.usageId || undefined,
    formule: payload.formule || undefined,
  };
}
