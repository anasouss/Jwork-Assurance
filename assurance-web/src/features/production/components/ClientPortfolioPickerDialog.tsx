import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { clientApi } from "../api/clients";

type ClientPortfolioPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (clientId: string) => void;
};

export function ClientPortfolioPickerDialog({ open, onOpenChange, onSelect }: ClientPortfolioPickerDialogProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [groupeId, setGroupeId] = useState("TOUS");
  const [origineId, setOrigineId] = useState("TOUTES");
  const [collaborateurId, setCollaborateurId] = useState("TOUS");
  const [page, setPage] = useState(0);

  const groupesQuery = useQuery({
    queryKey: ["groupes-clients"],
    queryFn: clientApi.listGroupesClients,
    enabled: open,
    staleTime: 60_000,
  });
  const acquisitionOptionsQuery = useQuery({
    queryKey: ["crm", "acquisition-options"],
    queryFn: clientApi.acquisitionOptions,
    enabled: open,
    staleTime: 60_000,
  });
  const clientsQuery = useQuery({
    queryKey: ["production", "portfolio-client-picker", deferredQuery, groupeId, origineId, collaborateurId, page],
    queryFn: () => clientApi.listClients({
      query: deferredQuery || undefined,
      groupeId: groupeId === "TOUS" ? undefined : groupeId,
      origineCommercialeId: origineId === "TOUTES" ? undefined : origineId,
      collaborateurId: collaborateurId === "TOUS" ? undefined : collaborateurId,
      page,
      size: 25,
    }),
    enabled: open,
    placeholderData: (previous) => previous,
  });

  const pageInfo = clientsQuery.data?.page;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>Rechercher un client</DialogTitle>
          <DialogDescription>Sélectionnez le client dont vous souhaitez ouvrir le portefeuille.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              className="pl-9"
              placeholder="Nom, code client, RC, CIN ou ICE"
              aria-label="Rechercher un client"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <Select value={groupeId} onValueChange={(value) => { setGroupeId(value); setPage(0); }}>
            <SelectTrigger className="min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TOUS">Tous les groupes</SelectItem>
              {(groupesQuery.data ?? []).map((groupe) => (
                <SelectItem key={groupe.id} value={groupe.id}>{groupe.code} - {groupe.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={origineId} onValueChange={(value) => { setOrigineId(value); setPage(0); }}>
            <SelectTrigger className="min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TOUTES">Toutes les origines</SelectItem>
              {(acquisitionOptionsQuery.data?.origines ?? []).map((origin) => (
                <SelectItem key={origin.id} value={origin.id}>{origin.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={collaborateurId} onValueChange={(value) => { setCollaborateurId(value); setPage(0); }}>
            <SelectTrigger className="min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TOUS">Tous les membres de l'équipe</SelectItem>
              {(acquisitionOptionsQuery.data?.collaborateurs ?? []).filter((user) => user.actif).map((user) => (
                <SelectItem key={user.id} value={user.id}>{user.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[55vh] min-h-80 divide-y overflow-y-auto">
          {clientsQuery.isLoading ? Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 px-4 py-3">
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            </div>
          )) : null}

          {!clientsQuery.isLoading && clientsQuery.isError ? (
            <div className="p-10 text-center text-sm text-red-700">Impossible de charger les clients.</div>
          ) : null}

          {!clientsQuery.isLoading && !clientsQuery.isError && (clientsQuery.data?.items ?? []).map((client) => (
            <button
              key={client.id}
              type="button"
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline-none dark:hover:bg-emerald-950/30"
              onClick={() => onSelect(client.id)}
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{client.nomAffichage || client.raisonSociale || client.nom || "Client sans nom"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[client.codeClient || "Sans code", client.rc || client.cin || client.ice || "Identifiant non renseigné"].join(" · ")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {client.groupe ? <Badge variant="secondary">{client.groupe.code}</Badge> : null}
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            </button>
          ))}

          {!clientsQuery.isLoading && !clientsQuery.isError && clientsQuery.data?.items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Aucun client trouvé.</div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">{pageInfo?.totalElements ?? 0} client(s)</span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Page précédente"
              disabled={pageInfo?.first ?? true}
              onClick={() => setPage(Math.max((pageInfo?.number ?? 0) - 1, 0))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Page suivante"
              disabled={pageInfo?.last ?? true}
              onClick={() => setPage((pageInfo?.number ?? 0) + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
