import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { productionApi } from "../api";
import { FlotteTargetsSection } from "../contrat-creation/FlotteTargetsSection";
import { QuittancePreviewCard } from "../components/QuittancePreviewCard";
import { toDateOnly } from "../date";
import type { ContratSummary, FlotteAvenantRequest, GarantieInput, RemorqueInput, VehiculeInput } from "../types";

type Target = {
  kind: "vehicule" | "remorque";
  id: string;
  label: string;
  sublabel?: string | null;
  immatriculation?: string | null;
  usage?: string | null;
};

type PrecisionDraft = {
  immatriculation?: string;
  immatriculationProvisoire?: string;
  numeroAttestation?: string;
};

const MOVEMENT_LABELS: Record<string, string> = {
  INC_F: "Incorporation",
  MOG_F: "Modification garanties",
  RET_F: "Retrait",
  EXR_F: "Extension remorque",
  RES_F: "Résiliation",
  RCH_F: "Résiliation à l'échéance",
  PRI_F: "Précision immatriculation",
  DUP_F: "Duplicata",
};

const DEFAULT_VEHICLE: VehiculeInput = {
  typeVehicule: "AUTOMOBILE",
  carburant: "Diesel",
  puissanceFiscale: "",
  nombrePlaces: "",
  immatriculation: "",
  datePremiereCirculation: "",
  valeurVenale: undefined,
  valeurNeuf: undefined,
  valeurGlace: undefined,
};

export default function FlotteAvenantPage() {
  const { contratId = "", code = "INC_F" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const movementCode = code.toUpperCase();
  const [dateEffet, setDateEffet] = useState<string>();
  const [dateEcheance, setDateEcheance] = useState<string>();
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [precisionDrafts, setPrecisionDrafts] = useState<Record<string, PrecisionDraft>>({});
  const [vehicules, setVehicules] = useState<VehiculeInput[]>([{ ...DEFAULT_VEHICLE }]);
  const [remorques, setRemorques] = useState<RemorqueInput[]>([]);
  const [selectedGaranties, setSelectedGaranties] = useState<GarantieInput[]>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof productionApi.previewFlotteAvenant>> | null>(null);
  const autoPreviewKeyRef = useRef("");

  const contextQuery = useQuery({
    queryKey: ["flotte-avenant-context", contratId],
    queryFn: () => productionApi.getFlotteAvenantContext(contratId),
    enabled: Boolean(contratId),
  });
  const usages = useQuery({ queryKey: ["referentiel", "usages", "avenant-flotte"], queryFn: () => productionApi.referentiel("usages") });
  const marques = useQuery({ queryKey: ["referentiel", "marques", "avenant-flotte"], queryFn: () => productionApi.referentiel("marques") });
  const carrosseries = useQuery({ queryKey: ["referentiel", "carrosseries", "avenant-flotte"], queryFn: () => productionApi.referentiel("carrosseries") });
  const garanties = useQuery({ queryKey: ["referentiel", "garanties", "avenant-flotte"], queryFn: productionApi.garantiesParametrage });
  const categoriesTransport = useQuery({ queryKey: ["referentiel", "categories-transport", "avenant-flotte"], queryFn: () => productionApi.referentiel("categories-transport") });
  const compagniesAssistance = useQuery({ queryKey: ["referentiel", "compagnies-assistance", "avenant-flotte"], queryFn: () => productionApi.referentiel("compagnies-assistance") });
  const produitsAssistance = useQuery({ queryKey: ["referentiel", "produits-assistance", "avenant-flotte"], queryFn: () => productionApi.referentiel("produits-assistance") });

  const contrat = contextQuery.data?.contrat;
  const availableMovements = useMemo(
    () => (contextQuery.data?.mouvementsDisponibles ?? []).filter((item) => item.code?.toUpperCase().endsWith("_F")),
    [contextQuery.data?.mouvementsDisponibles]
  );
  const targets = useMemo<Target[]>(() => [
    ...(contrat?.vehicules ?? []).map((item, index) => ({
      kind: "vehicule" as const,
      id: String(item.vehiculeId),
      label: item.immatriculation || `Véhicule ${index + 1}`,
      sublabel: [item.marque, item.carrosserie].filter(Boolean).join(" - "),
      immatriculation: item.immatriculation,
      usage: item.usageLibelle ?? item.usageCode,
    })),
    ...(contrat?.remorques ?? []).map((item, index) => ({
      kind: "remorque" as const,
      id: String(item.remorqueId),
      label: item.immatriculation || `Remorque ${index + 1}`,
      sublabel: item.marque,
      immatriculation: item.immatriculation,
      usage: item.usageLibelle ?? item.usageCode,
    })),
  ], [contrat?.remorques, contrat?.vehicules]);
  const grilleTarifaireId = contrat?.grilleTarifaireId ? String(contrat.grilleTarifaireId) : undefined;
  const lignesGrille = useQuery({
    queryKey: ["lignes-grille", grilleTarifaireId, "avenant-flotte"],
    queryFn: () => productionApi.lignesGrille({ grilleId: grilleTarifaireId }),
    enabled: Boolean(grilleTarifaireId),
  });
  const formulesPersonne = useQuery({
    queryKey: ["formules-garantie-personne", grilleTarifaireId, "avenant-flotte"],
    queryFn: () => productionApi.formulesGarantiePersonne({ grilleId: grilleTarifaireId }),
    enabled: Boolean(grilleTarifaireId),
  });
  const flotteTargetUsages = useMemo(() => {
    if (!grilleTarifaireId) {
      return [];
    }
    const configuredUsageIds = new Set<string>();
    for (const ligne of lignesGrille.data ?? []) {
      if (ligne.usageId) configuredUsageIds.add(String(ligne.usageId));
    }
    for (const formule of formulesPersonne.data ?? []) {
      if (formule.usageId) configuredUsageIds.add(String(formule.usageId));
    }
    return (usages.data ?? []).filter((usage) => configuredUsageIds.has(usage.id));
  }, [formulesPersonne.data, grilleTarifaireId, lignesGrille.data, usages.data]);

  useEffect(() => {
    if (!contrat) return;
    setDateEffet((current) => current ?? contrat.dateEffet ?? undefined);
    setDateEcheance((current) => current ?? contrat.dateEcheance ?? undefined);
    setVehicules((current) => current.map((item) => ({
      ...item,
      usageId: item.usageId ?? contrat.vehicules?.[0]?.usageId ?? undefined,
      crm: item.crm ?? contrat.crmPartageValeur ?? contrat.vehicules?.[0]?.crm ?? undefined,
      dateEffet: item.dateEffet ?? contrat.dateEffet ?? undefined,
      dateEcheance: item.dateEcheance ?? contrat.dateEcheance ?? undefined,
    })));
  }, [contrat]);

  useEffect(() => {
    setPreview(null);
    setSelectedTargetIds([]);
    setPrecisionDrafts({});
    if (movementCode === "INC_F") {
      setVehicules([{ ...DEFAULT_VEHICLE }]);
      setRemorques([]);
      setSelectedGaranties([]);
    }
  }, [movementCode]);

  useEffect(() => {
    if (movementCode !== "MOG_F" || !contrat) return;
    const mappedVehicules = (contrat.vehicules ?? []).map<VehiculeInput>((item) => ({
      vehiculeId: item.vehiculeId,
      typeVehicule: item.typeVehicule as VehiculeInput["typeVehicule"],
      usageId: item.usageId ?? undefined,
      marqueId: item.marqueId ?? undefined,
      marqueLibelle: item.marque ?? undefined,
      carrosserieId: item.carrosserieId ?? undefined,
      carrosserieLibelle: item.carrosserie ?? undefined,
      categorieTransportId: item.categorieTransportId ?? undefined,
      immatriculation: item.immatriculation ?? undefined,
      carburant: item.carburant ?? undefined,
      puissanceFiscale: item.puissanceFiscale ?? undefined,
      nombrePlaces: item.nombrePlaces ?? undefined,
      sousClasse: item.sousClasse ?? undefined,
      ptc: item.ptc ?? undefined,
      datePremiereCirculation: item.datePremiereCirculation ?? undefined,
      dateExpirationCarteGrise: item.dateExpirationCarteGrise ?? undefined,
      dateEffet: item.dateEffet ?? contrat.dateEffet ?? undefined,
      dateEcheance: item.dateEcheance ?? contrat.dateEcheance ?? undefined,
      crm: item.crm ?? contrat.crmPartageValeur ?? undefined,
      numeroAttestation: item.numeroAttestation ?? undefined,
      coefficientProrata: item.coefficientProrata ?? undefined,
      remorque: item.remorque ?? undefined,
      valeurVenale: item.valeurVenale ?? undefined,
      valeurNeuf: item.valeurNeuf ?? undefined,
      valeurGlace: item.valeurGlace ?? undefined,
      organismeCredit: item.organismeCredit ?? undefined,
      nomOrganismeCredit: item.nomOrganismeCredit ?? undefined,
      montantCredit: item.montantCredit ?? undefined,
      dateFinCredit: item.dateFinCredit ?? undefined,
    }));
    const mappedRemorques = (contrat.remorques ?? []).map<RemorqueInput>((item) => ({
      remorqueId: item.remorqueId,
      usageId: item.usageId ?? undefined,
      marqueId: item.marqueId ?? undefined,
      marqueLibelle: item.marque ?? undefined,
      immatriculation: item.immatriculation ?? undefined,
      ptc: item.ptc ?? undefined,
      dateMiseEnCirculation: item.dateMiseEnCirculation ?? undefined,
      dateEffet: item.dateEffet ?? contrat.dateEffet ?? undefined,
      dateEcheance: item.dateEcheance ?? contrat.dateEcheance ?? undefined,
      crm: item.crm ?? contrat.crmPartageValeur ?? undefined,
      numeroAttestation: item.numeroAttestation ?? undefined,
      coefficientProrata: item.coefficientProrata ?? undefined,
      valeurAssuree: item.valeurAssuree ?? undefined,
    }));
    setVehicules(mappedVehicules.length ? mappedVehicules : [{ ...DEFAULT_VEHICLE }]);
    setRemorques(mappedRemorques);
    setSelectedGaranties(mapCurrentGaranties(contrat.garanties ?? [], mappedVehicules, mappedRemorques));
  }, [contrat, movementCode]);

  const previewMutation = useMutation({
    mutationFn: (request: FlotteAvenantRequest) => productionApi.previewFlotteAvenant(contratId, request),
    onSuccess: setPreview,
    onError: (error) => toast.error(errorMessage(error)),
  });
  const saveMutation = useMutation({
    mutationFn: (request: FlotteAvenantRequest) => productionApi.createFlotteAvenant(contratId, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contrats"] });
      await queryClient.invalidateQueries({ queryKey: ["flotte-avenant-context", contratId] });
      toast.success("Avenant flotte enregistré");
      navigate("/app/production/contrats");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const buildRequest = (silent = false): FlotteAvenantRequest | null => {
    const notify = (message: string) => {
      if (!silent) {
        toast.error(message);
      }
    };
    if (!dateEffet) {
      notify("La date d'effet est obligatoire");
      return null;
    }
    const request: FlotteAvenantRequest = {
      codeTypeMouvement: movementCode,
      dateEffet,
      dateEcheance: dateEcheance || contrat?.dateEcheance || undefined,
    };
    if (movementCode === "INC_F") {
      const normalizedVehicules = vehicules.map((item) => normalizeVehicle(item, dateEffet, request.dateEcheance));
      const normalizedRemorques = remorques.map((item) => normalizeRemorque(item, dateEffet, request.dateEcheance));
      const invalidVehicule = normalizedVehicules.some((item) => !item.usageId || !item.marqueId || !item.immatriculation || !item.puissanceFiscale);
      if (invalidVehicule) {
        notify("Usage, marque, immatriculation et puissance fiscale sont obligatoires pour chaque véhicule");
        return null;
      }
      if (selectedGaranties.length === 0) {
        notify("Sélectionnez au moins une garantie");
        return null;
      }
      request.vehicules = normalizedVehicules;
      request.remorques = normalizedRemorques;
      request.garanties = selectedGaranties;
    }
    if (movementCode === "MOG_F") {
      if (selectedGaranties.length === 0) {
        notify("Sélectionnez au moins une garantie");
        return null;
      }
      request.garanties = selectedGaranties;
    }
    if (movementCode === "RET_F") {
      const selected = splitTargets(targets, selectedTargetIds);
      if (!selected.vehiculeIds.length && !selected.remorqueIds.length) {
        notify("Sélectionnez au moins une cible à retirer");
        return null;
      }
      request.vehiculeIds = selected.vehiculeIds;
      request.remorqueIds = selected.remorqueIds;
    }
    if (movementCode === "PRI_F") {
      const selected = splitTargets(targets, selectedTargetIds);
      const precisions: NonNullable<FlotteAvenantRequest["precisions"]> = [];
      selectedTargetIds.forEach((targetId) => {
        const target = targets.find((item) => targetKey(item) === targetId);
        if (!target) return;
        const draft = precisionDrafts[targetId] ?? {};
        precisions.push(target.kind === "vehicule" ? { vehiculeId: target.id, ...draft } : { remorqueId: target.id, ...draft });
      });
      if (!precisions.length) {
        notify("Sélectionnez au moins une cible à préciser");
        return null;
      }
      request.vehiculeIds = selected.vehiculeIds;
      request.remorqueIds = selected.remorqueIds;
      request.precisions = precisions;
    }
    if (movementCode === "EXR_F") {
      const selected = splitTargets(targets, selectedTargetIds);
      if (!selected.remorqueIds.length) {
        notify("Sélectionnez au moins une remorque");
        return null;
      }
      request.remorqueIds = selected.remorqueIds;
    }
    if (movementCode === "DUP_F") {
      const selected = splitTargets(targets, selectedTargetIds);
      request.vehiculeIds = selected.vehiculeIds;
      request.remorqueIds = selected.remorqueIds;
    }
    return request;
  };

  useEffect(() => {
    if (contextQuery.isLoading || saveMutation.isPending) {
      return;
    }
    const request = buildRequest(true);
    if (!request) {
      autoPreviewKeyRef.current = "";
      setPreview(null);
      return;
    }
    const key = JSON.stringify(request);
    if (autoPreviewKeyRef.current === key) {
      return;
    }
    const timeout = window.setTimeout(() => {
      autoPreviewKeyRef.current = key;
      previewMutation.mutate(request);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [
    contextQuery.isLoading,
    saveMutation.isPending,
    movementCode,
    contratId,
    contrat?.dateEcheance,
    dateEffet,
    dateEcheance,
    targets,
    selectedTargetIds,
    precisionDrafts,
    vehicules,
    remorques,
    selectedGaranties,
  ]);

  const save = () => {
    const request = buildRequest();
    if (request) saveMutation.mutate(request);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/app/production/contrats"><ArrowLeft className="size-4" />Retour liste</Link>
          </Button>
          <h1 className="mt-1 text-xl font-semibold">Avenant flotte - {MOVEMENT_LABELS[movementCode] ?? movementCode}</h1>
          <p className="text-sm text-muted-foreground">{contrat?.numeroDossier ?? contrat?.numeroContrat ?? contratId}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={save} disabled={saveMutation.isPending || contextQuery.isLoading}>
            <Save className="size-4" />Enregistrer
          </Button>
        </div>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader>
          <CardTitle>Paramètres de l'avenant</CardTitle>
          <CardDescription>La quittance est calculée sur les cibles de cet avenant, puis sauvegardée avec le mouvement.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Type">
            <Select value={movementCode} onValueChange={(value) => navigate(`/app/production/contrats/${contratId}/avenants/${value}`)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(availableMovements.length ? availableMovements : Object.entries(MOVEMENT_LABELS).map(([code, libelle]) => ({ code, libelle }))).map((item) => (
                  <SelectItem key={item.code} value={item.code}>{item.libelle ?? MOVEMENT_LABELS[item.code] ?? item.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date d'effet">
            <DatePicker date={dateEffet} onSelect={(date) => setDateEffet(toDateOnly(date))} />
          </Field>
          <Field label="Date d'échéance">
            <DatePicker date={dateEcheance} onSelect={(date) => setDateEcheance(toDateOnly(date))} />
          </Field>
        </CardContent>
      </Card>

      {movementCode === "INC_F" || movementCode === "MOG_F" ? (
        <FlotteTargetsSection
          vehicules={vehicules}
          setVehicules={setVehicules}
          remorques={remorques}
          setRemorques={setRemorques}
          garanties={garanties.data ?? []}
          selectedGaranties={selectedGaranties}
          setSelectedGaranties={setSelectedGaranties}
          lignes={lignesGrille.data ?? []}
          formulesPersonne={formulesPersonne.data ?? []}
          usages={flotteTargetUsages}
          marques={marques.data ?? []}
          carrosseries={carrosseries.data ?? []}
          categoriesTransport={categoriesTransport.data ?? []}
          compagniesAssistance={compagniesAssistance.data ?? []}
          produitsAssistance={produitsAssistance.data ?? []}
          grilleSelected={Boolean(grilleTarifaireId)}
          preview={preview}
          previewing={previewMutation.isPending}
          saving={saveMutation.isPending}
          crmPartage={Boolean(contrat?.crmPartage)}
          crmPartageValeur={contrat?.crmPartageValeur ?? ""}
          maxRemorques={null}
          showAssistance={false}
          showInfoSections={movementCode === "INC_F"}
          allowTargetChanges={movementCode === "INC_F"}
        />
      ) : movementCode !== "RES_F" && movementCode !== "RCH_F" ? (
        <TargetsSection
          movementCode={movementCode}
          targets={targets}
          selectedTargetIds={selectedTargetIds}
          setSelectedTargetIds={setSelectedTargetIds}
          precisionDrafts={precisionDrafts}
          setPrecisionDrafts={setPrecisionDrafts}
        />
      ) : (
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle>Cibles concernées</CardTitle>
            <CardDescription>{movementCode === "RCH_F" ? "La résiliation à l'échéance conserve les cibles actives jusqu'à la date d'échéance." : "La résiliation portera sur toutes les cibles actives du contrat."}</CardDescription>
          </CardHeader>
          <CardContent><Badge variant="secondary">{targets.length} cible(s) active(s)</Badge></CardContent>
        </Card>
      )}

      <Card className="border-border/70 shadow-none">
        <CardHeader><CardTitle>Quittance</CardTitle></CardHeader>
        <CardContent>
          <QuittancePreviewCard preview={preview} loading={previewMutation.isPending} />
        </CardContent>
      </Card>
    </div>
  );
}

function TargetsSection({
  movementCode,
  targets,
  selectedTargetIds,
  setSelectedTargetIds,
  precisionDrafts,
  setPrecisionDrafts,
}: {
  movementCode: string;
  targets: Target[];
  selectedTargetIds: string[];
  setSelectedTargetIds: (value: string[] | ((current: string[]) => string[])) => void;
  precisionDrafts: Record<string, PrecisionDraft>;
  setPrecisionDrafts: (value: Record<string, PrecisionDraft> | ((current: Record<string, PrecisionDraft>) => Record<string, PrecisionDraft>)) => void;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle>Cibles concernées</CardTitle>
        <CardDescription>{movementCode === "DUP_F" ? "Sans sélection, le duplicata concerne toutes les cibles actives." : "Sélectionnez les véhicules ou remorques concernés."}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-3" />
              <th className="px-3 py-3 text-left">Cible</th>
              <th className="px-3 py-3 text-left">Usage</th>
              {movementCode === "PRI_F" ? <th className="px-3 py-3 text-left">Nouvelle immatriculation / attestation</th> : null}
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => {
              const key = targetKey(target);
              const checked = selectedTargetIds.includes(key);
              return (
                <tr key={key} className={cn("border-t", checked && "bg-emerald-50/50 dark:bg-emerald-950/20")}>
                  <td className="px-3 py-2"><Checkbox checked={checked} onCheckedChange={(value) => toggleId(key, Boolean(value), setSelectedTargetIds)} /></td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{target.label}</div>
                    <div className="text-xs text-muted-foreground">{target.sublabel || target.kind}</div>
                  </td>
                  <td className="px-3 py-2">{target.usage ?? "-"}</td>
                  {movementCode === "PRI_F" ? (
                    <td className="px-3 py-2">
                      <div className="grid gap-2 md:grid-cols-3">
                        <Input disabled={!checked} placeholder="Immatriculation" value={precisionDrafts[key]?.immatriculation ?? ""} onChange={(event) => updatePrecision(key, { immatriculation: event.target.value }, setPrecisionDrafts)} />
                        {target.kind === "vehicule" ? <Input disabled={!checked} placeholder="WW" value={precisionDrafts[key]?.immatriculationProvisoire ?? ""} onChange={(event) => updatePrecision(key, { immatriculationProvisoire: event.target.value }, setPrecisionDrafts)} /> : null}
                        <Input disabled={!checked} placeholder="Attestation" value={precisionDrafts[key]?.numeroAttestation ?? ""} onChange={(event) => updatePrecision(key, { numeroAttestation: event.target.value }, setPrecisionDrafts)} />
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-700 dark:text-neutral-300"><span>{label}</span>{children}</label>;
}

function normalizeVehicle(vehicle: VehiculeInput, dateEffet: string, dateEcheance?: string): VehiculeInput {
  return { ...vehicle, typeVehicule: vehicle.typeVehicule ?? "AUTOMOBILE", dateEffet, dateEcheance };
}

function normalizeRemorque(remorque: RemorqueInput, dateEffet: string, dateEcheance?: string): RemorqueInput {
  return { ...remorque, dateEffet, dateEcheance };
}

function splitTargets(targets: Target[], selectedTargetIds: string[]) {
  const selected = targets.filter((target) => selectedTargetIds.includes(targetKey(target)));
  return {
    vehiculeIds: selected.filter((target) => target.kind === "vehicule").map((target) => target.id),
    remorqueIds: selected.filter((target) => target.kind === "remorque").map((target) => target.id),
  };
}

function mapCurrentGaranties(
  garanties: NonNullable<ContratSummary["garanties"]>,
  vehicules: VehiculeInput[],
  remorques: RemorqueInput[]
): GarantieInput[] {
  return garanties
    .map<GarantieInput | null>((garantie) => {
      const vehiculeIndex = garantie.vehiculeId
        ? vehicules.findIndex((vehicule) => String(vehicule.vehiculeId) === String(garantie.vehiculeId))
        : -1;
      const remorqueIndex = garantie.remorqueId
        ? remorques.findIndex((remorque) => String(remorque.remorqueId) === String(garantie.remorqueId))
        : -1;
      if (garantie.vehiculeId && vehiculeIndex < 0) return null;
      if (garantie.remorqueId && remorqueIndex < 0) return null;
      return {
        garantieId: garantie.garantieId,
        ligneGrilleTarifaireId: garantie.ligneGrilleTarifaireId ?? undefined,
        clientId: garantie.clientId ?? undefined,
        vehiculeIndex: vehiculeIndex >= 0 ? vehiculeIndex : undefined,
        remorqueIndex: remorqueIndex >= 0 ? remorqueIndex : undefined,
        modeSelectionne: garantie.modeSelectionne ?? undefined,
        sourceValeurSelectionnee: garantie.sourceValeurSelectionnee ?? undefined,
        formuleGarantiePersonneId: garantie.formuleGarantiePersonneId ?? undefined,
        valeurVenale: garantie.valeurVenale ?? undefined,
        valeurNeuf: garantie.valeurNeuf ?? undefined,
        valeurGlace: garantie.valeurGlace ?? undefined,
        valeurAssuree: garantie.valeurAssuree ?? undefined,
        formule: garantie.formule ?? undefined,
        montantDeces: garantie.montantDeces ?? undefined,
        montantInvalidite: garantie.montantInvalidite ?? undefined,
        montantFraisMedicaux: garantie.montantFraisMedicaux ?? undefined,
        montantFraisHospitalisation: garantie.montantFraisHospitalisation ?? undefined,
        montantFraisFuneraires: garantie.montantFraisFuneraires ?? undefined,
        montantFraisChirurgie: garantie.montantFraisChirurgie ?? undefined,
        accessoire: garantie.accessoire ?? undefined,
        capital: garantie.capital ?? undefined,
        taux: garantie.taux ?? undefined,
        prime: garantie.prime ?? undefined,
        tauxFranchise: garantie.tauxFranchise ?? undefined,
        franchiseMinimale: garantie.franchiseMinimale ?? undefined,
      } satisfies GarantieInput;
    })
    .filter((garantie): garantie is GarantieInput => Boolean(garantie));
}

function targetKey(target: Target) {
  return `${target.kind}:${target.id}`;
}

function toggleId(id: string, checked: boolean, setter: (value: string[] | ((current: string[]) => string[])) => void) {
  setter((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
}

function updatePrecision(
  key: string,
  patch: PrecisionDraft,
  setter: (value: Record<string, PrecisionDraft> | ((current: Record<string, PrecisionDraft>) => Record<string, PrecisionDraft>)) => void
) {
  setter((current) => ({ ...current, [key]: { ...(current[key] ?? {}), ...patch } }));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operation impossible";
}
