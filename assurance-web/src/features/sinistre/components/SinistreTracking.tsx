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
  const canTransition = useAuthStore((state) => state.user?.permissions.includes("sinistre:transition") ?? false);
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
  return <section aria-label="Suivi opérationnel" className="min-w-0 border-y border-sky-200 bg-card px-4 py-4 dark:border-sky-900">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">Suivi opérationnel</h2>
      <div className="flex flex-wrap items-center gap-3">
        {currentIndex >= 0 ? <p className="text-xs font-medium text-sky-700 dark:text-sky-300">Étape {currentIndex + 1}/{suiviSteps.length} · {suiviLabels[dossier.etapeSuivi]}</p> : null}
        {canTransition && destinations.length > 0 ? <Button type="button" size="sm" variant="outline" onClick={() => {
          setSelected(null);
          setMotif("");
          setChangeOpen(true);
        }}><ArrowRightLeft className="size-4" />Changer l’étape</Button> : null}
      </div>
    </div>
    <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {suiviSteps.map((step, index) => {
        const active = dossier.etapeSuivi === step;
        const completed = completedSteps.has(step);
        return <li key={step} className={cn("min-w-0 border-b-2 pb-3", active ? "border-sky-600 dark:border-sky-400" : completed ? "border-emerald-600 dark:border-emerald-400" : "border-border")} aria-current={active ? "step" : undefined}
          aria-label={`${index + 1}. ${suiviLabels[step]}${active ? " · étape actuelle" : completed ? " · étape passée" : ""}`}>
          <div className={cn(
              "flex min-h-14 items-start gap-2 text-sm",
              active ? "text-sky-900 dark:text-sky-200" : "text-muted-foreground",
            )}>
            <span aria-hidden="true" className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
              active ? "border-sky-700 bg-sky-700 text-white dark:border-sky-500 dark:bg-sky-600" : completed ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : "border-border bg-muted/40 text-muted-foreground",
            )}>{completed ? <Check className="size-4" /> : index + 1}</span>
            <span className={cn("min-w-0 break-words pt-0.5", active && "font-semibold", completed && "text-emerald-800 dark:text-emerald-300")}>{suiviLabels[step]}</span>
          </div>
        </li>;
      })}
    </ol>
    {dossier.prochaineAction ? <p className="mt-2 break-words text-sm text-muted-foreground"><span className="font-medium text-foreground">Prochaine action : </span>{dossier.prochaineAction}</p> : null}
    <Dialog open={changeOpen && canTransition} onOpenChange={(open) => { if (!change.isPending) setChangeOpen(open); }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!change.isPending}>
        <DialogHeader>
          <DialogTitle>Changer l’étape de suivi</DialogTitle>
          <DialogDescription>Étape actuelle : {suiviLabels[dossier.etapeSuivi]}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          if (canTransition && selected && transition?.autorisee && !change.isPending
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
