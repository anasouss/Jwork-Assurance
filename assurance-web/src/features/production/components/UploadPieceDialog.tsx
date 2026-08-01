import { useState, type DragEvent } from "react";
import { FileText, FileUp, Upload, X } from "lucide-react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TypePieceJointe } from "../types";
import { Field } from "./Field";

export const OTHER_ATTACHMENT_TYPE = "__OTHER__";

type UploadPieceDialogProps = {
  types: TypePieceJointe[];
  selectedTypeId: string;
  customTypeLabel: string;
  files: File[];
  open: boolean;
  uploading: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeChange: (value: string) => void;
  onCustomTypeLabelChange: (value: string) => void;
  onFiles: (files: File[]) => void;
  onUpload: () => void;
};

export function UploadPieceDialog({
  types,
  selectedTypeId,
  customTypeLabel,
  files,
  open,
  uploading,
  onOpenChange,
  onTypeChange,
  onCustomTypeLabelChange,
  onFiles,
  onUpload,
}: UploadPieceDialogProps) {
  const [dragging, setDragging] = useState(false);
  const inputId = "pj-upload";

  function acceptFiles(nextFiles: File[]) {
    if (nextFiles.length > 1 && nextFiles.some((file) => !file.type.startsWith("image/"))) {
      toast.error("Plusieurs fichiers doivent être des images pour générer un PDF.");
      return;
    }
    if (nextFiles.some((file) => !file.type.startsWith("image/") && file.type !== "application/pdf")) {
      toast.error("Format non accepté.");
      return;
    }
    onFiles(nextFiles);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFiles(Array.from(event.dataTransfer.files ?? []));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajouter un document</DialogTitle>
          <DialogDescription>Sélectionnez le type puis ajoutez un PDF ou des images.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Type de document" required>
            <Select value={selectedTypeId} onValueChange={onTypeChange}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.libelle}{type.obligatoire ? " (obligatoire)" : ""}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_ATTACHMENT_TYPE}>Autre</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {selectedTypeId === OTHER_ATTACHMENT_TYPE ? (
            <Field label="Nom du document" required>
              <Input
                value={customTypeLabel}
                maxLength={160}
                placeholder="Ex. Attestation complémentaire"
                onChange={(event) => onCustomTypeLabelChange(event.target.value)}
              />
            </Field>
          ) : null}

          <label
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "grid min-h-44 cursor-pointer place-items-center rounded-md border border-dashed px-4 py-6 text-center transition-colors",
              dragging ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50" : "border-slate-300 bg-slate-50/60 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-950/40 dark:hover:bg-neutral-900"
            )}
          >
            <Input
              id={inputId}
              type="file"
              multiple
              accept="image/*,.pdf"
              className="sr-only"
              onClick={(event) => { event.currentTarget.value = ""; }}
              onChange={(event) => acceptFiles(Array.from(event.target.files ?? []))}
            />
            <span className="grid justify-items-center gap-2">
              <span className="grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <FileUp className="size-6" />
              </span>
              <span className="text-sm font-medium">Déposer les fichiers ou parcourir</span>
              <span className="text-xs text-muted-foreground">PDF ou images. Plusieurs images seront fusionnées en un PDF.</span>
            </span>
          </label>

          {files.length ? (
            <div className="grid gap-2">
              {files.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-emerald-700" />
                    <span className="truncate text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatAttachmentSize(file.size)}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    onClick={() => onFiles(files.filter((_, fileIndex) => fileIndex !== index))}
                    title="Retirer"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            type="button"
            disabled={!selectedTypeId || !files.length || (selectedTypeId === OTHER_ATTACHMENT_TYPE && !customTypeLabel.trim()) || uploading}
            onClick={onUpload}
          >
            <Upload className="size-4" />
            {uploading ? "Envoi..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function formatAttachmentSize(value?: number | null) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`;
  return `${(value / 1024 / 1024).toFixed(1)} Mo`;
}
