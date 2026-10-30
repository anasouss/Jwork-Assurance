import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CalendarClock,
  Check,
  ChevronsUpDown,
  GripVertical,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/features/production/components/MoneyInput";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { BankSelect } from "../components/BankSelect";
import {
  requiresBankAccountAtEntry,
  requiresPaymentReference,
  showsOriginatingBank,
} from "../client-payment-methods";
import { formatAccountingAmount, parseAccountingAmount } from "../format";
import {
  receivableCoverageReference,
  receivableDocumentReference,
  receivableTypeLabel,
} from "../receivable-display";
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
  dateEcheance: string;
  referenceInstrument: string;
  banqueEmettriceId: string;
  compteTresorerieId: string;
  reglementBureau: boolean;
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
];

export default function NouveauReglementClientPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreate = permissions.includes("reglement-client:create")
    || permissions.includes("reglement-client:manage");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requestedMultiClientDeposit = searchParams.get("multi") === "1";
  const multiClientDeposit = requestedMultiClientDeposit;
  const selection = selectionFromParams(searchParams);
  const returnPath = multiClientDeposit
    ? multiClientSelectionPath(selection)
    : "/app/compta/reglements";
  const hasSelection = selection.elementFacturableIds.length > 0
    || selection.documentClientIds.length > 0;
  const [dateReglement, setDateReglement] = useState(today);
  const [notes, setNotes] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [receipt, setReceipt] = useState<File>();
  const [methods, setMethods] = useState<PaymentMethodDraft[]>([]);
  const [editingMethodKey, setEditingMethodKey] = useState<string>();
  const [activePaymentMode, setActivePaymentMode] = useState<ClientPaymentMode | null>(null);
  const [creditConfirmationOpen, setCreditConfirmationOpen] = useState(false);
  const [orderedRows, setOrderedRows] = useState<ClientReceivable[]>([]);
  const [excludedTargetKeys, setExcludedTargetKeys] = useState<Set<string>>(new Set());
  const [recentlyMovedId, setRecentlyMovedId] = useState<string>();
  const movedHighlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const receivables = useQuery({
    queryKey: ["compta", "client-receivable-selection", selection, multiClientDeposit],
    queryFn: () => comptaApi.selectedClientReceivables({
      ...selection,
      multiPayeur: multiClientDeposit,
    }),
    enabled: hasSelection,
    staleTime: 0,
  });
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const banks = useQuery({
    queryKey: ["compta", "banks", "active"],
    queryFn: () => comptaApi.banks(),
  });
  const paymentPolicy = useQuery({
    queryKey: ["compta", "client-payment-policy"],
    queryFn: comptaApi.clientPaymentPolicy,
  });

  const rows = orderedRows;
  const selectedTotal = rows.reduce((sum, row) => sum + row.soldeOuvert, 0);
  const paymentTotal = methods.reduce((sum, method) => sum + numeric(method.montant), 0);
  const allocatedAmounts = allocationByReceivable(rows, paymentTotal);
  const remainingAmount = round(selectedTotal - paymentTotal);
  const unallocatedCredit = Math.max(0, round(-remainingAmount));
  const maximumUnallocatedCredit = paymentPolicy.data?.creditNonAffecteMaximum ?? 100;
  const creditExceedsMaximum = unallocatedCredit > maximumUnallocatedCredit + 0.001;
  const activeBankAccounts = (accounts.data ?? []).filter(
    (account) => account.actif && account.typeCompte === "BANQUE"
  );
  const soleActiveBankAccountId = activeBankAccounts.length === 1
    ? activeBankAccounts[0]?.id
    : undefined;
  const selectedPaymentModes = paymentModes.filter((option) =>
    methods.some((method) => method.mode === option.value)
  );
  const visiblePaymentMode = selectedPaymentModes.length === 1
    ? selectedPaymentModes[0]?.value ?? null
    : activePaymentMode;
  const visibleMethods = visiblePaymentMode == null
    ? []
    : methods.filter((method) => method.mode === visiblePaymentMode);

  useEffect(() => {
    setOrderedRows((receivables.data ?? []).filter(
      (row) => !excludedTargetKeys.has(receivableTargetKey(row))
    ));
  }, [receivables.data, excludedTargetKeys]);

  useEffect(() => {
    if (requestedMultiClientDeposit && methods.length === 0) {
      const method = newPaymentMethod("VERSEMENT_BANCAIRE");
      setMethods([method]);
      setEditingMethodKey(method.key);
      setActivePaymentMode("VERSEMENT_BANCAIRE");
    }
  }, [methods.length, requestedMultiClientDeposit]);

  useEffect(() => {
    if (!soleActiveBankAccountId) return;
    setMethods((current) => {
      let changed = false;
      const next = current.map((method) => {
        if (!requiresBankAccountAtEntry(method.mode) || method.compteTresorerieId) {
          return method;
        }
        changed = true;
        return { ...method, compteTresorerieId: soleActiveBankAccountId };
      });
      return changed ? next : current;
    });
  }, [methods, soleActiveBankAccountId]);

  useEffect(() => {
    if (multiClientDeposit
      && selectedTotal > 0
      && methods.length === 1
      && !methods[0]?.montant) {
      setMethods((current) => current.map((method) => ({
        ...method,
        montant: money(selectedTotal),
      })));
    }
  }, [methods, multiClientDeposit, selectedTotal]);

  useEffect(() => () => {
    if (movedHighlightTimer.current) clearTimeout(movedHighlightTimer.current);
  }, []);

  useEffect(() => {
    if (methods.length === 0) {
      setActivePaymentMode(null);
    } else if (!methods.some((method) => method.mode === activePaymentMode)) {
      setActivePaymentMode(methods[0].mode);
    }
  }, [activePaymentMode, methods]);

  const savePayment = useMutation({
    mutationFn: () => {
      const request = buildRequest(
        rows,
        methods,
        dateReglement,
        notes,
        multiClientDeposit,
        depositorName
      );
      if (multiClientDeposit && receipt) {
        return comptaApi.createMultiClientBankDeposit(request, receipt);
      }
      return comptaApi.createClientPayment(request);
    },
    onSuccess: async (payment) => {
      toast.success(multiClientDeposit
        ? `Versement ${payment.numero} enregistré et comptabilisé`
        : `Règlement ${payment.numero} enregistré`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
      ]);
      navigate(`/app/compta/reglements/historique?search=${encodeURIComponent(payment.numero)}`, {
        replace: true,
      });
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Règlement impossible"
    ),
  });

  const canSubmit = canCreate
    && Boolean(dateReglement)
    && rows.length > 0
    && methods.length > 0
    && paymentTotal > 0
    && paymentPolicy.isSuccess
    && !creditExceedsMaximum
    && (!multiClientDeposit || (
      remainingAmount >= -0.001
      && Boolean(depositorName.trim())
      && Boolean(receipt)
      && methods.length === 1
      && methods[0]?.mode === "VERSEMENT_BANCAIRE"
    ))
    && methods.every((method) => methodValid(method, accounts.data ?? []));

  function updateMethod(key: string, patch: Partial<PaymentMethodDraft>) {
    setMethods((current) => current.map((method) => method.key === key
      ? { ...method, ...patch }
      : method));
  }

  function addPaymentMethod(mode: ClientPaymentMode) {
    const method = newPaymentMethod(mode);
    setMethods((current) => {
      const lastModeIndex = current.map((item) => item.mode).lastIndexOf(mode);
      if (lastModeIndex < 0) return [...current, method];
      return [
        ...current.slice(0, lastModeIndex + 1),
        method,
        ...current.slice(lastModeIndex + 1),
      ];
    });
    setEditingMethodKey(method.key);
  }

  function togglePaymentMode(mode: ClientPaymentMode) {
    if (methods.some((method) => method.mode === mode)) {
      setMethods((current) => current.filter((method) => method.mode !== mode));
      if (methods.some((method) => method.mode === mode && method.key === editingMethodKey)) {
        setEditingMethodKey(undefined);
      }
      return;
    }
    addPaymentMethod(mode);
    setActivePaymentMode(mode);
  }

  function removePaymentMethod(key: string) {
    setMethods((current) => current.filter((method) => method.key !== key));
    if (editingMethodKey === key) setEditingMethodKey(undefined);
  }

  function reorderReceivables(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const movedId = String(event.active.id);
    setOrderedRows((current) => {
      const from = current.findIndex((row) => receivableTargetKey(row) === event.active.id);
      const to = current.findIndex((row) => receivableTargetKey(row) === event.over?.id);
      return from < 0 || to < 0 ? current : arrayMove(current, from, to);
    });
    setRecentlyMovedId(movedId);
    if (movedHighlightTimer.current) clearTimeout(movedHighlightTimer.current);
    movedHighlightTimer.current = setTimeout(() => setRecentlyMovedId(undefined), 900);
  }

  function removeReceivable(row: ClientReceivable) {
    if (rows.length === 1) {
      navigate("/app/compta/reglements", { replace: true });
      return;
    }

    if (row.source.documentClientId && row.source.elementFacturableId) {
      setExcludedTargetKeys((current) => {
        const next = new Set(current);
        next.add(receivableTargetKey(row));
        return next;
      });
      setOrderedRows((current) => current.filter(
        (item) => receivableTargetKey(item) !== receivableTargetKey(row)
      ));
      return;
    }

    const parameter = row.source.documentClientId ? "document" : "element";
    const id = row.source.documentClientId ?? row.source.elementFacturableId;
    const nextParams = new URLSearchParams(searchParams);
    const remainingIds = nextParams.getAll(parameter).filter((value) => value !== id);
    nextParams.delete(parameter);
    remainingIds.forEach((value) => nextParams.append(parameter, value));

    setOrderedRows((current) => current.filter(
      (currentRow) => receivableTargetKey(currentRow) !== receivableTargetKey(row)
    ));
    setSearchParams(nextParams, { replace: true });
  }

  if (!hasSelection) {
    return <InvalidSelection message="Aucune prime à encaisser n’a été sélectionnée." />;
  }
  if (receivables.isError) {
    return <InvalidSelection message={receivables.error instanceof Error
      ? receivables.error.message
      : "La sélection ne peut pas être chargée."} />;
  }

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">
            Comptabilité
          </div>
          <h1 className="mt-1 text-xl font-semibold">
            Enregistrer un règlement
          </h1>
          <p className="text-sm text-muted-foreground">
            {receivables.isLoading
              ? "Chargement de la sélection..."
              : multiClientDeposit
                ? `Versement bancaire · ${itemCount(rows.length)}`
                : `${rows[0]?.source.payeurNom ?? "Payeur"} · ${itemCount(rows.length)}`}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={returnPath}>
            <ArrowLeft className="size-4" />
            Retour aux primes à encaisser
          </Link>
        </Button>
      </header>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-3">
        <SummaryCell
          label="Total des éléments"
          value={String(rows.length)}
          tone="quittance"
        />
        <SummaryCell
          label="Total du règlement"
          value={money(paymentTotal)}
          tone="payment"
        />
        <SummaryCell
          label={unallocatedCredit > 0.001 ? "Reste à affecter" : "Reste à payer"}
          value={unallocatedCredit > 0.001 ? `+${money(unallocatedCredit)}` : money(remainingAmount)}
          detail={unallocatedCredit > 0.001
            ? `Maximum autorisé : ${money(maximumUnallocatedCredit)}`
            : undefined}
          tone={creditExceedsMaximum ? "danger" : unallocatedCredit > 0.001 ? "credit" : "balance"}
        />
      </section>

      <DndContext
        sensors={dragSensors}
        collisionDetection={closestCenter}
        onDragEnd={reorderReceivables}
      >
        <section className="overflow-hidden rounded-md border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-orange-600 text-xs uppercase text-white">
                <tr>
                  <th className="w-28 px-4 py-3 text-left">Priorité</th>
                  <th className="px-4 py-3 text-left">Payeur</th>
                  <th className="px-4 py-3 text-left">Référence</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Police / contrat</th>
                  <th className="px-4 py-3 text-left">Nature</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Solde ouvert</th>
                  <th className="w-36 px-4 py-3 text-right">Affecté</th>
                  <th className="w-14 px-2 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <SortableContext
                  items={rows.map(receivableTargetKey)}
                  strategy={verticalListSortingStrategy}
                >
                  {rows.map((row, index) => (
                    <SortableReceivableRow
                      key={receivableTargetKey(row)}
                      row={row}
                      priority={index + 1}
                      allocatedAmount={allocatedAmounts.get(receivableTargetKey(row)) ?? 0}
                      recentlyMoved={recentlyMovedId === receivableTargetKey(row)}
                      onRemove={() => removeReceivable(row)}
                    />
                  ))}
                </SortableContext>
                {receivables.isLoading ? (
                  <tr>
                    <td colSpan={10} className="h-24 text-center text-muted-foreground">
                      Chargement...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </DndContext>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b bg-muted/30 px-4 py-3">
          <h2 className="font-semibold">Moyens de règlement</h2>
        </div>

        <div className="grid gap-4 bg-muted/10 p-4">
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{multiClientDeposit ? "Date du versement" : "Date du règlement"}</Label>
              <DatePicker
                date={dateReglement}
                onSelect={(value) => setDateReglement(toDateOnly(value) ?? "")}
              />
            </div>

            {multiClientDeposit ? (
              <div className="grid gap-2">
                <Label>Mode de règlement</Label>
                <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm font-medium">
                  <Landmark className="size-4 text-orange-700" /> Versement bancaire
                </div>
              </div>
            ) : (
              <PaymentModesMultiSelect
                selectedModes={selectedPaymentModes.map((option) => option.value)}
                onToggle={togglePaymentMode}
              />
            )}
          </div>

          {multiClientDeposit ? (
            <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="deposit-depositor">Déposant / collecteur</Label>
                <Input
                  id="deposit-depositor"
                  value={depositorName}
                  maxLength={220}
                  onChange={(event) => setDepositorName(event.target.value)}
                  placeholder="Nom de la personne ayant effectué le versement"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deposit-receipt">Justificatif du bordereau bancaire</Label>
                <Input
                  id="deposit-receipt"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(event) => setReceipt(event.target.files?.[0])}
                />
              </div>
            </div>
          ) : null}

          {selectedPaymentModes.length > 1 && activePaymentMode ? (
            <Tabs
              value={activePaymentMode}
              onValueChange={(value) => setActivePaymentMode(value as ClientPaymentMode)}
            >
              <TabsList className="flex h-auto w-full gap-1">
                {selectedPaymentModes.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="h-10">
                    <Icon className="size-4" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}

          {visibleMethods.length > 0 ? (
            <div className="divide-y border-t">
              {visibleMethods.map((method, index) => {
                const methodNumber = index + 1;
                if (!multiClientDeposit && method.key !== editingMethodKey) {
                  return (
                    <PaymentMethodSummaryRow
                      key={method.key}
                      method={method}
                      number={methodNumber}
                      complete={methodValid(method, accounts.data ?? [])}
                      bankLabel={(banks.data ?? []).find((bank) => bank.id === method.banqueEmettriceId)?.libelle}
                      accountLabel={(accounts.data ?? []).find((account) => account.id === method.compteTresorerieId)?.libelle}
                      onEdit={() => setEditingMethodKey(method.key)}
                      onRemove={() => removePaymentMethod(method.key)}
                    />
                  );
                }
                return (
                <section key={method.key} className="grid gap-3 bg-orange-50/30 px-3 py-3 dark:bg-orange-950/10">
                  <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(150px,0.65fr)_repeat(4,minmax(0,1fr))_auto]">
                    <div className="flex h-10 items-center gap-2.5 xl:self-end">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-sm border border-orange-600 bg-orange-500 text-xs font-bold text-white shadow-sm">
                        {methodNumber}
                      </span>
                      <span className="truncate text-sm font-bold text-foreground">
                        {paymentModes.find((option) => option.value === method.mode)?.label}
                        {" "}
                        {methodNumber}
                      </span>
                    </div>

                  {requiresPaymentReference(method.mode) ? (
                    <div className="grid gap-1.5">
                      <Label>{method.mode === "VERSEMENT_BANCAIRE" ? "N° bordereau banque" : "Référence"}</Label>
                      <Input
                        value={method.referenceInstrument}
                        onChange={(event) => updateMethod(
                          method.key,
                          { referenceInstrument: event.target.value }
                        )}
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-1.5">
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
                    <MoneyInput
                      className="text-right tabular-nums"
                      value={method.montant ? numeric(method.montant) : undefined}
                      onValueChange={(value) => updateMethod(method.key, {
                        montant: value == null ? "" : String(value),
                      })}
                    />
                  </div>
                  {method.mode === "EFFET" || method.mode === "CHEQUE" ? (
                    <div className="grid gap-1.5">
                      <Label>{method.mode === "CHEQUE" ? "Date portée sur le chèque" : "Date d’échéance"}</Label>
                      <DatePicker
                        date={method.dateEcheance}
                        onSelect={(value) => updateMethod(method.key, {
                          dateEcheance: toDateOnly(value) ?? "",
                        })}
                      />
                    </div>
                  ) : null}
                  {method.mode !== "ESPECES" ? (
                    <>
                      {!requiresPaymentReference(method.mode) ? (
                        <div className="grid gap-1.5">
                          <Label>Référence</Label>
                          <Input
                            value={method.referenceInstrument}
                            onChange={(event) => updateMethod(
                              method.key,
                              { referenceInstrument: event.target.value }
                            )}
                          />
                        </div>
                      ) : null}
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
                        <BankSelect
                          banks={banks.data ?? []}
                          value={method.banqueEmettriceId}
                          label={method.mode === "CHEQUE" || method.mode === "EFFET"
                            ? "Banque émettrice"
                            : "Banque d’origine"}
                          onChange={(value) => updateMethod(
                            method.key,
                            { banqueEmettriceId: value }
                          )}
                          disabled={banks.isLoading}
                        />
                      ) : null}
                    </>
                  ) : null}

                    <div className="flex h-10 items-center justify-end gap-1 md:col-span-2 xl:col-span-1 xl:col-start-6">
                      {!multiClientDeposit ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-orange-300 text-orange-800 hover:bg-orange-50 hover:text-orange-900 dark:border-orange-800 dark:text-orange-200 dark:hover:bg-orange-950/30"
                          disabled={!methodValid(method, accounts.data ?? [])}
                          onClick={() => addPaymentMethod(method.mode)}
                        >
                          <Plus className="size-4" />
                          Ajouter
                        </Button>
                      ) : null}
                      {!multiClientDeposit && <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Supprimer ce moyen"
                        onClick={() => removePaymentMethod(method.key)}
                      >
                        <Trash2 className="size-4" />
                      </Button>}
                    </div>
                  </div>

                  {(method.mode === "CHEQUE" || method.mode === "EFFET") && (
                    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                      <Switch
                        id={`office-payment-${method.key}`}
                        checked={method.reglementBureau}
                        onCheckedChange={(checked) => updateMethod(method.key, { reglementBureau: checked })}
                      />
                      <Label htmlFor={`office-payment-${method.key}`} className="cursor-pointer">Règlement au bureau</Label>
                    </div>
                  )}

                  {requiresBankAccountAtEntry(method.mode)
                    && !accounts.isLoading
                    && activeBankAccounts.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      <AlertCircle className="size-4 shrink-0" />
                      Aucun compte bancaire actif n’est disponible.
                    </div>
                  ) : null}
                </section>
                );
              })}
              {!multiClientDeposit && visiblePaymentMode && !visibleMethods.some((method) => method.key === editingMethodKey) ? (
                <div className="flex justify-end bg-muted/20 px-3 py-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => addPaymentMethod(visiblePaymentMode)}>
                    <Plus className="size-4" />
                    Ajouter
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-2 border-t pt-4">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24"
            />
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t py-4">
        <div className={creditExceedsMaximum || paymentPolicy.isError
          ? "text-sm font-medium text-destructive"
          : "text-sm text-muted-foreground"}
        >
          {paymentPolicy.isError
            ? "Impossible de vérifier la limite du montant restant à affecter. Réessayez avant d’enregistrer."
            : creditExceedsMaximum
            ? `Reste à affecter supérieur au maximum autorisé de ${money(maximumUnallocatedCredit)}`
            : remainingAmount > 0.001
            ? `Paiement partiel · reste ${money(remainingAmount)}`
            : remainingAmount < -0.001
              ? `Reste à affecter · ${money(Math.abs(remainingAmount))}`
              : "Le règlement couvre la sélection"}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={returnPath}>Annuler</Link>
          </Button>
          <Button
            disabled={!canSubmit || savePayment.isPending}
            onClick={() => {
              if (unallocatedCredit > 0.001) {
                setCreditConfirmationOpen(true);
              } else {
                savePayment.mutate();
              }
            }}
          >
            <Banknote className="size-4" />
            {multiClientDeposit ? "Enregistrer le versement" : "Enregistrer le règlement"}
          </Button>
        </div>
      </footer>

      <AlertDialog open={creditConfirmationOpen} onOpenChange={setCreditConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le reste à affecter</AlertDialogTitle>
            <AlertDialogDescription>
              Vous encaissez {money(paymentTotal)} MAD, dont {money(unallocatedCredit)} MAD restera
              à affecter au compte du client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revenir au règlement</AlertDialogCancel>
            <AlertDialogAction
              disabled={savePayment.isPending}
              onClick={() => savePayment.mutate()}
            >
              Confirmer et enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableReceivableRow(props: {
  row: ClientReceivable;
  priority: number;
  allocatedAmount: number;
  recentlyMoved: boolean;
  onRemove: () => void;
}) {
  const id = receivableTargetKey(props.row);
  const isAllocated = props.allocatedAmount > 0.001;
  const isFullyAllocated = props.allocatedAmount >= props.row.soldeOuvert - 0.001;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging
        ? "relative z-10 bg-amber-100 shadow-md dark:bg-amber-950/40"
        : isOver
          ? "bg-sky-50 shadow-[inset_0_2px_0_0_rgb(56_189_248)] dark:bg-sky-950/35"
          : props.recentlyMoved
            ? "bg-emerald-50 transition-colors duration-700 dark:bg-emerald-950/30"
            : "odd:bg-background even:bg-muted/20 hover:bg-amber-50/40 dark:hover:bg-amber-950/10"}
    >
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex size-8 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Déplacer la quittance en priorité ${props.priority}`}
            title="Modifier la priorité"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <span className="w-5 text-center text-sm font-semibold tabular-nums">
            {props.priority}
          </span>
        </div>
      </td>
      <td className="px-4 py-1.5">
        <div className="font-medium">{props.row.source.payeurNom}</div>
        <div className="text-xs text-muted-foreground">
          {props.row.source.payeurType === "GROUPE" ? "Groupe" : "Client"}
        </div>
      </td>
      <td className="px-4 py-1.5 font-medium">{receivableDocumentReference(props.row)}</td>
      <td className="px-4 py-1.5">{receivableTypeLabel(props.row)}</td>
      <td className="px-4 py-1.5 font-medium">{receivableCoverageReference(props.row)}</td>
      <td className="px-4 py-1.5">
        <div className="font-medium">{props.row.source.mouvement}</div>
        {props.row.source.documentClientId ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            Ligne de facture
          </div>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-4 py-1.5">{date(props.row.source.dateEffet)}</td>
      <td className="px-4 py-1.5 text-right font-semibold tabular-nums">
        {money(props.row.soldeOuvert)}
      </td>
      <td className="px-4 py-1.5 text-right leading-tight">
        <div className={isFullyAllocated
          ? "font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
          : isAllocated
            ? "font-semibold tabular-nums text-amber-700 dark:text-amber-300"
            : "tabular-nums text-muted-foreground"}
        >
          {money(props.allocatedAmount)}
        </div>
        <div className={isFullyAllocated
          ? "text-xs font-medium text-emerald-700 dark:text-emerald-300"
          : isAllocated
            ? "text-xs font-medium text-amber-700 dark:text-amber-300"
            : "text-xs text-muted-foreground"}
        >
          {isFullyAllocated ? "Soldé" : isAllocated ? "Partiel" : "En attente"}
        </div>
      </td>
      <td className="px-2 py-1.5 text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          aria-label={`Retirer ${props.row.source.mouvement} du règlement`}
          title="Retirer du règlement"
          onClick={props.onRemove}
        >
          <X className="size-4" />
        </Button>
      </td>
    </tr>
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
          <Link to="/app/compta/reglements">Retour aux primes à encaisser</Link>
        </Button>
      </div>
    </div>
  );
}

function PaymentModesMultiSelect(props: {
  selectedModes: ClientPaymentMode[];
  onToggle: (mode: ClientPaymentMode) => void;
}) {
  const selectedOptions = paymentModes.filter((option) =>
    props.selectedModes.includes(option.value)
  );
  const label = selectedOptions.length === 0
    ? "Sélectionner les modes"
    : selectedOptions.length === 1
      ? selectedOptions[0]?.label ?? "Sélectionner les modes"
      : `${selectedOptions.length} modes sélectionnés`;

  return (
    <div className="grid gap-2">
      <Label>Modes de règlement</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-11 justify-between font-normal">
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Rechercher un mode..." />
            <CommandList>
              <CommandEmpty>Aucun mode trouvé.</CommandEmpty>
              <CommandGroup>
                {paymentModes.map(({ value, label: optionLabel, icon: Icon }) => {
                  const selected = props.selectedModes.includes(value);
                  return (
                    <CommandItem
                      key={value}
                      value={optionLabel}
                      onSelect={() => props.onToggle(value)}
                    >
                      <Check className={selected ? "size-4 opacity-100" : "size-4 opacity-0"} />
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{optionLabel}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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
        disabled={options.length <= 1}
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

function PaymentMethodSummaryRow(props: {
  method: PaymentMethodDraft;
  number: number;
  complete: boolean;
  bankLabel?: string;
  accountLabel?: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const modeLabel = paymentModes.find((option) => option.value === props.method.mode)?.label
    ?? props.method.mode;
  const institution = props.bankLabel ?? props.accountLabel ?? "-";
  return (
    <section className={`grid items-center gap-3 px-3 py-3 md:grid-cols-[minmax(150px,0.8fr)_repeat(4,minmax(0,1fr))_auto] ${
      props.complete
        ? "bg-emerald-50/40 dark:bg-emerald-950/10"
        : "bg-amber-50/50 dark:bg-amber-950/10"
    }`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-sm border text-xs font-bold text-white ${
          props.complete
            ? "border-emerald-700 bg-emerald-600"
            : "border-amber-700 bg-amber-600"
        }`}>
          {props.number}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{modeLabel} {props.number}</div>
          <div className={props.complete
            ? "text-xs text-emerald-700 dark:text-emerald-300"
            : "text-xs text-amber-700 dark:text-amber-300"}
          >
            {props.complete ? "Ajouté" : "À compléter"}
          </div>
        </div>
      </div>
      <InstrumentSummaryValue label="Référence" value={props.method.referenceInstrument || "-"} />
      <InstrumentSummaryValue label="Montant" value={money(numeric(props.method.montant))} align="right" />
      <InstrumentSummaryValue
        label={props.method.mode === "CHEQUE" ? "Date portée" : "Échéance"}
        value={formatDateOnly(props.method.dateEcheance)}
      />
      <InstrumentSummaryValue
        label={props.method.mode === "CHEQUE" || props.method.mode === "EFFET" ? "Banque émettrice" : "Compte crédité"}
        value={institution}
        detail={props.method.reglementBureau ? "Règlement au bureau" : undefined}
      />
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="icon" title="Modifier" onClick={props.onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          title="Supprimer"
          onClick={props.onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </section>
  );
}

function InstrumentSummaryValue(props: {
  label: string;
  value: string;
  detail?: string;
  align?: "left" | "right";
}) {
  return (
    <div className={props.align === "right" ? "text-right" : undefined}>
      <div className="text-[11px] uppercase text-muted-foreground">{props.label}</div>
      <div className="truncate text-sm font-medium tabular-nums">{props.value}</div>
      {props.detail ? <div className="text-xs text-muted-foreground">{props.detail}</div> : null}
    </div>
  );
}

function formatDateOnly(value: string) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function SummaryCell(props: {
  label: string;
  value: string;
  detail?: string;
  tone: "quittance" | "payment" | "balance" | "credit" | "danger";
}) {
  const surfaceClasses = {
    quittance: "bg-orange-50/50 dark:bg-orange-950/15",
    payment: "bg-emerald-50/50 dark:bg-emerald-950/15",
    balance: "bg-amber-50/50 dark:bg-amber-950/15",
    credit: "bg-sky-50/60 dark:bg-sky-950/20",
    danger: "bg-red-50/60 dark:bg-red-950/20",
  }[props.tone];
  const valueClasses = {
    quittance: "text-orange-800 dark:text-orange-300",
    payment: "text-emerald-800 dark:text-emerald-300",
    balance: "text-amber-800 dark:text-amber-300",
    credit: "text-sky-800 dark:text-sky-300",
    danger: "text-red-700 dark:text-red-300",
  }[props.tone];
  return (
    <div className={`border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${surfaceClasses}`}>
      <div className="text-xs uppercase text-muted-foreground">{props.label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${valueClasses}`}>
        {props.value}
      </div>
      {props.detail ? <div className="mt-0.5 text-xs text-muted-foreground">{props.detail}</div> : null}
    </div>
  );
}

function selectionFromParams(params: URLSearchParams) {
  return {
    elementFacturableIds: uniqueIds(params.getAll("element")),
    documentClientIds: uniqueIds(params.getAll("document")),
  };
}

function multiClientSelectionPath(selection: {
  elementFacturableIds: string[];
  documentClientIds: string[];
}) {
  const params = new URLSearchParams();
  selection.elementFacturableIds.forEach((id) => params.append("selectionElement", id));
  selection.documentClientIds.forEach((id) => params.append("selectionDocument", id));
  const query = params.toString();
  return `/app/compta/reglements/versement-multi-clients${query ? `?${query}` : ""}`;
}

function uniqueIds(values: string[]) {
  return [...new Set(values.filter((value) => /^\d+$/.test(value)))];
}

function buildRequest(
  rows: ClientReceivable[],
  methods: PaymentMethodDraft[],
  dateReglement: string,
  notes: string,
  multiPayeur = false,
  deposantNom = ""
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
      dateInstrument: dateReglement,
      dateEcheance: method.dateEcheance || undefined,
      referenceInstrument: method.referenceInstrument.trim() || undefined,
      banqueEmettriceId: method.banqueEmettriceId || undefined,
      reglementBureau: method.reglementBureau,
      compteTresorerieId: method.mode === "ESPECES"
        ? undefined
        : method.compteTresorerieId || undefined,
      affectations,
    };
  });
  const source = rows[0].source;
  return {
    dateReglement,
    clientPayeurId: !multiPayeur && source.payeurType === "CLIENT" ? source.payeurId : undefined,
    groupePayeurId: !multiPayeur && source.payeurType === "GROUPE" ? source.payeurId : undefined,
    multiPayeur,
    deposantNom: multiPayeur ? deposantNom.trim() : undefined,
    notes: notes.trim() || undefined,
    instruments,
  };
}

function allocationByReceivable(rows: ClientReceivable[], paymentTotal: number) {
  let available = Math.max(0, round(paymentTotal));
  return new Map(rows.map((row) => {
    const allocated = round(Math.min(available, row.soldeOuvert));
    available = round(available - allocated);
    return [receivableTargetKey(row), allocated] as const;
  }));
}

function newPaymentMethod(mode: ClientPaymentMode): PaymentMethodDraft {
  return {
    key: crypto.randomUUID(),
    mode,
    montant: "",
    dateEcheance: "",
    referenceInstrument: "",
    banqueEmettriceId: "",
    compteTresorerieId: "",
    reglementBureau: false,
  };
}

function methodValid(method: PaymentMethodDraft, accounts: TreasuryAccount[]) {
  if (numeric(method.montant) <= 0) return false;
  if (method.mode === "ESPECES") {
    return true;
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
  if (showsOriginatingBank(method.mode) && !method.banqueEmettriceId) return false;
  if ((method.mode === "CHEQUE" || method.mode === "EFFET")
    && !method.dateEcheance) return false;
  return true;
}

function receivableTargetKey(row: ClientReceivable) {
  if (row.source.documentClientId && row.source.elementFacturableId) {
    return `L:${row.source.documentClientId}:${row.source.elementFacturableId}`;
  }
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
