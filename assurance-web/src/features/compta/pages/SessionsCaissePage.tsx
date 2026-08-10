import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Play, Square } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { TableRowsSkeleton } from "@/components/shared";
import { comptaApi } from "../api";
import { parseAccountingAmount } from "../format";
import type { CashSession } from "../types";
import { formatTreasuryMoney } from "./treasury-format";

export default function SessionsCaissePage() {
  const [searchParams] = useSearchParams();
  const initialAccountId = searchParams.get("compteId") || "";
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [cashAccountId, setCashAccountId] = useState(initialAccountId);
  const [countedAmount, setCountedAmount] = useState("");
  const [note, setNote] = useState("");
  const [sessionToClose, setSessionToClose] = useState<CashSession>();

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const sessions = useQuery({
    queryKey: ["compta", "cash-sessions"],
    queryFn: comptaApi.cashSessions,
  });

  const openSession = useMutation({
    mutationFn: () => comptaApi.openCashSession({
      compteTresorerieId: cashAccountId,
      montantCompte: parseAccountingAmount(countedAmount),
      note: note.trim() || undefined,
    }),
    onSuccess: async () => {
      toast.success("Caisse ouverte");
      resetDialog();
      await queryClient.invalidateQueries({ queryKey: ["compta", "cash-sessions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Ouverture impossible"),
  });

  const closeSession = useMutation({
    mutationFn: () => comptaApi.closeCashSession(sessionToClose!.id, {
      montantCompte: parseAccountingAmount(countedAmount),
      note: note.trim() || undefined,
    }),
    onSuccess: async () => {
      toast.success("Caisse clôturée");
      resetDialog();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "cash-sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury-accounts"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Clôture impossible"),
  });

  function resetDialog() {
    setOpenDialog(false);
    setSessionToClose(undefined);
    setCashAccountId(initialAccountId);
    setCountedAmount("");
    setNote("");
  }

  function beginClose(session: CashSession) {
    setSessionToClose(session);
    setCountedAmount("");
    setNote("");
  }

  const cashAccounts = (accounts.data ?? []).filter((account) =>
    account.typeCompte === "CAISSE" && account.actif
  );
  const dialogVisible = openDialog || Boolean(sessionToClose);
  const visibleSessions = (sessions.data ?? []).filter(
    (session) => !initialAccountId || session.compteTresorerieId === initialAccountId
  );

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">Ouverture et clôture de caisse</h1>
          <p className="text-sm text-muted-foreground">
            Ouverture, comptage et clôture quotidienne des caisses affectées.
          </p>
        </div>
        <Button onClick={() => setOpenDialog(true)}>
          <Play className="size-4" /> Ouvrir la caisse
        </Button>
      </header>

      <section className="overflow-hidden rounded-md border bg-card">
        {sessions.isLoading || visibleSessions.length > 0 ? (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Caisse</TableHead>
                <TableHead>Caissier</TableHead>
                <TableHead>Ouverture</TableHead>
                <TableHead>Clôture</TableHead>
                <TableHead className="text-right">Montant d'ouverture</TableHead>
                <TableHead className="text-right">Écart de clôture</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.isLoading ? <TableRowsSkeleton colSpan={8} rows={4} /> : visibleSessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-semibold">{session.compteTresorerie}</TableCell>
                <TableCell>{session.utilisateur}</TableCell>
                <TableCell>{formatDateTime(session.ouverteLe)}</TableCell>
                <TableCell>{session.fermeeLe ? formatDateTime(session.fermeeLe) : "-"}</TableCell>
                <TableCell className="text-right">{formatTreasuryMoney(session.montantOuverture)}</TableCell>
                <TableCell className="text-right">
                  {session.ecartCloture == null ? "-" : formatTreasuryMoney(session.ecartCloture)}
                </TableCell>
                <TableCell>
                  <Badge variant={session.statut === "OUVERTE" ? "default" : "secondary"}>
                    {session.statut === "OUVERTE" ? "Ouverte" : "Clôturée"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {session.statut === "OUVERTE" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Clôturer la caisse"
                      onClick={() => beginClose(session)}
                    >
                      <Square className="size-4" />
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
              <LockKeyhole className="size-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Aucune activité de caisse</div>
              <p className="text-sm">Ouvrez la caisse pour commencer la journée et enregistrer son comptage.</p>
            </div>
          </div>
        )}
      </section>

      <Dialog open={dialogVisible} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sessionToClose ? "Clôturer la caisse" : "Ouvrir la caisse"}
            </DialogTitle>
            <DialogDescription>
              {sessionToClose
                ? `${sessionToClose.compteTresorerie} · ${sessionToClose.utilisateur}`
                : "Le montant compté est comparé au solde comptable de la caisse."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {!sessionToClose && (
              <div className="grid gap-2">
                <Label>Caisse</Label>
                <Select value={cashAccountId} onValueChange={setCashAccountId}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {cashAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="cash-counted-amount">Montant compté *</Label>
              <Input
                id="cash-counted-amount"
                inputMode="decimal"
                value={countedAmount}
                onChange={(event) => setCountedAmount(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cash-session-note">Note</Label>
              <Textarea id="cash-session-note" value={note} onChange={(event) => setNote(event.target.value)} />
              <p className="text-xs text-muted-foreground">
                Une justification est obligatoire lorsqu'un écart est constaté.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Annuler</Button>
            <Button
              disabled={
                (!sessionToClose && !cashAccountId)
                || countedAmount.trim() === ""
                || openSession.isPending
                || closeSession.isPending
              }
              onClick={() => sessionToClose ? closeSession.mutate() : openSession.mutate()}
            >
              {sessionToClose ? <LockKeyhole className="size-4" /> : <Play className="size-4" />}
              {sessionToClose ? "Clôturer" : "Ouvrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-MA", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
