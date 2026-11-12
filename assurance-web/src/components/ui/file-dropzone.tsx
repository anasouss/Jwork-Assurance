import { useId, useRef, useState, type DragEvent } from "react";
import { File, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileDropzoneProps = {
  accept?: string;
  disabled?: boolean;
  title?: string;
  description?: string;
  className?: string;
} & ({ multiple?: false; file: File | null; onFileChange: (file: File | null) => void }
  | { multiple: true; onFilesSelect: (files: File[]) => void });

export function FileDropzone(props: FileDropzoneProps) {
  const {
    accept,
    disabled = false,
    title = "Déposer un fichier ici",
    description = "ou cliquer pour parcourir",
    className,
  } = props;
  const file = props.multiple ? null : props.file;
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  function selectFiles(selected: File[]) {
    if (disabled || selected.length === 0) return;
    if (props.multiple) props.onFilesSelect(selected);
    else props.onFileChange(selected[0]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    selectFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && event.dataTransfer.types.includes("Files")) {
            dragDepth.current += 1;
            setDragging(true);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "grid min-h-36 place-items-center rounded-md border border-dashed px-5 py-6 text-center transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary/60 hover:bg-muted/40",
          !disabled && dragging && "border-primary bg-primary/5"
        )}
      >
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple={props.multiple}
          aria-label={title}
          disabled={disabled}
          className="sr-only"
          onClick={(event) => { event.currentTarget.value = ""; }}
          onChange={(event) => {
            selectFiles(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
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
            onClick={() => { if (!props.multiple) props.onFileChange(null); }}
            title="Retirer le fichier"
            aria-label={`Retirer ${file.name}`}
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
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}
