import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CircleDollarSign,
  Landmark,
  List,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
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
          <Button variant={account?.typeCompte === "CAISSE" ? "outline" : "default"} asChild>
            <Link to={`/app/compta/tresorerie/operations?compteId=${accountId}`}>
              <ArrowRightLeft className="size-4" />
              Transférer ou corriger
            </Link>
          </Button>
          {account?.typeCompte === "CAISSE" && (
            <Button asChild>
              <Link to={`/app/compta/tresorerie/sessions-caisse?compteId=${accountId}`}>
                <LockKeyhole className="size-4" />
                {openSession ? "Clôturer la caisse" : "Ouvrir la caisse"}
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary
          label="Solde comptable"
          value={account ? formatTreasuryMoney(account.soldeCourant) : "-"}
          icon={<CircleDollarSign className="size-4" />}
          tone={Number(account?.soldeCourant ?? 0) < 0 ? "red" : "emerald"}
        />
        <Summary
          label="Type"
          value={account?.typeCompte === "CAISSE" ? "Caisse" : "Compte bancaire"}
          icon={account?.typeCompte === "CAISSE"
            ? <WalletCards className="size-4" />
            : <Landmark className="size-4" />}
          tone={account?.typeCompte === "CAISSE" ? "amber" : "sky"}
        />
        {account?.typeCompte === "CAISSE" ? (
          <Summary
            label="Ouverture de caisse"
            value={openSession ? "Ouverte" : "Fermée"}
            icon={<LockKeyhole className="size-4" />}
            tone={openSession ? "emerald" : "amber"}
          />
        ) : (
          <Summary
            label="Banque"
            value={account?.nomBanque || "Non renseignée"}
            icon={<Landmark className="size-4" />}
            tone="sky"
          />
        )}
        <div className="rounded-md border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <span className={`grid size-7 place-items-center rounded-md ${
              account?.actif
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
            }`}>
              <ShieldCheck className="size-4" />
            </span>
            Statut
          </div>
          <Badge className="mt-2" variant={account?.actif ? "default" : "secondary"}>
            {account?.actif ? "Actif" : "Inactif"}
          </Badge>
        </div>
      </section>

      {account?.typeCompte === "CAISSE" && openSession && (
        <section className="rounded-md border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h2 className="font-semibold">Activité de caisse</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La caisse est ouverte par {openSession.utilisateur}.
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b bg-muted/30 p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <CircleDollarSign className="size-5 text-emerald-600" />
            Derniers mouvements
          </h2>
        </div>
        {movements.isLoading || (movements.data?.rows.length ?? 0) > 0 ? (
          <Table>
            <TableHeader className="bg-muted/40">
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
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<CircleDollarSign className="size-5" />}
            title="Aucun mouvement enregistré"
            description="Les encaissements, décaissements et transferts apparaîtront ici."
          />
        )}
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b bg-muted/30 p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <ReceiptText className="size-5 text-amber-600" />
            Dernières opérations internes
          </h2>
        </div>
        {operations.isLoading || (operations.data?.rows.length ?? 0) > 0 ? (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>N° opération</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.isLoading ? <TableRowsSkeleton colSpan={5} rows={3} /> : (operations.data?.rows ?? []).map((operation) => (
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
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<ReceiptText className="size-5" />}
            title="Aucune opération interne"
            description="Les transferts, corrections et contre-écritures apparaîtront ici."
          />
        )}
      </section>
    </div>
  );
}

function Summary({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "emerald" | "amber" | "sky" | "red";
}) {
  const iconTone = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  }[tone];

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <span className={`grid size-7 place-items-center rounded-md ${iconTone}`}>
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-6 text-muted-foreground">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="text-sm">{description}</p>
      </div>
    </div>
  );
}
