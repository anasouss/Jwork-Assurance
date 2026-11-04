import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { clientApi } from "@/features/production/api/clients";
import { Field } from "@/features/production/components/Field";
import type { GroupeClient } from "@/features/production/types";
import { useAuthStore } from "@/store/auth-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (group: GroupeClient) => void | Promise<void>;
};

export function CreateClientGroupDialog(props: Props) {
  return props.open ? <CreateClientGroupForm {...props} /> : null;
}

function CreateClientGroupForm({ open, onOpenChange, onSaved }: Props) {
  const queryClient = useQueryClient();
  const canSearchClients = useAuthStore(state => state.user?.permissions.some(permission =>
    permission === "client:view" || permission === "contrat:create" || permission === "contrat:update") ?? false);
  const [code, setCode] = useState("");
  const [libelle, setLibelle] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const deferredSearch = useDeferredValue(clientSearch.trim());
  const [clientTeteId, setClientTeteId] = useState("");
  const [clientTresorerieId, setClientTresorerieId] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, { value: string; label: string; keywords: string }>>({});
  const [consolidated, setConsolidated] = useState(false);
  const clientsQuery = useQuery({
    queryKey: ["clients", "group-responsible-search", deferredSearch],
    queryFn: () => clientApi.listClients({ query: deferredSearch, size: 25 }),
    enabled: open && canSearchClients && deferredSearch.length >= 2,
  });
  const remoteOptions = (clientsQuery.data?.items ?? []).map(client => ({
    value: client.id, label: client.nomAffichage ?? client.id,
    keywords: [client.rc, client.cin, client.ice].filter(Boolean).join(" "),
  }));
  const byId = new Map(Object.values(selectedOptions).map(option => [option.value, option]));
  remoteOptions.forEach(option => byId.set(option.value, option));
  const options = [...byId.values()];
  const selectResponsible = (value: string, setter: (next: string) => void) => {
    setter(value);
    const option = remoteOptions.find(item => item.value === value);
    if (option) setSelectedOptions(current => ({ ...current, [value]: option }));
  };
  const create = useMutation({
    mutationFn: clientApi.createGroupeClient,
    onSuccess: async group => {
      queryClient.setQueryData<GroupeClient[]>(["groupes-clients"], current =>
        [...(current ?? []).filter(item => item.id !== group.id), group].sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")));
      await onSaved?.(group);
      void queryClient.invalidateQueries({ queryKey: ["groupes-clients"] });
      toast.success("Groupe client créé");
      onOpenChange(false);
    },
    onError: error => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });
  return <Dialog open={open} onOpenChange={next => { if (!create.isPending) onOpenChange(next); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Nouveau groupe client</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" required><Input value={code} disabled={create.isPending} onChange={event => setCode(event.target.value)} /></Field>
        <Field label="Nom du groupe" required><Input value={libelle} disabled={create.isPending} onChange={event => setLibelle(event.target.value)} /></Field>
        {canSearchClients && <><Field label="Tête de groupe"><AutocompleteSelect value={clientTeteId} disabled={create.isPending}
          onValueChange={value => selectResponsible(value, setClientTeteId)} onQueryChange={setClientSearch}
          options={options} placeholder="RC, CIN ou nom" /></Field>
        <Field label="Entité responsable des paiements"><AutocompleteSelect value={clientTresorerieId} disabled={create.isPending}
          onValueChange={value => selectResponsible(value, setClientTresorerieId)} onQueryChange={setClientSearch}
          options={options} placeholder="RC, CIN ou nom" /></Field></>}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Checkbox checked={consolidated} disabled={create.isPending} onCheckedChange={checked => setConsolidated(checked === true)} />
          Facturation consolidée par défaut
        </label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={create.isPending} onClick={() => onOpenChange(false)}>Annuler</Button>
        <Button type="button" disabled={!code.trim() || !libelle.trim() || create.isPending}
          onClick={() => create.mutate({ code: code.trim(), libelle: libelle.trim(), clientTeteId: clientTeteId || undefined,
            clientTresorerieId: clientTresorerieId || undefined, facturationConsolideeDefaut: consolidated, actif: true })}>
          <Save className="size-4" />{create.isPending ? "Enregistrement..." : "Créer le groupe"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
