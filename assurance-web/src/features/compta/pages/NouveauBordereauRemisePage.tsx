import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Banknote, FileClock, Plus, ReceiptText, RotateCcw, Search } from "lucide-react";
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
import { MoneyInput } from "@/features/production/components/MoneyInput";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { RemittanceSlipType } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY, TREASURY_PAGE_SIZE } from "./treasury-format";

export default function NouveauBordereauRemisePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const requestedType = searchParams.get("type");
  const initialType: RemittanceSlipType | "" =
    requestedType === "CHEQUE"
      || requestedType === "EFFET"
      || requestedType === "VERSEMENT_ESPECES"
      ? requestedType
      : "";
  const [type, setType] = useState<RemittanceSlipType | "">(initialType);
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [cashAmount, setCashAmount] = useState<number>();
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
      type: type === "EFFET" ? "EFFET" : "CHEQUE",
      search: appliedSearch || undefined,
      dateDu: dateFrom || undefined,
      dateAu: dateTo || undefined,
      page,
      size: TREASURY_PAGE_SIZE,
    }),
    enabled: type === "CHEQUE" || type === "EFFET",
  });

  const bankAccounts = (accounts.data ?? []).filter((account) => account.actif && account.typeCompte === "BANQUE");
  const cashAccounts = (accounts.data ?? []).filter((account) => account.actif && account.typeCompte === "CAISSE");
  const rows = eligible.data?.rows ?? [];
  const selectedTotal = useMemo(() => rows
    .filter((row) => selectedIds.includes(row.id))
    .reduce((sum, row) => sum + row.montant, 0), [rows, selectedIds]);
  const allPageSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  const createSlip = useMutation({
    mutationFn: () => {
      if (!type) {
        throw new Error("Choisissez un type de remise");
      }
      return type === "VERSEMENT_ESPECES"
        ? comptaApi.createCashRemittance({
            type,
            dateBordereau: slipDate,
            compteSourceId: sourceId,
            compteDestinationId: destinationId,
            montantEspeces: cashAmount,
            referenceBancaire: bankReference.trim() || undefined,
            notes: notes.trim() || undefined,
            instrumentIds: [],
          })
        : comptaApi.createRemittanceSlip({
            type,
            dateBordereau: slipDate,
            compteDestinationId: destinationId,
            referenceBancaire: bankReference.trim() || undefined,
            notes: notes.trim() || undefined,
            instrumentIds: selectedIds,
          });
    },
    onSuccess: async (created) => {
      toast.success(`${created.numero} créé`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
      ]);
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

  function changeType(nextType: RemittanceSlipType) {
    setType(nextType);
    setSearchParams({ type: nextType }, { replace: true });
    setSelectedIds([]);
    setPage(0);
  }

  const instrumentType = type === "CHEQUE" || type === "EFFET";

  return (
    <div className="grid gap-5">
      <header>
        <Button asChild variant="ghost" className="mb-2 -ml-3"><Link to="/app/compta/tresorerie/bordereaux-remise"><ArrowLeft className="size-4" /> Retour aux bordereaux</Link></Button>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
        <h1 className="mt-1 text-xl font-semibold">Préparer une remise</h1>
        <p className="text-sm text-muted-foreground">Remises bancaires de chèques, effets et espèces.</p>
      </header>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b bg-muted/20 p-4">
          <Label className="mb-2 block">Type de remise</Label>
          <div className="grid max-w-3xl gap-2 sm:grid-cols-3">
            <Button type="button" variant="outline" className={type === "CHEQUE" ? "h-11 justify-start border-sky-500 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-200" : "h-11 justify-start"} onClick={() => changeType("CHEQUE")}>
              <ReceiptText className="size-4" /> Chèques
            </Button>
            <Button type="button" variant="outline" className={type === "EFFET" ? "h-11 justify-start border-violet-500 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-200" : "h-11 justify-start"} onClick={() => changeType("EFFET")}>
              <FileClock className="size-4" /> Effets
            </Button>
            <Button type="button" variant="outline" className={type === "VERSEMENT_ESPECES" ? "h-11 justify-start border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200" : "h-11 justify-start"} onClick={() => changeType("VERSEMENT_ESPECES")}>
              <Banknote className="size-4" /> Versement d’espèces
            </Button>
          </div>
        </div>

        {type && <div className="border-b p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className={type === "CHEQUE" ? "h-5 w-1 rounded-sm bg-sky-500" : type === "EFFET" ? "h-5 w-1 rounded-sm bg-violet-500" : "h-5 w-1 rounded-sm bg-emerald-500"} />
            <h2 className="font-semibold">Détails de la remise</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {type === "VERSEMENT_ESPECES" && <div className="grid gap-2"><Label>Caisse source</Label><Select value={sourceId} onValueChange={setSourceId}><SelectTrigger><SelectValue placeholder="Choisir une caisse" /></SelectTrigger><SelectContent>{cashAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent></Select></div>}
            <div className="grid gap-2"><Label>Compte bancaire de destination</Label><Select value={destinationId} onValueChange={setDestinationId}><SelectTrigger><SelectValue placeholder="Choisir un compte" /></SelectTrigger><SelectContent>{bankAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent></Select></div>
            {type === "VERSEMENT_ESPECES" && <div className="grid gap-2"><Label htmlFor="cash-amount">Montant</Label><MoneyInput id="cash-amount" value={cashAmount} onValueChange={setCashAmount} /></div>}
            <div className="grid gap-2"><Label>{type === "VERSEMENT_ESPECES" ? "Date de versement" : "Date du bordereau"}</Label><DatePicker date={slipDate} onSelect={(value) => setSlipDate(toDateOnly(value) ?? "")} /></div>
            <div className="grid gap-2"><Label htmlFor="bank-reference">Référence bancaire</Label><Input id="bank-reference" value={bankReference} onChange={(event) => setBankReference(event.target.value)} /></div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-4"><Label htmlFor="slip-notes">Notes</Label><Textarea id="slip-notes" className="min-h-16" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          </div>
        </div>}

        {instrumentType && <div className="grid gap-3 border-b bg-muted/20 p-4 xl:grid-cols-[1fr_190px_190px_auto]">
          <div className="grid gap-2"><Label htmlFor="instrument-search">Payeur, règlement, banque ou référence</Label><Input id="instrument-search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyFilters()} /></div>
          <div className="grid gap-2"><Label>Échéance du</Label><DatePicker date={dateFrom} onSelect={(value) => setDateFrom(toDateOnly(value) ?? "")} /></div>
          <div className="grid gap-2"><Label>Échéance au</Label><DatePicker date={dateTo} onSelect={(value) => setDateTo(toDateOnly(value) ?? "")} /></div>
          <div className="flex items-end gap-2"><Button size="icon" title="Rechercher" onClick={applyFilters}><Search className="size-4" /></Button><Button size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}><RotateCcw className="size-4" /></Button></div>
        </div>}

        {instrumentType && <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div><h2 className="font-semibold">Instruments disponibles</h2><p className="text-sm text-muted-foreground">{selectedIds.length} sélectionné(s) · {formatTreasuryMoney(selectedTotal)}</p></div>
            <Button className={type === "CHEQUE" ? "bg-sky-700 text-white hover:bg-sky-800" : "bg-violet-700 text-white hover:bg-violet-800"} disabled={!canManage || !selectedIds.length || !destinationId || !slipDate || createSlip.isPending} onClick={() => createSlip.mutate()}><Plus className="size-4" /> Créer le bordereau</Button>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm">
            <thead className={type === "CHEQUE" ? "bg-sky-700 text-xs uppercase text-white" : "bg-violet-700 text-xs uppercase text-white"}><tr>
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
        </>}

        {type === "VERSEMENT_ESPECES" && <div className="flex justify-end bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
          <Button className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={!canManage || !sourceId || !destinationId || !cashAmount || cashAmount <= 0 || !slipDate || createSlip.isPending} onClick={() => createSlip.mutate()}><Banknote className="size-4" /> Enregistrer le versement</Button>
        </div>}
      </section>
    </div>
  );
}
