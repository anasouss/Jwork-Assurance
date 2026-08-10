import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CalendarClock,
  CreditCard,
  Landmark,
  Plus,
  ReceiptText,
  Repeat2,
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
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import {
  requiresBankAccountAtEntry,
  requiresPaymentReference,
  showsOriginatingBank,
} from "../client-payment-methods";
import { formatAccountingAmount, parseAccountingAmount } from "../format";
import type {
  ClientPaymentMode,
  ClientReceivable,
  CreateClientPaymentRequest,
  TreasuryAccount,
} from "../types";

const today = new Date().toISOString().slice(0, 10);

type PaymentMethodDraft = {
  key: string;
  mode: ClientPaymentMode;
  montant: string;
  dateInstrument: string;
  dateEcheance: string;
  referenceInstrument: string;
  banqueEmettrice: string;
  compteTresorerieId: string;
};

const paymentModes: Array<{
  value: ClientPaymentMode;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "ESPECES", label: "Espèces", icon: Banknote },
  { value: "CHEQUE", label: "Chèque", icon: ReceiptText },
  { value: "EFFET", label: "Effet", icon: CalendarClock },
  { value: "VIREMENT", label: "Virement", icon: ArrowLeftRight },
  { value: "VERSEMENT_BANCAIRE", label: "Versement", icon: Landmark },
  { value: "CARTE", label: "Carte", icon: CreditCard },
  { value: "PRELEVEMENT", label: "Prélèvement", icon: Repeat2 },
];

export default function NouveauReglementClientPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreate = permissions.includes("reglement-client:create")
    || permissions.includes("reglement-client:manage");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selection = selectionFromParams(searchParams);
  const hasSelection = selection.elementFacturableIds.length > 0
    || selection.documentClientIds.length > 0;
  const [dateReglement, setDateReglement] = useState(today);
  const [notes, setNotes] = useState("");
  const [methods, setMethods] = useState<PaymentMethodDraft[]>([newPaymentMethod()]);
  const initializedAmount = useRef(false);

  const receivables = useQuery({
    queryKey: ["compta", "client-receivable-selection", selection],
    queryFn: () => comptaApi.selectedClientReceivables(selection),
    enabled: hasSelection,
    staleTime: 0,
  });
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });

  const rows = receivables.data ?? [];
  const selectedTotal = rows.reduce((sum, row) => sum + row.soldeOuvert, 0);
  const paymentTotal = methods.reduce((sum, method) => sum + numeric(method.montant), 0);
  const remainingAmount = round(selectedTotal - paymentTotal);
  const activeCashAccounts = (accounts.data ?? []).filter(
    (account) => account.actif && account.typeCompte === "CAISSE"
  );
  const activeBankAccounts = (accounts.data ?? []).filter(
    (account) => account.actif && account.typeCompte === "BANQUE"
  );

  useEffect(() => {
    if (initializedAmount.current || selectedTotal <= 0) return;
    initializedAmount.current = true;
    setMethods((current) => current.map((method, index) => index === 0
      ? { ...method, montant: money(selectedTotal) }
      : method));
  }, [selectedTotal]);

  const createPayment = useMutation({
    mutationFn: () => comptaApi.createClientPayment(buildRequest(
      rows,
      methods,
      dateReglement,
      notes
    )),
    onSuccess: async (payment) => {
      toast.success(`Règlement ${payment.numero} enregistré`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
      ]);
      navigate("/app/compta/reglements/historique", { replace: true });
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Règlement impossible"
    ),
  });

  const canSubmit = canCreate
    && Boolean(dateReglement)
    && rows.length > 0
    && paymentTotal > 0
    && paymentTotal <= selectedTotal + 0.001
    && methods.every((method) => methodValid(method, accounts.data ?? []));

  function updateMethod(key: string, patch: Partial<PaymentMethodDraft>) {
    setMethods((current) => current.map((method) => method.key === key
      ? { ...method, ...patch }
      : method));
  }

  function changeMethod(method: PaymentMethodDraft, mode: ClientPaymentMode) {
    if (method.mode === mode) return;
    updateMethod(method.key, {
      mode,
      compteTresorerieId: "",
      dateEcheance: "",
      referenceInstrument: "",
      banqueEmettrice: "",
    });
  }

  if (!hasSelection) {
    return <InvalidSelection message="Aucun élément à encaisser n’a été sélectionné." />;
  }
  if (receivables.isError) {
    return <InvalidSelection message={receivables.error instanceof Error
      ? receivables.error.message
      : "La sélection ne peut pas être chargée."} />;
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">
            Comptabilité
          </div>
          <h1 className="mt-1 text-xl font-semibold">Enregistrer un règlement</h1>
          <p className="text-sm text-muted-foreground">
            {receivables.isLoading
              ? "Chargement de la sélection..."
              : `${rows[0]?.source.payeurNom ?? "Payeur"} · ${itemCount(rows.length)}`}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/compta/reglements">
            <ArrowLeft className="size-4" />
            Retour aux montants à encaisser
          </Link>
        </Button>
      </header>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-4">
        <SummaryCell label="Éléments" value={String(rows.length)} />
        <SummaryCell label="Total sélectionné" value={money(selectedTotal)} />
        <SummaryCell label="Montant du règlement" value={money(paymentTotal)} />
        <SummaryCell
          label={remainingAmount >= 0 ? "Solde restant" : "Dépassement"}
          value={money(Math.abs(remainingAmount))}
          tone={remainingAmount < 0 ? "danger" : "default"}
        />
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Éléments sélectionnés</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/35 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Police</th>
                <th className="px-4 py-3 text-left">Nature</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Solde ouvert</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={receivableTargetKey(row)}>
                  <td className="px-4 py-3 font-medium">{row.source.police || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.source.mouvement}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.source.reference || row.source.nature || "-"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{date(row.source.dateEffet)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {money(row.soldeOuvert)}
                  </td>
                </tr>
              ))}
              {receivables.isLoading ? (
                <tr>
                  <td colSpan={4} className="h-24 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 rounded-md border bg-card p-4">
        <div className="grid max-w-64 gap-2">
          <Label>Date du règlement</Label>
          <DatePicker
            date={dateReglement}
            onSelect={(value) => setDateReglement(toDateOnly(value) ?? "")}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <h2 className="font-semibold">Moyens de règlement</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMethods((current) => [...current, newPaymentMethod()])}
          >
            <Plus className="size-4" />
            Ajouter un moyen
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
                  onClick={() => setMethods((current) => current.filter(
                    (item) => item.key !== method.key
                  ))}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              {paymentModes.map(({ value, label, icon: Icon }) => {
                const active = method.mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    className={active
                      ? "flex h-16 items-center justify-center gap-2 rounded-md border border-amber-500 bg-amber-50 px-3 text-sm font-medium text-amber-950 ring-1 ring-amber-300 dark:bg-amber-950/30 dark:text-amber-100"
                      : "flex h-16 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"}
                    onClick={() => changeMethod(method, value)}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Montant</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 py-0 text-xs"
                    onClick={() => {
                      const otherTotal = methods.reduce(
                        (sum, item) => item.key === method.key
                          ? sum
                          : sum + numeric(item.montant),
                        0
                      );
                      updateMethod(method.key, {
                        montant: money(round(Math.max(0, selectedTotal - otherTotal))),
                      });
                    }}
                  >
                    Affecter le solde
                  </Button>
                </div>
                <Input
                  inputMode="decimal"
                  value={method.montant}
                  onChange={(event) => updateMethod(
                    method.key,
                    { montant: event.target.value }
                  )}
                />
              </div>
              <div className="grid gap-2">
                <Label>Date du moyen de paiement</Label>
                <DatePicker
                  date={method.dateInstrument}
                  onSelect={(value) => updateMethod(method.key, {
                    dateInstrument: toDateOnly(value) ?? "",
                  })}
                />
              </div>
              {method.mode === "EFFET" ? (
                <div className="grid gap-2">
                  <Label>Date d’échéance</Label>
                  <DatePicker
                    date={method.dateEcheance}
                    onSelect={(value) => updateMethod(method.key, {
                      dateEcheance: toDateOnly(value) ?? "",
                    })}
                  />
                </div>
              ) : null}
              {method.mode === "ESPECES" ? (
                <AccountSelect
                  accounts={accounts.data ?? []}
                  type="CAISSE"
                  label="Caisse créditée"
                  value={method.compteTresorerieId}
                  onChange={(value) => updateMethod(
                    method.key,
                    { compteTresorerieId: value }
                  )}
                />
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label>Référence</Label>
                    <Input
                      value={method.referenceInstrument}
                      onChange={(event) => updateMethod(
                        method.key,
                        { referenceInstrument: event.target.value }
                      )}
                    />
                  </div>
                  {requiresBankAccountAtEntry(method.mode) ? (
                    <AccountSelect
                      accounts={accounts.data ?? []}
                      type="BANQUE"
                      label="Compte bancaire crédité"
                      value={method.compteTresorerieId}
                      onChange={(value) => updateMethod(
                        method.key,
                        { compteTresorerieId: value }
                      )}
                    />
                  ) : null}
                  {showsOriginatingBank(method.mode) ? (
                    <div className="grid gap-2">
                      <Label>
                        {method.mode === "CHEQUE" || method.mode === "EFFET"
                          ? "Banque émettrice"
                          : "Banque d’origine"}
                      </Label>
                      <Input
                        value={method.banqueEmettrice}
                        onChange={(event) => updateMethod(
                          method.key,
                          { banqueEmettrice: event.target.value }
                        )}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {method.mode === "ESPECES"
              && !accounts.isLoading
              && activeCashAccounts.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="size-4 shrink-0" />
                Aucune caisse active n’est disponible.
              </div>
            ) : null}
            {requiresBankAccountAtEntry(method.mode)
              && !accounts.isLoading
              && activeBankAccounts.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="size-4 shrink-0" />
                Aucun compte bancaire actif n’est disponible.
              </div>
            ) : null}
          </section>
        ))}

        <div className="grid gap-2 border-t pt-4">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-24"
          />
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t py-4">
        <div className="text-sm text-muted-foreground">
          {remainingAmount > 0.001
            ? `Paiement partiel · reste ${money(remainingAmount)}`
            : remainingAmount < -0.001
              ? `Le montant dépasse le solde de ${money(Math.abs(remainingAmount))}`
              : "Le règlement couvre la sélection"}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/app/compta/reglements">Annuler</Link>
          </Button>
          <Button
            disabled={!canSubmit || createPayment.isPending}
            onClick={() => createPayment.mutate()}
          >
            <Banknote className="size-4" />
            Enregistrer le règlement
          </Button>
        </div>
      </footer>
    </div>
  );
}

function InvalidSelection({ message }: { message: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="grid max-w-lg justify-items-center gap-4 text-center">
        <AlertCircle className="size-8 text-amber-600" />
        <div>
          <h1 className="text-lg font-semibold">Règlement indisponible</h1>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <Button asChild>
          <Link to="/app/compta/reglements">Retour aux montants à encaisser</Link>
        </Button>
      </div>
    </div>
  );
}

function AccountSelect(props: {
  accounts: TreasuryAccount[];
  type: TreasuryAccount["typeCompte"];
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = props.accounts.filter(
    (account) => account.actif && account.typeCompte === props.type
  );
  return (
    <div className="grid gap-2">
      <Label>{props.label}</Label>
      <Select
        value={props.value}
        onValueChange={props.onChange}
        disabled={options.length === 0}
      >
        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
        <SelectContent>
          {options.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryCell(props: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs uppercase text-muted-foreground">{props.label}</div>
      <div className={props.tone === "danger"
        ? "mt-1 font-semibold text-red-600"
        : "mt-1 font-semibold"}
      >
        {props.value}
      </div>
    </div>
  );
}

function selectionFromParams(params: URLSearchParams) {
  return {
    elementFacturableIds: uniqueIds(params.getAll("element")),
    documentClientIds: uniqueIds(params.getAll("document")),
  };
}

function uniqueIds(values: string[]) {
  return [...new Set(values.filter((value) => /^\d+$/.test(value)))];
}

function buildRequest(
  rows: ClientReceivable[],
  methods: PaymentMethodDraft[],
  dateReglement: string,
  notes: string
): CreateClientPaymentRequest {
  const remaining = rows.map((row) => ({
    elementFacturableId: row.source.elementFacturableId ?? undefined,
    documentClientId: row.source.documentClientId ?? undefined,
    amount: row.soldeOuvert,
  }));
  const instruments = methods.map((method) => {
    let available = numeric(method.montant);
    const affectations: CreateClientPaymentRequest["instruments"][number]["affectations"] = [];
    for (const receivable of remaining) {
      if (available <= 0) break;
      const amount = Math.min(available, receivable.amount);
      if (amount > 0) {
        affectations.push({
          elementFacturableId: receivable.elementFacturableId,
          documentClientId: receivable.documentClientId,
          montant: round(amount),
        });
      }
      receivable.amount = round(receivable.amount - amount);
      available = round(available - amount);
    }
    return {
      mode: method.mode,
      montant: numeric(method.montant),
      dateInstrument: method.dateInstrument || dateReglement,
      dateEcheance: method.dateEcheance || undefined,
      referenceInstrument: method.referenceInstrument.trim() || undefined,
      banqueEmettrice: method.banqueEmettrice.trim() || undefined,
      compteTresorerieId: method.compteTresorerieId || undefined,
      affectations,
    };
  });
  const source = rows[0].source;
  return {
    dateReglement,
    clientPayeurId: source.payeurType === "CLIENT" ? source.payeurId : undefined,
    groupePayeurId: source.payeurType === "GROUPE" ? source.payeurId : undefined,
    notes: notes.trim() || undefined,
    instruments,
  };
}

function newPaymentMethod(): PaymentMethodDraft {
  return {
    key: crypto.randomUUID(),
    mode: "ESPECES",
    montant: "",
    dateInstrument: today,
    dateEcheance: "",
    referenceInstrument: "",
    banqueEmettrice: "",
    compteTresorerieId: "",
  };
}

function methodValid(method: PaymentMethodDraft, accounts: TreasuryAccount[]) {
  if (numeric(method.montant) <= 0) return false;
  if (method.mode === "ESPECES") {
    return accounts.some(
      (account) => account.id === method.compteTresorerieId
        && account.actif
        && account.typeCompte === "CAISSE"
    );
  }
  if (requiresBankAccountAtEntry(method.mode)) {
    const validBankAccount = accounts.some(
      (account) => account.id === method.compteTresorerieId
        && account.actif
        && account.typeCompte === "BANQUE"
    );
    if (!validBankAccount) return false;
  }
  if (requiresPaymentReference(method.mode)
    && !method.referenceInstrument.trim()) return false;
  return method.mode !== "EFFET" || Boolean(method.dateEcheance);
}

function receivableTargetKey(row: ClientReceivable) {
  if (row.source.documentClientId) return `D:${row.source.documentClientId}`;
  if (row.source.elementFacturableId) return `E:${row.source.elementFacturableId}`;
  throw new Error("Créance sans cible de règlement");
}

function numeric(value: string) {
  return parseAccountingAmount(value);
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: number) {
  return formatAccountingAmount(value);
}

function date(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}

function itemCount(count: number) {
  return `${count} élément${count > 1 ? "s" : ""}`;
}
