import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Banknote, Download, Eye, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AccessDenied, ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateOnly } from "@/features/production/date";
import { downloadBlob } from "@/lib/download";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { ClientPaymentDetailsDialog } from "../components/ClientPaymentDetailsDialog";
import { ConventionWorkspaceHeader } from "../components/ConventionWorkspaceHeader";
import { formatAccountingAmount } from "../format";
import type { ClientReceivable } from "../types";

const labels = {
  IMPAYEE: "À encaisser", PARTIELLEMENT_REGLEE: "Partiellement réglée",
  COUVERTE_EN_ATTENTE: "Encaissement en cours", PAYEE: "Soldée",
} as const;
const variants = { IMPAYEE: "warning", PARTIELLEMENT_REGLEE: "accent", COUVERTE_EN_ATTENTE: "info", PAYEE: "success" } as const;
const emptyFilters = { conventionId: "ALL", search: "", dateDu: "", dateAu: "", includeSettled: true };

export default function ConventionCollectionsPage() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canView = permissions.includes("reglement-client:view");
  const canViewDocuments = permissions.includes("quittance:view");
  const canCreate = canView && (permissions.includes("reglement-client:create") || permissions.includes("reglement-client:manage"));
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, ClientReceivable>>({});
  const year = new Date().getFullYear();
  const options = useQuery({
    queryKey: ["compta", "convention-billing-options", year],
    queryFn: () => comptaApi.conventionBillingOptions(year), enabled: canView && canViewDocuments,
  });
  const invoices = useQuery({
    queryKey: ["compta", "convention-invoice-receivables", applied, page],
    queryFn: () => comptaApi.clientInvoiceReceivables({
      conventionsOnly: true,
      conventionId: applied.conventionId === "ALL" ? undefined : applied.conventionId,
      includeSettled: applied.includeSettled,
      search: applied.search.trim() || undefined,
      dateDu: applied.dateDu || undefined, dateAu: applied.dateAu || undefined,
      sortBy: "DATE", sortDirection: "DESC", page, size: 25,
    }),
    enabled: canView, refetchOnMount: "always",
  });
  const rows = invoices.data?.rows ?? [];
  const selectedRows = rows.filter(row => row.source.documentClientId
    && selected[row.source.documentClientId] && row.soldeOuvert > 0);
  const firstPayer = selectedRows[0] ? payerKey(selectedRows[0]) : undefined;
  const eligible = rows.filter(row => row.source.documentClientId && row.soldeOuvert > 0
    && (!firstPayer || payerKey(row) === firstPayer));
  const allSelected = eligible.length > 0 && eligible.every(row => selected[row.source.documentClientId!]);

  function apply() {
    if (filters.dateDu && filters.dateAu && filters.dateDu > filters.dateAu) {
      toast.error("La date de début doit précéder la date de fin.");
      return;
    }
    setApplied({ ...filters }); setPage(0); setSelected({});
  }
  function collect(items: ClientReceivable[]) {
    if (!canCreate || !items.length || items.some(row => row.soldeOuvert <= 0 || !row.source.documentClientId)
      || items.some(row => payerKey(row) !== payerKey(items[0]))) return;
    const query = new URLSearchParams();
    items.forEach(row => query.append("selectionDocument", row.source.documentClientId!));
    navigate(`/app/compta/conventions/encaissements/nouveau?${query}`);
  }
  function closeDetail() {
    const next = new URLSearchParams(params); next.delete("documentId"); next.delete("reglementId");
    setParams(next, { replace: true });
  }
  function showDocument(id: string) {
    const next = new URLSearchParams(params); next.set("documentId", id); setParams(next, { replace: true });
  }

  if (!canView) return <AccessDenied />;
  return <div className="mx-auto grid w-full max-w-[1600px] gap-4">
    <ConventionWorkspaceHeader title="Encaissement des factures" />
    <section className="grid gap-3 border-y bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
      {canViewDocuments && <div className="grid gap-1.5"><Label htmlFor="collection-convention">Convention</Label>
        <Select value={filters.conventionId} disabled={options.isPending || options.isError} onValueChange={value => setFilters(current => ({ ...current, conventionId: value }))}>
          <SelectTrigger id="collection-convention"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">Toutes les conventions</SelectItem>
            {options.data?.map(option => <SelectItem key={option.id} value={option.id}>{option.intitule}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>}
      <div className="grid gap-1.5"><Label htmlFor="collection-search">N° facture / payeur</Label>
        <Input id="collection-search" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))}
          onKeyDown={event => { if (event.key === "Enter") apply(); }} />
      </div>
      <div className="grid gap-1.5"><Label>Émise du</Label><DatePicker date={filters.dateDu} onSelect={date => setFilters(current => ({ ...current, dateDu: toDateOnly(date) ?? "" }))} /></div>
      <div className="grid gap-1.5"><Label>Au</Label><DatePicker date={filters.dateAu} onSelect={date => setFilters(current => ({ ...current, dateAu: toDateOnly(date) ?? "" }))} /></div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 xl:col-span-4">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={filters.includeSettled} onCheckedChange={checked => setFilters(current => ({ ...current, includeSettled: checked === true }))} />Inclure les factures soldées</label>
        <div className="flex gap-2">
          <Button size="icon" title="Rechercher" aria-label="Rechercher" onClick={apply}><Search className="size-4" /></Button>
          <Button variant="outline" size="icon" title="Réinitialiser" aria-label="Réinitialiser" onClick={() => {
            setFilters(emptyFilters); setApplied(emptyFilters); setPage(0); setSelected({});
          }}><RotateCcw className="size-4" /></Button>
          <Button variant="outline" size="icon" title="Actualiser" aria-label="Actualiser" disabled={invoices.isFetching} onClick={() => { setSelected({}); void invoices.refetch(); }}><RefreshCw className="size-4" /></Button>
        </div>
      </div>
      {options.isError && canViewDocuments && <p role="alert" className="text-sm text-destructive sm:col-span-2 xl:col-span-4">{options.error.message}</p>}
    </section>
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <h2 className="font-semibold">Factures conventions</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">Montants en MAD</span>
          {canCreate && <Button disabled={!selectedRows.length || invoices.isFetching || invoices.isError} onClick={() => collect(selectedRows)}><Banknote className="size-4" />Encaisser ({selectedRows.length})</Button>}
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-orange-600 text-left text-xs uppercase text-white"><tr>
          <th className="w-10 px-3 py-3">{canCreate && <Checkbox aria-label="Sélectionner les factures du même payeur" checked={allSelected} disabled={!eligible.length || invoices.isFetching || invoices.isError} onCheckedChange={checked => {
            if (!checked) { setSelected({}); return; }
            const key = firstPayer ?? (eligible[0] ? payerKey(eligible[0]) : undefined);
            setSelected(current => ({ ...current, ...Object.fromEntries(eligible.filter(row => payerKey(row) === key).map(row => [row.source.documentClientId!, row])) }));
          }} />}</th>
          {["Facture", "Payeur", "Date d'émission", "Échéance"].map(label => <th key={label} className="px-3 py-3">{label}</th>)}
          {["TTC", "Encaissé", "En attente", "Reste à affecter"].map(label => <th key={label} className="px-3 py-3 text-right">{label}</th>)}
          <th className="px-3 py-3">Statut</th><th className="px-3 py-3 text-right">Actions</th>
        </tr></thead>
        <tbody className="divide-y">
          {invoices.isPending ? <TableRowsSkeleton colSpan={11} rows={6} />
            : invoices.isError ? <tr><td colSpan={11} className="p-8 text-center text-destructive"><p role="alert">{invoices.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void invoices.refetch()}>Réessayer</Button></td></tr>
              : !rows.length ? <tr><td colSpan={11} className="p-10 text-center text-muted-foreground">Aucune facture convention pour ces critères.</td></tr>
                : rows.map(row => {
                  const id = row.source.documentClientId!;
                  const compatible = !firstPayer || payerKey(row) === firstPayer;
                  return <tr key={id} className="hover:bg-muted/30">
                    <td className="px-3 py-3">{canCreate && <Checkbox aria-label={`Sélectionner ${row.source.reference}`} checked={Boolean(selected[id])}
                      disabled={row.soldeOuvert <= 0 || !compatible || invoices.isFetching} onCheckedChange={checked => setSelected(current => {
                        const next = { ...current }; if (checked) next[id] = row; else delete next[id]; return next;
                      })} />}</td>
                    <td className="px-3 py-3 font-medium">{canViewDocuments ? <button type="button" className="text-sky-700 hover:underline dark:text-sky-300" onClick={() => showDocument(id)}>{row.source.reference}</button> : row.source.reference}</td>
                    <td className="max-w-64 break-words px-3 py-3">{row.source.payeurNom || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{date(row.source.dateEffet)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{date(row.source.dateEcheance)}</td>
                    {[row.source.montantTtc, row.montantConfirme, row.montantEnAttente, row.soldeOuvert].map((amount, index) => <td key={index} className="px-3 py-3 text-right tabular-nums">{formatAccountingAmount(amount)}</td>)}
                    <td className="px-3 py-3"><Badge variant={variants[row.statut]}>{labels[row.statut]}</Badge></td>
                    <td className="px-3 py-3"><div className="flex justify-end gap-1">
                      {canViewDocuments && <Button variant="ghost" size="icon" title="Détail de la facture" aria-label={`Détail ${row.source.reference}`} onClick={() => showDocument(id)}><Eye className="size-4" /></Button>}
                      {canCreate && <Button variant="ghost" size="icon" title="Encaisser la facture" aria-label={`Encaisser ${row.source.reference}`} disabled={row.soldeOuvert <= 0 || invoices.isFetching || selectedRows.length > 0} onClick={() => collect([row])}><Banknote className="size-4" /></Button>}
                    </div></td>
                  </tr>;
                })}
        </tbody>
      </table></div>
      <ServerPagination className="border-t px-4 py-3" page={invoices.data?.page.number ?? page} totalPages={invoices.data?.page.totalPages ?? 0}
        totalElements={invoices.data?.page.totalElements ?? 0} loading={invoices.isFetching} onPageChange={next => { setPage(next); setSelected({}); }} />
    </section>
    {canViewDocuments && params.get("documentId") && <InvoiceDialog id={params.get("documentId")!} onClose={closeDetail} />}
    {params.get("reglementId") && <ClientPaymentDetailsDialog paymentId={params.get("reglementId")!} onClose={closeDetail} />}
  </div>;
}

function payerKey(row: ClientReceivable) {
  return `${row.source.payeurType}:${row.source.payeurId}`;
}

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`)) : "-";
}

function InvoiceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: ["compta", "client-document", id], queryFn: () => comptaApi.clientDocument(id) });
  const pdf = useMutation({ mutationFn: () => comptaApi.clientDocumentPdf(id),
    onSuccess: blob => downloadBlob(blob, `${detail.data?.numero ?? "facture"}.pdf`), onError: error => toast.error(error.message) });
  const document = detail.data;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
      <DialogHeader><DialogTitle>{document?.numero ?? "Détail de la facture"}</DialogTitle>
        <DialogDescription>{document ? `${document.conventionFacturee || "Convention"} · ${document.payeurNom}` : "Chargement de la facture…"}</DialogDescription>
      </DialogHeader>
      {detail.isError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{detail.error.message}</p><Button variant="outline" onClick={() => void detail.refetch()}>Réessayer</Button></div>
        : detail.isPending ? <p role="status" className="p-6 text-sm text-muted-foreground">Chargement…</p>
          : document && <>
            <dl className="grid grid-cols-2 gap-4 border-y py-3 text-sm sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Émise le</dt><dd>{date(document.dateEmission)}</dd></div>
              <div><dt className="text-muted-foreground">Échéance</dt><dd>{date(document.dateEcheance)}</dd></div>
              <div><dt className="text-muted-foreground">Période</dt><dd>{date(document.periodeDebut)} – {date(document.periodeFin)}</dd></div>
              <div><dt className="text-muted-foreground">Total MAD</dt><dd className="font-semibold">{formatAccountingAmount(document.totalDocument)}</dd></div>
            </dl>
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm">
              <thead className="bg-orange-600 text-left text-xs uppercase text-white"><tr>{["Police", "Assuré", "Mouvement", "Période", "TTC"].map(label => <th key={label} className={`px-3 py-3 ${label === "TTC" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
              <tbody className="divide-y">{document.lignes.map(line => <tr key={line.id}>
                <td className="px-3 py-3">{line.numeroPolice || "-"}</td><td className="px-3 py-3">{line.assureConvention || "-"}</td>
                <td className="px-3 py-3">{line.mouvement || "-"}</td><td className="px-3 py-3">{date(line.dateOperation)} – {date(line.dateEcheance)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatAccountingAmount(line.montantTtc)}</td>
              </tr>)}</tbody>
            </table></div>
          </>}
      <DialogFooter><Button variant="outline" onClick={onClose}>Fermer</Button>
        <Button disabled={!document || pdf.isPending} onClick={() => pdf.mutate()}><Download className="size-4" />Télécharger PDF</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
