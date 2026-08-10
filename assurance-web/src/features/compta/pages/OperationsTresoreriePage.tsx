import { useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, History, Landmark, Scale, Search, Undo2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import { parseAccountingAmount } from "../format";
import type { TreasuryOperation } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, TREASURY_PAGE_SIZE } from "./treasury-format";

type EntryMode = "TRANSFERT" | "AJUSTEMENT";

export default function OperationsTresoreriePage() {
  const [searchParams] = useSearchParams();
  const initialAccountId = searchParams.get("compteId") || "";
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<EntryMode>("TRANSFERT");
  const [sourceId, setSourceId] = useState(initialAccountId);
  const [destinationType, setDestinationType] = useState<"CAISSE" | "BANQUE" | "">("");
  const [destinationId, setDestinationId] = useState("");
  const [adjustmentAccountId, setAdjustmentAccountId] = useState(initialAccountId);
  const [direction, setDirection] = useState<"ENTREE" | "SORTIE">("ENTREE");
  const [amount, setAmount] = useState("");
  const [operationDate, setOperationDate] = useState(toDateOnly(new Date()) ?? "");
  const [valueDate, setValueDate] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [operationToCancel, setOperationToCancel] = useState<TreasuryOperation>();
  const [cancellationReason, setCancellationReason] = useState("");

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const operations = useQuery({
    queryKey: ["compta", "treasury-operations", initialAccountId, appliedSearch, page],
    queryFn: () => comptaApi.treasuryOperations({
      compteId: initialAccountId || undefined,
      search: appliedSearch || undefined,
      page,
      size: TREASURY_PAGE_SIZE,
    }),
  });

  const createOperation = useMutation({
    mutationFn: () => mode === "TRANSFERT"
      ? comptaApi.createTreasuryTransfer({
          compteSourceId: sourceId,
          compteDestinationId: destinationId,
          montant: parseAccountingAmount(amount),
          dateOperation: operationDate,
          dateValeur: valueDate || undefined,
          reference: reference.trim() || undefined,
          motif: reason.trim(),
        })
      : comptaApi.createTreasuryAdjustment({
          compteTresorerieId: adjustmentAccountId,
          sens: direction,
          montant: parseAccountingAmount(amount),
          dateOperation: operationDate,
          dateValeur: valueDate || undefined,
          reference: reference.trim() || undefined,
          motif: reason.trim(),
        }),
    onSuccess: async () => {
      toast.success(mode === "TRANSFERT" ? "Transfert enregistré" : "Ajustement enregistré");
      setAmount("");
      setReference("");
      setReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-operations"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury", "movements"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Opération impossible"),
  });

  const cancelOperation = useMutation({
    mutationFn: () => comptaApi.cancelTreasuryOperation(
      operationToCancel!.id,
      toDateOnly(new Date()) ?? operationToCancel!.dateOperation,
      cancellationReason.trim()
    ),
    onSuccess: async () => {
      toast.success("Contre-écriture enregistrée");
      setOperationToCancel(undefined);
      setCancellationReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-operations"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury", "movements"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Annulation impossible"),
  });

  const activeAccounts = (accounts.data ?? []).filter((account) => account.actif);
  const formValid = parseAccountingAmount(amount) > 0
    && Boolean(operationDate)
    && Boolean(reason.trim())
    && (mode === "TRANSFERT"
      ? Boolean(sourceId && destinationType && destinationId && sourceId !== destinationId)
      : Boolean(adjustmentAccountId));

  return (
    <div className="grid gap-5">
      <header>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
        <h1 className="mt-1 text-xl font-semibold">Transferts et corrections</h1>
        <p className="text-sm text-muted-foreground">
          Déplacez des fonds entre comptes ou corrigez un solde avec une justification auditée.
        </p>
      </header>

      <section className="rounded-md border bg-card p-4">
        <div className="mb-4 inline-flex rounded-md border p-1">
          <Button
            variant="ghost"
            className={mode === "TRANSFERT"
              ? "bg-amber-100 text-amber-950 shadow-sm hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-50"
              : undefined}
            onClick={() => setMode("TRANSFERT")}
          >
            <ArrowRightLeft className="size-4" /> Transférer
          </Button>
          <Button
            variant="ghost"
            className={mode === "AJUSTEMENT"
              ? "bg-amber-100 text-amber-950 shadow-sm hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-50"
              : undefined}
            onClick={() => setMode("AJUSTEMENT")}
          >
            <Scale className="size-4" /> Corriger le solde
          </Button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {mode === "TRANSFERT"
            ? "Déplacez des fonds vers un autre compte de trésorerie."
            : "Enregistrez une correction exceptionnelle et justifiée du solde comptable."}
        </p>
        <div className="grid gap-4 lg:grid-cols-4">
          {mode === "TRANSFERT" ? (
            <>
              <Field label="Compte source">
                <AccountSelect
                  value={sourceId}
                  accounts={activeAccounts}
                  disabled={Boolean(initialAccountId)}
                  onChange={(value) => {
                    setSourceId(value);
                    if (destinationId === value) setDestinationId("");
                  }}
                />
              </Field>
              <Field label="Destination">
                <div className="grid grid-cols-2 rounded-md border p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className={destinationType === "CAISSE"
                      ? "bg-amber-100 text-amber-950 shadow-sm hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-50"
                      : undefined}
                    onClick={() => {
                      setDestinationType("CAISSE");
                      setDestinationId("");
                    }}
                  >
                    <WalletCards className="size-4" />
                    Caisse
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={destinationType === "BANQUE"
                      ? "bg-amber-100 text-amber-950 shadow-sm hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-50"
                      : undefined}
                    onClick={() => {
                      setDestinationType("BANQUE");
                      setDestinationId("");
                    }}
                  >
                    <Landmark className="size-4" />
                    Compte bancaire
                  </Button>
                </div>
              </Field>
              <Field label="Compte destination">
                <AccountSelect
                  value={destinationId}
                  accounts={activeAccounts.filter((account) =>
                    account.typeCompte === destinationType && account.id !== sourceId
                  )}
                  disabled={!destinationType}
                  onChange={setDestinationId}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Compte">
                <AccountSelect
                  value={adjustmentAccountId}
                  accounts={activeAccounts}
                  disabled={Boolean(initialAccountId)}
                  onChange={setAdjustmentAccountId}
                />
              </Field>
              <Field label="Sens de la correction">
                <Select value={direction} onValueChange={(value) => setDirection(value as typeof direction)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTREE">Augmenter le solde</SelectItem>
                    <SelectItem value="SORTIE">Diminuer le solde</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
          <Field label="Montant">
            <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Field label="Date de l'opération">
            <DatePicker date={operationDate} onSelect={(value) => setOperationDate(toDateOnly(value) ?? "")} />
          </Field>
          <Field label="Date de valeur">
            <DatePicker date={valueDate} onSelect={(value) => setValueDate(toDateOnly(value) ?? "")} />
          </Field>
          <Field label="Référence">
            <Input value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
          <div className="grid gap-2 lg:col-span-2">
            <Label htmlFor="treasury-operation-reason">Motif *</Label>
            <Input
              id="treasury-operation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={!formValid || createOperation.isPending} onClick={() => createOperation.mutate()}>
            {mode === "TRANSFERT" ? "Enregistrer le transfert" : "Enregistrer la correction"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-semibold">Historique des opérations</h2>
            <p className="text-sm text-muted-foreground">Les annulations apparaissent comme des contre-écritures.</p>
          </div>
          <div className="flex gap-2">
            <Input
              className="w-72"
              aria-label="Rechercher une opération"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setAppliedSearch(search.trim());
                  setPage(0);
                }
              }}
            />
            <Button size="icon" title="Rechercher" onClick={() => {
              setAppliedSearch(search.trim());
              setPage(0);
            }}>
              <Search className="size-4" />
            </Button>
          </div>
        </div>
        {operations.isLoading || (operations.data?.rows.length ?? 0) > 0 ? (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>N° opération</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.isLoading ? <TableRowsSkeleton colSpan={8} rows={6} /> :
                (operations.data?.rows ?? []).map((operation) => (
                <TableRow key={operation.id}>
                  <TableCell className="font-medium">{operation.numero}</TableCell>
                  <TableCell>{formatTreasuryDate(operation.dateOperation)}</TableCell>
                  <TableCell>{operationTypeLabel(operation.typeOperation)}</TableCell>
                  <TableCell>{operation.compteSource || "-"}</TableCell>
                  <TableCell>{operation.compteDestination || "-"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatTreasuryMoney(operation.montant)}</TableCell>
                  <TableCell>{operation.statut === "ANNULEE" ? "Annulée" : "Confirmée"}</TableCell>
                  <TableCell>
                    {operation.statut === "CONFIRMEE" && !operation.typeOperation.startsWith("ANNULATION") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Annuler par contre-écriture"
                        onClick={() => setOperationToCancel(operation)}
                      >
                        <Undo2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex items-center gap-3 px-4 py-6 text-muted-foreground">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
              <History className="size-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Aucune opération enregistrée</div>
              <p className="text-sm">Les transferts, corrections et contre-écritures apparaîtront ici.</p>
            </div>
          </div>
        )}
        {operations.data && operations.data.page.totalElements > 0 && (
          <ServerPagination
            page={operations.data.page.number}
            totalPages={operations.data.page.totalPages}
            totalElements={operations.data.page.totalElements}
            loading={operations.isFetching}
            onPageChange={setPage}
          />
        )}
      </section>

      <Dialog open={Boolean(operationToCancel)} onOpenChange={(open) => !open && setOperationToCancel(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler l'opération</DialogTitle>
            <DialogDescription>
              Une contre-écriture sera créée. L'opération d'origine restera dans l'historique.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="treasury-cancellation-reason">Motif *</Label>
            <Textarea
              id="treasury-cancellation-reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOperationToCancel(undefined)}>Fermer</Button>
            <Button
              variant="destructive"
              disabled={!cancellationReason.trim() || cancelOperation.isPending}
              onClick={() => cancelOperation.mutate()}
            >
              Créer la contre-écriture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}

function AccountSelect({
  value,
  accounts,
  disabled = false,
  onChange,
}: {
  value: string;
  accounts: Array<{ id: string; libelle: string; typeCompte: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.libelle} · {account.typeCompte === "CAISSE" ? "Caisse" : "Banque"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function operationTypeLabel(type: TreasuryOperation["typeOperation"]) {
  const labels: Record<TreasuryOperation["typeOperation"], string> = {
    TRANSFERT: "Transfert",
    AJUSTEMENT: "Correction",
    ANNULATION_TRANSFERT: "Annulation de transfert",
    ANNULATION_AJUSTEMENT: "Annulation de correction",
  };
  return labels[type];
}
