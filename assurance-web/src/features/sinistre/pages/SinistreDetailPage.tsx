import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  Download,
  FileCheck2,
  FilePlus2,
  FileX2,
  Plus,
  Save,
  Trash2,
  UserRoundSearch,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob } from "@/lib/download";
import { referenceApi } from "@/features/production/api/references";
import { useAuthStore } from "@/store/auth-store";
import { sinistreApi, sinistreKeys } from "../api";
import { formatDate, formatMoney, natureLabels } from "../format";
import { SinistreStatusBadge } from "../components/SinistreStatusBadge";
import {
  SinistreTransitionDialog,
  hasAvailableTransition,
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
  const [partyOpen, setPartyOpen] = useState(false);
  const [financeMode, setFinanceMode] = useState<FinanceDialogMode | null>(
    null,
  );
  const [documentOpen, setDocumentOpen] = useState(false);
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
    enabled: canManage,
  });
  const garages = useQuery({
    queryKey: sinistreKeys.garages(false),
    queryFn: () => sinistreApi.garages(false),
    enabled: canManage,
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
    mutationFn: ({ id, request }: { id: string; request: object }) =>
      sinistreApi.updateGuarantee(sinistreId, id, request),
    onSuccess: (result) => accept(result, "Garantie mise à jour"),
    onError: fail,
  });
  const party = useMutation({
    mutationFn: (request: object) => sinistreApi.addParty(sinistreId, request),
    onSuccess: (result) => {
      setPartyOpen(false);
      accept(result, "Partie ajoutée");
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
    }: {
      type: TypeDocument;
      commentaire: string;
      file: File;
    }) => sinistreApi.uploadDocument(sinistreId, type, commentaire, file),
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
  const locked = dossier.statut === "CLOTURE" || dossier.statut === "ANNULE";
  const cancelledIds = new Set(
    dossier.operations
      .filter((item) => item.type === "ANNULATION" && item.operationAnnuleeId)
      .map((item) => item.operationAnnuleeId),
  );

  return (
    <div className="grid gap-4">
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
        {canManage && hasAvailableTransition(dossier.statut) ? (
          <Button onClick={() => setTransitionOpen(true)}>
            Faire évoluer le dossier
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Provision"
          value={formatMoney(dossier.totaux.provisionCourante)}
        />
        <Metric label="Réglé" value={formatMoney(dossier.totaux.totalRegle)} />
        <Metric label="Frais" value={formatMoney(dossier.totaux.totalFrais)} />
        <Metric
          label="Recours"
          value={formatMoney(dossier.totaux.totalRecours)}
        />
        <Metric
          label="Reste à régler"
          value={formatMoney(dossier.totaux.resteARegler)}
        />
      </div>
      <Tabs defaultValue="synthese" className="grid gap-4">
        <TabsList className="h-auto justify-start overflow-x-auto">
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
          <TabsTrigger value="couverture">Couverture et parties</TabsTrigger>
          <TabsTrigger value="expertise">Expertise et documents</TabsTrigger>
          <TabsTrigger value="finance">Financier</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="synthese">
          <GeneralSection
            dossier={dossier}
            cities={cities.data ?? []}
            editable={canManage && !locked}
            saving={update.isPending}
            onSave={(request) => update.mutate(request)}
          />
        </TabsContent>
        <TabsContent value="couverture" className="grid gap-4">
          <CoverageSection
            dossier={dossier}
            editable={canManage && !locked}
            saving={guarantee.isPending}
            onSave={(id, request) => guarantee.mutate({ id, request })}
          />
          <section className="rounded-md border bg-card">
            <SectionHeader
              title="Parties impliquées"
              action={
                canManage && !locked ? (
                  <Button size="sm" onClick={() => setPartyOpen(true)}>
                    <Plus className="size-4" />
                    Ajouter
                  </Button>
                ) : null
              }
            />
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
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Retirer"
                            onClick={() => removeParty.mutate(item.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {dossier.parties.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Aucune partie impliquée ajoutée.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="expertise" className="grid gap-4">
          <section className="rounded-md border bg-card">
            <SectionHeader
              title="Missions d’expertise"
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
            />
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
                        className="py-8 text-center text-muted-foreground"
                      >
                        Aucune expertise mandatée.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </section>
          <section className="rounded-md border bg-card">
            <SectionHeader
              title="Documents"
              action={
                canManage && !locked ? (
                  <Button size="sm" onClick={() => setDocumentOpen(true)}>
                    <FilePlus2 className="size-4" />
                    Déposer
                  </Button>
                ) : null
              }
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Déposé par</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dossier.documents.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.nomFichier}
                      </TableCell>
                      <TableCell>{documentTypeLabels[item.type]}</TableCell>
                      <TableCell>{item.deposePar}</TableCell>
                      <TableCell>{formatDate(item.createdAt)}</TableCell>
                      <TableCell>{item.statut}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Télécharger"
                            onClick={() =>
                              download.mutate({
                                id: item.id,
                                name: item.nomFichier,
                              })
                            }
                          >
                            <Download className="size-4" />
                          </Button>
                          {canManage && item.statut === "RECU" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Valider"
                                onClick={() =>
                                  reviewDocument.mutate({
                                    id: item.id,
                                    statut: "VALIDE",
                                  })
                                }
                              >
                                <FileCheck2 className="size-4 text-emerald-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Rejeter"
                                onClick={() =>
                                  reviewDocument.mutate({
                                    id: item.id,
                                    statut: "REJETE",
                                  })
                                }
                              >
                                <FileX2 className="size-4 text-destructive" />
                              </Button>
                            </>
                          ) : null}
                          {canManage && !locked && item.statut !== "VALIDE" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Supprimer"
                              onClick={() =>
                                setDocumentToDelete({
                                  id: item.id,
                                  name: item.nomFichier,
                                })
                              }
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {dossier.documents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Aucun document déposé.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="finance" className="grid gap-4">
          <section className="rounded-md border bg-card">
            <SectionHeader
              title="Provisions"
              action={
                canFinance && !locked ? (
                  <Button size="sm" onClick={() => setFinanceMode("PROVISION")}>
                    <Plus className="size-4" />
                    Provision
                  </Button>
                ) : null
              }
            />
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
                        className="py-8 text-center text-muted-foreground"
                      >
                        Aucune provision.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </section>
          <section className="rounded-md border bg-card">
            <SectionHeader
              title="Opérations financières"
              action={
                canFinance && !locked ? (
                  <Button size="sm" onClick={() => setFinanceMode("OPERATION")}>
                    <Banknote className="size-4" />
                    Nouvelle opération
                  </Button>
                ) : null
              }
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Référence / bénéficiaire</TableHead>
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
                      <TableCell className="font-medium">
                        {formatMoney(item.montant)}
                      </TableCell>
                      <TableCell>
                        {[item.reference, item.beneficiaire]
                          .filter(Boolean)
                          .join(" · ") || "-"}
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
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Aucune opération financière.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="historique">
          <section className="rounded-md border bg-card">
            <SectionHeader title="Journal du dossier" />
            <div className="divide-y">
              {dossier.evenements.map((item) => (
                <div key={item.id} className="flex gap-4 p-4">
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-sky-600" />
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
                        ? ` · ${item.ancienStatut} → ${item.nouveauStatut}`
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
          </section>
        </TabsContent>
      </Tabs>
      <SinistreTransitionDialog
        open={transitionOpen}
        current={dossier.statut}
        saving={transition.isPending}
        onOpenChange={setTransitionOpen}
        onSubmit={(statut, motif) => transition.mutate({ statut, motif })}
      />
      <SinistrePartyDialog
        open={partyOpen}
        saving={party.isPending}
        onOpenChange={setPartyOpen}
        onSubmit={(request) => party.mutate(request)}
      />
      <SinistreFinanceDialog
        open={financeMode !== null}
        mode={financeMode ?? "PROVISION"}
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
        onOpenChange={setDocumentOpen}
        onSubmit={(type, commentaire, file) =>
          document.mutate({ type, commentaire, file })
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
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

function GeneralSection({
  dossier,
  cities,
  editable,
  saving,
  onSave,
}: {
  dossier: SinistreDetail;
  cities: Array<{ id: string; libelle: string }>;
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
    tauxResponsabilite: "",
    notes: "",
  });
  useEffect(
    () =>
      setForm({
        referenceCompagnie: dossier.referenceCompagnie || "",
        villeId: dossier.villeId || "",
        lieu: dossier.lieu || "",
        circonstances: dossier.circonstances || "",
        numeroPv: dossier.numeroPv || "",
        tauxResponsabilite:
          dossier.tauxResponsabilite == null
            ? ""
            : String(dossier.tauxResponsabilite),
        notes: dossier.notes || "",
      }),
    [dossier],
  );
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="rounded-md border bg-card p-5">
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
                  tauxResponsabilite: form.tauxResponsabilite
                    ? Number(form.tauxResponsabilite)
                    : undefined,
                  notes: form.notes.trim() || undefined,
                })
              }
            >
              <Save className="size-4" />
              Enregistrer
            </Button>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label="Ville">
            <SinistreVilleSelect
              cities={cities}
              disabled={!editable}
              value={form.villeId}
              onValueChange={(value) => update("villeId", value)}
            />
          </Field>
          <Field label="Responsabilité (%)">
            <Input
              disabled={!editable}
              type="number"
              min="0"
              max="100"
              value={form.tauxResponsabilite}
              onChange={(event) =>
                update("tauxResponsabilite", event.target.value)
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Lieu">
              <Input
                disabled={!editable}
                value={form.lieu}
                onChange={(event) => update("lieu", event.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Circonstances">
              <Textarea
                disabled={!editable}
                rows={5}
                value={form.circonstances}
                onChange={(event) =>
                  update("circonstances", event.target.value)
                }
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes internes">
              <Textarea
                disabled={!editable}
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </Field>
          </div>
        </div>
      </section>
      <section className="rounded-md border bg-card p-5">
        <h2 className="mb-4 font-semibold">Couverture contractuelle</h2>
        <dl className="grid gap-3 text-sm">
          <Info label="Police" value={dossier.couverture.numeroPolice} />
          <Info label="Dossier" value={dossier.couverture.numeroDossier} />
          <Info label="Compagnie" value={dossier.couverture.compagnie} />
          <Info label="Assuré" value={dossier.couverture.assure} />
          <Info
            label="Mouvement"
            value={`${dossier.couverture.numeroMouvement} · du ${formatDate(dossier.couverture.dateEffet)}`}
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
      </section>
    </div>
  );
}

function CoverageSection({
  dossier,
  editable,
  saving,
  onSave,
}: {
  dossier: SinistreDetail;
  editable: boolean;
  saving: boolean;
  onSave: (id: string, request: object) => void;
}) {
  return (
    <section className="rounded-md border bg-card">
      <SectionHeader title="Garanties au jour du sinistre" />
      <div className="grid gap-3 p-4">
        {dossier.garanties.map((item) => (
          <GuaranteeRow
            key={item.id}
            item={item}
            editable={editable}
            saving={saving}
            onSave={(request) => onSave(item.id, request)}
          />
        ))}
      </div>
    </section>
  );
}
function GuaranteeRow({
  item,
  editable,
  saving,
  onSave,
}: {
  item: SinistreDetail["garanties"][number];
  editable: boolean;
  saving: boolean;
  onSave: (request: object) => void;
}) {
  const [decision, setDecision] = useState<DecisionCouverture>(
    item.decisionCouverture,
  );
  const [franchise, setFranchise] = useState(
    item.franchiseAppliquee == null ? "" : String(item.franchiseAppliquee),
  );
  const [indemnisable, setIndemnisable] = useState(
    item.montantIndemnisable == null ? "" : String(item.montantIndemnisable),
  );
  useEffect(() => {
    setDecision(item.decisionCouverture);
    setFranchise(
      item.franchiseAppliquee == null ? "" : String(item.franchiseAppliquee),
    );
    setIndemnisable(
      item.montantIndemnisable == null ? "" : String(item.montantIndemnisable),
    );
  }, [item]);
  return (
    <div className="grid items-end gap-3 rounded-md border p-3 md:grid-cols-[minmax(220px,1fr)_190px_150px_170px_auto]">
      <div>
        <p className="font-medium">
          {item.code} · {item.libelle}
        </p>
        <p className="text-xs text-muted-foreground">
          Capital {formatMoney(item.capital)} · franchise contractuelle{" "}
          {item.tauxFranchise ?? 0}% / {formatMoney(item.franchiseMinimale)}
        </p>
      </div>
      <Field label="Décision">
        <Select
          disabled={!editable}
          value={decision}
          onValueChange={(value) => setDecision(value as DecisionCouverture)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A_ETUDIER">À étudier</SelectItem>
            <SelectItem value="ACCEPTEE">Acceptée</SelectItem>
            <SelectItem value="REFUSEE">Refusée</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Franchise appliquée">
        <Input
          disabled={!editable}
          type="number"
          min="0"
          value={franchise}
          onChange={(event) => setFranchise(event.target.value)}
        />
      </Field>
      <Field label="Montant indemnisable">
        <Input
          disabled={!editable}
          type="number"
          min="0"
          value={indemnisable}
          onChange={(event) => setIndemnisable(event.target.value)}
        />
      </Field>
      {editable ? (
        <Button
          size="icon"
          variant="outline"
          disabled={saving}
          aria-label={`Enregistrer ${item.code}`}
          onClick={() =>
            onSave({
              decisionCouverture: decision,
              impliquee: item.impliquee,
              franchiseAppliquee: franchise ? Number(franchise) : undefined,
              montantIndemnisable: indemnisable
                ? Number(indemnisable)
                : undefined,
            })
          }
        >
          <Save className="size-4" />
        </Button>
      ) : null}
    </div>
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
