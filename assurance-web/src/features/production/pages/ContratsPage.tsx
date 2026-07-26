import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Eye, FilePlus2, MoreHorizontal, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  numeroMouvement: number;
  code?: string | null;
  libelle?: string | null;
  categorie?: string | null;
  statut?: string | null;
  dateEffet?: string | null;
  dateEcheance?: string | null;
  isSynthetic?: boolean;
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
    () => (contrats.data ?? []).filter((contrat) => matchesFilters(contrat, appliedFilters, companyMap)),
    [appliedFilters, companyMap, contrats.data]
  );

  return (
    <div className="grid gap-4">
      <Card className="border-border/70 shadow-none">
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

      <Card className="border-border/70 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto p-4">
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
                  rows.map((contrat) => {
                    const movements = movementLines(contrat);
                    const current = movements[0];
                    const olderMovements = movements.slice(1);
                    const isExpanded = Boolean(expanded[contrat.id]);
                    return (
                      <Fragment key={contrat.id}>
                        <ContratRow
                          contrat={contrat}
                          movement={current}
                          companyLabel={companyLabel(contrat, companyMap)}
                          conventionLabel={conventionLabel(contrat, conventionMap)}
                          movementCount={movements.length}
                          expanded={isExpanded}
                          canExpand={olderMovements.length > 0}
                          onToggle={() => setExpanded((currentExpanded) => ({ ...currentExpanded, [contrat.id]: !isExpanded }))}
                        />
                        {isExpanded ? olderMovements.map((movement) => (
                          <ContratRow
                            key={movement.key}
                            contrat={contrat}
                            movement={movement}
                            companyLabel={companyLabel(contrat, companyMap)}
                            conventionLabel={conventionLabel(contrat, conventionMap)}
                            movementCount={movements.length}
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
          {contrat.contratOrigineId && !child ? <span className="text-xs font-normal text-blue-600">Contrat origine #{contrat.contratOrigineId}</span> : null}
        </div>
      </TableCell>
      <TableCell className="text-center">{formatDate(movement.dateEffet ?? contrat.dateEffet)}</TableCell>
      <TableCell className="text-center">{formatDate(movement.dateEcheance ?? contrat.dateEcheance)}</TableCell>
      <TableCell className="text-center"><StatusBadge statut={statusLabel(contrat, movement)} /></TableCell>
      <td className="px-2 py-2">
        <div className="flex items-center justify-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="size-8 text-sky-600 hover:text-sky-700" title="Visualiser">
            <Eye className="size-4" />
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
  const isFlotte = contrat.typeContrat === "FLOTTE";
  const piecesPath = `/app/production/contrats/${contrat.id}/pieces-jointes${movement.mouvementId && !movement.isSynthetic ? `?mouvementId=${movement.mouvementId}` : ""}`;
  const assistancePath = `/app/production/contrats/${contrat.id}/assistance${movement.mouvementId && !movement.isSynthetic ? `?mouvementId=${movement.mouvementId}` : ""}`;
  const editPath = editContratPath(contrat);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon" className="size-8 bg-sky-600 hover:bg-sky-700" title="Actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link to={editPath}>Modifier</Link>
        </DropdownMenuItem>
        {child ? null : (
          <>
            {isFlotte ? (
              <>
                <DropdownMenuItem>Incorporation</DropdownMenuItem>
                <DropdownMenuItem>Retrait</DropdownMenuItem>
                <DropdownMenuItem>Précision</DropdownMenuItem>
                <DropdownMenuItem>Duplicata</DropdownMenuItem>
                <DropdownMenuItem>Autre avenant</DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem>Ajouter un avenant</DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to={assistancePath}>Contrat assistance</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>{isFlotte ? "Ajout carte verte" : "Ajouter une carte verte"}</DropdownMenuItem>
            <DropdownMenuItem>Renouvellement</DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem>Télécharger</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={piecesPath}>Les pièces jointes</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Supprimer</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function editContratPath(contrat: ContratSummary) {
  if (contrat.typeContrat === "FLOTTE") return `/app/production/ajouter-dossier/flotte/${contrat.id}`;
  if (contrat.typeContrat === "CONVENTION") return `/app/production/ajouter-dossier/convention/${contrat.id}`;
  return `/app/production/ajouter-dossier/particulier/${contrat.id}`;
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
    return sorted.map((movement, index) => ({
      key: `${contrat.id}-${movement.id}`,
      mouvementId: movement.id,
      numeroMouvement: Number(movement.numeroMouvement) || sorted.length - index,
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
    numeroMouvement: 1,
    code: "AN",
    libelle: "Affaire nouvelle",
    categorie: "AFFAIRE_NOUVELLE",
    statut: contrat.statut,
    dateEffet: contrat.dateEffet,
    dateEcheance: contrat.dateEcheance,
    isSynthetic: true,
  }];
}

function sortedMouvements(contrat: ContratSummary) {
  return [...(contrat.mouvements ?? [])].sort((a, b) => {
    const dateDiff = dateRank(b.dateEffet) - dateRank(a.dateEffet);
    if (dateDiff !== 0) return dateDiff;
    return (Number(b.numeroMouvement) || 0) - (Number(a.numeroMouvement) || 0);
  });
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
  if (normalized.includes("DRAFT")) return "Brouillon";
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
