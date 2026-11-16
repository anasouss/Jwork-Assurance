import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProviderAgreement, ProviderReference } from "../types";

export function ProviderAgreementUsageSelect({ agreement, options, disabled, onChange }: {
  agreement: ProviderAgreement;
  options: ProviderReference[];
  disabled: boolean;
  onChange: (patch: Partial<ProviderAgreement>) => void;
}) {
  const [search, setSearch] = useState("");
  const available = [...options, ...agreement.usages.filter(u => !options.some(option => option.id === u.id))];
  const filtered = available.filter(u => u.libelle.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr")));
  const invalid = !agreement.tousUsages && !agreement.usages.length;
  const summary = agreement.tousUsages ? "Tous les usages" : agreement.usages.length === 1
    ? agreement.usages[0].libelle : agreement.usages.length ? `${agreement.usages.length} usages` : "Sélectionner";

  return <Popover onOpenChange={open => { if (!open) setSearch(""); }}>
    <PopoverTrigger asChild><Button type="button" variant="outline" disabled={disabled}
      aria-label={`Usages autorisés : ${summary}`} aria-invalid={invalid}
      title={agreement.tousUsages ? summary : agreement.usages.map(u => u.libelle).join(", ") || "Sélectionnez au moins un usage"}
      className={`h-9 w-full min-w-0 justify-between gap-2 px-2 font-normal ${invalid ? "border-destructive" : ""}`}>
      <span className="truncate">{summary}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </Button></PopoverTrigger>
    <PopoverContent align="start" className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0">
      <div className="shrink-0 border-b p-3"><Input aria-label="Rechercher un usage" placeholder="Rechercher un usage" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <label className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5 text-sm font-medium">
        <Checkbox disabled={disabled} checked={agreement.tousUsages} onCheckedChange={value => onChange({ tousUsages: value === true, usages: value === true ? [] : agreement.usages })} />Tous les usages
      </label>
      <div className="max-h-56 min-h-0 overflow-y-auto p-1">
        {filtered.map(usage => <label key={usage.id} className={`flex items-start gap-2 rounded px-2 py-2 text-sm ${agreement.tousUsages ? "text-muted-foreground" : "hover:bg-muted"}`}>
          <Checkbox disabled={disabled || agreement.tousUsages} checked={agreement.tousUsages || agreement.usages.some(u => u.id === usage.id)}
            onCheckedChange={value => onChange({ usages: value === true ? [...agreement.usages, usage] : agreement.usages.filter(u => u.id !== usage.id) })} />
          <span className="min-w-0 break-words">{usage.libelle}{!options.some(u => u.id === usage.id) ? " (inactif)" : ""}</span>
        </label>)}
        {!filtered.length && <p className="px-2 py-4 text-sm text-muted-foreground">Aucun usage trouvé.</p>}
      </div>
    </PopoverContent>
  </Popover>;
}
