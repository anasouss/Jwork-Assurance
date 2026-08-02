import { useState } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { contractApi } from "../../api/contracts";

type RenewalMode = "CABINET" | "COMPAGNIE";

export function PreTermePdfDialog({
  draftId,
  open,
  onOpenChange,
}: {
  draftId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [avecPrime, setAvecPrime] = useState(false);
  const [generating, setGenerating] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setAvecPrime(false);
    onOpenChange(nextOpen);
  }

  async function generate() {
    if (!draftId) return;
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Autorisez les popups pour ouvrir le PDF");
      return;
    }
    setGenerating(true);
    try {
      const blob = await contractApi.downloadPreTermePdf(draftId, avecPrime);
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      handleOpenChange(false);
    } catch (error) {
      previewWindow.close();
      toast.error(error instanceof Error ? error.message : "Génération du pré-terme impossible");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Éditer le pré-terme</DialogTitle>
          <DialogDescription>Le document utilise la dernière version enregistrée du brouillon.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={avecPrime ? "WITH" : "WITHOUT"} onValueChange={(value) => setAvecPrime(value === "WITH")}>
          <RadioChoice value="WITHOUT" label="Sans prime" />
          <RadioChoice value="WITH" label="Avec prime" />
        </RadioGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
          <Button type="button" onClick={generate} disabled={generating || !draftId}>
            {generating ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Générer le PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FinalizeRenewalDialog({
  open,
  companyTermEligible,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  companyTermEligible: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mode: RenewalMode) => void;
}) {
  const [mode, setMode] = useState<RenewalMode>("CABINET");

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setMode("CABINET");
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renouveler le contrat</DialogTitle>
          <DialogDescription>
            Le renouvellement sera créé à partir du pré-terme enregistré. Cette opération consomme le stock requis et ne peut pas être annulée depuis ce formulaire.
          </DialogDescription>
        </DialogHeader>
        {companyTermEligible ? (
          <RadioGroup value={mode} onValueChange={(value) => setMode(value as RenewalMode)}>
            <RadioChoice value="CABINET" label="Terme cabinet" detail="Contrôle et consommation du stock d'attestations." />
            <RadioChoice value="COMPAGNIE" label="Terme compagnie" detail="Renouvellement sans consommation du stock cabinet." />
          </RadioGroup>
        ) : (
          <p className="rounded-md border bg-muted/30 p-3 text-sm">Ce contrat sera renouvelé au terme cabinet.</p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
          <Button type="button" onClick={() => onConfirm(companyTermEligible ? mode : "CABINET")} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Confirmer le renouvellement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RadioChoice({ value, label, detail }: { value: string; label: string; detail?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
      <RadioGroupItem value={value} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </label>
  );
}
