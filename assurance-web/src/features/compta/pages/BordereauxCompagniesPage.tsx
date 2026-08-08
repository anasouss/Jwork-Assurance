import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Eye, FilePlus2, Search, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ServerPagination } from "@/components/shared/server-pagination";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import type { CompanyBordereau, CompanyBordereauStatus } from "../types";

const all = "ALL";

export default function BordereauxCompagniesPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreate = permissions.includes("bordereau-compagnie:create");
  const canPay = permissions.includes("reglement-compagnie:create");
  const [compagnieId, setCompagnieId] = useState(all);
  const [status, setStatus] = useState<string>(all);
  const [dateDu, setDateDu] = useState("");
  const [dateAu, setDateAu] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const companies = useQuery({
    queryKey: ["compta", "companies"],
    queryFn: comptaApi.companies,
  });
  const bordereaux = useQuery({
    queryKey: [
      "compta",
      "company-bordereaux",
      compagnieId,
      status,
      dateDu,
      dateAu,
      submittedSearch,
      page,
    ],
    queryFn: () => comptaApi.companyBordereaux({
      compagnieId: compagnieId === all ? undefined : compagnieId,
      statut: status === all ? undefined : status as CompanyBordereauStatus,
      dateDu: dateDu || undefined,
      dateAu: dateAu || undefined,
      search: submittedSearch || undefined,
      page,
      size: 25,
    }),
  });

  const rows = bordereaux.data?.rows ?? [];
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds]
  );
  const selectedCompany = selectedRows[0]?.compagnieId;
  const payableRows = rows.filter((row) => isPayable(row));
  const allPayableSelected = payableRows.length > 0
    && payableRows.every((row) => selectedIds.includes(row.id));

  function toggleRow(row: CompanyBordereau, checked: boolean) {
    if (!isPayable(row)) return;
    if (checked && selectedCompany && selectedCompany !== row.compagnieId) return;
    setSelectedIds((current) => checked
      ? [...new Set([...current, row.id])]
      : current.filter((id) => id !== row.id));
  }

  function resetFilters() {
    setCompagnieId(all);
    setStatus(all);
    setDateDu("");
    setDateAu("");
    setSearch("");
    setSubmittedSearch("");
    setSelectedIds([]);
    setPage(0);
  }

  const paymentUrl = `/app/compta/bordereaux-compagnies/reglement?bordereauIds=${selectedIds.join(",")}`;

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Compagnie</div>
          <h1 className="mt-1 text-xl font-semibold">Bordereaux compagnies</h1>
          <p className="text-sm text-muted-foreground">
            Déclarations, transmissions, rapprochements et règlements aux compagnies.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPay && selectedIds.length > 0 ? (
            <Button asChild variant="outline">
              <Link to={paymentUrl}>
                <WalletCards className="size-4" />
                Régler la sélection ({selectedIds.length})
              </Link>
            </Button>
          ) : null}
          {canCreate ? (
            <Button asChild>
              <Link to="/app/compta/bordereaux-compagnies/nouveau">
                <FilePlus2 className="size-4" />
                Nouveau bordereau
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 rounded-md border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Compagnie">
            <Select value={compagnieId} onValueChange={(value) => {
              setCompagnieId(value);
              setPage(0);
              setSelectedIds([]);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={all}>Toutes</SelectItem>
                {(companies.data ?? []).map((company) => (
                  <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Statut du bordereau">
            <Select value={status} onValueChange={(value) => {
              setStatus(value);
              setPage(0);
              setSelectedIds([]);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={all}>Tous</SelectItem>
                <SelectItem value="BROUILLON">Brouillon</SelectItem>
                <SelectItem value="VALIDE">Validé</SelectItem>
                <SelectItem value="TRANSMIS">Transmis</SelectItem>
                <SelectItem value="ANNULE">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Période du">
            <DatePicker date={dateDu} onSelect={(value) => {
              setDateDu(toDateOnly(value) ?? "");
              setPage(0);
            }} />
          </Field>
          <Field label="Période au">
            <DatePicker date={dateAu} onSelect={(value) => {
              setDateAu(toDateOnly(value) ?? "");
              setPage(0);
            }} />
          </Field>
          <div className="grid content-end gap-2">
            <Button type="button" variant="outline" onClick={resetFilters}>Réinitialiser</Button>
          </div>
        </div>
        <form className="flex gap-2" onSubmit={(event) => {
          event.preventDefault();
          setSubmittedSearch(search.trim());
          setPage(0);
          setSelectedIds([]);
        }}>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="N° bordereau, police, quittance ou compagnie"
          />
          <Button type="submit"><Search className="size-4" />Rechercher</Button>
        </form>
      </section>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-4">
        <Summary label="Bordereaux" value={String(bordereaux.data?.summary.total ?? 0)} />
        <Summary label="Net compagnie" value={money(bordereaux.data?.summary.netCompagnie)} />
        <Summary label="Réglé" value={money(bordereaux.data?.summary.montantRegle)} />
        <Summary label="Solde à régler" value={money(bordereaux.data?.summary.soldeRestant)} />
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Registre des bordereaux</h2>
            <p className="text-xs text-muted-foreground">
              La sélection de règlement doit appartenir à une seule compagnie.
            </p>
          </div>
          <Building2 className="size-5 text-muted-foreground" />
        </div>
        <Table className="min-w-[1180px]">
            <TableHeader className="bg-orange-600 text-xs uppercase text-white">
              <TableRow className="hover:bg-orange-600">
                <TableHead className="w-12 px-4 text-center text-white">
                  <Checkbox
                    checked={allPayableSelected}
                    aria-label="Sélectionner les bordereaux réglables de la page"
                    onCheckedChange={(checked) => setSelectedIds(checked
                      ? payableRows
                          .filter((row) => !selectedCompany || row.compagnieId === selectedCompany)
                          .map((row) => row.id)
                      : [])}
                  />
                </TableHead>
                <TableHead className="px-3 text-white">Bordereau</TableHead>
                <TableHead className="px-3 text-white">Compagnie</TableHead>
                <TableHead className="px-3 text-white">Base</TableHead>
                <TableHead className="px-3 text-white">Période</TableHead>
                <TableHead className="px-3 text-right text-white">Net compagnie</TableHead>
                <TableHead className="px-3 text-right text-white">Réglé</TableHead>
                <TableHead className="px-3 text-right text-white">Solde</TableHead>
                <TableHead className="px-3 text-center text-white">Bordereau</TableHead>
                <TableHead className="px-3 text-center text-white">Rapprochement</TableHead>
                <TableHead className="px-3 text-center text-white">Règlement</TableHead>
                <TableHead className="w-16 px-3 text-center text-white">Détail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const selectable = isPayable(row)
                  && (!selectedCompany || selectedCompany === row.compagnieId || selectedIds.includes(row.id));
                return (
                  <TableRow key={row.id}>
                    <TableCell className="px-4 py-3 text-center">
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        disabled={!selectable}
                        aria-label={`Sélectionner ${row.numero}`}
                        onCheckedChange={(checked) => toggleRow(row, Boolean(checked))}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-3 font-semibold">{row.numero}</TableCell>
                    <TableCell className="px-3 py-3">{row.compagnie}</TableCell>
                    <TableCell className="px-3 py-3">{baseLabel(row.baseBordereau)}</TableCell>
                    <TableCell className="px-3 py-3">
                      {date(row.periodeDebut)} au {date(row.periodeFin)}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-right font-medium">{money(row.netCompagnie)}</TableCell>
                    <TableCell className="px-3 py-3 text-right">{money(row.montantRegle)}</TableCell>
                    <TableCell className="px-3 py-3 text-right font-semibold">{money(row.soldeRestant)}</TableCell>
                    <TableCell className="px-3 py-3 text-center"><StatusBadge value={row.statut} /></TableCell>
                    <TableCell className="px-3 py-3 text-center"><StatusBadge value={row.statutRapprochement} /></TableCell>
                    <TableCell className="px-3 py-3 text-center"><StatusBadge value={row.statutReglement} /></TableCell>
                    <TableCell className="px-3 py-3 text-center">
                      <Button asChild size="icon" variant="ghost" title="Ouvrir le bordereau">
                        <Link to={`/app/compta/bordereaux-compagnies/${row.id}`}>
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!bordereaux.isLoading && rows.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="h-28 text-center text-muted-foreground">Aucun bordereau trouvé.</TableCell></TableRow>
              ) : null}
              {bordereaux.isLoading ? (
                <TableRow><TableCell colSpan={12} className="h-28 text-center text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : null}
            </TableBody>
        </Table>
        <ServerPagination
          className="border-t px-4 py-3"
          page={bordereaux.data?.page.number ?? page}
          totalPages={bordereaux.data?.page.totalPages ?? 1}
          totalElements={bordereaux.data?.page.totalElements ?? 0}
          loading={bordereaux.isFetching}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            setSelectedIds([]);
          }}
        />
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const label: Record<string, string> = {
    BROUILLON: "Brouillon",
    VALIDE: "Validé",
    TRANSMIS: "Transmis",
    ANNULE: "Annulé",
    A_RAPPROCHER: "À rapprocher",
    AVEC_ECART: "Avec écart",
    RAPPROCHE: "Rapproché",
    NON_REGLE: "Non réglé",
    EN_ATTENTE: "En attente",
    PARTIELLEMENT_REGLE: "Partiel",
    REGLE: "Réglé",
  };
  const variant = value === "ANNULE" || value === "AVEC_ECART"
    ? "destructive"
    : value === "TRANSMIS" || value === "RAPPROCHE" || value === "REGLE"
      ? "default"
      : "secondary";
  return <Badge variant={variant}>{label[value] ?? value}</Badge>;
}

function isPayable(row: CompanyBordereau) {
  return row.statut === "TRANSMIS" && row.soldeRestant > 0.004;
}

function baseLabel(value: CompanyBordereau["baseBordereau"]) {
  return value === "EMISSION" ? "Émissions" : "Encaissements confirmés";
}

function money(value?: number | null) {
  return formatAccountingAmount(value);
}

function date(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}
