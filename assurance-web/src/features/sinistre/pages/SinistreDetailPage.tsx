import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  ChevronDown,
  CircleAlert,
  Download,
  FileCheck2,
  FileText,
  FilePlus2,
  FileX2,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserRoundSearch,
} from "lucide-react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadBlob } from "@/lib/download";
import { useAuthStore } from "@/store/auth-store";
import { sinistreApi, sinistreKeys } from "../api";
import { formatDate, formatMoney, statusLabels } from "../format";
import { SinistreStatusBadge } from "../components/SinistreStatusBadge";
import {
  SinistreTransitionDialog,
} from "../components/SinistreTransitionDialog";
import { SinistrePartyDialog } from "../components/SinistrePartyDialog";
import {
  SinistreFinanceDialog,
  type FinanceDialogMode,
} from "../components/SinistreFinanceDialog";
import {
  SinistreDocumentDialog,
  documentTypeLabels,
} from "../components/SinistreDocumentDialog";
import { SinistreMissionDialog } from "../components/SinistreMissionDialog";
import { CoverageSection, GeneralSection } from "../components/SinistreDossierSections";
import { SinistreTracking } from "../components/SinistreTracking";
import { isAtLeastTransmitted, suiviLabels } from "../workflow";
import type {
  SinistreDetail,
  StatutSinistre,
  TypeDocument,
} from "../types";

export default function SinistreDetailPage() {
  const { sinistreId = "" } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canUpdate = permissions.includes("sinistre:update");
  const canTransition = permissions.includes("sinistre:transition");
  const canUploadDocument = permissions.includes("sinistre-document:upload");
  const canReviewDocument = permissions.includes("sinistre-document:update");
  const canDeleteDocument = permissions.includes("sinistre-document:delete");
  const canCreateMission = permissions.includes("sinistre-mission:create");
  const canUpdateMission = permissions.includes("sinistre-mission:update");
  const canCreateProvision = permissions.includes("sinistre-provision:create");
  const canCreateOperation = permissions.includes("sinistre-operation:create");
  const canCancelOperation = permissions.includes("sinistre-operation:cancel");
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<SinistreDetail["parties"][number] | null>(null);
  const [financeMode, setFinanceMode] = useState<FinanceDialogMode | null>(
    null,
  );
  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentInitialType, setDocumentInitialType] =
    useState<TypeDocument | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [missionOpen, setMissionOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<
    SinistreDetail["missionsExpertise"][number] | null
  >(null);
  const detail = useQuery({
    queryKey: sinistreKeys.detail(sinistreId),
    queryFn: () => sinistreApi.get(sinistreId),
    enabled: Boolean(sinistreId),
  });
  useEffect(() => {
    if (detail.data && location.hash && location.hash !== "#modifier") {
      window.document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
    }
  }, [detail.data?.id, location.hash]);
  const treasuryAccounts = useQuery({
    queryKey: sinistreKeys.treasuryAccounts(),
    queryFn: sinistreApi.treasuryAccounts,
    enabled:
      canCreateOperation &&
      Boolean(
        detail.data &&
          (detail.data.provisions.length > 0 ||
            detail.data.operations.length > 0 ||
            isAtLeastExpertise(detail.data.statut)),
      ),
  });

  const accept = (result: SinistreDetail, message: string) => {
    queryClient.setQueryData(sinistreKeys.detail(sinistreId), result);
    queryClient.invalidateQueries({ queryKey: sinistreKeys.lists() });
    queryClient.invalidateQueries({ queryKey: sinistreKeys.dashboard() });
    toast.success(message);
  };
  const fail = (error: unknown) =>
    toast.error(
      error instanceof Error ? error.message : "Opération impossible",
    );
  const transition = useMutation({
    mutationFn: ({
      statut,
      motif,
    }: {
      statut: StatutSinistre;
      motif?: string;
    }) => sinistreApi.transition(sinistreId, statut, motif),
    onSuccess: (result) => {
      setTransitionOpen(false);
      accept(result, "Statut mis à jour");
    },
    onError: fail,
  });
  const party = useMutation({
    mutationFn: (request: object) =>
      editingParty
        ? sinistreApi.updateParty(sinistreId, editingParty.id, request)
        : sinistreApi.addParty(sinistreId, request),
    onSuccess: (result) => {
      setPartyOpen(false);
      setEditingParty(null);
      accept(result, editingParty ? "Partie mise à jour" : "Partie ajoutée");
    },
    onError: fail,
  });
  const removeParty = useMutation({
    mutationFn: (id: string) => sinistreApi.deleteParty(sinistreId, id),
    onSuccess: (result) => accept(result, "Partie retirée"),
    onError: fail,
  });
  const finance = useMutation({
    mutationFn: ({
      mode,
      request,
    }: {
      mode: FinanceDialogMode;
      request: object;
    }) =>
      mode === "PROVISION"
        ? sinistreApi.addProvision(sinistreId, request)
        : sinistreApi.addOperation(sinistreId, request),
    onSuccess: (result) => {
      setFinanceMode(null);
      accept(result, "Écriture enregistrée");
    },
    onError: fail,
  });
  const cancelOperation = useMutation({
    mutationFn: (id: string) =>
      sinistreApi.cancelOperation(sinistreId, id, "Correction d’une écriture"),
    onSuccess: (result) => accept(result, "Opération annulée"),
    onError: fail,
  });
  const mission = useMutation({
    mutationFn: ({ id, request }: { id: string | null; request: object }) =>
      sinistreApi.saveMission(sinistreId, id, request),
    onSuccess: (result) => {
      setMissionOpen(false);
      setEditingMission(null);
      accept(result, "Mission enregistrée");
    },
    onError: fail,
  });
  const document = useMutation({
    mutationFn: ({
      type,
      commentaire,
      file,
      metadata,
    }: {
      type: TypeDocument;
      commentaire: string;
      file: File;
      metadata: Record<string, string>;
    }) => sinistreApi.uploadDocument(sinistreId, type, commentaire, file, metadata),
    onSuccess: (result) => {
      setDocumentOpen(false);
      accept(result, "Document déposé");
    },
    onError: fail,
  });
  const reviewDocument = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: "VALIDE" | "REJETE" }) =>
      sinistreApi.reviewDocument(sinistreId, id, statut),
    onSuccess: (result) => accept(result, "Document contrôlé"),
    onError: fail,
  });
  const deleteDocument = useMutation({
    mutationFn: (id: string) => sinistreApi.deleteDocument(sinistreId, id),
    onSuccess: (result) => {
      setDocumentToDelete(null);
      accept(result, "Document supprimé");
    },
    onError: fail,
  });
  const download = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => ({
      blob: await sinistreApi.downloadDocument(sinistreId, id),
      name,
    }),
    onSuccess: ({ blob, name }) => downloadBlob(blob, name),
    onError: fail,
  });

  if (detail.isLoading)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-[520px]" />
      </div>
    );
  if (!detail.data)
    return (
      <div className="grid gap-3">
        <h1 className="text-xl font-semibold">Dossier indisponible</h1>
        <p className="text-muted-foreground">
          {detail.error instanceof Error
            ? detail.error.message
            : "Le dossier n’a pas pu être chargé."}
        </p>
        <Button asChild variant="outline">
          <Link to="/app/sinistre/dossiers">Retour aux dossiers</Link>
        </Button>
      </div>
    );
  const dossier = detail.data;
  const locked = dossier.editable !== true;
  const cancelledIds = new Set(
    dossier.operations
      .filter((item) => item.type === "ANNULATION" && item.operationAnnuleeId)
      .map((item) => item.operationAnnuleeId),
  );
  const financeVisible =
    dossier.provisions.length > 0 ||
    dossier.operations.length > 0 ||
    isAtLeastExpertise(dossier.statut);
  const coverageAssessmentVisible = isAtLeastTransmitted(dossier.statut);

  if (location.hash === "#modifier" && canUpdate && !locked) {
    return <Navigate to={`/app/sinistre/dossiers/${dossier.id}/modifier`} replace />;
  }

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[1600px] gap-6 bg-muted/25 p-3 sm:p-5">
      <header className="flex min-w-0 flex-col gap-3 border-b border-sky-200 bg-sky-50 px-4 pb-5 pt-2 dark:border-sky-900 dark:bg-sky-950/25 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 break-words">
          <Button asChild variant="ghost" className="mb-2 -ml-3">
            <Link to="/app/sinistre/dossiers">
              <ArrowLeft className="size-4" />
              Retour aux dossiers
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{dossier.numeroSinistre}</h1>
            <SinistreStatusBadge statut={dossier.statut} />
            {locked ? <span className="text-xs text-muted-foreground">Lecture seule</span> : null}
          </div>
          <p className="text-sm text-sky-950/75 dark:text-sky-200/80">
            Sinistre du {formatDate(dossier.dateSinistre)}{" "}
            · {dossier.couverture.assure} · {dossier.couverture.compagnie}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && !locked ? <Button asChild><Link to={`/app/sinistre/dossiers/${dossier.id}/modifier`}><Pencil className="size-4" />Modifier le dossier</Link></Button> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline"><MoreHorizontal className="size-4" />Actions du dossier</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canTransition && dossier.workflow.transitions.length > 0 ? <DropdownMenuItem onSelect={() => setTransitionOpen(true)}>Changer le statut</DropdownMenuItem> : null}
              <DropdownMenuItem asChild><a href="#historique"><History className="size-4" />Historique</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <SinistreTracking dossier={dossier} />
      <DocumentAttention dossier={dossier} />
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
        <section id="informations" className="scroll-mt-24 border-y bg-card px-4">
          <GeneralSection
            key={dossier.id}
            dossier={dossier}
            managers={[]}
            responsibilityVisible={
              dossier.garanties.some((item) => item.impliquee && item.responsabiliteCivile)
            }
            editable={false}
            saving={false}
          />
        </section>
        <section id="garanties" className="scroll-mt-24 border-y bg-card">
          {canUpdate && !locked ? <div className="flex justify-end px-4 pt-3"><Button asChild size="sm" variant="outline"><Link to={`/app/sinistre/dossiers/${dossier.id}/modifier?section=garanties`}><Pencil className="size-4" />Modifier les garanties</Link></Button></div> : null}
        <CoverageSection
            key={`coverage-${dossier.id}`}
            dossier={dossier}
            assessmentVisible={coverageAssessmentVisible}
            editable={false}
            saving={false}
        />
        </section>
        <section id="parties" className="scroll-mt-24 bg-card">
        <WorkflowPanel
          title="Parties impliquées"
          summary={`${dossier.parties.length} partie(s)`}
          defaultOpen={dossier.parties.length > 0}
          action={
            canUpdate && !locked ? (
              <Button size="sm" onClick={() => { setEditingParty(null); setPartyOpen(true); }}>
                <Plus className="size-4" />
                Ajouter
              </Button>
            ) : null
          }
        >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Véhicule / assurance adverse</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dossier.parties.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.type}</TableCell>
                      <TableCell className="font-medium">{item.nom}</TableCell>
                      <TableCell>{item.telephone || item.cin || "-"}</TableCell>
                      <TableCell>
                        {[
                          item.immatriculation,
                          item.compagnieAdverse,
                          item.numeroPoliceAdverse,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "-"}
                      </TableCell>
                      <TableCell>
                        {canUpdate && !locked ? (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" aria-label="Modifier" onClick={() => { setEditingParty(item); setPartyOpen(true); }}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="Retirer" disabled={removeParty.isPending} onClick={() => removeParty.mutate(item.id)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {dossier.parties.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-4 text-center text-muted-foreground"
                      >
                        Aucune partie impliquée ajoutée.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
        </WorkflowPanel>
        </section>
        </div>
        <aside id="documents" aria-label="Documents du dossier" className="min-w-0 scroll-mt-24 bg-card">
          <DocumentsPanel
            dossier={dossier}
            editable={canUploadDocument && !locked}
            canReview={canReviewDocument && !locked}
            canDelete={canDeleteDocument && !locked}
            reviewing={reviewDocument.isPending}
            downloading={download.isPending}
            onAdd={(type) => { setDocumentInitialType(type ?? null); setDocumentOpen(true); }}
            onDownload={(id, name) => download.mutate({ id, name })}
            onReview={(id, statut) => reviewDocument.mutate({ id, statut })}
            onDelete={(id, name) => setDocumentToDelete({ id, name })}
          />
        </aside>
      </div>
        <section id="expertises" className="min-w-0 scroll-mt-24 bg-card">
            <WorkflowPanel
              title="Missions d’expertise"
              summary={`${dossier.missionsExpertise.length} mission(s)`}
              defaultOpen
              action={
                canCreateMission && !locked ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingMission(null);
                      setMissionOpen(true);
                    }}
                  >
                    <UserRoundSearch className="size-4" />
                    Mandater
                  </Button>
                ) : null
              }
            >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phase</TableHead>
                    <TableHead>Expert</TableHead>
                    <TableHead>Garage</TableHead>
                    <TableHead>Mission</TableHead>
                    <TableHead>Rapport</TableHead>
                    <TableHead>Montants</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dossier.missionsExpertise.map((item) => (
                    <TableRow
                      key={item.id}
                      className={
                        canUpdateMission && !locked ? "cursor-pointer" : undefined
                      }
                      onClick={() => {
                        if (canUpdateMission && !locked) {
                          setEditingMission(item);
                          setMissionOpen(true);
                        }
                      }}
                    >
                      <TableCell>{item.phase === "APRES" ? "Après réparation" : "Avant réparation"}</TableCell>
                      <TableCell className="font-medium">
                        {item.expert}
                      </TableCell>
                      <TableCell>{item.garage || "-"}</TableCell>
                      <TableCell>
                        {formatDate(item.dateMission)}
                        <div className="text-xs text-muted-foreground">
                          {item.referenceMission || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(item.dateRapport)}</TableCell>
                      <TableCell>
                        {formatMoney(item.montantEstime)} /{" "}
                        {formatMoney(item.montantAccepte)}
                      </TableCell>
                      <TableCell>{item.statut}</TableCell>
                    </TableRow>
                  ))}
                  {dossier.missionsExpertise.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-4 text-center text-muted-foreground"
                      >
                        Aucune expertise mandatée.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            </WorkflowPanel>
        </section>
        <section id="finances" className="min-w-0 scroll-mt-24 bg-card">
        {financeVisible ? (
          <div className="grid gap-4">
            <FinancialSummary dossier={dossier} />
            <WorkflowPanel
              title="Provisions"
              summary={`${dossier.provisions.length} écriture(s)`}
              defaultOpen={dossier.provisions.length > 0}
              action={
                canCreateProvision && !locked ? (
                  <Button size="sm" onClick={() => setFinanceMode("PROVISION")}>
                    <Plus className="size-4" />
                    Provision
                  </Button>
                ) : null
              }
            >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Saisie par</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dossier.provisions.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.dateProvision)}</TableCell>
                      <TableCell className="font-medium">
                        {formatMoney(item.montant)}
                      </TableCell>
                      <TableCell>{item.motif}</TableCell>
                      <TableCell>{item.saisiePar}</TableCell>
                    </TableRow>
                  ))}
                  {dossier.provisions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-4 text-center text-muted-foreground"
                      >
                        Aucune provision.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            </WorkflowPanel>
            <WorkflowPanel
              title="Règlements, frais et recours"
              summary={`${dossier.operations.length} opération(s)`}
              defaultOpen={
                dossier.operations.length > 0 || isSettlementStage(dossier.statut)
              }
              action={
                canCreateOperation && !locked ? (
                  <Button size="sm" onClick={() => setFinanceMode("OPERATION")}>
                    <Banknote className="size-4" />
                    Ajouter
                  </Button>
                ) : null
              }
            >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Flux</TableHead>
                    <TableHead>Moyen / référence</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Saisie par</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dossier.operations.map((item) => (
                    <TableRow
                      key={item.id}
                      className={
                        item.type === "ANNULATION" || cancelledIds.has(item.id)
                          ? "text-muted-foreground"
                          : undefined
                      }
                    >
                      <TableCell>{formatDate(item.dateOperation)}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>
                        {operationFlow(item)}
                      </TableCell>
                      <TableCell>
                        <div>
                          {[paymentModeLabel(item.modeReglement), item.reference]
                            .filter(Boolean)
                            .join(" · ") || "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[item.compteTresorerie, item.numeroOperationTresorerie]
                            .filter(Boolean)
                            .join(" · ") ||
                            (item.circuitFinancier === "DIRECT_COMPAGNIE"
                              ? "Paiement direct compagnie"
                              : item.modeReglement === "COMPENSATION"
                                ? "Sans mouvement de trésorerie"
                                : "-")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(item.montant)}
                      </TableCell>
                      <TableCell>{item.saisiePar}</TableCell>
                      <TableCell>
                        {canCancelOperation &&
                        !locked &&
                        item.type !== "ANNULATION" &&
                        !cancelledIds.has(item.id) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Annuler l’opération"
                            disabled={cancelOperation.isPending}
                            onClick={() => cancelOperation.mutate(item.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {dossier.operations.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-4 text-center text-muted-foreground"
                      >
                        Aucune opération financière.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            </WorkflowPanel>
          </div>
        ) : <p className="border-y py-8 text-sm text-muted-foreground">Aucune écriture financière. Les provisions et opérations seront disponibles à l’étape d’expertise.</p>}
        </section>
        <section id="historique" className="min-w-0 scroll-mt-24 bg-card">
          <WorkflowPanel title="Historique du dossier" summary={`${dossier.evenements.length} événement(s)`} defaultOpen><DossierHistory dossier={dossier} /></WorkflowPanel>
        </section>
      <SinistreTransitionDialog
        open={transitionOpen}
        transitions={dossier.workflow.transitions}
        saving={transition.isPending}
        onOpenChange={setTransitionOpen}
        onSubmit={(statut, motif) => transition.mutate({ statut, motif })}
      />
      <SinistrePartyDialog
        open={partyOpen}
        saving={party.isPending}
        party={editingParty}
        onOpenChange={(open) => { setPartyOpen(open); if (!open) setEditingParty(null); }}
        onSubmit={(request) => party.mutate(request)}
      />
      <SinistreFinanceDialog
        open={financeMode !== null}
        mode={financeMode ?? "PROVISION"}
        dossier={dossier}
        treasuryAccounts={treasuryAccounts.data ?? []}
        saving={finance.isPending}
        onOpenChange={(open) => {
          if (!open) setFinanceMode(null);
        }}
        onSubmit={(request) =>
          financeMode && finance.mutate({ mode: financeMode, request })
        }
      />
      <SinistreDocumentDialog
        open={documentOpen}
        saving={document.isPending}
        dossier={dossier}
        initialType={documentInitialType}
        onOpenChange={(open) => {
          setDocumentOpen(open);
          if (!open) setDocumentInitialType(null);
        }}
        onSubmit={(type, commentaire, file, metadata) =>
          document.mutate({ type, commentaire, file, metadata })
        }
      />
      <SinistreMissionDialog
        initialPhase={dossier.etapeSuivi === "EXPERTISE_APRES" ? "APRES" : "AVANT"}
        open={missionOpen}
        mission={editingMission}
        dossier={dossier}
        saving={mission.isPending}
        onOpenChange={(open) => {
          setMissionOpen(open);
          if (!open) setEditingMission(null);
        }}
        onSubmit={(id, request) => mission.mutate({ id, request })}
      />
      <AlertDialog
        open={documentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setDocumentToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              {documentToDelete?.name} sera retiré définitivement du dossier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDocument.isPending}
              onClick={() => {
                if (documentToDelete) {
                  deleteDocument.mutate(documentToDelete.id);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FinancialSummary({ dossier }: { dossier: SinistreDetail }) {
  const metrics = [
    ["Provision", dossier.totaux.provisionCourante],
    ["Indemnisable", dossier.totaux.totalIndemnisable],
    ["Réglé", dossier.totaux.totalRegle],
    ["Frais", dossier.totaux.totalFrais],
    ["Recours", dossier.totaux.totalRecours],
    ["Reste à régler", dossier.totaux.resteARegler],
  ] as const;
  return (
    <section className="min-w-0 border-y border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/15">
      <SectionHeader title="Situation financière · MAD" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map(([label, value]) => (
          <div key={label} className="border-b px-4 py-3 last:border-b-0 sm:border-r xl:border-b-0 xl:last:border-r-0">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 font-semibold tabular-nums">{formatMoney(value)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DossierHistory({ dossier }: { dossier: SinistreDetail }) {
  return (
    <section aria-label="Historique du dossier" className="divide-y border-y">
          {dossier.evenements.map((item) => (
            <div key={item.id} className="flex gap-3 p-4">
              <div className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-600" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium">{item.description}</p>
                  <time className="text-xs text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </time>
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.utilisateur}
                  {item.ancienStatut && item.nouveauStatut
                    ? ` · ${statusLabels[item.ancienStatut]} → ${statusLabels[item.nouveauStatut]}`
                    : ""}
                  {item.ancienneEtape && item.nouvelleEtape
                    ? ` · ${suiviLabels[item.ancienneEtape]} → ${suiviLabels[item.nouvelleEtape]}`
                    : ""}
                </p>
              </div>
            </div>
          ))}
          {dossier.evenements.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">
              Aucun événement.
            </p>
          ) : null}
    </section>
  );
}
function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function WorkflowPanel({
  title,
  summary,
  action,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="min-w-0 border-y [&_thead]:bg-muted/50"
    >
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 bg-muted/35 py-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-3 text-left"
          >
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
            <span className="font-semibold">{title}</span>
            {summary ? (
              <span className="text-sm text-muted-foreground">
                {summary}
              </span>
            ) : null}
          </button>
        </CollapsibleTrigger>
        {action ? <div className="shrink-0 pr-3">{action}</div> : null}
      </div>
      <CollapsibleContent className="border-t">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function DocumentsPanel({
  dossier,
  editable,
  canReview,
  canDelete,
  reviewing,
  downloading,
  onAdd,
  onDownload,
  onReview,
  onDelete,
}: {
  dossier: SinistreDetail;
  editable: boolean;
  canReview: boolean;
  canDelete: boolean;
  reviewing: boolean;
  downloading: boolean;
  onAdd: (type?: TypeDocument) => void;
  onDownload: (id: string, name: string) => void;
  onReview: (id: string, statut: "VALIDE" | "REJETE") => void;
  onDelete: (id: string, name: string) => void;
}) {
  const requiredDocuments = dossier.workflow.documentsRequis;
  const mandatoryDocuments = requiredDocuments.filter((item) => item.obligatoire);
  const openingComplete =
    mandatoryDocuments.length === 0 ||
    mandatoryDocuments.every((item) => item.valide);
  const openingPending = requiredDocuments.some(
    (item) => item.recu && !item.valide,
  );

  return (
    <section className="min-w-0 border-y">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 bg-sky-50 px-4 py-3 dark:bg-sky-950/25">
        <div className="min-w-0">
          <h2 className="font-semibold">Pièces du dossier</h2>
          <p className="text-xs text-muted-foreground">
            {dossier.documents.length} document(s) déposé(s)
          </p>
        </div>
        {editable ? (
          <Button size="sm" onClick={() => onAdd()}>
            <FilePlus2 className="size-4" />
            Déposer
          </Button>
        ) : null}
      </div>

      <div className="min-w-0">
      <div className="min-w-0 border-t">
        <div className="flex flex-wrap justify-between gap-2 px-3 py-3 text-xs">
          <h3 className="font-semibold text-muted-foreground">Pièces requises</h3>
          <span className={openingComplete ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300"}>{openingComplete ? "Complet" : openingPending ? "À contrôler" : "À compléter"}</span>
        </div>
          {requiredDocuments.length > 0 ? (
            <div className="grid gap-1.5 px-3 pb-3">
              {requiredDocuments.map((item) => {
                const status = item.valide
                  ? "Validé"
                  : item.recu
                    ? "À contrôler"
                    : item.obligatoire
                      ? "Manquant"
                      : "Facultatif";
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!editable || item.valide || item.recu}
                    onClick={() => onAdd(item.type)}
                    className={`flex items-center justify-between gap-2 rounded border px-2.5 py-2 text-left text-xs disabled:cursor-default ${
                      item.valide
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : item.recu
                          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                          : item.obligatoire
                            ? "cursor-pointer border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:border-amber-500"
                            : "cursor-pointer border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="min-w-0 break-words">{item.libelle}</span>
                    <span className="shrink-0 font-medium">{status}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
      </div>

      <div className="min-w-0 border-t">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Documents déposés
          </p>
        </div>
        {dossier.documents.length === 0 ? (
          <div className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
            Aucun document déposé.
          </div>
        ) : (
          <div className="divide-y border-t">
            {dossier.documents.map((item) => (
              <div key={item.id} className="flex flex-wrap items-start gap-2 px-3 py-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-sky-700" />
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-medium" title={item.nomFichier}>
                    {item.nomFichier}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {documentTypeLabels[item.type]}
                    {item.dateDocument ? ` · ${formatDate(item.dateDocument)}` : ""}
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium ${
                      item.statut === "VALIDE"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : item.statut === "REJETE"
                          ? "text-destructive"
                          : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {item.statut === "VALIDE"
                      ? "Validé"
                      : item.statut === "REJETE"
                        ? "Rejeté"
                        : "À contrôler"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={downloading}
                    aria-label={`Télécharger ${item.nomFichier}`}
                    onClick={() => onDownload(item.id, item.nomFichier)}
                  >
                    <Download className="size-4" />
                  </Button>
                  {canReview && item.statut === "RECU" ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={reviewing}
                        aria-label={`Valider ${item.nomFichier}`}
                        onClick={() => onReview(item.id, "VALIDE")}
                      >
                        <FileCheck2 className="size-4 text-emerald-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={reviewing}
                        aria-label={`Rejeter ${item.nomFichier}`}
                        onClick={() => onReview(item.id, "REJETE")}
                      >
                        <FileX2 className="size-4 text-destructive" />
                      </Button>
                    </>
                  ) : null}
                  {canDelete && item.statut !== "VALIDE" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer ${item.nomFichier}`}
                      onClick={() => onDelete(item.id, item.nomFichier)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </section>
  );
}



function operationFlow(
  operation: SinistreDetail["operations"][number],
) {
  const company = operation.compagnieAssurance || "Compagnie";
  const counterparty = operation.contrepartie || "Contrepartie non renseignée";
  if (operation.type === "RECOURS") {
    return `${counterparty} → ${company}`;
  }
  if (operation.type === "ANNULATION") {
    return `Annulation · ${counterparty}`;
  }
  return `${company} → ${counterparty}`;
}

function paymentModeLabel(
  mode: SinistreDetail["operations"][number]["modeReglement"],
) {
  if (!mode) return null;
  return {
    VIREMENT: "Virement",
    CHEQUE: "Chèque",
    ESPECES: "Espèces",
    COMPENSATION: "Compensation",
    AUTRE: "Autre",
  }[mode];
}


function isAtLeastExpertise(statut: StatutSinistre) {
  return [
    "EXPERTISE",
    "EN_ATTENTE_REGLEMENT",
    "PARTIELLEMENT_REGLE",
    "REGLE",
    "CLOTURE",
  ].includes(statut);
}

function isSettlementStage(statut: StatutSinistre) {
  return ["EN_ATTENTE_REGLEMENT", "PARTIELLEMENT_REGLE", "REGLE"].includes(
    statut,
  );
}

function DocumentAttention({ dossier }: { dossier: SinistreDetail }) {
  const missing = dossier.workflow.documentsRequis.filter((item) => item.obligatoire && !item.recu && !item.valide).length;
  const messages = [
    missing > 0 ? `${missing} document(s) obligatoire(s) manquant(s)` : null,
    dossier.workflow.documentsRecus > 0 ? `${dossier.workflow.documentsRecus} à contrôler` : null,
    dossier.workflow.documentsRejetes > 0 ? `${dossier.workflow.documentsRejetes} rejeté(s)` : null,
  ].filter(Boolean);
  if (messages.length === 0) return null;
  return <div className="flex flex-wrap items-center justify-between gap-2 border-y border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
    <p className="flex min-w-0 items-center gap-2"><CircleAlert className="size-4 shrink-0" /><span>{messages.join(" · ")}</span></p>
    <Button asChild size="sm" variant="ghost"><a href="#documents"><FileText className="size-4" />Voir les documents</a></Button>
  </div>;
}
