import { useId, useState, type DragEvent } from "react";
import { File, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileDropzoneProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  title?: string;
  description?: string;
  className?: string;
};

export function FileDropzone({
  file,
  onFileChange,
  accept,
  disabled = false,
  title = "Déposer un fichier ici",
  description = "ou cliquer pour parcourir",
  className,
}: FileDropzoneProps) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  function selectFile(selected?: File) {
    if (!disabled && selected) onFileChange(selected);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "grid min-h-36 place-items-center rounded-md border border-dashed px-5 py-6 text-center transition-colors",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary/60 hover:bg-muted/40",
          dragging && "border-primary bg-primary/5"
        )}
      >
        <input
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onClick={(event) => { event.currentTarget.value = ""; }}
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <span className="grid justify-items-center gap-2">
          <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
            <UploadCloud className="size-5" />
          </span>
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </span>
      </label>

      {file ? (
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <File className="size-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{file.name}</span>
              <span className="block text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={disabled}
            onClick={() => onFileChange(null)}
            title="Retirer le fichier"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
