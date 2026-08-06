import { FileDown, Signature } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RelevePdfOptionsDialogProps = {
  open: boolean;
  loading: boolean;
  signatureAvailable: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPdf: (withSignature: boolean) => void;
};

export function RelevePdfOptionsDialog({
  open,
  loading,
  signatureAvailable,
  onOpenChange,
  onOpenPdf,
}: RelevePdfOptionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ouvrir le relevé</DialogTitle>
          <DialogDescription>
            Choisissez si la signature de l’agence doit apparaître sur le PDF.
          </DialogDescription>
        </DialogHeader>
        {!signatureAvailable ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Aucune signature n’est configurée pour cette agence.
          </p>
        ) : null}
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" disabled={loading} onClick={() => onOpenPdf(false)}>
            <FileDown className="size-4" />
            Sans signature
          </Button>
          <Button disabled={loading || !signatureAvailable} onClick={() => onOpenPdf(true)}>
            <Signature className="size-4" />
            Avec signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
