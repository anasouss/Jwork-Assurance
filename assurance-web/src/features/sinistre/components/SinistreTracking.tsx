import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [changeOpen, setChangeOpen] = useState(false);
  const [selected, setSelected] = useState<EtapeSuiviSinistre | null>(null);
  const [motif, setMotif] = useState("");
  const currentIndex = suiviSteps.indexOf(dossier.etapeSuivi);
  const pastSteps = new Set(dossier.evenements.map((event) => event.ancienneEtape).filter(Boolean));
  const completedSteps = new Set(suiviSteps.filter((step, index) => index < currentIndex && pastSteps.has(step)));
  const transition = dossier.workflow.etapes?.find((item) => item.etapeSuivi === selected);
  const destinations = dossier.workflow.etapes?.filter((item) => item.etapeSuivi !== dossier.etapeSuivi) ?? [];
  const change = useMutation({
    mutationFn: () => sinistreApi.changeStage(dossier.id, selected!, motif.trim() || undefined, dossier.version),
    onSuccess: (result) => {
      queryClient.setQueryData(sinistreKeys.detail(dossier.id), result);
      queryClient.invalidateQueries({ queryKey: sinistreKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sinistreKeys.dashboard() });
      setSelected(null);
      setMotif("");
      setChangeOpen(false);
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
      <div className="flex flex-wrap items-center gap-3">
        {currentIndex >= 0 ? <p className="text-xs font-medium text-sky-700 dark:text-sky-300">Étape {currentIndex + 1}/{suiviSteps.length} · {suiviLabels[dossier.etapeSuivi]}</p> : null}
        {canManage && destinations.length > 0 ? <Button type="button" size="sm" variant="outline" onClick={() => {
          setSelected(null);
          setMotif("");
          setChangeOpen(true);
        }}><ArrowRightLeft className="size-4" />Changer l’étape</Button> : null}
      </div>
    </div>
    <ol className="flex flex-col gap-2 md:grid md:grid-cols-6 md:gap-0">
      {suiviSteps.map((step, index) => {
        const active = dossier.etapeSuivi === step;
        const completed = completedSteps.has(step);
        const nextStep = suiviSteps[index + 1];
        const connected = completed && nextStep !== undefined && (nextStep === dossier.etapeSuivi || completedSteps.has(nextStep));
        return <li key={step} className="relative min-w-0" aria-current={active ? "step" : undefined}
          aria-label={`${index + 1}. ${suiviLabels[step]}${active ? " · étape actuelle" : completed ? " · étape passée" : ""}`}>
          {index < suiviSteps.length - 1 ? <span aria-hidden="true" className={cn(
            "pointer-events-none absolute -bottom-4 left-7 top-12 z-10 w-px md:bottom-auto md:left-[calc(50%+1.25rem)] md:right-[calc(-50%+1.25rem)] md:top-7 md:h-px md:w-auto",
            connected ? "bg-sky-600 dark:bg-sky-400" : "bg-border",
          )} /> : null}
          <div className={cn(
              "flex h-auto min-h-16 w-full items-start justify-start gap-3 whitespace-normal rounded-md px-2 py-2 text-left text-xs md:min-h-28 md:flex-col md:items-center md:gap-2 md:text-center",
              active ? "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200" : "text-muted-foreground",
            )}>
            <span aria-hidden="true" className={cn(
              "relative z-20 grid size-10 shrink-0 place-items-center rounded-full border-2 bg-card text-sm font-semibold tabular-nums",
              active ? "border-sky-700 bg-sky-700 text-white ring-4 ring-sky-100 dark:border-sky-500 dark:bg-sky-600 dark:ring-sky-900" : completed ? "border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-600" : "border-border text-muted-foreground",
            )}>{completed ? <Check className="size-5" /> : index + 1}</span>
            <span className={cn("min-w-0 self-center break-words md:min-h-10 md:self-auto", active && "font-semibold", completed && "text-sky-800 dark:text-sky-300")}>{suiviLabels[step]}</span>
          </div>
        </li>;
      })}
    </ol>
    {dossier.etapeSuivi === "INSTANCE_CLIENT" && dossier.prochaineAction ? <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{dossier.prochaineAction}</p> : null}
    <Dialog open={changeOpen && canManage} onOpenChange={(open) => { if (!change.isPending) setChangeOpen(open); }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!change.isPending}>
        <DialogHeader>
          <DialogTitle>Changer l’étape de suivi</DialogTitle>
          <DialogDescription>Étape actuelle : {suiviLabels[dossier.etapeSuivi]}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          if (canManage && selected && transition?.autorisee && !change.isPending
              && (!transition.motifObligatoire || motif.trim())) change.mutate();
        }}>
          <div className="grid gap-1.5">
            <Label htmlFor={`stage-target-${dossier.id}`}>Nouvelle étape <span className="text-red-500">*</span></Label>
            <Select value={selected ?? ""} disabled={change.isPending} onValueChange={(value) => { setSelected(value as EtapeSuiviSinistre); setMotif(""); }}>
              <SelectTrigger id={`stage-target-${dossier.id}`}><SelectValue placeholder="Sélectionner une étape" /></SelectTrigger>
              <SelectContent>{destinations.map((item) => <SelectItem key={item.etapeSuivi} value={item.etapeSuivi}>{suiviLabels[item.etapeSuivi]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {(transition?.blocages.length ?? 0) > 0 ? <ul role="alert" className="list-inside list-disc text-sm text-amber-800 dark:text-amber-300">{transition!.blocages.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
          {transition?.autorisee ? <div className="grid gap-1.5">
            <Label htmlFor={`stage-reason-${dossier.id}`}>Motif{transition.motifObligatoire ? <span className="text-red-500">*</span> : null}</Label>
            <Textarea id={`stage-reason-${dossier.id}`} required={transition.motifObligatoire} maxLength={500} rows={3} disabled={change.isPending} value={motif} onChange={(event) => setMotif(event.target.value)} />
          </div> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={change.isPending} onClick={() => setChangeOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={change.isPending || !transition?.autorisee || (transition.motifObligatoire && !motif.trim())}>
              {change.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Confirmer l’étape
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
