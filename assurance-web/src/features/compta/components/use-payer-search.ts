import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AutocompleteOption } from "@/components/ui/autocomplete-select";
import { clientApi } from "@/features/production/api/clients";

export type PayerType = "CLIENT" | "GROUPE";

export type PayerSelection = {
  type: PayerType;
  id: string;
  name: string;
  identifier: string;
  groupName?: string;
  treasuryName?: string;
  memberCount?: number;
};

export function usePayerSearch(type?: PayerType, selected?: PayerSelection) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());

  const clients = useQuery({
    queryKey: ["compta", "payer-search", "clients", deferredQuery],
    queryFn: () => clientApi.listClients({
      query: deferredQuery || undefined,
      page: 0,
      size: 30,
    }),
    enabled: type === "CLIENT",
    staleTime: 30_000,
  });
  const groups = useQuery({
    queryKey: ["compta", "payer-search", "groups"],
    queryFn: clientApi.listGroupesClients,
    enabled: type === "GROUPE",
    staleTime: 60_000,
  });
  const clientRows = useMemo(() => clients.data?.items ?? [], [clients.data?.items]);
  const groupRows = useMemo(() => groups.data ?? [], [groups.data]);

  const options = useMemo<AutocompleteOption[]>(() => {
    const selectedPayer = selected?.type === type ? selected : undefined;
    const available = type === "CLIENT"
      ? clientRows.map((client) => ({
        value: client.id,
        label: [
          client.nomAffichage || "Client",
          client.codeClient || client.rc || client.cin || client.ice,
        ].filter(Boolean).join(" · "),
        keywords: [client.codeClient, client.rc, client.cin, client.ice, client.email]
          .filter(Boolean)
          .join(" "),
      }))
      : groupRows.map((group) => ({
        value: group.id,
        label: `${group.code} · ${group.libelle}`,
        keywords: [
          group.clientTeteNom,
          group.clientTresorerieNom,
          ...group.membres.map((member) => member.clientNom),
        ].filter(Boolean).join(" "),
      }));

    if (selectedPayer && !available.some((option) => option.value === selectedPayer.id)) {
      available.unshift({
        value: selectedPayer.id,
        label: payerLabel(selectedPayer),
        keywords: [selectedPayer.identifier, selectedPayer.groupName, selectedPayer.treasuryName]
          .filter(Boolean)
          .join(" "),
      });
    }
    return available;
  }, [clientRows, groupRows, selected, type]);

  function resolve(value: string): PayerSelection | undefined {
    if (!value || !type) return undefined;
    if (selected?.type === type && selected.id === value) return selected;

    if (type === "CLIENT") {
      const client = clientRows.find((item) => item.id === value);
      if (!client) return undefined;
      return {
        type,
        id: client.id,
        name: client.nomAffichage || "Client",
        identifier: client.codeClient || client.rc || client.cin || client.ice || "",
        groupName: client.groupe?.libelle || undefined,
      };
    }

    const group = groupRows.find((item) => item.id === value);
    if (!group) return undefined;
    return {
      type,
      id: group.id,
      name: group.libelle,
      identifier: group.code,
      treasuryName: group.clientTresorerieNom || undefined,
      memberCount: group.membres.length,
    };
  }

  return {
    clients: clientRows,
    groups: groupRows,
    loading: clients.isFetching || groups.isFetching,
    options,
    resolve,
    setQuery,
    clearQuery: () => setQuery(""),
  };
}

function payerLabel(payer: PayerSelection) {
  return [payer.identifier, payer.name].filter(Boolean).join(" · ");
}
