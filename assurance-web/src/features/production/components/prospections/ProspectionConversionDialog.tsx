import { Fragment, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { contractKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { contractServiceApi } from "../../api/contract-services";
import { contractApi } from "../../api/contracts";
import { AttestationNumberInput } from "../AttestationNumberInput";
import { Field } from "../Field";
import type { AssistanceContrat, ContratSummary, ReferenceOption } from "../../types";
import { ProspectionDialogSkeleton } from "./ProspectionDialogSkeleton";

export function ProspectionConversionDialog({
  contratId,
  open,
  compagnies,
  usages,
  onOpenChange,
  onConverted,
}: {
  contratId: string | null;
  open: boolean;
  compagnies: ReferenceOption[];
  usages: ReferenceOption[];
  onOpenChange: (open: boolean) => void;
  onConverted: () => Promise<void> | void;
}) {
  const detail = useQuery({
    queryKey: contractKeys.detail(contratId ?? "pending"),
    queryFn: () => contractApi.getContrat(contratId!),
    enabled: open && Boolean(contratId),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Convertir en contrat</DialogTitle>
        </DialogHeader>
        {detail.isLoading ? <ProspectionDialogSkeleton /> : detail.isError ? (
          <div className="rounded-md border border-destructive/30 px-3 py-4 text-sm text-destructive">
            Impossible de charger le devis.
          </div>
        ) : detail.data ? (
          <ConversionForm
            key={detail.data.id}
            contrat={detail.data}
            compagnies={compagnies}
            usages={usages}
            onCancel={() => onOpenChange(false)}
            onConverted={onConverted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ConversionForm({
  contrat,
  compagnies,
  usages,
  onCancel,
  onConverted,
}: {
  contrat: ContratSummary;
  compagnies: ReferenceOption[];
  usages: ReferenceOption[];
  onCancel: () => void;
  onConverted: () => Promise<void> | void;
}) {
  const [numeroPolice, setNumeroPolice] = useState(contrat.numeroPolice ?? "");
  const [attestations, setAttestations] = useState<Record<string, string>>(() => Object.fromEntries([
    ...(contrat.vehicules ?? []).map((vehicule) => [`vehicule-${vehicule.vehiculeId}`, vehicule.numeroAttestation ?? ""] as const),
    ...(contrat.remorques ?? []).map((remorque) => [`remorque-${remorque.remorqueId}`, remorque.numeroAttestation ?? ""] as const),
  ]));
  const [assistanceRefs, setAssistanceRefs] = useState<Record<string, string>>({});
  const assistanceContext = useQuery({
    queryKey: [...contractKeys.detail(contrat.id), "assistance-context"],
    queryFn: () => contractServiceApi.getAssistanceContext(contrat.id),
  });
  const convertMutation = useMutation({
    mutationFn: () => contractApi.convertProspection(contrat.id, {
      numeroPolice,
      vehicules: (contrat.vehicules ?? []).map((vehicule) => ({
        vehiculeId: vehicule.vehiculeId,
        numeroAttestation: attestations[`vehicule-${vehicule.vehiculeId}`],
      })),
      remorques: (contrat.remorques ?? []).map((remorque) => ({
        remorqueId: remorque.remorqueId,
        numeroAttestation: attestations[`remorque-${remorque.remorqueId}`],
      })),
      assistances: (assistanceContext.data?.assistances ?? []).map((assistance) => ({
        assistanceId: assistance.id,
        numeroContratOuQuittance: assistanceRefs[assistance.id],
      })),
    }),
    onSuccess: async () => {
      toast.success("Devis converti en contrat");
      await onConverted();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Conversion impossible"),
  });

  return (
    <>
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="N° devis">
            <Input value={contrat.numeroDevis ?? contrat.numeroPolice ?? ""} readOnly />
          </Field>
          <Field label="N° police" required>
            <Input value={numeroPolice} onChange={(event) => setNumeroPolice(event.target.value)} />
          </Field>
        </div>
        {(assistanceContext.data?.assistances ?? []).length ? (
          <div className="grid gap-2">
            <div className="text-sm font-semibold uppercase text-blue-700">Contrats assistance</div>
            {(assistanceContext.data?.assistances ?? []).map((assistance) => (
              <Field key={assistance.id} label={assistanceLabel(assistance)} required>
                <Input
                  value={assistanceRefs[assistance.id] ?? assistance.numeroContratOuQuittance ?? ""}
                  onChange={(event) => setAssistanceRefs((current) => ({ ...current, [assistance.id]: event.target.value }))}
                  placeholder="N° contrat assistance"
                />
              </Field>
            ))}
          </div>
        ) : null}
        <div className="grid gap-2">
          <div className="text-sm font-semibold uppercase text-blue-700">Numéros d'attestation par véhicule</div>
          <AttestationInputs
            contrat={contrat}
            values={attestations}
            onChange={setAttestations}
            compagnies={compagnies}
            usages={usages}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button
          type="button"
          onClick={() => convertMutation.mutate()}
          disabled={convertMutation.isPending || !numeroPolice.trim()}
        >
          {convertMutation.isPending ? "Conversion..." : "Convertir"}
        </Button>
      </DialogFooter>
    </>
  );
}

function AttestationInputs({
  contrat,
  values,
  onChange,
  compagnies,
  usages,
}: {
  contrat: ContratSummary;
  values: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  compagnies: ReferenceOption[];
  usages: ReferenceOption[];
}) {
  const rows = [
    ...(contrat.vehicules ?? []).map((vehicule) => ({
      key: `vehicule-${vehicule.vehiculeId}`,
      usageId: vehicule.usageId ?? undefined,
      usage: vehicule.usageCode ?? vehicule.usageLibelle ?? "Sans usage",
      label: vehicleLabel(vehicule),
      required: Boolean(vehicule.consommeAttestation),
      currentNumero: vehicule.numeroAttestation ?? undefined,
    })),
    ...(contrat.remorques ?? []).map((remorque) => ({
      key: `remorque-${remorque.remorqueId}`,
      usageId: remorque.usageId ?? undefined,
      usage: remorque.usageCode ?? remorque.usageLibelle ?? "Remorques",
      label: remorqueLabel(remorque),
      required: Boolean(remorque.consommeAttestation),
      currentNumero: remorque.numeroAttestation ?? undefined,
    })),
  ];
  if (!rows.length) {
    return <div className="rounded-md border px-3 py-4 text-sm text-muted-foreground">Aucun véhicule.</div>;
  }
  const grouped = rows.reduce<Map<string, typeof rows>>((map, row) => {
    map.set(row.usage, [...(map.get(row.usage) ?? []), row]);
    return map;
  }, new Map());
  return (
    <div className="grid max-h-[340px] gap-4 overflow-y-auto rounded-md border p-3">
      {[...grouped.entries()].map(([usage, usageRows]) => (
        <Fragment key={usage}>
          <div className="text-xs font-bold uppercase text-slate-700">{usage}</div>
          <div className="grid gap-3">
            {usageRows.map((row) => (
              <Field key={row.key} label={row.label} required={row.required}>
                <AttestationNumberInput
                  value={values[row.key] ?? ""}
                  onChange={(value) => onChange({ ...values, [row.key]: value })}
                  compagnieAssuranceId={contrat.compagnieAssuranceId}
                  usageId={row.usageId}
                  compagnies={compagnies}
                  usages={usages}
                  numeroCourant={row.currentNumero}
                  required={row.required}
                  placeholder="Numéro d'attestation"
                />
              </Field>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function vehicleLabel(vehicule: NonNullable<ContratSummary["vehicules"]>[number]) {
  const parts = [vehicule.marque, vehicule.immatriculation].filter(Boolean);
  const base = parts.length ? parts.join(" - ") : `Véhicule #${vehicule.vehiculeId}`;
  return vehicule.usageCode || vehicule.usageLibelle
    ? `${base} (${vehicule.usageCode ?? vehicule.usageLibelle})`
    : base;
}

function remorqueLabel(remorque: NonNullable<ContratSummary["remorques"]>[number]) {
  const parts = [remorque.marque, remorque.immatriculation].filter(Boolean);
  return parts.length ? parts.join(" - ") : `Remorque #${remorque.remorqueId}`;
}

function assistanceLabel(assistance: AssistanceContrat) {
  const parts = [assistance.produit, assistance.vehiculeImmatriculation].filter(Boolean);
  return parts.length ? parts.join(" - ") : `Assistance #${assistance.id}`;
}
