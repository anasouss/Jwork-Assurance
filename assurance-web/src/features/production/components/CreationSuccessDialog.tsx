import { CheckCircle2, ClipboardCopy, FileText, List } from "lucide-react";
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

export type CreationSuccessReference = {
  label: string;
  value?: string | null;
};

type Props = {
  open: boolean;
  title: string;
  description: string;
  references: CreationSuccessReference[];
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary: () => void;
};

export function CreationSuccessDialog({
  open,
  title,
  description,
  references,
  primaryLabel = "Continuer vers les pièces jointes",
  secondaryLabel = "Retour à la liste",
  onPrimary,
  onSecondary,
}: Props) {
  const visibleReferences = references.filter((reference) => Boolean(reference.value?.trim()));

  async function copyReference(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copié`);
    } catch {
      toast.error("Copie impossible");
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-xl"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b bg-emerald-50 px-5 py-4 text-left dark:bg-emerald-950/30">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="grid gap-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-2 px-5 py-4">
          {visibleReferences.map((reference) => (
            <div
              key={reference.label}
              className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-muted-foreground">{reference.label}</div>
                <div className="mt-1 break-all font-semibold tabular-nums">{reference.value}</div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                title={`Copier ${reference.label.toLowerCase()}`}
                aria-label={`Copier ${reference.label.toLowerCase()}`}
                onClick={() => void copyReference(reference.label, reference.value!)}
              >
                <ClipboardCopy className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-5 py-4">
          <Button type="button" variant="outline" onClick={onSecondary}>
            <List className="size-4" />
            {secondaryLabel}
          </Button>
          <Button type="button" onClick={onPrimary}>
            <FileText className="size-4" />
            {primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
