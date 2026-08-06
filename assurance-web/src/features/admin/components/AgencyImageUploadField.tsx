import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type AgencyImageUploadFieldProps = {
  label: string;
  emptyTitle: string;
  previewAlt: string;
  removeLabel: string;
  available: boolean;
  file: File | null;
  removed: boolean;
  queryKey: readonly unknown[];
  loadStoredImage: () => Promise<Blob>;
  onFile: (file: File) => void;
  onRemove: () => void;
};

export function AgencyImageUploadField({
  label,
  emptyTitle,
  previewAlt,
  removeLabel,
  available,
  file,
  removed,
  queryKey,
  loadStoredImage,
  onFile,
  onRemove,
}: AgencyImageUploadFieldProps) {
  const [dragging, setDragging] = useState(false);
  const storedImage = useQuery({
    queryKey,
    queryFn: loadStoredImage,
    enabled: available && !removed && !file,
    staleTime: 5 * 60_000,
  });
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [storedUrl, setStoredUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!storedImage.data || removed || file) {
      setStoredUrl(null);
      return;
    }
    const url = URL.createObjectURL(storedImage.data);
    setStoredUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, removed, storedImage.data]);

  function selectFile(selected?: File) {
    if (!selected) return;
    if (!["image/png", "image/jpeg"].includes(selected.type)) {
      toast.error("L’image doit être au format PNG ou JPEG");
      return;
    }
    if (selected.size > 4 * 1024 * 1024) {
      toast.error("L’image ne doit pas dépasser 4 Mo");
      return;
    }
    onFile(selected);
  }

  const previewUrl = localUrl ?? storedUrl;

  return (
    <div className="grid content-start gap-2">
      <span className="text-sm font-medium">{label}</span>
      <label
        className={`grid min-h-40 cursor-pointer place-items-center rounded-md border border-dashed p-3 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          selectFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          onChange={(event) => {
            selectFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {previewUrl ? (
          <img src={previewUrl} alt={previewAlt} className="max-h-24 max-w-full object-contain" />
        ) : (
          <div className="grid justify-items-center gap-2 text-muted-foreground">
            <ImageIcon className="size-8" />
            <span className="text-sm font-medium text-foreground">{emptyTitle}</span>
            <span className="text-xs">PNG ou JPEG, 4 Mo maximum</span>
          </div>
        )}
        <span className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-primary">
          <Upload className="size-3.5" />
          Choisir un fichier
        </span>
      </label>
      {(file || (available && !removed)) ? (
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
          <Trash2 className="size-4" />
          {removeLabel}
        </Button>
      ) : null}
    </div>
  );
}
