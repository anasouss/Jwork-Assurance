import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Eye, MoreHorizontal, Printer, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { RemittanceSlip, RemittanceSlipStatus, RemittanceSlipType } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, TODAY, TREASURY_PAGE_SIZE } from "./treasury-format";

type TypeFilter = RemittanceSlipType | "ALL";
type StatusFilter = "BROUILLON" | "DEFINITIF" | "ALL";

const TYPE_LABELS: Record<RemittanceSlipType, string> = {
  CHEQUE: "Chèques",
  EFFET: "Effets",
  VERSEMENT_ESPECES: "Espèces",
};

const STATUS_LABELS: Record<RemittanceSlipStatus, string> = {
  BROUILLON: "Provisoire",
  DEPOSE: "Remis à la banque",
  PARTIELLEMENT_TRAITE: "Remis à la banque",
  CLOTURE: "Clôturé",
  ANNULE: "Annulé",
};

export default function InstrumentsTresoreriePage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const type = parseTypeFilter(searchParams.get("type"));
  const status = parseStatusFilter(searchParams.get("statut"));
  const appliedSearch = searchParams.get("search") ?? "";
  const dateFrom = parseDateFilter(searchParams.get("dateDu"));
  const dateTo = parseDateFilter(searchParams.get("dateAu"));
  const page = parsePage(searchParams.get("page"));
  const [search, setSearch] = useState(appliedSearch);
  const [deleteTarget, setDeleteTarget] = useState<RemittanceSlip>();
  const [depositTarget, setDepositTarget] = useState<RemittanceSlip>();
  const [depositDate, setDepositDate] = useState(TODAY);
  const [depositReference, setDepositReference] = useState("");
  const [pdfAction, setPdfAction] = useState<{ id: string; type: "preview" | "download" }>();

  useEffect(() => {
    setSearch(appliedSearch);
  }, [appliedSearch]);
  const slips = useQuery({
    queryKey: ["compta", "treasury", "remittance-slips", type, status, appliedSearch, dateFrom, dateTo, page],
    queryFn: () => comptaApi.remittanceSlips({
      type: type === "ALL" ? undefined : type,
      definitif: status === "ALL" ? undefined : status === "DEFINITIF",
      search: appliedSearch || undefined,
      dateDu: dateFrom || undefined,
      dateAu: dateTo || undefined,
      page,
      size: TREASURY_PAGE_SIZE,
    }),
  });
  const deleteDraft = useMutation({
    mutationFn: (id: string) => comptaApi.deleteRemittanceSlipDraft(id),
    onSuccess: async () => {
      setDeleteTarget(undefined);
      toast.success("Bordereau provisoire supprimé");
      await queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Suppression impossible"),
  });
  const deposit = useMutation({
    mutationFn: (slip: RemittanceSlip) => comptaApi.depositRemittanceSlip(slip.id, {
      dateDepot: depositDate,
      referenceBancaire: depositReference.trim(),
    }),
    onSuccess: async () => {
      setDepositTarget(undefined);
      toast.success("Bordereau validé");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Validation du bordereau impossible"),
  });

  function openDeposit(slip: RemittanceSlip) {
    setDepositDate(TODAY);
    setDepositReference(slip.referenceBancaire ?? "");
    setDepositTarget(slip);
  }

  function applyFilters() {
    updateFilter("search", search.trim());
  }

  function resetFilters() {
    setSearch("");
    setSearchParams({}, { replace: true });
  }

  function updateFilter(name: string, value: string, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "ALL" || (name === "page" && value === "0")) next.delete(name);
    else next.set(name, value);
    if (resetPage) next.delete("page");
    setSearchParams(next, { replace: true });
  }

  async function previewPdf(slip: RemittanceSlip) {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Autorisez les fenêtres contextuelles pour ouvrir le PDF");
      return;
    }
    previewWindow.opener = null;
    setPdfAction({ id: slip.id, type: "preview" });
    try {
      const blob = await comptaApi.remittanceSlipPdf(slip.id);
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow.close();
      toast.error(error instanceof Error ? error.message : "Ouverture du PDF impossible");
    } finally {
      setPdfAction(undefined);
    }
  }

  async function downloadPdf(slip: RemittanceSlip) {
    setPdfAction({ id: slip.id, type: "download" });
    try {
      const blob = await comptaApi.remittanceSlipPdf(slip.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slip.numero}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléchargement impossible");
    } finally {
      setPdfAction(undefined);
    }
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">Bordereaux bancaires</h1>
          <p className="text-sm text-muted-foreground">Suivi des remises de chèques, effets et versements d’espèces.</p>
        </div>
      </header>

      <section className="grid gap-3 rounded-md border bg-card p-4 xl:grid-cols-[190px_210px_1fr_170px_170px_auto]">
        <div className="grid gap-2"><Label>Type</Label><Select value={type} onValueChange={(value) => updateFilter("type", value)}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">Tous les types</SelectItem><SelectItem value="CHEQUE">Chèques</SelectItem>
            <SelectItem value="EFFET">Effets</SelectItem><SelectItem value="VERSEMENT_ESPECES">Espèces</SelectItem>
          </SelectContent>
        </Select></div>
        <div className="grid gap-2"><Label>Statut</Label><Select value={status} onValueChange={(value) => updateFilter("statut", value)}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem><SelectItem value="BROUILLON">Provisoires</SelectItem>
            <SelectItem value="DEFINITIF">Définitifs</SelectItem>
          </SelectContent>
        </Select></div>
        <div className="grid gap-2"><Label htmlFor="slip-search">Réf. interne, n° banque ou compte</Label><Input id="slip-search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyFilters()} /></div>
        <div className="grid gap-2"><Label>Date du</Label><DatePicker date={dateFrom} onSelect={(value) => updateFilter("dateDu", toDateOnly(value) ?? "")} /></div>
        <div className="grid gap-2"><Label>Date au</Label><DatePicker date={dateTo} onSelect={(value) => updateFilter("dateAu", toDateOnly(value) ?? "")} /></div>
        <div className="flex items-end gap-2"><Button size="icon" title="Rechercher" onClick={applyFilters}><Search className="size-4" /></Button><Button size="icon" variant="outline" title="Réinitialiser" onClick={resetFilters}><RotateCcw className="size-4" /></Button></div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Tous les bordereaux</h2><p className="text-sm text-muted-foreground">Ouvrez un bordereau pour consulter sa remise et les instruments associés.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
            <th className="px-4 py-3 text-left">Réf. interne</th><th className="px-4 py-3 text-left">N° BD banque</th><th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Remis le</th>
            <th className="px-4 py-3 text-left">Destination</th><th className="px-4 py-3 text-center">Nombre</th>
            <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Statut</th><th className="w-24 px-4 py-3"><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody className="divide-y">
            {slips.isLoading ? <TableRowsSkeleton colSpan={10} rows={6} /> : (slips.data?.rows ?? []).map((slip) => <tr key={slip.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">{slip.numero}</td><td className="px-4 py-3">{slip.referenceBancaire || "-"}</td><td className="px-4 py-3">{TYPE_LABELS[slip.type]}</td>
              <td className="px-4 py-3">{formatTreasuryDate(slip.dateBordereau)}</td><td className="px-4 py-3">{formatTreasuryDate(slip.dateDepot)}</td>
              <td className="px-4 py-3">{slip.compteDestination}</td><td className="px-4 py-3 text-center">{slip.type === "VERSEMENT_ESPECES" ? "-" : slip.nombreLignes}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(slip.montantTotal)}</td><td className="px-4 py-3"><StatusBadge status={slip.statut} /></td>
              <td className="px-4 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" title="Actions" aria-label={`Actions pour le bordereau ${slip.numero}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-56">
                    <DropdownMenuItem asChild>
                      <Link to={`/app/compta/tresorerie/bordereaux-remise/${slip.id}`}>
                        <Eye className="size-4" /> Voir le détail
                      </Link>
                    </DropdownMenuItem>
                    {slip.statut === "BROUILLON" && canManage ? (
                      <DropdownMenuItem onSelect={() => openDeposit(slip)}>
                        <CheckCircle2 className="size-4 text-blue-600 dark:text-blue-400" /> Valider le bordereau
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem disabled={Boolean(pdfAction)} onSelect={() => void previewPdf(slip)}>
                      <Printer className="size-4" />
                      {pdfAction?.id === slip.id && pdfAction.type === "preview" ? "Ouverture..." : "Imprimer le PDF"}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={Boolean(pdfAction)} onSelect={() => void downloadPdf(slip)}>
                      <Download className="size-4" />
                      {pdfAction?.id === slip.id && pdfAction.type === "download" ? "Téléchargement..." : "Télécharger le PDF"}
                    </DropdownMenuItem>
                    {slip.statut === "BROUILLON" && canManage ? <DropdownMenuSeparator /> : null}
                    {slip.statut === "BROUILLON" && canManage ? (
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={deleteDraft.isPending}
                        onSelect={() => setDeleteTarget(slip)}
                      >
                        <Trash2 className="size-4" /> Supprimer le bordereau
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>)}
            {!slips.isLoading && (slips.data?.rows.length ?? 0) === 0 && <tr><td colSpan={10} className="px-4 py-14 text-center text-muted-foreground">Aucun bordereau ne correspond aux filtres.</td></tr>}
          </tbody>
        </table></div>
        {slips.data && <ServerPagination page={slips.data.page.number} totalPages={slips.data.page.totalPages} totalElements={slips.data.page.totalElements} loading={slips.isFetching} onPageChange={(nextPage) => updateFilter("page", String(nextPage), false)} />}
      </section>

      <Dialog open={Boolean(depositTarget)} onOpenChange={(open) => !open && setDepositTarget(undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Valider le bordereau</DialogTitle>
            <DialogDescription>
              {depositTarget?.type === "VERSEMENT_ESPECES"
                ? "Le transfert de la caisse vers la banque sera enregistré."
                : "Les instruments passeront au statut remis en banque."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Date de remise</Label>
              <DatePicker date={depositDate} onSelect={(value) => setDepositDate(toDateOnly(value) ?? "")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="list-deposit-reference">N° bordereau banque *</Label>
              <Input
                id="list-deposit-reference"
                value={depositReference}
                onChange={(event) => setDepositReference(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={deposit.isPending} onClick={() => setDepositTarget(undefined)}>Annuler</Button>
            <Button
              disabled={!depositTarget || !depositDate || !depositReference.trim() || deposit.isPending}
              onClick={() => depositTarget && deposit.mutate(depositTarget)}
            >
              {deposit.isPending ? "Validation en cours..." : "Valider le bordereau"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le bordereau {deleteTarget?.numero} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le bordereau provisoire sera supprimé définitivement. Ses instruments redeviendront disponibles dans les encaissements en attente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDraft.isPending}>Retour</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deleteTarget || deleteDraft.isPending}
              onClick={() => deleteTarget && deleteDraft.mutate(deleteTarget.id)}
            >
              {deleteDraft.isPending ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function parseTypeFilter(value: string | null): TypeFilter {
  return value === "CHEQUE" || value === "EFFET" || value === "VERSEMENT_ESPECES" ? value : "ALL";
}

function parseStatusFilter(value: string | null): StatusFilter {
  if (value === "BROUILLON") return "BROUILLON";
  return value === "DEFINITIF" || value === "DEPOSE" || value === "PARTIELLEMENT_TRAITE" || value === "CLOTURE"
    ? "DEFINITIF" : "ALL";
}

function parseDateFilter(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function StatusBadge({ status }: { status: RemittanceSlipStatus }) {
  const className = {
    BROUILLON: "bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200",
    DEPOSE: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200",
    PARTIELLEMENT_TRAITE: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200",
    CLOTURE: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200",
    ANNULE: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200",
  }[status];
  return <Badge className={className}>{STATUS_LABELS[status]}</Badge>;
}
