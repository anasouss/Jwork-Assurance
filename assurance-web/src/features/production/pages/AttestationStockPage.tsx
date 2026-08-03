import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, ClipboardList, Plus, Settings2, Truck } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { attestationStockApi } from "../api/attestation-stock";
import { referenceApi } from "../api/references";
import { AttestationCancelDialog } from "../components/AttestationCancelDialog";
import {
  AttestationDeliveryCreateDialog,
  type CreateLivraisonForm,
  type CreateLivraisonLine,
  type LivraisonSource,
} from "../components/AttestationDeliveryCreateDialog";
import { AttestationDeliveryDetailsDialog } from "../components/AttestationDeliveryDetailsDialog";
import {
  ALL_DELIVERY_FILTERS,
  AttestationDeliveryFilters,
} from "../components/AttestationDeliveryFilters";
import { AttestationDeliveryTable } from "../components/AttestationDeliveryTable";
import {
  AttestationReceptionDialog,
  type AttestationReceptionLine,
} from "../components/AttestationReceptionDialog";
import {
  ALL_STOCK_FILTERS,
  AttestationStockSearchPanel,
  type AttestationStockFilters,
} from "../components/AttestationStockSearchPanel";
import { AttestationThresholdsDialog, type AttestationThresholdForm } from "../components/AttestationThresholdsDialog";
import { attestationStockKeys, referenceKeys } from "@/lib/query-keys";
import {
  attestationStockFiltersFromSearchParams,
  attestationStockPageFromSearchParams,
  attestationStockSearchParams,
} from "../attestation-stock/stock-filters";
import type {
  AttestationStockCompanyUsage,
  AttestationStockItem,
  LivraisonAttestation,
  ReferenceOption,
} from "../types";

const today = () => new Date().toISOString().slice(0, 10);
const palette = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#be185d"];

function emptyCreateLine(): CreateLivraisonLine {
  return {
    id: crypto.randomUUID(),
    groupeUsageAttestationCode: "",
    quantiteDemandee: "1",
    numeroDebut: "",
    numeroFin: "",
  };
}

function emptyCreateForm(): CreateLivraisonForm {
  return {
    compagnieAssuranceId: "",
    dateDemande: today(),
    dateReception: today(),
    referenceBl: "",
    commentaireDecision: "",
    lignes: [] as CreateLivraisonLine[],
  };
}

function emptyReceptionLine(): AttestationReceptionLine {
  return {
    id: crypto.randomUUID(),
    groupeUsageAttestationCode: "",
    quantite: "1",
    numeroDebut: "",
    numeroFin: "",
  };
}

function emptyLotForm() {
  return {
    livraisonId: "",
    lignes: [] as AttestationReceptionLine[],
  };
}

export default function AttestationStockPage() {
  const location = useLocation();
  if (location.pathname.endsWith("/commandes")) {
    return <AttestationWorkflowPage source="COMMANDE" />;
  }
  if (location.pathname.endsWith("/receptions")) {
    return <AttestationWorkflowPage source="RECEPTION_DIRECTE" />;
  }
  return <AttestationStockDashboardPage />;
}

function AttestationStockDashboardPage() {
  const queryClient = useQueryClient();
  const [urlParams, setUrlParams] = useSearchParams();
  const appliedSearch = useMemo(() => attestationStockFiltersFromSearchParams(urlParams), [urlParams]);
  const page = useMemo(() => attestationStockPageFromSearchParams(urlParams), [urlParams]);
  const [search, setSearch] = useState<AttestationStockFilters>(() => appliedSearch);
  const [attestationToCancel, setAttestationToCancel] = useState<AttestationStockItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [seuilForm, setSeuilForm] = useState<AttestationThresholdForm>({
    id: "",
    compagnieAssuranceId: "",
    groupeUsageAttestationId: "",
    minimumStock: "10",
  });

  useEffect(() => {
    setSearch(appliedSearch);
  }, [appliedSearch]);

  const dashboard = useQuery({
    queryKey: attestationStockKeys.dashboard(),
    queryFn: attestationStockApi.dashboardAttestationsStock,
  });
  const compagnies = useQuery({
    queryKey: referenceKeys.list("compagnies-assurance"),
    queryFn: () => referenceApi.list("compagnies-assurance"),
  });
  const groupes = useQuery({
    queryKey: referenceKeys.list("groupes-usage-attestation"),
    queryFn: () => referenceApi.list("groupes-usage-attestation"),
  });
  const attestations = useQuery({
    queryKey: attestationStockKeys.search({ ...appliedSearch, page }),
    queryFn: () =>
      attestationStockApi.searchAttestationsStock({
        compagnieAssuranceId: selectedOrUndefined(appliedSearch.compagnieAssuranceId),
        groupeUsageAttestationId: selectedOrUndefined(appliedSearch.groupeUsageAttestationId),
        statut: appliedSearch.statut === ALL_STOCK_FILTERS ? undefined : appliedSearch.statut,
        numero: appliedSearch.numero,
        page,
        size: 25,
      }),
  });

  const updateSettings = useMutation({
    mutationFn: attestationStockApi.updateAttestationsStockSettings,
    onSuccess: async () => {
      toast.success("Paramètre stock mis à jour");
      await queryClient.invalidateQueries({ queryKey: attestationStockKeys.dashboard() });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Mise à jour impossible"),
  });

  const cancelAttestation = useMutation({
    mutationFn: () => {
      if (!attestationToCancel) {
        throw new Error("Aucune attestation sélectionnée");
      }
      return attestationStockApi.cancelAttestationStock(attestationToCancel.id, { motif: cancelReason.trim() });
    },
    onSuccess: async () => {
      setAttestationToCancel(null);
      setCancelReason("");
      toast.success("Attestation annulée");
      await queryClient.invalidateQueries({ queryKey: attestationStockKeys.all });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Annulation de l’attestation impossible"),
  });

  const saveSeuil = useMutation({
    mutationFn: () => {
      const payload = {
        compagnieAssuranceId: seuilForm.compagnieAssuranceId,
        groupeUsageAttestationId: seuilForm.groupeUsageAttestationId,
        minimumStock: Math.max(0, Number.parseInt(seuilForm.minimumStock, 10) || 0),
      };
      return seuilForm.id
        ? attestationStockApi.updateSeuilStockAttestation(seuilForm.id, payload)
        : attestationStockApi.createSeuilStockAttestation(payload);
    },
    onSuccess: async () => {
      toast.success("Seuil enregistré");
      setSeuilForm({ id: "", compagnieAssuranceId: "", groupeUsageAttestationId: "", minimumStock: "10" });
      await queryClient.invalidateQueries({ queryKey: attestationStockKeys.dashboard() });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement du seuil impossible"),
  });

  const rows = useMemo(() => dashboard.data?.stocksParCompagnieUsage ?? [], [dashboard.data?.stocksParCompagnieUsage]);
  const groupedByCompany = useMemo(() => groupStocksByCompany(rows), [rows]);
  const summary = dashboard.data?.summary;
  const seuils = dashboard.data?.seuils ?? [];

  function submitSeuil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seuilForm.compagnieAssuranceId || !seuilForm.groupeUsageAttestationId) {
      toast.error("Compagnie et usage sont obligatoires");
      return;
    }
    saveSeuil.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Gestion du stock des attestations</h1>
          <p className="text-sm text-muted-foreground">Stocks disponibles par compagnie et usage, seuils d’alerte et contrôle à la saisie.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/production/attestations-stock/receptions">
              <Truck className="size-4" />
              Réceptions
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/production/attestations-stock/commandes">
              <ClipboardList className="size-4" />
              Commandes
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Kpi label="Total validé" value={summary?.total ?? 0} />
        <Kpi label="Disponible" value={summary?.disponible ?? 0} tone="success" />
        <Kpi label="Réservée" value={summary?.reservee ?? 0} />
        <Kpi label="Utilisée" value={summary?.utilisee ?? 0} />
        <Kpi label="Alertes seuil" value={seuils.filter((item) => item.stockFaible).length} tone="warning" />
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="size-4" />
            Paramètres stock
          </CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AttestationThresholdsDialog
              form={seuilForm}
              compagnies={compagnies.data ?? []}
              groupes={groupes.data ?? []}
              seuils={seuils}
              pending={saveSeuil.isPending}
              onFormChange={setSeuilForm}
              onSubmit={submitSeuil}
            />
            <div className="flex items-center gap-3 rounded-md border px-3 py-2">
              <div className="text-right">
                <div className="text-sm font-medium">Contrôle à la saisie</div>
                <div className="text-xs text-muted-foreground">Valide et consomme le numéro en création contrat</div>
              </div>
              <Switch
                checked={Boolean(dashboard.data?.controleStockActif)}
                disabled={updateSettings.isPending || dashboard.isLoading}
                onCheckedChange={(checked) => updateSettings.mutate({ controleStockActif: checked })}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 xl:grid-cols-2">
            {groupedByCompany.map((company) => (
              <StockPieCard
                key={company.compagnieAssuranceId}
                company={company}
                onSelect={(item) => {
                  const next = {
                    ...search,
                    compagnieAssuranceId: String(item.compagnieAssuranceId),
                    groupeUsageAttestationId: String(item.groupeUsageAttestationId),
                    statut: "DISPONIBLE" as const,
                  };
                  setSearch(next);
                  setUrlParams(attestationStockSearchParams(next, 0));
                }}
              />
            ))}
            {groupedByCompany.length === 0 ? (
              <div className="rounded-md border py-12 text-center text-sm text-muted-foreground lg:col-span-2">
                Aucun stock validé pour construire les graphiques.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AttestationStockSearchPanel
        filters={search}
        compagnies={compagnies.data ?? []}
        groupes={groupes.data ?? []}
        attestations={attestations.data?.items ?? []}
        page={attestations.data?.page.number ?? page}
        totalPages={attestations.data?.page.totalPages ?? 0}
        totalElements={attestations.data?.page.totalElements ?? 0}
        loading={attestations.isLoading || attestations.isFetching}
        onFiltersChange={setSearch}
        onSearch={() => setUrlParams(attestationStockSearchParams(search, 0))}
        onPageChange={(nextPage) => setUrlParams(attestationStockSearchParams(appliedSearch, nextPage))}
        onCancel={(attestation) => {
          setAttestationToCancel(attestation);
          setCancelReason("");
        }}
      />

      <AttestationCancelDialog
        attestation={attestationToCancel}
        reason={cancelReason}
        pending={cancelAttestation.isPending}
        onReasonChange={setCancelReason}
        onClose={() => {
          setAttestationToCancel(null);
          setCancelReason("");
        }}
        onConfirm={() => cancelAttestation.mutate()}
      />
    </div>
  );
}

function AttestationWorkflowPage({ source }: { source: LivraisonSource }) {
  const queryClient = useQueryClient();
  const [urlParams, setUrlParams] = useSearchParams();
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [lotForm, setLotForm] = useState(emptyLotForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [detailsLivraison, setDetailsLivraison] = useState<LivraisonAttestation | null>(null);
  const receptionFilters = useMemo(() => ({
    compagnieAssuranceId: urlParams.get("compagnie") ?? ALL_DELIVERY_FILTERS,
    annee: urlParams.get("annee") ?? ALL_DELIVERY_FILTERS,
  }), [urlParams]);
  const deliveryQuery = useMemo(() => ({
    source,
    compagnieAssuranceId: source === "RECEPTION_DIRECTE"
      ? deliveryFilterOrUndefined(receptionFilters.compagnieAssuranceId)
      : undefined,
    annee: source === "RECEPTION_DIRECTE"
      ? deliveryFilterOrUndefined(receptionFilters.annee)
      : undefined,
  }), [receptionFilters.annee, receptionFilters.compagnieAssuranceId, source]);

  const compagnies = useQuery({
    queryKey: referenceKeys.list("compagnies-assurance"),
    queryFn: () => referenceApi.list("compagnies-assurance"),
  });
  const groupes = useQuery({
    queryKey: referenceKeys.list("groupes-usage-attestation"),
    queryFn: () => referenceApi.list("groupes-usage-attestation"),
  });
  const livraisons = useQuery({
    queryKey: attestationStockKeys.deliveryList(source, deliveryQuery),
    queryFn: () => attestationStockApi.listLivraisonsAttestation(deliveryQuery),
  });

  const rows = useMemo(() => livraisons.data ?? [], [livraisons.data]);
  const selectedLivraison = useMemo(
    () => rows.find((item) => item.id === lotForm.livraisonId),
    [rows, lotForm.livraisonId]
  );
  const groupesCommande = useMemo(() => {
    if (!selectedLivraison) {
      return [];
    }
    const codes = new Set(
      selectedLivraison.lignes
        .filter((line) => line.quantiteRecue < line.quantiteDemandee)
        .map((line) => line.groupeUsageAttestationCode)
    );
    return (groupes.data ?? []).filter((groupe) => codes.has(String(groupe.code ?? groupe.id)));
  }, [groupes.data, selectedLivraison]);
  const groupesCreation = useMemo(
    () => (groupes.data ?? []).filter((groupe) => groupAllowedForCompany(groupe, createForm.compagnieAssuranceId)),
    [createForm.compagnieAssuranceId, groupes.data]
  );

  const createLivraison = useMutation({
    mutationFn: attestationStockApi.createLivraisonAttestation,
    onSuccess: async (livraison) => {
      toast.success(source === "COMMANDE" ? "Commande créée" : "Réception validée");
      setCreateForm(emptyCreateForm());
      setCreateOpen(false);
      setLotForm({ livraisonId: livraison.id, lignes: [] });
      await queryClient.invalidateQueries({ queryKey: attestationStockKeys.deliveries() });
      await queryClient.invalidateQueries({ queryKey: attestationStockKeys.all });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });

  const addLot = useMutation({
    mutationFn: () =>
      attestationStockApi.addLotsAttestation(lotForm.livraisonId, {
        lots: lotForm.lignes.map((line) => ({
          groupeUsageAttestationCode: line.groupeUsageAttestationCode,
          quantite: toPositiveInteger(line.quantite),
          numeroDebut: line.numeroDebut,
          numeroFin: line.numeroFin,
        })),
      }),
    onSuccess: async () => {
      toast.success("Réception enregistrée");
      setReceptionOpen(false);
      setLotForm((current) => ({ livraisonId: current.livraisonId, lignes: [] }));
      await queryClient.invalidateQueries({ queryKey: attestationStockKeys.deliveries() });
      await queryClient.invalidateQueries({ queryKey: attestationStockKeys.all });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Ajout du lot impossible"),
  });

  const validateLivraison = useMutation({
    mutationFn: attestationStockApi.validateLivraisonAttestation,
    onSuccess: async () => {
      toast.success("Livraison validée");
      await queryClient.invalidateQueries({ queryKey: attestationStockKeys.deliveries() });
      await queryClient.invalidateQueries({ queryKey: attestationStockKeys.all });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Validation impossible"),
  });

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.compagnieAssuranceId) {
      toast.error("La compagnie est obligatoire");
      return;
    }
    if (createForm.lignes.length === 0) {
      toast.error("Ajoutez au moins un usage");
      return;
    }

    const codes = createForm.lignes.map((line) => line.groupeUsageAttestationCode).filter(Boolean);
    if (codes.length !== createForm.lignes.length) {
      toast.error("Sélectionnez un usage pour chaque ligne");
      return;
    }
    if (new Set(codes).size !== codes.length) {
      toast.error("Un usage ne peut apparaître qu'une seule fois");
      return;
    }

    for (const line of createForm.lignes) {
      const quantite = toPositiveInteger(line.quantiteDemandee);
      if (!quantite) {
        toast.error("La quantité doit être positive pour chaque usage");
        return;
      }
      if (source === "RECEPTION_DIRECTE") {
        const quantitePlage = rangeQuantity(line.numeroDebut, line.numeroFin);
        if (!line.numeroDebut || !line.numeroFin || !quantitePlage) {
          toast.error("Les bornes début et fin sont obligatoires pour chaque usage");
          return;
        }
        if (quantite !== quantitePlage) {
          toast.error(`La plage de l'usage ${line.groupeUsageAttestationCode} doit contenir ${quantite} attestations`);
          return;
        }
      }
    }

    if (source === "COMMANDE" && !createForm.dateDemande) {
      toast.error("La date de demande est obligatoire");
      return;
    }
    if (source === "RECEPTION_DIRECTE" && !createForm.dateReception) {
      toast.error("La date de réception est obligatoire");
      return;
    }

    createLivraison.mutate({
      compagnieAssuranceId: createForm.compagnieAssuranceId,
      source,
      dateDemande: source === "COMMANDE" ? createForm.dateDemande : undefined,
      dateReception: source === "RECEPTION_DIRECTE" ? createForm.dateReception : undefined,
      referenceBl: valueOrUndefined(createForm.referenceBl),
      commentaireDecision: valueOrUndefined(createForm.commentaireDecision),
      lignes: createForm.lignes.map((line) => ({
        groupeUsageAttestationCode: line.groupeUsageAttestationCode,
        quantiteDemandee: toPositiveInteger(line.quantiteDemandee),
        numeroDebut: source === "RECEPTION_DIRECTE" ? line.numeroDebut : undefined,
        numeroFin: source === "RECEPTION_DIRECTE" ? line.numeroFin : undefined,
      })),
    });
  }

  function updateCreateLine(id: string, patch: Partial<Omit<CreateLivraisonLine, "id">>) {
    setCreateForm((current) => ({
      ...current,
      lignes: current.lignes.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  }

  function toggleCreateUsage(groupe: ReferenceOption, checked: boolean) {
    const code = String(groupe.code ?? groupe.id);
    setCreateForm((current) => ({
      ...current,
      lignes: checked
        ? current.lignes.some((line) => line.groupeUsageAttestationCode === code)
          ? current.lignes
          : [...current.lignes, { ...emptyCreateLine(), groupeUsageAttestationCode: code }]
        : current.lignes.filter((line) => line.groupeUsageAttestationCode !== code),
    }));
  }

  function submitLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lotForm.livraisonId) {
      toast.error("Sélectionnez une commande");
      return;
    }
    if (lotForm.lignes.length === 0) {
      toast.error("Ajoutez au moins un usage reçu");
      return;
    }
    const codes = lotForm.lignes.map((line) => line.groupeUsageAttestationCode).filter(Boolean);
    if (codes.length !== lotForm.lignes.length || new Set(codes).size !== codes.length) {
      toast.error("Chaque usage reçu doit être sélectionné une seule fois");
      return;
    }
    for (const line of lotForm.lignes) {
      const quantite = toPositiveInteger(line.quantite);
      const quantitePlage = rangeQuantity(line.numeroDebut, line.numeroFin);
      if (!quantite || !line.numeroDebut || !line.numeroFin || !quantitePlage) {
        toast.error("Quantité et bornes sont obligatoires pour chaque usage reçu");
        return;
      }
      if (quantite !== quantitePlage) {
        toast.error(`La plage de l'usage ${line.groupeUsageAttestationCode} doit contenir ${quantite} attestations`);
        return;
      }
    }
    addLot.mutate();
  }

  function updateReceptionLine(id: string, patch: Partial<Omit<AttestationReceptionLine, "id">>) {
    setLotForm((current) => ({
      ...current,
      lignes: current.lignes.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  }

  function toggleReceptionUsage(groupe: ReferenceOption, checked: boolean) {
    const code = String(groupe.code ?? groupe.id);
    setLotForm((current) => ({
      ...current,
      lignes: checked
        ? current.lignes.some((line) => line.groupeUsageAttestationCode === code)
          ? current.lignes
          : [...current.lignes, { ...emptyReceptionLine(), groupeUsageAttestationCode: code }]
        : current.lignes.filter((line) => line.groupeUsageAttestationCode !== code),
    }));
  }

  function updateReceptionFilter(key: "compagnie" | "annee", value: string) {
    setUrlParams((current) => {
      const next = new URLSearchParams(current);
      if (value === ALL_DELIVERY_FILTERS) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {source === "COMMANDE" ? "Commandes d'attestations" : "Réceptions d'attestations"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {source === "COMMANDE" ? "Création des demandes, réception des lots et validation." : "Entrée directe des lots reçus et validation immédiate."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {source === "COMMANDE" ? "Nouvelle commande" : "Nouvelle réception"}
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/production/attestations-stock">
              <Boxes className="size-4" />
              Dashboard stock
            </Link>
          </Button>
        </div>
      </div>

      {source === "RECEPTION_DIRECTE" ? (
        <AttestationDeliveryFilters
          compagnieAssuranceId={receptionFilters.compagnieAssuranceId}
          annee={receptionFilters.annee}
          compagnies={compagnies.data ?? []}
          onCompagnieChange={(value) => updateReceptionFilter("compagnie", value)}
          onAnneeChange={(value) => updateReceptionFilter("annee", value)}
          onReset={() => setUrlParams({})}
        />
      ) : null}

      <AttestationDeliveryTable
        source={source}
        rows={rows}
        loading={livraisons.isLoading || livraisons.isFetching}
        selectedLivraisonId={lotForm.livraisonId}
        validationPending={validateLivraison.isPending}
        onView={setDetailsLivraison}
        onReceive={(livraison) => {
          setLotForm({ livraisonId: livraison.id, lignes: [] });
          setReceptionOpen(true);
        }}
        onValidate={(livraisonId) => validateLivraison.mutate(livraisonId)}
      />

      <AttestationDeliveryDetailsDialog
        livraison={detailsLivraison}
        onClose={() => setDetailsLivraison(null)}
      />

      <AttestationDeliveryCreateDialog
        open={createOpen}
        source={source}
        form={createForm}
        compagnies={compagnies.data ?? []}
        groupes={groupes.data ?? []}
        groupesDisponibles={groupesCreation}
        pending={createLivraison.isPending}
        onOpenChange={setCreateOpen}
        onFormChange={setCreateForm}
        onSubmit={submitCreate}
        onToggleUsage={toggleCreateUsage}
        onQuantityChange={(line, value) => updateCreateLine(line.id, { quantiteDemandee: value })}
        onRangeChange={(line, patch) => updateCreateLine(line.id, patch)}
      />

      {source === "COMMANDE" ? (
        <AttestationReceptionDialog
          open={receptionOpen}
          livraison={selectedLivraison}
          groupes={groupesCommande}
          lines={lotForm.lignes}
          pending={addLot.isPending}
          onOpenChange={setReceptionOpen}
          onSubmit={submitLot}
          onToggleUsage={toggleReceptionUsage}
          onQuantityChange={(line, value) => updateReceptionLine(line.id, { quantite: value })}
          onRangeChange={(line, patch) => updateReceptionLine(line.id, patch)}
        />
      ) : null}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" }) {
  const color = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-foreground";
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
        <div className={`mt-2 text-2xl font-semibold ${color}`}>{formatInteger(value)}</div>
      </CardContent>
    </Card>
  );
}

function StockPieCard({
  company,
  onSelect,
}: {
  company: { compagnieAssuranceId: string; compagnieAssuranceNom: string; rows: AttestationStockCompanyUsage[] };
  onSelect: (item: AttestationStockCompanyUsage) => void;
}) {
  const chartData = company.rows.filter((item) => item.disponible > 0);
  const total = chartData.reduce((sum, item) => sum + item.disponible, 0);
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span>{company.compagnieAssuranceNom}</span>
          <Badge variant="outline">{formatInteger(total)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="disponible" nameKey="groupeUsageAttestationCode" innerRadius={54} outerRadius={92} paddingAngle={2}>
                {chartData.map((entry) => (
                  <Cell
                    key={`${entry.compagnieAssuranceId}-${entry.groupeUsageAttestationId}`}
                    fill={usageColor(entry)}
                    className="cursor-pointer"
                    onClick={() => onSelect(entry)}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatInteger(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {company.rows.map((item) => (
            <button
              key={`${item.compagnieAssuranceId}-${item.groupeUsageAttestationId}`}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
              onClick={() => onSelect(item)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: usageColor(item) }} />
                <span className="truncate">
                  {item.groupeUsageAttestationCode} · {item.groupeUsageAttestationLibelle}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {item.stockFaible ? <Badge variant="destructive">Seuil</Badge> : null}
                <span className="font-semibold">{formatInteger(item.disponible)}</span>
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function groupStocksByCompany(rows: AttestationStockCompanyUsage[]) {
  const map = new Map<string, { compagnieAssuranceId: string; compagnieAssuranceNom: string; rows: AttestationStockCompanyUsage[] }>();
  for (const row of rows) {
    const key = String(row.compagnieAssuranceId);
    if (!map.has(key)) {
      map.set(key, {
        compagnieAssuranceId: key,
        compagnieAssuranceNom: row.compagnieAssuranceNom,
        rows: [],
      });
    }
    map.get(key)?.rows.push(row);
  }
  return [...map.values()];
}

function usageColor(value: AttestationStockCompanyUsage | string | null | undefined) {
  if (typeof value === "object" && value?.groupeUsageAttestationCouleur) {
    return value.groupeUsageAttestationCouleur;
  }
  const code = typeof value === "string" ? value : value?.groupeUsageAttestationCode;
  const colorKey = code ?? "";
  const index = [...colorKey].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function selectedOrUndefined(value: string) {
  return value === ALL_STOCK_FILTERS ? undefined : value;
}

function deliveryFilterOrUndefined(value: string) {
  return value === ALL_DELIVERY_FILTERS ? undefined : value;
}

function groupAllowedForCompany(groupe: ReferenceOption, compagnieAssuranceId: string) {
  const rawRestrictions = groupe.compagnieRestrictionIds;
  if (!Array.isArray(rawRestrictions) || rawRestrictions.length === 0 || !compagnieAssuranceId) {
    return true;
  }
  return rawRestrictions.map(String).includes(compagnieAssuranceId);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function toPositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function rangeQuantity(numeroDebut: string, numeroFin: string) {
  const debut = Number.parseInt(numeroDebut, 10);
  const fin = Number.parseInt(numeroFin, 10);
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin < debut) {
    return undefined;
  }
  return fin - debut + 1;
}

function valueOrUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
