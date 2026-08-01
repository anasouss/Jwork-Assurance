import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ProspectionDeleteDialogProps = {
  open: boolean;
  devisLabel?: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ProspectionDeleteDialog({
  open,
  devisLabel,
  pending,
  onOpenChange,
  onConfirm,
}: ProspectionDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le devis ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le devis {devisLabel ?? "sélectionné"} et toutes les informations de son brouillon seront définitivement supprimés.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? "Suppression..." : "Supprimer définitivement"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
