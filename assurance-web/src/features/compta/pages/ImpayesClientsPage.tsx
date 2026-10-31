import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, MoreHorizontal, Plus, RefreshCcw, RotateCcw, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Button } from "@/components/ui/button";
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
import { toDateOnly } from "@/features/production/date";
import { clientApi } from "@/features/production/api/clients";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { BankRejectionDialog } from "../components/BankRejectionDialog";
import { ReplacePaymentInstrumentDialog } from "../components/ReplacePaymentInstrumentDialog";
import { usePayerSearch, type PayerSelection, type PayerType } from "../components/use-payer-search";
import type { PaymentInstrument } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY, TREASURY_PAGE_SIZE } from "./treasury-format";

type ModeFilter = "ALL" | "CHEQUE" | "EFFET";

export default function ImpayesClientsPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("reglement-client:manage");
  const canReject = permissions.includes("tresorerie:manage");
  const mode = parseMode(params.get("mode"));
  const appliedSearch = params.get("search")?.trim() ?? "";
  const page = parsePage(params.get("page"));
  const dateFrom = parseDate(params.get("dateDu"));
  const dateTo = parseDate(params.get("dateAu"));
  const bankId = params.get("banqueId") ?? "";
  const payerType: PayerType = params.get("cible") === "GROUPE" ? "GROUPE" : "CLIENT";
  const payerId = params.get("payeurId") ?? "";
  const [selectedPayer, setSelectedPayer] = useState<PayerSelection>();
  const payerSearch = usePayerSearch(payerType, selectedPayer);
  const [rejectionOpen, setRejectionOpen] = useState(false);
  const [replacementTarget, setReplacementTarget] = useState<PaymentInstrument>();
  const [search, setSearch] = useState(appliedSearch);
  const [instrumentToRepresent, setInstrumentToRepresent] = useState<PaymentInstrument>();
  const [representationDate, setRepresentationDate] = useState(TODAY);
  const [representationReason, setRepresentationReason] = useState("");

  useEffect(() => setSearch(appliedSearch), [appliedSearch]);

  useEffect(() => {
    if (!params.has("resolution")) return;
    const next = new URLSearchParams(params);
    next.delete("resolution");
    next.delete("page");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const banks = useQuery({ queryKey: ["compta", "banks", "all"], queryFn: () => comptaApi.banks(true) });
  const requestedClient = useQuery({
    queryKey: ["crm-client", payerId], queryFn: () => clientApi.getClientCrm(payerId),
    enabled: Boolean(payerId) && payerType === "CLIENT",
  });
  useEffect(() => {
    if (!payerId) { setSelectedPayer(undefined); return; }
    if (selectedPayer?.id === payerId && selectedPayer.type === payerType) return;
    if (payerType === "CLIENT" && requestedClient.data?.client) {
      const client = requestedClient.data.client;
      setSelectedPayer({ type: "CLIENT", id: client.id, name: client.nomAffichage || "Client", identifier: client.codeClient || "" });
    } else if (payerType === "GROUPE") {
      const group = payerSearch.groups.find((item) => item.id === payerId);
      if (group) setSelectedPayer({ type: "GROUPE", id: group.id, name: group.libelle, identifier: group.code });
    }
  }, [payerId, payerType, selectedPayer?.id, selectedPayer?.type, requestedClient.data, payerSearch.groups]);

  const instruments = useQuery({
    queryKey: ["compta", "treasury", "bank-rejections", mode, appliedSearch, dateFrom, dateTo, bankId, payerType, payerId, page],
    queryFn: () => comptaApi.bankRejections({
      mode: mode === "ALL" ? undefined : mode,
      search: appliedSearch || undefined,
      dateDu: dateFrom || undefined, dateAu: dateTo || undefined,
      banqueId: bankId || undefined,
      payeurType: payerId ? payerType : undefined, payeurId: payerId || undefined,
      page,
      size: TREASURY_PAGE_SIZE,
    }),
  });

  const representInstrument = useMutation({
    mutationFn: () => comptaApi.representPaymentInstrument(instrumentToRepresent!.id, {
      dateRepresentation: representationDate,
      motif: representationReason.trim(),
    }),
    onSuccess: async () => {
      toast.success("Instrument prêt pour un nouveau bordereau");
      setInstrumentToRepresent(undefined);
      setRepresentationReason("");
      await queryClient.invalidateQueries({ queryKey: ["compta"] });
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Représentation impossible"
    ),
  });

  function updateUrl(next: { mode?: ModeFilter; search?: string; page?: number; dateDu?: string; dateAu?: string; banqueId?: string; cible?: PayerType; payeurId?: string }) {
    const nextParams = new URLSearchParams(params);
    nextParams.delete("resolution");
    for (const key of ["dateDu", "dateAu", "banqueId", "cible", "payeurId"] as const) {
      const value = next[key];
      if (value === undefined) continue;
      if (!value || value === "ALL") nextParams.delete(key);
      else nextParams.set(key, value);
    }
    if (next.mode !== undefined) {
      if (next.mode === "ALL") nextParams.delete("mode");
      else nextParams.set("mode", next.mode);
    }
    if (next.search !== undefined) {
      if (next.search) nextParams.set("search", next.search);
      else nextParams.delete("search");
    }
    if (next.page !== undefined) {
      if (next.page === 0) nextParams.delete("page");
      else nextParams.set("page", String(next.page));
    } else {
      nextParams.delete("page");
    }
    setParams(nextParams, { replace: true });
  }

  function openRepresentation(instrument: PaymentInstrument) {
    setInstrumentToRepresent(instrument);
    setRepresentationDate(TODAY);
    setRepresentationReason("");
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">Rejets bancaires</h1>
          <p className="text-sm text-muted-foreground">Suivi des chèques et effets rejetés par la banque.</p>
        </div>
        {canReject && <Button onClick={() => setRejectionOpen(true)}><Plus className="size-4" /> Enregistrer un rejet</Button>}
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4">
        <div className="grid w-full min-w-0 gap-2 sm:w-44">
          <Label id="unpaid-payer-scope">Cible</Label>
          <div role="group" aria-labelledby="unpaid-payer-scope" className="flex h-10 items-center rounded-md border bg-muted/40 p-1">
            {(["CLIENT", "GROUPE"] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                aria-pressed={payerType === scope}
                className={`h-8 flex-1 rounded-sm px-3 text-sm font-medium ${
                  payerType === scope
                    ? "bg-amber-100 text-amber-950 shadow-sm ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700"
                    : "text-slate-600 hover:bg-background/70 hover:text-foreground dark:text-slate-300"
                }`}
                onClick={() => {
                  if (payerType === scope) return;
                  setSelectedPayer(undefined);
                  payerSearch.clearQuery();
                  updateUrl({ cible: scope, payeurId: "" });
                }}
              >
                {scope === "CLIENT" ? "Client" : "Groupe"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid w-full min-w-0 gap-2 sm:w-60">
          <Label>{payerType === "CLIENT" ? "Rechercher un client" : "Rechercher un groupe"}</Label>
          <AutocompleteSelect
            options={payerSearch.options} value={payerId}
            onValueChange={(value) => { setSelectedPayer(payerSearch.resolve(value)); updateUrl({ payeurId: value }); }}
            onQueryChange={payerType === "CLIENT" ? payerSearch.setQuery : undefined}
            placeholder={payerType === "CLIENT" ? "Nom, RC, CIN, ICE ou code" : "Code, groupe ou membre"}
            emptyText={payerSearch.loading ? "Chargement..." : "Aucun résultat"}
          />
        </div>
        <div className="grid w-full min-w-0 gap-2 sm:w-44">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(value) => updateUrl({ mode: value as ModeFilter })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Chèques et effets</SelectItem>
              <SelectItem value="CHEQUE">Chèques</SelectItem>
              <SelectItem value="EFFET">Effets</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-full min-w-0 gap-2 sm:w-48"><Label>Banque émettrice</Label><Select value={bankId || "ALL"} disabled={banks.isLoading} onValueChange={(value) => updateUrl({ banqueId: value === "ALL" ? "" : value })}>
          <SelectTrigger><SelectValue placeholder="Toutes les banques" /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">Toutes les banques</SelectItem>{(banks.data ?? []).map((bank) => <SelectItem key={bank.id} value={bank.id}>{bank.libelle}</SelectItem>)}
          </SelectContent></Select></div>
        <div className="grid w-full min-w-0 gap-2 sm:w-44"><Label>Rejet du</Label><DatePicker date={dateFrom} maxDate={dateTo ? new Date(`${dateTo}T00:00:00`) : undefined} onSelect={(value) => updateUrl({ dateDu: toDateOnly(value) ?? "" })} /></div>
        <div className="grid w-full min-w-0 gap-2 sm:w-44"><Label>Rejet au</Label><DatePicker date={dateTo} minDate={dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined} onSelect={(value) => updateUrl({ dateAu: toDateOnly(value) ?? "" })} /></div>
        <div className="grid w-full min-w-0 gap-2 sm:w-64">
          <Label htmlFor="unpaid-search">Référence, payeur ou règlement</Label>
          <Input
            id="unpaid-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && updateUrl({ search: search.trim() })}
          />
        </div>
        <div className="flex shrink-0 items-end gap-2">
          <Button size="icon" title="Rechercher" onClick={() => updateUrl({ search: search.trim() })}><Search className="size-4" /></Button>
          <Button size="icon" variant="outline" title="Réinitialiser" onClick={() => {
            setSearch("");
            setSelectedPayer(undefined); payerSearch.clearQuery();
            setParams(new URLSearchParams(), { replace: true });
          }}><RotateCcw className="size-4" /></Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
              <th className="px-4 py-3 text-left">Référence</th>
              <th className="px-4 py-3 text-left">Payeur</th>
              <th className="px-4 py-3 text-left">Règlement</th>
              <th className="px-4 py-3 text-left">Mode</th>
              <th className="px-4 py-3 text-left">Banque</th>
              <th className="px-4 py-3 text-left">Rejeté le</th>
              <th className="px-4 py-3 text-left">Motif du rejet</th>
              <th className="px-4 py-3 text-left">Bordereau d’origine</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3 text-left">Traitement</th>
              <th className="w-20 px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody className="divide-y">
              {instruments.isLoading ? <TableRowsSkeleton colSpan={11} rows={6} /> : (instruments.data?.rows ?? []).map((instrument) => (
                <tr key={instrument.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{instrument.referenceInstrument || "-"}</td>
                  <td className="px-4 py-3">{instrument.payeurNom}</td>
                  <td className="px-4 py-3">{instrument.numeroReglement}</td>
                  <td className="px-4 py-3">{paymentModeLabel(instrument.mode)}</td>
                  <td className="px-4 py-3">{instrument.banqueEmettrice || "-"}</td>
                  <td className="px-4 py-3">{formatTreasuryDate(instrument.dateRejet)}</td>
                  <td className="max-w-72 px-4 py-3"><span className="line-clamp-2" title={instrument.motifRejet || undefined}>{instrument.motifRejet || "-"}</span></td>
                  <td className="px-4 py-3">{instrument.bordereauRemiseId ? <Link className="font-medium text-blue-700 hover:underline dark:text-blue-300" to={`/app/compta/tresorerie/bordereaux-remise/${instrument.bordereauRemiseId}`}>{instrument.numeroBordereauRemise}</Link> : "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatTreasuryMoney(instrument.montant)}</td>
                  <td className="px-4 py-3"><Badge variant={instrument.resolutionRejet === "A_TRAITER" ? "destructive" : "secondary"}>{instrument.resolutionRejet === "A_TRAITER" ? "À traiter" : instrument.resolutionRejet === "REMPLACE" ? "Remplacé" : instrument.resolutionRejet === "REPRESENTE" ? "Représenté" : "-"}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" title="Actions"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-60">
                        <DropdownMenuItem asChild><Link to={`/app/compta/reglements/${instrument.reglementId}`}>Voir le règlement <ArrowRight className="size-4" /></Link></DropdownMenuItem>
                        {canManage && instrument.statut === "REJETE" && (instrument.representationPossible || instrument.remplacementPossible) && <DropdownMenuSeparator />}
                        {canManage && instrument.representationPossible && <DropdownMenuItem onSelect={() => openRepresentation(instrument)}><RefreshCcw className="size-4 text-blue-600 dark:text-blue-400" /> Représenter l’instrument</DropdownMenuItem>}
                        {canManage && instrument.statut === "REJETE" && instrument.remplacementPossible && <DropdownMenuItem onSelect={() => setReplacementTarget(instrument)}><RotateCcw className="size-4 text-amber-600 dark:text-amber-400" /> Remplacer le moyen de paiement</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {instruments.isError && <tr><td colSpan={11} className="px-4 py-14 text-center text-destructive">Chargement des rejets impossible. <Button variant="link" onClick={() => void instruments.refetch()}>Réessayer</Button></td></tr>}
              {!instruments.isLoading && !instruments.isError && (instruments.data?.rows.length ?? 0) === 0 && <tr><td colSpan={11} className="px-4 py-14 text-center text-muted-foreground">Aucun rejet ne correspond aux filtres.</td></tr>}
            </tbody>
          </table>
        </div>
        {instruments.data && <ServerPagination page={instruments.data.page.number} totalPages={instruments.data.page.totalPages} totalElements={instruments.data.page.totalElements} loading={instruments.isFetching} onPageChange={(nextPage) => updateUrl({ page: nextPage })} />}
      </section>

      {rejectionOpen && <BankRejectionDialog onClose={() => setRejectionOpen(false)} />}
      {replacementTarget && <ReplacePaymentInstrumentDialog instrument={replacementTarget} onClose={() => setReplacementTarget(undefined)} />}

      <Dialog open={Boolean(instrumentToRepresent)} onOpenChange={(open) => !open && !representInstrument.isPending && setInstrumentToRepresent(undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Représenter l’instrument</DialogTitle>
            <DialogDescription>
              La présentation rejetée reste dans l’historique. L’instrument sera disponible pour un nouveau bordereau.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="font-semibold">{instrumentToRepresent?.referenceInstrument || instrumentToRepresent?.numeroReglement}</span><Badge variant="destructive">Impayé</Badge></div>
            <div className="mt-1 text-muted-foreground">{instrumentToRepresent?.payeurNom} · {formatTreasuryMoney(instrumentToRepresent?.montant ?? 0)}</div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Date de représentation</Label><DatePicker date={representationDate} disabled={representInstrument.isPending} maxDate={new Date(`${TODAY}T00:00:00`)} minDate={instrumentToRepresent?.dateRejet ? new Date(`${instrumentToRepresent.dateRejet}T00:00:00`) : undefined} onSelect={(value) => setRepresentationDate(toDateOnly(value) ?? "")} /></div>
            <div className="grid gap-2"><Label htmlFor="representation-reason">Justification</Label><Textarea id="representation-reason" value={representationReason} maxLength={500} disabled={representInstrument.isPending} onChange={(event) => setRepresentationReason(event.target.value)} placeholder="Ex. Provision reconstituée confirmée par le client" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={representInstrument.isPending} onClick={() => setInstrumentToRepresent(undefined)}>Annuler</Button>
            <Button disabled={!representationDate || !representationReason.trim() || representInstrument.isPending} onClick={() => representInstrument.mutate()}>{representInstrument.isPending ? "Enregistrement..." : "Préparer la nouvelle remise"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseMode(value: string | null): ModeFilter {
  return value === "CHEQUE" || value === "EFFET" ? value : "ALL";
}

function parseDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}
