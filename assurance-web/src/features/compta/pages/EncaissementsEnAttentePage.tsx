import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowRightLeft, Banknote, Eye, Landmark, MoreHorizontal, Plus, RotateCcw, Search, UserRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SortIcon } from "@/components/ui/sort-icon";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { ClientPaymentMode, PaymentInstrument } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY, TREASURY_PAGE_SIZE } from "./treasury-format";

type ModeFilter = Extract<ClientPaymentMode, "ESPECES" | "CHEQUE" | "EFFET" | "VIREMENT" | "VERSEMENT_BANCAIRE"> | "ALL";
type InstrumentSortBy = "REFERENCE" | "PAYER" | "PAYMENT" | "MODE" | "RECEIVED" | "DUE" | "AMOUNT";
type SortDirection = "ASC" | "DESC";

export default function EncaissementsEnAttentePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = collectionQueueStateFromParams(searchParams);
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const canReplacePayment = permissions.includes("reglement-client:manage");
  const queryClient = useQueryClient();
  const { mode, search: appliedSearch, dateFrom, dateTo, page, sortBy, sortDirection } = urlState;
  const [search, setSearch] = useState(appliedSearch);
  const [selectedInstruments, setSelectedInstruments] = useState<PaymentInstrument[]>([]);
  const [instrumentToReplace, setInstrumentToReplace] = useState<PaymentInstrument>();
  const [replacementDate, setReplacementDate] = useState(TODAY);
  const [replacementReason, setReplacementReason] = useState("");

  useEffect(() => {
    setSearch(appliedSearch);
  }, [appliedSearch]);

  useEffect(() => {
    setSelectedInstruments([]);
  }, [mode, appliedSearch, dateFrom, dateTo, sortBy, sortDirection]);

  function updateUrl(patch: Partial<CollectionQueueUrlState>) {
    setSearchParams(collectionQueueSearchParams({ ...urlState, ...patch }), { replace: true });
  }

  const instruments = useQuery({
    queryKey: ["compta", "treasury", "collection-queue", mode, appliedSearch, dateFrom, dateTo, sortBy, sortDirection, page],
    queryFn: () => comptaApi.paymentInstruments({
      statut: "EN_ATTENTE",
      mode: mode === "ALL" ? undefined : mode,
      search: appliedSearch || undefined,
      dateDu: dateFrom || undefined,
      dateAu: dateTo || undefined,
      sortBy,
      sortDirection,
      page,
      size: TREASURY_PAGE_SIZE,
    }),
    enabled: mode !== "ESPECES",
  });
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
    enabled: mode === "ALL" || mode === "ESPECES",
  });

  const replaceWithCash = useMutation({
    mutationFn: () => comptaApi.replacePaymentInstrument(instrumentToReplace!.id, {
      mode: "ESPECES",
      montant: instrumentToReplace!.montant,
      dateInstrument: replacementDate,
      motif: replacementReason.trim(),
    }),
    onSuccess: async () => {
      const replacedId = instrumentToReplace?.id;
      setInstrumentToReplace(undefined);
      setReplacementDate(TODAY);
      setReplacementReason("");
      setSelectedInstruments((current) => current.filter((row) => row.id !== replacedId));
      toast.success("Le règlement au bureau a été remplacé par des espèces");
      await queryClient.invalidateQueries({ queryKey: ["compta"] });
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Remplacement impossible"
    ),
  });

  function applyFilters() {
    updateUrl({ search: search.trim(), page: 0 });
  }

  function resetFilters() {
    setSearch("");
    setSelectedInstruments([]);
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  function changeMode(nextMode: ModeFilter) {
    const supportsDueDate = nextMode === "CHEQUE" || nextMode === "EFFET";
    updateUrl({
      mode: nextMode,
      search: appliedSearch,
      dateFrom: supportsDueDate ? dateFrom : "",
      dateTo: supportsDueDate ? dateTo : "",
      page: 0,
    });
  }

  function changeSort(column: InstrumentSortBy) {
    const nextDirection = sortBy === column
      ? sortDirection === "ASC" ? "DESC" : "ASC"
      : column === "AMOUNT" || column === "RECEIVED" ? "DESC" : "ASC";
    updateUrl({ sortBy: column, sortDirection: nextDirection, page: 0 });
    setSelectedInstruments([]);
  }

  const cashSearch = appliedSearch.toLocaleLowerCase("fr");
  const cashAccounts = (accounts.data ?? []).filter((account) => {
    if (!account.actif || account.typeCompte !== "CAISSE" || account.soldeCourant <= 0) return false;
    if (!cashSearch) return true;
    return [account.code, account.libelle, account.utilisateurTitulaire]
      .some((value) => value?.toLocaleLowerCase("fr").includes(cashSearch));
  });
  const centralCashAccount = (accounts.data ?? []).find((account) =>
    account.actif && account.typeCompte === "CAISSE" && account.natureCaisse === "CENTRALE"
  );
  const showCashWorkflow = mode === "ALL" || mode === "ESPECES";
  const showInstrumentWorkflow = mode !== "ESPECES";
  const showDueDateFilters = mode === "CHEQUE" || mode === "EFFET";
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
          <p className="text-sm text-muted-foreground">Espèces en caisse et moyens de paiement restant à traiter.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/compta/tresorerie/bordereaux-remise"><Eye className="size-4" /> Bordereaux bancaires</Link>
        </Button>
      </header>

      <section className={`grid gap-3 rounded-md border bg-card p-4 ${showDueDateFilters
        ? "xl:grid-cols-[210px_1fr_170px_170px_auto]"
        : "xl:grid-cols-[210px_1fr_auto]"}`}>
        <div className="grid gap-2">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(value) => changeMode(value as ModeFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les modes</SelectItem>
              <SelectItem value="ESPECES">Espèces</SelectItem>
              <SelectItem value="CHEQUE">Chèques</SelectItem>
              <SelectItem value="EFFET">Effets</SelectItem>
              <SelectItem value="VIREMENT">Virements</SelectItem>
              <SelectItem value="VERSEMENT_BANCAIRE">Versements bancaires</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="collection-search">Payeur, règlement, caisse, banque ou référence</Label>
          <Input id="collection-search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyFilters()} />
        </div>
        {showDueDateFilters && (
          <>
            <div className="grid gap-2">
              <Label>Échéance du</Label>
              <DatePicker
                date={dateFrom}
                maxDate={dateTo ? new Date(`${dateTo}T00:00:00`) : undefined}
                onSelect={(value) => updateUrl({ dateFrom: toDateOnly(value) ?? "", page: 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Échéance au</Label>
              <DatePicker
                date={dateTo}
                minDate={dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined}
                onSelect={(value) => updateUrl({ dateTo: toDateOnly(value) ?? "", page: 0 })}
              />
            </div>
          </>
        )}
        <div className="flex items-end gap-2">
          <Button size="icon" title="Rechercher" onClick={applyFilters}><Search className="size-4" /></Button>
          <Button size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}><RotateCcw className="size-4" /></Button>
        </div>
      </section>

      {showCashWorkflow && <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Espèces en caisse</h2>
          <p className="text-sm text-muted-foreground">Espèces détenues en caisse et pas encore versées en banque.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-emerald-700 text-xs uppercase text-white"><tr>
              <th className="px-4 py-3 text-left">Caisse</th>
              <th className="px-4 py-3 text-left">Responsable</th>
              <th className="px-4 py-3 text-left">Situation</th>
              <th className="px-4 py-3 text-right">Solde</th>
              <th className="w-64 px-4 py-3 text-right">Action suivante</th>
            </tr></thead>
            <tbody className="divide-y">
              {accounts.isLoading ? <TableRowsSkeleton colSpan={5} rows={2} /> : cashAccounts.map((account) => {
                const central = account.natureCaisse === "CENTRALE";
                return <tr key={account.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-semibold">{account.libelle}</td>
                  <td className="px-4 py-2.5">{account.utilisateurTitulaire || (central ? "Caisse centrale" : "-")}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={central
                      ? "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200"
                      : "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200"}
                    >{central ? "À verser en banque" : "À remettre à la caisse centrale"}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatTreasuryMoney(account.soldeCourant)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {central ? (
                      canManage ? (
                        <Button asChild size="sm">
                          <Link to={`/app/compta/tresorerie/bordereaux-remise/nouveau?type=VERSEMENT_ESPECES&sourceId=${account.id}`}>
                            <Landmark className="size-4" /> Préparer le versement
                          </Link>
                        </Button>
                      ) : <Button size="sm" disabled><Landmark className="size-4" /> Préparer le versement</Button>
                    ) : centralCashAccount ? (
                      canManage ? (
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/app/compta/tresorerie/operations?compteId=${account.id}&destinationType=CAISSE&destinationId=${centralCashAccount.id}`}>
                            <ArrowRightLeft className="size-4" /> Remettre à la caisse centrale
                          </Link>
                        </Button>
                      ) : <Button size="sm" variant="outline" disabled><ArrowRightLeft className="size-4" /> Remettre à la caisse centrale</Button>
                    ) : <span className="text-sm text-destructive">Caisse centrale non configurée</span>}
                  </td>
                </tr>;
              })}
              {!accounts.isLoading && !accounts.isError && cashAccounts.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Aucune espèce en caisse.</td></tr>
              )}
              {accounts.isError && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-destructive">Chargement des caisses impossible.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>}

      {showInstrumentWorkflow && <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Moyens de paiement en attente</h2>
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
              <CollectionSortHeader column="REFERENCE" activeColumn={sortBy} direction={sortDirection} onSort={changeSort}>Référence</CollectionSortHeader>
              <CollectionSortHeader column="PAYER" activeColumn={sortBy} direction={sortDirection} onSort={changeSort}>Payeur</CollectionSortHeader>
              <CollectionSortHeader column="PAYMENT" activeColumn={sortBy} direction={sortDirection} onSort={changeSort}>Règlement</CollectionSortHeader>
              <CollectionSortHeader column="MODE" activeColumn={sortBy} direction={sortDirection} onSort={changeSort}>Mode</CollectionSortHeader>
              <CollectionSortHeader column="RECEIVED" activeColumn={sortBy} direction={sortDirection} onSort={changeSort}>Reçu le</CollectionSortHeader>
              <CollectionSortHeader column="DUE" activeColumn={sortBy} direction={sortDirection} onSort={changeSort}>Échéance</CollectionSortHeader>
              <th className="px-4 py-3 text-left">Traitement</th>
              <CollectionSortHeader column="AMOUNT" activeColumn={sortBy} direction={sortDirection} onSort={changeSort} align="right">Montant</CollectionSortHeader>
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
                  <td className="px-4 py-3 text-right">
                    <InstrumentAction
                      instrument={instrument}
                      canReplace={canReplacePayment}
                      onReplace={() => {
                        setInstrumentToReplace(instrument);
                        setReplacementDate(TODAY);
                        setReplacementReason("");
                      }}
                    />
                  </td>
                </tr>
              ))}
              {!instruments.isLoading && (instruments.data?.rows.length ?? 0) === 0 && (
                <tr><td colSpan={10} className="px-4 py-14 text-center text-muted-foreground">Aucun moyen de paiement ne correspond aux filtres.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {instruments.data && <ServerPagination page={instruments.data.page.number} totalPages={instruments.data.page.totalPages} totalElements={instruments.data.page.totalElements} loading={instruments.isFetching} onPageChange={(nextPage) => updateUrl({ page: nextPage })} />}
      </section>}

      <Dialog open={Boolean(instrumentToReplace)} onOpenChange={(open) => !open && setInstrumentToReplace(undefined)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Banknote className="size-5" />
              </span>
              <DialogTitle>Remplacer par un règlement en espèces</DialogTitle>
            </div>
            <DialogDescription>
              Confirmez cette opération uniquement après réception des espèces. Le chèque ou l’effet restera conservé dans l’historique comme remplacé.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/25">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{instrumentToReplace?.payeurNom}</div>
                <div className="mt-1 text-muted-foreground">
                  {instrumentToReplace ? paymentModeLabel(instrumentToReplace.mode) : "-"} · {instrumentToReplace?.referenceInstrument || "Sans référence"}
                </div>
              </div>
              <div className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                {formatTreasuryMoney(instrumentToReplace?.montant ?? 0)}
              </div>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Date de réception des espèces</Label>
              <DatePicker date={replacementDate} onSelect={(value) => setReplacementDate(toDateOnly(value) ?? "")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cash-replacement-reason">Motif</Label>
              <Textarea
                id="cash-replacement-reason"
                value={replacementReason}
                onChange={(event) => setReplacementReason(event.target.value)}
                placeholder="Ex. Chèque restitué au client après règlement en espèces"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={replaceWithCash.isPending} onClick={() => setInstrumentToReplace(undefined)}>Annuler</Button>
            <Button disabled={!replacementDate || !replacementReason.trim() || replaceWithCash.isPending} onClick={() => replaceWithCash.mutate()}>
              <Banknote className="size-4" />
              {replaceWithCash.isPending ? "Enregistrement..." : "Confirmer les espèces reçues"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function CollectionSortHeader(props: {
  children: ReactNode;
  column: InstrumentSortBy;
  activeColumn: InstrumentSortBy;
  direction: SortDirection;
  onSort: (column: InstrumentSortBy) => void;
  align?: "right";
}) {
  const active = props.column === props.activeColumn;
  return (
    <th
      aria-sort={active ? props.direction === "ASC" ? "ascending" : "descending" : "none"}
      className="whitespace-nowrap px-4 py-3"
    >
      <button
        type="button"
        onClick={() => props.onSort(props.column)}
        className={`inline-flex w-full items-center gap-1 hover:text-white/80 ${props.align === "right" ? "justify-end" : "justify-start"}`}
      >
        {props.children}
        <SortIcon isActive={active} direction={props.direction.toLowerCase() as "asc" | "desc"} />
      </button>
    </th>
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
    return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200">Bordereau provisoire {instrument.numeroBordereauRemise}</Badge>;
  }
  if (instrument.mode === "CHEQUE" || instrument.mode === "EFFET") {
    if (instrument.reglementBureau && instrument.dateEcheance && instrument.dateEcheance < TODAY) {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200">Échu au bureau</Badge>;
    }
    if (instrument.reglementBureau && instrument.dateEcheance === TODAY) {
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-200">À traiter aujourd’hui</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200">{instrument.reglementBureau ? "Règlement au bureau" : "À remettre"}</Badge>;
  }
  return <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-200">À rapprocher</Badge>;
}

function InstrumentAction({ instrument, canReplace, onReplace }: {
  instrument: PaymentInstrument;
  canReplace: boolean;
  onReplace: () => void;
}) {
  const replaceable = canReplace
    && instrument.statut === "EN_ATTENTE"
    && !instrument.bordereauRemiseId
    && instrument.reglementBureau
    && (instrument.mode === "CHEQUE" || instrument.mode === "EFFET");
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="icon" variant="ghost" title="Actions" aria-label={`Actions pour ${instrument.referenceInstrument || instrument.numeroReglement}`}>
        <MoreHorizontal className="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-56">
      {instrument.clientPayeurId && (
        <DropdownMenuItem asChild>
          <Link to={`/app/production/portefeuille-clients/${instrument.clientPayeurId}`}><UserRound className="size-4" /> Voir la fiche client</Link>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem asChild>
        <Link to={`/app/compta/reglements/${instrument.reglementId}`}>Voir le règlement <ArrowRight className="size-4" /></Link>
      </DropdownMenuItem>
      {instrument.bordereauRemiseId && (
        <DropdownMenuItem asChild>
          <Link to={`/app/compta/tresorerie/bordereaux-remise/${instrument.bordereauRemiseId}`}>Voir le bordereau <ArrowRight className="size-4" /></Link>
        </DropdownMenuItem>
      )}
      {replaceable && <DropdownMenuSeparator />}
      {replaceable && (
        <DropdownMenuItem className="text-emerald-700 focus:bg-emerald-50 focus:text-emerald-800 dark:text-emerald-300 dark:focus:bg-emerald-950/50 dark:focus:text-emerald-200" onSelect={onReplace}>
          <Banknote className="size-4" /> Remplacer par espèces
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function isSelectableForSlip(instrument: PaymentInstrument) {
  return instrument.statut === "EN_ATTENTE"
    && !instrument.bordereauRemiseId
    && (instrument.mode === "CHEQUE" || instrument.mode === "EFFET");
}

type CollectionQueueUrlState = {
  mode: ModeFilter;
  search: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  sortBy: InstrumentSortBy;
  sortDirection: SortDirection;
};

function collectionQueueStateFromParams(params: URLSearchParams): CollectionQueueUrlState {
  const mode = isModeFilter(params.get("mode")) ? params.get("mode") as ModeFilter : "ALL";
  const supportsDueDate = mode === "CHEQUE" || mode === "EFFET";
  return {
    mode,
    search: params.get("search")?.trim() ?? "",
    dateFrom: supportsDueDate ? validQueueDate(params.get("dateDu")) : "",
    dateTo: supportsDueDate ? validQueueDate(params.get("dateAu")) : "",
    page: queuePageFromParam(params.get("page")),
    sortBy: isInstrumentSort(params.get("tri")) ? params.get("tri") as InstrumentSortBy : "DUE",
    sortDirection: params.get("ordre") === "DESC" ? "DESC" : "ASC",
  };
}

function collectionQueueSearchParams(state: CollectionQueueUrlState) {
  const params = new URLSearchParams();
  if (state.mode !== "ALL") params.set("mode", state.mode);
  if (state.search) params.set("search", state.search);
  if (state.dateFrom) params.set("dateDu", state.dateFrom);
  if (state.dateTo) params.set("dateAu", state.dateTo);
  if (state.page > 0) params.set("page", String(state.page + 1));
  if (state.sortBy !== "DUE") params.set("tri", state.sortBy);
  if (state.sortDirection !== "ASC") params.set("ordre", state.sortDirection);
  return params;
}

function isModeFilter(value: string | null): value is ModeFilter {
  return value === "ALL"
    || value === "ESPECES"
    || value === "CHEQUE"
    || value === "EFFET"
    || value === "VIREMENT"
    || value === "VERSEMENT_BANCAIRE";
}

function isInstrumentSort(value: string | null): value is InstrumentSortBy {
  return value === "REFERENCE"
    || value === "PAYER"
    || value === "PAYMENT"
    || value === "MODE"
    || value === "RECEIVED"
    || value === "DUE"
    || value === "AMOUNT";
}

function validQueueDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function queuePageFromParam(value: string | null) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(page) && page > 0 ? page - 1 : 0;
}
