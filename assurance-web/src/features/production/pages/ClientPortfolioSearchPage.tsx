import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clientApi } from "../api/clients";
import type { ClientResponse } from "../types";

const PAGE_SIZE = 25;

export default function ClientPortfolioSearchPage() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(0);

  const clientsQuery = useQuery({
    queryKey: ["production", "client-portfolios", appliedQuery, page],
    queryFn: () => clientApi.listClients({ query: appliedQuery, page, size: PAGE_SIZE }),
    enabled: Boolean(appliedQuery),
    placeholderData: (previous) => previous,
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    setPage(0);
    setAppliedQuery(nextQuery);
  }

  function resetSearch() {
    setQuery("");
    setAppliedQuery("");
    setPage(0);
  }

  const clients = clientsQuery.data?.items ?? [];

  return (
    <div className="grid min-w-0 gap-4">
      <header>
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Production</p>
        <h1 className="mt-1 text-xl font-semibold">Portefeuille clients</h1>
        <p className="text-sm text-muted-foreground">
          Recherchez un client pour consulter ses informations et ses contrats.
        </p>
      </header>

      <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <div className="border-b bg-muted/30 px-5 py-4">
          <h2 className="font-semibold">Rechercher un client</h2>
          <p className="text-sm text-muted-foreground">Nom, code client, CIN, RC ou ICE.</p>
        </div>
        <form className="flex flex-col gap-3 p-5 sm:flex-row" onSubmit={submitSearch}>
          <div className="relative max-w-2xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              className="pl-9"
              placeholder="Saisir le nom ou l'identifiant du client"
              aria-label="Rechercher un client"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={!query.trim()}>
            <Search className="size-4" />
            Rechercher
          </Button>
          {appliedQuery ? (
            <Button type="button" variant="outline" onClick={resetSearch}>
              <X className="size-4" />
              Effacer
            </Button>
          ) : null}
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Clients</h2>
            <p className="text-sm text-muted-foreground">
              {appliedQuery ? `${clientsQuery.data?.page.totalElements ?? 0} résultat(s)` : "Lancez une recherche pour afficher les clients."}
            </p>
          </div>
          <Users className="size-5 text-emerald-700" />
        </div>

        {!appliedQuery ? (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">
            Aucun résultat à afficher avant la recherche.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader className="bg-emerald-700 text-white">
                <TableRow className="hover:bg-emerald-700">
                  <TableHead className="px-4 text-white">Client</TableHead>
                  <TableHead className="text-white">Identifiant</TableHead>
                  <TableHead className="text-white">Type</TableHead>
                  <TableHead className="text-white">Ville</TableHead>
                  <TableHead className="text-white">Téléphone</TableHead>
                  <TableHead className="text-white">Groupe</TableHead>
                  <TableHead className="w-28 text-right text-white">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsQuery.isLoading ? <TableRowsSkeleton rows={5} colSpan={7} /> : null}
                {!clientsQuery.isLoading && clients.map((client) => (
                  <ClientRow key={client.id} client={client} />
                ))}
              </TableBody>
            </Table>
            {!clientsQuery.isLoading && clients.length === 0 ? (
              <div className="px-5 py-14 text-center text-sm text-muted-foreground">
                {clientsQuery.isError
                  ? "Impossible de charger les clients. Vérifiez la recherche puis réessayez."
                  : "Aucun client ne correspond à cette recherche."}
              </div>
            ) : null}
            <ServerPagination
              className="border-t px-5 py-3"
              page={clientsQuery.data?.page.number ?? page}
              totalPages={clientsQuery.data?.page.totalPages ?? 1}
              totalElements={clientsQuery.data?.page.totalElements ?? 0}
              loading={clientsQuery.isFetching}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

function ClientRow({ client }: { client: ClientResponse }) {
  return (
    <TableRow>
      <TableCell className="px-4">
        <div className="font-medium">{client.nomAffichage || client.raisonSociale || client.nom || "-"}</div>
        <div className="text-xs text-muted-foreground">{client.codeClient || "Sans code client"}</div>
      </TableCell>
      <TableCell>{primaryIdentifier(client)}</TableCell>
      <TableCell>{client.typeClient === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique"}</TableCell>
      <TableCell>{client.ville || "-"}</TableCell>
      <TableCell>{client.telephone || client.telephones?.find((item) => item.principal)?.numero || "-"}</TableCell>
      <TableCell>
        {client.groupe ? <Badge variant="secondary">{client.groupe.code}</Badge> : "-"}
      </TableCell>
      <TableCell className="text-right">
        <Button asChild size="sm" variant="outline">
          <Link to={`/app/production/portefeuille-clients/${client.id}`}>
            Ouvrir
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function primaryIdentifier(client: ClientResponse) {
  if (client.ice) return `ICE ${client.ice}`;
  if (client.rc) return `RC ${client.rc}`;
  if (client.cin) return `CIN ${client.cin}`;
  return "-";
}
