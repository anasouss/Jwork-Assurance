import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, X } from "lucide-react";
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
  const currentIndex = suiviSteps.indexOf(dossier.etapeSuivi);
  const pastSteps = new Set(dossier.evenements.map((event) => event.ancienneEtape).filter(Boolean));
  const completedSteps = new Set(suiviSteps.filter((step, index) => index < currentIndex && pastSteps.has(step)));
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">Suivi opérationnel</h2>
      {currentIndex >= 0 ? <p className="text-xs font-medium text-sky-700 dark:text-sky-300">Étape {currentIndex + 1}/{suiviSteps.length} · {suiviLabels[dossier.etapeSuivi]}</p> : null}
    </div>
    <ol className="flex flex-col gap-2 md:grid md:grid-cols-6 md:gap-0">
      {suiviSteps.map((step, index) => {
        const active = dossier.etapeSuivi === step;
        const completed = completedSteps.has(step);
        const nextStep = suiviSteps[index + 1];
        const connected = completed && nextStep !== undefined && (nextStep === dossier.etapeSuivi || completedSteps.has(nextStep));
        return <li key={step} className="relative min-w-0">
          {index < suiviSteps.length - 1 ? <span aria-hidden="true" className={cn(
            "pointer-events-none absolute -bottom-4 left-7 top-12 z-10 w-px md:bottom-auto md:left-[calc(50%+1.25rem)] md:right-[calc(-50%+1.25rem)] md:top-7 md:h-px md:w-auto",
            connected ? "bg-sky-600 dark:bg-sky-400" : "bg-border",
          )} /> : null}
          <Button type="button" variant="ghost" aria-current={active ? "step" : undefined} aria-pressed={selected === step}
            aria-label={`${index + 1}. ${suiviLabels[step]}${active ? " · étape actuelle" : completed ? " · étape passée" : ""}`}
            disabled={change.isPending}
            onClick={() => { setSelected(selected === step ? null : step); setMotif(""); }}
            className={cn(
              "flex h-auto min-h-16 w-full items-start justify-start gap-3 whitespace-normal rounded-md px-2 py-2 text-left text-xs md:min-h-28 md:flex-col md:items-center md:gap-2 md:text-center",
              active ? "bg-sky-50 text-sky-900 hover:bg-sky-100 hover:text-sky-900 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/60" : "text-muted-foreground",
              selected === step && "ring-1 ring-inset ring-sky-600 dark:ring-sky-400",
            )}>
            <span aria-hidden="true" className={cn(
              "relative z-20 grid size-10 shrink-0 place-items-center rounded-full border-2 bg-card text-sm font-semibold tabular-nums",
              active ? "border-sky-700 bg-sky-700 text-white ring-4 ring-sky-100 dark:border-sky-500 dark:bg-sky-600 dark:ring-sky-900" : completed ? "border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-600" : "border-border text-muted-foreground",
            )}>{completed ? <Check className="size-5" /> : index + 1}</span>
            <span className={cn("min-w-0 self-center break-words md:min-h-10 md:self-auto", active && "font-semibold", completed && "text-sky-800 dark:text-sky-300")}>{suiviLabels[step]}</span>
          </Button>
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
        <div className="grid max-w-2xl gap-1.5"><Label htmlFor={`stage-reason-${dossier.id}`}>Motif{transition.motifObligatoire ? <span className="text-red-500">*</span> : null}</Label><Textarea id={`stage-reason-${dossier.id}`} required={transition.motifObligatoire} maxLength={500} rows={2} disabled={change.isPending} value={motif} onChange={(event) => setMotif(event.target.value)} /></div>
        <Button className="w-fit" disabled={change.isPending || (transition.motifObligatoire && !motif.trim())} onClick={() => change.mutate()}>{change.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Confirmer l’étape</Button>
      </> : null}
    </div> : null}
  </section>;
}
