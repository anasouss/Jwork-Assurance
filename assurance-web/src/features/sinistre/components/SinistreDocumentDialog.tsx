import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SinistreDetail, TypeDocument } from "../types";

const LABELS: Record<TypeDocument, string> = {
  DECLARATION: "Déclaration",
  CONSTAT: "Constat",
  PV_POLICE: "PV de police",
  CARTE_GRISE: "Carte grise",
  PERMIS: "Permis",
  PHOTO: "Photo",
  DEVIS: "Devis",
  RAPPORT_EXPERT: "Rapport d’expert",
  ACCORD: "Accord",
  FACTURE: "Facture",
  REGLEMENT: "Règlement",
  RECOURS: "Recours",
  AUTRE: "Autre",
};
export const documentTypeLabels = LABELS;

export function SinistreDocumentDialog({
  open,
  saving,
  dossier,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  dossier: SinistreDetail;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    type: TypeDocument,
    commentaire: string,
    file: File,
    metadata: Record<string, string>,
  ) => void;
}) {
  const [type, setType] = useState<TypeDocument>("DECLARATION");
  const [commentaire, setCommentaire] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dateDocument, setDateDocument] = useState("");
  const [reference, setReference] = useState("");
  const [montant, setMontant] = useState("");
  const [emetteur, setEmetteur] = useState("");
  const [garantieId, setGarantieId] = useState("");
  const [missionId, setMissionId] = useState("");
  const [garageId, setGarageId] = useState("");
  const financialDocument = [
    "FACTURE",
    "DEVIS",
    "REGLEMENT",
    "RECOURS",
  ].includes(type);
  const reportDocument = type === "RAPPORT_EXPERT";
  const metadataValid =
    (!financialDocument ||
      Boolean(
        dateDocument &&
          reference.trim() &&
          Number(montant) > 0 &&
          emetteur.trim(),
      )) &&
    (!reportDocument || Boolean(dateDocument && missionId));
  useEffect(() => {
    if (open) {
      setType("DECLARATION");
      setCommentaire("");
      setFile(null);
      setDateDocument("");
      setReference("");
      setMontant("");
      setEmetteur("");
      setGarantieId("");
      setMissionId("");
      setGarageId("");
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Déposer un document</DialogTitle>
          <DialogDescription>
            PDF, image ou document bureautique, 30 Mo maximum.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Type de document</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as TypeDocument)}
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
          </div>
          <Field
            label={`Date du document${financialDocument || reportDocument ? " *" : ""}`}
          >
            <Input
              type="date"
              value={dateDocument}
              onChange={(event) => setDateDocument(event.target.value)}
            />
          </Field>
          <Field label={`Référence${financialDocument ? " *" : ""}`}>
            <Input
              value={reference}
              maxLength={120}
              onChange={(event) => setReference(event.target.value)}
            />
          </Field>
          <Field label={`Montant${financialDocument ? " *" : ""}`}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={montant}
              onChange={(event) => setMontant(event.target.value)}
            />
          </Field>
          <Field label={`Émetteur${financialDocument ? " *" : ""}`}>
            <Input
              value={emetteur}
              maxLength={180}
              onChange={(event) => setEmetteur(event.target.value)}
            />
          </Field>
          <Field label="Garantie concernée">
            <OptionalSelect
              value={garantieId}
              onChange={setGarantieId}
              items={dossier.garanties.map((item) => ({
                value: item.id,
                label: `${item.code} - ${item.libelle}`,
              }))}
            />
          </Field>
          <Field label={`Mission d’expertise${reportDocument ? " *" : ""}`}>
            <OptionalSelect
              value={missionId}
              onChange={setMissionId}
              items={dossier.missionsExpertise.map((item) => ({
                value: item.id,
                label: item.referenceMission || item.expert,
              }))}
            />
          </Field>
          <Field label="Garage">
            <OptionalSelect value={garageId} onChange={setGarageId} items={Array.from(new Map(dossier.missionsExpertise.filter((item) => item.garageId && item.garage).map((item) => [item.garageId!, { value: item.garageId!, label: item.garage! }])).values())} />
          </Field>
          <FileDropzone
            className="sm:col-span-2"
            file={file}
            onFileChange={setFile}
            disabled={saving}
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          />
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Commentaire</Label>
            <Input
              value={commentaire}
              maxLength={500}
              onChange={(event) => setCommentaire(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!file || !metadataValid || saving}
            onClick={() => {
              if (file) onSubmit(type, commentaire, file, {
                dateDocument,
                reference,
                montant,
                emetteur,
                sinistreGarantieId: garantieId,
                missionExpertiseId: missionId,
                garageId,
              });
            }}
          >
            Déposer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function OptionalSelect({ value, onChange, items }: { value: string; onChange: (value: string) => void; items: Array<{ value: string; label: string }> }) {
  return (
    <Select value={value || "none"} onValueChange={(next) => onChange(next === "none" ? "" : next)}>
      <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Aucun</SelectItem>
        {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
