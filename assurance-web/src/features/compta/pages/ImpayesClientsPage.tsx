import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, MoreHorizontal, RefreshCcw, RotateCcw, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
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
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { PaymentInstrument } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY, TREASURY_PAGE_SIZE } from "./treasury-format";

type ModeFilter = "ALL" | "CHEQUE" | "EFFET";

export default function ImpayesClientsPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("reglement-client:manage");
  const mode = parseMode(params.get("mode"));
  const appliedSearch = params.get("search")?.trim() ?? "";
  const page = parsePage(params.get("page"));
  const [search, setSearch] = useState(appliedSearch);
  const [instrumentToRepresent, setInstrumentToRepresent] = useState<PaymentInstrument>();
  const [representationDate, setRepresentationDate] = useState(TODAY);
  const [representationReason, setRepresentationReason] = useState("");

  useEffect(() => setSearch(appliedSearch), [appliedSearch]);

  const instruments = useQuery({
    queryKey: ["compta", "treasury", "unpaid-instruments", mode, appliedSearch, page],
    queryFn: () => comptaApi.paymentInstruments({
      statut: "REJETE",
      modes: mode === "ALL" ? ["CHEQUE", "EFFET"] : [mode],
      search: appliedSearch || undefined,
      sortBy: "STATUS_DATE",
      sortDirection: "DESC",
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

  function updateUrl(next: { mode?: ModeFilter; search?: string; page?: number }) {
    const nextParams = new URLSearchParams(params);
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
      <header>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
        <h1 className="mt-1 text-xl font-semibold">Rejets bancaires</h1>
        <p className="text-sm text-muted-foreground">Suivi des chèques et effets rejetés par la banque.</p>
      </header>

      <section className="grid gap-3 rounded-md border bg-card p-4 lg:grid-cols-[220px_1fr_auto]">
        <div className="grid gap-2">
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
        <div className="grid gap-2">
          <Label htmlFor="unpaid-search">Référence, payeur ou règlement</Label>
          <Input
            id="unpaid-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && updateUrl({ search: search.trim() })}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button size="icon" title="Rechercher" onClick={() => updateUrl({ search: search.trim() })}><Search className="size-4" /></Button>
          <Button size="icon" variant="outline" title="Réinitialiser" onClick={() => {
            setSearch("");
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
              <th className="px-4 py-3 text-left">Rejeté le</th>
              <th className="px-4 py-3 text-left">Motif du rejet</th>
              <th className="px-4 py-3 text-left">Bordereau d’origine</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="w-20 px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody className="divide-y">
              {instruments.isLoading ? <TableRowsSkeleton colSpan={9} rows={6} /> : (instruments.data?.rows ?? []).map((instrument) => (
                <tr key={instrument.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{instrument.referenceInstrument || "-"}</td>
                  <td className="px-4 py-3">{instrument.payeurNom}</td>
                  <td className="px-4 py-3">{instrument.numeroReglement}</td>
                  <td className="px-4 py-3">{paymentModeLabel(instrument.mode)}</td>
                  <td className="px-4 py-3">{formatTreasuryDate(instrument.dateStatut)}</td>
                  <td className="max-w-72 px-4 py-3"><span className="line-clamp-2">{instrument.motifStatut || "-"}</span></td>
                  <td className="px-4 py-3">{instrument.bordereauRemiseId ? <Link className="font-medium text-blue-700 hover:underline dark:text-blue-300" to={`/app/compta/tresorerie/bordereaux-remise/${instrument.bordereauRemiseId}`}>{instrument.numeroBordereauRemise}</Link> : "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatTreasuryMoney(instrument.montant)}</td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" title="Actions"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-60">
                        <DropdownMenuItem asChild><Link to={`/app/compta/reglements/${instrument.reglementId}`}>Voir le règlement <ArrowRight className="size-4" /></Link></DropdownMenuItem>
                        {canManage && <DropdownMenuSeparator />}
                        {canManage && <DropdownMenuItem onSelect={() => openRepresentation(instrument)}><RefreshCcw className="size-4 text-blue-600 dark:text-blue-400" /> Représenter l’instrument</DropdownMenuItem>}
                        {canManage && <DropdownMenuItem asChild><Link to={`/app/compta/reglements/historique?search=${encodeURIComponent(instrument.numeroReglement)}&remplacer=${instrument.id}`}><RotateCcw className="size-4 text-amber-600 dark:text-amber-400" /> Remplacer le moyen de paiement</Link></DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {!instruments.isLoading && (instruments.data?.rows.length ?? 0) === 0 && <tr><td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">Aucun impayé ne correspond aux filtres.</td></tr>}
            </tbody>
          </table>
        </div>
        {instruments.data && <ServerPagination page={instruments.data.page.number} totalPages={instruments.data.page.totalPages} totalElements={instruments.data.page.totalElements} loading={instruments.isFetching} onPageChange={(nextPage) => updateUrl({ page: nextPage })} />}
      </section>

      <Dialog open={Boolean(instrumentToRepresent)} onOpenChange={(open) => !open && setInstrumentToRepresent(undefined)}>
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
            <div className="grid gap-2"><Label>Date de représentation</Label><DatePicker date={representationDate} minDate={instrumentToRepresent?.dateStatut ? new Date(`${instrumentToRepresent.dateStatut}T00:00:00`) : undefined} onSelect={(value) => setRepresentationDate(toDateOnly(value) ?? "")} /></div>
            <div className="grid gap-2"><Label htmlFor="representation-reason">Justification</Label><Textarea id="representation-reason" value={representationReason} onChange={(event) => setRepresentationReason(event.target.value)} placeholder="Ex. Provision reconstituée confirmée par le client" /></div>
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

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}
