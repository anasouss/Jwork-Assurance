import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ban, Eye, MoreHorizontal, RefreshCw, RotateCcw, Search, Trash2, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import type { ClientDocumentStatus } from "../types";
import { InvoiceActionDialog } from "./ConventionInvoiceDialogs";

export function ConventionSavedInvoices({ conventionId, compagnieId, periodeDu, periodeAu, highlightId }: {
  conventionId?: string; compagnieId?: string; periodeDu?: string; periodeAu?: string; highlightId?: string;
}) {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState<ClientDocumentStatus>();
  const [page, setPage] = useState(0);
  const [action, setAction] = useState<{ id: string; action: "cancel" | "delete" }>();
  const invoices = useQuery({
    queryKey: ["compta", "convention-invoices", conventionId, compagnieId, periodeDu, periodeAu, status, appliedSearch, page],
    queryFn: () => comptaApi.conventionInvoices({ conventionId, compagnieId, periodeDu, periodeAu,
      statut: status, search: appliedSearch || undefined, page, size: 25 }),
    staleTime: 0,
  });
  const pdf = useMutation({
    mutationFn: async (id: string) => {
      const tab = window.open("about:blank", "_blank");
      if (!tab) throw new Error("Autorisez les fenêtres contextuelles pour ouvrir le PDF.");
      tab.opener = null;
      try {
        const blob = await comptaApi.clientDocumentPdf(id);
        const url = URL.createObjectURL(blob);
        if (tab.closed) URL.revokeObjectURL(url);
        else { tab.location.href = url; window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
      } catch (error) { tab.close(); throw error; }
    },
    onError: error => toast.error(error.message),
  });
  function apply() { setAppliedSearch(search.trim()); setPage(0); }
  return <section className="grid gap-3">
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid min-w-0 flex-[1_1_240px] gap-1.5"><Label htmlFor="saved-invoice-search">N° facture / payeur</Label>
        <Input id="saved-invoice-search" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter") apply(); }} />
      </div>
      <div className="grid w-full gap-1.5 sm:w-52"><Label htmlFor="saved-invoice-status">État de la facture</Label>
        <Select value={status ?? "ALL"} onValueChange={value => { setStatus(value === "ALL" ? undefined : value as ClientDocumentStatus); setPage(0); }}>
          <SelectTrigger id="saved-invoice-status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">Tous les états</SelectItem><SelectItem value="EMIS">Établie</SelectItem><SelectItem value="ANNULE">Annulée</SelectItem><SelectItem value="REMPLACE">Remplacée</SelectItem></SelectContent>
        </Select>
      </div>
      <Button size="icon" title="Rechercher" aria-label="Rechercher les factures" onClick={apply}><Search className="size-4" /></Button>
      <Button size="icon" variant="outline" title="Actualiser" aria-label="Actualiser les factures" disabled={invoices.isFetching} onClick={() => void invoices.refetch()}><RefreshCw className="size-4" /></Button>
      <Button size="icon" variant="outline" title="Réinitialiser" aria-label="Réinitialiser la recherche de factures" onClick={() => { setSearch(""); setAppliedSearch(""); setStatus(undefined); setPage(0); }}><RotateCcw className="size-4" /></Button>
    </div>
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Factures établies</h2><span className="text-xs text-muted-foreground">Montants en MAD</span></div>
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead className="bg-orange-600 text-left text-xs uppercase text-white"><tr>
          {["Facture", "Convention", "Période facturée", "Date d’émission", "Échéance", "Montant", "État", "Actions"].map(title => <th key={title} className={`px-3 py-3 ${["Montant", "Actions"].includes(title) ? "text-right" : ""}`}>{title}</th>)}
        </tr></thead>
        <tbody className="divide-y">
          {invoices.isPending ? <TableRowsSkeleton colSpan={8} rows={5} /> : invoices.isError ? <tr><td colSpan={8} className="p-8 text-center"><p role="alert" className="text-destructive">{invoices.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void invoices.refetch()}>Réessayer</Button></td></tr>
            : !invoices.data?.rows.length ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Aucune facture pour ces critères.</td></tr>
              : invoices.data.rows.map(invoice => <tr key={invoice.id} className={invoice.id === highlightId ? "bg-amber-50 dark:bg-amber-950/30" : "hover:bg-muted/30"}>
                <td className="px-3 py-3"><button type="button" disabled={pdf.isPending} className="font-medium text-sky-700 hover:underline dark:text-sky-300" onClick={() => pdf.mutate(invoice.id)}>{invoice.numero}</button>
                  {invoice.totalDocument < 0 && <div className="mt-1 text-xs text-muted-foreground">Facture de ristourne</div>}</td>
                <td className="px-3 py-3">{invoice.conventionFacturee || invoice.payeurNom || "-"}</td>
                <td className="px-3 py-3">{date(invoice.periodeDebut)} au {date(invoice.periodeFin)}</td>
                <td className="px-3 py-3">{date(invoice.dateEmission)}</td><td className="px-3 py-3">{date(invoice.dateEcheance)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatAccountingAmount(invoice.totalDocument)}</td>
                <td className="px-3 py-3"><Badge variant={invoice.statut === "EMIS" ? "success" : "secondary"}>{({ EMIS: "Établie", ANNULE: "Annulée", REMPLACE: "Remplacée" } as const)[invoice.statut]}</Badge></td>
                <td className="px-3 py-3 text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions pour ${invoice.numero}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={pdf.isPending} onSelect={() => pdf.mutate(invoice.id)}><Eye className="size-4" />Voir la facture PDF</DropdownMenuItem>
                    {invoice.statut === "EMIS" && permissions.includes("reglement-client:view") && <DropdownMenuItem onSelect={() => navigate(`/app/compta/conventions/encaissements?documentId=${invoice.id}`)}><WalletCards className="size-4" />Encaissement et règlement</DropdownMenuItem>}
                    {invoice.statut === "EMIS" && (permissions.includes("facture-convention:cancel") || permissions.includes("facture-convention:delete")) && <DropdownMenuSeparator />}
                    {invoice.statut === "EMIS" && permissions.includes("facture-convention:cancel") && <DropdownMenuItem variant="destructive" onSelect={() => setAction({ id: invoice.id, action: "cancel" })}><Ban className="size-4" />Annuler la facture</DropdownMenuItem>}
                    {invoice.statut === "EMIS" && permissions.includes("facture-convention:delete") && <DropdownMenuItem variant="destructive" onSelect={() => setAction({ id: invoice.id, action: "delete" })}><Trash2 className="size-4" />Supprimer définitivement</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu></td>
              </tr>)}
        </tbody>
      </table></div>
      <ServerPagination className="border-t px-4 py-3" page={invoices.data?.page.number ?? page} totalPages={invoices.data?.page.totalPages ?? 0} totalElements={invoices.data?.page.totalElements ?? 0} loading={invoices.isFetching} onPageChange={setPage} />
    </div>
    {action && <InvoiceActionDialog key={`${action.id}:${action.action}`} {...action} onClose={() => setAction(undefined)} />}
  </section>;
}

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`)) : "-";
}
