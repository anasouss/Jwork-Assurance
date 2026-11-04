import { useState } from "react";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GroupeClient } from "@/features/production/types";
import { useAuthStore } from "@/store/auth-store";
import { CreateClientGroupDialog } from "./CreateClientGroupDialog";

const CREATE_GROUP = "__CREATE_GROUP__";

export function ClientGroupSelect({ value, groups, onValueChange, disabled = false }: {
  value: string;
  groups: GroupeClient[];
  onValueChange: (value: string, group?: GroupeClient) => void;
  disabled?: boolean;
}) {
  const canCreate = useAuthStore(state => state.user?.permissions.some(permission =>
    permission === "client:create" || permission === "client:manage") ?? false);
  const [creating, setCreating] = useState(false);
  const [createdGroups, setCreatedGroups] = useState<GroupeClient[]>([]);
  const byId = new Map([...createdGroups, ...groups].map(group => [group.id, group]));
  const available = [...byId.values()].filter(group => group.actif).sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  return <>
    <Select value={value} disabled={disabled} onValueChange={next => {
      if (next === CREATE_GROUP) {
        if (canCreate) setCreating(true);
        return;
      }
      onValueChange(next, byId.get(next));
    }}>
      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="INDEPENDANT">Client indépendant</SelectItem>
        {available.map(group => <SelectItem key={group.id} value={group.id}>{group.code} - {group.libelle}</SelectItem>)}
        {canCreate && <><SelectSeparator /><SelectItem value={CREATE_GROUP}>
          <span className="inline-flex items-center gap-2"><Plus className="size-4" />Créer un groupe...</span>
        </SelectItem></>}
      </SelectContent>
    </Select>
    {canCreate && <CreateClientGroupDialog open={creating} onOpenChange={setCreating} onSaved={group => {
      setCreatedGroups(current => [...current.filter(item => item.id !== group.id), group]);
      onValueChange(group.id, group);
    }} />}
  </>;
}
