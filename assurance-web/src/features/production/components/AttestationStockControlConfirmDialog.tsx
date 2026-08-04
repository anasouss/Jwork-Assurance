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

type AttestationStockControlConfirmDialogProps = {
  nextValue: boolean | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function AttestationStockControlConfirmDialog({
  nextValue,
  pending,
  onClose,
  onConfirm,
}: AttestationStockControlConfirmDialogProps) {
  const enabling = nextValue === true;

  return (
    <AlertDialog
      open={nextValue !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {enabling ? "Activer le contrôle du stock ?" : "Désactiver le contrôle du stock ?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {enabling
              ? "À la création d’un contrat, le numéro d’attestation sera contrôlé puis consommé dans le stock."
              : "Les numéros d’attestation ne seront plus contrôlés ni consommés automatiquement à la création d’un contrat."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className={enabling ? undefined : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? "Mise à jour..." : enabling ? "Activer" : "Désactiver"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
