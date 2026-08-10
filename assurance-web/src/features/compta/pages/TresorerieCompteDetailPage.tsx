import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Landmark,
  List,
  LockKeyhole,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableRowsSkeleton } from "@/components/shared";
import { comptaApi } from "../api";
import { formatTreasuryDate, formatTreasuryMoney } from "./treasury-format";

export default function TresorerieCompteDetailPage() {
  const { accountId = "" } = useParams();
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const movements = useQuery({
    queryKey: ["compta", "treasury", "movements", accountId, "detail"],
    queryFn: () => comptaApi.treasuryJournal({
      compteId: accountId,
      page: 0,
      size: 10,
    }),
    enabled: Boolean(accountId),
  });
  const operations = useQuery({
    queryKey: ["compta", "treasury-operations", accountId, "detail"],
    queryFn: () => comptaApi.treasuryOperations({
      compteId: accountId,
      page: 0,
      size: 5,
    }),
    enabled: Boolean(accountId),
  });
  const sessions = useQuery({
    queryKey: ["compta", "cash-sessions"],
    queryFn: comptaApi.cashSessions,
  });
  const account = accounts.data?.find((item) => item.id === accountId);

  if (!accounts.isLoading && !account) {
    return (
      <div className="grid justify-items-start gap-4 rounded-md border border-dashed p-8">
        <p className="text-sm text-muted-foreground">Ce compte est introuvable ou ne vous est pas affecté.</p>
        <Button variant="outline" asChild>
          <Link to="/app/compta/tresorerie/comptes">Retour aux comptes</Link>
        </Button>
      </div>
    );
  }

  const accountSessions = (sessions.data ?? []).filter(
    (item) => item.compteTresorerieId === accountId
  );
  const openSession = accountSessions.find((item) => item.statut === "OUVERTE");

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button variant="link" className="mb-2 h-auto p-0" asChild>
            <Link to="/app/compta/tresorerie/comptes">
              <ArrowLeft className="size-4" />
              Caisses et banques
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            {account?.typeCompte === "CAISSE"
              ? <WalletCards className="size-6" />
              : <Landmark className="size-6" />}
            <div>
              <h1 className="text-xl font-semibold">{account?.libelle ?? "Compte de trésorerie"}</h1>
              <p className="text-sm text-muted-foreground">{account?.code}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/app/compta/tresorerie/journal?compteId=${accountId}`}>
              <List className="size-4" />
              Journal complet
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/app/compta/tresorerie/operations?compteId=${accountId}`}>
              <ArrowRightLeft className="size-4" />
              Transférer ou ajuster
            </Link>
          </Button>
          {account?.typeCompte === "CAISSE" && (
            <Button variant="outline" asChild>
              <Link to={`/app/compta/tresorerie/sessions-caisse?compteId=${accountId}`}>
                <LockKeyhole className="size-4" />
                Sessions de caisse
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary
          label="Solde comptable"
          value={account ? formatTreasuryMoney(account.soldeCourant) : "-"}
        />
        <Summary
          label="Type"
          value={account?.typeCompte === "CAISSE" ? "Caisse" : "Compte bancaire"}
        />
        <Summary label="Banque" value={account?.nomBanque || "-"} />
        <div className="rounded-md border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Statut</div>
          <Badge className="mt-2" variant={account?.actif ? "default" : "secondary"}>
            {account?.actif ? "Actif" : "Inactif"}
          </Badge>
        </div>
      </section>

      {account?.typeCompte === "CAISSE" && (
        <section className="rounded-md border bg-card p-4">
          <h2 className="font-semibold">Session actuelle</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {openSession
              ? `Ouverte par ${openSession.utilisateur}`
              : "Aucune session ouverte sur cette caisse."}
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Derniers mouvements</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead className="text-right">Entrée</TableHead>
              <TableHead className="text-right">Sortie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.isLoading ? <TableRowsSkeleton colSpan={5} rows={5} /> : (movements.data?.rows ?? []).map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>{formatTreasuryDate(movement.dateOperation)}</TableCell>
                <TableCell className="font-medium">{movement.libelle}</TableCell>
                <TableCell>{movement.reference || movement.numeroOperationTresorerie || "-"}</TableCell>
                <TableCell className="text-right text-emerald-700">
                  {movement.sens === "ENTREE" ? (
                    <span className="inline-flex items-center gap-1">
                      <ArrowDownLeft className="size-4" />
                      {formatTreasuryMoney(movement.montant)}
                    </span>
                  ) : "-"}
                </TableCell>
                <TableCell className="text-right text-red-700">
                  {movement.sens === "SORTIE" ? (
                    <span className="inline-flex items-center gap-1">
                      <ArrowUpRight className="size-4" />
                      {formatTreasuryMoney(movement.montant)}
                    </span>
                  ) : "-"}
                </TableCell>
              </TableRow>
            ))}
            {!movements.isLoading && (movements.data?.rows.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Aucun mouvement enregistré.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Dernières opérations internes</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° opération</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Motif</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(operations.data?.rows ?? []).map((operation) => (
              <TableRow key={operation.id}>
                <TableCell className="font-medium">{operation.numero}</TableCell>
                <TableCell>{formatTreasuryDate(operation.dateOperation)}</TableCell>
                <TableCell>{operation.motif}</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatTreasuryMoney(operation.montant)}
                </TableCell>
                <TableCell>
                  {operation.statut === "ANNULEE" ? "Annulée" : "Confirmée"}
                </TableCell>
              </TableRow>
            ))}
            {!operations.isLoading && (operations.data?.rows.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Aucune opération interne enregistrée.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
