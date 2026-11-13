import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccessDenied, ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { useAuthStore } from "@/store/auth-store";
import { ConventionWorkspaceHeader } from "../components/ConventionWorkspaceHeader";
import { downloadBlob } from "@/lib/download";
import { toast } from "@/lib/toast";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import type { ConventionProductionFilters } from "../types";

function initialFilters(): ConventionProductionFilters {
  const today = new Date();
  return { typeDate: "EFFET", dateDu: toDateOnly(new Date(today.getFullYear(), today.getMonth(), 1))!, dateAu: toDateOnly(today)! };
}

export default function ConventionProductionPage() {
  const canView = useAuthStore(state => state.user?.permissions.includes("quittance:view") ?? false);
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(0);
  const options = useQuery({ queryKey: ["compta", "convention-billing-options", new Date().getFullYear()],
    queryFn: () => comptaApi.conventionBillingOptions(new Date().getFullYear()), enabled: canView });
  const companies = useQuery({ queryKey: ["compta", "companies"], queryFn: comptaApi.companies, enabled: canView });
  const result = useQuery({ queryKey: ["compta", "convention-production", applied, page],
    queryFn: () => comptaApi.conventionProduction({ ...applied, page, size: 25 }), enabled: canView });
  const exportFile = useMutation({ mutationFn: () => comptaApi.exportConventionProduction(applied),
    onSuccess: blob => downloadBlob(blob, `production-conventions-${applied.dateDu}-${applied.dateAu}.xlsx`),
    onError: error => toast.error(error.message) });
  const showConvention = !applied.conventionId;
  const showCompany = !applied.compagnieId;
  const columns = 12 + Number(showConvention) + Number(showCompany);
  const selectedConvention = options.data?.find(item => item.id === filters.conventionId);
  const companyId = filters.conventionId ? selectedConvention?.compagnieId ?? undefined : filters.compagnieId;

  function apply() {
    if (!filters.dateDu || !filters.dateAu || filters.dateDu > filters.dateAu) {
      toast.error("Sélectionnez une période valide.");
      return;
    }
    if (filters.conventionId && !selectedConvention?.compagnieId) {
      toast.error("La compagnie liée à cette convention est indisponible.");
      return;
    }
    setApplied({ ...filters, compagnieId: companyId });
    setPage(0);
  }

  if (!canView) return <AccessDenied />;
  return <div className="mx-auto grid w-full max-w-[1600px] gap-4">
    <ConventionWorkspaceHeader title="Consultation et édition des états de production" />
    <section className="grid gap-3 border-y bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="grid gap-1.5"><Label>Convention</Label><Select value={filters.conventionId ?? "ALL"}
        disabled={options.isPending || options.isError}
        onValueChange={value => {
          const convention = options.data?.find(item => item.id === value);
          setFilters(current => ({ ...current, conventionId: value === "ALL" ? undefined : value,
            compagnieId: value === "ALL" ? undefined : convention?.compagnieId ?? undefined }));
        }}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les conventions</SelectItem>
          {options.data?.map(item => <SelectItem key={item.id} value={item.id}>{item.intitule}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-1.5"><Label>Compagnie</Label><Select value={companyId ?? "ALL"}
        disabled={!!filters.conventionId || companies.isPending || companies.isError}
        onValueChange={value => setFilters(current => ({ ...current, compagnieId: value === "ALL" ? undefined : value }))}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les compagnies</SelectItem>
          {selectedConvention?.compagnieId && !companies.data?.some(item => item.id === selectedConvention.compagnieId)
            ? <SelectItem value={selectedConvention.compagnieId}>{selectedConvention.compagnie || "-"}</SelectItem> : null}
          {companies.data?.map(item => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-1.5"><Label>Mode</Label><Select value={filters.mode ?? "ALL"}
        onValueChange={value => setFilters(current => ({ ...current, mode: value === "ALL" ? undefined : value as "BUREAU" | "FACTURE" }))}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Bureau et facture</SelectItem>
          <SelectItem value="BUREAU">Bureau</SelectItem><SelectItem value="FACTURE">Facture</SelectItem></SelectContent></Select></div>
      <div className="grid gap-1.5"><Label>Mouvement</Label><Select value={filters.categorieMouvement ?? "ALL"}
        onValueChange={value => setFilters(current => ({ ...current, categorieMouvement: value === "ALL" ? undefined : value as ConventionProductionFilters["categorieMouvement"] }))}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les mouvements</SelectItem>
          <SelectItem value="AFFAIRE_NOUVELLE">Affaire nouvelle</SelectItem><SelectItem value="RENOUVELLEMENT">Renouvellement / Terme</SelectItem><SelectItem value="AVENANT">Avenant</SelectItem>
        </SelectContent></Select></div>
      <div className="grid gap-1.5"><Label>Sens de prime</Label><Select value={filters.sensPrime ?? "ALL"}
        onValueChange={value => setFilters(current => ({ ...current, sensPrime: value === "ALL" ? undefined : value as ConventionProductionFilters["sensPrime"] }))}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les sens</SelectItem>
          <SelectItem value="PRIME_A_PAYER">Prime à payer</SelectItem><SelectItem value="RISTOURNE">Ristourne</SelectItem><SelectItem value="SANS_INCIDENCE">Sans incidence</SelectItem>
        </SelectContent></Select></div>
      <div className="grid gap-1.5"><Label>Critère de date</Label><Select value={filters.typeDate}
        onValueChange={value => setFilters(current => ({ ...current, typeDate: value as "EFFET" | "EMISSION" }))}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EFFET">Date d'effet</SelectItem>
          <SelectItem value="EMISSION">Date d'émission de la quittance</SelectItem></SelectContent></Select></div>
      <div className="grid gap-1.5"><Label>Du</Label><DatePicker date={filters.dateDu}
        onSelect={date => setFilters(current => ({ ...current, dateDu: toDateOnly(date) ?? "" }))} /></div>
      <div className="grid gap-1.5"><Label>Au</Label><DatePicker date={filters.dateAu}
        onSelect={date => setFilters(current => ({ ...current, dateAu: toDateOnly(date) ?? "" }))} /></div>
      <div className="flex flex-wrap items-end justify-end gap-2 sm:col-span-2 xl:col-span-4">
        <Button onClick={apply} size="icon" title="Rechercher" aria-label="Rechercher"><Search className="size-4" /></Button>
        <Button variant="outline" size="icon" title="Réinitialiser" aria-label="Réinitialiser" onClick={() => {
          const next = initialFilters(); setFilters(next); setApplied(next); setPage(0);
        }}><RotateCcw className="size-4" /></Button>
        <Button variant="outline" disabled={exportFile.isPending || result.isError || !result.data?.rows.length}
          onClick={() => exportFile.mutate()}><Download className="size-4" />Exporter Excel</Button>
      </div>
      {(options.isError || companies.isError) && <p className="text-sm text-destructive sm:col-span-2 xl:col-span-4">Impossible de charger les filtres.</p>}
    </section>
    <section className="overflow-hidden border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"><h2 className="font-semibold">État de production</h2>
        <span className="text-xs text-muted-foreground">Montants en MAD</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1500px] text-sm">
        <thead className="bg-orange-600 text-left text-xs uppercase text-white"><tr>
          {showConvention && <th className="px-3 py-3">Convention</th>}<th className="px-3 py-3">Quittance N°</th>
          {showCompany && <th className="px-3 py-3">Compagnie</th>}
          {["Police N°", "Mouvement", "Assuré", "Véhicule", "Date d'effet", "Date d'expiration"].map(label => <th key={label} className="px-3 py-3">{label}</th>)}
          {["Prime nette", "Taxes", "TTC"].map(label => <th key={label} className="px-3 py-3 text-right">{label}</th>)}
          <th className="px-3 py-3">Mode</th><th className="px-3 py-3 text-right">Montant client</th>
        </tr></thead>
        <tbody className="divide-y">{result.isLoading ? <TableRowsSkeleton colSpan={columns} rows={8} />
          : result.isError ? <tr><td colSpan={columns} className="p-8 text-center text-destructive">{result.error.message}</td></tr>
          : !result.data?.rows.length ? <tr><td colSpan={columns} className="p-10 text-center text-muted-foreground">Aucune production pour cette période.</td></tr>
          : result.data.rows.map(row => <tr key={row.id} className="hover:bg-muted/30">
            {showConvention && <td className="px-3 py-3">{row.convention || "-"}</td>}<td className="px-3 py-3">{row.numeroQuittance || "-"}</td>
            {showCompany && <td className="px-3 py-3">{row.compagnie || "-"}</td>}
            {[row.numeroPolice, row.mouvement, row.assure, row.vehicule, date(row.dateEffet), date(row.dateExpiration)].map((value, index) => <td key={index} className="px-3 py-3">{value || "-"}</td>)}
            {[row.primeNette, row.taxes, row.montantTtc].map((value, index) => <td key={index} className="px-3 py-3 text-right tabular-nums">{formatAccountingAmount(value)}</td>)}
            <td className="px-3 py-3">{row.mode === "facture" ? "Facture" : row.mode === "bureau" ? "Bureau" : "-"}</td>
            <td className="px-3 py-3 text-right font-semibold tabular-nums">{row.montantClient == null ? "-" : formatAccountingAmount(row.montantClient)}</td>
          </tr>)}</tbody>
      </table></div>
      <ServerPagination className="border-t px-4 py-3" page={result.data?.page ?? page} totalPages={result.data?.totalPages ?? 0}
        totalElements={result.data?.totalElements ?? 0} loading={result.isFetching} onPageChange={setPage} />
    </section>
  </div>;
}

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`)) : "-";
}
