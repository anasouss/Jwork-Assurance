import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "../format";
import type { StatutSinistre } from "../types";

const STATUS_CLASSES: Partial<Record<StatutSinistre, string>> = {
  BROUILLON:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  DECLARE: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  DOSSIER_INCOMPLET:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  EXPERTISE:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  EN_ATTENTE_REGLEMENT:
    "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  PARTIELLEMENT_REGLE:
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  REGLE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CLOTURE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  REJETE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  ANNULE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function SinistreStatusBadge({ statut }: { statut: StatutSinistre }) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-0", STATUS_CLASSES[statut])}
    >
      {STATUS_LABELS[statut]}
    </Badge>
  );
}
