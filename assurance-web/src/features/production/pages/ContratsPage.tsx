import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye, FilePlus2, MoreHorizontal, Search, X } from "lucide-react";
import { toast } from "sonner";
import { amendmentKeys, contractKeys, referenceKeys } from "@/lib/query-keys";
import { FilterField as SharedFilterField, ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { avenantApi } from "../api/avenants";
import { contractApi } from "../api/contracts";
import { referenceApi } from "../api/references";
import { ContractWorkflowDialogs } from "../components/contracts/ContractWorkflowDialogs";
import { FinancialHistoryRecalculationDialog } from "../components/contracts/FinancialHistoryRecalculationDialog";
import {
  DEFAULT_CONTRACT_FILTERS,
  contractPageFromSearchParams,
  contractFiltersFromSearchParams,
  contractSearchParams,
  type ContractFilters,
} from "../contracts/contract-filters";
import { toDateOnly } from "../date";
import type { ContratListItem } from "../types";

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
  autoriseAssistance?: boolean | null;
  autoriseCarteVerte?: boolean | null;
  isSynthetic?: boolean;
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  AUTOMOBILE: "Automobile",
  CAMION: "Camion",
  MOTO: "Moto",
  BUS: "Bus",
  TRACTEUR: "Tracteur",
  AUTRE: "Autre",
};

export default function ContratsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialFilters] = useState<ContractFilters>(() => contractFiltersFromSearchParams(searchParams));
  const [page, setPage] = useState(() => contractPageFromSearchParams(searchParams));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<ContractFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<ContractFilters>(initialFilters);
  const canCreateContrat = useAuthStore((state) => state.user?.permissions?.includes("contrat:create") ?? false);
  const listParams = useMemo(() => ({
    typeContrat: appliedFilters.typeContrat === "ALL" ? undefined : appliedFilters.typeContrat,
    typeDate: appliedFilters.typeDate,
    dateDu: appliedFilters.du,
    dateAu: appliedFilters.au,
    search: appliedFilters.codeClient.trim() || undefined,
    compagnieId: appliedFilters.compagnieId === "ALL" ? undefined : appliedFilters.compagnieId,
    numeroPolice: appliedFilters.numeroPolice.trim() || undefined,
    clientId: appliedFilters.clientId || undefined,
    page,
    size: 25,
  }), [appliedFilters, page]);
  const contrats = useQuery({
    queryKey: contractKeys.list(listParams),
    queryFn: () => contractApi.listContrats(listParams),
    placeholderData: (previous) => previous,
  });
  const companies = useQuery({
    queryKey: referenceKeys.list("compagnies-assurance"),
    queryFn: () => referenceApi.list("compagnies-assurance"),
  });
  const rows = useMemo(
    () => (contrats.data?.items ?? []).map((group) => ({
      key: group.key,
      lines: group.contrats.flatMap((contrat) =>
        movementLines(contrat).map((movement) => ({ contrat, movement }))
      ),
    })),
    [contrats.data?.items]
  );
  const applyFilters = (next: ContractFilters) => {
    setPage(0);
    setAppliedFilters(next);
    setSearchParams(contractSearchParams(next, 0), { replace: true });
  };

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
              <Select value={filters.typeContrat} onValueChange={(value) => setFilters((current) => ({ ...current, typeContrat: value as ContractFilters["typeContrat"] }))}>
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
              <Select value={filters.typeDate} onValueChange={(value) => setFilters((current) => ({ ...current, typeDate: value as ContractFilters["typeDate"] }))}>
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
              <Input value={filters.codeClient} onChange={(event) => setFilters((current) => ({ ...current, codeClient: event.target.value, clientId: "" }))} />
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
              <Button type="button" className="h-9 px-4" onClick={() => applyFilters(filters)}>
                <Search className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  setFilters(DEFAULT_CONTRACT_FILTERS);
                  applyFilters(DEFAULT_CONTRACT_FILTERS);
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
                  <TableHeaderCell className="w-36 min-w-36 whitespace-nowrap">
                    Dossier N°
                  </TableHeaderCell>
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
                  <TableRowsSkeleton rows={7} colSpan={14} />
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
                          companyLabel={companyLabel(current.contrat)}
                          conventionLabel={conventionLabel(current.contrat)}
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
                            companyLabel={companyLabel(contrat)}
                            conventionLabel={conventionLabel(contrat)}
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
          <ServerPagination
            className="border-t px-4 py-3"
            page={contrats.data?.page.number ?? page}
            totalPages={contrats.data?.page.totalPages ?? 1}
            totalElements={contrats.data?.page.totalElements}
            loading={contrats.isFetching}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              setSearchParams(contractSearchParams(appliedFilters, nextPage), { replace: true });
            }}
          />
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
  contrat: ContratListItem;
  movement: MovementLine;
  companyLabel: string;
  conventionLabel?: string;
  movementCount: number;
  expanded?: boolean;
  canExpand?: boolean;
  child?: boolean;
  onToggle?: () => void;
}) {
  const canViewContrat = useAuthStore(
    (state) => state.user?.permissions?.includes("contrat:view") ?? false
  );

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
          {canViewContrat ? (
            <Button asChild variant="ghost" size="icon" className="size-8 text-sky-600 hover:text-sky-700" title="Visualiser">
              <Link
                to={showContratPath(contrat, movement)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye className="size-4" />
              </Link>
            </Button>
          ) : null}
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

function RowActions({ contrat, movement, child }: { contrat: ContratListItem; movement: MovementLine; child?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [draftChoiceCode, setDraftChoiceCode] = useState<string | null>(null);
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [financialRecalculationOpen, setFinancialRecalculationOpen] = useState(false);
  const [renewalTerm, setRenewalTerm] = useState<"CABINET" | "COMPAGNIE">("CABINET");
  const isFlotte = contrat.typeContrat === "FLOTTE";
  const piecesPath = `/app/production/contrats/${contrat.id}/pieces-jointes${movement.mouvementId && !movement.isSynthetic ? `?mouvementId=${movement.mouvementId}` : ""}`;
  const assistancePath = `/app/production/contrats/${contrat.id}/assistance${movement.mouvementId && !movement.isSynthetic ? `?mouvementId=${movement.mouvementId}` : ""}`;
  const carteVertePath = `/app/production/contrats/${contrat.id}/cartes-vertes${movement.mouvementId && !movement.isSynthetic ? `?mouvementId=${movement.mouvementId}` : ""}`;
  const editPath = editContratPath(contrat);
  const terminal = isTerminalContratRow(contrat, movement);
  const canUpdateContrat = permissions.includes("contrat:update");
  const canCreateContrat = permissions.includes("contrat:create");
  const canCreateAvenant = permissions.includes("avenant:create") || canUpdateContrat;
  const canRectifyAvenant = permissions.includes("avenant:rectify") || canUpdateContrat;
  const canDeleteContrat = permissions.includes("contrat:delete") || canUpdateContrat;
  const canDeleteAvenant = permissions.includes("avenant:delete") || canUpdateContrat;
  const canRenewContrat = permissions.includes("contrat:renew") || canUpdateContrat;
  const canManageAssistance = permissions.includes("assistance:manage") || canUpdateContrat;
  const canManageCarteVerte = permissions.includes("carte-verte:manage") || canUpdateContrat;
  const canViewContrat = permissions.includes("contrat:view");
  const canViewPieces = permissions.includes("piece-jointe:view") || permissions.includes("contrat:view");
  const canRecalculateFinancialHistory = permissions.includes("contrat:recalculate-financial-history")
    && !child
    && isActiveContrat(contrat)
    && contrat.modeSaisieGaranties === "AUTOMATIQUE_GRILLE";
  const hasActiveAvenants = (contrat.mouvements ?? []).some((item) => {
    const statut = String(item.statut ?? "").trim().toUpperCase();
    return !isInitialContractMovement(item) && statut !== "ANNULE";
  });
  const canCreateMovement = canCreateAvenant && !child && !terminal && !contrat.renouvele && isActiveContrat(contrat);
  const canRenew = canRenewContrat && !child && !terminal && !contrat.renouvele
    && isActiveContrat(contrat) && normalize(contrat.typeRenouvellement) === "RENOUVELABLE";
  const canEditDirectly = (isDirectlyEditable(contrat) || isActiveContrat(contrat))
    && (canUpdateContrat || canCreateContrat)
    && !child
    && !terminal
    && !hasActiveAvenants;
  const rectificationPath = movement.mouvementId && movement.code
    ? `${avenantPath(contrat, movement.code)}?mouvementId=${movement.mouvementId}`
    : null;
  const latestMovementId = sortedMouvements(contrat)[0]?.id;
  const canRectifyMovement = !child
    && canRectifyAvenant
    && !terminal
    && Boolean(rectificationPath)
    && String(movement.mouvementId ?? "") === String(latestMovementId ?? "")
    && !movement.isSynthetic
    && !isInitialContractMovement(movement)
    && String(movement.statut ?? "").trim().toUpperCase() === "VALIDE";
  const canDownload = canViewContrat && !isTerminalMovementCode(movement.code);
  const canOpenAssistance = canManageAssistance
    && !terminal
    && !movement.isSynthetic
    && movement.autoriseAssistance === true;
  const canOpenCarteVerte = canManageCarteVerte
    && !terminal
    && !movement.isSynthetic
    && movement.autoriseCarteVerte === true;
  const hasPrimaryActions = canEditDirectly || canCreateMovement || canOpenAssistance || canOpenCarteVerte
    || canRecalculateFinancialHistory;
  const resolvedDeleteMode = resolveDeleteMode(contrat, movement, child);
  const deleteMode = resolvedDeleteMode === "CONTRAT" && canDeleteContrat
    ? resolvedDeleteMode
    : resolvedDeleteMode === "MOUVEMENT" && canDeleteAvenant
      ? resolvedDeleteMode
      : null;
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (deleteMode === "CONTRAT") {
        return contractApi.deleteContrat(contrat.id);
      }
      if (deleteMode === "MOUVEMENT" && movement.mouvementId) {
        return contractApi.deleteMouvement(contrat.id, movement.mouvementId);
      }
      return Promise.resolve();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
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
    mutationFn: (code: string) => avenantApi.deleteAvenantDraft(contrat.id, code),
    onSuccess: async (_data, code) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: contractKeys.all }),
        queryClient.invalidateQueries({ queryKey: amendmentKeys.draft(contrat.id, code) }),
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
      contractApi.createRenouvellementDraft(contrat.id, mode),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
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
          {canCreateAvenant && avenantDrafts.length ? (
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
                    <DropdownMenuItem onSelect={() => selectAvenant("CHV_M")}>Changement véhicule</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("EXR_M")}>Extension remorque</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("PRO_M")}>Provisoire</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("PRI_M")}>Précision</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("DUP_M")}>Duplicata</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("RES_M")}>Résiliation</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("RCH_M")}>Résiliation à l'échéance</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => selectAvenant("ANN_M")}>Annulation</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canRenew ? (
                <DropdownMenuItem disabled={renewalMutation.isPending} onSelect={startRenewal}>
                  Renouvellement
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
          {canOpenAssistance ? (
            <DropdownMenuItem asChild>
              <Link to={assistancePath}>Contrat assistance</Link>
            </DropdownMenuItem>
          ) : null}
          {canOpenCarteVerte ? (
            <DropdownMenuItem asChild>
              <Link to={carteVertePath}>Carte verte</Link>
            </DropdownMenuItem>
          ) : null}
          {canRecalculateFinancialHistory ? (
            <DropdownMenuItem onSelect={() => setFinancialRecalculationOpen(true)}>
              Recalculer l’historique financier
            </DropdownMenuItem>
          ) : null}
          {hasPrimaryActions ? <DropdownMenuSeparator /> : null}
          {canDownload ? <DropdownMenuItem>Télécharger</DropdownMenuItem> : null}
          {canViewPieces ? (
            <DropdownMenuItem asChild>
              <Link to={piecesPath}>Les pièces jointes</Link>
            </DropdownMenuItem>
          ) : null}
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
      <ContractWorkflowDialogs
        deleteDialog={{
          open: confirmDeleteOpen,
          title: deleteTitle,
          description: deleteDescription,
          pending: deleteMutation.isPending,
          onOpenChange: setConfirmDeleteOpen,
          onConfirm: () => {
            if (deleteMode) deleteMutation.mutate();
          },
        }}
        renewalDialog={{
          open: renewalDialogOpen,
          term: renewalTerm,
          pending: renewalMutation.isPending,
          onOpenChange: setRenewalDialogOpen,
          onTermChange: setRenewalTerm,
          onConfirm: () => renewalMutation.mutate(renewalTerm),
        }}
        draftDialog={{
          draft: selectedDraft,
          pending: restartDraftMutation.isPending,
          onOpenChange: (open) => {
            if (!open && !restartDraftMutation.isPending) setDraftChoiceCode(null);
          },
          onRestart: () => {
            if (selectedDraft) restartDraftMutation.mutate(selectedDraft.codeTypeMouvement);
          },
          onContinue: () => {
            if (!selectedDraft) return;
            const code = selectedDraft.codeTypeMouvement;
            setDraftChoiceCode(null);
            navigate(avenantPath(contrat, code));
          },
        }}
      />
      <FinancialHistoryRecalculationDialog
        contratId={contrat.id}
        open={financialRecalculationOpen}
        onOpenChange={setFinancialRecalculationOpen}
      />
    </>
  );
}

function showContratPath(contrat: ContratListItem, movement: MovementLine) {
  const query = movement.mouvementId && !movement.isSynthetic ? `?mouvementId=${movement.mouvementId}` : "";
  return `/app/production/contrats/${contrat.id}${query}`;
}

function editContratPath(contrat: ContratListItem) {
  if (contrat.contratOrigineId) return renewalDraftPath(contrat);
  if (contrat.prospection && contrat.typeContrat === "FLOTTE") return `/app/production/prospection/devis/flotte/${contrat.id}`;
  if (contrat.typeContrat === "FLOTTE") return `/app/production/ajouter-dossier/flotte/${contrat.id}`;
  if (contrat.typeContrat === "CONVENTION") return `/app/production/ajouter-dossier/convention/${contrat.id}`;
  return `/app/production/ajouter-dossier/particulier/${contrat.id}`;
}

function renewalDraftPath(contrat: ContratListItem) {
  if (contrat.typeContrat === "FLOTTE") return `/app/production/renouvellements/flotte/${contrat.id}`;
  if (contrat.typeContrat === "CONVENTION") return `/app/production/renouvellements/convention/${contrat.id}`;
  return `/app/production/renouvellements/particulier/${contrat.id}`;
}

function isDirectlyEditable(contrat: ContratListItem) {
  const statut = String(contrat.statut ?? "").toUpperCase();
  return statut.includes("DRAFT") && (Boolean(contrat.brouillon) || Boolean(contrat.prospection));
}

function isActiveContrat(contrat: ContratListItem) {
  return String(contrat.statut ?? "").toUpperCase() === "ACTIVE" && !contrat.prospection && !contrat.brouillon;
}

function isTerminalContratRow(contrat: ContratListItem, movement: MovementLine) {
  const statut = String(contrat.statut ?? "").toUpperCase();
  return statut.includes("RESILI") || statut.includes("ANNU") || isTerminalMovementCode(movement.code);
}

function isTerminalMovementCode(code?: string | null) {
  const normalized = String(code ?? "").trim().toUpperCase();
  return ["RES_F", "RES_M", "RCH_F", "RCH_M", "ANN_M"].includes(normalized);
}

function isInitialContractMovement(movement: { code?: string | null; categorie?: string | null }) {
  const code = String(movement.code ?? "").trim().toUpperCase();
  const categorie = String(movement.categorie ?? "").trim().toUpperCase();
  return code === "AN"
    || code === "REN"
    || categorie === "AFFAIRE_NOUVELLE"
    || categorie === "RENOUVELLEMENT";
}

function resolveDeleteMode(contrat: ContratListItem, movement: MovementLine, child?: boolean): "CONTRAT" | "MOUVEMENT" | null {
  if (child) return null;
  if (String(movement.statut ?? "").toUpperCase() === "ANNULE") return null;
  if (movement.mouvementId && !movement.isSynthetic && !isInitialContractMovement(movement)) return "MOUVEMENT";
  const hasMovements = (contrat.mouvements?.length ?? 0) > 0;
  if (!hasMovements && isDraftLikeSummary(contrat)) return "CONTRAT";
  return null;
}

function isDraftLikeSummary(contrat: ContratListItem) {
  return String(contrat.statut ?? "").toUpperCase().includes("DRAFT") || Boolean(contrat.brouillon) || Boolean(contrat.prospection);
}

function avenantPath(contrat: ContratListItem, code: string) {
  return `/app/production/contrats/${contrat.id}/avenants/${code}`;
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <SharedFilterField
      label={label}
      labelClassName="font-semibold text-slate-700 dark:text-neutral-300"
    >
      {children}
    </SharedFilterField>
  );
}

function TableHeaderCell({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn("px-3 py-3 text-center font-bold", className)}>{children}</th>;
}

function TableCell({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <td className={cn("px-3 py-2 align-middle", className)}>{children}</td>;
}

function TableCellStrong({ children }: { children?: React.ReactNode }) {
  return (
    <td className="w-36 min-w-36 whitespace-nowrap px-3 py-2 align-middle font-medium">
      {children}
    </td>
  );
}

function movementLines(contrat: ContratListItem): MovementLine[] {
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
      autoriseAssistance: movement.autoriseAssistance,
      autoriseCarteVerte: movement.autoriseCarteVerte,
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

function sortedMouvements(contrat: ContratListItem) {
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

function sortedAvenantDrafts(contrat: ContratListItem) {
  return [...(contrat.avenantDrafts ?? [])]
    .sort((a, b) => dateRank(b.updatedAt) - dateRank(a.updatedAt));
}

function movementStatusRank(statut?: string | null) {
  return String(statut ?? "").toUpperCase() === "ANNULE" ? 1 : 0;
}

function dossierNumber(contrat: ContratListItem) {
  return contrat.numeroDossier ?? contrat.numeroContrat ?? contrat.numeroPolice ?? `#${contrat.id}`;
}

function clientCode(contrat: ContratListItem) {
  const client = contrat.clients?.find((item) => item.role === "SOUSCRIPTEUR") ?? contrat.clients?.[0];
  return client?.codeClient
    ?? client?.nomAffichage
    ?? "-";
}

function mainClient(contrat: ContratListItem) {
  return contrat.clients?.find((client) => client.role === "SOUSCRIPTEUR")?.nomAffichage
    ?? contrat.clients?.[0]?.nomAffichage
    ?? "-";
}

function branchLabel(contrat: ContratListItem) {
  return contrat.premierTypeVehicule
    ? VEHICLE_TYPE_LABELS[contrat.premierTypeVehicule] ?? contrat.premierTypeVehicule
    : "-";
}

function productLabel(contrat: ContratListItem) {
  if (contrat.typeContrat === "PARTICULIER") return "Mono";
  if (contrat.typeContrat === "FLOTTE") return "Flotte";
  return "Convention";
}

function companyLabel(contrat: ContratListItem) {
  return String(contrat.compagnieCode ?? contrat.compagnieLibelle ?? contrat.compagnieAssuranceId ?? "-");
}

function conventionLabel(contrat: ContratListItem) {
  if (contrat.typeContrat !== "CONVENTION" || !contrat.conventionId) return undefined;
  return contrat.conventionLibelle ?? contrat.conventionCode ?? undefined;
}

function eventLabel(contrat: ContratListItem, movement: MovementLine) {
  if (movement.libelle) return titleCaseMovement(movement.libelle);
  if (contrat.contratOrigineId) return "Renouvellement";
  return "Affaire nouvelle";
}

function statusLabel(contrat: ContratListItem, movement: MovementLine) {
  if (movement.code?.toUpperCase().startsWith("RES")) return "RESILIE";
  return movement.statut ?? contrat.statut;
}

function TypeBadge({ type }: { type: ContratListItem["typeContrat"] }) {
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

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
}
