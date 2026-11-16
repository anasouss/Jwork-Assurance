import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ProductionMultiSelect<T extends string>({ id, label, allLabel, options, value, onChange, disabled }: {
  id: string; label: string; allLabel: string; options: { value: T; label: string }[];
  value: T[]; onChange: (value: T[]) => void; disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const selectedLabels = options.filter(option => value.includes(option.value)).map(option => option.label);
  const summary = !value.length ? allLabel : value.length === 1 ? selectedLabels[0] ?? "1 sélection" : `${value.length} ${label.toLocaleLowerCase("fr")}`;
  const visible = options.filter(option => option.label.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")));
  return <Popover onOpenChange={() => setSearch("")}>
    <PopoverTrigger asChild><Button id={id} variant="outline" disabled={disabled} className="h-9 w-full min-w-0 justify-between font-normal" title={selectedLabels.join(", ") || allLabel}>
      <span className="truncate">{summary}</span><ChevronDown className="size-4 shrink-0 opacity-50" />
    </Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-56 max-w-[calc(100vw-2rem)] p-2">
      {options.length > 5 && <Input aria-label={`Rechercher : ${label}`} placeholder="Rechercher…" value={search} onChange={event => setSearch(event.target.value)} className="mb-2" />}
      <Button variant="ghost" className="mb-1 w-full justify-start text-sm" disabled={!value.length} onClick={() => onChange([])}><RotateCcw className="size-4" />{allLabel}</Button>
      <div className="max-h-64 overflow-y-auto" role="group" aria-label={label}>
        {!visible.length && <p className="p-3 text-sm text-muted-foreground">Aucun résultat.</p>}
        {visible.map(option => <label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-muted">
          <Checkbox checked={value.includes(option.value)} onCheckedChange={checked => onChange(checked ? [...value, option.value] : value.filter(item => item !== option.value))} />
          <span className="min-w-0 break-words">{option.label}</span>
        </label>)}
      </div>
    </PopoverContent>
  </Popover>;
}
