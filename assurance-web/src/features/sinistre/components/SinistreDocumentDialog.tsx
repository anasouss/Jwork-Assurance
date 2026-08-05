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
import type { TypeDocument } from "../types";

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
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (type: TypeDocument, commentaire: string, file: File) => void;
}) {
  const [type, setType] = useState<TypeDocument>("DECLARATION");
  const [commentaire, setCommentaire] = useState("");
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (open) {
      setType("DECLARATION");
      setCommentaire("");
      setFile(null);
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Déposer un document</DialogTitle>
          <DialogDescription>
            PDF, image ou document bureautique, 20 Mo maximum.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
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
          <FileDropzone
            file={file}
            onFileChange={setFile}
            disabled={saving}
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          />
          <div className="grid gap-1.5">
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
            disabled={!file || saving}
            onClick={() => {
              if (file) onSubmit(type, commentaire, file);
            }}
          >
            Déposer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
