import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, MoreHorizontal, Plus, Printer, RefreshCw, RotateCcw, Search, XCircle } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { AccessDenied, ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { ClientPaymentDetailsDialog } from "../components/ClientPaymentDetailsDialog";
import { ConventionWorkspaceHeader } from "../components/ConventionWorkspaceHeader";
import { formatAccountingAmount } from "../format";
import { formatTreasuryDate, paymentModeLabel } from "./treasury-format";
import type { ClientPayment, ClientPaymentMode } from "../types";

const emptyFilters = { convention: "ALL", search: "", status: "ALL", mode: "ALL" };
const modes: ClientPaymentMode[] = ["ESPECES", "VIREMENT", "VERSEMENT_BANCAIRE", "CHEQUE", "EFFET"];

export default function ConventionPaymentHistoryPage() {
  const incoming = useLocation().pathname.startsWith("/app/compta/conventions/encaissements");
  const sens = incoming ? "ENTREE" : "SORTIE";
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canView = permissions.includes("reglement-client:view");
  const canCreate = permissions.includes(incoming ? "reglement-client:create" : "reglement-client:refund");
  const canCancel = permissions.includes("reglement-client:cancel");
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(0);
  const [cancelling, setCancelling] = useState<ClientPayment>();
  const [reason, setReason] = useState("");
  const [openingPdf, setOpeningPdf] = useState(false);
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const options = useQuery({ queryKey: ["compta", "convention-billing-options", year],
    queryFn: () => comptaApi.conventionBillingOptions(year), enabled: canView });
  const payments = useQuery({
    queryKey: ["compta", "client-payments", "conventions", sens, applied, page],
    queryFn: () => comptaApi.conventionPayments({ sens,
      conventionId: applied.convention === "ALL" ? undefined : applied.convention,
      search: applied.search.trim() || undefined,
      statut: applied.status === "ALL" ? undefined : applied.status as ClientPayment["statut"],
      mode: applied.mode === "ALL" ? undefined : applied.mode as ClientPaymentMode,
      page, size: 25 }),
    enabled: canView, staleTime: 0,
  });
  const cancel = useMutation({
    mutationFn: () => {
      if (!cancelling || !reason.trim()) throw new Error("Renseignez le motif d'annulation.");
      return comptaApi.cancelClientPayment(cancelling.id, reason.trim());
    },
    onSuccess: async () => {
      setCancelling(undefined); setReason("");
      await Promise.all(["client-payments", "client-payment", "client-receivables", "convention-invoice-receivables", "treasury"]
        .map(key => queryClient.invalidateQueries({ queryKey: ["compta", key] })));
      toast.success("Règlement annulé");
    },
    onError: error => toast.error(error.message),
  });
  function apply() { setApplied({ ...filters, search: filters.search.trim() }); setPage(0); }
  function closeDetail() {
    const next = new URLSearchParams(params); next.delete("reglementId"); setParams(next, { replace: true });
  }
  async function openPdf(id: string) {
    if (openingPdf) return;
    const tab = window.open("about:blank", "_blank");
    if (!tab) { toast.error("Autorisez les fenêtres contextuelles pour ouvrir le PDF."); return; }
    tab.opener = null; setOpeningPdf(true);
    try {
      const url = URL.createObjectURL(await comptaApi.clientPaymentPdf(id));
      if (tab.closed) URL.revokeObjectURL(url);
      else { tab.location.href = url; window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    } catch (error) {
      tab.close(); toast.error(error instanceof Error ? error.message : "Ouverture du PDF impossible");
    } finally { setOpeningPdf(false); }
  }
  if (!canView) return <AccessDenied />;
  return <div className="mx-auto grid w-full max-w-[1600px] gap-4">
    <ConventionWorkspaceHeader title={incoming ? "Encaissements enregistrés" : "Règlements"} />
    <div className="flex justify-end gap-2">
      {incoming && <Button variant="outline" asChild><Link to="/app/compta/conventions/encaissements">Factures à encaisser</Link></Button>}
      {canCreate && <Button asChild><Link to={incoming ? "/app/compta/conventions/encaissements" : "/app/compta/conventions/reglements/nouveau"}>
        <Plus className="size-4" />{incoming ? "Nouvel encaissement" : "Nouveau règlement"}
      </Link></Button>}
    </div>
    <section className="flex flex-wrap items-end gap-3 border-y bg-card p-4">
      <div className="grid min-w-0 flex-[1_1_240px] gap-1.5"><Label htmlFor="convention-payment-search">N° règlement / bénéficiaire / référence</Label>
        <Input id="convention-payment-search" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))}
          onKeyDown={event => { if (event.key === "Enter") apply(); }} />
      </div>
      <div className="grid min-w-0 flex-[1_1_200px] gap-1.5"><Label htmlFor="convention-payment-convention">Convention</Label>
        <Select value={filters.convention} disabled={options.isPending || options.isError} onValueChange={convention => setFilters(current => ({ ...current, convention }))}>
          <SelectTrigger id="convention-payment-convention"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les conventions</SelectItem>
            {options.data?.map(option => <SelectItem key={option.id} value={option.id}>{option.intitule}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid min-w-0 flex-[1_1_170px] gap-1.5"><Label htmlFor="convention-payment-mode">Mode de règlement</Label>
        <Select value={filters.mode} onValueChange={mode => setFilters(current => ({ ...current, mode }))}>
          <SelectTrigger id="convention-payment-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les modes</SelectItem>
            {modes.map(mode => <SelectItem key={mode} value={mode}>{paymentModeLabel(mode)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid min-w-0 flex-[1_1_150px] gap-1.5"><Label htmlFor="convention-payment-status">État</Label>
        <Select value={filters.status} onValueChange={status => setFilters(current => ({ ...current, status }))}>
          <SelectTrigger id="convention-payment-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les états</SelectItem><SelectItem value="VALIDE">Enregistré</SelectItem><SelectItem value="ANNULE">Annulé</SelectItem></SelectContent>
        </Select>
      </div>
      <Button size="icon" title="Rechercher" aria-label="Rechercher" onClick={apply}><Search className="size-4" /></Button>
      <Button size="icon" variant="outline" title="Réinitialiser" aria-label="Réinitialiser" onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); setPage(0); }}><RotateCcw className="size-4" /></Button>
      <Button size="icon" variant="outline" title="Actualiser" aria-label="Actualiser" disabled={payments.isFetching} onClick={() => void payments.refetch()}><RefreshCw className="size-4" /></Button>
      {options.isError && <p role="alert" className="w-full text-sm text-destructive">{options.error.message}</p>}
    </section>
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between gap-3 border-b p-4"><h2 className="font-semibold">{incoming ? "Encaissements enregistrés" : "Règlements enregistrés"}</h2><span className="text-xs text-muted-foreground">Montants en MAD</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-orange-600 text-left text-xs uppercase text-white"><tr>
          {["N° règlement", "Date", incoming ? "Payeur" : "Bénéficiaire", "Nature", "Montant", "Mode", "État", "Actions"].map(label => <th key={label} className={`px-3 py-3 ${["Montant", "Actions"].includes(label) ? "text-right" : ""}`}>{label}</th>)}
        </tr></thead>
        <tbody className="divide-y">
          {payments.isPending ? <TableRowsSkeleton rows={5} colSpan={8} />
            : payments.isError ? <tr><td colSpan={8} className="p-8 text-center"><p role="alert" className="text-destructive">{payments.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void payments.refetch()}>Réessayer</Button></td></tr>
              : !payments.data?.rows.length ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">{incoming ? "Aucun encaissement enregistré pour ces critères." : "Aucun règlement enregistré pour ces critères."}</td></tr>
                : payments.data.rows.map(payment => <tr key={payment.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3"><button type="button" className="font-medium text-sky-700 hover:underline dark:text-sky-300" onClick={() => { const next = new URLSearchParams(params); next.set("reglementId", payment.id); setParams(next); }}>{payment.numero}</button></td>
                  <td className="whitespace-nowrap px-3 py-3">{formatTreasuryDate(payment.dateReglement)}</td>
                  <td className="px-3 py-3">{payment.payeurNom}
                    {incoming && <div className="mt-1 text-xs text-muted-foreground">{payment.circuit === "DIRECT_COMPAGNIE" ? `Compagnie · ${payment.compagnieDirecte || "-"}` : "Cabinet"}</div>}
                  </td><td className="px-3 py-3">{incoming ? "Encaissement" : "Ristourne"}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatAccountingAmount(payment.montantTotal)}</td>
                  <td className="px-3 py-3">{[...new Set(payment.instruments.filter(instrument => instrument.statut !== "REMPLACE").map(instrument => paymentModeLabel(instrument.mode)))].join(", ") || "-"}</td>
                  <td className="px-3 py-3"><Badge variant={payment.statut === "VALIDE" ? "success" : "secondary"}>{payment.statut === "VALIDE" ? "Enregistré" : "Annulé"}</Badge></td>
                  <td className="px-3 py-3 text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" title="Actions" aria-label={`Actions pour ${payment.numero}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { const next = new URLSearchParams(params); next.set("reglementId", payment.id); setParams(next); }}><Eye className="size-4" />Voir le détail</DropdownMenuItem>
                      <DropdownMenuItem disabled={openingPdf} onSelect={() => void openPdf(payment.id)}><Printer className="size-4" />Fiche de règlement PDF</DropdownMenuItem>
                      {canCancel && payment.statut === "VALIDE" && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => { setReason(""); setCancelling(payment); }}><XCircle className="size-4" />Annuler le règlement</DropdownMenuItem></>}
                    </DropdownMenuContent>
                  </DropdownMenu></td>
                </tr>)}
        </tbody>
      </table></div>
      <ServerPagination className="border-t px-4 py-3" page={payments.data?.page.number ?? page} totalPages={payments.data?.page.totalPages ?? 0}
        totalElements={payments.data?.page.totalElements ?? 0} loading={payments.isFetching} onPageChange={setPage} />
    </section>
    {params.get("reglementId") && <ClientPaymentDetailsDialog paymentId={params.get("reglementId")!} onClose={closeDetail} />}
    <Dialog open={Boolean(cancelling)} onOpenChange={open => { if (!open && !cancel.isPending) setCancelling(undefined); }}>
      <DialogContent><DialogHeader><DialogTitle>Annuler {cancelling?.numero}</DialogTitle><DialogDescription>Les affectations seront annulées. Les écritures de trésorerie éventuelles seront extournées.</DialogDescription></DialogHeader>
        <div className="grid gap-2"><Label htmlFor="convention-cancel-reason">Motif d'annulation *</Label><Textarea id="convention-cancel-reason" value={reason} maxLength={500} disabled={cancel.isPending} onChange={event => setReason(event.target.value)} /></div>
        <DialogFooter><Button variant="outline" disabled={cancel.isPending} onClick={() => setCancelling(undefined)}>Fermer</Button><Button variant="destructive" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? "Annulation..." : "Confirmer l'annulation"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
