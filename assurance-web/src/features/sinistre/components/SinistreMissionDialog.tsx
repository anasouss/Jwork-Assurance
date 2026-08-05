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
import type { Intervenant, SinistreDetail } from "../types";

type Mission = SinistreDetail["missionsExpertise"][number];
export function SinistreMissionDialog({
  open,
  mission,
  experts,
  garages,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mission: Mission | null;
  experts: Intervenant[];
  garages: Intervenant[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (missionId: string | null, request: object) => void;
}) {
  const [form, setForm] = useState({
    expertId: "",
    garageId: "",
    referenceMission: "",
    dateMission: todayIso(),
    dateRapport: "",
    montantEstime: "",
    montantAccepte: "",
    statut: "MANDATEE",
    notes: "",
  });
  useEffect(() => {
    if (!open) return;
    setForm(
      mission
        ? {
            expertId: mission.expertId,
            garageId: mission.garageId || "",
            referenceMission: mission.referenceMission || "",
            dateMission: mission.dateMission,
            dateRapport: mission.dateRapport || "",
            montantEstime:
              mission.montantEstime == null
                ? ""
                : String(mission.montantEstime),
            montantAccepte:
              mission.montantAccepte == null
                ? ""
                : String(mission.montantAccepte),
            statut: mission.statut,
            notes: mission.notes || "",
          }
        : {
            expertId: "",
            garageId: "",
            referenceMission: "",
            dateMission: todayIso(),
            dateRapport: "",
            montantEstime: "",
            montantAccepte: "",
            statut: "MANDATEE",
            notes: "",
          },
    );
  }, [open, mission]);
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mission ? "Modifier la mission" : "Mandater un expert"}
          </DialogTitle>
          <DialogDescription>
            Le garage est facultatif et peut être renseigné après l’expertise.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expert *">
            <Select
              value={form.expertId}
              onValueChange={(value) => update("expertId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {experts
                  .filter((item) => item.actif || item.id === form.expertId)
                  .map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code} · {item.nom}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Garage">
            <Select
              value={form.garageId || "NONE"}
              onValueChange={(value) =>
                update("garageId", value === "NONE" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Non désigné</SelectItem>
                {garages
                  .filter((item) => item.actif || item.id === form.garageId)
                  .map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code} · {item.nom}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Référence mission">
            <Input
              value={form.referenceMission}
              onChange={(event) =>
                update("referenceMission", event.target.value)
              }
            />
          </Field>
          <Field label="Statut *">
            <Select
              value={form.statut}
              onValueChange={(value) => update("statut", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A_MANDATER">À mandater</SelectItem>
                <SelectItem value="MANDATEE">Mandatée</SelectItem>
                <SelectItem value="RAPPORT_RECU">Rapport reçu</SelectItem>
                <SelectItem value="VALIDEE">Validée</SelectItem>
                <SelectItem value="ANNULEE">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date mission *">
            <DatePicker
              date={form.dateMission}
              onSelect={(date) => update("dateMission", toIso(date))}
            />
          </Field>
          <Field label="Date rapport">
            <DatePicker
              date={form.dateRapport}
              onSelect={(date) => update("dateRapport", toIso(date))}
            />
          </Field>
          <Field label="Montant estimé">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.montantEstime}
              onChange={(event) => update("montantEstime", event.target.value)}
            />
          </Field>
          <Field label="Montant accepté">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.montantAccepte}
              onChange={(event) => update("montantAccepte", event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!form.expertId || !form.dateMission || saving}
            onClick={() =>
              onSubmit(mission?.id ?? null, {
                expertId: form.expertId,
                garageId: form.garageId || undefined,
                referenceMission: form.referenceMission.trim() || undefined,
                dateMission: form.dateMission,
                dateRapport: form.dateRapport || undefined,
                montantEstime: form.montantEstime
                  ? Number(form.montantEstime)
                  : undefined,
                montantAccepte: form.montantAccepte
                  ? Number(form.montantAccepte)
                  : undefined,
                statut: form.statut,
                notes: form.notes.trim() || undefined,
              })
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
