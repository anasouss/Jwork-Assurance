import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import {
  formatTreasuryDate,
  formatTreasuryMoney,
  TREASURY_PAGE_SIZE,
} from "./treasury-format";

export default function JournalTresoreriePage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [accountId, setAccountId] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const movements = useQuery({
    queryKey: [
      "compta",
      "treasury",
      "movements",
      accountId,
      dateFrom,
      dateTo,
      appliedSearch,
      page,
    ],
    queryFn: () => comptaApi.treasuryJournal({
      compteId: accountId === "ALL" ? undefined : accountId,
      dateDu: dateFrom || undefined,
      dateAu: dateTo || undefined,
      search: appliedSearch || undefined,
      page,
      size: TREASURY_PAGE_SIZE,
    }),
  });

  function resetFilters() {
    setSearch("");
    setAppliedSearch("");
    setAccountId("ALL");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  return (
    <div className="grid gap-5">
      <header>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">
          Trésorerie
        </div>
        <h1 className="mt-1 text-xl font-semibold">Journal de trésorerie</h1>
        <p className="text-sm text-muted-foreground">
          Piste d’audit des entrées, sorties et extournes par compte.
        </p>
      </header>

      <section className="grid gap-3 rounded-md border bg-card p-4 lg:grid-cols-5">
        <div className="grid gap-2">
          <Label>Compte</Label>
          <Select
            value={accountId}
            onValueChange={(value) => {
              setAccountId(value);
              setPage(0);
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les comptes</SelectItem>
              {(accounts.data ?? []).map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Date du</Label>
          <DatePicker
            date={dateFrom}
            onSelect={(value) => {
              setDateFrom(toDateOnly(value) ?? "");
              setPage(0);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>Date au</Label>
          <DatePicker
            date={dateTo}
            onSelect={(value) => {
              setDateTo(toDateOnly(value) ?? "");
              setPage(0);
            }}
          />
        </div>
        <div className="grid gap-2 lg:col-span-2">
          <Label htmlFor="movement-search">Libellé, référence ou règlement</Label>
          <div className="flex gap-2">
            <Input
              id="movement-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setAppliedSearch(search.trim());
                  setPage(0);
                }
              }}
            />
            <Button
              size="icon"
              title="Rechercher"
              onClick={() => {
                setAppliedSearch(search.trim());
                setPage(0);
              }}
            >
              <Search className="size-4" />
            </Button>
            <Button size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}>
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <Table className="min-w-[950px]">
            <TableHeader className="bg-orange-600 text-xs uppercase text-white">
              <TableRow className="hover:bg-orange-600">
                <TableHead className="px-4 text-white">Date</TableHead>
                <TableHead className="px-4 text-white">Compte</TableHead>
                <TableHead className="px-4 text-white">Libellé</TableHead>
                <TableHead className="px-4 text-white">Référence</TableHead>
                <TableHead className="px-4 text-white">Opération</TableHead>
                <TableHead className="px-4 text-right text-white">Entrée</TableHead>
                <TableHead className="px-4 text-right text-white">Sortie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.isLoading ? (
                <TableRowsSkeleton colSpan={7} rows={8} />
              ) : (movements.data?.rows ?? []).map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="px-4 py-3">{formatTreasuryDate(movement.dateOperation)}</TableCell>
                  <TableCell className="px-4 py-3 font-semibold">{movement.compteTresorerie}</TableCell>
                  <TableCell className="px-4 py-3">{movement.libelle}</TableCell>
                  <TableCell className="px-4 py-3">{movement.reference || "-"}</TableCell>
                  <TableCell className="px-4 py-3">{movement.numeroOperationTresorerie || "-"}</TableCell>
                  <TableCell className="px-4 py-3 text-right text-emerald-700">
                    {movement.sens === "ENTREE" ? (
                      <span className="inline-flex items-center gap-1">
                        <ArrowDownLeft className="size-4" />
                        {formatTreasuryMoney(movement.montant)}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-red-700">
                    {movement.sens === "SORTIE" ? (
                      <span className="inline-flex items-center gap-1">
                        <ArrowUpRight className="size-4" />
                        {formatTreasuryMoney(movement.montant)}
                      </span>
                    ) : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {!movements.isLoading && (movements.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Aucun mouvement ne correspond aux filtres.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
        </Table>
        {movements.data && (
          <ServerPagination
            page={movements.data.page.number}
            totalPages={movements.data.page.totalPages}
            totalElements={movements.data.page.totalElements}
            loading={movements.isFetching}
            onPageChange={setPage}
          />
        )}
      </section>
    </div>
  );
}
