import { useEffect, useState, type ReactNode } from "react";
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
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SinistreDetail, TypeDocument } from "../types";

const LABELS: Record<TypeDocument, string> = {
  DECLARATION: "Déclaration de sinistre",
  CONSTAT: "Constat amiable",
  PV_POLICE: "PV de police",
  CARTE_GRISE: "Carte grise",
  PERMIS: "Permis",
  PHOTO: "Photos",
  DEVIS: "Devis",
  RAPPORT_EXPERT: "Rapport d’expert",
  ACCORD: "Accord compagnie",
  FACTURE: "Facture",
  REGLEMENT: "Justificatif de règlement",
  RECOURS: "Document de recours",
  AUTRE: "Autre document",
};

const DOCUMENT_GROUPS: Array<{ label: string; types: TypeDocument[] }> = [
  {
    label: "Déclaration et identité",
    types: ["DECLARATION", "CONSTAT", "PV_POLICE", "CARTE_GRISE", "PERMIS", "PHOTO"],
  },
  {
    label: "Expertise",
    types: ["DEVIS", "RAPPORT_EXPERT", "ACCORD"],
  },
  {
    label: "Règlement et recours",
    types: ["FACTURE", "REGLEMENT", "RECOURS", "AUTRE"],
  },
];

export const documentTypeLabels = LABELS;

export function SinistreDocumentDialog({
  open,
  saving,
  dossier,
  initialType,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  dossier: SinistreDetail;
  initialType?: TypeDocument | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    type: TypeDocument,
    commentaire: string,
    file: File,
    metadata: Record<string, string>,
  ) => void;
}) {
  const [type, setType] = useState<TypeDocument | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dateDocument, setDateDocument] = useState("");
  const [reference, setReference] = useState("");
  const [montant, setMontant] = useState("");
  const [emetteur, setEmetteur] = useState("");
  const [garantieId, setGarantieId] = useState("");
  const [missionId, setMissionId] = useState("");

  const financialDocument =
    type != null && ["FACTURE", "DEVIS", "REGLEMENT", "RECOURS"].includes(type);
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
    if (!open) return;
    setType(initialType && !dossier.documents.some((item) => item.type === initialType && item.sourcePieceJointeId && item.statut !== "REJETE") ? initialType : null);
    setCommentaire("");
    setFile(null);
    setDateDocument("");
    setReference("");
    setMontant("");
    setEmetteur("");
    setGarantieId("");
    setMissionId("");
  }, [initialType, open, dossier.documents]);

  const linkedTypes = new Set(dossier.documents.filter((item) => item.sourcePieceJointeId && item.statut !== "REJETE").map((item) => item.type));
  const documentGroups = DOCUMENT_GROUPS.map((group) => ({ ...group, types: group.types.filter((item) => !linkedTypes.has(item)) }))
    .filter((group) => group.types.length > 0);

  const selectedMission = dossier.missionsExpertise.find(
    (mission) => mission.id === missionId,
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>Déposer un document</DialogTitle>
          <DialogDescription>{dossier.numeroSinistre} · Police {dossier.couverture.numeroPolice || "-"}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="claim-document-type">Type de document <span className="text-red-500">*</span></Label>
          <Select disabled={saving} value={type ?? ""} onValueChange={(next) => {
            setType(next as TypeDocument);
            setFile(null);
            setDateDocument(""); setReference(""); setMontant(""); setEmetteur(""); setGarantieId(""); setMissionId("");
          }}>
            <SelectTrigger id="claim-document-type"><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
            <SelectContent>{documentGroups.map((group) => <SelectGroup key={group.label}><SelectLabel>{group.label}</SelectLabel>
              {group.types.map((item) => <SelectItem key={item} value={item}>{LABELS[item]}</SelectItem>)}
            </SelectGroup>)}</SelectContent>
          </Select>
        </div>
        {type ? <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
            {financialDocument || reportDocument ? (
              <Field label="Date du document" required>
                <DatePicker
                  date={dateDocument}
                  maxDate={new Date()}
                  onSelect={(date) => setDateDocument(toIso(date))}
                />
              </Field>
            ) : null}

            {financialDocument ? (
              <>
                <Field label="Référence" required>
                  <Input
                    value={reference}
                    maxLength={120}
                    onChange={(event) => setReference(event.target.value)}
                  />
                </Field>
                <Field label="Montant" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={montant}
                    onChange={(event) => setMontant(event.target.value)}
                  />
                </Field>
                <Field label="Émetteur" required>
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
                    items={dossier.garanties.filter((item) => item.impliquee).map((item) => ({
                      value: item.id,
                      label: `${item.code} - ${item.libelle}`,
                    }))}
                  />
                </Field>
              </>
            ) : null}

            {reportDocument ? (
              <div className="sm:col-span-2">
                <Field label="Mission d’expertise" required>
                  <OptionalSelect
                    value={missionId}
                    onChange={setMissionId}
                    noneLabel="Sélectionner une mission"
                    items={dossier.missionsExpertise.map((item) => ({
                      value: item.id,
                      label: [item.referenceMission, item.expert, item.garage]
                        .filter(Boolean)
                        .join(" · "),
                    }))}
                  />
                </Field>
                {selectedMission ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Expert : {selectedMission.expert} · Garage : {selectedMission.garage || "non désigné"}
                  </p>
                ) : null}
              </div>
            ) : null}

            <FileDropzone
              className="sm:col-span-2"
              file={file}
              onFileChange={setFile}
              disabled={saving}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              title={`Déposer : ${LABELS[type!]}`}
              description="PDF, image ou document bureautique · 30 Mo maximum"
            />
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Commentaire</Label>
              <Input
                value={commentaire}
                maxLength={500}
                onChange={(event) => setCommentaire(event.target.value)}
              />
            </div>
          </fieldset> : null}

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          {type ? (
            <Button
              disabled={!type || !file || !metadataValid || saving}
              onClick={() => {
                if (!type || !file) return;
                onSubmit(type, commentaire, file, {
                  dateDocument,
                  reference,
                  montant,
                  emetteur,
                  sinistreGarantieId: garantieId,
                  missionExpertiseId: missionId,
                  garageId: selectedMission?.garageId || "",
                });
              }}
            >
              Déposer
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required ? <span className="text-red-500">*</span> : null}</Label>
      {children}
    </div>
  );
}

function OptionalSelect({
  value,
  onChange,
  items,
  noneLabel = "Aucun",
}: {
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
  noneLabel?: string;
}) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(next) => onChange(next === "none" ? "" : next)}
    >
      <SelectTrigger>
        <SelectValue placeholder={noneLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{noneLabel}</SelectItem>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function toIso(date?: Date) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
