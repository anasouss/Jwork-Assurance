import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FilePlus2, LifeBuoy, MoreHorizontal, Pencil, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { contractKeys, referenceKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/store/auth-store";
import { contractApi } from "../api/contracts";
import { referenceApi } from "../api/references";
import { ProspectionConversionDialog } from "../components/prospections/ProspectionConversionDialog";
import { ProspectionDeleteDialog } from "../components/prospections/ProspectionDeleteDialog";
import { ProspectionPdfDialog } from "../components/prospections/ProspectionPdfDialog";
import { Field } from "../components/Field";
import { toDateOnly } from "../date";
import {
  DEFAULT_PROSPECTION_FILTERS,
  prospectionFiltersFromSearchParams,
  prospectionPageFromSearchParams,
  prospectionSearchParams,
  type ProspectionFilters,
} from "../prospections/prospection-filters";
import type { ContratListItem } from "../types";

export default function ProspectionPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialFilters] = useState(() => prospectionFiltersFromSearchParams(searchParams));
  const [filters, setFilters] = useState<ProspectionFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<ProspectionFilters>(initialFilters);
  const [page, setPage] = useState(() => prospectionPageFromSearchParams(searchParams));
  const [pdfTargetId, setPdfTargetId] = useState<string | null>(null);
  const [convertTargetId, setConvertTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContratListItem | null>(null);
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canDeleteProspection = permissions.includes("contrat:delete") || permissions.includes("contrat:update");

  const listParams = useMemo(() => ({
    compagnieId: appliedFilters.compagnieId === "ALL" ? undefined : appliedFilters.compagnieId,
    dateDu: appliedFilters.du,
    dateAu: appliedFilters.au,
    search: appliedFilters.codeClient.trim() || undefined,
    numeroDevis: appliedFilters.numeroDevis.trim() || undefined,
    page,
    size: 25,
  }), [appliedFilters, page]);
  const prospections = useQuery({
    queryKey: contractKeys.prospections(listParams),
    queryFn: () => contractApi.listProspections(listParams),
    placeholderData: (previous) => previous,
  });
  const companies = useQuery({
    queryKey: referenceKeys.list("compagnies-assurance"),
    queryFn: () => referenceApi.list("compagnies-assurance"),
  });
  const usages = useQuery({
    queryKey: referenceKeys.list("usages"),
    queryFn: () => referenceApi.list("usages"),
  });
  const deleteProspection = useMutation({
    mutationFn: (contratId: string) => contractApi.deleteContrat(contratId),
    onSuccess: async () => {
      const moveToPreviousPage = page > 0 && prospections.data?.items.length === 1;
      if (moveToPreviousPage) {
        const previousPage = page - 1;
        setPage(previousPage);
        setSearchParams(prospectionSearchParams(appliedFilters, previousPage), { replace: true });
      }
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
      toast.success("Devis supprimé");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Le devis ne peut pas être supprimé");
    },
  });

  const applyFilters = (next: ProspectionFilters) => {
    setPage(0);
    setAppliedFilters(next);
    setSearchParams(prospectionSearchParams(next, 0), { replace: true });
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">
          <Link to="/app/production" className="text-blue-600 hover:underline">Dashboard</Link>
          <span className="mx-2 text-muted-foreground">›</span>
          <span>Prospection</span>
        </div>
        <Button asChild>
          <Link to="/app/production/prospection/ajouter-devis">
            <FilePlus2 className="size-4" />
            Ajouter devis
          </Link>
        </Button>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
            <Field label="Compagnie">
              <Select value={filters.compagnieId} onValueChange={(value) => setFilters((current) => ({ ...current, compagnieId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les compagnies</SelectItem>
                  {(companies.data ?? []).map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Du">
              <DatePicker date={filters.du} onSelect={(date) => setFilters((current) => ({ ...current, du: toDateOnly(date) }))} />
            </Field>
            <Field label="Au">
              <DatePicker date={filters.au} onSelect={(date) => setFilters((current) => ({ ...current, au: toDateOnly(date) }))} />
            </Field>
            <Field label="Code ou client">
              <Input value={filters.codeClient} onChange={(event) => setFilters((current) => ({ ...current, codeClient: event.target.value }))} />
            </Field>
            <Field label="N° devis">
              <Input value={filters.numeroDevis} onChange={(event) => setFilters((current) => ({ ...current, numeroDevis: event.target.value }))} />
            </Field>
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
                  setFilters(DEFAULT_PROSPECTION_FILTERS);
                  applyFilters(DEFAULT_PROSPECTION_FILTERS);
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
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead className="bg-emerald-600 text-xs uppercase leading-tight text-white dark:bg-emerald-700">
                <tr>
                  <HeaderCell>N° dossier</HeaderCell>
                  <HeaderCell>Type</HeaderCell>
                  <HeaderCell>Code client</HeaderCell>
                  <HeaderCell>Assuré</HeaderCell>
                  <HeaderCell>N° devis</HeaderCell>
                  <HeaderCell>Compagnie</HeaderCell>
                  <HeaderCell>Date création</HeaderCell>
                  <HeaderCell>Statut</HeaderCell>
                  <HeaderCell>Actions</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {prospections.isLoading ? (
                  <TableRowsSkeleton rows={6} colSpan={9} />
                ) : prospections.data?.items.length ? (
                  prospections.data.items.map((contrat) => (
                    <ProspectionRow
                      key={contrat.id}
                      contrat={contrat}
                      onDownload={() => setPdfTargetId(contrat.id)}
                      onConvert={() => setConvertTargetId(contrat.id)}
                      onDelete={canDeleteProspection ? () => setDeleteTarget(contrat) : undefined}
                    />
                  ))
                ) : (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Aucun devis ne correspond aux filtres.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <ServerPagination
            className="border-t px-4 py-3"
            page={prospections.data?.page.number ?? page}
            totalPages={prospections.data?.page.totalPages ?? 1}
            totalElements={prospections.data?.page.totalElements}
            loading={prospections.isFetching}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              setSearchParams(prospectionSearchParams(appliedFilters, nextPage), { replace: true });
            }}
          />
        </CardContent>
      </Card>

      <ProspectionPdfDialog
        key={pdfTargetId ?? "closed-pdf"}
        contratId={pdfTargetId}
        open={Boolean(pdfTargetId)}
        onOpenChange={(open) => {
          if (!open) setPdfTargetId(null);
        }}
      />
      <ProspectionConversionDialog
        key={convertTargetId ?? "closed-conversion"}
        contratId={convertTargetId}
        open={Boolean(convertTargetId)}
        compagnies={companies.data ?? []}
        usages={usages.data ?? []}
        onOpenChange={(open) => {
          if (!open) setConvertTargetId(null);
        }}
        onConverted={async () => {
          setConvertTargetId(null);
          await queryClient.invalidateQueries({ queryKey: contractKeys.all });
        }}
      />
      <ProspectionDeleteDialog
        open={Boolean(deleteTarget)}
        devisLabel={deleteTarget ? dossierNumber(deleteTarget) : undefined}
        pending={deleteProspection.isPending}
        onOpenChange={(open) => {
          if (!open && !deleteProspection.isPending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) deleteProspection.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}

function ProspectionRow({
  contrat,
  onDownload,
  onConvert,
  onDelete,
}: {
  contrat: ContratListItem;
  onDownload: () => void;
  onConvert: () => void;
  onDelete?: () => void;
}) {
  return (
    <tr className="border-b transition-colors hover:bg-emerald-50/40">
      <Cell className="text-center">{dossierNumber(contrat)}</Cell>
      <Cell className="text-center"><TypeBadge /></Cell>
      <Cell className="text-center uppercase">{clientCode(contrat)}</Cell>
      <Cell className="uppercase">{mainClient(contrat)}</Cell>
      <Cell className="text-center uppercase">{contrat.numeroDevis ?? contrat.numeroPolice ?? "-"}</Cell>
      <Cell className="text-center">{companyLabel(contrat)}</Cell>
      <Cell className="text-center">{formatDate(contrat.createdAt ?? contrat.dateEffet)}</Cell>
      <Cell className="text-center"><StatusBadge contrat={contrat} /></Cell>
      <Cell className="text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" className="h-8 w-8 bg-sky-600 hover:bg-sky-700">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Actions du devis</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDownload}>
              <Download className="size-4" />
              Télécharger devis
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/app/production/contrats/${contrat.id}/assistance`}>
                <LifeBuoy className="size-4" />
                Ajout Assistance
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/app/production/prospection/devis/flotte/${contrat.id}`}>
                <Pencil className="size-4" />
                Modifier
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onConvert}>
              <ShieldCheck className="size-4" />
              Convertir en contrat
            </DropdownMenuItem>
            {onDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2 className="size-4" />
                  Supprimer
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </Cell>
    </tr>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return <th className="px-3 py-3 text-center font-bold">{children}</th>;
}

function Cell({ className, children }: { className?: string; children?: ReactNode }) {
  return <td className={cn("px-3 py-2 align-middle", className)}>{children}</td>;
}

function TypeBadge() {
  return <Badge className="min-w-5 justify-center rounded bg-emerald-600 px-1.5 py-0.5 text-white hover:bg-emerald-600">F</Badge>;
}

function StatusBadge({ contrat }: { contrat: ContratListItem }) {
  const expired = Boolean(contrat.dateEcheance && contrat.dateEcheance < new Date().toISOString().slice(0, 10));
  return (
    <Badge className={cn("rounded px-2 py-0.5 text-[11px] text-white", expired ? "bg-amber-500 hover:bg-amber-500" : "bg-green-600 hover:bg-green-600")}>
      {expired ? "Expiré" : "En cours"}
    </Badge>
  );
}

function dossierNumber(contrat: ContratListItem) {
  return contrat.numeroDossier ?? contrat.numeroDevis ?? contrat.numeroPolice ?? `#${contrat.id}`;
}

function clientCode(contrat: ContratListItem) {
  const client = contrat.clients?.find((item) => item.role === "SOUSCRIPTEUR") ?? contrat.clients?.[0];
  return client?.codeClient ?? client?.nomAffichage ?? "-";
}

function mainClient(contrat: ContratListItem) {
  return contrat.clients?.find((client) => client.role === "SOUSCRIPTEUR")?.nomAffichage
    ?? contrat.clients?.[0]?.nomAffichage
    ?? "-";
}

function companyLabel(contrat: ContratListItem) {
  return contrat.compagnieLibelle ?? contrat.compagnieCode ?? contrat.compagnieAssuranceId ?? "-";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
