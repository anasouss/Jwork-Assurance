import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { Banknote, Eye, Landmark, Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { RemittanceSlipStatus, RemittanceSlipType } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY, TREASURY_PAGE_SIZE } from "./treasury-format";

type InstrumentSlipType = "CHEQUE" | "EFFET";

const TYPE_LABELS: Record<RemittanceSlipType, string> = {
  CHEQUE: "Bordereau de chèques",
  EFFET: "Bordereau d’effets",
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [type, setType] = useState<InstrumentSlipType>("CHEQUE");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [slipPage, setSlipPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [destinationId, setDestinationId] = useState("");
  const [slipDate, setSlipDate] = useState(TODAY);
  const [bankReference, setBankReference] = useState("");
  const [cashOpen, setCashOpen] = useState(false);
  const [cashSourceId, setCashSourceId] = useState("");
  const [cashDestinationId, setCashDestinationId] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [cashDate, setCashDate] = useState(TODAY);
  const [cashReference, setCashReference] = useState("");

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const eligible = useQuery({
    queryKey: ["compta", "treasury", "remittance-eligible", type, appliedSearch, dateFrom, dateTo, page],
    queryFn: () => comptaApi.eligibleRemittanceInstruments({
      type,
      search: appliedSearch || undefined,
      dateDu: dateFrom || undefined,
      dateAu: dateTo || undefined,
      page,
      size: TREASURY_PAGE_SIZE,
    }),
  });
  const slips = useQuery({
    queryKey: ["compta", "treasury", "remittance-slips", slipPage],
    queryFn: () => comptaApi.remittanceSlips({ page: slipPage, size: TREASURY_PAGE_SIZE }),
  });

  const bankAccounts = (accounts.data ?? []).filter((account) => account.actif && account.typeCompte === "BANQUE");
  const cashAccounts = (accounts.data ?? []).filter((account) => account.actif && account.typeCompte === "CAISSE");
  const rows = eligible.data?.rows ?? [];
  const selectedTotal = useMemo(() => rows
    .filter((row) => selectedIds.includes(row.id))
    .reduce((sum, row) => sum + row.montant, 0), [rows, selectedIds]);
  const allPageSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  const createSlip = useMutation({
    mutationFn: () => comptaApi.createRemittanceSlip({
      type,
      dateBordereau: slipDate,
      compteDestinationId: destinationId,
      referenceBancaire: bankReference.trim() || undefined,
      instrumentIds: selectedIds,
    }),
    onSuccess: async (created) => {
      toast.success(`${created.numero} créé`);
      setSelectedIds([]);
      setBankReference("");
      await invalidateRemittances(queryClient);
      navigate(`/app/compta/tresorerie/bordereaux-remise/${created.id}`);
    },
    onError: showError,
  });

  const createCashSlip = useMutation({
    mutationFn: async () => {
      const created = await comptaApi.createRemittanceSlip({
        type: "VERSEMENT_ESPECES",
        dateBordereau: cashDate,
        compteSourceId: cashSourceId,
        compteDestinationId: cashDestinationId,
        montantEspeces: Number(cashAmount.replace(",", ".")),
        referenceBancaire: cashReference.trim() || undefined,
        instrumentIds: [],
      });
      return comptaApi.depositRemittanceSlip(created.id, {
        dateDepot: cashDate,
        referenceBancaire: cashReference.trim() || undefined,
      });
    },
    onSuccess: async (created) => {
      toast.success(`${created.numero} enregistré`);
      setCashOpen(false);
      setCashSourceId("");
      setCashDestinationId("");
      setCashAmount("");
      setCashReference("");
      await invalidateRemittances(queryClient);
    },
    onError: showError,
  });

  function applyFilters() {
    setAppliedSearch(search.trim());
    setPage(0);
    setSelectedIds([]);
  }

  function resetFilters() {
    setSearch("");
    setAppliedSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
    setSelectedIds([]);
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">Bordereaux de remise</h1>
          <p className="text-sm text-muted-foreground">Préparez les remises, suivez leur dépôt et traitez chaque instrument séparément.</p>
        </div>
        <Button variant="outline" onClick={() => setCashOpen(true)} disabled={!canManage}>
          <Banknote className="size-4" /> Versement d’espèces
        </Button>
      </header>

      <section className="grid gap-3 rounded-md border bg-card p-4 xl:grid-cols-[220px_1fr_180px_180px_auto]">
        <div className="grid gap-2">
          <Label>Type d’instrument</Label>
          <Select value={type} onValueChange={(value) => {
            setType(value as InstrumentSlipType);
            setPage(0);
            setSlipPage(0);
            setSelectedIds([]);
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="CHEQUE">Chèques</SelectItem><SelectItem value="EFFET">Effets</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="remittance-search">Payeur, règlement, banque ou référence</Label>
          <Input id="remittance-search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyFilters()} />
        </div>
        <div className="grid gap-2"><Label>Échéance du</Label><DatePicker date={dateFrom} onSelect={(value) => setDateFrom(toDateOnly(value) ?? "")} /></div>
        <div className="grid gap-2"><Label>Échéance au</Label><DatePicker date={dateTo} onSelect={(value) => setDateTo(toDateOnly(value) ?? "")} /></div>
        <div className="flex items-end gap-2">
          <Button size="icon" title="Rechercher" onClick={applyFilters}><Search className="size-4" /></Button>
          <Button size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}><RotateCcw className="size-4" /></Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Instruments disponibles</h2>
            <p className="text-sm text-muted-foreground">{selectedIds.length} sélectionné(s) · {formatTreasuryMoney(selectedTotal)}</p>
          </div>
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:max-w-4xl lg:grid-cols-[220px_170px_1fr_auto]">
            <div className="grid gap-1"><Label>Compte bancaire</Label><Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
              <SelectContent>{bankAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent>
            </Select></div>
            <div className="grid gap-1"><Label>Date du bordereau</Label><DatePicker date={slipDate} onSelect={(value) => setSlipDate(toDateOnly(value) ?? "")} /></div>
            <div className="grid gap-1"><Label htmlFor="bank-reference">Référence bancaire</Label><Input id="bank-reference" value={bankReference} onChange={(event) => setBankReference(event.target.value)} /></div>
            <Button className="self-end" disabled={!canManage || !selectedIds.length || !destinationId || createSlip.isPending} onClick={() => createSlip.mutate()}>
              <Plus className="size-4" /> Créer le bordereau
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
              <th className="w-12 px-4 py-3 text-center"><Checkbox checked={allPageSelected} onCheckedChange={(checked) => setSelectedIds(checked
                ? Array.from(new Set([...selectedIds, ...rows.map((row) => row.id)]))
                : selectedIds.filter((id) => !rows.some((row) => row.id === id)))} aria-label="Sélectionner la page" /></th>
              <th className="px-4 py-3 text-left">Référence</th><th className="px-4 py-3 text-left">Payeur</th>
              <th className="px-4 py-3 text-left">Règlement</th><th className="px-4 py-3 text-left">Mode</th>
              <th className="px-4 py-3 text-left">Reçu le</th><th className="px-4 py-3 text-left">Échéance</th>
              <th className="px-4 py-3 text-left">Banque émettrice</th><th className="px-4 py-3 text-right">Montant</th>
            </tr></thead>
            <tbody className="divide-y">
              {eligible.isLoading ? <TableRowsSkeleton colSpan={9} rows={5} /> : rows.map((instrument) => <tr key={instrument.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-center"><Checkbox checked={selectedIds.includes(instrument.id)} onCheckedChange={(checked) => setSelectedIds(checked
                  ? [...selectedIds, instrument.id]
                  : selectedIds.filter((id) => id !== instrument.id))} aria-label={`Sélectionner ${instrument.referenceInstrument ?? instrument.numeroReglement}`} /></td>
                <td className="px-4 py-3 font-semibold">{instrument.referenceInstrument || "-"}</td><td className="px-4 py-3">{instrument.payeurNom}</td>
                <td className="px-4 py-3">{instrument.numeroReglement}</td><td className="px-4 py-3">{paymentModeLabel(instrument.mode)}</td>
                <td className="px-4 py-3">{formatTreasuryDate(instrument.dateInstrument)}</td><td className="px-4 py-3">{formatTreasuryDate(instrument.dateEcheance)}</td>
                <td className="px-4 py-3">{instrument.banqueEmettrice || "-"}</td><td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(instrument.montant)}</td>
              </tr>)}
              {!eligible.isLoading && rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Aucun instrument disponible pour cette période.</td></tr>}
            </tbody>
          </table>
        </div>
        {eligible.data && <ServerPagination page={eligible.data.page.number} totalPages={eligible.data.page.totalPages} totalElements={eligible.data.page.totalElements} loading={eligible.isFetching} onPageChange={(nextPage) => {
          setPage(nextPage);
          setSelectedIds([]);
        }} />}
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Bordereaux récents</h2><p className="text-sm text-muted-foreground">Chèques, effets et versements d’espèces.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr>
            <th className="px-4 py-3 text-left">N° bordereau</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Destination</th><th className="px-4 py-3 text-center">Instruments</th>
            <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Statut</th><th className="w-16 px-4 py-3"><span className="sr-only">Détail</span></th>
          </tr></thead>
          <tbody className="divide-y">
            {slips.isLoading ? <TableRowsSkeleton colSpan={8} rows={4} /> : (slips.data?.rows ?? []).map((slip) => <tr key={slip.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">{slip.numero}</td><td className="px-4 py-3">{TYPE_LABELS[slip.type]}</td><td className="px-4 py-3">{formatTreasuryDate(slip.dateBordereau)}</td>
              <td className="px-4 py-3">{slip.compteDestination}</td><td className="px-4 py-3 text-center">{slip.nombreLignes}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(slip.montantTotal)}</td><td className="px-4 py-3">{STATUS_LABELS[slip.statut]}</td>
              <td className="px-4 py-3"><Button asChild size="icon" variant="ghost" title="Voir le bordereau"><Link to={`/app/compta/tresorerie/bordereaux-remise/${slip.id}`}><Eye className="size-4" /></Link></Button></td>
            </tr>)}
            {!slips.isLoading && (slips.data?.rows.length ?? 0) === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Aucun bordereau enregistré.</td></tr>}
          </tbody>
        </table></div>
        {slips.data && <ServerPagination page={slips.data.page.number} totalPages={slips.data.page.totalPages} totalElements={slips.data.page.totalElements} loading={slips.isFetching} onPageChange={setSlipPage} />}
      </section>

      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Versement d’espèces</DialogTitle><DialogDescription>Transférez un montant d’une caisse vers un compte bancaire.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label>Caisse source</Label><Select value={cashSourceId} onValueChange={setCashSourceId}><SelectTrigger><SelectValue placeholder="Choisir une caisse" /></SelectTrigger><SelectContent>{cashAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Compte bancaire</Label><Select value={cashDestinationId} onValueChange={setCashDestinationId}><SelectTrigger><SelectValue placeholder="Choisir une banque" /></SelectTrigger><SelectContent>{bankAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label htmlFor="cash-amount">Montant</Label><Input id="cash-amount" inputMode="decimal" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} /></div>
            <div className="grid gap-2"><Label>Date de versement</Label><DatePicker date={cashDate} onSelect={(value) => setCashDate(toDateOnly(value) ?? "")} /></div>
            <div className="grid gap-2 sm:col-span-2"><Label htmlFor="cash-reference">Référence bancaire</Label><Input id="cash-reference" value={cashReference} onChange={(event) => setCashReference(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCashOpen(false)}>Annuler</Button><Button onClick={() => createCashSlip.mutate()} disabled={!cashSourceId || !cashDestinationId || !cashAmount || createCashSlip.isPending}><Landmark className="size-4" /> Enregistrer le versement</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function invalidateRemittances(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
    queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
  ]);
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
