import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Landmark, Plus, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type {
  TreasuryAccount,
  TreasuryAccountType,
  UpsertTreasuryAccountRequest,
} from "../types";
import { formatTreasuryMoney } from "./treasury-format";

export default function TresorerieComptesPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TreasuryAccount>();
  const [accountType, setAccountType] = useState<TreasuryAccountType>("CAISSE");
  const [accountCode, setAccountCode] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [bankName, setBankName] = useState("");
  const [rib, setRib] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [accountActive, setAccountActive] = useState(true);

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });

  const saveAccount = useMutation({
    mutationFn: () => {
      const request = {
        code: accountCode,
        libelle: accountLabel,
        typeCompte: accountType,
        nomBanque: bankName || undefined,
        rib: rib || undefined,
        soldeInitial: Number(initialBalance.replace(",", ".")) || 0,
        actif: accountActive,
      } satisfies UpsertTreasuryAccountRequest;

      return editingAccount
        ? comptaApi.updateTreasuryAccount(editingAccount.id, request)
        : comptaApi.createTreasuryAccount(request);
    },
    onSuccess: async () => {
      toast.success(editingAccount
        ? "Compte de trésorerie modifié"
        : "Compte de trésorerie créé");
      closeDialog();
      await queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] });
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Enregistrement impossible"
    ),
  });

  function openNewAccount() {
    setEditingAccount(undefined);
    setAccountType("CAISSE");
    setAccountCode("");
    setAccountLabel("");
    setBankName("");
    setRib("");
    setInitialBalance("0");
    setAccountActive(true);
    setDialogOpen(true);
  }

  function openAccount(account: TreasuryAccount) {
    setEditingAccount(account);
    setAccountType(account.typeCompte);
    setAccountCode(account.code);
    setAccountLabel(account.libelle);
    setBankName(account.nomBanque ?? "");
    setRib(account.rib ?? "");
    setInitialBalance(String(account.soldeInitial));
    setAccountActive(account.actif);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingAccount(undefined);
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">
            Trésorerie
          </div>
          <h1 className="mt-1 text-xl font-semibold">Caisses et banques</h1>
          <p className="text-sm text-muted-foreground">
            Comptes de trésorerie et soldes comptables de l’agence.
          </p>
        </div>
        <Button disabled={!canManage} onClick={openNewAccount}>
          <Plus className="size-4" />
          Ajouter un compte
        </Button>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(accounts.data ?? []).map((account) => (
          <article key={account.id} className="rounded-md border bg-card p-4">
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
              <div className="flex items-center gap-1">
                <Badge variant={account.actif ? "default" : "secondary"}>
                  {account.actif ? "Actif" : "Inactif"}
                </Badge>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Modifier le compte"
                    onClick={() => openAccount(account)}
                  >
                    <Edit3 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold">
                  {formatTreasuryMoney(account.soldeCourant)}
                </div>
                <div className="text-xs text-muted-foreground">Solde comptable</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{account.typeCompte === "CAISSE" ? "Caisse" : "Compte bancaire"}</div>
                {account.rib && <div>{account.rib}</div>}
              </div>
            </div>
          </article>
        ))}
        {!accounts.isLoading && (accounts.data?.length ?? 0) === 0 && (
          <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Aucun compte de trésorerie n’est configuré.
          </div>
        )}
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Modifier le compte" : "Ajouter un compte"}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? `${editingAccount.code} · ${editingAccount.libelle}`
                : "Créez une caisse ou un compte bancaire pour l’agence."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={accountType}
                disabled={Boolean(editingAccount)}
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
                <Input value={accountCode} onChange={(event) => setAccountCode(event.target.value)} />
              </div>
              <div>
                <Label>Libellé</Label>
                <Input value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} />
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
                inputMode="decimal"
                disabled={Boolean(editingAccount)}
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
              />
              {editingAccount && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Le solde initial est figé après la création du compte.
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={accountActive}
                onCheckedChange={(value) => setAccountActive(value === true)}
              />
              Compte actif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annuler</Button>
            <Button
              disabled={!accountCode.trim() || !accountLabel.trim() || saveAccount.isPending}
              onClick={() => saveAccount.mutate()}
            >
              {editingAccount ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
