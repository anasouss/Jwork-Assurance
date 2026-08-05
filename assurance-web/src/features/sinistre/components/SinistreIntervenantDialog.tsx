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
import { Switch } from "@/components/ui/switch";
import type { ReferenceOption } from "@/features/production/types";
import type { Intervenant } from "../types";

export type IntervenantKind = "EXPERT" | "GARAGE";

export function SinistreIntervenantDialog({
  open,
  kind,
  intervenant,
  cities,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  kind: IntervenantKind;
  intervenant: Intervenant | null;
  cities: ReferenceOption[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: object) => void;
}) {
  const [form, setForm] = useState({
    code: "",
    nom: "",
    telephone: "",
    email: "",
    adresse: "",
    villeId: "",
    actif: true,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      code: intervenant?.code ?? "",
      nom: intervenant?.nom ?? "",
      telephone: intervenant?.telephone ?? "",
      email: intervenant?.email ?? "",
      adresse: intervenant?.adresse ?? "",
      villeId: intervenant?.villeId ?? "",
      actif: intervenant?.actif ?? true,
    });
  }, [intervenant, open]);

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    onSubmit({
      code: form.code.trim(),
      [kind === "GARAGE" ? "raisonSociale" : "nom"]: form.nom.trim(),
      telephone: form.telephone.trim() || undefined,
      email: form.email.trim() || undefined,
      adresse: form.adresse.trim() || undefined,
      villeId: form.villeId || undefined,
      actif: form.actif,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {intervenant ? "Modifier" : "Ajouter"}{" "}
            {kind === "EXPERT" ? "un expert" : "un garage"}
          </DialogTitle>
          <DialogDescription>
            Ce référentiel appartient à l’agence courante et alimente les
            missions d’expertise.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code *">
            <Input
              value={form.code}
              maxLength={40}
              onChange={(event) =>
                update("code", event.target.value.toUpperCase())
              }
            />
          </Field>
          <Field label={kind === "EXPERT" ? "Nom *" : "Raison sociale *"}>
            <Input
              value={form.nom}
              maxLength={180}
              onChange={(event) => update("nom", event.target.value)}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={form.telephone}
              maxLength={60}
              onChange={(event) => update("telephone", event.target.value)}
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={form.email}
              maxLength={180}
              onChange={(event) => update("email", event.target.value)}
            />
          </Field>
          <Field label="Ville">
            <Select
              value={form.villeId || "NONE"}
              onValueChange={(value) =>
                update("villeId", value === "NONE" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Non renseignée</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-end">
            <label className="flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm">
              Actif
              <Switch
                checked={form.actif}
                onCheckedChange={(value) => update("actif", value)}
              />
            </label>
          </div>
          <div className="sm:col-span-2">
            <Field label="Adresse">
              <Input
                value={form.adresse}
                maxLength={500}
                onChange={(event) => update("adresse", event.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!form.code.trim() || !form.nom.trim() || saving}
            onClick={submit}
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
