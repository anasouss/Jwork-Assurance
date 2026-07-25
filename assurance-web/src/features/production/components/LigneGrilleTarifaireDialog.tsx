import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import { numberValue, toNumber } from "../utils/format";
import type { ReferenceOption, UpsertLigneGrilleTarifaireRequest } from "../types";

export function LigneGrilleTarifaireDialog({
  open,
  onOpenChange,
  ligne,
  garanties,
  usages,
  categoriesTransport,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ligne?: ReferenceOption | null;
  garanties: ReferenceOption[];
  usages: ReferenceOption[];
  categoriesTransport: ReferenceOption[];
  onSubmit: (payload: UpsertLigneGrilleTarifaireRequest) => void;
  submitting?: boolean;
}) {
  const [payload, setPayload] = useState<UpsertLigneGrilleTarifaireRequest>({ garantieId: "" });
  const vehiculeGaranties = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "VEHICULE") !== "PERSONNE"),
    [garanties]
  );
  const selectedGarantie = vehiculeGaranties.find((garantie) => garantie.id === payload.garantieId);
  const allowedModes = modeOptions(selectedGarantie);
  const mode = payload.modeTarification || selectedGarantie?.modeParDefaut?.toString() || allowedModes[0]?.value || "TAUX";

  useEffect(() => {
    if (!open) return;
    setPayload({
      garantieId: String(ligne?.garantieId ?? ""),
      usageId: String(ligne?.usageId ?? ""),
      categorieTransportId: String(ligne?.categorieTransportId ?? ""),
      modeTarification: String(ligne?.modeTarification ?? ""),
      puissanceFiscaleMin: toNumber(ligne?.puissanceFiscaleMin),
      puissanceFiscaleMax: toNumber(ligne?.puissanceFiscaleMax),
      nombrePlacesMin: toNumber(ligne?.nombrePlacesMin),
      nombrePlacesMax: toNumber(ligne?.nombrePlacesMax),
      ptcMin: toNumber(ligne?.ptcMin),
      ptcMax: toNumber(ligne?.ptcMax),
      sousClasse: ligne?.sousClasse ? String(ligne.sousClasse) : "",
      carburant: ligne?.carburant ? String(ligne.carburant) : "",
      libelleOption: ligne?.libelle ?? "",
      prime: toNumber(ligne?.prime),
      capital: toNumber(ligne?.capital),
      taux: toNumber(ligne?.taux),
      tauxFranchise: toNumber(ligne?.tauxFranchise),
      franchiseMinimale: toNumber(ligne?.franchiseMinimale),
      tauxRemorque: toNumber(ligne?.tauxRemorque),
      tauxFranchiseRemorque: toNumber(ligne?.tauxFranchiseRemorque),
      franchiseMinimaleRemorque: toNumber(ligne?.franchiseMinimaleRemorque),
      ordreAffichage: toNumber(ligne?.ordreAffichage),
      actif: true,
    });
  }, [ligne, open]);

  const update = (patch: Partial<UpsertLigneGrilleTarifaireRequest>) => {
    setPayload((current) => ({ ...current, ...patch }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ligne ? "Modifier ligne de grille" : "Ajouter ligne de grille"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
          <Field label="Garantie">
            <Select
              value={payload.garantieId}
              onValueChange={(value) => {
                const garantie = vehiculeGaranties.find((item) => item.id === value);
                update({
                  garantieId: value,
                  modeTarification: garantie?.modeParDefaut?.toString() || modeOptions(garantie)[0]?.value || "TAUX",
                });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Garantie" /></SelectTrigger>
              <SelectContent>
                {vehiculeGaranties.map((garantie) => (
                  <SelectItem key={garantie.id} value={garantie.id}>{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Usage">
            <Select value={payload.usageId ?? ""} onValueChange={(value) => update({ usageId: value })}>
              <SelectTrigger><SelectValue placeholder="Tous usages" /></SelectTrigger>
              <SelectContent>
                {usages.map((usage) => (
                  <SelectItem key={usage.id} value={usage.id}>{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Catégorie transport">
            <Select value={payload.categorieTransportId ?? ""} onValueChange={(value) => update({ categorieTransportId: value })}>
              <SelectTrigger><SelectValue placeholder="Optionnelle" /></SelectTrigger>
              <SelectContent>
                {categoriesTransport.map((categorie) => (
                  <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Mode">
            <Select value={mode} onValueChange={(value) => update({ modeTarification: value })}>
              <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
              <SelectContent>
                {allowedModes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Libellé option">
            <Input value={payload.libelleOption ?? ""} onChange={(event) => update({ libelleOption: event.target.value })} />
          </Field>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              Critères d'application
              <Badge variant="outline">optionnels</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <NumberField label="PF min" value={payload.puissanceFiscaleMin} onChange={(value) => update({ puissanceFiscaleMin: value })} />
              <NumberField label="PF max" value={payload.puissanceFiscaleMax} onChange={(value) => update({ puissanceFiscaleMax: value })} />
              <NumberField label="Places min" value={payload.nombrePlacesMin} onChange={(value) => update({ nombrePlacesMin: value })} />
              <NumberField label="Places max" value={payload.nombrePlacesMax} onChange={(value) => update({ nombrePlacesMax: value })} />
              <NumberField label="PTC min" value={payload.ptcMin} onChange={(value) => update({ ptcMin: value })} />
              <NumberField label="PTC max" value={payload.ptcMax} onChange={(value) => update({ ptcMax: value })} />
              <Field label="Sous-classe">
                <Input value={payload.sousClasse ?? ""} onChange={(event) => update({ sousClasse: event.target.value })} />
              </Field>
              <Field label="Carburant">
                <Input value={payload.carburant ?? ""} onChange={(event) => update({ carburant: event.target.value })} />
              </Field>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-3 text-sm font-semibold">
              {mode === "TAUX" ? "Tarification par taux" : mode === "CAPITAL" ? "Tarification par capital" : "Prime fixe"}
            </div>
            {mode === "TAUX" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <NumberField label="Taux véhicule (%)" value={payload.taux} onChange={(value) => update({ taux: value })} />
                <NumberField label="Taux remorque (%)" value={payload.tauxRemorque} onChange={(value) => update({ tauxRemorque: value })} />
                <NumberField label="Franchise min." value={payload.franchiseMinimale} onChange={(value) => update({ franchiseMinimale: value })} />
                <NumberField label="Taux franchise véhicule (%)" value={payload.tauxFranchise} onChange={(value) => update({ tauxFranchise: value })} />
                <NumberField label="Taux franchise remorque (%)" value={payload.tauxFranchiseRemorque} onChange={(value) => update({ tauxFranchiseRemorque: value })} />
                <NumberField label="Franchise min. remorque" value={payload.franchiseMinimaleRemorque} onChange={(value) => update({ franchiseMinimaleRemorque: value })} />
              </div>
            ) : mode === "CAPITAL" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <NumberField label="Capital assuré" value={payload.capital} onChange={(value) => update({ capital: value })} />
                <NumberField label="Prime nette" value={payload.prime} onChange={(value) => update({ prime: value })} />
                <NumberField label="Ordre" value={payload.ordreAffichage} onChange={(value) => update({ ordreAffichage: value })} />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <NumberField label="Prime nette" value={payload.prime} onChange={(value) => update({ prime: value })} />
                <NumberField label="Ordre" value={payload.ordreAffichage} onChange={(value) => update({ ordreAffichage: value })} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={submitting} onClick={() => onSubmit(cleanPayload({ ...payload, modeTarification: mode }))}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cleanPayload(payload: UpsertLigneGrilleTarifaireRequest): UpsertLigneGrilleTarifaireRequest {
  const mode = payload.modeTarification || "TAUX";
  return {
    ...payload,
    usageId: payload.usageId || undefined,
    categorieTransportId: payload.categorieTransportId || undefined,
    modeTarification: payload.modeTarification || undefined,
    sousClasse: payload.sousClasse || undefined,
    carburant: payload.carburant || undefined,
    libelleOption: payload.libelleOption || undefined,
    prime: mode === "TAUX" ? undefined : payload.prime,
    capital: mode === "TAUX" || mode === "PRIME_FIXE" ? undefined : payload.capital,
    taux: mode === "TAUX" ? payload.taux : undefined,
    tauxRemorque: mode === "TAUX" ? payload.tauxRemorque : undefined,
    tauxFranchise: mode === "TAUX" ? payload.tauxFranchise : undefined,
    tauxFranchiseRemorque: mode === "TAUX" ? payload.tauxFranchiseRemorque : undefined,
    franchiseMinimale: mode === "TAUX" ? payload.franchiseMinimale : undefined,
    franchiseMinimaleRemorque: mode === "TAUX" ? payload.franchiseMinimaleRemorque : undefined,
  };
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value?: number) => void;
}) {
  return (
    <Field label={label}>
      <Input type="number" value={value ?? ""} onChange={(event) => onChange(numberValue(event.target.value))} />
    </Field>
  );
}

function modeOptions(garantie?: ReferenceOption) {
  const labels: Record<string, string> = {
    TAUX: "Taux",
    CAPITAL: "Capital",
    PRIME_FIXE: "Prime fixe",
  };
  const raw = Array.isArray(garantie?.modesAutorises) && garantie?.modesAutorises.length
    ? garantie.modesAutorises
    : [garantie?.modeParDefaut ?? "TAUX"];
  return raw
    .map((mode) => String(mode))
    .filter((mode) => mode !== "PROTECTION")
    .map((mode) => ({ value: mode, label: labels[mode] ?? mode }));
}
