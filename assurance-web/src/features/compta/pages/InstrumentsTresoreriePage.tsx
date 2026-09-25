import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Eye, Landmark, Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateOnly } from "@/features/production/date";
import { MoneyInput } from "@/features/production/components/MoneyInput";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { RemittanceSlipStatus, RemittanceSlipType } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, TODAY, TREASURY_PAGE_SIZE } from "./treasury-format";

type TypeFilter = RemittanceSlipType | "ALL";
type StatusFilter = RemittanceSlipStatus | "ALL";

const TYPE_LABELS: Record<RemittanceSlipType, string> = {
  CHEQUE: "Chèques",
  EFFET: "Effets",
  VERSEMENT_ESPECES: "Versement d’espèces",
};

const STATUS_LABELS: Record<RemittanceSlipStatus, string> = {
  BROUILLON: "Brouillon",
  DEPOSE: "Déposé",
  PARTIELLEMENT_TRAITE: "Partiellement traité",
  CLOTURE: "Clôturé",
  ANNULE: "Annulé",
};

export default function InstrumentsTresoreriePage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const queryClient = useQueryClient();
  const [type, setType] = useState<TypeFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [cashOpen, setCashOpen] = useState(false);
  const [cashSourceId, setCashSourceId] = useState("");
  const [cashDestinationId, setCashDestinationId] = useState("");
  const [cashAmount, setCashAmount] = useState<number>();
  const [cashDate, setCashDate] = useState(TODAY);
  const [cashReference, setCashReference] = useState("");

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
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

  const bankAccounts = (accounts.data ?? []).filter((account) => account.actif && account.typeCompte === "BANQUE");
  const cashAccounts = (accounts.data ?? []).filter((account) => account.actif && account.typeCompte === "CAISSE");

  const createCashSlip = useMutation({
    mutationFn: () => comptaApi.createCashRemittance({
      type: "VERSEMENT_ESPECES",
      dateBordereau: cashDate,
      compteSourceId: cashSourceId,
      compteDestinationId: cashDestinationId,
      montantEspeces: cashAmount,
      referenceBancaire: cashReference.trim() || undefined,
      instrumentIds: [],
    }),
    onSuccess: async (created) => {
      toast.success(`${created.numero} enregistré`);
      closeCashDialog();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
      ]);
    },
    onError: showError,
  });

  function applyFilters() {
    setAppliedSearch(search.trim());
    setPage(0);
  }

  function resetFilters() {
    setType("ALL");
    setStatus("ALL");
    setSearch("");
    setAppliedSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  function closeCashDialog() {
    setCashOpen(false);
    setCashSourceId("");
    setCashDestinationId("");
    setCashAmount(undefined);
    setCashReference("");
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">Bordereaux de remise</h1>
          <p className="text-sm text-muted-foreground">Suivi des remises de chèques, effets et versements d’espèces.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCashOpen(true)} disabled={!canManage}>
            <Banknote className="size-4" /> Versement d’espèces
          </Button>
          {canManage ? <Button asChild>
            <Link to="/app/compta/tresorerie/bordereaux-remise/nouveau"><Plus className="size-4" /> Nouveau bordereau</Link>
          </Button> : <Button disabled><Plus className="size-4" /> Nouveau bordereau</Button>}
        </div>
      </header>

      <section className="grid gap-3 rounded-md border bg-card p-4 xl:grid-cols-[190px_210px_1fr_170px_170px_auto]">
        <div className="grid gap-2"><Label>Type</Label><Select value={type} onValueChange={(value) => { setType(value as TypeFilter); setPage(0); }}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">Tous les types</SelectItem><SelectItem value="CHEQUE">Chèques</SelectItem>
            <SelectItem value="EFFET">Effets</SelectItem><SelectItem value="VERSEMENT_ESPECES">Versements d’espèces</SelectItem>
          </SelectContent>
        </Select></div>
        <div className="grid gap-2"><Label>Statut</Label><Select value={status} onValueChange={(value) => { setStatus(value as StatusFilter); setPage(0); }}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem><SelectItem value="BROUILLON">Brouillons</SelectItem>
            <SelectItem value="DEPOSE">Déposés</SelectItem><SelectItem value="PARTIELLEMENT_TRAITE">Partiellement traités</SelectItem>
            <SelectItem value="CLOTURE">Clôturés</SelectItem><SelectItem value="ANNULE">Annulés</SelectItem>
          </SelectContent>
        </Select></div>
        <div className="grid gap-2"><Label htmlFor="slip-search">N° bordereau, référence ou banque</Label><Input id="slip-search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyFilters()} /></div>
        <div className="grid gap-2"><Label>Date du</Label><DatePicker date={dateFrom} onSelect={(value) => setDateFrom(toDateOnly(value) ?? "")} /></div>
        <div className="grid gap-2"><Label>Date au</Label><DatePicker date={dateTo} onSelect={(value) => setDateTo(toDateOnly(value) ?? "")} /></div>
        <div className="flex items-end gap-2"><Button size="icon" title="Rechercher" onClick={applyFilters}><Search className="size-4" /></Button><Button size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}><RotateCcw className="size-4" /></Button></div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Tous les bordereaux</h2><p className="text-sm text-muted-foreground">Ouvrez un bordereau pour enregistrer son dépôt ou le résultat de ses instruments.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
            <th className="px-4 py-3 text-left">N° bordereau</th><th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Dépôt</th>
            <th className="px-4 py-3 text-left">Destination</th><th className="px-4 py-3 text-center">Instruments</th>
            <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Statut</th><th className="w-16 px-4 py-3"><span className="sr-only">Détail</span></th>
          </tr></thead>
          <tbody className="divide-y">
            {slips.isLoading ? <TableRowsSkeleton colSpan={9} rows={6} /> : (slips.data?.rows ?? []).map((slip) => <tr key={slip.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">{slip.numero}</td><td className="px-4 py-3">{TYPE_LABELS[slip.type]}</td>
              <td className="px-4 py-3">{formatTreasuryDate(slip.dateBordereau)}</td><td className="px-4 py-3">{formatTreasuryDate(slip.dateDepot)}</td>
              <td className="px-4 py-3">{slip.compteDestination}</td><td className="px-4 py-3 text-center">{slip.type === "VERSEMENT_ESPECES" ? "-" : slip.nombreLignes}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(slip.montantTotal)}</td><td className="px-4 py-3"><StatusBadge status={slip.statut} /></td>
              <td className="px-4 py-3"><Button asChild size="icon" variant="ghost" title="Voir le bordereau"><Link to={`/app/compta/tresorerie/bordereaux-remise/${slip.id}`}><Eye className="size-4" /></Link></Button></td>
            </tr>)}
            {!slips.isLoading && (slips.data?.rows.length ?? 0) === 0 && <tr><td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">Aucun bordereau ne correspond aux filtres.</td></tr>}
          </tbody>
        </table></div>
        {slips.data && <ServerPagination page={slips.data.page.number} totalPages={slips.data.page.totalPages} totalElements={slips.data.page.totalElements} loading={slips.isFetching} onPageChange={setPage} />}
      </section>

      <Dialog open={cashOpen} onOpenChange={(open) => open ? setCashOpen(true) : closeCashDialog()}>
        <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Versement d’espèces</DialogTitle><DialogDescription>Transférez un montant d’une caisse vers un compte bancaire.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label>Caisse source</Label><Select value={cashSourceId} onValueChange={setCashSourceId}><SelectTrigger><SelectValue placeholder="Choisir une caisse" /></SelectTrigger><SelectContent>{cashAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Compte bancaire</Label><Select value={cashDestinationId} onValueChange={setCashDestinationId}><SelectTrigger><SelectValue placeholder="Choisir une banque" /></SelectTrigger><SelectContent>{bankAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label htmlFor="cash-amount">Montant</Label><MoneyInput id="cash-amount" value={cashAmount} onValueChange={setCashAmount} /></div>
            <div className="grid gap-2"><Label>Date de versement</Label><DatePicker date={cashDate} onSelect={(value) => setCashDate(toDateOnly(value) ?? "")} /></div>
            <div className="grid gap-2 sm:col-span-2"><Label htmlFor="cash-reference">Référence bancaire</Label><Input id="cash-reference" value={cashReference} onChange={(event) => setCashReference(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={closeCashDialog}>Annuler</Button><Button onClick={() => createCashSlip.mutate()} disabled={!cashSourceId || !cashDestinationId || !cashAmount || cashAmount <= 0 || createCashSlip.isPending}><Landmark className="size-4" /> Enregistrer le versement</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
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

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
