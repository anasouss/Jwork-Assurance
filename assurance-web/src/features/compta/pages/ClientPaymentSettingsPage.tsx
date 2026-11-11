import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/features/production/components/MoneyInput";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";

const policyQueryKey = ["compta", "client-payment-policy"] as const;

export default function ClientPaymentSettingsPage() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("reglement-client:manage");
  const [maximumCredit, setMaximumCredit] = useState<number>();
  const [maximumAdjustment, setMaximumAdjustment] = useState<number>();

  const policy = useQuery({
    queryKey: policyQueryKey,
    queryFn: comptaApi.clientPaymentPolicy,
  });

  useEffect(() => {
    if (policy.data) {
      setMaximumCredit(policy.data.creditNonAffecteMaximum);
      setMaximumAdjustment(policy.data.ecartReglementMaximum ?? 0);
    }
  }, [policy.data]);

  const save = useMutation({
    mutationFn: () => comptaApi.updateClientPaymentPolicy(maximumCredit ?? 0, maximumAdjustment ?? 0),
    onSuccess: async (updatedPolicy) => {
      setMaximumCredit(updatedPolicy.creditNonAffecteMaximum);
      setMaximumAdjustment(updatedPolicy.ecartReglementMaximum ?? 0);
      queryClient.setQueryData(policyQueryKey, updatedPolicy);
      await queryClient.invalidateQueries({ queryKey: policyQueryKey });
      toast.success("Paramètres des règlements enregistrés");
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Enregistrement impossible"
    ),
  });

  const currentMaximum = policy.data?.creditNonAffecteMaximum;
  const isValid = maximumCredit != null && Number.isFinite(maximumCredit) && maximumCredit >= 0
    && maximumAdjustment != null && Number.isFinite(maximumAdjustment) && maximumAdjustment >= 0;
  const isUnchanged = currentMaximum != null && maximumCredit === currentMaximum
    && maximumAdjustment === (policy.data?.ecartReglementMaximum ?? 0);

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
            Paramétrage comptable
          </p>
          <h1 className="text-xl font-semibold">Règlements clients</h1>
          <p className="text-sm text-muted-foreground">
            Définissez les contrôles appliqués aux encaissements de l’agence.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/compta/parametres">
            <ArrowLeft className="size-4" />
            Retour aux paramètres
          </Link>
        </Button>
      </header>

      <section className="max-w-3xl overflow-hidden rounded-md border bg-card">
        <div className="border-b bg-muted/30 px-4 py-3">
          <h2 className="font-semibold">Reste à affecter</h2>
        </div>
        <div className="grid gap-4 p-4">
          <div className="grid max-w-md gap-2">
            <Label htmlFor="maximum-unallocated-credit">
              Montant maximal restant à affecter (MAD)
            </Label>
            <MoneyInput
              id="maximum-unallocated-credit"
              value={maximumCredit}
              onValueChange={setMaximumCredit}
              disabled={!canManage || policy.isLoading || save.isPending}
              className="text-right tabular-nums"
            />
            <p className="text-sm text-muted-foreground">
              Un règlement est bloqué lorsque le montant restant à affecter dépasse cette limite.
              Saisissez 0 pour interdire tout dépassement.
            </p>
          </div>

          <div className="grid max-w-md gap-2 border-t pt-4">
            <Label htmlFor="maximum-settlement-adjustment">Écart de règlement maximal par règlement (MAD)</Label>
            <MoneyInput id="maximum-settlement-adjustment" value={maximumAdjustment} onValueChange={setMaximumAdjustment}
              disabled={!canManage || policy.isLoading || save.isPending} className="text-right tabular-nums" />
            <p className="text-sm text-muted-foreground">Saisissez 0 pour désactiver les écarts accordés. Un motif et la permission de gestion des règlements sont requis.</p>
          </div>

          {policy.isError ? (
            <p className="text-sm font-medium text-destructive">
              {policy.error instanceof Error
                ? policy.error.message
                : "Impossible de charger les paramètres."}
            </p>
          ) : null}

          {!canManage ? (
            <p className="text-sm text-muted-foreground">
              Valeur actuelle : {formatAccountingAmount(currentMaximum ?? 0)} MAD. La permission de gestion
              des règlements clients est requise pour la modifier.
            </p>
          ) : null}

          {canManage ? (
            <div className="flex justify-end border-t pt-4">
              <Button
                type="button"
                disabled={!isValid || isUnchanged || policy.isLoading || save.isPending}
                onClick={() => save.mutate()}
              >
                <Save className="size-4" />
                {save.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
