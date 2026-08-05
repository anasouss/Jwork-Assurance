import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { CompanyContact } from "../../company-contacts/types";

export function CompanyContactStatusDialog({ contact, saving, onOpenChange, onConfirm }: {
  contact: CompanyContact | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const activating = contact?.actif === false;
  return (
    <AlertDialog open={Boolean(contact)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{activating ? "Réactiver le contact ?" : "Désactiver le contact ?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {activating
              ? "Le contact redeviendra disponible dans le répertoire opérationnel."
              : "Le contact restera dans l’historique, mais ne sera plus proposé comme interlocuteur actif."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
          <AlertDialogAction className={activating ? undefined : "bg-red-600 text-white hover:bg-red-700"} disabled={saving} onClick={onConfirm}>
            {activating ? "Réactiver" : "Désactiver"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
