import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, FilePlus2, Search, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDate, formatMoney, natureLabels, statusLabels } from "../format";
import { SinistreStatusBadge } from "../components/SinistreStatusBadge";
import type { NatureSinistre, StatutSinistre } from "../types";

const PAGE_SIZE = 25;
type Filters = {
  query: string;
  statut: string;
  nature: string;
  dateDu: string;
  dateAu: string;
};

export default function SinistreListPage() {
  const [params, setParams] = useSearchParams();
  const initial = useMemo(() => readState(params), []);
  const [filters, setFilters] = useState(initial.filters);
  const [applied, setApplied] = useState(initial.filters);
  const [page, setPage] = useState(initial.page);
  const canCreate = useAuthStore(
    (state) => state.user?.permissions?.includes("sinistre:create") ?? false,
  );
  const request = useMemo(
    () => ({
      query: applied.query.trim() || undefined,
      statut:
        applied.statut === "ALL"
          ? undefined
          : (applied.statut as StatutSinistre),
      nature:
        applied.nature === "ALL"
          ? undefined
          : (applied.nature as NatureSinistre),
      dateDu: applied.dateDu || undefined,
      dateAu: applied.dateAu || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [applied, page],
  );
  const list = useQuery({
    queryKey: sinistreKeys.list(request),
    queryFn: () => sinistreApi.list(request),
    placeholderData: (previous) => previous,
  });

  function apply(next: Filters) {
    setApplied(next);
    setPage(0);
    setParams(writeState(next, 0), { replace: true });
  }
  function reset() {
    const next = emptyFilters();
    setFilters(next);
    apply(next);
  }
  function changePage(next: number) {
    setPage(next);
    setParams(writeState(applied, next), { replace: true });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">
            Sinistres
          </p>
          <h1 className="text-xl font-semibold">Dossiers sinistre</h1>
          <p className="text-sm text-muted-foreground">
            Suivi opérationnel et financier des déclarations.
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link to="/app/sinistre/declarer">
              <FilePlus2 className="size-4" />
              Déclarer
            </Link>
          </Button>
        ) : null}
      </div>
      <Card className="shadow-none">
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_210px_210px_180px_180px_auto]">
            <Field label="Recherche">
              <Input
                value={filters.query}
                placeholder="N° sinistre, police, assuré…"
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
            <Field label="Nature">
              <Select
                value={filters.nature}
                onValueChange={(nature) =>
                  setFilters((current) => ({ ...current, nature }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les natures</SelectItem>
                  {Object.entries(natureLabels).map(([value, label]) => (
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
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1180px]">
              <TableHeader className="bg-sky-700 text-white [&_th]:text-white">
                <TableRow className="hover:bg-sky-700">
                  <TableHead>N° sinistre</TableHead>
                  <TableHead>Assuré</TableHead>
                  <TableHead>Police</TableHead>
                  <TableHead>Nature</TableHead>
                  <TableHead>Date sinistre</TableHead>
                  <TableHead>Compagnie</TableHead>
                  <TableHead>Immatriculation</TableHead>
                  <TableHead>Provision</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-20 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  <TableRowsSkeleton rows={7} colSpan={10} />
                ) : null}
                {(list.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                        to={`/app/sinistre/dossiers/${item.id}`}
                      >
                        {item.numeroSinistre}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {item.referenceCompagnie || "-"}
                      </div>
                    </TableCell>
                    <TableCell>{item.assure || "-"}</TableCell>
                    <TableCell>{item.numeroPolice || "-"}</TableCell>
                    <TableCell>{natureLabels[item.nature]}</TableCell>
                    <TableCell>{formatDate(item.dateSinistre)}</TableCell>
                    <TableCell>{item.compagnie || "-"}</TableCell>
                    <TableCell>{item.immatriculation || "-"}</TableCell>
                    <TableCell>{formatMoney(item.provisionCourante)}</TableCell>
                    <TableCell>
                      <SinistreStatusBadge statut={item.statut} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link
                          aria-label={`Ouvrir ${item.numeroSinistre}`}
                          to={`/app/sinistre/dossiers/${item.id}`}
                        >
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!list.isLoading && (list.data?.items.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
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
        </CardContent>
      </Card>
    </div>
  );
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
  return { query: "", statut: "ALL", nature: "ALL", dateDu: "", dateAu: "" };
}
function readState(params: URLSearchParams) {
  return {
    page: Math.max(0, Number(params.get("page") || 0)),
    filters: {
      query: params.get("q") || "",
      statut: params.get("statut") || "ALL",
      nature: params.get("nature") || "ALL",
      dateDu: params.get("dateDu") || "",
      dateAu: params.get("dateAu") || "",
    },
  };
}
function writeState(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.statut !== "ALL") params.set("statut", filters.statut);
  if (filters.nature !== "ALL") params.set("nature", filters.nature);
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
