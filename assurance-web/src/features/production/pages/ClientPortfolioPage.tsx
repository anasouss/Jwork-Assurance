import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, FileText, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clientApi } from "../api/clients";
import type { ClientCrm } from "../types";

const moneyFormatter = new Intl.NumberFormat("fr-MA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ClientPortfolioPage() {
  const { clientId = "" } = useParams();
  const portfolioQuery = useQuery({
    queryKey: ["production", "client-portfolio", clientId],
    queryFn: () => clientApi.getClientCrm(clientId),
    enabled: Boolean(clientId),
  });

  const contracts = portfolioQuery.data?.contrats ?? [];
  const indicators = useMemo(() => ({
    total: contracts.length,
    active: contracts.filter((contract) => normalize(contract.statut) === "ACTIVE").length,
    totalPremium: contracts.reduce((sum, contract) => sum + Number(contract.primeTotale || 0), 0),
  }), [contracts]);

  if (portfolioQuery.isLoading) {
    return <PortfolioSkeleton />;
  }

  if (portfolioQuery.isError || !portfolioQuery.data) {
    return (
      <div className="grid gap-4">
        <Button asChild variant="outline" className="w-fit">
          <Link to="/app/production/portefeuille-clients"><ArrowLeft className="size-4" />Retour</Link>
        </Button>
        <section className="rounded-lg border border-red-200 bg-red-50 px-5 py-8 text-sm text-red-800">
          Impossible de charger le portefeuille de ce client.
        </section>
      </div>
    );
  }

  const portfolio = portfolioQuery.data;
  const client = portfolio.client;

  return (
    <div className="grid min-w-0 gap-4">
      <header>
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-1">
            <Link to="/app/production/portefeuille-clients">
              <ArrowLeft className="size-4" />
              Portefeuille clients
            </Link>
          </Button>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Production</p>
          <h1 className="mt-1 text-xl font-semibold">{client.nomAffichage || client.raisonSociale || client.nom || "Client"}</h1>
          <p className="text-sm text-muted-foreground">Contrats et situation de production du client.</p>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <div className="flex items-center gap-3 border-b bg-emerald-50 px-5 py-4 dark:bg-emerald-950/30">
          <div className="flex size-9 items-center justify-center rounded-md bg-emerald-700 text-white">
            {client.typeClient === "PERSONNE_MORALE" ? <Building2 className="size-4" /> : <UserRound className="size-4" />}
          </div>
          <div>
            <h2 className="font-semibold">Informations client</h2>
            <p className="text-sm text-muted-foreground">Identité et coordonnées du souscripteur.</p>
          </div>
        </div>
        <div className="grid gap-px border-b bg-border md:grid-cols-2 xl:grid-cols-4">
          <InfoCell label="Code client" value={client.codeClient} />
          <InfoCell label="Type" value={client.typeClient === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique"} />
          <InfoCell label="Identifiant" value={clientIdentifier(client)} />
          <InfoCell label="Catégorie" value={client.categorieClientLibelle} />
          <InfoCell label="Téléphone" value={client.telephone || client.telephones?.find((item) => item.principal)?.numero} icon={<Phone className="size-3.5" />} />
          <InfoCell label="E-mail" value={client.email} />
          <InfoCell label="Ville" value={client.ville} />
          <InfoCell label="Groupe" value={client.groupe ? `${client.groupe.code} - ${client.groupe.libelle}` : undefined} />
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Adresse</p>
          <p className="mt-1 text-sm font-medium">{client.adresse || "-"}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Production</h2>
            <p className="text-sm text-muted-foreground">Polices et mouvements rattachés au client.</p>
          </div>
          <ShieldCheck className="size-5 text-emerald-700" />
        </div>

        <div className="grid gap-px border-b bg-border sm:grid-cols-2 xl:grid-cols-4">
          <Indicator label="Contrats" value={String(indicators.total)} tone="emerald" />
          <Indicator label="Contrats actifs" value={String(indicators.active)} tone="blue" />
          <Indicator label="Prime totale" value={moneyFormatter.format(indicators.totalPremium)} tone="amber" />
          <Indicator label="Impayés" value={moneyFormatter.format(portfolio.totalImpayes)} tone="red" />
        </div>

        {contracts.length ? (
          <Table>
            <TableHeader className="bg-emerald-700 text-white">
              <TableRow className="hover:bg-emerald-700">
                <TableHead className="px-4 text-white">Police / dossier</TableHead>
                <TableHead className="text-white">Compagnie</TableHead>
                <TableHead className="text-white">Type</TableHead>
                <TableHead className="text-white">Rôle</TableHead>
                <TableHead className="text-white">Période</TableHead>
                <TableHead className="text-white">Dernier mouvement</TableHead>
                <TableHead className="text-right text-white">Prime totale</TableHead>
                <TableHead className="text-white">Statut</TableHead>
                <TableHead className="w-28 text-right text-white">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => {
                const movement = latestMovement(contract.mouvements);
                return (
                  <TableRow key={contract.id}>
                    <TableCell className="px-4">
                      <div className="font-medium">{contract.numeroPolice || "Sans numéro de police"}</div>
                      <div className="text-xs text-muted-foreground">{contract.numeroDossier || `#${contract.id}`}</div>
                    </TableCell>
                    <TableCell>{contract.compagnie || "-"}</TableCell>
                    <TableCell>{contractTypeLabel(contract.typeContrat)}</TableCell>
                    <TableCell>{roleLabel(contract.roleClient)}</TableCell>
                    <TableCell>
                      <div>{formatDate(contract.dateEffet)}</div>
                      <div className="text-xs text-muted-foreground">au {formatDate(contract.dateEcheance)}</div>
                    </TableCell>
                    <TableCell>
                      <div>{movement?.libelle || "Affaire nouvelle"}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(movement?.dateEffet)}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{moneyFormatter.format(contract.primeTotale || 0)}</TableCell>
                    <TableCell><ContractStatus status={contract.statut} /></TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/app/production/contrats/${contract.id}`}>
                          Détails
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <FileText className="size-7 text-muted-foreground" />
            <p className="font-medium">Aucun contrat rattaché</p>
            <p className="text-sm text-muted-foreground">Ce client ne possède pas encore de dossier de production.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoCell({ label, value, icon }: { label: string; value?: string | null; icon?: ReactNode }) {
  return (
    <div className="min-w-0 bg-card px-5 py-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 flex min-h-5 items-center gap-1.5 truncate text-sm font-medium">{icon}{value || "-"}</p>
    </div>
  );
}

function Indicator({ label, value, tone }: { label: string; value: string; tone: "emerald" | "blue" | "amber" | "red" }) {
  const toneClass = {
    emerald: "border-t-emerald-600 text-emerald-800 dark:text-emerald-300",
    blue: "border-t-sky-600 text-sky-800 dark:text-sky-300",
    amber: "border-t-amber-500 text-amber-800 dark:text-amber-300",
    red: "border-t-red-500 text-red-800 dark:text-red-300",
  }[tone];
  return (
    <div className={`border-t-2 bg-card px-5 py-4 ${toneClass}`}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function ContractStatus({ status }: { status?: string | null }) {
  const normalized = normalize(status);
  const className = normalized === "ACTIVE"
    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
    : normalized.includes("RESIL") || normalized.includes("ANNU")
      ? "bg-red-100 text-red-800 hover:bg-red-100"
      : "bg-slate-100 text-slate-700 hover:bg-slate-100";
  return <Badge className={className}>{statusLabel(status)}</Badge>;
}

function PortfolioSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

function clientIdentifier(client: ClientCrm["client"]) {
  if (client.ice) return `ICE ${client.ice}`;
  if (client.rc) return `RC ${client.rc}`;
  if (client.cin) return `CIN ${client.cin}`;
  return "-";
}

function latestMovement(movements: ClientCrm["contrats"][number]["mouvements"]) {
  return [...movements].sort((left, right) => String(right.dateEffet || "").localeCompare(String(left.dateEffet || "")))[0];
}

function contractTypeLabel(type?: string | null) {
  if (type === "PARTICULIER") return "Particulier";
  if (type === "CONVENTION") return "Convention";
  if (type === "FLOTTE") return "Flotte";
  return type || "-";
}

function roleLabel(role?: string | null) {
  if (role === "SOUSCRIPTEUR") return "Souscripteur";
  if (role === "PROPRIETAIRE") return "Propriétaire";
  if (role === "CONDUCTEUR") return "Conducteur";
  if (role === "BENEFICIAIRE") return "Bénéficiaire";
  return role || "-";
}

function statusLabel(status?: string | null) {
  const normalized = normalize(status);
  if (normalized === "ACTIVE") return "Actif";
  if (normalized.includes("BROUILLON")) return "Brouillon";
  if (normalized.includes("RESIL")) return "Résilié";
  if (normalized.includes("ANNU")) return "Annulé";
  return status || "-";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function normalize(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}
