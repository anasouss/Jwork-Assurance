import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TypeOperation } from "../types";

export type FinanceDialogMode = "PROVISION" | "OPERATION";
export function SinistreFinanceDialog({
  open,
  mode,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: FinanceDialogMode;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: object) => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [type, setType] = useState<TypeOperation>("REGLEMENT");
  const [reference, setReference] = useState("");
  const [beneficiaire, setBeneficiaire] = useState("");
  const [modeReglement, setModeReglement] = useState("");
  useEffect(() => {
    if (open) {
      setDate(todayIso());
      setMontant("");
      setMotif("");
      setType("REGLEMENT");
      setReference("");
      setBeneficiaire("");
      setModeReglement("");
    }
  }, [open, mode]);
  const valid = Boolean(
    date && Number(montant) > 0 && (mode === "OPERATION" || motif.trim()),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "PROVISION"
              ? "Enregistrer une provision"
              : "Enregistrer une opération"}
          </DialogTitle>
          <DialogDescription>
            {mode === "PROVISION"
              ? "La nouvelle provision devient la valeur courante sans effacer l’historique."
              : "Les règlements, frais et recours alimentent les totaux du dossier."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === "OPERATION" ? (
            <Field label="Type *">
              <Select
                value={type}
                onValueChange={(value) => setType(value as TypeOperation)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REGLEMENT">Règlement</SelectItem>
                  <SelectItem value="FRAIS">Frais</SelectItem>
                  <SelectItem value="RECOURS">Recours</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field label="Date *">
            <DatePicker
              date={date}
              maxDate={new Date()}
              onSelect={(value) => setDate(toIso(value))}
            />
          </Field>
          <Field label="Montant (MAD) *">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={montant}
              onChange={(event) => setMontant(event.target.value)}
            />
          </Field>
          {mode === "OPERATION" ? (
            <>
              <Field label="Référence">
                <Input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </Field>
              <Field label="Bénéficiaire">
                <Input
                  value={beneficiaire}
                  onChange={(event) => setBeneficiaire(event.target.value)}
                />
              </Field>
              <Field label="Mode de règlement">
                <Input
                  value={modeReglement}
                  onChange={(event) => setModeReglement(event.target.value)}
                />
              </Field>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <Field label={mode === "PROVISION" ? "Motif *" : "Notes"}>
              <Textarea
                value={motif}
                maxLength={500}
                onChange={(event) => setMotif(event.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!valid || saving}
            onClick={() =>
              onSubmit(
                mode === "PROVISION"
                  ? {
                      dateProvision: date,
                      montant: Number(montant),
                      motif: motif.trim(),
                    }
                  : {
                      type,
                      dateOperation: date,
                      montant: Number(montant),
                      reference: reference.trim() || undefined,
                      beneficiaire: beneficiaire.trim() || undefined,
                      modeReglement: modeReglement.trim() || undefined,
                      notes: motif.trim() || undefined,
                    },
              )
            }
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function todayIso() {
  return toIso(new Date());
}
function toIso(date?: Date) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
