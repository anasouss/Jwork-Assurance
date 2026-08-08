import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarClock,
  Landmark,
  Plus,
  ReceiptText,
  Scale,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import { formatAccountingAmount, parseAccountingAmount } from "../format";
import type {
  CompanyBordereau,
  CompanyPaymentMode,
  CreateCompanyPaymentRequest,
} from "../types";

const today = new Date().toISOString().slice(0, 10);

type PaymentMethodDraft = {
  key: string;
  mode: CompanyPaymentMode;
  amount: string;
  instrumentDate: string;
  dueDate: string;
  reference: string;
  beneficiaryBank: string;
  accountId: string;
};

const paymentModes: Array<{
  value: CompanyPaymentMode;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "VIREMENT", label: "Virement", icon: ArrowLeftRight },
  { value: "CHEQUE", label: "Chèque", icon: ReceiptText },
  { value: "EFFET", label: "Effet", icon: CalendarClock },
  { value: "COMPENSATION", label: "Compensation", icon: Scale },
];

export default function NouveauReglementCompagniePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialized = useRef(false);
  const bordereauIds = useMemo(
    () => [...new Set((searchParams.get("bordereauIds") ?? "").split(",").filter(Boolean))],
    [searchParams]
  );
  const queries = useQueries({
    queries: bordereauIds.map((id) => ({
      queryKey: ["compta", "company-bordereau", id],
      queryFn: () => comptaApi.companyBordereau(id),
    })),
  });
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const [dateReglement, setDateReglement] = useState(today);
  const [notes, setNotes] = useState("");
  const [methods, setMethods] = useState<PaymentMethodDraft[]>([newMethod()]);

  const bordereaux = queries.flatMap((query) => query.data ? [query.data] : []);
  const loading = queries.some((query) => query.isLoading);
  const error = queries.find((query) => query.isError)?.error;
  const totalDue = bordereaux.reduce((sum, row) => sum + row.soldeRestant, 0);
  const paymentTotal = methods.reduce((sum, method) => sum + amount(method.amount), 0);
  const remaining = round(totalDue - paymentTotal);
  const companyIds = new Set(bordereaux.map((row) => row.compagnieId));
  const validSelection = bordereaux.length === bordereauIds.length
    && companyIds.size === 1
    && bordereaux.every((row) => row.statut === "TRANSMIS" && row.soldeRestant > 0.004);
  const bankAccounts = (accounts.data ?? []).filter(
    (account) => account.actif && account.typeCompte === "BANQUE"
  );

  useEffect(() => {
    if (initialized.current || !validSelection || totalDue <= 0) return;
    initialized.current = true;
    setMethods((current) => current.map((method, index) => index === 0
      ? { ...method, amount: inputMoney(totalDue) }
      : method));
  }, [totalDue, validSelection]);

  const create = useMutation({
    mutationFn: () => comptaApi.createCompanyPayment(buildRequest(
      bordereaux,
      methods,
      dateReglement,
      notes
    )),
    onSuccess: async (payment) => {
      toast.success(`Règlement ${payment.numero} enregistré`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "company-bordereau"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "company-bordereaux"] }),
      ]);
      navigate(`/app/compta/bordereaux-compagnies/${bordereaux[0].id}`, { replace: true });
    },
    onError: (mutationError) => toast.error(
      mutationError instanceof Error ? mutationError.message : "Règlement impossible"
    ),
  });

  const canSubmit = validSelection
    && Boolean(dateReglement)
    && paymentTotal > 0
    && paymentTotal <= totalDue + 0.004
    && methods.every((method) => methodValid(method, bankAccounts.map((account) => account.id)));

  function updateMethod(key: string, patch: Partial<PaymentMethodDraft>) {
    setMethods((current) => current.map((method) => method.key === key
      ? { ...method, ...patch }
      : method));
  }

  if (bordereauIds.length === 0) {
    return <InvalidSelection message="Aucun bordereau n’a été sélectionné." />;
  }
  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;
  }
  if (error || !validSelection) {
    return <InvalidSelection message={error instanceof Error
      ? error.message
      : "Sélectionnez des bordereaux transmis, avec un solde ouvert, appartenant à la même compagnie."} />;
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Compagnie</div>
          <h1 className="mt-1 text-xl font-semibold">Enregistrer un règlement compagnie</h1>
          <p className="text-sm text-muted-foreground">
            {bordereaux[0].compagnie} · {bordereaux.length} bordereau(x) sélectionné(s)
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/compta/bordereaux-compagnies"><ArrowLeft className="size-4" />Retour aux bordereaux</Link>
        </Button>
      </header>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-4">
        <Summary label="Bordereaux" value={String(bordereaux.length)} />
        <Summary label="Solde sélectionné" value={money(totalDue)} />
        <Summary label="Montant du règlement" value={money(paymentTotal)} />
        <Summary label="Solde après règlement" value={money(Math.max(0, remaining))} />
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Bordereaux à régler</h2></div>
        <Table>
          <TableHeader className="bg-muted/35 text-xs uppercase">
            <TableRow>
              <TableHead>N° bordereau</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Période</TableHead>
              <TableHead className="text-right">Net compagnie</TableHead>
              <TableHead className="text-right">Déjà réglé</TableHead>
              <TableHead className="text-right">Solde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bordereaux.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-semibold">{row.numero}</TableCell>
                <TableCell>{row.baseBordereau === "EMISSION" ? "Émissions" : "Encaissements"}</TableCell>
                <TableCell>{date(row.periodeDebut)} au {date(row.periodeFin)}</TableCell>
                <TableCell className="text-right">{money(row.netCompagnie)}</TableCell>
                <TableCell className="text-right">{money(row.montantRegle)}</TableCell>
                <TableCell className="text-right font-semibold">{money(row.soldeRestant)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="grid gap-4 rounded-md border bg-card p-4">
        <div className="grid max-w-64 gap-2">
          <Label>Date du règlement</Label>
          <DatePicker date={dateReglement} onSelect={(value) => setDateReglement(toDateOnly(value) ?? "")} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            <h2 className="font-semibold">Moyens de règlement</h2>
            <p className="text-xs text-muted-foreground">
              Les moyens bancaires restent en attente jusqu’à confirmation de la sortie.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setMethods((current) => [...current, newMethod()])}>
            <Plus className="size-4" />Ajouter un moyen
          </Button>
        </div>

        {methods.map((method, index) => (
          <section key={method.key} className="grid gap-4 rounded-md border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Moyen {index + 1}</h3>
              {methods.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Supprimer ce moyen"
                  onClick={() => setMethods((current) => current.filter((row) => row.key !== method.key))}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {paymentModes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={method.mode === value
                    ? "flex h-11 items-center justify-center gap-2 rounded-md border border-orange-500 bg-orange-50 px-3 text-sm font-semibold text-orange-900 dark:bg-orange-950/30 dark:text-orange-100"
                    : "flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"}
                  onClick={() => updateMethod(method.key, {
                    mode: value,
                    dueDate: "",
                    reference: "",
                    beneficiaryBank: "",
                    accountId: "",
                  })}
                >
                  <Icon className="size-4" />{label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Montant">
                <Input inputMode="decimal" value={method.amount} onChange={(event) => updateMethod(method.key, { amount: event.target.value })} />
              </Field>
              <Field label="Date du moyen">
                <DatePicker date={method.instrumentDate} onSelect={(value) => updateMethod(method.key, { instrumentDate: toDateOnly(value) ?? "" })} />
              </Field>
              {method.mode === "EFFET" ? (
                <Field label="Échéance de l’effet">
                  <DatePicker date={method.dueDate} onSelect={(value) => updateMethod(method.key, { dueDate: toDateOnly(value) ?? "" })} />
                </Field>
              ) : null}
              {method.mode !== "COMPENSATION" ? (
                <Field label="Référence">
                  <Input value={method.reference} onChange={(event) => updateMethod(method.key, { reference: event.target.value })} />
                </Field>
              ) : null}
              {method.mode !== "COMPENSATION" ? (
                <Field label="Compte bancaire prévu">
                  <Select value={method.accountId} onValueChange={(value) => updateMethod(method.key, { accountId: value })}>
                    <SelectTrigger><SelectValue placeholder="À confirmer plus tard" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              {method.mode !== "COMPENSATION" ? (
                <Field label="Banque bénéficiaire">
                  <Input value={method.beneficiaryBank} onChange={(event) => updateMethod(method.key, { beneficiaryBank: event.target.value })} />
                </Field>
              ) : null}
            </div>
          </section>
        ))}

        <Field label="Notes internes">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className={remaining < -0.004 ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}>
            {remaining < -0.004
              ? `Le règlement dépasse le solde de ${money(Math.abs(remaining))}.`
              : remaining > 0.004
                ? `Règlement partiel · ${money(remaining)} restera à régler.`
                : "Le règlement couvre la sélection."}
          </p>
          <Button disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
            <Landmark className="size-4" />Enregistrer le règlement
          </Button>
        </div>
      </section>
    </div>
  );
}

function buildRequest(
  bordereaux: CompanyBordereau[],
  methods: PaymentMethodDraft[],
  paymentDate: string,
  notes: string
): CreateCompanyPaymentRequest {
  const remainingByBordereau = new Map(
    bordereaux.map((row) => [row.id, round(row.soldeRestant)])
  );
  return {
    compagnieId: bordereaux[0].compagnieId,
    dateReglement: paymentDate,
    notes: notes.trim() || undefined,
    instruments: methods.map((method) => {
      let amountToAllocate = round(amount(method.amount));
      const allocations: Array<{ bordereauId: string; montant: number }> = [];
      for (const bordereau of bordereaux) {
        if (amountToAllocate <= 0) break;
        const available = remainingByBordereau.get(bordereau.id) ?? 0;
        if (available <= 0) continue;
        const allocated = round(Math.min(available, amountToAllocate));
        allocations.push({ bordereauId: bordereau.id, montant: allocated });
        remainingByBordereau.set(bordereau.id, round(available - allocated));
        amountToAllocate = round(amountToAllocate - allocated);
      }
      return {
        mode: method.mode,
        montant: amount(method.amount),
        dateInstrument: method.instrumentDate,
        dateEcheance: method.dueDate || undefined,
        referenceInstrument: method.reference.trim() || undefined,
        banqueBeneficiaire: method.beneficiaryBank.trim() || undefined,
        compteTresorerieId: method.accountId || undefined,
        affectations: allocations,
      };
    }),
  };
}

function newMethod(): PaymentMethodDraft {
  return {
    key: crypto.randomUUID(),
    mode: "VIREMENT",
    amount: "",
    instrumentDate: today,
    dueDate: "",
    reference: "",
    beneficiaryBank: "",
    accountId: "",
  };
}

function methodValid(method: PaymentMethodDraft, bankAccountIds: string[]) {
  if (amount(method.amount) <= 0 || !method.instrumentDate) return false;
  if (method.mode === "COMPENSATION") return true;
  if (!method.reference.trim()) return false;
  if (method.mode === "EFFET" && !method.dueDate) return false;
  return !method.accountId || bankAccountIds.includes(method.accountId);
}

function InvalidSelection({ message }: { message: string }) {
  return (
    <div className="grid gap-4 rounded-md border border-dashed p-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="mx-auto">
        <Link to="/app/compta/bordereaux-compagnies"><ArrowLeft className="size-4" />Retour aux bordereaux</Link>
      </Button>
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

function money(value?: number | null) {
  return formatAccountingAmount(value);
}

function inputMoney(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function amount(value: string) {
  return parseAccountingAmount(value);
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function date(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}
