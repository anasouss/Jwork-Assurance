import { useRef, useState } from "react";
import { Info, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PermissionDetailsDialog } from "./PermissionDetailsDialog";
import type { AdminPermission } from "../types";

type Props = {
  module: string;
  resources: readonly (readonly [string, readonly AdminPermission[]])[];
  catalogue: AdminPermission[];
  selectedIds: string[];
  editable: boolean;
  onToggle: (permission: AdminPermission, checked: boolean) => void;
  onToggleMany: (permissions: AdminPermission[], checked: boolean) => void;
};

const mainProductionResources = ["contrat", "avenant", "assistance", "carte-verte", "piece-jointe", "attestation-stock", "vehicule"];
const standardActions = ["view", "create", "update"];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function RolePermissionMatrix({ module, resources, catalogue, selectedIds, editable, onToggle, onToggleMany }: Props) {
  const [detailPermission, setDetailPermission] = useState<AdminPermission>();
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const term = normalize(search);
  const filtered = resources.map(([resource, items]) => [resource, items.filter(permission => {
    const matchesSearch = !term || normalize(`${permission.resourceLabel ?? resource} ${permission.actionLabel ?? permission.nom} ${permission.code}`).includes(term);
    return matchesSearch && (!selectedOnly || selectedIds.includes(permission.id));
  })] as const).filter(([, items]) => items.length > 0);
  const visible = filtered.flatMap(([, items]) => items);
  const assignable = visible.filter(permission => permission.assignable !== false);
  const selectedCount = assignable.filter(permission => selectedIds.includes(permission.id)).length;
  const allSelected = assignable.length > 0 && selectedCount === assignable.length;
  const sections = module === "production" ? [
    { title: "Gestion des dossiers", rows: filtered.filter(([resource]) => mainProductionResources.includes(resource))
      .sort(([left], [right]) => mainProductionResources.indexOf(left) - mainProductionResources.indexOf(right)) },
    { title: "Paramétrage", rows: filtered.filter(([resource]) => !mainProductionResources.includes(resource)) },
  ] : [{ title: undefined, rows: filtered }];

  function checkbox(permission: AdminPermission, compact = false) {
    const action = permission.actionLabel ?? permission.nom;
    const label = `${permission.resourceLabel ?? permission.resource} : ${action}`;
    return <div key={permission.id} className={compact ? "flex min-h-8 items-center justify-center gap-1" : "flex min-h-8 items-center gap-1.5"}>
      <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm has-[:disabled]:cursor-default">
        <Checkbox aria-label={label} disabled={!editable || permission.assignable === false}
          checked={selectedIds.includes(permission.id)} onCheckedChange={checked => onToggle(permission, checked === true)} />
        {!compact && <span className="break-words leading-5">{action}</span>}
      </label>
        <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0 text-muted-foreground" aria-label={`Détails : ${label}`} title="Comprendre cette permission"
          aria-haspopup="dialog" onClick={event => { detailTriggerRef.current = event.currentTarget; setDetailPermission(permission); }}>
          <Info className="size-3.5" />
        </Button>
    </div>;
  }

  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-3 border-y py-3">
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Rechercher une permission" placeholder="Rechercher une page ou une action" value={search} onChange={event => setSearch(event.target.value)} className="pl-9 pr-9" />
        {search && <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1/2 size-7 -translate-y-1/2" aria-label="Effacer la recherche" onClick={() => setSearch("")}><X className="size-4" /></Button>}
      </div>
      <label className="flex min-h-9 items-center gap-2 text-sm"><Checkbox checked={selectedOnly} onCheckedChange={checked => setSelectedOnly(checked === true)} />Sélectionnées uniquement</label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{visible.length} autorisation(s) affichée(s)</span>
      <label className="flex min-h-8 items-center gap-2 font-medium"><Checkbox
        disabled={!editable || assignable.length === 0} checked={allSelected ? true : selectedCount > 0 ? "indeterminate" : false}
        onCheckedChange={checked => onToggleMany(assignable, checked === true)} />
        {term || selectedOnly ? "Tout sélectionner dans les résultats" : "Tout autoriser"}
      </label>
    </div>
    {sections.filter(section => section.rows.length > 0).map(section => <section key={section.title ?? module} className="min-w-0 space-y-2">
      {section.title && <h4 className="pt-2 text-sm font-semibold">{section.title}</h4>}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[680px] table-fixed text-sm">
          <colgroup><col className="w-[24%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[40%]" /></colgroup>
          <thead className="border-b bg-muted/50"><tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">Page / rubrique</th>
            <th scope="col" className="px-2 py-2 text-center font-medium">Consulter</th>
            <th scope="col" className="px-2 py-2 text-center font-medium">Créer</th>
            <th scope="col" className="px-2 py-2 text-center font-medium">Modifier</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Autres actions</th>
          </tr></thead>
          <tbody className="divide-y">{section.rows.map(([resource, items]) => <tr key={resource} className="hover:bg-muted/20">
            <th scope="row" className="break-words px-3 py-2 text-left align-top font-medium">{items[0]?.resourceLabel ?? resource}</th>
            {standardActions.map(action => <td key={action} className="px-2 py-2 align-top text-center">
              {items.find(permission => (permission.action ?? permission.code.split(":")[1]) === action)
                ? checkbox(items.find(permission => (permission.action ?? permission.code.split(":")[1]) === action)!, true)
                : <span className="inline-flex min-h-8 items-center text-muted-foreground">-</span>}
            </td>)}
            <td className="px-3 py-2 align-top"><div className="flex flex-wrap gap-x-4 gap-y-1">
              {items.filter(permission => !standardActions.includes(permission.action ?? permission.code.split(":")[1])).map(permission => checkbox(permission))}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>)}
    {visible.length === 0 && <p className="border-y px-3 py-8 text-center text-sm text-muted-foreground">Aucune autorisation ne correspond aux filtres.</p>}
    <PermissionDetailsDialog permission={detailPermission} catalogue={catalogue} triggerRef={detailTriggerRef} onClose={() => setDetailPermission(undefined)} />
  </div>;
}
