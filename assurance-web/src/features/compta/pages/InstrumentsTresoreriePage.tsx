import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, Plus, RotateCcw, Search } from "lucide-react";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { RemittanceSlipStatus, RemittanceSlipType } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, TREASURY_PAGE_SIZE } from "./treasury-format";

type TypeFilter = RemittanceSlipType | "ALL";
type StatusFilter = RemittanceSlipStatus | "ALL";

const TYPE_LABELS: Record<RemittanceSlipType, string> = {
  CHEQUE: "Chèques",
  EFFET: "Effets",
  VERSEMENT_ESPECES: "Versement d’espèces",
};

const STATUS_LABELS: Record<RemittanceSlipStatus, string> = {
  BROUILLON: "Provisoire",
  DEPOSE: "Remis à la banque",
  PARTIELLEMENT_TRAITE: "Partiellement traité",
  CLOTURE: "Clôturé",
  ANNULE: "Annulé",
};

export default function InstrumentsTresoreriePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const type = parseTypeFilter(searchParams.get("type"));
  const status = parseStatusFilter(searchParams.get("statut"));
  const appliedSearch = searchParams.get("search") ?? "";
  const dateFrom = parseDateFilter(searchParams.get("dateDu"));
  const dateTo = parseDateFilter(searchParams.get("dateAu"));
  const page = parsePage(searchParams.get("page"));
  const [search, setSearch] = useState(appliedSearch);

  useEffect(() => {
    setSearch(appliedSearch);
  }, [appliedSearch]);
  const slips = useQuery({
    queryKey: ["compta", "treasury", "remittance-slips", type, status, appliedSearch, dateFrom, dateTo, page],
    queryFn: () => comptaApi.remittanceSlips({
      type: type === "ALL" ? undefined : type,
      statut: status === "ALL" ? undefined : status,
      search: appliedSearch || undefined,
      dateDu: dateFrom || undefined,
      dateAu: dateTo || undefined,
      page,
      size: TREASURY_PAGE_SIZE,
    }),
  });

  function applyFilters() {
    updateFilter("search", search.trim());
  }

  function resetFilters() {
    setSearch("");
    setSearchParams({}, { replace: true });
  }

  function updateFilter(name: string, value: string, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "ALL" || (name === "page" && value === "0")) next.delete(name);
    else next.set(name, value);
    if (resetPage) next.delete("page");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">Bordereaux bancaires</h1>
          <p className="text-sm text-muted-foreground">Suivi des remises de chèques, effets et versements d’espèces.</p>
        </div>
        {canManage ? <Button asChild>
          <Link to="/app/compta/tresorerie/bordereaux-remise/nouveau"><Plus className="size-4" /> Nouveau bordereau</Link>
        </Button> : <Button disabled><Plus className="size-4" /> Nouveau bordereau</Button>}
      </header>

      <section className="grid gap-3 rounded-md border bg-card p-4 xl:grid-cols-[190px_210px_1fr_170px_170px_auto]">
        <div className="grid gap-2"><Label>Type</Label><Select value={type} onValueChange={(value) => updateFilter("type", value)}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">Tous les types</SelectItem><SelectItem value="CHEQUE">Chèques</SelectItem>
            <SelectItem value="EFFET">Effets</SelectItem><SelectItem value="VERSEMENT_ESPECES">Versements d’espèces</SelectItem>
          </SelectContent>
        </Select></div>
        <div className="grid gap-2"><Label>Statut</Label><Select value={status} onValueChange={(value) => updateFilter("statut", value)}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem><SelectItem value="BROUILLON">Provisoires</SelectItem>
            <SelectItem value="DEPOSE">Remis à la banque</SelectItem><SelectItem value="PARTIELLEMENT_TRAITE">Partiellement traités</SelectItem>
            <SelectItem value="CLOTURE">Clôturés</SelectItem><SelectItem value="ANNULE">Annulés</SelectItem>
          </SelectContent>
        </Select></div>
        <div className="grid gap-2"><Label htmlFor="slip-search">Réf. interne, n° banque ou compte</Label><Input id="slip-search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyFilters()} /></div>
        <div className="grid gap-2"><Label>Date du</Label><DatePicker date={dateFrom} onSelect={(value) => updateFilter("dateDu", toDateOnly(value) ?? "")} /></div>
        <div className="grid gap-2"><Label>Date au</Label><DatePicker date={dateTo} onSelect={(value) => updateFilter("dateAu", toDateOnly(value) ?? "")} /></div>
        <div className="flex items-end gap-2"><Button size="icon" title="Rechercher" onClick={applyFilters}><Search className="size-4" /></Button><Button size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}><RotateCcw className="size-4" /></Button></div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Tous les bordereaux</h2><p className="text-sm text-muted-foreground">Ouvrez un bordereau pour enregistrer sa remise ou le résultat de ses instruments.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
            <th className="px-4 py-3 text-left">Réf. interne</th><th className="px-4 py-3 text-left">N° banque</th><th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Remis le</th>
            <th className="px-4 py-3 text-left">Destination</th><th className="px-4 py-3 text-center">Instruments</th>
            <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Statut</th><th className="w-16 px-4 py-3"><span className="sr-only">Détail</span></th>
          </tr></thead>
          <tbody className="divide-y">
            {slips.isLoading ? <TableRowsSkeleton colSpan={10} rows={6} /> : (slips.data?.rows ?? []).map((slip) => <tr key={slip.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">{slip.numero}</td><td className="px-4 py-3">{slip.referenceBancaire || "-"}</td><td className="px-4 py-3">{TYPE_LABELS[slip.type]}</td>
              <td className="px-4 py-3">{formatTreasuryDate(slip.dateBordereau)}</td><td className="px-4 py-3">{formatTreasuryDate(slip.dateDepot)}</td>
              <td className="px-4 py-3">{slip.compteDestination}</td><td className="px-4 py-3 text-center">{slip.type === "VERSEMENT_ESPECES" ? "-" : slip.nombreLignes}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(slip.montantTotal)}</td><td className="px-4 py-3"><StatusBadge status={slip.statut} /></td>
              <td className="px-4 py-3"><Button asChild size="icon" variant="ghost" title="Voir le bordereau"><Link to={`/app/compta/tresorerie/bordereaux-remise/${slip.id}`}><Eye className="size-4" /></Link></Button></td>
            </tr>)}
            {!slips.isLoading && (slips.data?.rows.length ?? 0) === 0 && <tr><td colSpan={10} className="px-4 py-14 text-center text-muted-foreground">Aucun bordereau ne correspond aux filtres.</td></tr>}
          </tbody>
        </table></div>
        {slips.data && <ServerPagination page={slips.data.page.number} totalPages={slips.data.page.totalPages} totalElements={slips.data.page.totalElements} loading={slips.isFetching} onPageChange={(nextPage) => updateFilter("page", String(nextPage), false)} />}
      </section>

    </div>
  );
}

function parseTypeFilter(value: string | null): TypeFilter {
  return value === "CHEQUE" || value === "EFFET" || value === "VERSEMENT_ESPECES" ? value : "ALL";
}

function parseStatusFilter(value: string | null): StatusFilter {
  return value === "BROUILLON"
    || value === "DEPOSE"
    || value === "PARTIELLEMENT_TRAITE"
    || value === "CLOTURE"
    || value === "ANNULE"
    ? value
    : "ALL";
}

function parseDateFilter(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function StatusBadge({ status }: { status: RemittanceSlipStatus }) {
  const className = {
    BROUILLON: "bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200",
    DEPOSE: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200",
    PARTIELLEMENT_TRAITE: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200",
    CLOTURE: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200",
    ANNULE: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200",
  }[status];
  return <Badge className={className}>{STATUS_LABELS[status]}</Badge>;
}
