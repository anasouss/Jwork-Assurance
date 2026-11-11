import { Plus, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { useDashboardDateRange, DatePreset } from "@/hooks/use-dashboard-date-range";
import { cn } from "@/lib/utils";
import { dateOnly } from "../dashboard-format";

const presets: Array<{ value: DatePreset; label: string }> = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "thisMonth", label: "Ce mois" },
  { value: "3m", label: "3 mois" },
];

export function DashboardFilters({ range, isFetching, canCreate, onRefresh }: {
  range: ReturnType<typeof useDashboardDateRange>;
  isFetching: boolean;
  canCreate: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-end gap-3 xl:w-auto xl:justify-end">
      <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-[150px_150px]">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Du</span>
          <DatePicker date={range.fromStr} maxDate={dateOnly(range.toStr)}
            onSelect={date => { if (date) range.setCustomRange(date, range.to); }} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Au</span>
          <DatePicker date={range.toStr} minDate={dateOnly(range.fromStr)}
            onSelect={date => { if (date) range.setCustomRange(range.from, date); }} />
        </label>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <div role="group" aria-label="Période rapide" className="flex min-h-9 flex-1 items-center gap-1 rounded-md border bg-muted/40 p-1 sm:flex-none">
          {presets.map(preset => (
            <Button key={preset.value} type="button" size="sm" variant="ghost"
              aria-pressed={range.activePreset === preset.value}
              className={cn("h-7 flex-1 px-2.5 sm:flex-none",
                range.activePreset === preset.value && "bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white")}
              onClick={() => range.setPreset(preset.value)}>
              {preset.label}
            </Button>
          ))}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" disabled={isFetching}
              aria-label="Actualiser les indicateurs" onClick={onRefresh}>
              <RefreshCw className={cn("size-4", isFetching && "animate-spin motion-reduce:animate-none")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Actualiser les indicateurs</TooltipContent>
        </Tooltip>
      </div>
      {canCreate && (
        <Button asChild className="h-9 shrink-0 sm:ml-auto">
          <Link to="/app/production/ajouter-dossier"><Plus className="size-4" />Nouveau dossier</Link>
        </Button>
      )}
    </div>
  );
}
