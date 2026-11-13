import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ChevronDown,
  Download,
  Eye,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "@/lib/toast";
import { downloadBlob } from "@/lib/download";
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
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/store/auth-store";
import { sinistreApi, sinistreKeys } from "../api";
import { formatDate, statusLabels } from "../format";
import { repairLabels, suiviLabels } from "../workflow";
import { SinistreTracking } from "../components/SinistreTracking";
import { SinistreStatusBadge } from "../components/SinistreStatusBadge";
import { SinistreDeclarationContextDialog } from "../components/SinistreDeclarationContextDialog";
import type {
  EtapeSuiviSinistre,
  SinistreSummary,
  StatutSinistre,
} from "../types";

const PAGE_SIZE = 25;
type Filters = {
  query: string;
  statut: string;
  etapeSuivi: string;
  dateDu: string;
  dateAu: string;
};
type PortfolioScope = { clientId: string; contratId: string; brancheId: string };

export default function SinistreListPage({ mode = "consultation" }: { mode?: "consultation" | "registre" }) {
  const isRegister = mode === "registre";
  const columnCount = isRegister ? 14 : 10;
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [initial] = useState(() => readState(params));
  const [filters, setFilters] = useState(initial.filters);
  const [applied, setApplied] = useState(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [scope, setScope] = useState(initial.scope);
  const canCreate = useAuthStore(
    (state) => state.user?.permissions?.includes("sinistre:create") ?? false,
  );
  const canManage = useAuthStore(
    (state) => state.user?.permissions?.includes("sinistre:manage") ?? false,
  );
  const [claimToCancel, setClaimToCancel] = useState<SinistreSummary | null>(
    null,
  );
  const [claimToDelete, setClaimToDelete] = useState<SinistreSummary | null>(
    null,
  );
  const [declarationOpen, setDeclarationOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const request = useMemo(
    () => ({
      query: applied.query.trim() || undefined,
      clientId: scope.clientId || undefined,
      contratId: scope.contratId || undefined,
      brancheId: scope.brancheId || undefined,
      statut:
        applied.statut === "ALL"
          ? undefined
          : (applied.statut as StatutSinistre),
      dateDu: applied.dateDu || undefined,
      dateAu: applied.dateAu || undefined,
      etapeSuivi: applied.etapeSuivi === "ALL" ? undefined : applied.etapeSuivi as EtapeSuiviSinistre,
      page,
      size: PAGE_SIZE,
    }),
    [applied, page, scope],
  );
  const list = useQuery({
    queryKey: sinistreKeys.list(request),
    queryFn: () => sinistreApi.list(request),
    placeholderData: (previous) => previous,
  });
  const exportRegister = useMutation({
    mutationFn: () => sinistreApi.exportRegister(request),
    onSuccess: (blob) => downloadBlob(blob, "registre-sinistres.xlsx"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Export impossible"),
  });
  const cancelClaim = useMutation({
    mutationFn: (id: string) =>
      sinistreApi.transition(
        id,
        "ANNULE",
        "Annulation depuis la liste des dossiers",
      ),
    onSuccess: () => {
      setClaimToCancel(null);
      queryClient.invalidateQueries({ queryKey: sinistreKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sinistreKeys.dashboard() });
      toast.success("Dossier annulé");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Annulation impossible",
      ),
  });
  const deleteClaim = useMutation({
    mutationFn: sinistreApi.deleteEarlyClaim,
    onSuccess: () => {
      setClaimToDelete(null);
      queryClient.invalidateQueries({ queryKey: sinistreKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sinistreKeys.dashboard() });
      toast.success("Dossier supprimé définitivement");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible",
      ),
  });

  function apply(next: Filters) {
    setExpandedId(null);
    setApplied(next);
    setPage(0);
    setParams(writeState(next, 0, scope), { replace: true });
  }
  function reset() {
    const next = emptyFilters();
    setFilters(next);
    apply(next);
  }
  function changePage(next: number) {
    setExpandedId(null);
    setPage(next);
    setParams(writeState(applied, next, scope), { replace: true });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">
            Sinistres
          </p>
          <h1 className="text-xl font-semibold">{isRegister ? "Registre des sinistres" : "Consultation et suivi"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/app/sinistre">Module sinistres</Link></Button>
          <Button variant="outline" disabled={exportRegister.isPending || list.isPending || list.isError} onClick={() => exportRegister.mutate()}><Download className="size-4" />{exportRegister.isPending ? "Export en cours…" : "Registre Excel"}</Button>
        {canCreate && !isRegister ? (
          <Button onClick={() => setDeclarationOpen(true)}>
            <FilePlus2 className="size-4" />
            Nouvelle ouverture
          </Button>
        ) : null}
        </div>
      </div>
      {scope.clientId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm dark:border-sky-900 dark:bg-sky-950/30">
          <span>Dossiers du portefeuille client{scope.contratId ? " · contrat sélectionné" : ""}</span>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost"><Link to={`/app/production/portefeuille-clients/${scope.clientId}`}>Retour au portefeuille</Link></Button>
            <Button size="sm" variant="ghost" onClick={() => {
              const next = { clientId: "", contratId: "", brancheId: "" };
              setScope(next);
              setPage(0);
              setParams(writeState(applied, 0, next), { replace: true });
            }}>Tout afficher</Button>
          </div>
        </div>
      ) : null}
      <section aria-label="Filtres des sinistres" className="border-y bg-muted/20 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Recherche">
              <Input
                value={filters.query}
                placeholder="N° sinistre, réf. compagnie, police, assuré, immatriculation…"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    query: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") apply(filters);
                }}
              />
            </Field>
            <Field label="Statut">
              <Select
                value={filters.statut}
                onValueChange={(statut) =>
                  setFilters((current) => ({ ...current, statut }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Du">
              <DatePicker
                date={filters.dateDu}
                onSelect={(date) =>
                  setFilters((current) => ({ ...current, dateDu: toIso(date) }))
                }
              />
            </Field>
            <Field label="Étape de suivi"><Select value={filters.etapeSuivi} onValueChange={(etapeSuivi) => setFilters((current) => ({ ...current, etapeSuivi }))}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les étapes</SelectItem>{Object.entries(suiviLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select></Field>
            <Field label="Au">
              <DatePicker
                date={filters.dateAu}
                onSelect={(date) =>
                  setFilters((current) => ({ ...current, dateAu: toIso(date) }))
                }
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button
                size="icon"
                aria-label="Rechercher"
                onClick={() => apply(filters)}
              >
                <Search className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Réinitialiser"
                onClick={reset}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
      </section>
      {list.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive"><span>{list.error instanceof Error ? list.error.message : "Chargement des dossiers impossible."}</span><Button variant="outline" onClick={() => list.refetch()}>Réessayer</Button></div> : null}
      <section aria-label="Résultats des sinistres" className="min-w-0 border">
          <div className="overflow-x-auto">
            <Table className={isRegister ? "min-w-[1600px]" : "min-w-[1100px]"}>
              <TableHeader className="bg-sky-700 text-white [&_th]:text-white">
                <TableRow className="hover:bg-sky-700">
                  {isRegister ? <TableHead>N° sinistre</TableHead> : null}
                  <TableHead>{isRegister ? "Réf. compagnie" : "Référence Cie"}</TableHead>
                  <TableHead>Assuré</TableHead>
                  <TableHead>{isRegister ? "Police" : "Police N°"}</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>{isRegister ? "Date sinistre" : "Sinistre du"}</TableHead>
                  <TableHead>{isRegister ? "Déclaration" : "Déclaré le"}</TableHead>
                  {isRegister ? <TableHead>Compagnie</TableHead> : null}
                  <TableHead>{isRegister ? "Garanties impliquées" : "Garanties"}</TableHead>
                  <TableHead>{isRegister ? "Réparation" : "Mode de réparation"}</TableHead>
                  <TableHead>Premier expert</TableHead>
                  {isRegister ? <><TableHead>Statut</TableHead><TableHead>Suivi</TableHead></> : null}
                  <TableHead className="w-20 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  <TableRowsSkeleton rows={7} colSpan={columnCount} />
                ) : null}
                {(list.data?.items ?? []).map((item) => (
                  <Fragment key={item.id}><TableRow
                    className={!isRegister ? "cursor-pointer" : undefined}
                    data-state={!isRegister && expandedId === item.id ? "selected" : undefined}
                    onClick={!isRegister ? (event) => {
                      if ((event.target as HTMLElement).closest("button, a")) return;
                      setExpandedId(expandedId === item.id ? null : item.id);
                    } : undefined}>
                    {isRegister ? <TableCell>
                      <Link
                        className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                        to={`/app/sinistre/dossiers/${item.id}`}
                      >
                        {item.numeroSinistre}
                      </Link>
                    </TableCell> : null}
                    <TableCell>{isRegister ? item.referenceCompagnie || "-" : <button
                      type="button" aria-expanded={expandedId === item.id} aria-controls={`claim-tracking-${item.id}`}
                      aria-label={`Suivi du sinistre ${item.referenceCompagnie || item.numeroSinistre}`}
                      className="flex items-center gap-2 text-left font-medium text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-400"
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                      <ChevronDown aria-hidden="true" className={`size-4 shrink-0 ${expandedId === item.id ? "rotate-180" : ""}`} />
                      {item.referenceCompagnie || "-"}
                    </button>}</TableCell>
                    <TableCell className="max-w-56 whitespace-normal">{item.assure || "-"}</TableCell>
                    <TableCell>{item.numeroPolice || "-"}</TableCell>
                    <TableCell>{item.immatriculation || "-"}</TableCell>
                    <TableCell>{formatDate(item.dateSinistre)}</TableCell>
                    <TableCell>{formatDate(item.dateDeclaration)}</TableCell>
                    {isRegister ? <TableCell>{item.compagnie || "-"}</TableCell> : null}
                    <TableCell className="max-w-56 whitespace-normal">{item.garantiesImpliquees?.join(", ") || "-"}</TableCell>
                    <TableCell>{item.modeReparation ? repairLabels[item.modeReparation] : "-"}</TableCell>
                    <TableCell className="max-w-48 whitespace-normal">{item.premierExpert || "-"}</TableCell>
                    {isRegister ? <><TableCell>
                      <SinistreStatusBadge statut={item.statut} />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{suiviLabels[item.etapeSuivi]}</span>
                      <div>{item.prochaineAction || "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[item.gestionnaire, item.dateEcheanceAction ? formatDate(item.dateEcheanceAction) : null]
                          .filter(Boolean)
                          .join(" · ") || "-"}
                      </div>
                    </TableCell></> : null}
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions pour ${item.numeroSinistre}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/app/sinistre/dossiers/${item.id}`}>
                              <Eye className="size-4" />
                              Consulter le dossier
                            </Link>
                          </DropdownMenuItem>
                          {canManage && !isRegister && item.editable ? (
                            <DropdownMenuItem asChild>
                              <Link to={`/app/sinistre/dossiers/${item.id}#modifier`}>
                                <Pencil className="size-4" />
                                Modifier le dossier
                              </Link>
                            </DropdownMenuItem>
                          ) : null}
                          {canManage && !isRegister && canCancelClaim(item.statut) ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setClaimToCancel(item)}
                              >
                                <Ban className="size-4" />
                                Annuler le dossier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setClaimToDelete(item)}
                              >
                                <Trash2 className="size-4" />
                                Supprimer définitivement
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>{!isRegister && expandedId === item.id ? <TableRow><TableCell colSpan={columnCount} className="whitespace-normal bg-muted/20 px-4 py-3"><div id={`claim-tracking-${item.id}`}><ExpandedTracking id={item.id} /></div></TableCell></TableRow> : null}</Fragment>
                ))}
                {!list.isLoading && !list.isError && (list.data?.items.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Aucun dossier ne correspond aux critères.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <ServerPagination
            className="border-t px-4 py-3"
            page={list.data?.page.number ?? page}
            totalPages={list.data?.page.totalPages ?? 0}
            totalElements={list.data?.page.totalElements ?? 0}
            loading={list.isFetching}
            onPageChange={changePage}
          />
      </section>
      <SinistreDeclarationContextDialog
        open={declarationOpen}
        onOpenChange={setDeclarationOpen}
      />
      <AlertDialog
        open={claimToCancel !== null}
        onOpenChange={(open) => {
          if (!open) setClaimToCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce dossier sinistre ?</AlertDialogTitle>
            <AlertDialogDescription>
              {claimToCancel?.numeroSinistre} restera dans l’historique avec le
              statut « Annulé ». Cette action ne supprime aucune trace du
              dossier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conserver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelClaim.isPending}
              onClick={() => {
                if (claimToCancel) cancelClaim.mutate(claimToCancel.id);
              }}
            >
              Annuler le dossier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={claimToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setClaimToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ce dossier ?</AlertDialogTitle>
            <AlertDialogDescription>
              {claimToDelete?.numeroSinistre} sera supprimé sans possibilité de
              restauration. La suppression sera refusée si le dossier contient
              déjà des documents, une expertise ou une écriture financière.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conserver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteClaim.isPending}
              onClick={() => {
                if (claimToDelete) deleteClaim.mutate(claimToDelete.id);
              }}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function canCancelClaim(statut: StatutSinistre) {
  return ["BROUILLON", "DECLARE", "DOSSIER_INCOMPLET"].includes(statut);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function emptyFilters(): Filters {
  return { query: "", statut: "ALL", etapeSuivi: "ALL", dateDu: "", dateAu: "" };
}
function readState(params: URLSearchParams) {
  return {
    page: Math.max(0, Number(params.get("page") || 0)),
    scope: {
      clientId: params.get("clientId") || "",
      contratId: params.get("contratId") || "",
      brancheId: params.get("brancheId") || "",
    },
    filters: {
      query: params.get("q") || "",
      statut: params.get("statut") || "ALL",
      etapeSuivi: params.get("etapeSuivi") || "ALL",
      dateDu: params.get("dateDu") || "",
      dateAu: params.get("dateAu") || "",
    },
  };
}
function writeState(filters: Filters, page: number, scope: PortfolioScope) {
  const params = new URLSearchParams();
  if (scope.clientId) params.set("clientId", scope.clientId);
  if (scope.contratId) params.set("contratId", scope.contratId);
  if (scope.brancheId) params.set("brancheId", scope.brancheId);
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.statut !== "ALL") params.set("statut", filters.statut);
  if (filters.etapeSuivi !== "ALL") params.set("etapeSuivi", filters.etapeSuivi);
  if (filters.dateDu) params.set("dateDu", filters.dateDu);
  if (filters.dateAu) params.set("dateAu", filters.dateAu);
  if (page > 0) params.set("page", String(page));
  return params;
}
function toIso(date?: Date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ExpandedTracking({ id }: { id: string }) {
  const detail = useQuery({ queryKey: sinistreKeys.detail(id), queryFn: () => sinistreApi.get(id) });
  if (detail.isPending) return <p className="py-3 text-sm text-muted-foreground">Chargement du suivi…</p>;
  if (detail.isError) return <div role="alert" className="flex items-center gap-3 text-sm text-destructive">{detail.error instanceof Error ? detail.error.message : "Suivi indisponible"}<Button variant="outline" size="sm" onClick={() => detail.refetch()}>Réessayer</Button></div>;
  return <SinistreTracking dossier={detail.data} />;
}
