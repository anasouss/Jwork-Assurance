import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { contractKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { contractApi } from "../../api/contracts";
import type { ContratSummary } from "../../types";
import { ProspectionDialogSkeleton } from "./ProspectionDialogSkeleton";

type DevisScope = "all" | "vehicles" | "usages";

export function ProspectionPdfDialog({
  contratId,
  open,
  onOpenChange,
}: {
  contratId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [scope, setScope] = useState<DevisScope>("all");
  const [selectedVehicules, setSelectedVehicules] = useState<string[]>([]);
  const [selectedUsages, setSelectedUsages] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const detail = useQuery({
    queryKey: contractKeys.detail(contratId ?? "pending"),
    queryFn: () => contractApi.getContrat(contratId!),
    enabled: open && Boolean(contratId),
  });
  const usageOptions = useMemo(() => uniqueUsages(detail.data), [detail.data]);

  const generatePdf = async () => {
    if (!contratId) return;
    if (scope === "vehicles" && selectedVehicules.length === 0) {
      toast.error("Sélectionnez au moins un véhicule");
      return;
    }
    if (scope === "usages" && selectedUsages.length === 0) {
      toast.error("Sélectionnez au moins un usage");
      return;
    }
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Autorisez les popups pour ouvrir le PDF dans un nouvel onglet");
      return;
    }
    setGenerating(true);
    try {
      const blob = await contractApi.downloadDevisPdf(contratId, {
        vehiculeIds: scope === "vehicles" ? selectedVehicules : undefined,
        usageIds: scope === "usages" ? selectedUsages : undefined,
      });
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("PDF ouvert");
    } catch (error) {
      previewWindow.close();
      toast.error(error instanceof Error ? error.message : "Génération du PDF impossible");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Télécharger devis flotte</DialogTitle>
        </DialogHeader>
        {detail.isLoading ? <ProspectionDialogSkeleton /> : detail.isError ? (
          <div className="rounded-md border border-destructive/30 px-3 py-4 text-sm text-destructive">
            Impossible de charger le devis.
          </div>
        ) : (
          <RadioGroup value={scope} onValueChange={(value) => setScope(value as DevisScope)}>
            <RadioOption value="all" label="Tous les véhicules" />
            <RadioOption value="vehicles" label="Véhicules spécifiques" />
            {scope === "vehicles" ? (
              <Checklist
                emptyText="Aucun véhicule."
                items={(detail.data?.vehicules ?? []).map((vehicule) => ({
                  id: vehicule.vehiculeId,
                  label: vehicleLabel(vehicule),
                }))}
                values={selectedVehicules}
                onChange={setSelectedVehicules}
              />
            ) : null}
            <RadioOption value="usages" label="Usages spécifiques" />
            {scope === "usages" ? (
              <Checklist emptyText="Aucun usage." items={usageOptions} values={selectedUsages} onChange={setSelectedUsages} />
            ) : null}
          </RadioGroup>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="button" onClick={generatePdf} disabled={generating || !detail.data}>
            {generating ? "Génération..." : "Générer le PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Checklist({
  items,
  values,
  onChange,
  emptyText,
}: {
  items: { id: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  emptyText: string;
}) {
  if (!items.length) {
    return <div className="ml-7 rounded-md border px-3 py-4 text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <div className="ml-7 grid max-h-64 gap-2 overflow-y-auto rounded-md border bg-background p-3">
      {items.map((item) => {
        const checked = values.includes(item.id);
        return (
          <label key={item.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) =>
                onChange(value ? [...values, item.id] : values.filter((selected) => selected !== item.id))
              }
            />
            <span>{item.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function RadioOption({ value, label }: { value: DevisScope; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <RadioGroupItem value={value} />
      <span>{label}</span>
    </label>
  );
}

function uniqueUsages(contrat?: ContratSummary) {
  const map = new Map<string, string>();
  for (const vehicule of contrat?.vehicules ?? []) {
    if (vehicule.usageId) {
      map.set(vehicule.usageId, vehicule.usageCode ?? vehicule.usageLibelle ?? "Sans usage");
    }
  }
  return [...map.entries()].map(([id, label]) => ({ id, label }));
}

function vehicleLabel(vehicule: NonNullable<ContratSummary["vehicules"]>[number]) {
  const parts = [vehicule.marque, vehicule.immatriculation].filter(Boolean);
  const base = parts.length ? parts.join(" - ") : `Véhicule #${vehicule.vehiculeId}`;
  return vehicule.usageCode || vehicule.usageLibelle
    ? `${base} (${vehicule.usageCode ?? vehicule.usageLibelle})`
    : base;
}
