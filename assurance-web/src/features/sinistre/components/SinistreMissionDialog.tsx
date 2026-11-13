import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import type { PhaseExpertise, SinistreDetail } from "../types";
import { sinistreApi, sinistreKeys } from "../api";

type Mission = SinistreDetail["missionsExpertise"][number];
export function SinistreMissionDialog({
  open,
  mission,
  dossier,
  saving,
  initialPhase = "AVANT",
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mission: Mission | null;
  dossier: SinistreDetail;
  saving: boolean;
  initialPhase?: PhaseExpertise;
  onOpenChange: (open: boolean) => void;
  onSubmit: (missionId: string | null, request: object) => void;
}) {
  const [form, setForm] = useState({
    expertId: "",
    phase: "AVANT",
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
            phase: mission.phase,
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
            phase: initialPhase,
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
  }, [open, mission, initialPhase]);
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const context = { sinistreId: dossier.id, dateIntervention: form.dateMission || undefined,
    garantieIds: dossier.garanties.filter(g => g.impliquee).map(g => g.garantieId) };
  const expertQuery = useQuery({ queryKey: sinistreKeys.eligible("EXPERT", context), queryFn: () => sinistreApi.eligibleProviders("EXPERT", context), enabled: open && !!form.dateMission });
  const garageContext = { ...context, modeReparation: dossier.modeReparation ?? undefined };
  const garageQuery = useQuery({ queryKey: sinistreKeys.eligible("GARAGE", garageContext), queryFn: () => sinistreApi.eligibleProviders("GARAGE", garageContext), enabled: open && !!form.dateMission });
  const experts = expertQuery.data ?? [];
  const garages = garageQuery.data ?? [];
  const historicalExpert = mission?.expertId === form.expertId && mission.dateMission === form.dateMission;
  const historicalGarage = mission?.garageId === form.garageId && mission.dateMission === form.dateMission;
  const validExpert = historicalExpert || experts.some(item => item.id === form.expertId);
  const validGarage = !form.garageId || historicalGarage || garages.some(item => item.id === form.garageId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mission ? "Modifier la mission" : "Mandater un expert"}
          </DialogTitle>
          <DialogDescription className="sr-only">Mission d’expertise du dossier</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phase" required>
            <Select value={form.phase} onValueChange={(value) => update("phase", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="AVANT">Avant réparation</SelectItem><SelectItem value="APRES">Après réparation</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Expert" required>
            <Select
              disabled={saving || expertQuery.isFetching || expertQuery.isError}
              value={form.expertId}
              onValueChange={(value) => update("expertId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {form.expertId && !experts.some(item => item.id === form.expertId) ? <SelectItem value={form.expertId} disabled={!historicalExpert}>{historicalExpert ? mission?.expert : "Expert incompatible · à remplacer"}</SelectItem> : null}
                {experts
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
              disabled={saving || garageQuery.isFetching || garageQuery.isError}
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
                {form.garageId && !garages.some(item => item.id === form.garageId) ? <SelectItem value={form.garageId} disabled={!historicalGarage}>{historicalGarage ? mission?.garage : "Garage incompatible · à remplacer"}</SelectItem> : null}
                {garages
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
          <Field label="Statut" required>
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
                <SelectItem value="EN_COURS">En cours</SelectItem>
                <SelectItem value="RAPPORT_RECU">Rapport reçu</SelectItem>
                <SelectItem value="VALIDEE">Validée</SelectItem>
                <SelectItem value="ANNULEE">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date mission" required>
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
        {expertQuery.isError || garageQuery.isError ? <p role="alert" className="text-sm text-destructive">{(expertQuery.error ?? garageQuery.error)?.message}</p> : null}
        {!validExpert || !validGarage ? <p className="text-sm text-muted-foreground">Sélectionnez des prestataires compatibles avec la compagnie et les garanties.</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!form.expertId || !form.dateMission || saving || !validExpert || !validGarage || expertQuery.isFetching || garageQuery.isFetching || expertQuery.isError || garageQuery.isError}
            onClick={() =>
              onSubmit(mission?.id ?? null, {
                expertId: form.expertId,
                phase: form.phase,
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
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required ? <span className="text-red-500">*</span> : null}</Label>
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
