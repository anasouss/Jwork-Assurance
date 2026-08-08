import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Compte</th>
                <th className="px-4 py-3 text-left">Libellé</th>
                <th className="px-4 py-3 text-left">Référence</th>
                <th className="px-4 py-3 text-right">Entrée</th>
                <th className="px-4 py-3 text-right">Sortie</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {movements.isLoading ? (
                <TableRowsSkeleton colSpan={6} rows={8} />
              ) : (movements.data?.rows ?? []).map((movement) => (
                <tr key={movement.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{formatTreasuryDate(movement.dateOperation)}</td>
                  <td className="px-4 py-3 font-semibold">{movement.compteTresorerie}</td>
                  <td className="px-4 py-3">{movement.libelle}</td>
                  <td className="px-4 py-3">{movement.reference || "-"}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">
                    {movement.sens === "ENTREE" ? (
                      <span className="inline-flex items-center gap-1">
                        <ArrowDownLeft className="size-4" />
                        {formatTreasuryMoney(movement.montant)}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-red-700">
                    {movement.sens === "SORTIE" ? (
                      <span className="inline-flex items-center gap-1">
                        <ArrowUpRight className="size-4" />
                        {formatTreasuryMoney(movement.montant)}
                      </span>
                    ) : "-"}
                  </td>
                </tr>
              ))}
              {!movements.isLoading && (movements.data?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Aucun mouvement ne correspond aux filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
