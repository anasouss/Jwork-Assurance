import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, CheckCircle2, ClipboardList, PackagePlus, Plus, Search, Settings2, Truck } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const emptyCreateForm = {
  compagnieAssuranceId: "",
  dateDemande: today(),
  dateReception: today(),
  referenceBl: "",
  groupeUsageAttestationCode: "",
  quantiteDemandee: "1",
  numeroDebut: "",
  numeroFin: "",
  commentaireDecision: "",
};

const emptyLotForm = {
  livraisonId: "",
  groupeUsageAttestationCode: "",
  quantite: "1",
  numeroDebut: "",
  numeroFin: "",
};

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

  const createLivraison = useMutation({
    mutationFn: productionApi.createLivraisonAttestation,
    onSuccess: async (livraison) => {
      toast.success(source === "COMMANDE" ? "Commande créée" : "Réception créée");
      setCreateForm(emptyCreateForm);
      setLotForm((current) => ({ ...current, livraisonId: livraison.id }));
      await queryClient.invalidateQueries({ queryKey: ["livraisons-attestations"] });
      await queryClient.invalidateQueries({ queryKey: ["attestations-stock"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });

  const addLot = useMutation({
    mutationFn: () =>
      productionApi.addLotAttestation(lotForm.livraisonId, {
        groupeUsageAttestationCode: lotForm.groupeUsageAttestationCode,
        quantite: toPositiveInteger(lotForm.quantite) ?? rangeQuantity(lotForm.numeroDebut, lotForm.numeroFin),
        numeroDebut: lotForm.numeroDebut,
        numeroFin: lotForm.numeroFin,
      }),
    onSuccess: async () => {
      toast.success("Lot ajouté");
      setLotForm((current) => ({
        ...emptyLotForm,
        livraisonId: current.livraisonId,
        groupeUsageAttestationCode: current.groupeUsageAttestationCode,
      }));
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
    const quantite = toPositiveInteger(createForm.quantiteDemandee) ?? rangeQuantity(createForm.numeroDebut, createForm.numeroFin);
    if (!createForm.compagnieAssuranceId || !createForm.groupeUsageAttestationCode || !quantite) {
      toast.error("Compagnie, groupe et quantité sont obligatoires");
      return;
    }
    if (source === "RECEPTION_DIRECTE" && (!createForm.numeroDebut || !createForm.numeroFin)) {
      toast.error("Les bornes du lot sont obligatoires pour une réception directe");
      return;
    }
    createLivraison.mutate({
      compagnieAssuranceId: createForm.compagnieAssuranceId,
      source,
      dateDemande: source === "COMMANDE" ? createForm.dateDemande : undefined,
      dateReception: source === "RECEPTION_DIRECTE" ? createForm.dateReception : undefined,
      referenceBl: valueOrUndefined(createForm.referenceBl),
      commentaireDecision: valueOrUndefined(createForm.commentaireDecision),
      lignes: [
        {
          groupeUsageAttestationCode: createForm.groupeUsageAttestationCode,
          quantiteDemandee: quantite,
          numeroDebut: source === "RECEPTION_DIRECTE" ? createForm.numeroDebut : undefined,
          numeroFin: source === "RECEPTION_DIRECTE" ? createForm.numeroFin : undefined,
        },
      ],
    });
  }

  function submitLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lotForm.livraisonId || !lotForm.groupeUsageAttestationCode || !lotForm.numeroDebut || !lotForm.numeroFin) {
      toast.error("Livraison, groupe et bornes du lot sont obligatoires");
      return;
    }
    addLot.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {source === "COMMANDE" ? "Commandes d'attestations" : "Réceptions d'attestations"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {source === "COMMANDE" ? "Création des demandes, réception des lots et validation." : "Entrée directe des lots reçus et validation."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/production/attestations-stock">
            <Boxes className="size-4" />
            Dashboard stock
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
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
                  <TableHead>Groupes</TableHead>
                  <TableHead>Reçu</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((livraison) => (
                  <TableRow key={livraison.id} className={lotForm.livraisonId === livraison.id ? "bg-muted/50" : undefined}>
                    <TableCell className="min-w-52 align-top">
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => setLotForm((current) => ({ ...current, livraisonId: livraison.id }))}
                      >
                        {livraison.referenceCommande ?? livraison.referenceBl ?? livraison.id}
                      </button>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {livraison.source === "COMMANDE" ? livraison.dateDemande : livraison.dateReception}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">{livraison.compagnieAssuranceNom}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {livraison.lignes.map((ligne) => (
                          <Badge key={ligne.id} variant="secondary">
                            {ligne.groupeUsageAttestationCode} {ligne.quantiteRecue}/{ligne.quantiteDemandee}
                          </Badge>
                        ))}
                      </div>
                      {livraison.lots.length > 0 ? (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {livraison.lots.map((lot) => (
                            <div key={lot.id}>
                              {lot.groupeUsageAttestationCode}: {lot.prefixe}
                              {lot.numeroDebut}-{lot.numeroFin} ({lot.quantite})
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      {livraison.quantiteRecue}/{livraison.quantiteDemandee}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={statusVariant(livraison.statut)}>{statusLabel(livraison.statut)}</Badge>
                    </TableCell>
                    <TableCell className="text-right align-top">
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
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                      Aucun élément.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="size-4" />
                {source === "COMMANDE" ? "Nouvelle commande" : "Nouvelle réception"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitCreate}>
                <Field label="Compagnie">
                  <Select
                    value={createForm.compagnieAssuranceId}
                    onValueChange={(value) => setCreateForm((current) => ({ ...current, compagnieAssuranceId: value }))}
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
                <Field label="Groupe usage">
                  <GroupCodeSelect
                    value={createForm.groupeUsageAttestationCode}
                    groupes={groupes.data ?? []}
                    onChange={(value) => setCreateForm((current) => ({ ...current, groupeUsageAttestationCode: value }))}
                  />
                </Field>
                <Field label="Quantité">
                  <Input
                    inputMode="numeric"
                    value={createForm.quantiteDemandee}
                    onChange={(event) => setCreateForm((current) => ({ ...current, quantiteDemandee: event.target.value }))}
                  />
                </Field>
                <Field label={source === "COMMANDE" ? "Date demande" : "Date réception"}>
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
                <Field label="Référence BL">
                  <Input
                    value={createForm.referenceBl}
                    onChange={(event) => setCreateForm((current) => ({ ...current, referenceBl: event.target.value }))}
                  />
                </Field>
                {source === "RECEPTION_DIRECTE" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="N° début">
                      <Input
                        inputMode="numeric"
                        value={createForm.numeroDebut}
                        onChange={(event) => setCreateForm((current) => ({ ...current, numeroDebut: event.target.value }))}
                      />
                    </Field>
                    <Field label="N° fin">
                      <Input
                        inputMode="numeric"
                        value={createForm.numeroFin}
                        onChange={(event) => setCreateForm((current) => ({ ...current, numeroFin: event.target.value }))}
                      />
                    </Field>
                  </div>
                ) : null}
                <Field label="Commentaire">
                  <Textarea
                    value={createForm.commentaireDecision}
                    onChange={(event) => setCreateForm((current) => ({ ...current, commentaireDecision: event.target.value }))}
                  />
                </Field>
                <Button type="submit" className="w-full" disabled={createLivraison.isPending}>
                  <Plus className="size-4" />
                  Créer
                </Button>
              </form>
            </CardContent>
          </Card>

          {source === "COMMANDE" ? (
            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackagePlus className="size-4" />
                  Ajouter un lot reçu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={submitLot}>
                  <Field label="Commande">
                    <Select
                      value={lotForm.livraisonId}
                      onValueChange={(value) => setLotForm((current) => ({ ...current, livraisonId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {rows
                          .filter((livraison) => !livraison.validee)
                          .map((livraison) => (
                            <SelectItem key={livraison.id} value={livraison.id}>
                              {livraison.referenceCommande ?? livraison.referenceBl ?? livraison.id}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {selectedLivraison ? (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      {selectedLivraison.compagnieAssuranceNom} · {selectedLivraison.quantiteRecue}/{selectedLivraison.quantiteDemandee} reçues
                    </div>
                  ) : null}
                  <Field label="Groupe usage">
                    <GroupCodeSelect
                      value={lotForm.groupeUsageAttestationCode}
                      groupes={groupes.data ?? []}
                      onChange={(value) => setLotForm((current) => ({ ...current, groupeUsageAttestationCode: value }))}
                    />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Quantité">
                      <Input
                        inputMode="numeric"
                        value={lotForm.quantite}
                        onChange={(event) => setLotForm((current) => ({ ...current, quantite: event.target.value }))}
                      />
                    </Field>
                    <Field label="Début">
                      <Input
                        inputMode="numeric"
                        value={lotForm.numeroDebut}
                        onChange={(event) => setLotForm((current) => ({ ...current, numeroDebut: event.target.value }))}
                      />
                    </Field>
                    <Field label="Fin">
                      <Input
                        inputMode="numeric"
                        value={lotForm.numeroFin}
                        onChange={(event) => setLotForm((current) => ({ ...current, numeroFin: event.target.value }))}
                      />
                    </Field>
                  </div>
                  <Button type="submit" className="w-full" variant="secondary" disabled={addLot.isPending}>
                    <PackagePlus className="size-4" />
                    Ajouter lot
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
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

function GroupCodeSelect({
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
          <SelectItem key={groupe.id} value={String(groupe.code ?? groupe.id)}>
            {groupe.code} · {groupe.libelle}
            {Array.isArray(groupe.compagnieRestrictionLibelles) && groupe.compagnieRestrictionLibelles.length > 0
              ? ` (${groupe.compagnieRestrictionLibelles.join(", ")})`
              : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

function valueOrUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
