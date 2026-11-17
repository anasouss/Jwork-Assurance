import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Download,
  FileCheck2,
  FileText,
  FilePlus2,
  FileX2,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRoundSearch,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
import { SinistreAssistanceTable } from "../components/SinistreAssistanceTable";
import { SinistreTracking } from "../components/SinistreTracking";
import { damageLabels, repairLabels, suiviLabels } from "../workflow";
import type {
  DecisionCouverture,
  SinistreDetail,
  StatutSinistre,
  TypeDocument,
  ModeReparationSinistre,
} from "../types";

export default function SinistreDetailPage() {
  const { sinistreId = "" } = useParams();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("synthese");
  useEffect(() => { setActiveSection("synthese"); }, [sinistreId]);
  useEffect(() => {
    if (location.hash === "#modifier") setActiveSection("synthese");
  }, [location.hash, location.key]);
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
  const managers = useQuery({
    queryKey: sinistreKeys.managers(),
    queryFn: sinistreApi.managers,
    enabled: canUpdate,
  });
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
  const update = useMutation({
    mutationFn: (request: object) => sinistreApi.update(sinistreId, request),
    onSuccess: (result) => accept(result, "Dossier mis à jour"),
    onError: fail,
  });
  const guarantee = useMutation({
    mutationFn: (guarantees: object[]) =>
      sinistreApi.updateGuarantees(sinistreId, guarantees),
    onSuccess: (result) => accept(result, "Garanties mises à jour"),
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

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-3">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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
          <p className="text-sm text-muted-foreground">
            Sinistre du {formatDate(dossier.dateSinistre)}{" "}
            · {dossier.couverture.assure} · {dossier.couverture.compagnie}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline"><MoreHorizontal className="size-4" />Actions du dossier</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canTransition && dossier.workflow.transitions.length > 0 ? <DropdownMenuItem onSelect={() => setTransitionOpen(true)}>Changer le statut</DropdownMenuItem> : null}
              <DropdownMenuItem onSelect={() => setActiveSection("historique")}><History className="size-4" />Historique</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <SinistreTracking dossier={dossier} />
      <Tabs value={activeSection} onValueChange={setActiveSection} className="min-w-0 gap-4">
        <div className="overflow-x-auto border-b pb-2">
          <TabsList variant="line" aria-label="Rubriques du dossier">
            <TabsTrigger value="synthese">Synthèse</TabsTrigger>
            <TabsTrigger value="documents">Documents ({dossier.documents.length})</TabsTrigger>
            <TabsTrigger value="expertises">Expertises ({dossier.missionsExpertise.length})</TabsTrigger>
            <TabsTrigger value="finances">Finances</TabsTrigger>
            <TabsTrigger value="historique">Historique</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="synthese" forceMount className="grid min-w-0 gap-5 data-[state=inactive]:hidden">
          <DocumentAttention dossier={dossier} onOpen={() => setActiveSection("documents")} />
          <GeneralSection
            key={dossier.id}
            dossier={dossier}
            managers={managers.data ?? []}
            responsibilityVisible={
              dossier.garanties.some((item) => item.impliquee && item.responsabiliteCivile)
            }
            editable={canUpdate && !locked}
            saving={update.isPending}
            onSave={(request) => update.mutateAsync(request)}
          />
        <CoverageSection
            key={`coverage-${dossier.id}`}
            dossier={dossier}
            assessmentVisible={coverageAssessmentVisible}
            editable={canUpdate && !locked}
            saving={guarantee.isPending}
            onSave={(guarantees) => guarantee.mutateAsync(guarantees)}
        />
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
        </TabsContent>
        <TabsContent value="documents" forceMount className="min-w-0 space-y-4 data-[state=inactive]:hidden">
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
        </TabsContent>
        <TabsContent value="expertises" forceMount className="min-w-0 data-[state=inactive]:hidden">
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
        </TabsContent>
        <TabsContent value="finances" forceMount className="min-w-0 data-[state=inactive]:hidden">
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
        </TabsContent>
        <TabsContent value="historique" className="min-w-0"><DossierHistory dossier={dossier} /></TabsContent>
      </Tabs>
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
    <section className="min-w-0 border-y">
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
      className="min-w-0 border-y"
    >
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-1">
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
  const expertiseDocuments = dossier.documents.filter((item) =>
    ["DEVIS", "RAPPORT_EXPERT", "ACCORD"].includes(item.type),
  ).length;
  const settlementDocuments = dossier.documents.filter((item) =>
    ["FACTURE", "REGLEMENT", "RECOURS"].includes(item.type),
  ).length;
  const expertiseAvailable = isAtLeastTransmitted(dossier.statut);
  const settlementAvailable = isAtLeastExpertise(dossier.statut);

  return (
    <section className="min-w-0 border-y">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 px-4 py-3">
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

      <div className="grid min-w-0 items-start lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      <div className="min-w-0 border-t lg:border-r">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Parcours documentaire
          </p>
        </div>
        <DocumentStage
          number={1}
          title="Ouverture du dossier"
          description="Déclaration, constat et pièces d’identité"
          status={
            openingComplete
              ? "Complet"
              : openingPending
                ? "À contrôler"
                : "À compléter"
          }
          tone={openingComplete ? "success" : "warning"}
          active={!openingComplete}
        >
          {requiredDocuments.length > 0 ? (
            <div className="mt-2 grid gap-1.5">
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
        </DocumentStage>
        <DocumentStage
          number={2}
          title="Expertise"
          description="Devis, rapport d’expert et accord compagnie"
          status={
            expertiseAvailable
              ? expertiseDocuments > 0
                ? `${expertiseDocuments} déposé(s)`
                : "À venir"
              : "Après transmission"
          }
          tone={expertiseDocuments > 0 ? "success" : "neutral"}
          active={expertiseAvailable && expertiseDocuments === 0}
        />
        <DocumentStage
          number={3}
          title="Règlement et recours"
          description="Factures, justificatifs et recours"
          status={
            settlementAvailable
              ? settlementDocuments > 0
                ? `${settlementDocuments} déposé(s)`
                : "À venir"
              : "Étape ultérieure"
          }
          tone={settlementDocuments > 0 ? "success" : "neutral"}
          active={settlementAvailable && settlementDocuments === 0}
        />
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

function DocumentStage({
  number,
  title,
  description,
  status,
  tone,
  active = false,
  children,
}: {
  number: number;
  title: string;
  description: string;
  status: string;
  tone: "success" | "warning" | "neutral";
  active?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`border-t px-3 py-3 ${active ? "bg-sky-50/50 dark:bg-sky-950/30" : ""}`}>
      <div className="flex items-start gap-2.5">
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
            tone === "success"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : active
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {tone === "success" ? <CircleCheck className="size-3.5" /> : number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium">{title}</p>
            <span
              className={`shrink-0 text-xs font-medium ${
                tone === "success"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : tone === "warning"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-muted-foreground"
              }`}
            >
              {status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function generalForm(dossier: SinistreDetail) {
  return {
    referenceCompagnie: dossier.referenceCompagnie || "",
    responsabilite: dossier.tauxResponsabilite == null ? "NON_DETERMINEE" : String(dossier.tauxResponsabilite),
    notes: dossier.notes || "",
    gestionnaireId: dossier.gestionnaireId || "",
    prochaineAction: dossier.prochaineAction || "",
    dateEcheanceAction: dossier.dateEcheanceAction || "",
    typeDommage: dossier.typeDommage || "",
    modeReparation: dossier.modeReparation || "",
    garageId: dossier.garageId || "",
  };
}

function GeneralSection({
  dossier,
  managers,
  responsibilityVisible,
  editable,
  saving,
  onSave,
}: {
  dossier: SinistreDetail;
  managers: Array<{ id: string; nom: string }>;
  responsibilityVisible: boolean;
  editable: boolean;
  saving: boolean;
  onSave: (request: object) => Promise<unknown>;
}) {
  const location = useLocation();
  const sectionRef = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(location.hash === "#modifier" && editable);
  useEffect(() => {
    if (location.hash !== "#modifier" || !editable) return;
    setEditing(true);
    sectionRef.current?.scrollIntoView({ block: "start" });
  }, [location.hash, location.key, editable, dossier.id]);
  useEffect(() => {
    if (editing) sectionRef.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus({ preventScroll: true });
  }, [editing]);
  const [form, setForm] = useState(() => generalForm(dossier));
  const [trackingOpen, setTrackingOpen] = useState(
    Boolean(
      dossier.prochaineAction || dossier.dateEcheanceAction || dossier.notes,
    ),
  );
  useEffect(
    () => setForm(generalForm(dossier)),
    [dossier],
  );
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const garageContext = { sinistreId: dossier.id, modeReparation: (form.modeReparation || undefined) as ModeReparationSinistre | undefined,
    garantieIds: dossier.garanties.filter(g => g.impliquee).map(g => g.garantieId) };
  const garageQuery = useQuery({ queryKey: sinistreKeys.eligible("GARAGE", garageContext), queryFn: () => sinistreApi.eligibleProviders("GARAGE", garageContext), enabled: editing && editable && dossier.couverture.brancheCode === "AUTOMOBILE" });
  const garages = garageQuery.data ?? [];
  const historicalGarage = form.garageId === dossier.garageId && form.modeReparation === dossier.modeReparation;
  const garageChanged = form.garageId !== (dossier.garageId || "") || form.modeReparation !== (dossier.modeReparation || "");
  const garageInvalid = !!form.garageId && !historicalGarage && !garages.some(item => item.id === form.garageId);
  return (
      <section id="modifier" ref={sectionRef} className="min-w-0 scroll-mt-24 border-y py-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Informations du sinistre</h2>
          {editable && !editing ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="size-4" />Modifier</Button> : null}
          {editable && editing ? (
            <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={saving} onClick={() => { setForm(generalForm(dossier)); setEditing(false); }}>Annuler</Button>
            <Button
              size="sm"
              disabled={saving || garageInvalid || (garageChanged && (garageQuery.isFetching || garageQuery.isError)) || (dossier.statut !== "BROUILLON" && !form.referenceCompagnie.trim()) || (responsibilityVisible && form.responsabilite === "NON_DETERMINEE") || (form.modeReparation === "PEC" && !form.garageId)}
              onClick={() =>
                void onSave({
                  referenceCompagnie:
                    form.referenceCompagnie.trim() || undefined,
                  ...(responsibilityVisible
                    ? {
                        tauxResponsabilite:
                          form.responsabilite === "NON_DETERMINEE"
                            ? null
                            : Number(form.responsabilite),
                      }
                    : {}),
                  notes: form.notes.trim() || undefined,
                  gestionnaireId: form.gestionnaireId || dossier.gestionnaireId,
                  prochaineAction: form.prochaineAction.trim() || undefined,
                  dateEcheanceAction: form.dateEcheanceAction || undefined,
                  ...(dossier.couverture.brancheCode === "AUTOMOBILE" ? {
                    typeDommage: form.typeDommage || undefined,
                    modeReparation: form.modeReparation || undefined,
                    garageId: form.garageId || null,
                  } : {}),
                }).then(() => setEditing(false)).catch(() => undefined)
              }
            >
              <Save className="size-4" />
              Enregistrer
            </Button>
            </div>
          ) : null}
        </div>
        <dl className="grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Police" value={dossier.couverture.numeroPolice} />
          <Info label="Dossier" value={dossier.couverture.numeroDossier} />
          <Info label="Compagnie" value={dossier.couverture.compagnie} />
          <Info label="Assuré" value={dossier.couverture.assure} />
          <Info label="Date de déclaration" value={formatDate(dossier.dateDeclaration)} />
          <Info label="Référence compagnie" value={dossier.referenceCompagnie} />
          <Info label="Dommages" value={dossier.typeDommage ? damageLabels[dossier.typeDommage] : undefined} />
          <Info label="Réparation" value={dossier.modeReparation ? repairLabels[dossier.modeReparation] : undefined} />
          <Info label="Garage" value={dossier.garage} />
          <Info
            label="Mouvement"
            value={`${dossier.couverture.numeroMouvement} · ${formatDate(dossier.couverture.dateEffet)}`}
          />
          <Info
            label="Véhicule"
            value={[
              dossier.couverture.immatriculation,
              dossier.couverture.marque,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <Info
            label="Attestation"
            value={dossier.couverture.numeroAttestation}
          />
          {responsibilityVisible ? <Info label="Responsabilité RC" value={dossier.tauxResponsabilite == null ? undefined : `${dossier.tauxResponsabilite} %`} /> : null}
          <Info label="Gestionnaire" value={dossier.gestionnaire} />
          <Info label="Prochaine action" value={dossier.prochaineAction} />
          <Info label="Échéance de l’action" value={formatDate(dossier.dateEcheanceAction)} />
          {dossier.notes ? <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs text-muted-foreground">Notes internes</dt><dd className="mt-1 whitespace-pre-wrap break-words">{dossier.notes}</dd></div> : null}
        </dl>
        {editing && editable ? <fieldset disabled={saving} className="mt-5 min-w-0 border-t pt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dossier.couverture.brancheCode === "AUTOMOBILE" ? <>
            <Field label="Dommages"><Select disabled={!editable || saving} value={form.typeDommage} onValueChange={(value) => update("typeDommage", value)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{Object.entries(damageLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select></Field>
            <Field label="Mode de réparation"><Select disabled={!editable || saving} value={form.modeReparation} onValueChange={(value) => setForm((current) => ({ ...current, modeReparation: value, garageId: "" }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{Object.entries(repairLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select></Field>
            <Field label={form.modeReparation === "PEC" ? "Garage conventionné" : "Garage"} required={form.modeReparation === "PEC"}><Select disabled={!editable || saving || garageQuery.isFetching || garageQuery.isError} value={form.garageId || "NONE"} onValueChange={(value) => update("garageId", value === "NONE" ? "" : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Non désigné</SelectItem>{historicalGarage && dossier.garageId && !garages.some((item) => item.id === dossier.garageId) ? <SelectItem value={dossier.garageId}>{dossier.garage || "Garage actuel"}</SelectItem> : null}{garages.map((item) => <SelectItem key={item.id} value={item.id}>{item.nom}</SelectItem>)}</SelectContent>
            </Select></Field>
            {garageQuery.isError ? <p role="alert" className="text-sm text-destructive">{garageQuery.error.message}</p> : null}
          </> : null}
          <Field label="Référence compagnie" required={dossier.statut !== "BROUILLON"}>
            <Input
              disabled={!editable}
              maxLength={100}
              value={form.referenceCompagnie}
              onChange={(event) =>
                update("referenceCompagnie", event.target.value)
              }
            />
          </Field>
          {responsibilityVisible ? (
            <div className="sm:col-span-2">
              <Field label="Responsabilité RC" required>
                <Select
                  disabled={!editable}
                  value={form.responsabilite === "NON_DETERMINEE" ? "" : form.responsabilite}
                  onValueChange={(value) => update("responsabilite", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 %</SelectItem>
                    <SelectItem value="50">50 %</SelectItem>
                    <SelectItem value="100">100 %</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}
        </div>
        <Collapsible
          open={trackingOpen}
          onOpenChange={setTrackingOpen}
          className="mt-4 border-t pt-3"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between py-1 text-left"
            >
              <span>
                <span className="text-sm font-semibold">Suivi interne</span>
                {!trackingOpen && form.prochaineAction ? (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {form.prochaineAction}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${trackingOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Gestionnaire">
                <Select
                  disabled={!editable}
                  value={form.gestionnaireId}
                  onValueChange={(value) => update("gestionnaireId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Échéance de l’action">
                <DatePicker
                  disabled={!editable}
                  date={form.dateEcheanceAction}
                  onSelect={(date) =>
                    update("dateEcheanceAction", toIsoDate(date))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Prochaine action">
                  <Input
                    disabled={!editable}
                    maxLength={500}
                    value={form.prochaineAction}
                    onChange={(event) =>
                      update("prochaineAction", event.target.value)
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes internes">
                  <Textarea
                    disabled={!editable}
                    rows={2}
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                  />
                </Field>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        </fieldset> : null}
      </section>
  );
}

function CoverageSection({
  dossier,
  assessmentVisible,
  editable,
  saving,
  onSave,
}: {
  dossier: SinistreDetail;
  assessmentVisible: boolean;
  editable: boolean;
  saving: boolean;
  onSave: (guarantees: object[]) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, GuaranteeDraft>>(() =>
    Object.fromEntries(
      dossier.garanties.map((item) => [item.id, toGuaranteeDraft(item)]),
    ),
  );
  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        dossier.garanties.map((item) => [item.id, toGuaranteeDraft(item)]),
      ),
    );
  }, [dossier.garanties]);

  const changed = dossier.garanties.filter((item) =>
    guaranteeDraftChanged(item, drafts[item.id]),
  );
  const involvedCount = dossier.garanties.filter(
    (item) => drafts[item.id]?.involved ?? item.impliquee,
  ).length;

  return (
    <section className="min-w-0 border-y">
    <SectionHeader
      title={assessmentVisible ? "Décision de couverture" : "Garanties impliquées"}
      action={
        editable && !editing ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="size-4" />Modifier</Button> : editable ? (
          <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={saving} onClick={() => {
            setDrafts(Object.fromEntries(dossier.garanties.map((item) => [item.id, toGuaranteeDraft(item)])));
            setEditing(false);
          }}>Annuler</Button>
          <Button
            size="sm"
            disabled={saving || changed.length === 0}
            onClick={() =>
              void onSave(
                changed.map((item) => {
                  const draft = drafts[item.id];
                  return {
                    id: item.id,
                    decisionCouverture: draft.decision,
                    impliquee: draft.involved,
                    franchiseAppliquee: draft.franchise
                      ? Number(draft.franchise)
                      : undefined,
                    montantIndemnisable: draft.indemnisable
                      ? Number(draft.indemnisable)
                      : undefined,
                  };
                }),
              ).then(() => setEditing(false)).catch(() => undefined)
            }
          >
            <Save className="size-4" />
            Enregistrer
          </Button>
          </div>
        ) : null
      }
    />
      <p className="px-4 py-2 text-sm text-muted-foreground">{involvedCount} sur {dossier.garanties.length} garantie(s) impliquée(s) · Montants en MAD</p>
      {!editing || !editable ? <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Garantie</TableHead>
              <TableHead>Impliquée</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              {assessmentVisible ? <>
                <TableHead>Décision</TableHead>
                <TableHead className="text-right">Franchise appliquée</TableHead>
                <TableHead className="text-right">Indemnisable</TableHead>
              </> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dossier.garanties.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-normal">
                  <span className="font-medium">{item.code} · {item.libelle}</span>
                  <p className="text-xs text-muted-foreground">Franchise contractuelle {item.tauxFranchise ?? 0} % / {formatMoney(item.franchiseMinimale)}</p>
                </TableCell>
                <TableCell>{item.impliquee ? "Oui" : "Non"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(item.capital)}</TableCell>
                {assessmentVisible ? <>
                  <TableCell>{coverageDecisionLabels[item.decisionCouverture]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(item.franchiseAppliquee)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(item.montantIndemnisable)}</TableCell>
                </> : null}
              </TableRow>
            ))}
            {dossier.garanties.length === 0 ? <TableRow><TableCell colSpan={assessmentVisible ? 6 : 3} className="py-6 text-center text-muted-foreground">Aucune garantie.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div> : <div className={assessmentVisible ? "grid gap-3 py-4" : "divide-y"}>
        {dossier.garanties.map((item) => {
          const draft = drafts[item.id] ?? toGuaranteeDraft(item);
          return (
            <GuaranteeRow
              key={item.id}
              item={item}
              draft={draft}
              assessmentVisible={assessmentVisible}
              editable={editable && !saving}
              onChange={(next) =>
                setDrafts((current) => ({ ...current, [item.id]: next }))
              }
            />
          );
        })}
      </div>}
      {dossier.assistances?.length ? <div className="px-4 pb-4"><SinistreAssistanceTable items={dossier.assistances} /></div> : null}
    </section>
  );
}

type GuaranteeDraft = {
  decision: DecisionCouverture;
  involved: boolean;
  franchise: string;
  indemnisable: string;
};

const coverageDecisionLabels: Record<DecisionCouverture, string> = {
  A_ETUDIER: "À étudier",
  ACCEPTEE: "Acceptée",
  PARTIELLE: "Partiellement acceptée",
  REFUSEE: "Refusée",
};

function GuaranteeRow({
  item,
  draft,
  assessmentVisible,
  editable,
  onChange,
}: {
  item: SinistreDetail["garanties"][number];
  draft: GuaranteeDraft;
  assessmentVisible: boolean;
  editable: boolean;
  onChange: (draft: GuaranteeDraft) => void;
}) {
  return (
    <div
      className={
        assessmentVisible
          ? "grid items-end gap-3 border-b py-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_190px_150px_170px]"
          : "grid items-center gap-3 px-4 py-3"
      }
    >
      <div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={draft.involved}
            disabled={!editable}
            onCheckedChange={(checked) =>
              onChange({ ...draft, involved: checked === true })
            }
            aria-label={`Garantie impliquée ${item.libelle}`}
          />
          <p className="font-medium">
            {item.code} · {item.libelle}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Capital {formatMoney(item.capital)} · franchise contractuelle{" "}
          {item.tauxFranchise ?? 0}% / {formatMoney(item.franchiseMinimale)}
        </p>
      </div>
      {assessmentVisible ? (
      <>
      <Field label="Décision">
        <Select
          disabled={!editable}
          value={draft.decision}
          onValueChange={(value) =>
            onChange({ ...draft, decision: value as DecisionCouverture })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A_ETUDIER">À étudier</SelectItem>
            <SelectItem value="ACCEPTEE">Acceptée</SelectItem>
            <SelectItem value="PARTIELLE">Partiellement acceptée</SelectItem>
            <SelectItem value="REFUSEE">Refusée</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Franchise appliquée">
        <Input
          disabled={!editable}
          type="number"
          min="0"
          value={draft.franchise}
          onChange={(event) =>
            onChange({ ...draft, franchise: event.target.value })
          }
        />
      </Field>
      <Field label="Montant indemnisable">
        <Input
          disabled={!editable}
          type="number"
          min="0"
          value={draft.indemnisable}
          onChange={(event) =>
            onChange({ ...draft, indemnisable: event.target.value })
          }
        />
      </Field>
      </>
      ) : null}
    </div>
  );
}

function toGuaranteeDraft(
  item: SinistreDetail["garanties"][number],
): GuaranteeDraft {
  return {
    decision: item.decisionCouverture,
    involved: item.impliquee,
    franchise:
      item.franchiseAppliquee == null ? "" : String(item.franchiseAppliquee),
    indemnisable:
      item.montantIndemnisable == null
        ? ""
        : String(item.montantIndemnisable),
  };
}

function guaranteeDraftChanged(
  item: SinistreDetail["garanties"][number],
  draft?: GuaranteeDraft,
) {
  if (!draft) return false;
  const initial = toGuaranteeDraft(item);
  return (
    draft.decision !== initial.decision ||
    draft.involved !== initial.involved ||
    draft.franchise !== initial.franchise ||
    draft.indemnisable !== initial.indemnisable
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

function toIsoDate(date?: Date) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isAtLeastTransmitted(statut: StatutSinistre) {
  return [
    "TRANSMIS_COMPAGNIE",
    "EXPERTISE",
    "EN_ATTENTE_REGLEMENT",
    "PARTIELLEMENT_REGLE",
    "REGLE",
    "CLOTURE",
    "ROUVERT",
  ].includes(statut);
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

function DocumentAttention({ dossier, onOpen }: { dossier: SinistreDetail; onOpen: () => void }) {
  const missing = dossier.workflow.documentsRequis.filter((item) => item.obligatoire && !item.recu && !item.valide).length;
  const messages = [
    missing > 0 ? `${missing} document(s) obligatoire(s) manquant(s)` : null,
    dossier.workflow.documentsRecus > 0 ? `${dossier.workflow.documentsRecus} à contrôler` : null,
    dossier.workflow.documentsRejetes > 0 ? `${dossier.workflow.documentsRejetes} rejeté(s)` : null,
  ].filter(Boolean);
  if (messages.length === 0) return null;
  return <div className="flex flex-wrap items-center justify-between gap-2 border-y border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
    <p className="flex min-w-0 items-center gap-2"><CircleAlert className="size-4 shrink-0" /><span>{messages.join(" · ")}</span></p>
    <Button size="sm" variant="ghost" onClick={onOpen}><FileText className="size-4" />Voir les documents</Button>
  </div>;
}
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label>{label}{required ? <span className="text-red-500">*</span> : null}</Label>
      {children}
    </div>
  );
}
function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value || "-"}</dd>
    </div>
  );
}
