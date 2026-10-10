import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Eye, Plus, RotateCcw, Search } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { ClientPaymentMode, PaymentInstrument, PaymentInstrumentStatus } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TREASURY_PAGE_SIZE } from "./treasury-format";

type StatusFilter = Extract<PaymentInstrumentStatus, "EN_ATTENTE" | "REMIS_EN_BANQUE" | "REJETE">;
type ModeFilter = Extract<ClientPaymentMode, "CHEQUE" | "EFFET" | "VIREMENT" | "VERSEMENT_BANCAIRE"> | "ALL";

const STATUS_LABELS: Record<StatusFilter, string> = {
  EN_ATTENTE: "En attente",
  REMIS_EN_BANQUE: "Remis en banque",
  REJETE: "Rejetés",
};

export default function EncaissementsEnAttentePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search")?.trim() ?? "";
  const initialMode = searchParams.get("mode");
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const [status, setStatus] = useState<StatusFilter>("EN_ATTENTE");
  const [mode, setMode] = useState<ModeFilter>(
    initialMode === "CHEQUE" || initialMode === "EFFET" ? initialMode : "ALL"
  );
  const [search, setSearch] = useState(initialSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialSearch);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [selectedInstruments, setSelectedInstruments] = useState<PaymentInstrument[]>([]);

  const instruments = useQuery({
    queryKey: ["compta", "treasury", "collection-queue", status, mode, appliedSearch, dateFrom, dateTo, page],
    queryFn: () => comptaApi.paymentInstruments({
      statut: status,
      mode: mode === "ALL" ? undefined : mode,
      search: appliedSearch || undefined,
      dateDu: dateFrom || undefined,
      dateAu: dateTo || undefined,
      page,
      size: TREASURY_PAGE_SIZE,
    }),
  });

  function applyFilters() {
    setAppliedSearch(search.trim());
    setPage(0);
  }

  function resetFilters() {
    setStatus("EN_ATTENTE");
    setMode("ALL");
    setSearch("");
    setAppliedSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
    setSelectedInstruments([]);
  }

  const dateLabel = status === "EN_ATTENTE" ? "Échéance" : "Statut";
  const rows = instruments.data?.rows ?? [];
  const selectedMode = selectedInstruments[0]?.mode;
  const pageSelectable = rows.filter((instrument) => isSelectableForSlip(instrument)
    && (!selectedMode || instrument.mode === selectedMode));
  const canSelectPage = Boolean(selectedMode || mode === "CHEQUE" || mode === "EFFET")
    && pageSelectable.length > 0;
  const selectedOnPage = pageSelectable.filter((instrument) =>
    selectedInstruments.some((row) => row.id === instrument.id)).length;
  const allPageSelected = canSelectPage
    && selectedOnPage === pageSelectable.length;
  const selectedTotal = selectedInstruments.reduce((sum, instrument) => sum + instrument.montant, 0);

  function toggleInstrument(instrument: PaymentInstrument, checked: boolean) {
    if (checked) {
      if (selectedMode && instrument.mode !== selectedMode) return;
      setSelectedInstruments((current) => current.some((row) => row.id === instrument.id)
        ? current
        : [...current, instrument]);
    } else {
      setSelectedInstruments((current) => current.filter((row) => row.id !== instrument.id));
    }
  }

  function togglePage(checked: boolean) {
    if (!checked) {
      const pageIds = new Set(pageSelectable.map((instrument) => instrument.id));
      setSelectedInstruments((current) => current.filter((instrument) => !pageIds.has(instrument.id)));
      return;
    }
    setSelectedInstruments((current) => {
      const existingIds = new Set(current.map((instrument) => instrument.id));
      return [...current, ...pageSelectable.filter((instrument) => !existingIds.has(instrument.id))];
    });
  }

  function createSlip() {
    if (!selectedMode || (selectedMode !== "CHEQUE" && selectedMode !== "EFFET")) return;
    const ids = selectedInstruments.map((instrument) => instrument.id).join(",");
    navigate(`/app/compta/tresorerie/bordereaux-remise/nouveau?type=${selectedMode}&instrumentIds=${ids}`);
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">Encaissements en attente</h1>
          <p className="text-sm text-muted-foreground">Suivez chaque moyen de paiement jusqu’à sa remise ou son rapprochement.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/compta/tresorerie/bordereaux-remise"><Eye className="size-4" /> Bordereaux de remise</Link>
        </Button>
      </header>

      <section className="grid gap-3 rounded-md border bg-card p-4 xl:grid-cols-[190px_210px_1fr_170px_170px_auto]">
        <div className="grid gap-2">
          <Label>Étape</Label>
          <Select value={status} onValueChange={(value) => { setStatus(value as StatusFilter); setPage(0); setSelectedInstruments([]); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EN_ATTENTE">En attente</SelectItem>
              <SelectItem value="REMIS_EN_BANQUE">Remis en banque</SelectItem>
              <SelectItem value="REJETE">Rejetés</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(value) => { setMode(value as ModeFilter); setPage(0); setSelectedInstruments([]); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les modes</SelectItem>
              <SelectItem value="CHEQUE">Chèques</SelectItem>
              <SelectItem value="EFFET">Effets</SelectItem>
              <SelectItem value="VIREMENT">Virements</SelectItem>
              <SelectItem value="VERSEMENT_BANCAIRE">Versements bancaires</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="collection-search">Payeur, règlement, banque ou référence</Label>
          <Input id="collection-search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyFilters()} />
        </div>
        <div className="grid gap-2"><Label>{dateLabel} du</Label><DatePicker date={dateFrom} onSelect={(value) => setDateFrom(toDateOnly(value) ?? "")} /></div>
        <div className="grid gap-2"><Label>{dateLabel} au</Label><DatePicker date={dateTo} onSelect={(value) => setDateTo(toDateOnly(value) ?? "")} /></div>
        <div className="flex items-end gap-2">
          <Button size="icon" title="Rechercher" onClick={applyFilters}><Search className="size-4" /></Button>
          <Button size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}><RotateCcw className="size-4" /></Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{STATUS_LABELS[status]}</h2>
              <p className="text-sm text-muted-foreground">Une ligne correspond à un moyen de paiement et à sa prochaine action.</p>
            </div>
            {selectedInstruments.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="text-right text-sm">
                  <div className="font-medium">{selectedInstruments.length} sélectionné(s)</div>
                  <div className="text-muted-foreground">{formatTreasuryMoney(selectedTotal)}</div>
                </div>
                <Button disabled={!canManage} onClick={createSlip}>
                  <Plus className="size-4" />
                  Créer un bordereau
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
              <th className="w-12 px-4 py-3 text-center">
                <Checkbox
                  checked={allPageSelected ? true : selectedOnPage > 0 ? "indeterminate" : false}
                  disabled={!canManage || !canSelectPage}
                  onCheckedChange={(checked) => togglePage(checked === true)}
                  aria-label="Sélectionner les instruments éligibles de la page"
                />
              </th>
              <th className="px-4 py-3 text-left">Référence</th>
              <th className="px-4 py-3 text-left">Payeur</th>
              <th className="px-4 py-3 text-left">Règlement</th>
              <th className="px-4 py-3 text-left">Mode</th>
              <th className="px-4 py-3 text-left">Reçu le</th>
              <th className="px-4 py-3 text-left">Échéance</th>
              <th className="px-4 py-3 text-left">Traitement</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="w-44 px-4 py-3 text-right">Action</th>
            </tr></thead>
            <tbody className="divide-y">
              {instruments.isLoading ? <TableRowsSkeleton colSpan={10} rows={6} /> : rows.map((instrument) => (
                <tr key={instrument.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-center">
                    {isSelectableForSlip(instrument) ? (
                      <Checkbox
                        checked={selectedInstruments.some((row) => row.id === instrument.id)}
                        disabled={!canManage || Boolean(selectedMode && selectedMode !== instrument.mode)}
                        onCheckedChange={(checked) => toggleInstrument(instrument, checked === true)}
                        aria-label={`Sélectionner ${instrument.referenceInstrument ?? instrument.numeroReglement}`}
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-semibold">{instrument.referenceInstrument || "-"}</td>
                  <td className="px-4 py-3">{instrument.payeurNom}</td>
                  <td className="px-4 py-3">{instrument.numeroReglement}</td>
                  <td className="px-4 py-3">{paymentModeLabel(instrument.mode)}</td>
                  <td className="px-4 py-3">{formatTreasuryDate(instrument.dateInstrument)}</td>
                  <td className="px-4 py-3">{formatTreasuryDate(instrument.dateEcheance)}</td>
                  <td className="px-4 py-3"><WorkflowBadge instrument={instrument} /></td>
                  <td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(instrument.montant)}</td>
                  <td className="px-4 py-3 text-right"><InstrumentAction instrument={instrument} /></td>
                </tr>
              ))}
              {!instruments.isLoading && (instruments.data?.rows.length ?? 0) === 0 && (
                <tr><td colSpan={10} className="px-4 py-14 text-center text-muted-foreground">Aucun moyen de paiement ne correspond aux filtres.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {instruments.data && <ServerPagination page={instruments.data.page.number} totalPages={instruments.data.page.totalPages} totalElements={instruments.data.page.totalElements} loading={instruments.isFetching} onPageChange={setPage} />}
      </section>
    </div>
  );
}

function WorkflowBadge({ instrument }: { instrument: PaymentInstrument }) {
  if (instrument.statut === "REJETE") {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200">Rejeté</Badge>;
  }
  if (instrument.statut === "REMIS_EN_BANQUE") {
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200">Remis en banque</Badge>;
  }
  if (instrument.bordereauRemiseId) {
    return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200">Brouillon {instrument.numeroBordereauRemise}</Badge>;
  }
  if (instrument.mode === "CHEQUE" || instrument.mode === "EFFET") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200">À remettre</Badge>;
  }
  return <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-200">À rapprocher</Badge>;
}

function InstrumentAction({ instrument }: { instrument: PaymentInstrument }) {
  if (instrument.bordereauRemiseId) {
    return <Button asChild size="sm" variant="outline"><Link to={`/app/compta/tresorerie/bordereaux-remise/${instrument.bordereauRemiseId}`}>Voir le bordereau <ArrowRight className="size-4" /></Link></Button>;
  }
  if (instrument.statut === "REJETE") {
    return <Button asChild size="sm" variant="outline"><Link to={`/app/compta/reglements/${instrument.reglementId}`}>Voir le règlement <ArrowRight className="size-4" /></Link></Button>;
  }
  if (instrument.statut === "REMIS_EN_BANQUE") {
    return <span className="text-muted-foreground">-</span>;
  }
  return <span className="text-muted-foreground">-</span>;
}

function isSelectableForSlip(instrument: PaymentInstrument) {
  return instrument.statut === "EN_ATTENTE"
    && !instrument.bordereauRemiseId
    && (instrument.mode === "CHEQUE" || instrument.mode === "EFFET");
}
