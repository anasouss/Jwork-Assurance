import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { RemittanceSlipType } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY, TREASURY_PAGE_SIZE } from "./treasury-format";

type InstrumentSlipType = Exclude<RemittanceSlipType, "VERSEMENT_ESPECES">;

export default function NouveauBordereauRemisePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const requestedType = searchParams.get("type");
  const [type, setType] = useState<InstrumentSlipType>(requestedType === "EFFET" ? "EFFET" : "CHEQUE");
  const [destinationId, setDestinationId] = useState("");
  const [slipDate, setSlipDate] = useState(TODAY);
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const bankAccounts = (accounts.data ?? []).filter((account) => account.actif && account.typeCompte === "BANQUE");
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
      notes: notes.trim() || undefined,
      instrumentIds: selectedIds,
    }),
    onSuccess: async (created) => {
      toast.success(`${created.numero} créé`);
      await queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] });
      navigate(`/app/compta/tresorerie/bordereaux-remise/${created.id}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
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
      <header>
        <Button asChild variant="ghost" className="mb-2 -ml-3"><Link to="/app/compta/tresorerie/bordereaux-remise"><ArrowLeft className="size-4" /> Retour aux bordereaux</Link></Button>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
        <h1 className="mt-1 text-xl font-semibold">Préparer un bordereau</h1>
        <p className="text-sm text-muted-foreground">Sélectionnez des instruments du même type et leur compte bancaire de destination.</p>
      </header>

      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Paramètres du bordereau</h2></div>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-[190px_260px_180px_1fr]">
          <div className="grid gap-2"><Label>Type d’instrument</Label><Select value={type} onValueChange={(value) => {
            const nextType = value as InstrumentSlipType;
            setType(nextType);
            setSearchParams({ type: nextType }, { replace: true });
            setSelectedIds([]);
            setPage(0);
          }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CHEQUE">Chèques</SelectItem><SelectItem value="EFFET">Effets</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label>Compte bancaire de destination</Label><Select value={destinationId} onValueChange={setDestinationId}><SelectTrigger><SelectValue placeholder="Choisir un compte" /></SelectTrigger><SelectContent>{bankAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label>Date du bordereau</Label><DatePicker date={slipDate} onSelect={(value) => setSlipDate(toDateOnly(value) ?? "")} /></div>
          <div className="grid gap-2"><Label htmlFor="bank-reference">Référence bancaire</Label><Input id="bank-reference" value={bankReference} onChange={(event) => setBankReference(event.target.value)} /></div>
          <div className="grid gap-2 md:col-span-2 xl:col-span-4"><Label htmlFor="slip-notes">Notes</Label><Textarea id="slip-notes" className="min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
        </div>
      </section>

      <section className="grid gap-3 rounded-md border bg-card p-4 xl:grid-cols-[1fr_190px_190px_auto]">
        <div className="grid gap-2"><Label htmlFor="instrument-search">Payeur, règlement, banque ou référence</Label><Input id="instrument-search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyFilters()} /></div>
        <div className="grid gap-2"><Label>Échéance du</Label><DatePicker date={dateFrom} onSelect={(value) => setDateFrom(toDateOnly(value) ?? "")} /></div>
        <div className="grid gap-2"><Label>Échéance au</Label><DatePicker date={dateTo} onSelect={(value) => setDateTo(toDateOnly(value) ?? "")} /></div>
        <div className="flex items-end gap-2"><Button size="icon" title="Rechercher" onClick={applyFilters}><Search className="size-4" /></Button><Button size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}><RotateCcw className="size-4" /></Button></div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div><h2 className="font-semibold">Instruments disponibles</h2><p className="text-sm text-muted-foreground">{selectedIds.length} sélectionné(s) · {formatTreasuryMoney(selectedTotal)}</p></div>
          <Button disabled={!canManage || !selectedIds.length || !destinationId || !slipDate || createSlip.isPending} onClick={() => createSlip.mutate()}><Plus className="size-4" /> Créer le bordereau</Button>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
            <th className="w-12 px-4 py-3 text-center"><Checkbox checked={allPageSelected} onCheckedChange={(checked) => setSelectedIds(checked ? rows.map((row) => row.id) : [])} aria-label="Sélectionner la page" /></th>
            <th className="px-4 py-3 text-left">Référence</th><th className="px-4 py-3 text-left">Payeur</th>
            <th className="px-4 py-3 text-left">Règlement</th><th className="px-4 py-3 text-left">Mode</th>
            <th className="px-4 py-3 text-left">Reçu le</th><th className="px-4 py-3 text-left">Échéance</th>
            <th className="px-4 py-3 text-left">Banque émettrice</th><th className="px-4 py-3 text-right">Montant</th>
          </tr></thead>
          <tbody className="divide-y">
            {eligible.isLoading ? <TableRowsSkeleton colSpan={9} rows={6} /> : rows.map((instrument) => <tr key={instrument.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 text-center"><Checkbox checked={selectedIds.includes(instrument.id)} onCheckedChange={(checked) => setSelectedIds(checked ? [...selectedIds, instrument.id] : selectedIds.filter((id) => id !== instrument.id))} aria-label={`Sélectionner ${instrument.referenceInstrument ?? instrument.numeroReglement}`} /></td>
              <td className="px-4 py-3 font-semibold">{instrument.referenceInstrument || "-"}</td><td className="px-4 py-3">{instrument.payeurNom}</td>
              <td className="px-4 py-3">{instrument.numeroReglement}</td><td className="px-4 py-3">{paymentModeLabel(instrument.mode)}</td>
              <td className="px-4 py-3">{formatTreasuryDate(instrument.dateInstrument)}</td><td className="px-4 py-3">{formatTreasuryDate(instrument.dateEcheance)}</td>
              <td className="px-4 py-3">{instrument.banqueEmettrice || "-"}</td><td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(instrument.montant)}</td>
            </tr>)}
            {!eligible.isLoading && rows.length === 0 && <tr><td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">Aucun instrument disponible pour ces critères.</td></tr>}
          </tbody>
        </table></div>
        {eligible.data && <ServerPagination page={eligible.data.page.number} totalPages={eligible.data.page.totalPages} totalElements={eligible.data.page.totalElements} loading={eligible.isFetching} onPageChange={(nextPage) => { setPage(nextPage); setSelectedIds([]); }} />}
      </section>
    </div>
  );
}
