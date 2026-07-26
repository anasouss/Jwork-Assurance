import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import { MoneyInput } from "./MoneyInput";
import { toNumber } from "../utils/format";
import type { ReferenceOption, UpsertFormuleGarantiePersonneRequest } from "../types";

export function FormuleGarantiePersonneDialog({
  open,
  onOpenChange,
  formule,
  garanties,
  usages,
  onSubmit,
  submitting,
  defaultUsageId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formule?: ReferenceOption | null;
  garanties: ReferenceOption[];
  usages: ReferenceOption[];
  onSubmit: (payload: UpsertFormuleGarantiePersonneRequest) => void;
  submitting?: boolean;
  defaultUsageId?: string;
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
      usageId: String(formule?.usageId ?? defaultUsageId ?? ""),
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
  }, [defaultUsageId, formule, open]);

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
            <MoneyInput value={payload.montantDeces} onValueChange={(value) => update({ montantDeces: value })} />
          </Field>
          <Field label="Invalidité">
            <MoneyInput value={payload.montantInvalidite} onValueChange={(value) => update({ montantInvalidite: value })} />
          </Field>
          <Field label="Frais médicaux">
            <MoneyInput value={payload.montantFraisMedicaux} onValueChange={(value) => update({ montantFraisMedicaux: value })} />
          </Field>
          <Field label="Hospitalisation">
            <MoneyInput value={payload.montantFraisHospitalisation} onValueChange={(value) => update({ montantFraisHospitalisation: value })} />
          </Field>
          <Field label="Frais funéraires">
            <MoneyInput value={payload.montantFraisFuneraires} onValueChange={(value) => update({ montantFraisFuneraires: value })} />
          </Field>
          <Field label="Chirurgie">
            <MoneyInput value={payload.montantFraisChirurgie} onValueChange={(value) => update({ montantFraisChirurgie: value })} />
          </Field>
          <Field label="Prime nette">
            <MoneyInput value={payload.primeNette} onValueChange={(value) => update({ primeNette: value })} />
          </Field>
          <Field label="Accessoire">
            <MoneyInput value={payload.accessoire} onValueChange={(value) => update({ accessoire: value })} />
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
