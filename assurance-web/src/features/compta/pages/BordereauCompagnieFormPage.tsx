import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  FileCheck2,
  ListChecks,
  Save,
  Search,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import type {
  CompanyBordereauBase,
  CompanyBordereauSource,
  UpsertCompanyBordereauRequest,
} from "../types";

const currentMonth = monthRange(new Date());

export default function BordereauCompagnieFormPage() {
  const { bordereauId } = useParams();
  const editing = Boolean(bordereauId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialized = useRef(false);
  const [compagnieId, setCompagnieId] = useState("");
  const [base, setBase] = useState<CompanyBordereauBase>("EMISSION");
  const [dateDu, setDateDu] = useState(currentMonth.start);
  const [dateAu, setDateAu] = useState(currentMonth.end);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const detail = useQuery({
    queryKey: ["compta", "company-bordereau", bordereauId],
    queryFn: () => comptaApi.companyBordereau(bordereauId!),
    enabled: editing,
  });
  const companies = useQuery({
    queryKey: ["compta", "companies"],
    queryFn: comptaApi.companies,
  });

  useEffect(() => {
    if (!detail.data || initialized.current) return;
    initialized.current = true;
    setCompagnieId(detail.data.compagnieId);
    setBase(detail.data.baseBordereau);
    setDateDu(detail.data.periodeDebut);
    setDateAu(detail.data.periodeFin);
    setNotes(detail.data.notes ?? "");
    setSelectedIds(detail.data.lignes.map((line) => line.affectationId));
  }, [detail.data]);

  const sources = useQuery({
    queryKey: [
      "compta",
      "company-bordereau-sources",
      compagnieId,
      base,
      dateDu,
      dateAu,
      submittedSearch,
    ],
    queryFn: () => comptaApi.companyBordereauSources({
      compagnieId,
      base,
      dateDu,
      dateAu,
      search: submittedSearch || undefined,
    }),
    enabled: Boolean(compagnieId && dateDu && dateAu),
  });

  const existingSources = useMemo(
    () => (detail.data?.lignes ?? []).map((line): CompanyBordereauSource => ({
      id: line.affectationId,
      compagnieId: detail.data!.compagnieId,
      compagnie: detail.data!.compagnie,
      quittanceId: "",
      numeroQuittanceCompagnie: line.numeroQuittanceCompagnie,
      numeroPolice: line.numeroPolice,
      numeroDossier: line.numeroDossier,
      mouvement: line.mouvement,
      dateEffet: line.dateEffet,
      dateEcheance: line.dateEcheance,
      primeNette: line.primeNette,
      montantTaxes: line.montantTaxes,
      accessoires: line.accessoires,
      montantTtc: line.montantTtc,
      commissionNette: line.commissionNette,
      montantRetenue: line.montantRetenue,
      netCompagnie: line.netCompagnie,
      encaissementConfirme: detail.data!.baseBordereau === "ENCAISSEMENT",
    })),
    [detail.data]
  );
  const rows = useMemo(() => {
    const byId = new Map<string, CompanyBordereauSource>();
    existingSources.forEach((row) => byId.set(row.id, row));
    (sources.data ?? []).forEach((row) => byId.set(row.id, row));
    return Array.from(byId.values()).sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
  }, [existingSources, sources.data]);
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const totals = selectedRows.reduce((sum, row) => ({
    primeNette: sum.primeNette + row.primeNette,
    taxes: sum.taxes + row.montantTaxes,
    ttc: sum.ttc + row.montantTtc,
    commission: sum.commission + row.commissionNette,
    retenue: sum.retenue + row.montantRetenue,
    net: sum.net + row.netCompagnie,
  }), { primeNette: 0, taxes: 0, ttc: 0, commission: 0, retenue: 0, net: 0 });

  const save = useMutation({
    mutationFn: () => {
      const request = {
        compagnieId: editing ? undefined : compagnieId,
        baseBordereau: editing ? undefined : base,
        periodeDebut: dateDu,
        periodeFin: dateAu,
        notes: notes.trim() || undefined,
        affectationIds: selectedIds,
      } satisfies UpsertCompanyBordereauRequest;
      return editing
        ? comptaApi.updateCompanyBordereau(bordereauId!, request)
        : comptaApi.createCompanyBordereau(request);
    },
    onSuccess: async (saved) => {
      toast.success(editing ? "Bordereau modifié" : "Bordereau créé en brouillon");
      await queryClient.invalidateQueries({ queryKey: ["compta", "company-bordereaux"] });
      navigate(`/app/compta/bordereaux-compagnies/${saved.id}`, { replace: true });
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Enregistrement impossible"
    ),
  });

  const canSave = Boolean(compagnieId)
    && Boolean(dateDu)
    && Boolean(dateAu)
    && dateDu <= dateAu
    && selectedIds.length > 0
    && (!editing || detail.data?.statut === "BROUILLON");

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Compagnie</div>
          <h1 className="mt-1 text-xl font-semibold">
            {editing ? `Modifier ${detail.data?.numero ?? "le bordereau"}` : "Nouveau bordereau compagnie"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Sélectionnez les écritures compagnie à déclarer pour une période donnée.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={editing
            ? `/app/compta/bordereaux-compagnies/${bordereauId}`
            : "/app/compta/bordereaux-compagnies"}>
            <ArrowLeft className="size-4" />Retour
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 rounded-md border border-l-4 border-l-orange-500 bg-card p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Compagnie">
            <Select
              value={compagnieId}
              disabled={editing}
              onValueChange={(value) => {
                setCompagnieId(value);
                setSelectedIds([]);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Choisir une compagnie" /></SelectTrigger>
              <SelectContent>
                {(companies.data ?? []).map((company) => (
                  <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Base du bordereau">
            <div className="grid grid-cols-2 rounded-md border bg-muted/25 p-1">
              <ModeButton
                active={base === "EMISSION"}
                disabled={editing}
                onClick={() => {
                  setBase("EMISSION");
                  setSelectedIds([]);
                }}
              >Émissions</ModeButton>
              <ModeButton
                active={base === "ENCAISSEMENT"}
                disabled={editing}
                onClick={() => {
                  setBase("ENCAISSEMENT");
                  setSelectedIds([]);
                }}
              >Encaissements</ModeButton>
            </div>
          </Field>
          <Field label="Période du">
            <DatePicker date={dateDu} onSelect={(value) => setDateDu(toDateOnly(value) ?? "")} />
          </Field>
          <Field label="Période au">
            <DatePicker date={dateAu} onSelect={(value) => setDateAu(toDateOnly(value) ?? "")} />
          </Field>
        </div>
        <div className="flex items-start gap-3 border-y bg-muted/20 px-3 py-2.5 text-sm">
          <FileCheck2 className="mt-0.5 size-4 shrink-0 text-orange-600" />
          <div>
            <div className="font-medium text-foreground">
              {base === "EMISSION" ? "Déclaration des émissions" : "Déclaration des encaissements"}
            </div>
            <div className="text-muted-foreground">
              {base === "EMISSION"
                ? "Toutes les écritures compagnie émises sur la période sont proposées, quel que soit leur état d’encaissement client."
                : "Seules les écritures dont l’encaissement client est intégralement confirmé sont proposées."}
            </div>
          </div>
        </div>
        <form className="grid gap-2" onSubmit={(event) => {
          event.preventDefault();
          setSubmittedSearch(search.trim());
        }}>
          <Label htmlFor="bordereau-source-search">Rechercher une écriture</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="bordereau-source-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Police, dossier, mouvement ou N° quittance compagnie"
            />
            <Button type="submit" variant="outline">
              <Search className="size-4" />
              Filtrer
            </Button>
          </div>
        </form>
      </section>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <Summary icon={<ListChecks className="size-4" />} label="Lignes sélectionnées" value={String(selectedRows.length)} />
        <Summary label="TTC sélectionné" value={money(totals.ttc)} />
        <Summary label="Net compagnie" value={money(totals.net)} emphasized />
        <div className="flex min-w-56 items-center justify-end gap-2 border-t p-4 sm:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">
          {selectedRows.length > 0 ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              <X className="size-4" />Effacer
            </Button>
          ) : null}
          <Button disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
            <Save className="size-4" />
            {editing ? "Enregistrer" : "Créer le brouillon"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Écritures disponibles</h2>
            <p className="text-xs text-muted-foreground">
              Une écriture ne peut appartenir qu’à un seul bordereau actif.
            </p>
          </div>
          <Badge variant="secondary">{rows.length} écriture(s)</Badge>
        </div>
        <div className="max-h-[560px] overflow-auto [&>[data-slot=table-container]]:overflow-visible">
          <Table className="min-w-[1180px]">
            <TableHeader className="sticky top-0 z-10 bg-orange-600 text-xs uppercase text-white shadow-sm">
              <TableRow className="hover:bg-orange-600">
                <TableHead className="w-12 bg-orange-600 px-4 text-center text-white">
                  <Checkbox
                    checked={allSelected}
                    aria-label="Sélectionner toutes les écritures disponibles"
                    onCheckedChange={(checked) => setSelectedIds(checked
                      ? rows.map((row) => row.id)
                      : [])}
                  />
                </TableHead>
                <TableHead className="bg-orange-600 text-white">Mouvement</TableHead>
                <TableHead className="bg-orange-600 text-white">Police</TableHead>
                <TableHead className="bg-orange-600 text-white">N° quittance</TableHead>
                <TableHead className="bg-orange-600 text-white">Date d’effet</TableHead>
                <TableHead className="bg-orange-600 text-right text-white">Prime nette</TableHead>
                <TableHead className="bg-orange-600 text-right text-white">Taxes</TableHead>
                <TableHead className="bg-orange-600 text-right text-white">TTC</TableHead>
                <TableHead className="bg-orange-600 text-right text-white">Commission</TableHead>
                <TableHead className="bg-orange-600 text-right text-white">Retenue</TableHead>
                <TableHead className="bg-orange-600 text-right text-white">Net compagnie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const selected = selectedIds.includes(row.id);
                return (
                  <TableRow
                    key={row.id}
                    data-state={selected ? "selected" : undefined}
                    className="data-[state=selected]:bg-orange-50/80 dark:data-[state=selected]:bg-orange-950/25"
                  >
                    <TableCell className="px-4 text-center">
                      <Checkbox
                        checked={selected}
                        aria-label={`Sélectionner la quittance ${row.numeroQuittanceCompagnie || row.id}`}
                        onCheckedChange={(checked) => setSelectedIds((current) => checked
                          ? [...new Set([...current, row.id])]
                          : current.filter((id) => id !== row.id))}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.mouvement || "-"}</div>
                      {row.numeroDossier ? (
                        <div className="text-xs text-muted-foreground">{row.numeroDossier}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">{row.numeroPolice || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.numeroQuittanceCompagnie || "-"}</TableCell>
                    <TableCell>{date(row.dateEffet)}</TableCell>
                    <TableCell className="text-right">{money(row.primeNette)}</TableCell>
                    <TableCell className="text-right">{money(row.montantTaxes)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(row.montantTtc)}</TableCell>
                    <TableCell className="text-right">{money(row.commissionNette)}</TableCell>
                    <TableCell className="text-right">{money(row.montantRetenue)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(row.netCompagnie)}</TableCell>
                  </TableRow>
                );
              })}
              {!sources.isLoading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-28 text-center text-muted-foreground">
                    {compagnieId
                      ? "Aucune écriture disponible pour ces critères."
                      : "Choisissez une compagnie."}
                  </TableCell>
                </TableRow>
              ) : null}
              {sources.isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-28 text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            {selectedRows.length > 0 ? (
              <TableFooter className="sticky bottom-0 z-10 bg-background shadow-[0_-1px_0_hsl(var(--border))]">
                <TableRow className="hover:bg-background">
                  <TableCell />
                  <TableCell colSpan={4} className="font-semibold">
                    Total de la sélection · {selectedRows.length} ligne(s)
                  </TableCell>
                  <TableCell className="text-right font-semibold">{money(totals.primeNette)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(totals.taxes)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(totals.ttc)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(totals.commission)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(totals.retenue)}</TableCell>
                  <TableCell className="text-right font-bold">{money(totals.net)}</TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      </section>

      <section className="grid gap-4 border-t pt-5">
        <Field label="Notes internes">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Informations internes facultatives sur ce bordereau"
          />
        </Field>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="size-4" />
            {selectedRows.length > 0
              ? `${selectedRows.length} écriture(s) seront figées dans le brouillon.`
              : "Sélectionnez au moins une écriture pour continuer."}
          </div>
          <Button disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
            <Save className="size-4" />
            {editing ? "Enregistrer les modifications" : "Créer le brouillon"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}

function ModeButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={active
        ? "h-9 rounded-sm bg-background px-3 text-sm font-semibold shadow-sm"
        : "h-9 rounded-sm px-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Summary({
  icon,
  label,
  value,
  emphasized = false,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">{icon}{label}</div>
      <div className={emphasized ? "mt-1 text-xl font-bold" : "mt-1 text-lg font-semibold"}>{value}</div>
    </div>
  );
}

function monthRange(value: Date) {
  const year = value.getFullYear();
  const month = value.getMonth();
  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function money(value?: number | null) {
  return formatAccountingAmount(value);
}

function date(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}
