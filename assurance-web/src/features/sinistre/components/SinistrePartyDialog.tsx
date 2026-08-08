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
import type { TypePartie } from "../types";

const LABELS: Record<TypePartie, string> = {
  CONDUCTEUR: "Conducteur",
  PASSAGER: "Passager",
  ADVERSAIRE: "Adversaire",
  VICTIME: "Victime",
  BENEFICIAIRE: "Bénéficiaire",
};

export function SinistrePartyDialog({
  open,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: object) => void;
}) {
  const [form, setForm] = useState({
    type: "ADVERSAIRE" as TypePartie,
    nom: "",
    telephone: "",
    cin: "",
    numeroPermis: "",
    immatriculation: "",
    compagnieAdverse: "",
    numeroPoliceAdverse: "",
    notes: "",
  });
  useEffect(() => {
    if (open)
      setForm({
        type: "ADVERSAIRE",
        nom: "",
        telephone: "",
        cin: "",
        numeroPermis: "",
        immatriculation: "",
        compagnieAdverse: "",
        numeroPoliceAdverse: "",
        notes: "",
      });
  }, [open]);
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter une partie impliquée</DialogTitle>
          <DialogDescription>
            Conducteur, adversaire, passager, victime ou bénéficiaire lié au sinistre.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type *">
            <Select
              value={form.type}
              onValueChange={(value) => update("type", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nom *">
            <Input
              value={form.nom}
              maxLength={180}
              onChange={(event) => update("nom", event.target.value)}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={form.telephone}
              onChange={(event) => update("telephone", event.target.value)}
            />
          </Field>
          <Field label="CIN">
            <Input
              value={form.cin}
              onChange={(event) => update("cin", event.target.value)}
            />
          </Field>
          <Field label="N° permis">
            <Input
              value={form.numeroPermis}
              onChange={(event) => update("numeroPermis", event.target.value)}
            />
          </Field>
          <Field label="Immatriculation">
            <Input
              value={form.immatriculation}
              onChange={(event) =>
                update("immatriculation", event.target.value)
              }
            />
          </Field>
          <Field label="Compagnie adverse">
            <Input
              value={form.compagnieAdverse}
              onChange={(event) =>
                update("compagnieAdverse", event.target.value)
              }
            />
          </Field>
          <Field label="Police adverse">
            <Input
              value={form.numeroPoliceAdverse}
              onChange={(event) =>
                update("numeroPoliceAdverse", event.target.value)
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea
                value={form.notes}
                maxLength={1000}
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
            disabled={!form.nom.trim() || saving}
            onClick={() => onSubmit(clean(form))}
          >
            Ajouter
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
function clean(form: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      value.trim() || undefined,
    ]),
  );
}
