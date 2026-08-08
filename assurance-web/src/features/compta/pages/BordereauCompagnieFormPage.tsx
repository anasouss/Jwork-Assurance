import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Search } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

      <section className="grid gap-4 rounded-md border bg-card p-4">
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
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          {base === "EMISSION"
            ? "Le bordereau reprend les écritures compagnie émises, indépendamment de leur encaissement client."
            : "Le bordereau reprend uniquement les écritures dont l’encaissement client est confirmé."}
        </div>
        <form className="flex gap-2" onSubmit={(event) => {
          event.preventDefault();
          setSubmittedSearch(search.trim());
        }}>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Police, dossier, mouvement ou N° quittance compagnie"
          />
          <Button type="submit" variant="outline"><Search className="size-4" />Filtrer</Button>
        </form>
      </section>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-3">
        <Summary label="Lignes sélectionnées" value={String(selectedRows.length)} />
        <Summary label="TTC compagnie" value={money(totals.ttc)} />
        <Summary label="Net compagnie" value={money(totals.net)} />
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Écritures disponibles</h2>
          <p className="text-xs text-muted-foreground">
            Une écriture ne peut appartenir qu’à un seul bordereau actif.
          </p>
        </div>
        <Table className="min-w-[1080px]">
          <TableHeader className="bg-muted/35 text-xs uppercase">
            <TableRow>
              <TableHead className="w-12 px-4 text-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => setSelectedIds(checked ? rows.map((row) => row.id) : [])}
                />
              </TableHead>
              <TableHead>Mouvement</TableHead>
              <TableHead>Police</TableHead>
              <TableHead>N° quittance</TableHead>
              <TableHead>Date d’effet</TableHead>
              <TableHead className="text-right">Prime nette</TableHead>
              <TableHead className="text-right">Taxes</TableHead>
              <TableHead className="text-right">TTC</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Retenue</TableHead>
              <TableHead className="text-right">Net compagnie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-state={selectedIds.includes(row.id) ? "selected" : undefined}>
                <TableCell className="px-4 text-center">
                  <Checkbox
                    checked={selectedIds.includes(row.id)}
                    onCheckedChange={(checked) => setSelectedIds((current) => checked
                      ? [...new Set([...current, row.id])]
                      : current.filter((id) => id !== row.id))}
                  />
                </TableCell>
                <TableCell className="font-medium">{row.mouvement || "-"}</TableCell>
                <TableCell>{row.numeroPolice || "-"}</TableCell>
                <TableCell>{row.numeroQuittanceCompagnie || "-"}</TableCell>
                <TableCell>{date(row.dateEffet)}</TableCell>
                <TableCell className="text-right">{money(row.primeNette)}</TableCell>
                <TableCell className="text-right">{money(row.montantTaxes)}</TableCell>
                <TableCell className="text-right font-semibold">{money(row.montantTtc)}</TableCell>
                <TableCell className="text-right">{money(row.commissionNette)}</TableCell>
                <TableCell className="text-right">{money(row.montantRetenue)}</TableCell>
                <TableCell className="text-right font-semibold">{money(row.netCompagnie)}</TableCell>
              </TableRow>
            ))}
            {!sources.isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-28 text-center text-muted-foreground">
                  {compagnieId ? "Aucune écriture disponible pour ces critères." : "Choisissez une compagnie."}
                </TableCell>
              </TableRow>
            ) : null}
            {sources.isLoading ? (
              <TableRow><TableCell colSpan={11} className="h-28 text-center text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>

      <section className="grid gap-4 rounded-md border bg-card p-4">
        <Field label="Notes internes">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </Field>
        <div className="flex justify-end border-t pt-4">
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
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
