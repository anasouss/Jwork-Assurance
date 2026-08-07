import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Plus,
  RotateCcw,
  Search,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { PaymentInstrument, TreasuryAccountType, UpsertTreasuryAccountRequest } from "../types";

const today = new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 25;

export default function TresoreriePage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const queryClient = useQueryClient();
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountType, setAccountType] = useState<TreasuryAccountType>("CAISSE");
  const [accountCode, setAccountCode] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [bankName, setBankName] = useState("");
  const [rib, setRib] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [activeInstrument, setActiveInstrument] = useState<PaymentInstrument>();
  const [action, setAction] = useState<"CONFIRME" | "REJETE">("CONFIRME");
  const [accountId, setAccountId] = useState("");
  const [operationDate, setOperationDate] = useState(today);
  const [reason, setReason] = useState("");
  const [instrumentSearch, setInstrumentSearch] = useState("");
  const [movementPage, setMovementPage] = useState(0);
  const [movementSearch, setMovementSearch] = useState("");
  const [appliedMovementSearch, setAppliedMovementSearch] = useState("");
  const [movementAccountId, setMovementAccountId] = useState("ALL");
  const [movementDateFrom, setMovementDateFrom] = useState("");
  const [movementDateTo, setMovementDateTo] = useState("");

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const instruments = useQuery({
    queryKey: ["compta", "treasury", "pending-instruments"],
    queryFn: comptaApi.pendingPaymentInstruments,
  });
  const movements = useQuery({
    queryKey: [
      "compta",
      "treasury",
      "movements",
      movementAccountId,
      movementDateFrom,
      movementDateTo,
      appliedMovementSearch,
      movementPage,
    ],
    queryFn: () => comptaApi.treasuryJournal({
      compteId: movementAccountId === "ALL" ? undefined : movementAccountId,
      dateDu: movementDateFrom || undefined,
      dateAu: movementDateTo || undefined,
      search: appliedMovementSearch || undefined,
      page: movementPage,
      size: PAGE_SIZE,
    }),
  });

  const createAccount = useMutation({
    mutationFn: () => comptaApi.createTreasuryAccount({
      code: accountCode,
      libelle: accountLabel,
      typeCompte: accountType,
      nomBanque: bankName || undefined,
      rib: rib || undefined,
      soldeInitial: Number(initialBalance.replace(",", ".")) || 0,
      actif: true,
    } satisfies UpsertTreasuryAccountRequest),
    onSuccess: async () => {
      toast.success("Compte de trésorerie créé");
      setAccountOpen(false);
      setAccountCode("");
      setAccountLabel("");
      setBankName("");
      setRib("");
      setInitialBalance("0");
      await queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });

  const changeStatus = useMutation({
    mutationFn: () => comptaApi.changePaymentInstrumentStatus(activeInstrument!.id, {
      statut: action,
      compteTresorerieId: action === "CONFIRME" ? accountId : undefined,
      dateOperation: operationDate,
      motif: reason.trim() || undefined,
    }),
    onSuccess: async () => {
      toast.success(action === "CONFIRME" ? "Encaissement confirmé" : "Instrument rejeté");
      setActiveInstrument(undefined);
      setAccountId("");
      setReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Opération impossible"),
  });

  const bankAccounts = (accounts.data ?? []).filter(
    (account) => account.actif && account.typeCompte === "BANQUE"
  );
  const filteredInstruments = (instruments.data ?? []).filter((instrument) => {
    const term = instrumentSearch.trim().toLocaleLowerCase("fr");
    if (!term) {
      return true;
    }
    return [
      instrument.numeroReglement,
      instrument.payeurNom,
      instrument.referenceInstrument,
      instrument.banqueEmettrice,
    ].some((value) => value?.toLocaleLowerCase("fr").includes(term));
  });

  return (
    <div className="grid gap-5">
      <header>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
        <h1 className="mt-1 text-xl font-semibold">Trésorerie</h1>
        <p className="text-sm text-muted-foreground">
          Caisses, banques, instruments à encaisser et journal des mouvements.
        </p>
      </header>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Comptes</TabsTrigger>
          <TabsTrigger value="instruments">
            Chèques et effets ({instruments.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="movements">Mouvements</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="grid gap-4">
          <div className="flex justify-end">
            <Button disabled={!canManage} onClick={() => setAccountOpen(true)}>
              <Plus className="size-4" />
              Ajouter un compte
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(accounts.data ?? []).map((account) => (
              <article key={account.id} className="border-y bg-card px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {account.typeCompte === "CAISSE"
                      ? <WalletCards className="size-5" />
                      : <Landmark className="size-5" />}
                    <div>
                      <h2 className="font-semibold">{account.libelle}</h2>
                      <p className="text-xs text-muted-foreground">
                        {account.code}
                        {account.nomBanque ? ` · ${account.nomBanque}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant={account.actif ? "default" : "secondary"}>
                    {account.actif ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <div className="mt-5 text-2xl font-semibold">{money(account.soldeCourant)}</div>
                <div className="text-xs text-muted-foreground">Solde comptable</div>
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="instruments">
          <div className="flex flex-wrap items-end gap-3 border-y bg-card px-4 py-4">
            <div className="min-w-72 flex-1">
              <Label htmlFor="instrument-search">Payeur, règlement ou référence</Label>
              <Input
                id="instrument-search"
                value={instrumentSearch}
                onChange={(event) => setInstrumentSearch(event.target.value)}
              />
            </div>
          </div>
          <section className="overflow-x-auto border-y bg-card">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-orange-600 text-xs uppercase text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Règlement</th>
                  <th className="px-4 py-3 text-left">Payeur</th>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-left">Référence</th>
                  <th className="px-4 py-3 text-left">Échéance</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {instruments.isLoading ? (
                  <TableRowsSkeleton colSpan={7} rows={6} />
                ) : filteredInstruments.map((instrument) => (
                  <tr key={instrument.id}>
                    <td className="px-4 py-3 font-semibold">{instrument.numeroReglement}</td>
                    <td className="px-4 py-3">{instrument.payeurNom}</td>
                    <td className="px-4 py-3">{mode(instrument.mode)}</td>
                    <td className="px-4 py-3">{instrument.referenceInstrument || "-"}</td>
                    <td className="px-4 py-3">{date(instrument.dateEcheance || instrument.dateInstrument)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(instrument.montant)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={!canManage}
                          onClick={() => {
                            setAction("CONFIRME");
                            setActiveInstrument(instrument);
                          }}
                        >
                          Confirmer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canManage}
                          onClick={() => {
                            setAction("REJETE");
                            setActiveInstrument(instrument);
                          }}
                        >
                          Rejeter
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </TabsContent>

        <TabsContent value="movements">
          <section className="grid gap-3 border-y bg-card px-4 py-4 lg:grid-cols-5">
            <div>
              <Label>Compte</Label>
              <Select
                value={movementAccountId}
                onValueChange={(value) => {
                  setMovementAccountId(value);
                  setMovementPage(0);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les comptes</SelectItem>
                  {(accounts.data ?? []).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date du</Label>
              <Input
                type="date"
                value={movementDateFrom}
                onChange={(event) => {
                  setMovementDateFrom(event.target.value);
                  setMovementPage(0);
                }}
              />
            </div>
            <div>
              <Label>Date au</Label>
              <Input
                type="date"
                value={movementDateTo}
                onChange={(event) => {
                  setMovementDateTo(event.target.value);
                  setMovementPage(0);
                }}
              />
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="movement-search">Libellé, référence ou règlement</Label>
              <div className="flex gap-2">
                <Input
                  id="movement-search"
                  value={movementSearch}
                  onChange={(event) => setMovementSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setAppliedMovementSearch(movementSearch.trim());
                      setMovementPage(0);
                    }
                  }}
                />
                <Button
                  size="icon"
                  title="Rechercher"
                  onClick={() => {
                    setAppliedMovementSearch(movementSearch.trim());
                    setMovementPage(0);
                  }}
                >
                  <Search className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  title="Réinitialiser"
                  onClick={() => {
                    setMovementSearch("");
                    setAppliedMovementSearch("");
                    setMovementAccountId("ALL");
                    setMovementDateFrom("");
                    setMovementDateTo("");
                    setMovementPage(0);
                  }}
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            </div>
          </section>
          <section className="overflow-x-auto border-y bg-card">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-orange-600 text-xs uppercase text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Compte</th>
                  <th className="px-4 py-3 text-left">Libellé</th>
                  <th className="px-4 py-3 text-left">Référence</th>
                  <th className="px-4 py-3 text-right">Entrée</th>
                  <th className="px-4 py-3 text-right">Sortie</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.isLoading ? (
                  <TableRowsSkeleton colSpan={6} rows={8} />
                ) : (movements.data?.rows ?? []).map((movement) => (
                  <tr key={movement.id}>
                    <td className="px-4 py-3">{date(movement.dateOperation)}</td>
                    <td className="px-4 py-3 font-semibold">{movement.compteTresorerie}</td>
                    <td className="px-4 py-3">{movement.libelle}</td>
                    <td className="px-4 py-3">{movement.reference || "-"}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">
                      {movement.sens === "ENTREE" ? (
                        <span className="inline-flex items-center gap-1">
                          <ArrowDownLeft className="size-4" />
                          {money(movement.montant)}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-red-700">
                      {movement.sens === "SORTIE" ? (
                        <span className="inline-flex items-center gap-1">
                          <ArrowUpRight className="size-4" />
                          {money(movement.montant)}
                        </span>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {movements.data && (
            <ServerPagination
              page={movements.data.page.number}
              totalPages={movements.data.page.totalPages}
              totalElements={movements.data.page.totalElements}
              loading={movements.isFetching}
              onPageChange={setMovementPage}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un compte</DialogTitle>
            <DialogDescription>
              Créez une caisse ou un compte bancaire pour l’agence.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={accountType}
                onValueChange={(value) => setAccountType(value as TreasuryAccountType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAISSE">Caisse</SelectItem>
                  <SelectItem value="BANQUE">Banque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Code</Label>
                <Input
                  value={accountCode}
                  onChange={(event) => setAccountCode(event.target.value)}
                />
              </div>
              <div>
                <Label>Libellé</Label>
                <Input
                  value={accountLabel}
                  onChange={(event) => setAccountLabel(event.target.value)}
                />
              </div>
            </div>
            {accountType === "BANQUE" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Banque</Label>
                  <Input value={bankName} onChange={(event) => setBankName(event.target.value)} />
                </div>
                <div>
                  <Label>RIB</Label>
                  <Input value={rib} onChange={(event) => setRib(event.target.value)} />
                </div>
              </div>
            )}
            <div>
              <Label>Solde initial</Label>
              <Input
                type="number"
                step="0.01"
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!accountCode.trim() || !accountLabel.trim() || createAccount.isPending}
              onClick={() => createAccount.mutate()}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(activeInstrument)}
        onOpenChange={(open) => !open && setActiveInstrument(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "CONFIRME" ? "Confirmer l’encaissement" : "Rejeter l’instrument"}
            </DialogTitle>
            <DialogDescription>
              {activeInstrument?.numeroReglement} · {money(activeInstrument?.montant ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Date d’opération</Label>
              <Input
                type="date"
                value={operationDate}
                onChange={(event) => setOperationDate(event.target.value)}
              />
            </div>
            {action === "CONFIRME" && (
              <div>
                <Label>Compte bancaire crédité</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un compte" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.libelle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{action === "REJETE" ? "Motif du rejet" : "Observation"}</Label>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveInstrument(undefined)}>
              Annuler
            </Button>
            <Button
              variant={action === "REJETE" ? "destructive" : "default"}
              disabled={changeStatus.isPending
                || (action === "CONFIRME" ? !accountId : !reason.trim())}
              onClick={() => changeStatus.mutate()}
            >
              {action === "CONFIRME" ? "Confirmer" : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function date(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}

function mode(value: PaymentInstrument["mode"]) {
  const labels = {
    ESPECES: "Espèces",
    CHEQUE: "Chèque",
    EFFET: "Effet",
    VIREMENT: "Virement",
    VERSEMENT_BANCAIRE: "Versement bancaire",
    CARTE: "Carte",
    PRELEVEMENT: "Prélèvement",
  } as const;
  return labels[value];
}
