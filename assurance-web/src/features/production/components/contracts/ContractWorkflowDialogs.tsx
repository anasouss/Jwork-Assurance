import { Building2, ShieldCheck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AvenantDraftSummary } from "../../types";

type RenewalTerm = "CABINET" | "COMPAGNIE";

type ContractWorkflowDialogsProps = {
  deleteDialog: {
    open: boolean;
    title: string;
    description: string;
    pending: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
  };
  renewalDialog: {
    open: boolean;
    term: RenewalTerm;
    pending: boolean;
    onOpenChange: (open: boolean) => void;
    onTermChange: (term: RenewalTerm) => void;
    onConfirm: () => void;
  };
  draftDialog: {
    draft?: AvenantDraftSummary;
    pending: boolean;
    onOpenChange: (open: boolean) => void;
    onRestart: () => void;
    onContinue: () => void;
  };
};

export function ContractWorkflowDialogs({
  deleteDialog,
  renewalDialog,
  draftDialog,
}: ContractWorkflowDialogsProps) {
  return (
    <>
      <AlertDialog open={deleteDialog.open} onOpenChange={deleteDialog.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDialog.pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDialog.pending}
              onClick={(event) => {
                event.preventDefault();
                deleteDialog.onConfirm();
              }}
            >
              {deleteDialog.pending ? "Traitement..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={renewalDialog.open}
        onOpenChange={(open) => {
          if (!renewalDialog.pending) renewalDialog.onOpenChange(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Type de terme</DialogTitle>
            <DialogDescription>Choisissez le mode de renouvellement à appliquer pour ce contrat.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <RenewalChoice
              active={renewalDialog.term === "CABINET"}
              title="Terme cabinet"
              description="Renouvellement interne avec contrôle du stock sur le numéro d’attestation."
              badge="AVEC STOCK"
              icon={<ShieldCheck className="size-5 text-emerald-700" />}
              onClick={() => renewalDialog.onTermChange("CABINET")}
            />
            <RenewalChoice
              active={renewalDialog.term === "COMPAGNIE"}
              title="Terme compagnie"
              description="Renouvellement sans contrôle du stock d’attestation selon les règles compagnie."
              badge="SANS STOCK"
              badgeClassName="bg-amber-100 text-amber-800 hover:bg-amber-100"
              icon={<Building2 className="size-5 text-emerald-700" />}
              onClick={() => renewalDialog.onTermChange("COMPAGNIE")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={renewalDialog.pending} onClick={() => renewalDialog.onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="button" disabled={renewalDialog.pending} onClick={renewalDialog.onConfirm}>
              {renewalDialog.pending ? "Préparation..." : "Continuer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(draftDialog.draft)} onOpenChange={draftDialog.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Un brouillon existe déjà</AlertDialogTitle>
            <AlertDialogDescription>
              Un brouillon « {draftDialog.draft?.libelleTypeMouvement || draftDialog.draft?.codeTypeMouvement} » est déjà enregistré pour ce contrat. Vous pouvez continuer la saisie existante ou la supprimer et recommencer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={draftDialog.pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={draftDialog.pending || !draftDialog.draft}
              onClick={(event) => {
                event.preventDefault();
                draftDialog.onRestart();
              }}
            >
              {draftDialog.pending ? "Suppression..." : "Supprimer et recommencer"}
            </AlertDialogAction>
            <AlertDialogAction
              disabled={draftDialog.pending || !draftDialog.draft}
              onClick={(event) => {
                event.preventDefault();
                draftDialog.onContinue();
              }}
            >
              Continuer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RenewalChoice({
  active,
  title,
  description,
  badge,
  badgeClassName,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  badge: string;
  badgeClassName?: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid grid-cols-[1fr_auto] gap-3 rounded-md border p-4 text-left transition-colors",
        active ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40",
      )}
      onClick={onClick}
    >
      <span className="grid gap-1">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
        <Badge className={cn("mt-1 w-fit bg-emerald-100 text-[10px] text-emerald-800 hover:bg-emerald-100", badgeClassName)}>
          {badge}
        </Badge>
      </span>
      {icon}
    </button>
  );
}
