import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { contractKeys } from "@/lib/query-keys";

import { contractApi } from "../../api/contracts";

type Props = {
  contratId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const money = new Intl.NumberFormat("fr-MA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function FinancialHistoryRecalculationDialog({ contratId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryKey: [...contractKeys.detail(contratId), "financial-history-recalculation"],
    queryFn: () => contractApi.previewFinancialHistoryRecalculation(contratId),
    enabled: open,
    staleTime: 0,
    retry: false,
  });
  const apply = useMutation({
    mutationFn: () => contractApi.applyFinancialHistoryRecalculation(contratId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
      toast.success("Historique financier recalculé");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Recalcul impossible");
      preview.refetch();
    },
  });
  const data = preview.data;
  const hasChanges = data?.mouvements.some((movement) => movement.modifie) ?? false;

  return (
    <Dialog open={open} onOpenChange={(next) => !apply.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Recalculer l’historique financier</DialogTitle>
          <DialogDescription>
            Les règles fiscales applicables à la date d’effet de chaque mouvement seront réappliquées.
            Les références des mouvements et des quittances restent inchangées.
          </DialogDescription>
        </DialogHeader>

        {preview.isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : preview.isError ? (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {preview.error instanceof Error ? preview.error.message : "Prévisualisation impossible"}
          </p>
        ) : data ? (
          <div className="space-y-4">
            {data.blocages.length ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="size-4" />
                  Recalcul bloqué
                </div>
                <ul className="list-disc space-y-1 pl-5">
                  {data.blocages.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="grid grid-cols-3 border text-sm">
              <Summary label="Total actuel" value={data.ancienTotal} />
              <Summary label="Total recalculé" value={data.nouveauTotal} />
              <Summary label="Écart" value={data.ecartTotal} emphasized />
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-3 py-2">Mouvement</th>
                    <th className="px-3 py-2">Date d’effet</th>
                    <th className="px-3 py-2">Version</th>
                    <th className="px-3 py-2 text-right">Prime nette</th>
                    <th className="px-3 py-2 text-right">Taxe d’assurance</th>
                    <th className="px-3 py-2 text-right">TPF</th>
                    <th className="px-3 py-2 text-right">Accessoires</th>
                    <th className="px-3 py-2 text-right">CNPAC</th>
                    <th className="px-3 py-2 text-right">TTC</th>
                  </tr>
                </thead>
                {data.mouvements.map((movement) => (
                  <tbody key={movement.mouvementId}>
                    <tr className="border-t">
                      <td rowSpan={2} className="px-3 py-2 align-top">
                        <div className="font-medium">{movement.numeroMouvement} · {movement.libelle}</div>
                        <div className="text-xs text-muted-foreground">{movement.code}</div>
                      </td>
                      <td rowSpan={2} className="px-3 py-2 align-top">{formatDate(movement.dateEffet)}</td>
                      <td className="px-3 py-2 text-muted-foreground">Actuel</td>
                      <Amount value={movement.anciensMontants.primeNette} />
                      <Amount value={movement.anciensMontants.taxe} />
                      <Amount value={movement.anciensMontants.taxeParafiscale} />
                      <Amount value={movement.anciensMontants.accessoire} />
                      <Amount value={movement.anciensMontants.cnpac} />
                      <Amount value={movement.anciensMontants.primeTotale} />
                    </tr>
                    <tr className="bg-muted/20">
                      <td className="px-3 py-2 font-medium">Recalculé</td>
                      <ComparedAmount current={movement.anciensMontants.primeNette} recalculated={movement.nouveauxMontants.primeNette} />
                      <ComparedAmount current={movement.anciensMontants.taxe} recalculated={movement.nouveauxMontants.taxe} />
                      <ComparedAmount current={movement.anciensMontants.taxeParafiscale} recalculated={movement.nouveauxMontants.taxeParafiscale} />
                      <ComparedAmount current={movement.anciensMontants.accessoire} recalculated={movement.nouveauxMontants.accessoire} />
                      <ComparedAmount current={movement.anciensMontants.cnpac} recalculated={movement.nouveauxMontants.cnpac} />
                      <ComparedAmount current={movement.anciensMontants.primeTotale} recalculated={movement.nouveauxMontants.primeTotale} strong />
                    </tr>
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={apply.isPending} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!data?.applicable || !hasChanges || apply.isPending}
            onClick={() => apply.mutate()}
          >
            {apply.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Appliquer le recalcul
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value, emphasized }: { label: string; value: number; emphasized?: boolean }) {
  return (
    <div className="border-r p-3 last:border-r-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={emphasized ? "mt-1 font-bold" : "mt-1 font-semibold"}>{money.format(value)} MAD</div>
    </div>
  );
}

function Amount({ value, changed, strong }: { value: number; changed?: boolean; strong?: boolean }) {
  return (
    <td className={`px-3 py-2 text-right ${strong ? "font-semibold" : ""} ${changed ? "text-amber-700 dark:text-amber-300" : ""}`}>
      {money.format(value)}
    </td>
  );
}

function ComparedAmount({ current, recalculated, strong }: { current: number; recalculated: number; strong?: boolean }) {
  return <Amount value={recalculated} changed={Math.abs(recalculated - current) >= 0.005} strong={strong} />;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
