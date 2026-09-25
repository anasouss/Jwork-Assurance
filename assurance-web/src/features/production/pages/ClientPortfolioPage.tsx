import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CircleDollarSign, Eye, FileText, FolderOpen, Landmark, Phone, ShieldAlert, ShieldCheck, UserRound, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { comptaApi } from "@/features/compta/api";
import type { ClientDocument, CompanyPortfolioAccountingSummary } from "@/features/compta/types";
import { sinistreApi, sinistreKeys } from "@/features/sinistre/api";
import { natureLabels, statusLabels } from "@/features/sinistre/format";
import type { SinistreSummary } from "@/features/sinistre/types";
import { useAuthStore } from "@/store/auth-store";
import { attachmentApi } from "../api/attachments";
import { clientApi } from "../api/clients";
import type { ClientCrm } from "../types";
import { moneyAmount } from "../utils/format";

type PortfolioContract = ClientCrm["contrats"][number];
type AccountingStatus = { label: string; tone: "emerald" | "amber" | "red" | "blue" | "slate" };
const EMPTY_CONTRACTS: PortfolioContract[] = [];

export default function ClientPortfolioPage() {
  const { clientId = "" } = useParams();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canViewDocuments = permissions.includes("quittance:view");
  const canViewReceivables = permissions.includes("reglement-client:view");
  const canViewCompanyAccounting = permissions.includes("bordereau-compagnie:view");
  const canViewClaims = ["sinistre:view", "sinistre:manage", "sinistre:finance"].some((permission) => permissions.includes(permission));
  const [branchId, setBranchId] = useState("ALL");
  const [selectedContractId, setSelectedContractId] = useState("ALL");

  const portfolioQuery = useQuery({
    queryKey: ["production", "client-portfolio", clientId],
    queryFn: () => clientApi.getClientCrm(clientId),
    enabled: Boolean(clientId),
  });

  const contracts = portfolioQuery.data?.contrats ?? EMPTY_CONTRACTS;
  const branches = useMemo(() => uniqueBranches(contracts), [contracts]);
  const filteredContracts = useMemo(
    () => contracts.filter((contract) => branchId === "ALL" || contract.brancheAssuranceId === branchId),
    [branchId, contracts],
  );
  const selectedContract = contracts.find((contract) => contract.id === selectedContractId);
  const activeBranchId = branchId === "ALL" ? undefined : branchId;
  const activeContractId = selectedContractId === "ALL" ? undefined : selectedContractId;

  const documentParams = useMemo(() => ({
    souscripteurId: clientId,
    contratId: activeContractId,
    brancheId: activeBranchId,
    statut: "EMIS" as const,
    page: 0,
    size: 10,
  }), [activeBranchId, activeContractId, clientId]);
  const receivableParams = useMemo(() => ({
    souscripteurId: clientId,
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

  const documentsQuery = useQuery({
    queryKey: ["production", "client-portfolio", "documents", documentParams],
    queryFn: () => comptaApi.searchClientDocuments(documentParams),
    enabled: Boolean(clientId) && canViewDocuments,
  });
  const receivablesQuery = useQuery({
    queryKey: ["production", "client-portfolio", "receivables", receivableParams],
    queryFn: () => comptaApi.clientReceivables(receivableParams),
    enabled: Boolean(clientId) && canViewReceivables,
  });
  const companyAccountingQuery = useQuery({
    queryKey: ["production", "client-portfolio", "company-accounting", clientId, activeContractId, activeBranchId],
    queryFn: () => comptaApi.companyPortfolioSummary({
      clientId,
      contratId: activeContractId,
      brancheId: activeBranchId,
    }),
    enabled: Boolean(clientId) && canViewCompanyAccounting,
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
  const portfolioScope = new URLSearchParams({ souscripteurId: client.id });
  if (activeContractId) portfolioScope.set("contratId", activeContractId);
  if (activeBranchId) portfolioScope.set("sourceBrancheId", activeBranchId);
  const accountingUrl = `/app/compta/releves-factures?${portfolioScope}`;
  const accountingDocumentsUrl = `/app/compta/releves-factures?${portfolioScope}&tab=documents&documentStatut=EMIS`;
  const claimsScope = new URLSearchParams({ clientId: client.id });
  if (activeContractId) claimsScope.set("contratId", activeContractId);
  if (activeBranchId) claimsScope.set("brancheId", activeBranchId);
  const claimsUrl = `/app/sinistre/dossiers?${claimsScope}`;

  function changeBranch(value: string) {
    setBranchId(value);
    if (selectedContractId !== "ALL") {
      const contract = contracts.find((item) => item.id === selectedContractId);
      if (!contract || (value !== "ALL" && contract.brancheAssuranceId !== value)) setSelectedContractId("ALL");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1600px] min-w-0 gap-4">
      <header>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link to="/app/production">
            <ArrowLeft className="size-4" />Production
          </Link>
        </Button>
      </header>

      <PortfolioRow
        main={<ClientIdentity portfolio={portfolio} />}
        documents={<ClientDocumentsSection contracts={contracts} />}
      />

      {selectedContract ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
          <div>
            <span className="font-semibold">Contrat sélectionné :</span>{" "}
            {selectedContract.numeroPolice || selectedContract.numeroDossier || `#${selectedContract.id}`}
            <span className="ml-2 text-muted-foreground">Les sections ci-dessous sont filtrées sur ce contrat.</span>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedContractId("ALL")}>
            <X className="size-4" />Afficher tous les contrats
          </Button>
        </div>
      ) : null}

      <PortfolioRow
        main={(
          <ProductionSection
            contracts={filteredContracts}
            branches={branches}
            branchId={branchId}
            onBranchChange={changeBranch}
            selectedContractId={selectedContractId}
            onSelectContract={setSelectedContractId}
          />
        )}
        documents={(
          <ProductionDocumentsSection
            contracts={activeContractId
              ? filteredContracts.filter((contract) => contract.id === activeContractId)
              : filteredContracts}
          />
        )}
      />
      <PortfolioRow
        main={(
          <AccountingSection
            canViewClient={canViewReceivables}
            canViewCompany={canViewCompanyAccounting}
            clientLoading={receivablesQuery.isLoading}
            clientError={receivablesQuery.isError}
            companyLoading={companyAccountingQuery.isLoading}
            companyError={companyAccountingQuery.isError}
            summary={receivablesQuery.data?.summary}
            companySummary={companyAccountingQuery.data}
            clientAccountingUrl={accountingUrl}
            companyAccountingUrl="/app/compta/bordereaux-compagnies"
          />
        )}
        documents={(
          <AccountingDocumentsSection
            rows={documentsQuery.data?.rows ?? []}
            totalElements={documentsQuery.data?.page.totalElements ?? 0}
            loading={documentsQuery.isLoading}
            error={documentsQuery.isError}
            allowed={canViewDocuments}
            accountingUrl={accountingDocumentsUrl}
          />
        )}
      />
      <PortfolioRow
        main={(
          <ClaimsSection
            allowed={canViewClaims}
            loading={claimsQuery.isLoading}
            error={claimsQuery.isError}
            rows={claimsQuery.data?.items ?? []}
            totalElements={claimsQuery.data?.page.totalElements ?? 0}
            claimsUrl={claimsUrl}
          />
        )}
        documents={(
          <ClaimsDocumentsSection
            rows={claimsQuery.data?.items ?? []}
            loading={claimsQuery.isLoading}
            error={claimsQuery.isError}
            allowed={canViewClaims}
            claimsUrl={claimsUrl}
          />
        )}
      />
    </div>
  );
}

function PortfolioRow({ main, documents }: { main: ReactNode; documents: ReactNode }) {
  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      {main}
      {documents}
    </div>
  );
}

function ClientIdentity({ portfolio }: { portfolio: ClientCrm }) {
  const client = portfolio.client;
  const clientName = client.nomAffichage || client.raisonSociale || client.nom || "Client";
  const clientSummary = client.codeClient
    ? `${clientName} - ${client.codeClient}`
    : clientName;
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <SectionHeader
        icon={<UserRound className="size-4" />}
        title="Informations client"
        description={clientSummary}
        tone="emerald"
      />
      <div className="grid gap-px border-b bg-border md:grid-cols-2 xl:grid-cols-4">
        <InfoCell
          className="md:col-span-2"
          label="Adresse"
          value={[client.adresse, client.ville].filter(Boolean).join(", ")}
        />
        <InfoCell
          label="Téléphone"
          value={client.telephone || client.telephones?.find((item) => item.principal)?.numero}
          icon={<Phone className="size-3.5" />}
        />
        <InfoCell label="E-mail" value={client.email} />
        <InfoCell label="CIN" value={client.cin} />
        <InfoCell label="RC" value={client.rc} />
        <InfoCell label="ICE" value={client.ice} />
        <InfoCell label="Groupe" value={client.groupe ? `${client.groupe.code} - ${client.groupe.libelle}` : undefined} />
      </div>
    </section>
  );
}

function ProductionSection({
  contracts,
  branches,
  branchId,
  onBranchChange,
  selectedContractId,
  onSelectContract,
}: {
  contracts: PortfolioContract[];
  branches: Array<{ id: string; label: string }>;
  branchId: string;
  onBranchChange: (id: string) => void;
  selectedContractId: string;
  onSelectContract: (id: string) => void;
}) {
  const totalPremium = contracts.reduce((sum, contract) => sum + Number(contract.primeTotale || 0), 0);
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <SectionHeader
        icon={<ShieldCheck className="size-4" />}
        title="Production"
        description={`${contracts.length} contrat(s) · Prime totale ${money(totalPremium)}`}
        tone="emerald"
      />
      {contracts.length ? (
        <Table>
          <TableHeader className="bg-emerald-700 text-white">
            <TableRow className="hover:bg-emerald-700">
              <TableHead className="w-52 px-3 text-white">
                <Select value={branchId} onValueChange={onBranchChange}>
                  <SelectTrigger
                    aria-label="Filtrer par branche"
                    className="h-8 border-emerald-500 bg-emerald-800 px-2 text-white hover:bg-emerald-900 focus:ring-white/70"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes les branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableHead>
              <TableHead className="text-white">Police / dossier</TableHead>
              <TableHead className="text-white">Compagnie</TableHead>
              <TableHead className="text-white">Date de souscription</TableHead>
              <TableHead className="text-white">Statut</TableHead>
              <TableHead className="w-28 text-right text-white">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((contract) => (
              <TableRow
                key={contract.id}
                role="button"
                tabIndex={0}
                aria-selected={contract.id === selectedContractId}
                className="cursor-pointer aria-selected:bg-emerald-50 dark:aria-selected:bg-emerald-950/30"
                onClick={() => onSelectContract(contract.id)}
                onKeyDown={(event) => selectRowFromKeyboard(event, () => onSelectContract(contract.id))}
              >
                <TableCell className="px-4 font-medium">{contract.brancheAssuranceLibelle || contract.brancheAssuranceCode || "-"}</TableCell>
                <TableCell>
                  <div className="font-medium">{contract.numeroPolice || "Sans numéro de police"}</div>
                  <div className="text-xs text-muted-foreground">{contract.numeroDossier || `#${contract.id}`}</div>
                </TableCell>
                <TableCell>{contract.compagnie || "-"}</TableCell>
                <TableCell>{formatDate(contract.dateSouscription)}</TableCell>
                <TableCell><ContractStatus status={contract.statut} dateEcheance={contract.dateEcheance} /></TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline" onClick={(event) => event.stopPropagation()}>
                    <Link to={`/app/production/contrats?contratId=${contract.id}`}>
                      Détails<ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <EmptySection icon={<FolderOpen className="size-6" />} text="Aucun contrat pour cette branche." />}
    </section>
  );
}

function AccountingSection({
  canViewClient,
  canViewCompany,
  clientLoading,
  clientError,
  companyLoading,
  companyError,
  summary,
  companySummary,
  clientAccountingUrl,
  companyAccountingUrl,
}: {
  canViewClient: boolean;
  canViewCompany: boolean;
  clientLoading: boolean;
  clientError: boolean;
  companyLoading: boolean;
  companyError: boolean;
  summary?: { total: number; montantInitial: number; montantConfirme: number; montantEnAttente: number; soldeOuvert: number };
  companySummary?: CompanyPortfolioAccountingSummary;
  clientAccountingUrl: string;
  companyAccountingUrl: string;
}) {
  const clientStatus = accountingClientStatus(summary);
  const accountingDifference = (summary?.soldeOuvert ?? 0) - (companySummary?.netCompagnie ?? 0);
  const showDifference = canViewClient
    && canViewCompany
    && !clientLoading
    && !clientError
    && !companyLoading
    && !companyError;
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <SectionHeader
        icon={<CircleDollarSign className="size-4" />}
        title="Comptabilité"
        description="Situation générale des encaissements client et des règlements compagnie."
        tone="cyan"
        action={showDifference ? (
          <div className="text-right">
            <p className="text-xs uppercase text-muted-foreground">Écart client - compagnie</p>
            <p className="mt-0.5 font-semibold">{money(accountingDifference)}</p>
          </div>
        ) : undefined}
      />
      {!canViewClient && !canViewCompany ? (
        <EmptySection icon={<CircleDollarSign className="size-6" />} text="Vous n'avez pas l'autorisation de consulter la comptabilité." />
      ) : (
        <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
          <AccountingFlow
            title="Encaissements client"
            icon={<UserRound className="size-4" />}
            allowed={canViewClient}
            loading={clientLoading}
            error={clientError}
            status={clientStatus}
            metric={{ label: "Reste à encaisser", value: money(summary?.soldeOuvert) }}
            pending={summary?.montantEnAttente ? `${money(summary.montantEnAttente)} en attente de confirmation` : undefined}
            detailsUrl={clientAccountingUrl}
          />
          <AccountingFlow
            title="Règlements compagnie"
            icon={<Landmark className="size-4" />}
            allowed={canViewCompany}
            loading={companyLoading}
            error={companyError}
            status={companyAccountingStatus(companySummary?.statut)}
            metric={{ label: "Net compagnie", value: money(companySummary?.netCompagnie) }}
            detailsUrl={companyAccountingUrl}
          />
        </div>
      )}
    </section>
  );
}

function AccountingFlow({
  title,
  icon,
  allowed,
  loading,
  error,
  status,
  metric,
  pending,
  detailsUrl,
}: {
  title: string;
  icon: ReactNode;
  allowed: boolean;
  loading: boolean;
  error: boolean;
  status: AccountingStatus;
  metric: { label: string; value: string };
  pending?: string;
  detailsUrl: string;
}) {
  if (!allowed) {
    return <div className="px-5 py-8 text-sm text-muted-foreground">Accès non autorisé.</div>;
  }
  if (loading) {
    return <div className="grid gap-2 px-5 py-5"><Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-full" /></div>;
  }
  if (error) {
    return <div className="px-5 py-8 text-sm text-red-700">Impossible de charger cette situation comptable.</div>;
  }
  return (
    <div className="min-w-0 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">{icon}{title}</div>
        <AccountingStatusBadge status={status} />
      </div>
      <div className="mt-4 min-w-0">
        <p className="text-xs uppercase text-muted-foreground">{metric.label}</p>
        <p className="mt-1 truncate text-lg font-semibold">{metric.value}</p>
      </div>
      <div className="mt-4 flex min-h-8 flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">{pending}</p>
        <Button asChild size="sm" variant="outline">
          <Link to={detailsUrl}>Détails<ArrowRight className="size-4" /></Link>
        </Button>
      </div>
    </div>
  );
}

function ClaimsSection({ allowed, loading, error, rows, totalElements, claimsUrl }: { allowed: boolean; loading: boolean; error: boolean; rows: SinistreSummary[]; totalElements: number; claimsUrl: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <SectionHeader
        icon={<ShieldAlert className="size-4" />}
        title="Sinistres"
        description="Déclarations rattachées au client et au périmètre sélectionné."
        tone="red"
        action={allowed ? (
          <Button asChild size="sm" variant="outline">
            <Link to={claimsUrl}>Ouvrir les sinistres<ArrowRight className="size-4" /></Link>
          </Button>
        ) : undefined}
      />
      {!allowed ? (
        <EmptySection icon={<ShieldAlert className="size-6" />} text="Vous n'avez pas l'autorisation de consulter les sinistres." />
      ) : loading ? (
        <SectionSkeleton />
      ) : error ? (
        <EmptySection icon={<ShieldAlert className="size-6" />} text="Impossible de charger les sinistres." />
      ) : rows.length ? (
        <>
          <div className="divide-y">
            {rows.slice(0, 8).map((claim) => (
              <Link
                key={claim.id}
                to={`/app/sinistre/dossiers/${claim.id}`}
                className="grid gap-2 px-5 py-3 transition-colors hover:bg-red-50/60 dark:hover:bg-red-950/20 sm:grid-cols-[1fr_170px_130px_auto] sm:items-center"
              >
                <div>
                  <p className="font-medium">{claim.numeroSinistre}</p>
                  <p className="text-xs text-muted-foreground">{claim.numeroPolice || claim.numeroDossier || "Sans police"}</p>
                </div>
                <div>
                  <p className="text-sm">{natureLabels[claim.nature]}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(claim.dateSinistre)}</p>
                </div>
                <Badge variant="outline" className="w-fit">{statusLabels[claim.statut]}</Badge>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
          {totalElements > 8 ? (
            <div className="border-t px-5 py-2 text-right">
              <Link className="text-sm font-medium text-red-700 hover:underline" to={claimsUrl}>
                Voir tous les sinistres
              </Link>
            </div>
          ) : null}
        </>
      ) : (
        <EmptySection icon={<ShieldCheck className="size-6" />} text="Aucun sinistre pour ce périmètre." compact />
      )}
    </section>
  );
}

function ClientDocumentsSection({ contracts }: { contracts: PortfolioContract[] }) {
  const documentQueries = useQueries({
    queries: contracts.map((contract) => ({
      queryKey: ["production", "client-portfolio", "client-documents", contract.id],
      queryFn: () => attachmentApi.getContratPiecesJointes(contract.id),
      staleTime: 60_000,
    })),
  });
  const documents = documentQueries.flatMap((query) => {
    if (!query.data) return [];
    const clientTypeIds = new Set(
      query.data.types.filter((type) => Boolean(type.typeClient)).map((type) => type.id),
    );
    return query.data.pieces
      .filter((piece) => piece.typePieceJointeId && clientTypeIds.has(piece.typePieceJointeId))
      .map((piece) => ({
        ...piece,
        contractReference: query.data?.numeroPolice || query.data?.numeroDossier || `#${piece.contratId}`,
      }));
  });
  const loading = documentQueries.some((query) => query.isLoading);
  const error = documentQueries.some((query) => query.isError);
  return (
    <DocumentPanel title="Documents client" description="Pièces d'identité et justificatifs." tone="blue">
      {loading ? (
        <div className="grid gap-2 py-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
      ) : error ? (
        <DocumentEmpty text="Impossible de charger les documents client." />
      ) : documents.length ? (
        <div className="divide-y">
          {documents.map((document) => (
            <Link
              key={`${document.contratId}-${document.id}`}
              to={`/app/production/contrats/${document.contratId}/pieces-jointes`}
              className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-blue-700"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{document.typePieceJointeLibelle || document.nomFichier}</span>
                <span className="block truncate text-xs text-muted-foreground">{document.contractReference} · {document.nomFichier}</span>
              </span>
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <DocumentEmpty text="Aucun document client enregistré." />
      )}
    </DocumentPanel>
  );
}

function ProductionDocumentsSection({ contracts }: { contracts: PortfolioContract[] }) {
  return (
    <DocumentPanel title="Documents production" description="Pièces jointes des contrats." tone="emerald">
      {contracts.length ? (
        <div className="divide-y">
          {contracts.map((contract) => (
            <Link
              key={contract.id}
              to={`/app/production/contrats/${contract.id}/pieces-jointes`}
              className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-emerald-700"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {contract.numeroPolice || contract.numeroDossier || `#${contract.id}`}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {contract.brancheAssuranceLibelle || "Contrat"}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <DocumentEmpty text="Aucun contrat dans ce périmètre." />
      )}
    </DocumentPanel>
  );
}

function AccountingDocumentsSection({ rows, totalElements, loading, error, allowed, accountingUrl }: { rows: ClientDocument[]; totalElements: number; loading: boolean; error: boolean; allowed: boolean; accountingUrl: string }) {
  const [openingId, setOpeningId] = useState<string>();

  async function preview(document: ClientDocument) {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Autorisez les fenêtres contextuelles pour prévisualiser le PDF");
      return;
    }
    previewWindow.opener = null;
    setOpeningId(document.id);
    try {
      const blob = await comptaApi.clientDocumentPdf(document.id);
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow.close();
      toast.error(error instanceof Error ? error.message : "Prévisualisation impossible");
    } finally {
      setOpeningId(undefined);
    }
  }

  return (
    <DocumentPanel
      title="Documents comptables"
      description="Factures et relevés émis."
      tone="amber"
      action={allowed ? (
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <Link to={accountingUrl}>{totalElements > rows.length ? "Voir tout" : "Gérer"}</Link>
        </Button>
      ) : undefined}
    >
      {!allowed ? (
        <DocumentEmpty text="Accès comptable non autorisé." />
      ) : loading ? (
        <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      ) : error ? (
        <DocumentEmpty text="Impossible de charger les documents." />
      ) : rows.length ? (
        <div className="divide-y">
          {rows.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{document.numero}</p>
                <p className="text-xs text-muted-foreground">
                  {document.typeDocument === "FACTURE" ? "Facture" : "Relevé"} · {formatDate(document.dateEmission)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={openingId === document.id}
                title={`Prévisualiser ${document.numero}`}
                aria-label={`Prévisualiser ${document.numero}`}
                onClick={() => void preview(document)}
              >
                <Eye className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <DocumentEmpty text="Aucun document émis." />
      )}
    </DocumentPanel>
  );
}

function ClaimsDocumentsSection({ rows, loading, error, allowed, claimsUrl }: { rows: SinistreSummary[]; loading: boolean; error: boolean; allowed: boolean; claimsUrl: string }) {
  return (
    <DocumentPanel
      title="Dossiers sinistres"
      description="Déclarations et pièces associées."
      tone="red"
      action={allowed ? <Button asChild size="sm" variant="ghost"><Link to={claimsUrl}>Voir tout</Link></Button> : undefined}
    >
      {!allowed ? (
        <DocumentEmpty text="Accès aux sinistres non autorisé." />
      ) : loading ? (
        <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      ) : error ? (
        <DocumentEmpty text="Impossible de charger les dossiers." />
      ) : rows.length ? (
        <div className="divide-y">
          {rows.slice(0, 10).map((claim) => (
            <Link
              key={claim.id}
              to={`/app/sinistre/dossiers/${claim.id}`}
              className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-red-700"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{claim.numeroSinistre}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {natureLabels[claim.nature]} · {formatDate(claim.dateSinistre)}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <DocumentEmpty text="Aucun dossier sinistre." />
      )}
    </DocumentPanel>
  );
}

function DocumentPanel({ title, description, tone, action, children }: { title: string; description: string; tone: "blue" | "emerald" | "amber" | "red"; action?: ReactNode; children: ReactNode }) {
  const color = { blue: "bg-sky-700", emerald: "bg-emerald-700", amber: "bg-amber-600", red: "bg-red-700" }[tone];
  return (
    <aside className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex size-8 shrink-0 items-center justify-center rounded-md text-white ${color}`}>
            <FileText className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </aside>
  );
}

function DocumentEmpty({ text }: { text: string }) {
  return <p className="py-2 text-sm text-muted-foreground">{text}</p>;
}

function SectionHeader({ icon, title, description, tone, action }: { icon: ReactNode; title: string; description: string; tone: "emerald" | "cyan" | "red" | "amber"; action?: ReactNode }) {
  const color = { emerald: "bg-emerald-700", cyan: "bg-cyan-700", red: "bg-red-700", amber: "bg-amber-600" }[tone];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-md text-white ${color}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function InfoCell({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value?: string | null;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 bg-card px-5 py-4 text-sm ${className}`}>
      <span className="font-medium uppercase text-muted-foreground">{label} :</span>
      <span className="flex min-h-5 min-w-0 items-center gap-1.5 font-medium break-words">
        {icon}{value || "-"}
      </span>
    </div>
  );
}

function EmptySection({ icon, text, compact = false }: { icon: ReactNode; text: string; compact?: boolean }) {
  return <div className={`flex flex-col items-center justify-center gap-2 text-center text-muted-foreground ${compact ? "px-5 py-7" : "px-5 py-12"}`}>{icon}<p className="text-sm">{text}</p></div>;
}

function SectionSkeleton() {
  return <div className="grid gap-2 p-5"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;
}

function ContractStatus({ status, dateEcheance }: { status?: string | null; dateEcheance?: string | null }) {
  const normalized = normalize(status);
  const expired = normalized === "EXPIRED" || normalized === "RENEWED" || isPastDate(dateEcheance);
  const terminated = normalized === "CANCELLED" || normalized.includes("RESIL") || normalized.includes("ANNU");
  const className = terminated
    ? "bg-red-100 text-red-800 hover:bg-red-100"
    : expired
      ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
      : normalized === "ACTIVE"
        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
        : "bg-slate-100 text-slate-700 hover:bg-slate-100";
  return <Badge className={className}>{contractStatusLabel(status, expired)}</Badge>;
}

function AccountingStatusBadge({ status }: { status: AccountingStatus }) {
  const className = {
    emerald: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    amber: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    red: "bg-red-100 text-red-800 hover:bg-red-100",
    blue: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    slate: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  }[status.tone];
  return <Badge className={className}>{status.label}</Badge>;
}

function accountingClientStatus(summary?: { montantInitial: number; montantConfirme: number; montantEnAttente: number; soldeOuvert: number }): AccountingStatus {
  if (!summary || summary.montantInitial <= 0) return { label: "À jour", tone: "emerald" };
  if (summary.soldeOuvert <= 0) return { label: "Payé", tone: "emerald" };
  if (summary.montantConfirme > 0) return { label: "Partiel", tone: "amber" };
  if (summary.montantEnAttente > 0) return { label: "En attente", tone: "blue" };
  return { label: "Impayé", tone: "red" };
}

function companyAccountingStatus(status?: CompanyPortfolioAccountingSummary["statut"]): AccountingStatus {
  switch (status) {
    case "REGLE": return { label: "Réglé", tone: "emerald" };
    case "PARTIELLEMENT_REGLE": return { label: "Partiel", tone: "amber" };
    case "EN_ATTENTE": return { label: "En attente", tone: "blue" };
    case "NON_REGLE": return { label: "Non réglé", tone: "red" };
    case "A_BORDEREAUTER": return { label: "À bordereauter", tone: "amber" };
    default: return { label: "Aucune écriture", tone: "slate" };
  }
}

function PortfolioSkeleton() {
  return <div className="grid gap-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /><div className="grid gap-4 xl:grid-cols-[1fr_340px]"><Skeleton className="h-96" /><Skeleton className="h-80" /></div></div>;
}

function uniqueBranches(contracts: PortfolioContract[]) {
  const branches = new Map<string, string>();
  contracts.forEach((contract) => { if (contract.brancheAssuranceId) branches.set(contract.brancheAssuranceId, contract.brancheAssuranceLibelle || contract.brancheAssuranceCode || "Branche"); });
  return [...branches].map(([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label, "fr"));
}

function selectRowFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, select: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); }
}

function contractStatusLabel(status?: string | null, expired = false) {
  const normalized = normalize(status);
  if (normalized === "CANCELLED" || normalized.includes("RESIL") || normalized.includes("ANNU")) return "Résilié";
  if (expired) return "Échu";
  if (normalized === "ACTIVE") return "En vigueur";
  if (normalized === "SUSPENDED") return "Suspendu";
  if (normalized.includes("BROUILLON")) return "Brouillon";
  return status || "-";
}

function isPastDate(value?: string | null) {
  if (!value) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return value.slice(0, 10) < today;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function money(value?: number | null) { return moneyAmount(Number(value || 0)); }
function normalize(value?: string | null) { return String(value || "").trim().toUpperCase(); }
