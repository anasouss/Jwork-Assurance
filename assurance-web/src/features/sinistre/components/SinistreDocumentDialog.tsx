import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, FileText } from "lucide-react";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
  const [step, setStep] = useState<"TYPE" | "DETAILS">("TYPE");
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
    setType(initialType ?? null);
    setStep(initialType ? "DETAILS" : "TYPE");
    setCommentaire("");
    setFile(null);
    setDateDocument("");
    setReference("");
    setMontant("");
    setEmetteur("");
    setGarantieId("");
    setMissionId("");
  }, [initialType, open]);

  const selectedMission = dossier.missionsExpertise.find(
    (mission) => mission.id === missionId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === "TYPE" ? "Choisir le document" : LABELS[type!]}
          </DialogTitle>
          <DialogDescription>
            {step === "TYPE"
              ? "Sélectionnez la pièce à ajouter au dossier."
              : "Renseignez uniquement les informations propres à cette pièce."}
          </DialogDescription>
        </DialogHeader>

        {step === "TYPE" ? (
          <div className="grid gap-4">
            {DOCUMENT_GROUPS.map((group) => (
              <div key={group.label} className="grid gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.types.map((documentType) => (
                    <button
                      key={documentType}
                      type="button"
                      className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors hover:border-sky-300 hover:bg-sky-50"
                      onClick={() => {
                        setType(documentType);
                        setStep("DETAILS");
                      }}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded bg-sky-50 text-sky-700">
                        <FileText className="size-4" />
                      </span>
                      <span className="text-sm font-medium">
                        {LABELS[documentType]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {financialDocument || reportDocument ? (
              <Field label="Date du document *">
                <DatePicker
                  date={dateDocument}
                  maxDate={new Date()}
                  onSelect={(date) => setDateDocument(toIso(date))}
                />
              </Field>
            ) : null}

            {financialDocument ? (
              <>
                <Field label="Référence *">
                  <Input
                    value={reference}
                    maxLength={120}
                    onChange={(event) => setReference(event.target.value)}
                  />
                </Field>
                <Field label="Montant *">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={montant}
                    onChange={(event) => setMontant(event.target.value)}
                  />
                </Field>
                <Field label="Émetteur *">
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
              </>
            ) : null}

            {reportDocument ? (
              <div className="sm:col-span-2">
                <Field label="Mission d’expertise *">
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
          </div>
        )}

        <DialogFooter className={cn(step === "TYPE" && "sm:justify-end")}>
          {step === "DETAILS" && !initialType ? (
            <Button variant="ghost" onClick={() => setStep("TYPE")}>
              <ArrowLeft className="size-4" />
              Changer de document
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          {step === "DETAILS" ? (
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
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
