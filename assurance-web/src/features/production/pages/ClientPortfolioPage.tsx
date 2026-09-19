import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, CircleDollarSign, FileText, FolderOpen, Phone, ReceiptText, ShieldAlert, ShieldCheck, UserRound, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { comptaApi } from "@/features/compta/api";
import type { ClientDocumentSource, ClientReceivable } from "@/features/compta/types";
import { sinistreApi, sinistreKeys } from "@/features/sinistre/api";
import { natureLabels, statusLabels } from "@/features/sinistre/format";
import type { SinistreSummary } from "@/features/sinistre/types";
import { useAuthStore } from "@/store/auth-store";
import { clientApi } from "../api/clients";
import type { ClientCrm } from "../types";

type PortfolioContract = ClientCrm["contrats"][number];

const moneyFormatter = new Intl.NumberFormat("fr-MA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ClientPortfolioPage() {
  const { clientId = "" } = useParams();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canViewDocuments = permissions.includes("quittance:view");
  const canViewReceivables = permissions.includes("reglement-client:view");
  const canViewClaims = ["sinistre:view", "sinistre:manage", "sinistre:finance"].some((permission) => permissions.includes(permission));
  const [branchId, setBranchId] = useState("ALL");
  const [selectedContractId, setSelectedContractId] = useState("ALL");

  const portfolioQuery = useQuery({
    queryKey: ["production", "client-portfolio", clientId],
    queryFn: () => clientApi.getClientCrm(clientId),
    enabled: Boolean(clientId),
  });

  const contracts = portfolioQuery.data?.contrats ?? [];
  const branches = useMemo(() => uniqueBranches(contracts), [contracts]);
  const filteredContracts = useMemo(
    () => contracts.filter((contract) => branchId === "ALL" || contract.brancheAssuranceId === branchId),
    [branchId, contracts],
  );
  const selectedContract = contracts.find((contract) => contract.id === selectedContractId);
  const activeBranchId = branchId === "ALL" ? undefined : branchId;
  const activeContractId = selectedContractId === "ALL" ? undefined : selectedContractId;

  const sourceParams = useMemo(() => ({
    payeurType: "CLIENT" as const,
    payeurId: clientId,
    contratId: activeContractId,
    brancheId: activeBranchId,
    page: 0,
    size: 100,
  }), [activeBranchId, activeContractId, clientId]);
  const receivableParams = useMemo(() => ({
    payeurType: "CLIENT" as const,
    payeurId: clientId,
    contratId: activeContractId,
    brancheId: activeBranchId,
    page: 0,
    size: 100,
  }), [activeBranchId, activeContractId, clientId]);
  const claimsParams = useMemo(() => ({
    clientId,
    contratId: activeContractId,
    brancheId: activeBranchId,
    page: 0,
    size: 25,
  }), [activeBranchId, activeContractId, clientId]);

  const sourcesQuery = useQuery({
    queryKey: ["production", "client-portfolio", "documents", sourceParams],
    queryFn: () => comptaApi.searchClientDocumentSources(sourceParams),
    enabled: Boolean(clientId) && canViewDocuments,
  });
  const receivablesQuery = useQuery({
    queryKey: ["production", "client-portfolio", "receivables", receivableParams],
    queryFn: () => comptaApi.clientReceivables(receivableParams),
    enabled: Boolean(clientId) && canViewReceivables,
  });
  const claimsQuery = useQuery({
    queryKey: sinistreKeys.list(claimsParams),
    queryFn: () => sinistreApi.list(claimsParams),
    enabled: Boolean(clientId) && canViewClaims,
  });

  if (portfolioQuery.isLoading) return <PortfolioSkeleton />;

  if (portfolioQuery.isError || !portfolioQuery.data) {
    return (
      <div className="grid gap-4">
        <Button asChild variant="outline" className="w-fit">
          <Link to="/app/production"><ArrowLeft className="size-4" />Retour à la production</Link>
        </Button>
        <section className="rounded-lg border border-red-200 bg-red-50 px-5 py-8 text-sm text-red-800">
          Impossible de charger le portefeuille de ce client.
        </section>
      </div>
    );
  }

  const portfolio = portfolioQuery.data;
  const client = portfolio.client;
  const accountingUrl = `/app/compta/releves-factures?cible=CLIENT&payeurId=${client.id}`;

  function changeBranch(value: string) {
    setBranchId(value);
    if (selectedContractId !== "ALL") {
      const contract = contracts.find((item) => item.id === selectedContractId);
      if (!contract || (value !== "ALL" && contract.brancheAssuranceId !== value)) setSelectedContractId("ALL");
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-1">
            <Link to="/app/production"><ArrowLeft className="size-4" />Production</Link>
          </Button>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Portefeuille client</p>
          <h1 className="mt-1 text-xl font-semibold">{client.nomAffichage || client.raisonSociale || client.nom || "Client"}</h1>
          <p className="text-sm text-muted-foreground">Vue consolidée de la production, de la comptabilité et des sinistres.</p>
        </div>
        <div className="w-full sm:w-72">
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Branche</label>
          <Select value={branchId} onValueChange={changeBranch}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les branches</SelectItem>
              {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      <ClientIdentity portfolio={portfolio} />

      {selectedContract ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
          <div><span className="font-semibold">Contrat sélectionné :</span> {selectedContract.numeroPolice || selectedContract.numeroDossier || `#${selectedContract.id}`}<span className="ml-2 text-muted-foreground">Les sections ci-dessous sont filtrées sur ce contrat.</span></div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedContractId("ALL")}><X className="size-4" />Afficher tous les contrats</Button>
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-4">
          <ProductionSection contracts={filteredContracts} selectedContractId={selectedContractId} onSelectContract={setSelectedContractId} />
          <AccountingSection allowed={canViewReceivables} loading={receivablesQuery.isLoading} rows={receivablesQuery.data?.rows ?? []} summary={receivablesQuery.data?.summary} accountingUrl={accountingUrl} />
          <ClaimsSection allowed={canViewClaims} loading={claimsQuery.isLoading} rows={claimsQuery.data?.items ?? []} />
        </div>
        <DocumentsSection
          contracts={activeContractId ? filteredContracts.filter((contract) => contract.id === activeContractId) : filteredContracts}
          rows={sourcesQuery.data?.rows ?? []}
          loading={sourcesQuery.isLoading}
          allowed={canViewDocuments}
          accountingUrl={accountingUrl}
        />
      </div>
    </div>
  );
}

function ClientIdentity({ portfolio }: { portfolio: ClientCrm }) {
  const client = portfolio.client;
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <div className="flex items-center gap-3 border-b bg-emerald-50 px-5 py-4 dark:bg-emerald-950/30">
        <div className="flex size-9 items-center justify-center rounded-md bg-emerald-700 text-white">{client.typeClient === "PERSONNE_MORALE" ? <Building2 className="size-4" /> : <UserRound className="size-4" />}</div>
        <div><h2 className="font-semibold">Informations client</h2><p className="text-sm text-muted-foreground">Identité et coordonnées du souscripteur.</p></div>
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
      <div className="px-5 py-4"><p className="text-xs font-medium uppercase text-muted-foreground">Adresse</p><p className="mt-1 text-sm font-medium">{client.adresse || "-"}</p></div>
    </section>
  );
}

function ProductionSection({ contracts, selectedContractId, onSelectContract }: { contracts: PortfolioContract[]; selectedContractId: string; onSelectContract: (id: string) => void }) {
  const totalPremium = contracts.reduce((sum, contract) => sum + Number(contract.primeTotale || 0), 0);
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <SectionHeader icon={<ShieldCheck className="size-4" />} title="Production" description={`${contracts.length} contrat(s) · Prime totale ${money(totalPremium)}`} tone="emerald" />
      {contracts.length ? (
        <Table>
          <TableHeader className="bg-emerald-700 text-white"><TableRow className="hover:bg-emerald-700"><TableHead className="px-4 text-white">Police / dossier</TableHead><TableHead className="text-white">Branche</TableHead><TableHead className="text-white">Compagnie</TableHead><TableHead className="text-white">Période</TableHead><TableHead className="text-right text-white">Prime totale</TableHead><TableHead className="text-white">Statut</TableHead><TableHead className="w-28 text-right text-white">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {contracts.map((contract) => (
              <TableRow key={contract.id} role="button" tabIndex={0} aria-selected={contract.id === selectedContractId} className="cursor-pointer aria-selected:bg-emerald-50 dark:aria-selected:bg-emerald-950/30" onClick={() => onSelectContract(contract.id)} onKeyDown={(event) => selectRowFromKeyboard(event, () => onSelectContract(contract.id))}>
                <TableCell className="px-4"><div className="font-medium">{contract.numeroPolice || "Sans numéro de police"}</div><div className="text-xs text-muted-foreground">{contract.numeroDossier || `#${contract.id}`}</div></TableCell>
                <TableCell>{contract.brancheAssuranceLibelle || contract.brancheAssuranceCode || "-"}</TableCell>
                <TableCell>{contract.compagnie || "-"}</TableCell>
                <TableCell><div>{formatDate(contract.dateEffet)}</div><div className="text-xs text-muted-foreground">au {formatDate(contract.dateEcheance)}</div></TableCell>
                <TableCell className="text-right font-semibold">{money(contract.primeTotale)}</TableCell>
                <TableCell><ContractStatus status={contract.statut} /></TableCell>
                <TableCell className="text-right"><Button asChild size="sm" variant="outline" onClick={(event) => event.stopPropagation()}><Link to={`/app/production/contrats/${contract.id}`}>Détails<ArrowRight className="size-4" /></Link></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <EmptySection icon={<FolderOpen className="size-6" />} text="Aucun contrat pour cette branche." />}
    </section>
  );
}

function AccountingSection({ allowed, loading, rows, summary, accountingUrl }: { allowed: boolean; loading: boolean; rows: ClientReceivable[]; summary?: { total: number; montantInitial: number; montantConfirme: number; montantEnAttente: number; soldeOuvert: number }; accountingUrl: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <SectionHeader icon={<CircleDollarSign className="size-4" />} title="Comptabilité" description="Créances et règlements du périmètre sélectionné." tone="cyan" action={allowed ? <Button asChild size="sm" variant="outline"><Link to={accountingUrl}>Ouvrir la comptabilité<ArrowRight className="size-4" /></Link></Button> : undefined} />
      {!allowed ? <EmptySection icon={<CircleDollarSign className="size-6" />} text="Vous n'avez pas l'autorisation de consulter la comptabilité." /> : loading ? <SectionSkeleton /> : (
        <><div className="grid gap-px border-b bg-border sm:grid-cols-2 xl:grid-cols-4"><Indicator label="Éléments" value={String(summary?.total ?? 0)} tone="blue" /><Indicator label="Montant initial" value={money(summary?.montantInitial)} tone="emerald" /><Indicator label="Montant réglé" value={money(summary?.montantConfirme)} tone="cyan" /><Indicator label="Solde ouvert" value={money(summary?.soldeOuvert)} tone="amber" /></div>{rows.length ? <div className="divide-y">{rows.slice(0, 8).map((row) => <ReceivableRow key={row.source.elementFacturableId || `${row.source.contratId}-${row.source.reference}`} row={row} />)}</div> : <EmptySection icon={<ReceiptText className="size-6" />} text="Aucune créance ouverte pour ce périmètre." compact />}</>
      )}
    </section>
  );
}

function ClaimsSection({ allowed, loading, rows }: { allowed: boolean; loading: boolean; rows: SinistreSummary[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <SectionHeader icon={<ShieldAlert className="size-4" />} title="Sinistres" description="Déclarations rattachées au client et au périmètre sélectionné." tone="red" action={allowed ? <Button asChild size="sm" variant="outline"><Link to="/app/sinistre/dossiers">Ouvrir les sinistres<ArrowRight className="size-4" /></Link></Button> : undefined} />
      {!allowed ? <EmptySection icon={<ShieldAlert className="size-6" />} text="Vous n'avez pas l'autorisation de consulter les sinistres." /> : loading ? <SectionSkeleton /> : rows.length ? <div className="divide-y">{rows.slice(0, 8).map((claim) => <Link key={claim.id} to={`/app/sinistre/dossiers/${claim.id}`} className="grid gap-2 px-5 py-3 transition-colors hover:bg-red-50/60 dark:hover:bg-red-950/20 sm:grid-cols-[1fr_170px_130px_auto] sm:items-center"><div><p className="font-medium">{claim.numeroSinistre}</p><p className="text-xs text-muted-foreground">{claim.numeroPolice || claim.numeroDossier || "Sans police"}</p></div><div><p className="text-sm">{natureLabels[claim.nature]}</p><p className="text-xs text-muted-foreground">{formatDate(claim.dateSinistre)}</p></div><Badge variant="outline" className="w-fit">{statusLabels[claim.statut]}</Badge><ArrowRight className="size-4 text-muted-foreground" /></Link>)}</div> : <EmptySection icon={<ShieldCheck className="size-6" />} text="Aucun sinistre pour ce périmètre." compact />}
    </section>
  );
}

function DocumentsSection({ contracts, rows, loading, allowed, accountingUrl }: { contracts: PortfolioContract[]; rows: ClientDocumentSource[]; loading: boolean; allowed: boolean; accountingUrl: string }) {
  const documents = uniqueDocuments(rows);
  return (
    <aside className="overflow-hidden rounded-lg border border-border/70 bg-card xl:sticky xl:top-4">
      <SectionHeader icon={<FileText className="size-4" />} title="Documents" description="Pièces du périmètre sélectionné." tone="amber" />
      <div className="border-b px-4 py-3"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Documents comptables</h3>{allowed ? <Button asChild size="sm" variant="ghost"><Link to={accountingUrl}>Gérer</Link></Button> : null}</div>
        {!allowed ? <p className="text-sm text-muted-foreground">Accès comptable non autorisé.</p> : loading ? <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : documents.length ? <div className="divide-y">{documents.slice(0, 10).map((document) => <div key={document.id} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium">{document.numero}</p><p className="text-xs text-muted-foreground">{document.type === "FACTURE" ? "Facture" : "Relevé"} · {formatDate(document.dateEmission)}</p></div><Badge variant="secondary">{document.type === "FACTURE" ? "FC" : "RL"}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Aucun document émis.</p>}
      </div>
      <div className="px-4 py-3"><h3 className="mb-2 text-sm font-semibold">Pièces contractuelles</h3>{contracts.length ? <div className="divide-y">{contracts.map((contract) => <Link key={contract.id} to={`/app/production/contrats/${contract.id}/pieces-jointes`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-emerald-700"><span className="min-w-0"><span className="block truncate font-medium">{contract.numeroPolice || contract.numeroDossier || `#${contract.id}`}</span><span className="block truncate text-xs text-muted-foreground">{contract.brancheAssuranceLibelle || "Contrat"}</span></span><ArrowRight className="size-4 shrink-0" /></Link>)}</div> : <p className="text-sm text-muted-foreground">Aucun contrat dans ce périmètre.</p>}</div>
    </aside>
  );
}

function SectionHeader({ icon, title, description, tone, action }: { icon: ReactNode; title: string; description: string; tone: "emerald" | "cyan" | "red" | "amber"; action?: ReactNode }) {
  const color = { emerald: "bg-emerald-700", cyan: "bg-cyan-700", red: "bg-red-700", amber: "bg-amber-600" }[tone];
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div className="flex items-center gap-3"><div className={`flex size-8 items-center justify-center rounded-md text-white ${color}`}>{icon}</div><div><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div></div>{action}</div>;
}

function ReceivableRow({ row }: { row: ClientReceivable }) {
  return <div className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_160px_140px] sm:items-center"><div><p className="font-medium">{row.source.mouvement || row.source.nature || "Écriture"}</p><p className="text-xs text-muted-foreground">{row.source.police || row.source.dossier || "Sans référence"}</p></div><div className="text-sm"><span className="text-muted-foreground">TTC </span><strong>{money(row.source.montantTtc)}</strong></div><div className="text-right text-sm"><span className="text-muted-foreground">Solde </span><strong className="text-amber-700">{money(row.soldeOuvert)}</strong></div></div>;
}

function InfoCell({ label, value, icon }: { label: string; value?: string | null; icon?: ReactNode }) {
  return <div className="min-w-0 bg-card px-5 py-4"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-1 flex min-h-5 items-center gap-1.5 truncate text-sm font-medium">{icon}{value || "-"}</p></div>;
}

function Indicator({ label, value, tone }: { label: string; value: string; tone: "emerald" | "blue" | "cyan" | "amber" }) {
  const color = { emerald: "text-emerald-800", blue: "text-sky-800", cyan: "text-cyan-800", amber: "text-amber-800" }[tone];
  return <div className="bg-card px-5 py-3"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p></div>;
}

function EmptySection({ icon, text, compact = false }: { icon: ReactNode; text: string; compact?: boolean }) {
  return <div className={`flex flex-col items-center justify-center gap-2 text-center text-muted-foreground ${compact ? "px-5 py-7" : "px-5 py-12"}`}>{icon}<p className="text-sm">{text}</p></div>;
}

function SectionSkeleton() {
  return <div className="grid gap-2 p-5"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;
}

function ContractStatus({ status }: { status?: string | null }) {
  const normalized = normalize(status);
  const className = normalized === "ACTIVE" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : normalized.includes("RESIL") || normalized.includes("ANNU") ? "bg-red-100 text-red-800 hover:bg-red-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100";
  return <Badge className={className}>{contractStatusLabel(status)}</Badge>;
}

function PortfolioSkeleton() {
  return <div className="grid gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /><div className="grid gap-4 xl:grid-cols-[1fr_340px]"><Skeleton className="h-96" /><Skeleton className="h-80" /></div></div>;
}

function uniqueBranches(contracts: PortfolioContract[]) {
  const branches = new Map<string, string>();
  contracts.forEach((contract) => { if (contract.brancheAssuranceId) branches.set(contract.brancheAssuranceId, contract.brancheAssuranceLibelle || contract.brancheAssuranceCode || "Branche"); });
  return [...branches].map(([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label, "fr"));
}

function uniqueDocuments(rows: ClientDocumentSource[]) {
  const documents = new Map<string, ClientDocumentSource["documents"][number]>();
  rows.forEach((row) => row.documents.forEach((document) => documents.set(document.id, document)));
  return [...documents.values()].sort((left, right) => right.dateEmission.localeCompare(left.dateEmission));
}

function selectRowFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, select: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); }
}

function clientIdentifier(client: ClientCrm["client"]) {
  if (client.ice) return `ICE ${client.ice}`;
  if (client.rc) return `RC ${client.rc}`;
  if (client.cin) return `CIN ${client.cin}`;
  return "-";
}

function contractStatusLabel(status?: string | null) {
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

function money(value?: number | null) { return moneyFormatter.format(Number(value || 0)); }
function normalize(value?: string | null) { return String(value || "").trim().toUpperCase(); }
