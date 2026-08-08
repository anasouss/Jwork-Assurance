import { useEffect, useMemo, useState } from "react";
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
import type {
  ModeReglementSinistre,
  SinistreDetail,
  TypeContrepartieSinistre,
  TypeOperation,
} from "../types";

export type FinanceDialogMode = "PROVISION" | "OPERATION";

export function SinistreFinanceDialog({
  open,
  mode,
  dossier,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: FinanceDialogMode;
  dossier: SinistreDetail;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: object) => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [type, setType] = useState<TypeOperation>("REGLEMENT");
  const [reference, setReference] = useState("");
  const [counterpartyValue, setCounterpartyValue] = useState("CLIENT");
  const [freeCounterpartyName, setFreeCounterpartyName] = useState("");
  const [freeCounterpartyReason, setFreeCounterpartyReason] = useState("");
  const [modeReglement, setModeReglement] =
    useState<ModeReglementSinistre>("VIREMENT");

  const counterpartyOptions = useMemo(
    () => buildCounterpartyOptions(dossier),
    [dossier],
  );
  const selectedCounterparty = parseCounterpartyValue(counterpartyValue);

  useEffect(() => {
    if (open) {
      setDate(todayIso());
      setMontant("");
      setMotif("");
      setType("REGLEMENT");
      setReference("");
      setCounterpartyValue("CLIENT");
      setFreeCounterpartyName("");
      setFreeCounterpartyReason("");
      setModeReglement("VIREMENT");
    }
  }, [open, mode]);

  const referenceRequired =
    mode === "OPERATION" && modeReglement !== "ESPECES";
  const freeCounterpartyValid =
    selectedCounterparty.type !== "AUTRE" ||
    Boolean(freeCounterpartyName.trim() && freeCounterpartyReason.trim());
  const valid = Boolean(
    date &&
      Number(montant) > 0 &&
      (mode === "OPERATION" || motif.trim()) &&
      (mode !== "OPERATION" ||
        (counterpartyValue &&
          modeReglement &&
          freeCounterpartyValid &&
          (!referenceRequired || reference.trim()))),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "PROVISION"
              ? "Enregistrer une provision"
              : "Enregistrer une opération"}
          </DialogTitle>
          <DialogDescription>
            {mode === "PROVISION"
              ? "La nouvelle provision devient la valeur courante sans effacer l’historique."
              : "Identifiez la contrepartie et le moyen de paiement de chaque mouvement financier."}
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
                  <SelectItem value="REGLEMENT">Indemnisation</SelectItem>
                  <SelectItem value="FRAIS">Frais de dossier</SelectItem>
                  <SelectItem value="RECOURS">Recours encaissé</SelectItem>
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
              <Field label={companyLabel(type)}>
                <Input value={dossier.couverture.compagnie} disabled />
              </Field>
              <Field label={`${counterpartyLabel(type)} *`}>
                <Select
                  value={counterpartyValue}
                  onValueChange={setCounterpartyValue}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {counterpartyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {selectedCounterparty.type === "AUTRE" ? (
                <>
                  <Field label="Nom de la contrepartie *">
                    <Input
                      value={freeCounterpartyName}
                      maxLength={180}
                      onChange={(event) =>
                        setFreeCounterpartyName(event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Justification *">
                    <Input
                      value={freeCounterpartyReason}
                      maxLength={500}
                      onChange={(event) =>
                        setFreeCounterpartyReason(event.target.value)
                      }
                    />
                  </Field>
                </>
              ) : null}
              <Field label="Moyen de paiement *">
                <Select
                  value={modeReglement}
                  onValueChange={(value) =>
                    setModeReglement(value as ModeReglementSinistre)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIREMENT">Virement</SelectItem>
                    <SelectItem value="CHEQUE">Chèque</SelectItem>
                    <SelectItem value="ESPECES">Espèces</SelectItem>
                    <SelectItem value="COMPENSATION">Compensation</SelectItem>
                    <SelectItem value="AUTRE">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={`Référence${referenceRequired ? " *" : ""}`}>
                <Input
                  value={reference}
                  maxLength={120}
                  onChange={(event) => setReference(event.target.value)}
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
                      typeContrepartie: selectedCounterparty.type,
                      contrepartieId: selectedCounterparty.id,
                      contrepartieNomLibre:
                        selectedCounterparty.type === "AUTRE"
                          ? freeCounterpartyName.trim()
                          : undefined,
                      justificationContrepartieLibre:
                        selectedCounterparty.type === "AUTRE"
                          ? freeCounterpartyReason.trim()
                          : undefined,
                      modeReglement,
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

function buildCounterpartyOptions(dossier: SinistreDetail) {
  const options = [
    { value: "CLIENT", label: `Client · ${dossier.couverture.assure}` },
    ...dossier.parties.map((party) => ({
      value: `PARTIE:${party.id}`,
      label: `${partyTypeLabels[party.type]} · ${party.nom}`,
    })),
  ];
  const experts = new Map<string, string>();
  const garages = new Map<string, string>();
  dossier.missionsExpertise.forEach((mission) => {
    experts.set(mission.expertId, mission.expert);
    if (mission.garageId && mission.garage) {
      garages.set(mission.garageId, mission.garage);
    }
  });
  experts.forEach((name, id) =>
    options.push({ value: `EXPERT:${id}`, label: `Expert · ${name}` }),
  );
  garages.forEach((name, id) =>
    options.push({ value: `GARAGE:${id}`, label: `Garage · ${name}` }),
  );
  options.push({ value: "AUTRE", label: "Autre contrepartie" });
  return options;
}

function parseCounterpartyValue(value: string): {
  type: TypeContrepartieSinistre;
  id?: string;
} {
  const [type, id] = value.split(":", 2);
  return { type: type as TypeContrepartieSinistre, id };
}

function companyLabel(type: TypeOperation) {
  return type === "RECOURS" ? "Compagnie bénéficiaire" : "Compagnie payeuse";
}

function counterpartyLabel(type: TypeOperation) {
  if (type === "RECOURS") return "Débiteur du recours";
  if (type === "FRAIS") return "Prestataire ou bénéficiaire";
  return "Bénéficiaire";
}

const partyTypeLabels: Record<SinistreDetail["parties"][number]["type"], string> = {
  CONDUCTEUR: "Conducteur",
  PASSAGER: "Passager",
  ADVERSAIRE: "Adversaire",
  VICTIME: "Victime",
  BENEFICIAIRE: "Bénéficiaire",
};

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
