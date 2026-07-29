import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Eye, FilePlus2, MoreHorizontal, Search, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { productionApi } from "../api";
import { toDateOnly } from "../date";
import type { ContratSummary, ReferenceOption, TypeContrat } from "../types";

type ContratFilters = {
  typeContrat: "ALL" | TypeContrat;
  typeDate: "EFFET" | "ECHEANCE";
  du?: string;
  au?: string;
  codeClient: string;
  compagnieId: "ALL" | string;
  numeroPolice: string;
};

type MovementLine = {
  key: string;
  mouvementId?: string | null;
  numeroMouvement: string;
  code?: string | null;
  libelle?: string | null;
  categorie?: string | null;
  statut?: string | null;
  dateEffet?: string | null;
  dateEcheance?: string | null;
  isSynthetic?: boolean;
};

type ContractHistoryLine = {
  contrat: ContratSummary;
  movement: MovementLine;
};

type ContractHistoryGroup = {
  key: string;
  lines: ContractHistoryLine[];
};

const DEFAULT_FILTERS: ContratFilters = {
  typeContrat: "ALL",
  typeDate: "EFFET",
  codeClient: "",
  compagnieId: "ALL",
  numeroPolice: "",
};

export default function ContratsPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<ContratFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ContratFilters>(DEFAULT_FILTERS);
  const canCreateContrat = useAuthStore((state) => state.user?.permissions?.includes("contrat:create") ?? false);
  const contrats = useQuery({ queryKey: ["contrats"], queryFn: productionApi.listContrats });
  const companies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance", "contrats"],
    queryFn: () => productionApi.referentiel("compagnies-assurance"),
  });
  const conventions = useQuery({
    queryKey: ["referentiel", "conventions", "contrats"],
    queryFn: () => productionApi.referentiel("conventions"),
  });

  const companyMap = useMemo(() => optionMap(companies.data), [companies.data]);
  const conventionMap = useMemo(() => optionMap(conventions.data), [conventions.data]);
  const rows = useMemo(
    () => contractHistoryGroups(contrats.data ?? [])
      .filter((group) => group.lines.some(({ contrat }) => matchesFilters(contrat, appliedFilters, companyMap))),
    [appliedFilters, companyMap, contrats.data]
  );

  return (
    <div className="grid min-w-0 gap-4 overflow-x-hidden">
      <Card className="min-w-0 border-border/70 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Liste des dossiers</CardTitle>
          {canCreateContrat ? (
            <Button asChild size="sm">
              <Link to="/app/production/ajouter-dossier">
                <FilePlus2 className="size-4" />
                Ajouter dossier
              </Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_1.1fr_1fr_1fr_1fr_1fr_1fr_auto]">
            <FilterField label="Type de contrat">
              <Select value={filters.typeContrat} onValueChange={(value) => setFilters((current) => ({ ...current, typeContrat: value as ContratFilters["typeContrat"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les contrats</SelectItem>
                  <SelectItem value="PARTICULIER">Mono</SelectItem>
                  <SelectItem value="CONVENTION">Convention</SelectItem>
                  <SelectItem value="FLOTTE">Flotte</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Type de date">
              <Select value={filters.typeDate} onValueChange={(value) => setFilters((current) => ({ ...current, typeDate: value as ContratFilters["typeDate"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFFET">Date d'effet</SelectItem>
                  <SelectItem value="ECHEANCE">Date d'échéance</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Du">
              <DatePicker date={filters.du} onSelect={(date) => setFilters((current) => ({ ...current, du: toDateOnly(date) }))} />
            </FilterField>
            <FilterField label="Au">
              <DatePicker date={filters.au} onSelect={(date) => setFilters((current) => ({ ...current, au: toDateOnly(date) }))} />
            </FilterField>
            <FilterField label="Code / client">
              <Input value={filters.codeClient} onChange={(event) => setFilters((current) => ({ ...current, codeClient: event.target.value }))} />
            </FilterField>
            <FilterField label="Compagnie">
              <Select value={filters.compagnieId} onValueChange={(value) => setFilters((current) => ({ ...current, compagnieId: value }))}>
                <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes</SelectItem>
                  {(companies.data ?? []).map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Numéro de police">
              <Input value={filters.numeroPolice} onChange={(event) => setFilters((current) => ({ ...current, numeroPolice: event.target.value }))} />
            </FilterField>
            <div className="flex items-end gap-2">
              <Button type="button" className="h-9 px-4" onClick={() => setAppliedFilters(filters)}>
                <Search className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setAppliedFilters(DEFAULT_FILTERS);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 border-border/70 shadow-none">
        <CardContent className="min-w-0 p-0">
          <div className="max-w-full overflow-x-auto p-4">
            <table className="w-full min-w-[1320px] border-collapse text-sm">
              <thead className="bg-emerald-600 text-xs uppercase leading-tight text-white dark:bg-emerald-700">
                <tr>
                  <TableHeaderCell>Dossier N°</TableHeaderCell>
                  <TableHeaderCell className="w-10" />
                  <TableHeaderCell>Code client</TableHeaderCell>
                  <TableHeaderCell>Assuré</TableHeaderCell>
                  <TableHeaderCell>Branche</TableHeaderCell>
                  <TableHeaderCell>Produit</TableHeaderCell>
                  <TableHeaderCell>Mouvement N°</TableHeaderCell>
                  <TableHeaderCell>Police N°</TableHeaderCell>
                  <TableHeaderCell>Compagnie</TableHeaderCell>
                  <TableHeaderCell>Événement</TableHeaderCell>
                  <TableHeaderCell>Date d'effet</TableHeaderCell>
                  <TableHeaderCell>Date d'échéance</TableHeaderCell>
                  <TableHeaderCell>Statut</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {contrats.isLoading ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Chargement des dossiers...</td>
                  </tr>
                ) : rows.length ? (
                  rows.map((group) => {
                    const current = group.lines[0];
                    const olderMovements = group.lines.slice(1);
                    const isExpanded = Boolean(expanded[group.key]);
                    return (
                      <Fragment key={group.key}>
                        <ContratRow
                          contrat={current.contrat}
                          movement={current.movement}
                          companyLabel={companyLabel(current.contrat, companyMap)}
                          conventionLabel={conventionLabel(current.contrat, conventionMap)}
                          movementCount={group.lines.length}
                          expanded={isExpanded}
                          canExpand={olderMovements.length > 0}
                          onToggle={() => setExpanded((currentExpanded) => ({ ...currentExpanded, [group.key]: !isExpanded }))}
                        />
                        {isExpanded ? olderMovements.map(({ contrat, movement }) => (
                          <ContratRow
                            key={`${contrat.id}-${movement.key}`}
                            contrat={contrat}
                            movement={movement}
                            companyLabel={companyLabel(contrat, companyMap)}
                            conventionLabel={conventionLabel(contrat, conventionMap)}
                            movementCount={group.lines.length}
                            child
                          />
                        )) : null}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Aucun dossier ne correspond aux filtres.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ContratRow({
  contrat,
  movement,
  companyLabel,
  conventionLabel,
  movementCount,
  expanded,
  canExpand,
  child,
  onToggle,
}: {
  contrat: ContratSummary;
  movement: MovementLine;
  companyLabel: string;
  conventionLabel?: string;
  movementCount: number;
  expanded?: boolean;
  canExpand?: boolean;
  child?: boolean;
  onToggle?: () => void;
}) {
  return (
    <tr className={cn("border-b transition-colors hover:bg-muted/40", child && "bg-emerald-100/70 hover:bg-emerald-100 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/35")}>
      <TableCellStrong>{dossierNumber(contrat)}</TableCellStrong>
      <td className="px-2 py-2 text-center"><TypeBadge type={contrat.typeContrat} /></td>
      <TableCell>{clientCode(contrat)}</TableCell>
      <TableCell className="font-medium uppercase">{mainClient(contrat)}</TableCell>
      <TableCell className="uppercase">{branchLabel(contrat)}</TableCell>
      <TableCell>
        <div className="flex flex-col items-center text-center">
          <span>{productLabel(contrat)}</span>
          {conventionLabel ? <span className="text-xs text-muted-foreground">{conventionLabel}</span> : null}
        </div>
      </TableCell>
      <TableCell className="text-center">{movement.numeroMouvement}</TableCell>
      <TableCell className="text-center uppercase">{contrat.numeroPolice ?? "-"}</TableCell>
      <TableCell className="text-center">{companyLabel}</TableCell>
      <TableCell className="text-center font-semibold">
        <div className="flex flex-col items-center">
          <span>{eventLabel(contrat, movement)}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">{formatDate(movement.dateEffet ?? contrat.dateEffet)}</TableCell>
      <TableCell className="text-center">{formatDate(movement.dateEcheance ?? contrat.dateEcheance)}</TableCell>
      <TableCell className="text-center"><StatusBadge statut={statusLabel(contrat, movement)} /></TableCell>
      <td className="px-2 py-2">
        <div className="flex items-center justify-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-8 text-sky-600 hover:text-sky-700" title="Visualiser">
            <Link to={showContratPath(contrat, movement)}><Eye className="size-4" /></Link>
          </Button>
          <RowActions contrat={contrat} movement={movement} child={child} />
          {canExpand ? (
            <Button type="button" size="icon" className="size-8 bg-blue-600 hover:bg-blue-700" onClick={onToggle} title={expanded ? "Masquer les mouvements" : `Afficher ${movementCount - 1} mouvement(s)`}>
              <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function RowActions({ contrat, movement, child }: { contrat: ContratSummary; movement: MovementLine; child?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [draftChoiceCode, setDraftChoiceCode] = useState<string | null>(null);
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [renewalTerm, setRenewalTerm] = useState<"CABINET" | "COMPAGNIE">("CABINET");
  const isFlotte = contrat.typeContrat === "FLOTTE";
  const piecesPath = `/app/production/contrats/${contrat.id}/pieces-jointes${movement.mouvementId && !movement.isSynthetic ? `?mouvementId=${movement.mouvementId}` : ""}`;
  const assistancePath = `/app/production/contrats/${contrat.id}/assistance${movement.mouvementId && !movement.isSynthetic ? `?mouvementId=${movement.mouvementId}` : ""}`;
  const carteVertePath = `/app/production/contrats/${contrat.id}/cartes-vertes${movement.mouvementId && !movement.isSynthetic ? `?mouvementId=${movement.mouvementId}` : ""}`;
  const editPath = editContratPath(contrat);
  const terminal = isTerminalContratRow(contrat, movement);
  const hasActiveAvenants = (contrat.mouvements ?? []).some((item) => {
    const code = String(item.code ?? "").trim().toUpperCase();
    const statut = String(item.statut ?? "").trim().toUpperCase();
    return code !== "AN" && statut !== "ANNULE";
  });
  const canCreateMovement = !child && !terminal && !Boolean(contrat.renouvele) && isActiveContrat(contrat);
  const canRenew = canCreateMovement && normalize(contrat.typeRenouvellement) === "RENOUVELABLE";
  const canEditDirectly = (isDirectlyEditable(contrat) || isActiveContrat(contrat))
    && !child
    && !terminal
    && !hasActiveAvenants;
  const rectificationPath = movement.mouvementId && movement.code
    ? `${avenantPath(contrat, movement.code)}?mouvementId=${movement.mouvementId}`
    : null;
  const canRectifyMovement = !child
    && !terminal
    && Boolean(rectificationPath)
    && !movement.isSynthetic
    && String(movement.statut ?? "").trim().toUpperCase() === "VALIDE";
  const canDownload = !isTerminalMovementCode(movement.code);
  const hasPrimaryActions = canEditDirectly || canCreateMovement;
  const deleteMode = resolveDeleteMode(contrat, movement, child);
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (deleteMode === "CONTRAT") {
        return productionApi.deleteContrat(contrat.id);
      }
      if (deleteMode === "MOUVEMENT" && movement.mouvementId) {
        return productionApi.deleteMouvement(contrat.id, movement.mouvementId);
      }
      return Promise.resolve();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contrats"] });
      setConfirmDeleteOpen(false);
      toast.success(deleteMode === "CONTRAT" ? "Contrat supprime" : "Avenant supprime");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    },
  });
  const deleteTitle = deleteMode === "CONTRAT" ? "Supprimer le contrat ?" : "Supprimer l'avenant ?";
  const deleteDescription = deleteMode === "CONTRAT"
    ? "Cette action supprimera definitivement ce brouillon. Elle ne peut pas etre annulee."
    : "Cette action supprimera uniquement le dernier avenant actif avec sa quittance generee. Les mouvements plus anciens ne seront pas modifies.";
  const avenantDrafts = sortedAvenantDrafts(contrat);
  const selectedDraft = draftChoiceCode
    ? avenantDrafts.find((draft) => normalize(draft.codeTypeMouvement) === normalize(draftChoiceCode))
    : undefined;
  const selectAvenant = (code: string) => {
    const existingDraft = avenantDrafts.find((draft) => normalize(draft.codeTypeMouvement) === normalize(code));
    if (existingDraft) {
      setDraftChoiceCode(existingDraft.codeTypeMouvement);
      return;
    }
    navigate(avenantPath(contrat, code));
  };
  const restartDraftMutation = useMutation({
    mutationFn: (code: string) => productionApi.deleteAvenantDraft(contrat.id, code),
    onSuccess: async (_data, code) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contrats"] }),
        queryClient.invalidateQueries({ queryKey: ["avenant-draft", contrat.id, code] }),
      ]);
      setDraftChoiceCode(null);
      navigate(avenantPath(contrat, code));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Le brouillon ne peut pas être supprimé");
    },
  });
  const renewalMutation = useMutation({
    mutationFn: (mode: "CABINET" | "COMPAGNIE") =>
      productionApi.createRenouvellementDraft(contrat.id, mode),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: ["contrats"] });
      setRenewalDialogOpen(false);
      toast.success("Brouillon de renouvellement prêt");
      navigate(renewalDraftPath(draft));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Le renouvellement ne peut pas être préparé");
    },
  });
  const startRenewal = () => {
    if (contrat.renouvellementTermeCompagnieEligible) {
      setRenewalTerm("CABINET");
      setRenewalDialogOpen(true);
      return;
    }
    renewalMutation.mutate("CABINET");
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" className="size-8 bg-sky-600 hover:bg-sky-700" title="Actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {avenantDrafts.length ? (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  Brouillons ({avenantDrafts.length})
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60">
                  {avenantDrafts.map((draft) => (
                    <DropdownMenuItem
                      key={draft.id}
                      onSelect={() => setDraftChoiceCode(draft.codeTypeMouvement)}
                    >
                      Continuer {draft.libelleTypeMouvement || draft.codeTypeMouvement}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {canEditDirectly ? (
            <DropdownMenuItem asChild>
              <Link to={editPath}>Modifier</Link>
            </DropdownMenuItem>
          ) : null}
          {canRectifyMovement && rectificationPath ? (
            <DropdownMenuItem asChild>
              <Link to={rectificationPath}>Modifier</Link>
            </DropdownMenuItem>
          ) : null}
          {canCreateMovement ? (
            <>
              {isFlotte ? (
                <>
                  <DropdownMenuItem onSelect={() => selectAvenant("INC_F")}>Incorporation</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => selectAvenant("RET_F")}>Retrait</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => selectAvenant("PRI_F")}>Précision</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => selectAvenant("DUP_F")}>Duplicata</DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Autre avenant</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      <DropdownMenuItem onSelect={() => selectAvenant("MOG_F")}>Modification garanties</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => selectAvenant("EXR_F")}>Extension remorque</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => selectAvenant("RES_F")}>Résiliation</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => selectAvenant("RCH_F")}>Résiliation à l'échéance</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              ) : (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Ajouter avenant</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    <DropdownMenuItem onSelect={() => selectAvenant("EXG_M")}>Extension garanties</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("MOG_M")}>Modification garanties</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("EXR_M")}>Extension remorque</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("PRI_M")}>Précision</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("DUP_M")}>Duplicata</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("RES_M")}>Résiliation</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("RCH_M")}>Résiliation à l'échéance</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("ANN_M")}>Annulation</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuItem asChild>
                <Link to={assistancePath}>Contrat assistance</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={carteVertePath}>{isFlotte ? "Ajout carte verte" : "Ajouter une carte verte"}</Link>
              </DropdownMenuItem>
              {canRenew ? (
                <DropdownMenuItem disabled={renewalMutation.isPending} onSelect={startRenewal}>
                  Renouvellement
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
          {hasPrimaryActions ? <DropdownMenuSeparator /> : null}
          {canDownload ? <DropdownMenuItem>Télécharger</DropdownMenuItem> : null}
          <DropdownMenuItem asChild>
            <Link to={piecesPath}>Les pièces jointes</Link>
          </DropdownMenuItem>
          {deleteMode ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={deleteMutation.isPending}
                onSelect={() => {
                  setConfirmDeleteOpen(true);
                }}
              >
                {deleteMode === "CONTRAT" ? "Supprimer" : "Supprimer l'avenant"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteMode) {
                  deleteMutation.mutate();
                }
              }}
            >
              {deleteMutation.isPending ? "Traitement..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={renewalDialogOpen} onOpenChange={(open) => {
        if (!renewalMutation.isPending) setRenewalDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Type de terme</DialogTitle>
            <DialogDescription>Choisissez le mode de renouvellement à appliquer pour ce contrat.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <button
              type="button"
              className={cn(
                "grid grid-cols-[1fr_auto] gap-3 rounded-md border p-4 text-left transition-colors",
                renewalTerm === "CABINET" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40"
              )}
              onClick={() => setRenewalTerm("CABINET")}
            >
              <span className="grid gap-1">
                <span className="font-semibold">Terme cabinet</span>
                <span className="text-xs text-muted-foreground">Renouvellement interne avec contrôle du stock sur le numéro d’attestation.</span>
                <Badge className="mt-1 w-fit bg-emerald-100 text-[10px] text-emerald-800 hover:bg-emerald-100">AVEC STOCK</Badge>
              </span>
              <ShieldCheck className="size-5 text-emerald-700" />
            </button>
            <button
              type="button"
              className={cn(
                "grid grid-cols-[1fr_auto] gap-3 rounded-md border p-4 text-left transition-colors",
                renewalTerm === "COMPAGNIE" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40"
              )}
              onClick={() => setRenewalTerm("COMPAGNIE")}
            >
              <span className="grid gap-1">
                <span className="font-semibold">Terme compagnie</span>
                <span className="text-xs text-muted-foreground">Renouvellement sans contrôle du stock d’attestation selon les règles compagnie.</span>
                <Badge className="mt-1 w-fit bg-amber-100 text-[10px] text-amber-800 hover:bg-amber-100">SANS STOCK</Badge>
              </span>
              <Building2 className="size-5 text-emerald-700" />
            </button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={renewalMutation.isPending} onClick={() => setRenewalDialogOpen(false)}>Annuler</Button>
            <Button type="button" disabled={renewalMutation.isPending} onClick={() => renewalMutation.mutate(renewalTerm)}>
              {renewalMutation.isPending ? "Préparation..." : "Continuer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(selectedDraft)} onOpenChange={(open) => {
        if (!open && !restartDraftMutation.isPending) {
          setDraftChoiceCode(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Un brouillon existe déjà</AlertDialogTitle>
            <AlertDialogDescription>
              Un brouillon « {selectedDraft?.libelleTypeMouvement || selectedDraft?.codeTypeMouvement} » est déjà enregistré pour ce contrat. Vous pouvez continuer la saisie existante ou la supprimer et recommencer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restartDraftMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={restartDraftMutation.isPending || !selectedDraft}
              onClick={(event) => {
                event.preventDefault();
                if (selectedDraft) {
                  restartDraftMutation.mutate(selectedDraft.codeTypeMouvement);
                }
              }}
            >
              {restartDraftMutation.isPending ? "Suppression..." : "Supprimer et recommencer"}
            </AlertDialogAction>
            <AlertDialogAction
              disabled={restartDraftMutation.isPending || !selectedDraft}
              onClick={(event) => {
                event.preventDefault();
                if (selectedDraft) {
                  const code = selectedDraft.codeTypeMouvement;
                  setDraftChoiceCode(null);
                  navigate(avenantPath(contrat, code));
                }
              }}
            >
              Continuer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function showContratPath(contrat: ContratSummary, movement: MovementLine) {
  const query = movement.mouvementId && !movement.isSynthetic ? `?mouvementId=${movement.mouvementId}` : "";
  return `/app/production/contrats/${contrat.id}${query}`;
}

function editContratPath(contrat: ContratSummary) {
  if (contrat.contratOrigineId) return renewalDraftPath(contrat);
  if (contrat.prospection && contrat.typeContrat === "FLOTTE") return `/app/production/prospection/devis/flotte/${contrat.id}`;
  if (contrat.typeContrat === "FLOTTE") return `/app/production/ajouter-dossier/flotte/${contrat.id}`;
  if (contrat.typeContrat === "CONVENTION") return `/app/production/ajouter-dossier/convention/${contrat.id}`;
  return `/app/production/ajouter-dossier/particulier/${contrat.id}`;
}

function renewalDraftPath(contrat: ContratSummary) {
  if (contrat.typeContrat === "FLOTTE") return `/app/production/renouvellements/flotte/${contrat.id}`;
  if (contrat.typeContrat === "CONVENTION") return `/app/production/renouvellements/convention/${contrat.id}`;
  return `/app/production/renouvellements/particulier/${contrat.id}`;
}

function isDirectlyEditable(contrat: ContratSummary) {
  const statut = String(contrat.statut ?? "").toUpperCase();
  return statut.includes("DRAFT") && (Boolean(contrat.brouillon) || Boolean(contrat.prospection));
}

function isActiveContrat(contrat: ContratSummary) {
  return String(contrat.statut ?? "").toUpperCase() === "ACTIVE" && !contrat.prospection && !contrat.brouillon;
}

function isTerminalContratRow(contrat: ContratSummary, movement: MovementLine) {
  const statut = String(contrat.statut ?? "").toUpperCase();
  return statut.includes("RESILI") || statut.includes("ANNU") || isTerminalMovementCode(movement.code);
}

function isTerminalMovementCode(code?: string | null) {
  const normalized = String(code ?? "").trim().toUpperCase();
  return ["RES_F", "RES_M", "RCH_F", "RCH_M", "ANN_M"].includes(normalized);
}

function resolveDeleteMode(contrat: ContratSummary, movement: MovementLine, child?: boolean): "CONTRAT" | "MOUVEMENT" | null {
  if (child) return null;
  if (String(movement.statut ?? "").toUpperCase() === "ANNULE") return null;
  if (movement.mouvementId && !movement.isSynthetic && movement.code !== "AN") return "MOUVEMENT";
  const hasMovements = (contrat.mouvements?.length ?? 0) > 0;
  if (!hasMovements && isDraftLikeSummary(contrat)) return "CONTRAT";
  return null;
}

function isDraftLikeSummary(contrat: ContratSummary) {
  return String(contrat.statut ?? "").toUpperCase().includes("DRAFT") || Boolean(contrat.brouillon) || Boolean(contrat.prospection);
}

function avenantPath(contrat: ContratSummary, code: string) {
  return `/app/production/contrats/${contrat.id}/avenants/${code}`;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-700 dark:text-neutral-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TableHeaderCell({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn("px-3 py-3 text-center font-bold", className)}>{children}</th>;
}

function TableCell({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <td className={cn("px-3 py-2 align-middle", className)}>{children}</td>;
}

function TableCellStrong({ children }: { children?: React.ReactNode }) {
  return <td className="px-3 py-2 align-middle font-medium">{children}</td>;
}

function matchesFilters(contrat: ContratSummary, filters: ContratFilters, companyMap: Map<string, ReferenceOption>) {
  if (filters.typeContrat !== "ALL" && contrat.typeContrat !== filters.typeContrat) return false;
  if (filters.compagnieId !== "ALL" && String(contrat.compagnieAssuranceId ?? "") !== filters.compagnieId) return false;
  if (filters.numeroPolice.trim() && !includesNormalized(contrat.numeroPolice, filters.numeroPolice)) return false;

  const movement = movementLines(contrat)[0];
  const date = filters.typeDate === "EFFET" ? (movement.dateEffet ?? contrat.dateEffet) : (movement.dateEcheance ?? contrat.dateEcheance);
  if (filters.du && (!date || date < filters.du)) return false;
  if (filters.au && (!date || date > filters.au)) return false;

  const clientSearch = filters.codeClient.trim();
  if (clientSearch) {
    const haystack = [
      clientCode(contrat),
      mainClient(contrat),
      contrat.numeroContrat,
      contrat.numeroPolice,
      companyLabel(contrat, companyMap),
    ].join(" ");
    if (!includesNormalized(haystack, clientSearch)) return false;
  }

  return true;
}

function movementLines(contrat: ContratSummary): MovementLine[] {
  const sorted = sortedMouvements(contrat);
  if (sorted.length) {
    return sorted.map((movement) => ({
      key: `${contrat.id}-${movement.id}`,
      mouvementId: movement.id,
      numeroMouvement: movement.numeroMouvement ?? "-",
      code: movement.code,
      libelle: movement.libelle,
      categorie: movement.categorie,
      statut: movement.statut,
      dateEffet: movement.dateEffet,
      dateEcheance: movement.dateEcheance,
    }));
  }
  return [{
    key: `${contrat.id}-initial`,
    numeroMouvement: "1",
    code: "AN",
    libelle: "Affaire nouvelle",
    categorie: "AFFAIRE_NOUVELLE",
    statut: contrat.statut,
    dateEffet: contrat.dateEffet,
    dateEcheance: contrat.dateEcheance,
    isSynthetic: true,
  }];
}

function contractHistoryGroups(contrats: ContratSummary[]): ContractHistoryGroup[] {
  const byId = new Map(contrats.map((contrat) => [String(contrat.id), contrat]));
  const renewedContractIds = new Set(
    contrats
      .map((contrat) => contrat.contratOrigineId)
      .filter((id): id is string => Boolean(id))
      .map(String)
  );
  const leaves = contrats.filter((contrat) => !renewedContractIds.has(String(contrat.id)));
  const groupedIds = new Set<string>();

  const groups = leaves.map((latest) => {
    const chain: ContratSummary[] = [];
    const chainIds = new Set<string>();
    let current: ContratSummary | undefined = latest;
    while (current && !chainIds.has(String(current.id))) {
      const currentId = String(current.id);
      chain.push(current);
      chainIds.add(currentId);
      groupedIds.add(currentId);
      current = current.contratOrigineId ? byId.get(String(current.contratOrigineId)) : undefined;
    }

    const lines = chain.flatMap((contrat) => movementLines(contrat).map((movement) => ({ contrat, movement })));
    return { key: String(latest.id), lines };
  });

  for (const contrat of contrats) {
    if (!groupedIds.has(String(contrat.id))) {
      groups.push({
        key: String(contrat.id),
        lines: movementLines(contrat).map((movement) => ({ contrat, movement })),
      });
    }
  }

  return groups.sort((a, b) => {
    const aCurrent = a.lines[0]?.contrat;
    const bCurrent = b.lines[0]?.contrat;
    const dateDiff = dateRank(bCurrent?.dateEffet) - dateRank(aCurrent?.dateEffet);
    return dateDiff || numericRank(bCurrent?.id) - numericRank(aCurrent?.id);
  });
}

function sortedMouvements(contrat: ContratSummary) {
  return [...(contrat.mouvements ?? [])]
    .filter((movement) => String(movement.statut ?? "").toUpperCase() !== "ANNULE")
    .sort((a, b) => {
      const statusDiff = movementStatusRank(a.statut) - movementStatusRank(b.statut);
      if (statusDiff !== 0) return statusDiff;
      const dateDiff = dateRank(b.dateEffet) - dateRank(a.dateEffet);
      if (dateDiff !== 0) return dateDiff;
      const numeroDiff = numericRank(b.numeroMouvement) - numericRank(a.numeroMouvement);
      if (numeroDiff !== 0) return numeroDiff;
      return numericRank(b.id) - numericRank(a.id);
    });
}

function sortedAvenantDrafts(contrat: ContratSummary) {
  return [...(contrat.avenantDrafts ?? [])]
    .sort((a, b) => dateRank(b.updatedAt) - dateRank(a.updatedAt));
}

function movementStatusRank(statut?: string | null) {
  return String(statut ?? "").toUpperCase() === "ANNULE" ? 1 : 0;
}

function optionMap(options?: ReferenceOption[]) {
  return new Map((options ?? []).map((option) => [String(option.id), option]));
}

function dossierNumber(contrat: ContratSummary) {
  return contrat.numeroDossier ?? contrat.numeroContrat ?? contrat.numeroPolice ?? `#${contrat.id}`;
}

function clientCode(contrat: ContratSummary) {
  const client = contrat.clients?.find((item) => item.role === "SOUSCRIPTEUR") ?? contrat.clients?.[0];
  return client?.client?.codeClient
    ?? client?.client?.rc
    ?? client?.client?.cin
    ?? client?.nomAffichage
    ?? "-";
}

function mainClient(contrat: ContratSummary) {
  return contrat.clients?.find((client) => client.role === "SOUSCRIPTEUR")?.nomAffichage
    ?? contrat.clients?.[0]?.nomAffichage
    ?? "-";
}

function branchLabel(contrat: ContratSummary) {
  return contrat.vehicules?.[0]?.typeVehicule === "AUTOMOBILE" || contrat.typeContrat ? "Automobile" : "-";
}

function productLabel(contrat: ContratSummary) {
  if (contrat.typeContrat === "PARTICULIER") return "Mono";
  if (contrat.typeContrat === "FLOTTE") return "Flotte";
  return "Convention";
}

function companyLabel(contrat: ContratSummary, companyMap: Map<string, ReferenceOption>) {
  const company = contrat.compagnieAssuranceId ? companyMap.get(String(contrat.compagnieAssuranceId)) : undefined;
  return String(company?.code ?? company?.libelle ?? contrat.compagnieAssuranceId ?? "-");
}

function conventionLabel(contrat: ContratSummary, conventionMap: Map<string, ReferenceOption>) {
  if (contrat.typeContrat !== "CONVENTION" || !contrat.conventionId) return undefined;
  const convention = conventionMap.get(String(contrat.conventionId));
  return String(convention?.code ?? convention?.libelle ?? "");
}

function eventLabel(contrat: ContratSummary, movement: MovementLine) {
  if (movement.libelle) return titleCaseMovement(movement.libelle);
  if (contrat.contratOrigineId) return "Renouvellement";
  return "Affaire nouvelle";
}

function statusLabel(contrat: ContratSummary, movement: MovementLine) {
  if (movement.code?.toUpperCase().startsWith("RES")) return "RESILIE";
  return movement.statut ?? contrat.statut;
}

function TypeBadge({ type }: { type: ContratSummary["typeContrat"] }) {
  const label = type === "PARTICULIER" ? "P" : type === "FLOTTE" ? "F" : "C";
  const className = type === "PARTICULIER"
    ? "bg-sky-600 text-white hover:bg-sky-600"
    : type === "FLOTTE"
      ? "bg-emerald-600 text-white hover:bg-emerald-600"
      : "bg-amber-600 text-white hover:bg-amber-600";
  return <Badge className={cn("min-w-5 justify-center rounded px-1.5 py-0.5", className)}>{label}</Badge>;
}

function StatusBadge({ statut }: { statut?: string | null }) {
  const normalized = normalize(statut);
  const className = normalized.includes("RESIL")
    ? "bg-red-600 text-white hover:bg-red-600"
    : normalized.includes("DRAFT") || normalized.includes("BROUILLON")
      ? "bg-amber-500 text-white hover:bg-amber-500"
      : "bg-green-600 text-white hover:bg-green-600";
  return <Badge className={cn("rounded px-2 py-0.5 text-[11px]", className)}>{statusText(statut)}</Badge>;
}

function statusText(statut?: string | null) {
  const normalized = normalize(statut);
  if (normalized.includes("RESIL")) return "Résilié";
  if (normalized.includes("DRAFT") || normalized.includes("BROUILLON")) return "Brouillon";
  if (!statut) return "-";
  if (normalized === "EN_COURS" || normalized === "EN COURS" || normalized === "ACTIF") return "En cours";
  return titleCaseMovement(String(statut).replace(/_/g, " "));
}

function titleCaseMovement(value: string) {
  return value
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|\s|-)(\p{L})/gu, (match) => match.toLocaleUpperCase("fr-FR"));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function dateRank(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numericRank(value?: string | number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function includesNormalized(value: unknown, search: string) {
  return normalize(value).includes(normalize(search));
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
}
