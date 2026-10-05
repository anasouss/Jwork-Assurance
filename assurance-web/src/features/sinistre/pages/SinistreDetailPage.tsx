import { useEffect, useState } from "react";
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
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRoundSearch,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { referenceApi } from "@/features/production/api/references";
import { useAuthStore } from "@/store/auth-store";
import { sinistreApi, sinistreKeys } from "../api";
import { formatDate, formatMoney, natureLabels, statusLabels } from "../format";
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
import { SinistreVilleSelect } from "../components/SinistreVilleSelect";
import type {
  DecisionCouverture,
  SinistreDetail,
  StatutSinistre,
  TypeDocument,
} from "../types";

export default function SinistreDetailPage() {
  const { sinistreId = "" } = useParams();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("sinistre:manage");
  const canFinance = permissions.includes("sinistre:finance");
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const cities = useQuery({
    queryKey: ["referentiel", "villes", "sinistre"],
    queryFn: () => referenceApi.list("villes"),
    staleTime: 60_000,
  });
  const experts = useQuery({
    queryKey: sinistreKeys.experts(false),
    queryFn: () => sinistreApi.experts(false),
    enabled: canManage && Boolean(detail.data),
  });
  const garages = useQuery({
    queryKey: sinistreKeys.garages(false),
    queryFn: () => sinistreApi.garages(false),
    enabled: canManage && Boolean(detail.data),
  });
  const managers = useQuery({
    queryKey: sinistreKeys.managers(),
    queryFn: sinistreApi.managers,
    enabled: canManage,
  });
  const treasuryAccounts = useQuery({
    queryKey: sinistreKeys.treasuryAccounts(),
    queryFn: sinistreApi.treasuryAccounts,
    enabled:
      canFinance &&
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
  const locked =
    dossier.statut === "CLOTURE" ||
    dossier.statut === "ANNULE" ||
    dossier.statut === "REJETE";
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
    <div className="-mx-2 grid gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-2 -ml-3">
            <Link to="/app/sinistre/dossiers">
              <ArrowLeft className="size-4" />
              Retour aux dossiers
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{dossier.numeroSinistre}</h1>
            <SinistreStatusBadge statut={dossier.statut} />
          </div>
          <p className="text-sm text-muted-foreground">
            {natureLabels[dossier.nature]} du {formatDate(dossier.dateSinistre)}{" "}
            · {dossier.couverture.assure}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="size-4" />
            Historique
          </Button>
          {canManage && dossier.workflow.transitions.length > 0 ? (
            <Button onClick={() => setTransitionOpen(true)}>
              Faire évoluer le dossier
            </Button>
          ) : null}
        </div>
      </div>
      <WorkflowReadiness dossier={dossier} />
      <div className="grid gap-3">
        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <GeneralSection
            dossier={dossier}
            cities={cities.data ?? []}
            managers={managers.data ?? []}
            responsibilityVisible={
              coverageAssessmentVisible && dossier.nature === "ACCIDENT"
            }
            editable={canManage && !locked}
            saving={update.isPending}
            onSave={(request) => update.mutate(request)}
          />
          <div className="min-w-0 xl:sticky xl:top-4">
            <DocumentsPanel
              dossier={dossier}
              editable={canManage && !locked}
              reviewing={reviewDocument.isPending}
              downloading={download.isPending}
              onAdd={(type) => {
                setDocumentInitialType(type ?? null);
                setDocumentOpen(true);
              }}
              onDownload={(id, name) => download.mutate({ id, name })}
              onReview={(id, statut) =>
                reviewDocument.mutate({ id, statut })
              }
              onDelete={(id, name) => setDocumentToDelete({ id, name })}
            />
          </div>
        </div>
        <div className="grid min-w-0 gap-3">
        <CoverageSection
            dossier={dossier}
            assessmentVisible={coverageAssessmentVisible}
            editable={canManage && !locked}
            saving={guarantee.isPending}
            onSave={(guarantees) => guarantee.mutate(guarantees)}
        />
        <WorkflowPanel
          title="Parties impliquées"
          summary={`${dossier.parties.length} partie(s)`}
          defaultOpen={dossier.parties.length > 0}
          action={
            canManage && !locked ? (
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
                        {canManage && !locked ? (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" aria-label="Modifier" onClick={() => { setEditingParty(item); setPartyOpen(true); }}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="Retirer" onClick={() => removeParty.mutate(item.id)}>
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
        <div className="grid gap-4">
            <WorkflowPanel
              title="Missions d’expertise"
              summary={`${dossier.missionsExpertise.length} mission(s)`}
              defaultOpen={
                dossier.statut === "EXPERTISE" ||
                dossier.missionsExpertise.length > 0
              }
              action={
                canManage && !locked ? (
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
                        canManage && !locked ? "cursor-pointer" : undefined
                      }
                      onClick={() => {
                        if (canManage && !locked) {
                          setEditingMission(item);
                          setMissionOpen(true);
                        }
                      }}
                    >
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
                        colSpan={6}
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
        </div>
        {financeVisible ? (
          <div className="grid gap-4">
            <FinancialSummary dossier={dossier} />
            <WorkflowPanel
              title="Provisions"
              summary={`${dossier.provisions.length} écriture(s)`}
              defaultOpen={dossier.provisions.length > 0}
              action={
                canFinance && !locked ? (
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
                canFinance && !locked ? (
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
                        {canFinance &&
                        !locked &&
                        item.type !== "ANNULATION" &&
                        !cancelledIds.has(item.id) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Annuler l’opération"
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
        ) : null}
        </div>
      </div>
      <HistoryDialog
        dossier={dossier}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
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
        open={missionOpen}
        mission={editingMission}
        experts={experts.data ?? []}
        garages={garages.data ?? []}
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
    <section className="overflow-hidden rounded-md border bg-card">
      <SectionHeader title="Situation financière" />
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

function HistoryDialog({
  dossier,
  open,
  onOpenChange,
}: {
  dossier: SinistreDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Historique du dossier</DialogTitle>
          <DialogDescription>
            Changements de statut et opérations enregistrées sur {dossier.numeroSinistre}.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y rounded-md border">
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
                </p>
              </div>
            </div>
          ))}
          {dossier.evenements.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">
              Aucun événement.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
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
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
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
      className="overflow-hidden rounded-md border bg-card"
    >
      <div className="flex min-h-12 items-center border-l-2 border-sky-900 bg-sky-700 text-white dark:bg-sky-800">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-3 text-left"
          >
            <ChevronDown
              className={`size-4 shrink-0 text-sky-100 transition-transform ${open ? "rotate-180" : ""}`}
            />
            <span className="font-semibold">{title}</span>
            {summary ? (
              <span className="truncate text-sm text-sky-100">
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
  reviewing,
  downloading,
  onAdd,
  onDownload,
  onReview,
  onDelete,
}: {
  dossier: SinistreDetail;
  editable: boolean;
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
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex min-h-12 items-center justify-between gap-3 border-l-2 border-sky-900 bg-sky-700 px-4 py-3 text-white dark:bg-sky-800">
        <div className="min-w-0">
          <h2 className="font-semibold">Pièces du dossier</h2>
          <p className="text-xs text-sky-100">
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

      <div className="border-t">
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
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : item.recu
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : item.obligatoire
                            ? "cursor-pointer border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400"
                            : "cursor-pointer border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="truncate">{item.libelle}</span>
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

      <div className="border-t">
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
              <div key={item.id} className="flex items-start gap-2 px-3 py-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-sky-700" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={item.nomFichier}>
                    {item.nomFichier}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {documentTypeLabels[item.type]}
                    {item.dateDocument ? ` · ${formatDate(item.dateDocument)}` : ""}
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium ${
                      item.statut === "VALIDE"
                        ? "text-emerald-700"
                        : item.statut === "REJETE"
                          ? "text-destructive"
                          : "text-amber-700"
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
                  {editable && item.statut === "RECU" ? (
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
                  {editable && item.statut !== "VALIDE" ? (
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
    <div className={`border-t px-3 py-3 ${active ? "bg-sky-50/50" : ""}`}>
      <div className="flex items-start gap-2.5">
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
            tone === "success"
              ? "bg-emerald-100 text-emerald-700"
              : active
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {tone === "success" ? <CircleCheck className="size-3.5" /> : number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{title}</p>
            <span
              className={`shrink-0 text-xs font-medium ${
                tone === "success"
                  ? "text-emerald-700"
                  : tone === "warning"
                    ? "text-amber-700"
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

function GeneralSection({
  dossier,
  cities,
  managers,
  responsibilityVisible,
  editable,
  saving,
  onSave,
}: {
  dossier: SinistreDetail;
  cities: Array<{ id: string; libelle: string }>;
  managers: Array<{ id: string; nom: string }>;
  responsibilityVisible: boolean;
  editable: boolean;
  saving: boolean;
  onSave: (request: object) => void;
}) {
  const [form, setForm] = useState({
    referenceCompagnie: "",
    villeId: "",
    lieu: "",
    circonstances: "",
    numeroPv: "",
    responsabilite: "NON_DETERMINEE",
    notes: "",
    gestionnaireId: "",
    prochaineAction: "",
    dateEcheanceAction: "",
  });
  const [trackingOpen, setTrackingOpen] = useState(
    Boolean(
      dossier.prochaineAction || dossier.dateEcheanceAction || dossier.notes,
    ),
  );
  useEffect(
    () =>
      setForm({
        referenceCompagnie: dossier.referenceCompagnie || "",
        villeId: dossier.villeId || "",
        lieu: dossier.lieu || "",
        circonstances: dossier.circonstances || "",
        numeroPv: dossier.numeroPv || "",
        responsabilite:
          dossier.tauxResponsabilite == null
            ? "NON_DETERMINEE"
            : String(dossier.tauxResponsabilite),
        notes: dossier.notes || "",
        gestionnaireId: dossier.gestionnaireId || "",
        prochaineAction: dossier.prochaineAction || "",
        dateEcheanceAction: dossier.dateEcheanceAction || "",
      }),
    [dossier],
  );
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
      <section className="rounded-md border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Informations du sinistre</h2>
          {editable ? (
            <Button
              size="sm"
              disabled={saving}
              onClick={() =>
                onSave({
                  referenceCompagnie:
                    form.referenceCompagnie.trim() || undefined,
                  villeId: form.villeId || undefined,
                  lieu: form.lieu.trim() || undefined,
                  circonstances: form.circonstances.trim() || undefined,
                  numeroPv: form.numeroPv.trim() || undefined,
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
                })
              }
            >
              <Save className="size-4" />
              Enregistrer
            </Button>
          ) : null}
        </div>
        <dl className="mb-4 grid gap-x-5 gap-y-3 border-y bg-slate-50 px-3 py-3 text-sm sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <Info label="Police" value={dossier.couverture.numeroPolice} />
          <Info label="Dossier" value={dossier.couverture.numeroDossier} />
          <Info label="Compagnie" value={dossier.couverture.compagnie} />
          <Info label="Assuré" value={dossier.couverture.assure} />
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
        </dl>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ville">
            <SinistreVilleSelect
              cities={cities}
              disabled={!editable}
              value={form.villeId}
              onValueChange={(value) => update("villeId", value)}
            />
          </Field>
          <Field label="Lieu">
            <Input
              disabled={!editable}
              value={form.lieu}
              onChange={(event) => update("lieu", event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Circonstances">
              <Textarea
                disabled={!editable}
                rows={3}
                value={form.circonstances}
                onChange={(event) =>
                  update("circonstances", event.target.value)
                }
              />
            </Field>
          </div>
          <Field label="Référence compagnie">
            <Input
              disabled={!editable}
              value={form.referenceCompagnie}
              onChange={(event) =>
                update("referenceCompagnie", event.target.value)
              }
            />
          </Field>
          <Field label="N° PV">
            <Input
              disabled={!editable}
              value={form.numeroPv}
              onChange={(event) => update("numeroPv", event.target.value)}
            />
          </Field>
          {responsibilityVisible ? (
            <div className="sm:col-span-2">
              <Field label="Responsabilité retenue">
                <Select
                  disabled={!editable}
                  value={form.responsabilite}
                  onValueChange={(value) => update("responsabilite", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NON_DETERMINEE">À déterminer</SelectItem>
                    <SelectItem value="0">Adversaire responsable</SelectItem>
                    <SelectItem value="50">Responsabilité partagée 50/50</SelectItem>
                    <SelectItem value="100">Assuré responsable</SelectItem>
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
  onSave: (guarantees: object[]) => void;
}) {
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
    <WorkflowPanel
      title={assessmentVisible ? "Décision de couverture" : "Garanties impliquées"}
      summary={`${involvedCount} sur ${dossier.garanties.length} sélectionnée(s)`}
      defaultOpen={!assessmentVisible || involvedCount === 0}
      action={
        editable ? (
          <Button
            size="sm"
            disabled={saving || changed.length === 0}
            onClick={() =>
              onSave(
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
              )
            }
          >
            <Save className="size-4" />
            Enregistrer
          </Button>
        ) : null
      }
    >
      <div className={assessmentVisible ? "grid gap-3 p-4" : "divide-y"}>
        {dossier.garanties.map((item) => {
          const draft = drafts[item.id] ?? toGuaranteeDraft(item);
          return (
            <GuaranteeRow
              key={item.id}
              item={item}
              draft={draft}
              assessmentVisible={assessmentVisible}
              editable={editable}
              onChange={(next) =>
                setDrafts((current) => ({ ...current, [item.id]: next }))
              }
            />
          );
        })}
      </div>
    </WorkflowPanel>
  );
}

type GuaranteeDraft = {
  decision: DecisionCouverture;
  involved: boolean;
  franchise: string;
  indemnisable: string;
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
          ? "grid items-end gap-3 rounded-md border p-3 md:grid-cols-[minmax(220px,1fr)_190px_150px_170px]"
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

function WorkflowReadiness({ dossier }: { dossier: SinistreDetail }) {
  const blocked = dossier.workflow.transitions.filter(
    (transition) => !transition.autorisee,
  );
  if (
    blocked.length === 0 &&
    dossier.workflow.documentsRecus === 0 &&
    dossier.workflow.documentsRejetes === 0
  ) {
    return null;
  }
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-amber-950">
            Actions requises avant la prochaine étape
          </h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-amber-950/80">
            {dossier.workflow.documentsRecus > 0 ? (
              <span>{dossier.workflow.documentsRecus} document(s) à contrôler</span>
            ) : null}
            {dossier.workflow.documentsRejetes > 0 ? (
              <span>{dossier.workflow.documentsRejetes} document(s) rejeté(s) à traiter</span>
            ) : null}
          </div>
      {blocked.length > 0 ? (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {blocked.map((transition) => (
            <div key={transition.statut}>
              <p className="text-sm font-medium">
                Avant « {statusLabels[transition.statut]} »
              </p>
              <ul className="mt-0.5 grid gap-0.5 text-sm text-amber-950/80">
                {transition.blocages.map((blocker) => (
                  <li key={blocker}>• {blocker}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
        </div>
      </div>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "-"}</dd>
    </div>
  );
}
