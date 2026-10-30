import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Search } from "lucide-react";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import type { PaymentInstrument } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY } from "../pages/treasury-format";

export function BankRejectionDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [mode, setMode] = useState<"ALL" | "CHEQUE" | "EFFET">("ALL");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PaymentInstrument>();
  const [date, setDate] = useState(TODAY);
  const [reason, setReason] = useState("");
  const candidates = useQuery({
    queryKey: ["compta", "treasury", "bank-rejection-candidates", appliedSearch, mode, page],
    queryFn: () => comptaApi.paymentInstruments({
      statuts: ["REMIS_EN_BANQUE", "CONFIRME"],
      modes: mode === "ALL" ? ["CHEQUE", "EFFET"] : [mode],
      search: appliedSearch,
      sortBy: "REFERENCE", sortDirection: "ASC", page, size: 8,
    }),
    enabled: Boolean(appliedSearch),
  });
  const register = useMutation({
    mutationFn: () => comptaApi.registerBankRejection(selected!.id, { dateOperation: date, motif: reason.trim() }),
    onSuccess: async () => {
      toast.success("Rejet bancaire enregistré");
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["compta"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement du rejet impossible"),
  });
  const invalidDate = !date || date > TODAY || Boolean(selected?.dateStatut && date < selected.dateStatut);

  function submitSearch() {
    setSelected(undefined);
    setPage(0);
    setAppliedSearch(search.trim());
    if (search.trim() === appliedSearch && appliedSearch) void candidates.refetch();
  }

  return <Dialog open onOpenChange={(open) => !open && !register.isPending && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>Enregistrer un rejet bancaire</DialogTitle></DialogHeader>
      <form className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end" onSubmit={(event) => {
        event.preventDefault();
        submitSearch();
      }}>
        <div className="grid gap-2"><Label htmlFor="rejection-mode">Mode</Label>
          <Select value={mode} disabled={register.isPending} onValueChange={(value) => {
            setMode(value as typeof mode); setSelected(undefined); setPage(0);
          }}><SelectTrigger id="rejection-mode"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">Chèques et effets</SelectItem><SelectItem value="CHEQUE">Chèque</SelectItem><SelectItem value="EFFET">Effet</SelectItem>
          </SelectContent></Select>
        </div>
        <div className="grid gap-2"><Label htmlFor="rejection-reference">Référence du chèque ou effet, payeur ou règlement</Label>
          <Input id="rejection-reference" value={search} disabled={register.isPending} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Button type="submit" disabled={!search.trim() || register.isPending}><Search className="size-4" /> Rechercher</Button>
      </form>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[650px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase"><tr>
            <th className="w-12 p-3"><span className="sr-only">Sélection</span></th><th className="p-3">Référence</th>
            <th className="p-3">Payeur</th><th className="p-3">Mode / banque</th><th className="p-3 text-right">Montant</th>
          </tr></thead>
          <tbody className="divide-y">
            {candidates.isLoading ? <TableRowsSkeleton colSpan={5} rows={3} /> : (candidates.data?.rows ?? []).map((instrument) => <tr key={instrument.id} className={selected?.id === instrument.id ? "bg-muted/60" : "hover:bg-muted/30"}>
              <td className="p-3"><input type="radio" name="rejected-instrument" checked={selected?.id === instrument.id}
                disabled={!instrument.rejetBancairePossible || register.isPending}
                aria-label={`Sélectionner ${instrument.referenceInstrument || instrument.numeroReglement}`}
                onChange={() => setSelected(instrument)} /></td>
              <td className="p-3 font-medium">{instrument.referenceInstrument || "-"}<div className="text-xs font-normal text-muted-foreground">{instrument.numeroReglement}</div></td>
              <td className="p-3">{instrument.payeurNom}</td><td className="p-3">{paymentModeLabel(instrument.mode)}<div className="text-xs text-muted-foreground">{instrument.banqueEmettrice || "-"}</div></td>
              <td className="p-3 text-right tabular-nums">{formatTreasuryMoney(instrument.montant)}</td>
            </tr>)}
            {!appliedSearch && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Recherchez un chèque ou un effet.</td></tr>}
            {appliedSearch && candidates.isError && <tr><td colSpan={5} className="p-6 text-center text-destructive">Recherche impossible. Relancez la recherche.</td></tr>}
            {appliedSearch && !candidates.isLoading && !candidates.isError && candidates.data?.rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucun chèque ou effet remis en banque ou encaissé ne correspond.</td></tr>}
          </tbody>
        </table>
      </div>
      {candidates.data && <ServerPagination page={page} totalPages={candidates.data.page.totalPages} totalElements={candidates.data.page.totalElements} loading={candidates.isFetching || register.isPending} onPageChange={(next) => { setPage(next); setSelected(undefined); }} />}
      {selected && <p className="text-sm font-medium">{selected.referenceInstrument || selected.numeroReglement} · {selected.payeurNom} · {formatTreasuryMoney(selected.montant)}
        <span className="ml-2 font-normal text-muted-foreground">{selected.statut === "CONFIRME" ? "Encaissé le" : "Remis le"} {formatTreasuryDate(selected.dateStatut)}</span>
      </p>}
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="grid content-start gap-2"><Label>Date du rejet</Label><DatePicker date={date}
          disabled={register.isPending}
          minDate={selected?.dateStatut ? new Date(`${selected.dateStatut}T00:00:00`) : undefined}
          maxDate={new Date(`${TODAY}T00:00:00`)} onSelect={(value) => setDate(toDateOnly(value) ?? "")} /></div>
        <div className="grid gap-2"><Label htmlFor="bank-rejection-reason">Motif du rejet</Label><Textarea id="bank-rejection-reason" maxLength={500} value={reason} disabled={register.isPending} onChange={(event) => setReason(event.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={register.isPending} onClick={onClose}>Annuler</Button>
        <Button disabled={!selected?.rejetBancairePossible || invalidDate || !reason.trim() || register.isPending} onClick={() => register.mutate()}><Ban className="size-4" />{register.isPending ? "Enregistrement..." : "Enregistrer le rejet"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
