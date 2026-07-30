import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, CheckCircle2, ClipboardList, Eye, PackagePlus, Plus, Search, Settings2, Truck } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { productionApi } from "../api";
import { toDateOnly } from "../date";
import type {
  AttestationStockCompanyUsage,
  AttestationStockStatus,
  LivraisonAttestation,
  ReferenceOption,
  SeuilStockAttestation,
} from "../types";

type LivraisonSource = "COMMANDE" | "RECEPTION_DIRECTE";

const ALL_VALUE = "__ALL__";
const today = () => new Date().toISOString().slice(0, 10);
const palette = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#be185d"];

type CreateLivraisonLine = {
  id: string;
  groupeUsageAttestationCode: string;
  quantiteDemandee: string;
  numeroDebut: string;
  numeroFin: string;
};

function emptyCreateLine(): CreateLivraisonLine {
  return {
    id: crypto.randomUUID(),
    groupeUsageAttestationCode: "",
    quantiteDemandee: "1",
    numeroDebut: "",
    numeroFin: "",
  };
}

function emptyCreateForm() {
  return {
    compagnieAssuranceId: "",
    dateDemande: today(),
    dateReception: today(),
    referenceBl: "",
    commentaireDecision: "",
    lignes: [] as CreateLivraisonLine[],
  };
}

type ReceptionLine = {
  id: string;
  groupeUsageAttestationCode: string;
  quantite: string;
  numeroDebut: string;
  numeroFin: string;
};

function emptyReceptionLine(): ReceptionLine {
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
    lignes: [] as ReceptionLine[],
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
  const [search, setSearch] = useState({
    compagnieAssuranceId: ALL_VALUE,
    groupeUsageAttestationId: ALL_VALUE,
    statut: "DISPONIBLE" as AttestationStockStatus | typeof ALL_VALUE,
    numero: "",
  });
  const [seuilForm, setSeuilForm] = useState({
    id: "",
    compagnieAssuranceId: "",
    groupeUsageAttestationId: "",
    minimumStock: "10",
  });

  const dashboard = useQuery({
    queryKey: ["attestations-stock", "dashboard"],
    queryFn: productionApi.dashboardAttestationsStock,
  });
  const compagnies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance"],
    queryFn: () => productionApi.referentiel("compagnies-assurance"),
  });
  const groupes = useQuery({
    queryKey: ["referentiel", "groupes-usage-attestation"],
    queryFn: () => productionApi.referentiel("groupes-usage-attestation"),
  });
  const attestations = useQuery({
    queryKey: ["attestations-stock", "search", search],
    queryFn: () =>
      productionApi.searchAttestationsStock({
        compagnieAssuranceId: selectedOrUndefined(search.compagnieAssuranceId),
        groupeUsageAttestationId: selectedOrUndefined(search.groupeUsageAttestationId),
        statut: search.statut === ALL_VALUE ? undefined : search.statut,
        numero: search.numero,
        limit: "150",
      }),
  });

  const updateSettings = useMutation({
    mutationFn: productionApi.updateAttestationsStockSettings,
    onSuccess: async () => {
      toast.success("Paramètre stock mis à jour");
      await queryClient.invalidateQueries({ queryKey: ["attestations-stock", "dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Mise à jour impossible"),
  });

  const saveSeuil = useMutation({
    mutationFn: () => {
      const payload = {
        compagnieAssuranceId: seuilForm.compagnieAssuranceId,
        groupeUsageAttestationId: seuilForm.groupeUsageAttestationId,
        minimumStock: Math.max(0, Number.parseInt(seuilForm.minimumStock, 10) || 0),
      };
      return seuilForm.id
        ? productionApi.updateSeuilStockAttestation(seuilForm.id, payload)
        : productionApi.createSeuilStockAttestation(payload);
    },
    onSuccess: async () => {
      toast.success("Seuil enregistré");
      setSeuilForm({ id: "", compagnieAssuranceId: "", groupeUsageAttestationId: "", minimumStock: "10" });
      await queryClient.invalidateQueries({ queryKey: ["attestations-stock", "dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement du seuil impossible"),
  });

  const rows = dashboard.data?.stocksParCompagnieUsage ?? [];
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
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  <Settings2 className="size-4" />
                  Seuils d’alerte
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Seuils d’alerte stock</DialogTitle>
                  <DialogDescription>Configuration par compagnie et usage stock.</DialogDescription>
                </DialogHeader>
                <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1 lg:grid-cols-[360px_minmax(0,1fr)]">
                  <form className="space-y-3" onSubmit={submitSeuil}>
                    <Field label="Compagnie">
                      <Select
                        value={seuilForm.compagnieAssuranceId}
                        onValueChange={(value) => setSeuilForm((current) => ({ ...current, compagnieAssuranceId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          {(compagnies.data ?? []).map((compagnie) => (
                            <SelectItem key={compagnie.id} value={String(compagnie.id)}>
                              {compagnie.libelle}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Usage stock">
                      <GroupIdSelect
                        value={seuilForm.groupeUsageAttestationId}
                        groupes={groupes.data ?? []}
                        onChange={(value) => setSeuilForm((current) => ({ ...current, groupeUsageAttestationId: value }))}
                      />
                    </Field>
                    <Field label="Seuil minimum">
                      <Input
                        inputMode="numeric"
                        value={seuilForm.minimumStock}
                        onChange={(event) => setSeuilForm((current) => ({ ...current, minimumStock: event.target.value }))}
                      />
                    </Field>
                    <Button type="submit" className="w-full" disabled={saveSeuil.isPending}>
                      {seuilForm.id ? "Modifier le seuil" : "Ajouter le seuil"}
                    </Button>
                  </form>

                  <div className="max-h-[60vh] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
                        <TableRow className="hover:bg-emerald-700">
                          <TableHead>Compagnie</TableHead>
                          <TableHead>Usage</TableHead>
                          <TableHead className="text-right">Seuil</TableHead>
                          <TableHead className="text-right">Dispo.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {seuils.map((seuil) => (
                          <TableRow key={seuil.id} className="cursor-pointer" onClick={() => editSeuil(seuil, setSeuilForm)}>
                            <TableCell>{seuil.compagnieAssuranceNom}</TableCell>
                            <TableCell>
                              <Badge variant={seuil.stockFaible ? "destructive" : "outline"}>{seuil.groupeUsageAttestationCode}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{seuil.minimumStock}</TableCell>
                            <TableCell className="text-right">{seuil.stockDisponible}</TableCell>
                          </TableRow>
                        ))}
                        {seuils.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                              Aucun seuil paramétré.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
                onSelect={(item) =>
                  setSearch((current) => ({
                    ...current,
                    compagnieAssuranceId: String(item.compagnieAssuranceId),
                    groupeUsageAttestationId: String(item.groupeUsageAttestationId),
                    statut: "DISPONIBLE",
                  }))
                }
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

      <Card className="border-border/70 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4" />
            Liste des attestations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="N° attestation">
              <Input value={search.numero} onChange={(event) => setSearch((current) => ({ ...current, numero: event.target.value }))} />
            </Field>
            <Field label="Compagnie">
              <Select value={search.compagnieAssuranceId} onValueChange={(value) => setSearch((current) => ({ ...current, compagnieAssuranceId: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Toutes les compagnies</SelectItem>
                  {(compagnies.data ?? []).map((compagnie) => (
                    <SelectItem key={compagnie.id} value={String(compagnie.id)}>
                      {compagnie.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Usage stock">
              <Select value={search.groupeUsageAttestationId} onValueChange={(value) => setSearch((current) => ({ ...current, groupeUsageAttestationId: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Tous les usages</SelectItem>
                  {(groupes.data ?? []).map((groupe) => (
                    <SelectItem key={groupe.id} value={String(groupe.id)}>
                      {groupe.code} · {groupe.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="État">
              <Select value={search.statut} onValueChange={(value) => setSearch((current) => ({ ...current, statut: value as AttestationStockStatus | typeof ALL_VALUE }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Toutes</SelectItem>
                  <SelectItem value="DISPONIBLE">Disponible</SelectItem>
                  <SelectItem value="UTILISEE">Utilisée</SelectItem>
                  <SelectItem value="RESERVEE">Réservée</SelectItem>
                  <SelectItem value="ANNULEE">Annulée</SelectItem>
                  <SelectItem value="DESACTIVEE">Désactivée</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full" onClick={() => attestations.refetch()}>
                <Search className="size-4" />
                Rechercher
              </Button>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
                <TableRow className="hover:bg-emerald-700">
                  <TableHead>Compagnie</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Assuré</TableHead>
                  <TableHead className="text-center">N° police</TableHead>
                  <TableHead>N° attestation</TableHead>
                  <TableHead className="text-center">Date d’effet</TableHead>
                  <TableHead className="text-right">État</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(attestations.data ?? []).map((attestation) => (
                  <TableRow key={attestation.id}>
                    <TableCell>{attestation.compagnieAssuranceNom}</TableCell>
                    <TableCell>{attestation.groupeUsageAttestationCode}</TableCell>
                    <TableCell>{attestation.assure ?? "-"}</TableCell>
                    <TableCell className="text-center">{attestation.numeroPolice ?? "-"}</TableCell>
                    <TableCell className="font-medium">{attestation.numero}</TableCell>
                    <TableCell className="text-center">{formatDate(attestation.dateEffet)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={stockStatusVariant(attestation.statut)}>{stockStatusLabel(attestation.statut)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(attestations.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                      Aucune attestation pour ces filtres.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AttestationWorkflowPage({ source }: { source: LivraisonSource }) {
  const queryClient = useQueryClient();
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [lotForm, setLotForm] = useState(emptyLotForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [detailsLivraison, setDetailsLivraison] = useState<LivraisonAttestation | null>(null);

  const compagnies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance"],
    queryFn: () => productionApi.referentiel("compagnies-assurance"),
  });
  const groupes = useQuery({
    queryKey: ["referentiel", "groupes-usage-attestation"],
    queryFn: () => productionApi.referentiel("groupes-usage-attestation"),
  });
  const livraisons = useQuery({
    queryKey: ["livraisons-attestations", source],
    queryFn: () => productionApi.listLivraisonsAttestation(source),
  });

  const rows = livraisons.data ?? [];
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
    mutationFn: productionApi.createLivraisonAttestation,
    onSuccess: async (livraison) => {
      toast.success(source === "COMMANDE" ? "Commande créée" : "Réception validée");
      setCreateForm(emptyCreateForm());
      setCreateOpen(false);
      setLotForm({ livraisonId: livraison.id, lignes: [] });
      await queryClient.invalidateQueries({ queryKey: ["livraisons-attestations"] });
      await queryClient.invalidateQueries({ queryKey: ["attestations-stock"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });

  const addLot = useMutation({
    mutationFn: () =>
      productionApi.addLotsAttestation(lotForm.livraisonId, {
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
      await queryClient.invalidateQueries({ queryKey: ["livraisons-attestations"] });
      await queryClient.invalidateQueries({ queryKey: ["attestations-stock"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Ajout du lot impossible"),
  });

  const validateLivraison = useMutation({
    mutationFn: productionApi.validateLivraisonAttestation,
    onSuccess: async () => {
      toast.success("Livraison validée");
      await queryClient.invalidateQueries({ queryKey: ["livraisons-attestations"] });
      await queryClient.invalidateQueries({ queryKey: ["attestations-stock"] });
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

  function updateReceptionLine(id: string, patch: Partial<Omit<ReceptionLine, "id">>) {
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

      <div>
        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              {source === "COMMANDE" ? <ClipboardList className="size-4" /> : <Truck className="size-4" />}
              {source === "COMMANDE" ? "Commandes" : "Réceptions"}
            </CardTitle>
            <Badge variant="outline">{rows.length}</Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
                <TableRow className="hover:bg-emerald-700">
                  <TableHead>Référence</TableHead>
                  <TableHead>Compagnie</TableHead>
                  <TableHead>Usages</TableHead>
                  <TableHead className="text-right">Lots</TableHead>
                  <TableHead>Reçu</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((livraison) => (
                  <TableRow key={livraison.id} className={lotForm.livraisonId === livraison.id ? "bg-muted/50" : undefined}>
                    <TableCell className="min-w-52 align-top">
                      <div className="font-medium">
                        {livraison.referenceCommande ?? livraison.referenceBl ?? livraison.id}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {livraison.source === "COMMANDE" ? livraison.dateDemande : livraison.dateReception}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">{livraison.compagnieAssuranceNom}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex max-w-xl flex-wrap gap-1.5">
                        {livraison.lignes.map((ligne) => (
                          <Badge key={ligne.id} variant="secondary">
                            {ligne.groupeUsageAttestationCode} {ligne.quantiteRecue}/{ligne.quantiteDemandee}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      {livraison.lots.length}
                    </TableCell>
                    <TableCell className="align-top">
                      {livraison.quantiteRecue}/{livraison.quantiteDemandee}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={statusVariant(livraison.statut)}>{statusLabel(livraison.statut)}</Badge>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="icon" variant="ghost" onClick={() => setDetailsLivraison(livraison)} aria-label="Voir le détail">
                          <Eye className="size-4" />
                        </Button>
                        {source === "COMMANDE" && !livraison.validee && livraison.quantiteRecue < livraison.quantiteDemandee ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLotForm({ livraisonId: livraison.id, lignes: [] });
                              setReceptionOpen(true);
                            }}
                          >
                            <PackagePlus className="size-4" />
                            Réceptionner
                          </Button>
                        ) : null}
                        {source === "COMMANDE" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={livraison.validee || livraison.lots.length === 0 || validateLivraison.isPending}
                            onClick={() => validateLivraison.mutate(livraison.id)}
                          >
                            <CheckCircle2 className="size-4" />
                            Valider
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                      Aucun élément.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>

      <Dialog open={Boolean(detailsLivraison)} onOpenChange={(open) => !open && setDetailsLivraison(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          {detailsLivraison ? (
            <>
              <DialogHeader>
                <DialogTitle>Détail de la livraison</DialogTitle>
                <DialogDescription>
                  {detailsLivraison.referenceCommande ?? detailsLivraison.referenceBl ?? detailsLivraison.id} · {detailsLivraison.compagnieAssuranceNom}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-4">
                <StockReceptionSummary label="Demandé" value={detailsLivraison.quantiteDemandee} />
                <StockReceptionSummary label="Reçu" value={detailsLivraison.quantiteRecue} />
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Statut</div>
                  <div className="mt-1">
                    <Badge variant={statusVariant(detailsLivraison.statut)}>{statusLabel(detailsLivraison.statut)}</Badge>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Date</div>
                  <div className="mt-1 text-lg font-semibold">
                    {formatDate(detailsLivraison.source === "COMMANDE" ? detailsLivraison.dateDemande : detailsLivraison.dateReception)}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-md border">
                  <div className="border-b bg-muted/30 px-4 py-3 font-medium">Usages concernés</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usage</TableHead>
                        <TableHead className="text-right">Demandé</TableHead>
                        <TableHead className="text-right">Reçu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailsLivraison.lignes.map((ligne) => (
                        <TableRow key={ligne.id}>
                          <TableCell>
                            <div className="font-medium">{ligne.groupeUsageAttestationCode}</div>
                            <div className="text-xs text-muted-foreground">{ligne.groupeUsageAttestationLibelle}</div>
                          </TableCell>
                          <TableCell className="text-right">{ligne.quantiteDemandee}</TableCell>
                          <TableCell className="text-right font-medium">{ligne.quantiteRecue}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-md border">
                  <div className="border-b bg-muted/30 px-4 py-3 font-medium">Lots et plages</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usage</TableHead>
                        <TableHead>Préfixe</TableHead>
                        <TableHead>Plage</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailsLivraison.lots.map((lot) => (
                        <TableRow key={lot.id}>
                          <TableCell className="font-medium">{lot.groupeUsageAttestationCode}</TableCell>
                          <TableCell>{lot.prefixe}</TableCell>
                          <TableCell>
                            {lot.numeroDebut} - {lot.numeroFin}
                          </TableCell>
                          <TableCell className="text-right">{lot.quantite}</TableCell>
                        </TableRow>
                      ))}
                      {detailsLivraison.lots.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                            Aucun lot reçu.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetailsLivraison(null)}>
                  Fermer
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{source === "COMMANDE" ? "Nouvelle commande" : "Nouvelle réception directe"}</DialogTitle>
            <DialogDescription>
              Sélectionnez les usages concernés et renseignez les quantités
              {source === "RECEPTION_DIRECTE" ? " ainsi que les plages reçues." : "."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={submitCreate}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Compagnie">
                <AutocompleteSelect
                  value={createForm.compagnieAssuranceId}
                  onValueChange={(value) =>
                    setCreateForm((current) => ({
                      ...current,
                      compagnieAssuranceId: value,
                      lignes: value
                        ? current.lignes.filter((line) => {
                            const groupe = (groupes.data ?? []).find(
                              (item) => String(item.code ?? item.id) === line.groupeUsageAttestationCode
                            );
                            return groupe ? groupAllowedForCompany(groupe, value) : false;
                          })
                        : [],
                    }))
                  }
                  options={(compagnies.data ?? []).map((compagnie) => ({
                    value: String(compagnie.id),
                    label: compagnie.libelle,
                    keywords: compagnie.code,
                  }))}
                  placeholder="Rechercher une compagnie"
                  emptyText="Aucune compagnie"
                  invalidText="Sélectionnez une compagnie existante."
                  openOnFocus={false}
                />
              </Field>
              <Field label={source === "COMMANDE" ? "Date de demande" : "Date de réception"}>
                <DatePicker
                  date={source === "COMMANDE" ? createForm.dateDemande : createForm.dateReception}
                  onSelect={(date) =>
                    setCreateForm((current) =>
                      source === "COMMANDE"
                        ? { ...current, dateDemande: toDateOnly(date) ?? "" }
                        : { ...current, dateReception: toDateOnly(date) ?? "" }
                    )
                  }
                />
              </Field>
              <Field label={source === "COMMANDE" ? "Référence externe" : "Référence BL / réception"}>
                <Input
                  value={createForm.referenceBl}
                  onChange={(event) => setCreateForm((current) => ({ ...current, referenceBl: event.target.value }))}
                />
              </Field>
            </div>

            <UsageSelectionTable
              groupes={groupesCreation}
              lines={createForm.lignes}
              showRanges={source === "RECEPTION_DIRECTE"}
              disabled={!createForm.compagnieAssuranceId}
              quantityValue={(line) => line.quantiteDemandee}
              onToggle={toggleCreateUsage}
              onQuantityChange={(line, value) => updateCreateLine(line.id, { quantiteDemandee: value })}
              onRangeChange={(line, patch) => updateCreateLine(line.id, patch)}
            />

            <Field label="Commentaire">
              <Textarea
                rows={3}
                value={createForm.commentaireDecision}
                onChange={(event) => setCreateForm((current) => ({ ...current, commentaireDecision: event.target.value }))}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createLivraison.isPending}>
                <Plus className="size-4" />
                {source === "COMMANDE" ? "Créer la commande" : "Créer la réception"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {source === "COMMANDE" ? (
        <Dialog open={receptionOpen} onOpenChange={setReceptionOpen}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>Réceptionner la commande</DialogTitle>
              <DialogDescription>
                {selectedLivraison
                  ? `${selectedLivraison.referenceCommande ?? selectedLivraison.id} · ${selectedLivraison.compagnieAssuranceNom}`
                  : "Sélectionnez une commande."}
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-5" onSubmit={submitLot}>
              {selectedLivraison ? (
                <div className="grid gap-3 border-y bg-muted/20 p-4 sm:grid-cols-3">
                  <StockReceptionSummary label="Commandé" value={selectedLivraison.quantiteDemandee} />
                  <StockReceptionSummary label="Déjà reçu" value={selectedLivraison.quantiteRecue} />
                  <StockReceptionSummary
                    label="Reste à recevoir"
                    value={Math.max(0, selectedLivraison.quantiteDemandee - selectedLivraison.quantiteRecue)}
                  />
                </div>
              ) : null}
              <UsageSelectionTable
                groupes={groupesCommande}
                lines={lotForm.lignes}
                showRanges
                disabled={!selectedLivraison}
                quantityValue={(line) => line.quantite}
                onToggle={toggleReceptionUsage}
                onQuantityChange={(line, value) => updateReceptionLine(line.id, { quantite: value })}
                onRangeChange={(line, patch) => updateReceptionLine(line.id, patch)}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReceptionOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={addLot.isPending || !selectedLivraison}>
                  <PackagePlus className="size-4" />
                  Enregistrer la réception
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

type StockUsageLine = {
  id: string;
  groupeUsageAttestationCode: string;
  numeroDebut: string;
  numeroFin: string;
};

function UsageSelectionTable<TLine extends StockUsageLine>({
  groupes,
  lines,
  showRanges,
  disabled,
  quantityValue,
  onToggle,
  onQuantityChange,
  onRangeChange,
}: {
  groupes: ReferenceOption[];
  lines: TLine[];
  showRanges: boolean;
  disabled?: boolean;
  quantityValue: (line: TLine) => string;
  onToggle: (groupe: ReferenceOption, checked: boolean) => void;
  onQuantityChange: (line: TLine, value: string) => void;
  onRangeChange: (line: TLine, patch: { numeroDebut?: string; numeroFin?: string }) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="font-medium">Usages concernés</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Cochez les usages à traiter, puis renseignez les valeurs de chaque ligne.
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">Choix</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="w-52">Quantité</TableHead>
              {showRanges ? <TableHead className="w-56">N° début</TableHead> : null}
              {showRanges ? <TableHead className="w-56">N° fin calculé</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupes.map((groupe) => {
              const code = String(groupe.code ?? groupe.id);
              const line = lines.find((item) => item.groupeUsageAttestationCode === code);
              const checked = Boolean(line);
              return (
                <TableRow key={groupe.id} className={checked ? "bg-emerald-50/70" : undefined}>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(value) => onToggle(groupe, value === true)}
                      aria-label={`Sélectionner l'usage ${code}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{code}</div>
                    <div className="text-xs text-muted-foreground">{groupe.libelle}</div>
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="numeric"
                      value={line ? quantityValue(line) : ""}
                      disabled={!line}
                      onChange={(event) => {
                        if (!line) {
                          return;
                        }
                        const value = event.target.value;
                        onQuantityChange(line, value);
                        if (showRanges) {
                          onRangeChange(line, {
                            numeroFin: calculatedRangeEnd(line.numeroDebut, value),
                          });
                        }
                      }}
                    />
                  </TableCell>
                  {showRanges ? (
                    <TableCell>
                      <Input
                        inputMode="numeric"
                        value={line?.numeroDebut ?? ""}
                        disabled={!line}
                        onChange={(event) => {
                          if (!line) {
                            return;
                          }
                          const numeroDebut = event.target.value;
                          onRangeChange(line, {
                            numeroDebut,
                            numeroFin: calculatedRangeEnd(numeroDebut, quantityValue(line)),
                          });
                        }}
                      />
                    </TableCell>
                  ) : null}
                  {showRanges ? (
                    <TableCell>
                      <Input
                        value={line?.numeroFin ?? ""}
                        disabled={!line}
                        readOnly
                        className="bg-muted/50"
                        aria-label={`Numéro de fin calculé pour l'usage ${code}`}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
            {groupes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showRanges ? 5 : 3} className="h-24 text-center text-sm text-muted-foreground">
                  {disabled ? "Sélectionnez d'abord une compagnie." : "Aucun usage disponible."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StockReceptionSummary({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{formatInteger(value)}</div>
    </div>
  );
}

function GroupIdSelect({
  value,
  groupes,
  onChange,
}: {
  value: string;
  groupes: ReferenceOption[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Sélectionner" />
      </SelectTrigger>
      <SelectContent>
        {groupes.map((groupe) => (
          <SelectItem key={groupe.id} value={String(groupe.id)}>
            {groupe.code} · {groupe.libelle}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function statusVariant(statut: LivraisonAttestation["statut"]): BadgeProps["variant"] {
  if (statut === "VALIDEE") return "success";
  if (statut === "RECEPTION_COMPLETE") return "info";
  if (statut === "RECEPTION_PARTIELLE") return "warning";
  if (statut === "REFUSEE") return "destructive";
  return "outline";
}

function statusLabel(statut: LivraisonAttestation["statut"]) {
  return {
    DEMANDEE: "Demandée",
    REFUSEE: "Refusée",
    RECEPTION_PARTIELLE: "Réception partielle",
    RECEPTION_COMPLETE: "Réception complète",
    VALIDEE: "Validée",
  }[statut];
}

function stockStatusVariant(statut: AttestationStockStatus): BadgeProps["variant"] {
  if (statut === "DISPONIBLE") return "success";
  if (statut === "UTILISEE") return "secondary";
  if (statut === "RESERVEE") return "warning";
  if (statut === "ANNULEE" || statut === "DESACTIVEE") return "destructive";
  return "outline";
}

function stockStatusLabel(statut: AttestationStockStatus) {
  return {
    DISPONIBLE: "Disponible",
    RESERVEE: "Réservée",
    UTILISEE: "Utilisée",
    ANNULEE: "Annulée",
    DESACTIVEE: "Désactivée",
  }[statut];
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

function editSeuil(seuil: SeuilStockAttestation, setSeuilForm: (value: { id: string; compagnieAssuranceId: string; groupeUsageAttestationId: string; minimumStock: string }) => void) {
  setSeuilForm({
    id: String(seuil.id),
    compagnieAssuranceId: String(seuil.compagnieAssuranceId),
    groupeUsageAttestationId: String(seuil.groupeUsageAttestationId),
    minimumStock: String(seuil.minimumStock),
  });
}

function selectedOrUndefined(value: string) {
  return value === ALL_VALUE ? undefined : value;
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

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
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

function calculatedRangeEnd(numeroDebut: string, quantite: string) {
  const debut = Number.parseInt(numeroDebut, 10);
  const count = toPositiveInteger(quantite);
  if (!Number.isFinite(debut) || debut < 0 || !count) {
    return "";
  }
  return String(debut + count - 1);
}

function valueOrUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
