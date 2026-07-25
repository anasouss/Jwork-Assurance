import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  useEffect(() => {
    if (!open) return;
    setPayload({
      garantieId: String(ligne?.garantieId ?? ""),
      usageId: String(ligne?.usageId ?? ""),
      categorieTransportId: String(ligne?.categorieTransportId ?? ""),
      modeTarification: String(ligne?.modeTarification ?? ""),
      libelleOption: ligne?.libelle ?? "",
      prime: toNumber(ligne?.prime),
      capital: toNumber(ligne?.capital),
      taux: toNumber(ligne?.taux),
      tauxFranchise: toNumber(ligne?.tauxFranchise),
      franchiseMinimale: toNumber(ligne?.franchiseMinimale),
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
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Garantie">
            <Select value={payload.garantieId} onValueChange={(value) => update({ garantieId: value })}>
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
            <Select value={payload.modeTarification ?? ""} onValueChange={(value) => update({ modeTarification: value })}>
              <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TAUX">Taux</SelectItem>
                <SelectItem value="CAPITAL">Capital</SelectItem>
                <SelectItem value="PRIME_FIXE">Prime fixe</SelectItem>
                <SelectItem value="PROTECTION">Protection</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Libellé option">
            <Input value={payload.libelleOption ?? ""} onChange={(event) => update({ libelleOption: event.target.value })} />
          </Field>
          <Field label="Prime">
            <Input type="number" value={payload.prime ?? ""} onChange={(event) => update({ prime: numberValue(event.target.value) })} />
          </Field>
          <Field label="Capital">
            <Input type="number" value={payload.capital ?? ""} onChange={(event) => update({ capital: numberValue(event.target.value) })} />
          </Field>
          <Field label="Taux">
            <Input type="number" value={payload.taux ?? ""} onChange={(event) => update({ taux: numberValue(event.target.value) })} />
          </Field>
          <Field label="Franchise min.">
            <Input type="number" value={payload.franchiseMinimale ?? ""} onChange={(event) => update({ franchiseMinimale: numberValue(event.target.value) })} />
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

function cleanPayload(payload: UpsertLigneGrilleTarifaireRequest): UpsertLigneGrilleTarifaireRequest {
  return {
    ...payload,
    usageId: payload.usageId || undefined,
    categorieTransportId: payload.categorieTransportId || undefined,
    modeTarification: payload.modeTarification || undefined,
    libelleOption: payload.libelleOption || undefined,
  };
}
