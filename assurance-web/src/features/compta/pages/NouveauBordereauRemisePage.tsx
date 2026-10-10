import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Banknote, FileClock, Plus, ReceiptText } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { TableRowsSkeleton } from "@/components/shared";
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
import { MoneyInput } from "@/features/production/components/MoneyInput";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { RemittanceSlipType } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY } from "./treasury-format";

export default function NouveauBordereauRemisePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const requestedType = searchParams.get("type");
  const initialType: RemittanceSlipType | "" = isSlipType(requestedType) ? requestedType : "";
  const selectedIds = useMemo(() => [...new Set(
    (searchParams.get("instrumentIds") ?? "").split(",").filter((id) => /^\d+$/.test(id))
  )], [searchParams]);
  const [type, setType] = useState<RemittanceSlipType | "">(initialType);
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [cashAmount, setCashAmount] = useState<number>();
  const [slipDate, setSlipDate] = useState(TODAY);
  const [notes, setNotes] = useState("");
  const [creationDialogOpen, setCreationDialogOpen] = useState(false);

  const instrumentType = type === "CHEQUE" || type === "EFFET";
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const selectedInstruments = useQuery({
    queryKey: ["compta", "treasury", "remittance-selection", type, selectedIds],
    queryFn: () => comptaApi.selectedEligibleRemittanceInstruments(
      type as "CHEQUE" | "EFFET",
      selectedIds
    ),
    enabled: instrumentType && selectedIds.length > 0,
  });

  const bankAccounts = useMemo(() => (accounts.data ?? []).filter(
    (account) => account.actif && account.typeCompte === "BANQUE"
  ), [accounts.data]);
  const cashAccounts = useMemo(() => (accounts.data ?? []).filter(
    (account) => account.actif && account.typeCompte === "CAISSE"
  ), [accounts.data]);
  const selectedTotal = (selectedInstruments.data ?? [])
    .reduce((sum, instrument) => sum + instrument.montant, 0);
  const selectionValid = instrumentType
    && selectedIds.length > 0
    && selectedInstruments.data?.length === selectedIds.length;

  useEffect(() => {
    if (bankAccounts.length === 1) {
      setDestinationId(bankAccounts[0].id);
      return;
    }
    if (destinationId && !bankAccounts.some((account) => account.id === destinationId)) {
      setDestinationId("");
    }
  }, [bankAccounts, destinationId]);

  const createSlip = useMutation({
    mutationFn: () => {
      if (!type) throw new Error("Choisissez un type de bordereau");
      if (!destinationId) throw new Error("Aucun compte bancaire de destination n’est sélectionné");
      if (type !== "VERSEMENT_ESPECES" && !selectionValid) {
        throw new Error("Sélectionnez les instruments depuis les encaissements en attente");
      }
      return type === "VERSEMENT_ESPECES"
        ? comptaApi.createRemittanceSlip({
            type,
            dateBordereau: slipDate,
            compteSourceId: sourceId,
            compteDestinationId: destinationId,
            montantEspeces: cashAmount,
            notes: notes.trim() || undefined,
            instrumentIds: [],
          })
        : comptaApi.createRemittanceSlip({
            type,
            dateBordereau: slipDate,
            compteDestinationId: destinationId,
            notes: notes.trim() || undefined,
            instrumentIds: selectedIds,
          });
    },
    onSuccess: async (created) => {
      toast.success(`${created.numero} créé`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
      ]);
      navigate(`/app/compta/tresorerie/bordereaux-remise/${created.id}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });

  function changeType(nextType: RemittanceSlipType) {
    setCreationDialogOpen(false);
    setType(nextType);
    setSearchParams({ type: nextType }, { replace: true });
  }

  const returnUrl = instrumentType
    ? `/app/compta/tresorerie/encaissements-en-attente?mode=${type}`
    : "/app/compta/tresorerie/bordereaux-remise";

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" className="mb-2 -ml-3">
            <Link to={returnUrl}><ArrowLeft className="size-4" /> Retour</Link>
          </Button>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">Nouveau bordereau</h1>
          <p className="text-sm text-muted-foreground">Préparez une remise bancaire ou un versement d’espèces.</p>
        </div>
        <div className="w-full lg:w-auto">
          <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Type de bordereau</Label>
          <div className="grid grid-cols-1 gap-1 rounded-md border bg-muted/20 p-1 sm:grid-cols-3 lg:min-w-[620px]">
            <Button type="button" size="sm" variant="ghost" className={type === "CHEQUE" ? "justify-start bg-sky-100 text-sky-900 shadow-sm hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-100" : "justify-start"} onClick={() => changeType("CHEQUE")}>
              <ReceiptText className="size-4" /> Chèques
            </Button>
            <Button type="button" size="sm" variant="ghost" className={type === "EFFET" ? "justify-start bg-violet-100 text-violet-900 shadow-sm hover:bg-violet-100 dark:bg-violet-950/60 dark:text-violet-100" : "justify-start"} onClick={() => changeType("EFFET")}>
              <FileClock className="size-4" /> Effets
            </Button>
            <Button type="button" size="sm" variant="ghost" className={type === "VERSEMENT_ESPECES" ? "justify-start bg-emerald-100 text-emerald-900 shadow-sm hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-100" : "justify-start"} onClick={() => changeType("VERSEMENT_ESPECES")}>
              <Banknote className="size-4" /> Versement d’espèces
            </Button>
          </div>
        </div>
      </header>

      {instrumentType && selectedIds.length === 0 ? (
        <section className="rounded-md border bg-card p-8 text-center">
          <h2 className="font-semibold">Aucun instrument sélectionné</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sélectionnez les {type === "CHEQUE" ? "chèques" : "effets"} à regrouper depuis les encaissements en attente.
          </p>
          <Button asChild className="mt-4"><Link to={returnUrl}>Sélectionner les instruments</Link></Button>
        </section>
      ) : type ? (
        <section className="overflow-hidden rounded-md border bg-card">
          {type === "VERSEMENT_ESPECES" && (
            <div className="border-b p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-5 w-1 rounded-sm bg-emerald-500" />
                <h2 className="font-semibold">Détails du versement</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Caisse source</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger><SelectValue placeholder="Choisir une caisse" /></SelectTrigger>
                    <SelectContent>{cashAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <DestinationAccountField
                  accounts={bankAccounts}
                  loading={accounts.isLoading}
                  value={destinationId}
                  onChange={setDestinationId}
                />
                <div className="grid gap-2">
                  <Label htmlFor="cash-amount">Montant</Label>
                  <MoneyInput id="cash-amount" value={cashAmount} onValueChange={setCashAmount} />
                </div>
                <div className="grid gap-2">
                  <Label>Date du bordereau</Label>
                  <DatePicker date={slipDate} onSelect={(value) => setSlipDate(toDateOnly(value) ?? "")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slip-notes">Notes <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
                  <Input id="slip-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
                </div>
              </div>
            </div>
          )}

          {instrumentType && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <h2 className="font-semibold">Instruments sélectionnés</h2>
                  <p className="text-sm text-muted-foreground">{selectedInstruments.data?.length ?? 0} instrument(s) · {formatTreasuryMoney(selectedTotal)}</p>
                </div>
                <Button asChild variant="outline"><Link to={returnUrl}>Modifier la sélection</Link></Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className={type === "CHEQUE" ? "bg-sky-700 text-xs uppercase text-white" : "bg-violet-700 text-xs uppercase text-white"}><tr>
                    <th className="px-4 py-3 text-left">Référence</th><th className="px-4 py-3 text-left">Payeur</th>
                    <th className="px-4 py-3 text-left">Règlement</th><th className="px-4 py-3 text-left">Mode</th>
                    <th className="px-4 py-3 text-left">Reçu le</th><th className="px-4 py-3 text-left">Échéance</th>
                    <th className="px-4 py-3 text-left">Banque émettrice</th><th className="px-4 py-3 text-right">Montant</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {selectedInstruments.isLoading ? <TableRowsSkeleton colSpan={8} rows={4} /> : (selectedInstruments.data ?? []).map((instrument) => (
                      <tr key={instrument.id}>
                        <td className="px-4 py-3 font-semibold">{instrument.referenceInstrument || "-"}</td>
                        <td className="px-4 py-3">{instrument.payeurNom}</td>
                        <td className="px-4 py-3">{instrument.numeroReglement}</td>
                        <td className="px-4 py-3">{paymentModeLabel(instrument.mode)}</td>
                        <td className="px-4 py-3">{formatTreasuryDate(instrument.dateInstrument)}</td>
                        <td className="px-4 py-3">{formatTreasuryDate(instrument.dateEcheance)}</td>
                        <td className="px-4 py-3">{instrument.banqueEmettrice || "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(instrument.montant)}</td>
                      </tr>
                    ))}
                    {selectedInstruments.isError && (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-destructive">
                        {selectedInstruments.error instanceof Error ? selectedInstruments.error.message : "Sélection invalide"}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end p-4">
                <Button disabled={!canManage || !selectionValid} onClick={() => setCreationDialogOpen(true)}>
                  <Plus className="size-4" /> Créer le bordereau
                </Button>
              </div>
            </>
          )}

          {type === "VERSEMENT_ESPECES" && (
            <div className="flex justify-end bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
              <Button className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={!canManage || !sourceId || !destinationId || !cashAmount || cashAmount <= 0 || !slipDate || createSlip.isPending} onClick={() => createSlip.mutate()}>
                <Banknote className="size-4" /> Créer le bordereau
              </Button>
            </div>
          )}
        </section>
      ) : null}

      <Dialog open={creationDialogOpen} onOpenChange={setCreationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer le bordereau de {type === "EFFET" ? "remise d’effets" : "remise de chèques"}</DialogTitle>
            <DialogDescription>
              Confirmez les informations du bordereau pour {selectedIds.length} instrument(s), soit {formatTreasuryMoney(selectedTotal)}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <DestinationAccountField
              accounts={bankAccounts}
              loading={accounts.isLoading}
              value={destinationId}
              onChange={setDestinationId}
            />
            <div className="grid gap-2">
              <Label>Date du bordereau</Label>
              <DatePicker date={slipDate} onSelect={(value) => setSlipDate(toDateOnly(value) ?? "")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slip-dialog-notes">Notes <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
              <Input id="slip-dialog-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={createSlip.isPending} onClick={() => setCreationDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!selectionValid || !destinationId || !slipDate || createSlip.isPending} onClick={() => createSlip.mutate()}>
              <Plus className="size-4" />
              {createSlip.isPending ? "Création..." : "Créer le bordereau"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DestinationAccountField({ accounts, loading, value, onChange }: {
  accounts: Array<{ id: string; libelle: string }>;
  loading: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  if (loading) {
    return <div className="grid gap-2"><Label>Compte bancaire de destination</Label><div className="flex min-h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">Chargement...</div></div>;
  }
  if (accounts.length === 0) {
    return <div className="grid gap-2"><Label>Compte bancaire de destination</Label><div className="flex min-h-9 items-center rounded-md border border-destructive/50 bg-destructive/5 px-3 text-sm text-destructive">Aucun compte bancaire actif disponible</div></div>;
  }
  if (accounts.length === 1) {
    return null;
  }
  return <div className="grid gap-2"><Label>Compte bancaire de destination</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Choisir un compte" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>)}</SelectContent></Select></div>;
}

function isSlipType(value: string | null): value is RemittanceSlipType {
  return value === "CHEQUE" || value === "EFFET" || value === "VERSEMENT_ESPECES";
}
