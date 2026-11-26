import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, LoaderCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { sinistreApi, sinistreKeys } from "../api";
import { suiviLabels, suiviSteps } from "../workflow";
import type { EtapeSuiviSinistre, SinistreDetail, StatutSinistre } from "../types";

const stageActions: Record<EtapeSuiviSinistre, string> = {
  OUVERTURE: "Reprendre l’ouverture",
  EXPERTISE_AVANT: "Démarrer l’expertise avant réparation",
  INSTANCE_CLIENT: "Mettre en attente du client",
  EXPERTISE_APRES: "Démarrer l’expertise après réparation",
  COMPAGNIE: "Transmettre à la compagnie",
  CLOTURE: "Clôturer le dossier",
};
const statusActions: Partial<Record<StatutSinistre, string>> = {
  DECLARE: "Valider l’ouverture",
  DOSSIER_INCOMPLET: "Signaler un dossier incomplet",
  EXPERTISE: "Enregistrer le passage en expertise",
  EN_ATTENTE_REGLEMENT: "Mettre en attente de règlement",
  PARTIELLEMENT_REGLE: "Constater un règlement partiel",
  REGLE: "Constater le règlement",
  REJETE: "Enregistrer le refus",
  ANNULE: "Annuler le dossier",
  ROUVERT: "Rouvrir le dossier",
};
type Action = { kind: "stage"; target: EtapeSuiviSinistre } | { kind: "status"; target: StatutSinistre };

export function SinistreTracking({ dossier }: { dossier: SinistreDetail }) {
  const queryClient = useQueryClient();
  const canTransition = useAuthStore((state) => state.user?.permissions.includes("sinistre:transition") ?? false);
  const [action, setAction] = useState<Action | null>(null);
  const [motif, setMotif] = useState("");
  const currentIndex = suiviSteps.indexOf(dossier.etapeSuivi);
  const pastSteps = new Set(dossier.evenements.map((event) => event.ancienneEtape).filter(Boolean));
  const destinations = dossier.workflow.etapes?.filter((item) => item.etapeSuivi !== dossier.etapeSuivi) ?? [];
  const nextStage = suiviSteps.slice(currentIndex + 1).map((step) => destinations.find((item) => item.etapeSuivi === step)).find(Boolean);
  const selected = action?.kind === "stage"
    ? dossier.workflow.etapes?.find((item) => item.etapeSuivi === action.target)
    : dossier.workflow.transitions.find((item) => item.statut === action?.target);
  const reasonRequired = action?.kind === "stage"
    ? dossier.workflow.etapes?.find((item) => item.etapeSuivi === action.target)?.motifObligatoire
    : action != null && ["ANNULE", "REJETE", "ROUVERT"].includes(action.target);
  const title = action ? (action.kind === "stage" ? stageActions[action.target] : statusActions[action.target]) : "";
  const change = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error("Aucune action sélectionnée");
      return action.kind === "stage"
        ? sinistreApi.changeStage(dossier.id, action.target, motif.trim() || undefined, dossier.version)
        : sinistreApi.transition(dossier.id, action.target, motif.trim() || undefined);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(sinistreKeys.detail(dossier.id), result);
      queryClient.invalidateQueries({ queryKey: sinistreKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sinistreKeys.dashboard() });
      setAction(null);
      setMotif("");
      toast.success("Dossier mis à jour");
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: sinistreKeys.detail(dossier.id) });
      toast.error(error instanceof Error ? error.message : "Action impossible");
    },
  });
  const openAction = (next: Action) => { setMotif(""); setAction(next); };
  const administrativeActions = dossier.workflow.transitions.filter((item) => statusActions[item.statut]);
  const alternativeStages = destinations.filter((item) => item !== nextStage);

  return <section aria-label="Parcours du sinistre" className="min-w-0 border-b pb-5">
    <ol className="grid grid-cols-3 gap-y-5 lg:grid-cols-6">
      {suiviSteps.map((step, index) => {
        const active = dossier.etapeSuivi === step;
        const completed = index < currentIndex && pastSteps.has(step);
        return <li key={step} className="relative min-w-0 pr-3" aria-current={active ? "step" : undefined}>
          <div className="flex items-center gap-2">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
              active ? "border-sky-700 bg-sky-700 text-white" : completed ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200" : "border-border bg-background text-muted-foreground")}>
              {completed ? <Check className="size-4" /> : index + 1}
            </span>
            {index < suiviSteps.length - 1 ? <span aria-hidden className={cn("h-px flex-1", completed ? "bg-sky-500" : "bg-border")} /> : null}
          </div>
          <p className={cn("mt-2 text-xs", active ? "font-semibold text-sky-800 dark:text-sky-200" : "text-muted-foreground")}>{suiviLabels[step]}</p>
        </li>;
      })}
    </ol>
    {canTransition ? <div className="mt-5 flex flex-wrap items-center gap-2">
      {nextStage ? <Button size="sm" variant="outline" className="h-auto min-h-9 whitespace-normal text-left" onClick={() => openAction({ kind: "stage", target: nextStage.etapeSuivi })}>
        {stageActions[nextStage.etapeSuivi]}<ArrowRight className="size-3.5 shrink-0" />
      </Button> : null}
      {administrativeActions.length || alternativeStages.length ? <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" title="Autres actions du dossier" aria-label="Autres actions du dossier"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
          {alternativeStages.map((item) => <DropdownMenuItem key={item.etapeSuivi} onSelect={() => openAction({ kind: "stage", target: item.etapeSuivi })}>{stageActions[item.etapeSuivi]}</DropdownMenuItem>)}
          {administrativeActions.map((item) => <DropdownMenuItem key={item.statut} onSelect={() => openAction({ kind: "status", target: item.statut })}>{statusActions[item.statut]}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu> : null}
    </div> : null}
    {dossier.prochaineAction ? <p className="mt-4 text-sm text-muted-foreground"><span className="font-medium text-foreground">Prochaine action : </span>{dossier.prochaineAction}</p> : null}
    <Dialog open={action != null && canTransition} onOpenChange={(open) => { if (!open && !change.isPending) setAction(null); }}>
      <DialogContent showCloseButton={!change.isPending}>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{dossier.numeroSinistre} · {suiviLabels[dossier.etapeSuivi]}</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          if (canTransition && selected?.autorisee && !change.isPending && (!reasonRequired || motif.trim())) change.mutate();
        }}>
          {selected?.blocages.length ? <ul role="alert" className="list-inside list-disc text-sm text-amber-800 dark:text-amber-300">{selected.blocages.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
          <div className="grid gap-1.5"><Label htmlFor={`stage-reason-${dossier.id}`}>Observation{reasonRequired ? " *" : ""}</Label>
            <Textarea id={`stage-reason-${dossier.id}`} required={Boolean(reasonRequired)} maxLength={500} rows={3} disabled={change.isPending} value={motif} onChange={(event) => setMotif(event.target.value)} />
          </div>
          <DialogFooter><Button type="button" variant="outline" disabled={change.isPending} onClick={() => setAction(null)}>Annuler</Button>
            <Button type="submit" disabled={change.isPending || !selected?.autorisee || Boolean(reasonRequired && !motif.trim())}>{change.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Confirmer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
