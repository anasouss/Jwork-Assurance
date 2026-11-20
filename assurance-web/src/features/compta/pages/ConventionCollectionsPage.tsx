import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ban, Banknote, Eye, MoreHorizontal, Pencil, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AccessDenied, ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateOnly } from "@/features/production/date";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { ClientPaymentDetailsDialog } from "../components/ClientPaymentDetailsDialog";
import { ConventionWorkspaceHeader } from "../components/ConventionWorkspaceHeader";
import { InvoiceActionDialog, InvoiceDialog } from "../components/ConventionInvoiceDialogs";
import { ConventionInvoiceRevisionDialog } from "../components/ConventionInvoiceRevisionDialog";
import { formatAccountingAmount } from "../format";
import type { ClientReceivable, ConventionProductionFilters } from "../types";

const labels = {
  IMPAYEE: "À encaisser", PARTIELLEMENT_REGLEE: "Partiellement réglée",
  COUVERTE_EN_ATTENTE: "Encaissement en cours", PAYEE: "Soldée",
} as const;
const variants = { IMPAYEE: "warning", PARTIELLEMENT_REGLEE: "accent", COUVERTE_EN_ATTENTE: "info", PAYEE: "success" } as const;
const emptyFilters = { conventionId: "ALL", companyId: "ALL", search: "", dateDu: "", dateAu: "", includeSettled: true,
  year: String(new Date().getFullYear()), period: "ALL", periodeDu: "", periodeAu: "",
  movement: "ALL", operation: "ENCAISSEMENT" };

export default function ConventionCollectionsPage() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const canView = permissions.includes("reglement-client:view");
  const canViewDocuments = permissions.includes("facture-convention:view");
  const canCollect = permissions.includes("reglement-client:create");
  const canCreate = canView && (canCollect || permissions.includes("reglement-client:refund"));
  const canPayRefund = permissions.includes("reglement-client:refund");
  const canDelete = canViewDocuments && permissions.includes("facture-convention:delete");
  const canCancel = canViewDocuments && permissions.includes("facture-convention:cancel");
  const [documentAction, setDocumentAction] = useState<{ id: string; action: "delete" | "cancel" }>();
  const [revisionId, setRevisionId] = useState<string>();
  const [openingPdf, setOpeningPdf] = useState(false);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, ClientReceivable>>({});
  const year = Number(filters.year);
  const validYear = Number.isInteger(year) && year >= 1900 && year <= 2200;
  const options = useQuery({
    queryKey: ["compta", "convention-billing-options", year],
    queryFn: () => comptaApi.conventionBillingOptions(year), enabled: canView && validYear,
  });
  const companies = useQuery({ queryKey: ["compta", "companies"], queryFn: comptaApi.companies, enabled: canView });
  const convention = options.data?.find(option => option.id === filters.conventionId);
  const effectiveCompany = convention?.compagnieId ?? filters.companyId;
  const invoices = useQuery({
    queryKey: ["compta", "convention-invoice-receivables", applied, page],
    queryFn: () => comptaApi.clientInvoiceReceivables({
      conventionsOnly: true,
      conventionId: applied.conventionId === "ALL" ? undefined : applied.conventionId,
      compagnieId: applied.companyId === "ALL" ? undefined : applied.companyId,
      categorieMouvement: applied.movement === "ALL" ? undefined : applied.movement as ConventionProductionFilters["categorieMouvement"],
      sensPrime: applied.operation === "REGLEMENT" ? "RISTOURNE" : "PRIME_A_PAYER",
      periodeDu: applied.periodeDu || undefined, periodeAu: applied.periodeAu || undefined,
      includeSettled: applied.includeSettled,
      search: applied.search.trim() || undefined,
      dateDu: applied.dateDu || undefined, dateAu: applied.dateAu || undefined,
      sortBy: "DATE", sortDirection: "DESC", page, size: 25,
    }),
    enabled: canView, refetchOnMount: "always",
  });
  const rows = invoices.data?.rows ?? [];
  const selectedRows = rows.filter(row => row.source.documentClientId
    && selected[row.source.documentClientId] && row.soldeOuvert !== 0);
  const settlement = applied.operation === "REGLEMENT";
  const firstPayer = selectedRows[0] ? payerKey(selectedRows[0]) : undefined;
  const eligible = rows.filter(row => row.source.documentClientId && row.soldeOuvert !== 0
    && (row.source.montantTtc < 0 ? canPayRefund : canCollect)
    && (!firstPayer || payerKey(row) === firstPayer));
  const allSelected = eligible.length > 0 && eligible.every(row => selected[row.source.documentClientId!]);

  function apply() {
    if (!validYear) { toast.error("Sélectionnez une année entre 1900 et 2200."); return; }
    if (filters.dateDu && filters.dateAu && filters.dateDu > filters.dateAu) {
      toast.error("La date de début doit précéder la date de fin.");
      return;
    }
    if (filters.conventionId !== "ALL" && (!convention || options.isFetching || options.isError
      || (filters.period !== "ALL" && !convention.periodes.some(period => String(period.numero) === filters.period)))) {
      toast.error("Sélectionnez une période valide."); return;
    }
    const period = convention?.periodes.find(item => String(item.numero) === filters.period);
    setApplied({ ...filters, companyId: effectiveCompany,
      periodeDu: period?.debut ?? convention?.periodes[0]?.debut ?? "",
      periodeAu: period?.fin ?? convention?.periodes.at(-1)?.fin ?? "" }); setPage(0); setSelected({});
  }
  function collect(items: ClientReceivable[]) {
    if (!canCreate || !items.length || items.some(row => row.soldeOuvert === 0 || !row.source.documentClientId)
      || items.some(row => payerKey(row) !== payerKey(items[0]))) return;
    if (items[0].source.montantTtc < 0 ? !canPayRefund : !canCollect) return;
    const query = new URLSearchParams();
    items.forEach(row => query.append("document", row.source.documentClientId!));
    navigate(`/app/compta/conventions/encaissements/nouveau?${query}`);
  }
  function closeDetail() {
    const next = new URLSearchParams(params); next.delete("documentId"); next.delete("reglementId");
    setParams(next, { replace: true });
  }
  async function showDocument(id: string) {
    if (openingPdf || !canViewDocuments) return;
    const preview = window.open("about:blank", "_blank");
    if (!preview) {
      toast.error("Autorisez les fenêtres contextuelles pour ouvrir le PDF");
      return;
    }
    preview.opener = null;
    setOpeningPdf(true);
    try {
      const blob = await comptaApi.clientDocumentPdf(id);
      const url = URL.createObjectURL(blob);
      if (preview.closed) URL.revokeObjectURL(url);
      else {
        preview.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) {
      preview.close();
      toast.error(error instanceof Error ? error.message : "Ouverture du PDF impossible");
    } finally {
      setOpeningPdf(false);
    }
  }

  if (!canView) return <AccessDenied />;
  return <div className="mx-auto grid w-full max-w-[1600px] gap-4">
    <ConventionWorkspaceHeader title="Encaissement et règlement" />
    <section className="grid gap-3 border-y bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 [&>div]:min-w-0">
      <div className="grid gap-1.5"><Label htmlFor="collection-operation">Opération</Label>
        <Select value={filters.operation} onValueChange={operation => {
          setFilters(current => ({ ...current, operation }));
          setApplied(current => ({ ...current, operation }));
          setPage(0); setSelected({});
        }}>
          <SelectTrigger id="collection-operation"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ENCAISSEMENT">Encaissement</SelectItem><SelectItem value="REGLEMENT">Règlement</SelectItem></SelectContent>
        </Select>
      </div>
      {canView && <div className="grid gap-1.5"><Label htmlFor="collection-convention">Convention</Label>
        <Select value={filters.conventionId} disabled={options.isPending || options.isError} onValueChange={value => setFilters(current => ({ ...current, conventionId: value, period: "ALL",
          companyId: value === "ALL" ? current.companyId : options.data?.find(option => option.id === value)?.compagnieId ?? "ALL" }))}>
          <SelectTrigger id="collection-convention"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">Toutes les conventions</SelectItem>
            {options.data?.filter(option => filters.companyId === "ALL" || option.compagnieId === filters.companyId).map(option => <SelectItem key={option.id} value={option.id}>{option.intitule}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>}
      {canView && <div className="grid gap-1.5"><Label htmlFor="collection-company">Compagnie</Label>
        <Select value={effectiveCompany} disabled={filters.conventionId !== "ALL" || companies.isPending || companies.isError}
          onValueChange={value => setFilters(current => ({ ...current, companyId: value, conventionId: "ALL", period: "ALL" }))}>
          <SelectTrigger id="collection-company"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les compagnies</SelectItem>
            {convention?.compagnieId && !companies.data?.some(company => company.id === convention.compagnieId) && <SelectItem value={convention.compagnieId}>{convention.compagnie || "-"}</SelectItem>}
            {companies.data?.map(company => <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>}
      {canView && <>
        <div className="grid gap-1.5"><Label htmlFor="collection-year">Année du cycle</Label><Input id="collection-year" type="number" min={1900} max={2200} value={filters.year}
          onChange={event => setFilters(current => ({ ...current, year: event.target.value, period: "ALL" }))} /></div>
        <div className="grid gap-1.5"><Label htmlFor="collection-period">Période facturée</Label>
          <Select value={filters.period} disabled={!convention || options.isFetching} onValueChange={value => setFilters(current => ({ ...current, period: value }))}>
            <SelectTrigger id="collection-period"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les périodes</SelectItem>
              {convention?.periodes.map(period => <SelectItem key={period.numero} value={String(period.numero)}>{date(period.debut)} au {date(period.fin)}</SelectItem>)}
            </SelectContent>
          </Select></div>
      </>}
      <div className="grid gap-1.5"><Label htmlFor="collection-movement">Mouvement</Label>
        <Select value={filters.movement} onValueChange={value => setFilters(current => ({ ...current, movement: value }))}>
          <SelectTrigger id="collection-movement"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les mouvements</SelectItem><SelectItem value="AFFAIRE_NOUVELLE">Affaire nouvelle</SelectItem><SelectItem value="RENOUVELLEMENT">Renouvellement / Terme</SelectItem><SelectItem value="AVENANT">Avenant</SelectItem></SelectContent>
        </Select></div>
      <div className="grid gap-1.5"><Label htmlFor="collection-search">N° facture / payeur</Label>
        <Input id="collection-search" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))}
          onKeyDown={event => { if (event.key === "Enter") apply(); }} />
      </div>
      <div className="grid gap-1.5"><Label>Émise du</Label><DatePicker date={filters.dateDu} onSelect={date => setFilters(current => ({ ...current, dateDu: toDateOnly(date) ?? "" }))} /></div>
      <div className="grid gap-1.5"><Label>Au</Label><DatePicker date={filters.dateAu} onSelect={date => setFilters(current => ({ ...current, dateAu: toDateOnly(date) ?? "" }))} /></div>
      <div className="col-span-full flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={filters.includeSettled} onCheckedChange={checked => setFilters(current => ({ ...current, includeSettled: checked === true }))} />Inclure les factures soldées</label>
        <div className="flex gap-2">
          <Button size="icon" title="Rechercher" aria-label="Rechercher" onClick={apply}><Search className="size-4" /></Button>
          <Button variant="outline" size="icon" title="Réinitialiser" aria-label="Réinitialiser" onClick={() => {
            setFilters(emptyFilters); setApplied(emptyFilters); setPage(0); setSelected({});
          }}><RotateCcw className="size-4" /></Button>
          <Button variant="outline" size="icon" title="Actualiser" aria-label="Actualiser" disabled={invoices.isFetching} onClick={() => { setSelected({}); void invoices.refetch(); }}><RefreshCw className="size-4" /></Button>
        </div>
      </div>
      {options.isError && canView && <p role="alert" className="col-span-full text-sm text-destructive">{options.error.message}</p>}
      {companies.isError && canView && <p role="alert" className="col-span-full text-sm text-destructive">{companies.error.message}</p>}
    </section>
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <h2 className="font-semibold">{settlement ? "Factures conventions à régler" : "Factures conventions à encaisser"}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">Montants en MAD</span>
          {canCreate && <Button disabled={!selectedRows.length || invoices.isFetching || invoices.isError} onClick={() => collect(selectedRows)}><Banknote className="size-4" />{settlement ? "Régler" : "Encaisser"} ({selectedRows.length})</Button>}
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-orange-600 text-left text-xs uppercase text-white"><tr>
          <th className="w-10 px-3 py-3">{canCreate && <Checkbox aria-label="Sélectionner les factures du même payeur et du même sens" checked={allSelected} disabled={!eligible.length || invoices.isFetching || invoices.isError} onCheckedChange={checked => {
            if (!checked) { setSelected({}); return; }
            const key = firstPayer ?? (eligible[0] ? payerKey(eligible[0]) : undefined);
            setSelected(current => ({ ...current, ...Object.fromEntries(eligible.filter(row => payerKey(row) === key).map(row => [row.source.documentClientId!, row])) }));
          }} />}</th>
          {["Facture", "Payeur", "Date d'émission", "Échéance"].map(label => <th key={label} className="px-3 py-3">{label}</th>)}
          {["TTC", "Confirmé", "En attente", "Reste à affecter"].map(label => <th key={label} className="px-3 py-3 text-right">{label}</th>)}
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
                      disabled={row.soldeOuvert === 0 || !compatible || invoices.isFetching || (row.source.montantTtc < 0 ? !canPayRefund : !canCollect)} onCheckedChange={checked => setSelected(current => {
                        const next = { ...current }; if (checked) next[id] = row; else delete next[id]; return next;
                      })} />}</td>
                    <td className="px-3 py-3 font-medium">{canViewDocuments ? <button type="button" className="text-sky-700 hover:underline disabled:opacity-50 dark:text-sky-300" title="Ouvrir la facture PDF dans un nouvel onglet" disabled={openingPdf} onClick={() => void showDocument(id)}>{row.source.reference}</button> : row.source.reference}
                      {row.source.montantTtc < 0 && <div className="mt-1 text-xs text-muted-foreground">Facture de ristourne</div>}
                    </td>
                    <td className="max-w-64 break-words px-3 py-3">{row.source.payeurNom || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{date(row.source.dateEffet)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{date(row.source.dateEcheance)}</td>
                    {[row.source.montantTtc, row.montantConfirme, row.montantEnAttente, row.soldeOuvert].map((amount, index) => <td key={index} className="px-3 py-3 text-right tabular-nums">{formatAccountingAmount(amount)}</td>)}
                    <td className="px-3 py-3"><Badge variant={variants[row.statut]}>{row.source.montantTtc < 0
                      ? ({ IMPAYEE: "À régler", PARTIELLEMENT_REGLEE: "Partiellement réglée", COUVERTE_EN_ATTENTE: "Règlement en cours", PAYEE: "Réglée" } as const)[row.statut]
                      : labels[row.statut]}</Badge></td>
                    <td className="px-3 py-3"><div className="flex justify-end">
                      {(canViewDocuments || canCreate) && <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" title="Actions" aria-label={`Actions pour ${row.source.reference}`}><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-56">
                          {canViewDocuments && <DropdownMenuItem disabled={openingPdf} onSelect={() => void showDocument(id)}><Eye className="size-4" />Voir la facture PDF</DropdownMenuItem>}
                          {canViewDocuments && permissions.includes("facture-convention:revise") && <DropdownMenuItem onSelect={() => setRevisionId(id)}><Pencil className="size-4" />Rectifier la facture</DropdownMenuItem>}
                          {canCreate && <DropdownMenuItem disabled={row.soldeOuvert === 0 || invoices.isFetching || selectedRows.length > 0 || (row.source.montantTtc < 0 ? !canPayRefund : !canCollect)} onSelect={() => collect([row])}><Banknote className="size-4" />{row.source.montantTtc < 0 ? "Régler" : "Encaisser la facture"}</DropdownMenuItem>}
                          {(canCancel || canDelete) && <DropdownMenuSeparator />}
                          {canCancel && <DropdownMenuItem variant="destructive" onSelect={() => setDocumentAction({ id, action: "cancel" })}><Ban className="size-4" />Annuler la facture</DropdownMenuItem>}
                          {canDelete && <DropdownMenuItem variant="destructive" onSelect={() => setDocumentAction({ id, action: "delete" })}><Trash2 className="size-4" />Supprimer définitivement</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>}
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
    {documentAction && <InvoiceActionDialog key={`${documentAction.id}:${documentAction.action}`} {...documentAction} onClose={() => setDocumentAction(undefined)} />}
    {revisionId && <ConventionInvoiceRevisionDialog key={revisionId} id={revisionId} onClose={() => setRevisionId(undefined)} onRevised={() => { setRevisionId(undefined); setSelected({}); }} />}
  </div>;
}

function payerKey(row: ClientReceivable) {
  return `${row.source.payeurType}:${row.source.payeurId}:${Math.sign(row.source.montantTtc)}`;
}

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`)) : "-";
}
