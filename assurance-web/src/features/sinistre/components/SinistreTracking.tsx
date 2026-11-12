import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { sinistreApi, sinistreKeys } from "../api";
import { suiviLabels, suiviSteps } from "../workflow";
import type { EtapeSuiviSinistre, SinistreDetail } from "../types";

export function SinistreTracking({ dossier }: { dossier: SinistreDetail }) {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((state) => state.user?.permissions.includes("sinistre:manage") ?? false);
  const [selected, setSelected] = useState<EtapeSuiviSinistre | null>(null);
  const [motif, setMotif] = useState("");
  const transition = dossier.workflow.etapes?.find((item) => item.etapeSuivi === selected);
  const change = useMutation({
    mutationFn: () => sinistreApi.changeStage(dossier.id, selected!, motif.trim() || undefined, dossier.version),
    onSuccess: (result) => {
      queryClient.setQueryData(sinistreKeys.detail(dossier.id), result);
      queryClient.invalidateQueries({ queryKey: sinistreKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sinistreKeys.dashboard() });
      setSelected(null);
      setMotif("");
      toast.success("Étape de suivi mise à jour");
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: sinistreKeys.detail(dossier.id) });
      toast.error(error instanceof Error ? error.message : "Changement d’étape impossible");
    },
  });
  return <section aria-label="Suivi opérationnel" className="min-w-0 border-y py-3">
    <h2 className="mb-3 text-sm font-semibold">Suivi opérationnel</h2>
    <ol className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-6">
      {suiviSteps.map((step) => {
        const active = dossier.etapeSuivi === step;
        return <li key={step} className="min-w-0">
          <button type="button" aria-current={active ? "step" : undefined} aria-pressed={selected === step}
            disabled={change.isPending}
            onClick={() => { setSelected(selected === step ? null : step); setMotif(""); }}
            className={cn("flex min-h-16 w-full items-center gap-2 border-b-2 px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", active ? "border-sky-700 bg-sky-50 font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-200" : "border-border hover:bg-muted", selected === step && "ring-1 ring-inset ring-sky-600")}>
            <Circle className={cn("size-4 shrink-0", active && "fill-sky-700 text-sky-700 dark:fill-sky-400 dark:text-sky-400")} />
            <span className="break-words">{suiviLabels[step]}</span>
          </button>
        </li>;
      })}
    </ol>
    {selected ? <div className="mt-3 grid gap-3 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{suiviLabels[selected]}{selected === dossier.etapeSuivi ? " · étape actuelle" : ""}</p>
        <Button variant="ghost" size="icon" disabled={change.isPending} title="Fermer" aria-label="Fermer le changement d’étape" onClick={() => setSelected(null)}><X className="size-4" /></Button>
      </div>
      {selected === "INSTANCE_CLIENT" && selected === dossier.etapeSuivi ? <p className="text-sm text-muted-foreground">{dossier.prochaineAction || "En attente d’action ou de pièces du client"}</p> : null}
      {(transition?.blocages.length ?? 0) > 0 ? <ul className="list-inside list-disc text-sm text-amber-800 dark:text-amber-300">{transition!.blocages.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
      {canManage && selected !== dossier.etapeSuivi && transition?.autorisee ? <>
        <div className="grid max-w-2xl gap-1.5"><Label htmlFor={`stage-reason-${dossier.id}`}>Motif{transition.motifObligatoire ? " *" : ""}</Label><Textarea id={`stage-reason-${dossier.id}`} required={transition.motifObligatoire} maxLength={500} rows={2} disabled={change.isPending} value={motif} onChange={(event) => setMotif(event.target.value)} /></div>
        <Button className="w-fit" disabled={change.isPending || (transition.motifObligatoire && !motif.trim())} onClick={() => change.mutate()}>{change.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Confirmer l’étape</Button>
      </> : null}
    </div> : null}
  </section>;
}
