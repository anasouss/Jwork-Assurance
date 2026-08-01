import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Ban, Search } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ServerPagination } from "@/components/shared/server-pagination";
import { TableRowsSkeleton } from "@/components/shared/table-rows-skeleton";
import type { AttestationStockItem, AttestationStockStatus, ReferenceOption } from "../types";
import { ALL_STOCK_FILTERS, type AttestationStockFilters } from "../attestation-stock/stock-filters";

export { ALL_STOCK_FILTERS, type AttestationStockFilters } from "../attestation-stock/stock-filters";

type Props = {
  filters: AttestationStockFilters;
  compagnies: ReferenceOption[];
  groupes: ReferenceOption[];
  attestations: AttestationStockItem[];
  page: number;
  totalPages: number;
  totalElements: number;
  loading: boolean;
  onFiltersChange: Dispatch<SetStateAction<AttestationStockFilters>>;
  onSearch: () => void;
  onPageChange: (page: number) => void;
  onCancel: (attestation: AttestationStockItem) => void;
};

export function AttestationStockSearchPanel({
  filters,
  compagnies,
  groupes,
  attestations,
  page,
  totalPages,
  totalElements,
  loading,
  onFiltersChange,
  onSearch,
  onPageChange,
  onCancel,
}: Props) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="size-4" />
          Liste des attestations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="N° attestation">
            <Input
              value={filters.numero}
              onChange={(event) => onFiltersChange((current) => ({ ...current, numero: event.target.value }))}
            />
          </Field>
          <Field label="Compagnie">
            <Select
              value={filters.compagnieAssuranceId}
              onValueChange={(value) => onFiltersChange((current) => ({ ...current, compagnieAssuranceId: value }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STOCK_FILTERS}>Toutes les compagnies</SelectItem>
                {compagnies.map((compagnie) => (
                  <SelectItem key={compagnie.id} value={String(compagnie.id)}>{compagnie.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Usage stock">
            <Select
              value={filters.groupeUsageAttestationId}
              onValueChange={(value) => onFiltersChange((current) => ({ ...current, groupeUsageAttestationId: value }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STOCK_FILTERS}>Tous les usages</SelectItem>
                {groupes.map((groupe) => (
                  <SelectItem key={groupe.id} value={String(groupe.id)}>
                    {groupe.code} · {groupe.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="État">
            <Select
              value={filters.statut}
              onValueChange={(value) => onFiltersChange((current) => ({
                ...current,
                statut: value as AttestationStockFilters["statut"],
              }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STOCK_FILTERS}>Toutes</SelectItem>
                <SelectItem value="DISPONIBLE">Disponible</SelectItem>
                <SelectItem value="UTILISEE">Utilisée</SelectItem>
                <SelectItem value="RESERVEE">Réservée</SelectItem>
                <SelectItem value="ANNULEE">Annulée</SelectItem>
                <SelectItem value="DESACTIVEE">Désactivée</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full" onClick={onSearch}>
              <Search className="size-4" />
              Rechercher
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[1100px]">
            <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
              <TableRow className="hover:bg-emerald-700">
                <TableHead>Compagnie</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Assuré</TableHead>
                <TableHead className="text-center">N° police</TableHead>
                <TableHead>N° attestation</TableHead>
                <TableHead className="text-center">Date d’effet</TableHead>
                <TableHead>Motif d’annulation</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRowsSkeleton rows={6} colSpan={9} /> : attestations.map((attestation) => (
                <TableRow key={attestation.id}>
                  <TableCell>{attestation.compagnieAssuranceNom}</TableCell>
                  <TableCell>{attestation.groupeUsageAttestationCode}</TableCell>
                  <TableCell>{attestation.assure ?? "-"}</TableCell>
                  <TableCell className="text-center">{attestation.numeroPolice ?? "-"}</TableCell>
                  <TableCell className="font-medium">{attestation.numero}</TableCell>
                  <TableCell className="text-center">{formatDate(attestation.dateEffet)}</TableCell>
                  <TableCell className="max-w-64 truncate" title={attestation.motifAnnulation ?? undefined}>
                    {attestation.motifAnnulation ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={stockStatusVariant(attestation.statut)}>{stockStatusLabel(attestation.statut)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {attestation.statut === "DISPONIBLE" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        title="Annuler l’attestation"
                        onClick={() => onCancel(attestation)}
                      >
                        <Ban className="size-4" />
                        <span className="sr-only">Annuler l’attestation</span>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && attestations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                    Aucune attestation pour ces filtres.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <ServerPagination
          page={page}
          totalPages={totalPages}
          totalElements={totalElements}
          loading={loading}
          onPageChange={onPageChange}
        />
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function stockStatusVariant(statut: AttestationStockStatus): BadgeProps["variant"] {
  if (statut === "DISPONIBLE") return "success";
  if (statut === "UTILISEE") return "secondary";
  if (statut === "RESERVEE") return "warning";
  if (statut === "ANNULEE" || statut === "DESACTIVEE") return "destructive";
  return "outline";
}

function stockStatusLabel(statut: AttestationStockStatus) {
  return {
    DISPONIBLE: "Disponible",
    RESERVEE: "Réservée",
    UTILISEE: "Utilisée",
    ANNULEE: "Annulée",
    DESACTIVEE: "Désactivée",
  }[statut];
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
