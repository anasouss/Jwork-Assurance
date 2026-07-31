import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { productionApi } from "../api";
import { AttestationNumberInput } from "../components/AttestationNumberInput";
import { GrilleTarifaireConfigurator } from "../components/GrilleTarifaireConfigurator";
import { ProductionFormSkeleton } from "../components/ProductionFormSkeleton";
import { AvenantTargetsSection } from "../components/AvenantTargetsSections";
import { QuittancePreviewCard } from "../components/QuittancePreviewCard";
import { toDateOnly } from "../date";
import type { AssistanceDraft, AvenantRequest, ContratSummary, GarantieInput, QuittancePreview, ReferenceOption, RemorqueInput, VehiculeInput } from "../types";

type Target = {
  kind: "vehicule" | "remorque";
  id: string;
  label: string;
  sublabel?: string | null;
  immatriculation?: string | null;
  usageId?: string | null;
  usage?: string | null;
  numeroAttestation?: string | null;
  consommeAttestation?: boolean | null;
};

type PrecisionDraft = {
  immatriculation?: string;
  immatriculationProvisoire?: string;
  numeroAttestation?: string;
};

type DuplicataAttestationDraft = {
  numeroAttestation?: string;
};

type FlotteSectionTarget = {
  kind: "vehicule" | "remorque";
  index: number;
};

const MOVEMENT_LABELS: Record<string, string> = {
  EXG_M: "Extension garanties",
  MOG_M: "Modification garanties",
  EXR_M: "Extension remorque",
  CHV_M: "Changement véhicule",
  PRI_M: "Précision immatriculation",
  DUP_M: "Duplicata",
  PRO_M: "Provisoire",
  RES_M: "Résiliation",
  RCH_M: "Résiliation à l'échéance",
  ANN_M: "Annulation",
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

export default function AvenantContratPage() {
  const { contratId = "", code = "INC_F" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const movementCode = code.toUpperCase();
  const validatedMovementId = searchParams.get("mouvementId");
  const [dateEffet, setDateEffet] = useState<string>();
  const [dateEcheance, setDateEcheance] = useState<string>();
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [precisionDrafts, setPrecisionDrafts] = useState<Record<string, PrecisionDraft>>({});
  const [duplicataAttestationDrafts, setDuplicataAttestationDrafts] = useState<Record<string, DuplicataAttestationDraft>>({});
  const [vehicules, setVehicules] = useState<VehiculeInput[]>([{ ...DEFAULT_VEHICLE }]);
  const [remorques, setRemorques] = useState<RemorqueInput[]>([]);
  const [selectedGaranties, setSelectedGaranties] = useState<GarantieInput[]>([]);
  const [targetAssistances, setTargetAssistances] = useState<Record<string, AssistanceDraft>>({});
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof productionApi.previewAvenant>> | null>(null);
  const [targetPreview, setTargetPreview] = useState<Awaited<ReturnType<typeof productionApi.previewAvenant>> | null>(null);
  const [grilleConfiguratorOpen, setGrilleConfiguratorOpen] = useState(false);
  const [hydratedSourceKey, setHydratedSourceKey] = useState("");
  const autoPreviewKeyRef = useRef("");
  const manualPreviewKeyRef = useRef("");
  const globalPreviewRequestKeyRef = useRef("");
  const targetPreviewRequestKeyRef = useRef("");
  const hydratedDraftCodeRef = useRef("");
  const previewedDraftCodeRef = useRef("");
  const selectedGarantiesRef = useRef<GarantieInput[]>([]);

  useEffect(() => {
    selectedGarantiesRef.current = selectedGaranties;
  }, [selectedGaranties]);

  const contextQuery = useQuery({
    queryKey: ["avenant-context", contratId],
    queryFn: () => productionApi.getAvenantContext(contratId),
    enabled: Boolean(contratId),
  });
  const draftQuery = useQuery({
    queryKey: ["avenant-draft", contratId, movementCode],
    queryFn: () => productionApi.getAvenantDraft(contratId, movementCode),
    enabled: Boolean(contratId) && !validatedMovementId,
  });
  const rectificationQuery = useQuery({
    queryKey: ["avenant-rectification", contratId, validatedMovementId],
    queryFn: () => productionApi.getAvenantRectification(contratId, validatedMovementId!),
    enabled: Boolean(contratId && validatedMovementId),
  });
  const savedMovementQuery = useQuery({
    queryKey: ["contrat", contratId, validatedMovementId, "avenant-edit"],
    queryFn: () => productionApi.getContrat(contratId, { mouvementId: validatedMovementId }),
    enabled: Boolean(contratId && validatedMovementId),
  });
  useEffect(() => {
    if (rectificationQuery.error) {
      toast.error(errorMessage(rectificationQuery.error));
    }
  }, [rectificationQuery.error]);
  const usages = useQuery({ queryKey: ["referentiel", "usages", "avenant-contrat"], queryFn: () => productionApi.referentiel("usages") });
  const compagnies = useQuery({ queryKey: ["referentiel", "compagnies-assurance", "avenant-contrat"], queryFn: () => productionApi.referentiel("compagnies-assurance") });
  const marques = useQuery({ queryKey: ["referentiel", "marques", "avenant-contrat"], queryFn: () => productionApi.referentiel("marques") });
  const carrosseries = useQuery({ queryKey: ["referentiel", "carrosseries", "avenant-contrat"], queryFn: () => productionApi.referentiel("carrosseries") });
  const sousClasses = useQuery({ queryKey: ["referentiel", "sous-classes", "avenant-contrat"], queryFn: () => productionApi.referentiel("sous-classes") });
  const garanties = useQuery({ queryKey: ["referentiel", "garanties", "avenant-contrat"], queryFn: productionApi.garantiesParametrage });
  const categoriesTransport = useQuery({ queryKey: ["referentiel", "categories-transport", "avenant-contrat"], queryFn: () => productionApi.referentiel("categories-transport") });
  const compagniesAssistance = useQuery({ queryKey: ["referentiel", "compagnies-assistance", "avenant-contrat"], queryFn: () => productionApi.referentiel("compagnies-assistance") });
  const produitsAssistance = useQuery({ queryKey: ["referentiel", "produits-assistance", "avenant-contrat"], queryFn: () => productionApi.referentiel("produits-assistance") });
  const grilles = useQuery({ queryKey: ["referentiel", "grilles-tarifaires", "avenant-contrat"], queryFn: () => productionApi.referentiel("grilles-tarifaires") });

  const contrat = contextQuery.data?.contrat;
  const sharedCrm = contrat?.crmPartage
    ? contrat.crmPartageValeur?.trim() || undefined
    : undefined;
  const availableMovements = useMemo(
    () => (contextQuery.data?.mouvementsDisponibles ?? [])
      .filter((item) => supportedAvenantCodes.has(normalizeCode(item.code)))
      .filter((item) => !Boolean(item.renouvelleContrat)),
    [contextQuery.data?.mouvementsDisponibles]
  );
  const movementDefinition = availableMovements.find((item) => normalizeCode(item.code) === movementCode);
  const movementAvailable = availableMovements.some((item) => normalizeCode(item.code) === movementCode);
  const showAvenantAssistance = contrat?.typeContrat !== "PARTICULIER"
    && Boolean(movementDefinition?.autoriseAssistance);
  const contratKindLabel = contrat?.typeContrat === "FLOTTE" ? "flotte" : contrat?.typeContrat === "CONVENTION" ? "convention" : "mono";
  const assistanceCategorieClientId = useMemo(
    () => resolveAssistanceCategorieClientId(contrat),
    [contrat]
  );
  const targets = useMemo<Target[]>(() => [
    ...(contrat?.vehicules ?? []).map((item, index) => ({
      kind: "vehicule" as const,
      id: String(item.vehiculeId),
      label: item.immatriculation || `Véhicule ${index + 1}`,
      sublabel: [item.marque, item.carrosserie].filter(Boolean).join(" - "),
      immatriculation: item.immatriculation,
      usageId: item.usageId,
      usage: item.usageLibelle ?? item.usageCode,
      numeroAttestation: item.numeroAttestation,
      consommeAttestation: item.consommeAttestation,
    })),
    ...(contrat?.remorques ?? []).map((item, index) => ({
      kind: "remorque" as const,
      id: String(item.remorqueId),
      label: item.immatriculation || `Remorque ${index + 1}`,
      sublabel: item.marque,
      immatriculation: item.immatriculation,
      usageId: item.usageId,
      usage: item.usageLibelle ?? item.usageCode,
      numeroAttestation: item.numeroAttestation,
      consommeAttestation: item.consommeAttestation,
    })),
  ], [contrat?.remorques, contrat?.vehicules]);
  const hasActiveTargets = targets.length > 0;
  const grilleTarifaireId = contrat?.grilleTarifaireId ? String(contrat.grilleTarifaireId) : undefined;
  const configuredGrille = useMemo(
    () => grilleTarifaireId
      ? (grilles.data ?? []).find((grille) => grille.id === grilleTarifaireId) ?? { id: grilleTarifaireId, libelle: "Grille tarifaire" }
      : null,
    [grilleTarifaireId, grilles.data]
  );
  const lignesGrille = useQuery({
    queryKey: ["lignes-grille", grilleTarifaireId, "avenant-contrat"],
    queryFn: () => productionApi.lignesGrille({ grilleId: grilleTarifaireId }),
    enabled: Boolean(grilleTarifaireId),
  });
  const formulesPersonne = useQuery({
    queryKey: ["formules-garantie-personne", grilleTarifaireId, "avenant-contrat"],
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
  const avenantTargetUsages = contrat?.typeContrat === "PARTICULIER"
    ? usages.data ?? []
    : flotteTargetUsages;

  const hydrationKey = `${movementCode}:${validatedMovementId ?? "draft"}`;
  const sourceQuery = validatedMovementId ? rectificationQuery : draftQuery;
  const referencesLoading = [
    usages,
    compagnies,
    marques,
    carrosseries,
    sousClasses,
    garanties,
    categoriesTransport,
    compagniesAssistance,
    produitsAssistance,
    grilles,
    lignesGrille,
    formulesPersonne,
  ].some((query) => query.isLoading);
  const initialLoading = contextQuery.isLoading
    || sourceQuery.isLoading
    || savedMovementQuery.isLoading
    || referencesLoading
    || (
      contextQuery.isSuccess
      && !sourceQuery.isError
      && hydratedSourceKey !== hydrationKey
    );

  useEffect(() => {
    if (!contrat) return;
    const hydrateUsageFromExistingTarget = !isTargetCreationCode(movementCode);
    setDateEcheance((current) => current ?? contrat.dateEcheance ?? undefined);
    setVehicules((current) => current.map((item) => ({
      ...item,
      usageId: item.usageId ?? (hydrateUsageFromExistingTarget ? contrat.vehicules?.[0]?.usageId : undefined) ?? undefined,
      crm: item.crm ?? contrat.crmPartageValeur ?? contrat.vehicules?.[0]?.crm ?? undefined,
      dateEffet: item.dateEffet ?? contrat.dateEffet ?? undefined,
      dateEcheance: item.dateEcheance ?? contrat.dateEcheance ?? undefined,
    })));
  }, [contrat, movementCode]);

  useEffect(() => {
    setDateEffet(undefined);
    setPreview(null);
    setTargetPreview(null);
    setSelectedTargetIds([]);
    setPrecisionDrafts({});
    setDuplicataAttestationDrafts({});
    if (movementCode === "INC_F") {
      setVehicules([{ ...DEFAULT_VEHICLE }]);
      setRemorques([]);
      setSelectedGaranties([]);
      setTargetAssistances({});
    }
    if (movementCode === "EXR_M") {
      setVehicules([]);
      setRemorques([{}]);
      setSelectedGaranties([]);
    }
  }, [movementCode]);

  useEffect(() => {
    if (!isDuplicataCode(movementCode) || targets.length === 0) {
      return;
    }
    setSelectedTargetIds((current) => current.length === 0 ? targets.map(targetKey) : current);
  }, [movementCode, targets]);

  useEffect(() => {
    if ((!isGuaranteeModificationCode(movementCode) && !isVehicleTargetCreationCode(movementCode)) || !contrat) return;
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
    setRemorques(movementCode === "INC_F" ? mappedRemorques : []);
    setSelectedGaranties(mapCurrentGaranties(contrat.garanties ?? [], mappedVehicules, movementCode === "INC_F" ? mappedRemorques : []));
    setTargetAssistances(mapCurrentAssistances(contrat.assistances ?? [], mappedVehicules));
  }, [contrat, movementCode]);

  useEffect(() => {
    const sourceFetched = validatedMovementId
      ? rectificationQuery.isFetched && savedMovementQuery.isFetched
      : draftQuery.isFetched;
    if (!contrat || !sourceFetched || hydratedDraftCodeRef.current === hydrationKey) {
      return;
    }
    hydratedDraftCodeRef.current = hydrationKey;
    const request = validatedMovementId ? rectificationQuery.data : draftQuery.data?.request;
    if (!request) {
      setHydratedSourceKey(hydrationKey);
      return;
    }
    setDateEffet(request.dateEffet ?? undefined);
    setDateEcheance(contrat?.dateEcheance ?? request.dateEcheance ?? undefined);
    setVehicules(request.vehicules?.length ? request.vehicules : movementCode === "EXR_M" ? [] : [{ ...DEFAULT_VEHICLE }]);
    setRemorques(request.remorques?.length ? request.remorques : movementCode === "EXR_M" ? [{}] : []);
    setSelectedGaranties(request.garanties ?? []);
    const currentAssistances = isGuaranteeModificationCode(movementCode)
      ? mapCurrentAssistances(
          contrat?.assistances ?? [],
          (contrat?.vehicules ?? []).map((vehicule) => ({ vehiculeId: vehicule.vehiculeId }))
        )
      : {};
    setTargetAssistances({
      ...currentAssistances,
      ...hydrateAvenantAssistances(request.assistances),
    });
    setSelectedTargetIds([
      ...(request.vehiculeIds ?? []).map((id) => `vehicule:${id}`),
      ...(request.remorqueIds ?? []).map((id) => `remorque:${id}`),
    ]);
    const nextPrecisions: Record<string, PrecisionDraft> = {};
    for (const precision of request.precisions ?? []) {
      const key = precision.vehiculeId
        ? `vehicule:${precision.vehiculeId}`
        : precision.remorqueId
          ? `remorque:${precision.remorqueId}`
          : "";
      if (key) {
        nextPrecisions[key] = {
          immatriculation: precision.immatriculation,
          immatriculationProvisoire: precision.immatriculationProvisoire,
          numeroAttestation: precision.numeroAttestation,
        };
      }
    }
    setPrecisionDrafts(nextPrecisions);
    const nextDuplicataAttestations: Record<string, DuplicataAttestationDraft> = {};
    for (const attestation of request.attestations ?? []) {
      const key = attestation.vehiculeId
        ? `vehicule:${attestation.vehiculeId}`
        : attestation.remorqueId
          ? `remorque:${attestation.remorqueId}`
          : "";
      if (key) {
        nextDuplicataAttestations[key] = {
          numeroAttestation: attestation.numeroAttestation,
        };
      }
    }
    setDuplicataAttestationDrafts(nextDuplicataAttestations);
    if (validatedMovementId) {
      setPreview(savedMovementQuery.data?.quittanceGenerale ?? null);
      setTargetPreview(null);
    }
    setHydratedSourceKey(hydrationKey);
  }, [
    contrat,
    contrat?.assistances,
    contrat?.dateEcheance,
    contrat?.dateEffet,
    contrat?.vehicules,
    draftQuery.data,
    draftQuery.isFetched,
    movementCode,
    rectificationQuery.data,
    rectificationQuery.isFetched,
    savedMovementQuery.data,
    savedMovementQuery.isFetched,
    validatedMovementId,
  ]);

  const previewMutation = useMutation({
    mutationFn: (request: AvenantRequest) => productionApi.previewAvenant(contratId, request),
    onSuccess: (data, request) => {
      if (globalPreviewRequestKeyRef.current === JSON.stringify(request)) {
        setPreview(data);
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const targetPreviewMutation = useMutation({
    mutationFn: ({ request }: {
      request: AvenantRequest;
      target: FlotteSectionTarget;
      requestKey: string;
      onSuccess?: () => void;
    }) => productionApi.previewAvenant(contratId, request),
    onSuccess: (data, variables) => {
      if (targetPreviewRequestKeyRef.current !== variables.requestKey) {
        return;
      }
      setTargetPreview(remapScopedPreview(data, variables.target));
      variables.onSuccess?.();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const draftMutation = useMutation({
    mutationFn: (request: AvenantRequest) => productionApi.saveAvenantDraft(contratId, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["avenant-draft", contratId, movementCode] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const saveMutation = useMutation({
    mutationFn: async (request: AvenantRequest) => {
      if (validatedMovementId) {
        return productionApi.rectifyAvenant(contratId, validatedMovementId, request);
      }
      await productionApi.saveAvenantDraft(contratId, request);
      return productionApi.createAvenant(contratId, request);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contrats"] });
      await queryClient.invalidateQueries({ queryKey: ["avenant-context", contratId] });
      toast.success(validatedMovementId ? "Avenant modifié" : "Avenant enregistré");
      navigate("/app/production/contrats");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const buildDraftRequest = (guaranteesOverride?: GarantieInput[]): AvenantRequest => {
    const draftGaranties = guaranteesOverride ?? selectedGaranties;
    const request: AvenantRequest = {
      codeTypeMouvement: movementCode,
      dateEffet,
      dateEcheance: contrat?.dateEcheance || dateEcheance || undefined,
    };
    if (isVehicleTargetCreationCode(movementCode)) {
      const normalizedVehicules = vehicules.map((item) => normalizeVehicle(item, dateEffet, request.dateEcheance, sharedCrm));
      const normalizedRemorques = movementCode === "INC_F"
        ? remorques.map((item) => normalizeRemorque(item, dateEffet, request.dateEcheance))
        : [];
      request.vehicules = isSingleVehicleTargetCreationCode(movementCode)
        ? normalizedVehicules.slice(0, 1)
        : normalizedVehicules;
      request.remorques = normalizedRemorques;
      request.garanties = ensureRcGaranties(
        draftGaranties,
        request.vehicules.length,
        request.remorques.length,
        garanties.data ?? []
      );
      if (showAvenantAssistance) {
        request.assistances = buildAvenantAssistances(targetAssistances);
      }
    }
    if (isGuaranteeModificationCode(movementCode)) {
      request.garanties = draftGaranties;
      if (showAvenantAssistance) {
        request.assistances = buildAvenantAssistances(targetAssistances, {
          includeDisabled: true,
          onlyModified: true,
        });
      }
    }
    if (movementCode === "EXR_M") {
      request.remorques = remorques.map((item) => normalizeRemorque(item, dateEffet, request.dateEcheance));
      request.garanties = ensureRcGaranties(draftGaranties, 0, request.remorques.length, garanties.data ?? []);
    }
    const selected = splitTargets(targets, selectedTargetIds);
    if (movementCode === "RET_F" || movementCode === "EXR_F" || movementCode === "DUP_F" || movementCode === "DUP_M" || isPrecisionCode(movementCode)) {
      request.vehiculeIds = selected.vehiculeIds;
      request.remorqueIds = selected.remorqueIds;
    }
    if (isPrecisionCode(movementCode)) {
      request.precisions = selectedTargetIds.flatMap((targetId) => {
        const target = targets.find((item) => targetKey(item) === targetId);
        if (!target) return [];
        const precision = precisionDrafts[targetId] ?? {};
        return [target.kind === "vehicule"
          ? { vehiculeId: target.id, ...precision }
          : { remorqueId: target.id, ...precision }];
      });
    }
    if (isDuplicataCode(movementCode)) {
      request.attestations = selectedTargetIds.flatMap((targetId) => {
        const target = targets.find((item) => targetKey(item) === targetId);
        if (!target) return [];
        const attestation = duplicataAttestationDrafts[targetId] ?? {};
        return [target.kind === "vehicule"
          ? { vehiculeId: target.id, ...attestation }
          : { remorqueId: target.id, ...attestation }];
      });
    }
    return request;
  };

  const buildRequest = (silent = false, garantiesOverride?: GarantieInput[]): AvenantRequest | null => {
    const currentGaranties = garantiesOverride ?? selectedGaranties;
    const notify = (message: string) => {
      if (!silent) {
        toast.error(message);
      }
    };
    if (!dateEffet) {
      notify("La date d'effet est obligatoire");
      return null;
    }
    const request = buildDraftRequest(currentGaranties);
    if (isVehicleTargetCreationCode(movementCode)) {
      const allNormalizedVehicules = vehicules.map((item) => normalizeVehicle(item, dateEffet, request.dateEcheance, sharedCrm));
      const normalizedVehicules = isSingleVehicleTargetCreationCode(movementCode)
        ? allNormalizedVehicules.slice(0, 1)
        : allNormalizedVehicules;
      const normalizedRemorques = movementCode === "INC_F"
        ? remorques.map((item) => normalizeRemorque(item, dateEffet, request.dateEcheance))
        : [];
      const garantiesRequest = ensureRcGaranties(currentGaranties, normalizedVehicules.length, normalizedRemorques.length, garanties.data ?? []);
      const invalidVehicule = normalizedVehicules
        .map((item) => vehicleValidationMessage(item, avenantTargetUsages))
        .find(Boolean);
      if (invalidVehicule) {
        notify(invalidVehicule);
        return null;
      }
      if (garantiesRequest.length === 0) {
        notify("Sélectionnez au moins une garantie");
        return null;
      }
      request.vehicules = normalizedVehicules;
      request.remorques = normalizedRemorques;
      request.garanties = garantiesRequest;
      if (showAvenantAssistance) {
        const assistanceError = assistanceValidationMessage(targetAssistances);
        if (assistanceError) {
          notify(assistanceError);
          return null;
        }
        request.assistances = buildAvenantAssistances(targetAssistances);
      }
    }
    if (isGuaranteeModificationCode(movementCode)) {
      if (!hasActiveTargets) {
        notify("Aucune cible active disponible pour cet avenant");
        return null;
      }
      if (currentGaranties.length === 0) {
        notify("Sélectionnez au moins une garantie");
        return null;
      }
      request.garanties = currentGaranties;
      if (showAvenantAssistance) {
        request.assistances = buildAvenantAssistances(targetAssistances, {
          includeDisabled: true,
          onlyModified: true,
        });
      }
    }
    if (movementCode === "EXR_M") {
      const normalizedRemorques = remorques.map((item) => normalizeRemorque(item, dateEffet, request.dateEcheance));
      const garantiesRequest = ensureRcGaranties(currentGaranties, 0, normalizedRemorques.length, garanties.data ?? []);
      const invalidRemorque = normalizedRemorques.map(remorqueValidationMessage).find(Boolean);
      if (invalidRemorque) {
        notify(invalidRemorque);
        return null;
      }
      if (garantiesRequest.length === 0) {
        notify("Sélectionnez au moins une garantie");
        return null;
      }
      request.remorques = normalizedRemorques;
      request.garanties = garantiesRequest;
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
    if (isPrecisionCode(movementCode)) {
      const selected = splitTargets(targets, selectedTargetIds);
      const precisions: NonNullable<AvenantRequest["precisions"]> = [];
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
      const missingAttestation = selectedTargetIds.some((targetId) => {
        const target = targets.find((item) => targetKey(item) === targetId);
        return Boolean(target?.consommeAttestation) && !precisionDrafts[targetId]?.numeroAttestation?.trim();
      });
      if (missingAttestation) {
        notify("Le numéro d’attestation est obligatoire pour chaque cible de la précision");
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
    if (movementCode === "DUP_F" || movementCode === "DUP_M") {
      const selected = splitTargets(targets, selectedTargetIds);
      if (!selected.vehiculeIds.length && !selected.remorqueIds.length) {
        notify("Sélectionnez au moins une cible pour le duplicata");
        return null;
      }
      const attestations: NonNullable<AvenantRequest["attestations"]> = [];
      selectedTargetIds.forEach((targetId) => {
        const target = targets.find((item) => targetKey(item) === targetId);
        if (!target) return;
        const numeroAttestation = duplicataAttestationDrafts[targetId]?.numeroAttestation?.trim();
        if (Boolean(target.consommeAttestation) && !numeroAttestation) {
          return;
        }
        attestations.push(target.kind === "vehicule"
          ? { vehiculeId: target.id, numeroAttestation }
          : { remorqueId: target.id, numeroAttestation });
      });
      const missingAttestation = selectedTargetIds.some((targetId) => {
        const target = targets.find((item) => targetKey(item) === targetId);
        return Boolean(target?.consommeAttestation) && !duplicataAttestationDrafts[targetId]?.numeroAttestation?.trim();
      });
      if (missingAttestation) {
        notify("Le numéro d’attestation est obligatoire pour chaque cible du duplicata");
        return null;
      }
      request.vehiculeIds = selected.vehiculeIds;
      request.remorqueIds = selected.remorqueIds;
      request.attestations = attestations;
    }
    return request;
  };

  const buildTargetCreationPreviewRequest = (
    target: FlotteSectionTarget,
    silent = false,
    guaranteesOverride?: GarantieInput[]
  ): AvenantRequest | null => {
    const notify = (message: string) => {
      if (!silent) {
        toast.error(message);
      }
    };
    if (!dateEffet) {
      notify("La date d'effet est obligatoire");
      return null;
    }
    const request: AvenantRequest = {
      codeTypeMouvement: movementCode,
      dateEffet,
      dateEcheance: contrat?.dateEcheance || dateEcheance || undefined,
    };
    const previewGaranties = guaranteesOverride ?? selectedGaranties;
    if (isVehicleTargetCreationCode(movementCode)) {
      const normalizedVehicules = target.kind === "vehicule"
        ? [normalizeVehicle(vehicules[target.index], dateEffet, request.dateEcheance, sharedCrm)]
        : [];
      const normalizedRemorques = movementCode === "INC_F" && target.kind === "remorque"
        ? [normalizeRemorque(remorques[target.index], dateEffet, request.dateEcheance)]
        : [];
      const garantiesRequest = ensureRcGaranties(
        scopeGarantiesForTarget(previewGaranties, target),
        normalizedVehicules.length,
        normalizedRemorques.length,
        garanties.data ?? []
      );
      request.vehicules = normalizedVehicules;
      request.remorques = normalizedRemorques;
      request.garanties = garantiesRequest;
      request.assistances = showAvenantAssistance && target.kind === "vehicule"
        ? buildAvenantAssistancesForTarget(targetAssistances, target.index)
        : [];
      return request;
    }
    if (movementCode === "EXR_M") {
      const normalizedRemorques = target.kind === "remorque"
        ? [normalizeRemorque(remorques[target.index], dateEffet, request.dateEcheance)]
        : [];
      request.remorques = normalizedRemorques;
      request.garanties = ensureRcGaranties(scopeGarantiesForTarget(previewGaranties, target), 0, normalizedRemorques.length, garanties.data ?? []);
      return request;
    }
    return buildRequest(silent);
  };

  useEffect(() => {
    if (initialLoading || saveMutation.isPending) {
      return;
    }
    const request = buildRequest(true);
    if (isTargetCreationCode(movementCode)) {
      const key = request
        ? JSON.stringify(request)
        : JSON.stringify({ movementCode, dateEffet, dateEcheance, vehicules, remorques, selectedGaranties, targetAssistances });
      if (manualPreviewKeyRef.current && manualPreviewKeyRef.current !== key) {
        setPreview(null);
      }
      autoPreviewKeyRef.current = "";
      return;
    }
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
      globalPreviewRequestKeyRef.current = key;
      previewMutation.mutate(request);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [
    initialLoading,
    saveMutation.isPending,
    movementCode,
    contratId,
    contrat?.dateEcheance,
    dateEffet,
    dateEcheance,
    targets,
    selectedTargetIds,
    precisionDrafts,
    duplicataAttestationDrafts,
    vehicules,
    remorques,
    selectedGaranties,
    targetAssistances,
  ]);

  useEffect(() => {
    const hydrationKey = `${movementCode}:${validatedMovementId ?? "draft"}`;
    const hydratedRequest = validatedMovementId ? rectificationQuery.data : draftQuery.data?.request;
    if (validatedMovementId
        || !isTargetCreationCode(movementCode)
        || !hydratedRequest
        || hydratedSourceKey !== hydrationKey
        || previewedDraftCodeRef.current === hydrationKey) {
      return;
    }
    const request = buildRequest(true);
    if (!request) {
      return;
    }
    previewedDraftCodeRef.current = hydrationKey;
    manualPreviewKeyRef.current = JSON.stringify(request);
    globalPreviewRequestKeyRef.current = JSON.stringify(request);
    previewMutation.mutate(request);
  }, [
    draftQuery.data,
    hydratedSourceKey,
    movementCode,
    rectificationQuery.data,
    validatedMovementId,
    dateEffet,
    dateEcheance,
    vehicules,
    remorques,
    selectedGaranties,
    targetAssistances,
  ]);

  const save = () => {
    const request = buildRequest();
    if (request) saveMutation.mutate(request);
  };

  const saveDraft = () => {
    draftMutation.mutate(buildDraftRequest(), {
      onSuccess: () => toast.success("Brouillon d'avenant enregistré"),
    });
  };

  const validateTargetCreation = (target: FlotteSectionTarget, part?: "info" | "garanties") => {
    if (!isTargetCreationCode(movementCode)) {
      return true;
    }
    if (target.kind === "vehicule") {
      const vehicule = normalizeVehicle(
        vehicules[target.index],
        dateEffet,
        contrat?.dateEcheance || dateEcheance,
        sharedCrm
      );
      const validationMessage = vehicleValidationMessage(vehicule, avenantTargetUsages);
      if (validationMessage) {
        toast.error(validationMessage);
        return false;
      }
    }
    if (target.kind === "remorque") {
      const remorque = remorques[target.index];
      const validationMessage = remorqueValidationMessage(remorque);
      if (validationMessage) {
        toast.error(validationMessage);
        return false;
      }
    }
    if (part === "garanties") {
      const hasSelectedGarantie = selectedGaranties.some((garantie) =>
        target.kind === "vehicule" ? garantie.vehiculeIndex === target.index : garantie.remorqueIndex === target.index
      );
      if (!hasSelectedGarantie) {
        toast.error("Sélectionnez au moins une garantie pour cette cible");
        return false;
      }
      if (showAvenantAssistance && target.kind === "vehicule") {
        const assistanceError = assistanceValidationMessage({
          [`vehicule:${target.index}`]: targetAssistances[`vehicule:${target.index}`] ?? { enabled: false },
        });
        if (assistanceError) {
          toast.error(assistanceError);
          return false;
        }
      }
    }
    return true;
  };

  const previewTargetCreation = (
    target: FlotteSectionTarget,
    onSuccess?: () => void,
    guaranteesOverride?: GarantieInput[]
  ) => {
    const request = buildTargetCreationPreviewRequest(target, false, guaranteesOverride);
    if (!request) {
      return false;
    }
    const requestKey = `${target.kind}:${target.index}:${JSON.stringify(request)}`;
    manualPreviewKeyRef.current = JSON.stringify(request);
    targetPreviewRequestKeyRef.current = requestKey;
    setTargetPreview(null);
    setPreview(null);
    targetPreviewMutation.mutate({
      request,
      target,
      requestKey,
      onSuccess,
    });
    return true;
  };

  const previewCompleteDraft = (garantiesOverride?: GarantieInput[]) => {
    const request = buildRequest(true, garantiesOverride);
    if (!request) {
      setPreview(null);
      return;
    }
    manualPreviewKeyRef.current = JSON.stringify(request);
    globalPreviewRequestKeyRef.current = JSON.stringify(request);
    previewMutation.mutate(request);
  };

  const requestTargetCreationCalculation = (target: FlotteSectionTarget, guaranteesOverride?: GarantieInput[]) => {
    if (!validateTargetCreation(target)) {
      return;
    }
    previewTargetCreation(target, undefined, guaranteesOverride);
  };

  const saveTargetDraft = (
    target: FlotteSectionTarget,
    part: "info" | "garanties",
    label: string,
    onSuccess?: () => void
  ) => {
    if (validatedMovementId) {
      if (!validateTargetCreation(target, part)) {
        return false;
      }
      toast.success(`${label} prêt pour modification`);
      onSuccess?.();
      previewTargetCreation(target, () => previewCompleteDraft(selectedGarantiesRef.current));
      return true;
    }
    const request = buildDraftRequest();
    draftMutation.mutate(request, {
      onSuccess: () => {
        toast.success(`${label} enregistré`);
        onSuccess?.();
        if (isTargetCreationCode(movementCode)) {
          const latestGaranties = selectedGarantiesRef.current;
          previewTargetCreation(
            target,
            () => previewCompleteDraft(latestGaranties),
            latestGaranties
          );
        } else if (part === "garanties") {
          previewCompleteDraft();
        }
      },
    });
    return true;
  };

  if (initialLoading) {
    return <ProductionFormSkeleton variant="avenant" />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/app/production/contrats"><ArrowLeft className="size-4" />Retour liste</Link>
          </Button>
          <h1 className="mt-1 text-xl font-semibold">
            {validatedMovementId ? "Modification de l’avenant" : `Avenant ${contratKindLabel}`} - {MOVEMENT_LABELS[movementCode] ?? movementCode}
          </h1>
          <p className="text-sm text-muted-foreground">{contrat?.numeroDossier ?? contrat?.numeroContrat ?? contratId}</p>
        </div>
        {!validatedMovementId ? <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={saveDraft}
            disabled={draftMutation.isPending || contextQuery.isLoading || !movementAvailable}
          >
            <Save className="size-4" />Enregistrer brouillon
          </Button>
        </div> : null}
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader>
          <CardTitle>Paramètres de l'avenant</CardTitle>
          <CardDescription>La quittance est calculée sur les cibles de cet avenant, puis sauvegardée avec le mouvement.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Type">
            <Select value={movementCode} disabled>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableMovements.map((item) => (
                  <SelectItem key={item.code} value={item.code}>{item.libelle ?? MOVEMENT_LABELS[item.code] ?? item.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date d'effet">
            <DatePicker date={dateEffet} onSelect={(date) => setDateEffet(toDateOnly(date))} />
          </Field>
          <Field label="Date d'échéance">
            <DatePicker date={dateEcheance} disabled />
          </Field>
        </CardContent>
      </Card>

      {isGuaranteeModificationCode(movementCode) && !hasActiveTargets ? (
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle>Cibles concernées</CardTitle>
            <CardDescription>Aucune cible active n'est disponible pour cet avenant. Supprimez d'abord le dernier avenant de clôture si celui-ci a été créé par erreur.</CardDescription>
          </CardHeader>
        </Card>
      ) : isTargetCreationCode(movementCode) || isGuaranteeModificationCode(movementCode) ? (
        <AvenantTargetsSection
          contractType={contrat?.typeContrat}
          targetMode={
            movementCode === "EXR_M"
              ? "remorque"
              : isGuaranteeModificationCode(movementCode)
                ? "existing"
                : "vehicule"
          }
          vehicules={vehicules}
          setVehicules={setVehicules}
          remorques={remorques}
          setRemorques={setRemorques}
          garanties={garanties.data ?? []}
          selectedGaranties={selectedGaranties}
          setSelectedGaranties={setSelectedGaranties}
          lignes={lignesGrille.data ?? []}
          formulesPersonne={formulesPersonne.data ?? []}
          usages={avenantTargetUsages}
          compagnies={compagnies.data ?? []}
          compagnieAssuranceId={contrat?.compagnieAssuranceId}
          marques={marques.data ?? []}
          carrosseries={carrosseries.data ?? []}
          categoriesTransport={categoriesTransport.data ?? []}
          sousClasses={sousClasses.data ?? []}
          compagniesAssistance={compagniesAssistance.data ?? []}
          produitsAssistance={produitsAssistance.data ?? []}
          grilleSelected={Boolean(grilleTarifaireId)}
          pricingMode={contrat?.modeSaisieGaranties ?? "AUTOMATIQUE_GRILLE"}
          preview={preview}
          targetPreview={targetPreview}
          previewing={previewMutation.isPending || targetPreviewMutation.isPending}
          saving={saveMutation.isPending || draftMutation.isPending}
          crmPartage={Boolean(contrat?.crmPartage)}
          crmPartageValeur={contrat?.crmPartageValeur ?? ""}
          showVehicleCrm={false}
          maxRemorques={null}
          targetAssistances={targetAssistances}
          setTargetAssistances={setTargetAssistances}
          showAssistance={showAvenantAssistance}
          assistanceCategorieClientId={assistanceCategorieClientId}
          showInfoSections={isTargetCreationCode(movementCode)}
          allowTargetChanges={movementCode === "INC_F" || movementCode === "EXR_M"}
          onValidateTarget={isTargetCreationCode(movementCode) ? validateTargetCreation : undefined}
          onPreviewQuittance={isTargetCreationCode(movementCode) ? requestTargetCreationCalculation : undefined}
          targetActionMode="save"
          previewAfterInfoSave={false}
          primeColumnLabel={movementCode === "CHV_M" ? "Prime différentielle" : undefined}
          guaranteesAction={isVehicleTargetCreationCode(movementCode) ? (
            <Button
              type="button"
              variant="outline"
              disabled={!configuredGrille}
              onClick={() => setGrilleConfiguratorOpen(true)}
            >
              <Settings2 className="size-4" />
              Grille tarifaire
            </Button>
          ) : null}
          onSaveTargetDraft={isTargetCreationCode(movementCode) || isGuaranteeModificationCode(movementCode) ? saveTargetDraft : undefined}
        />
      ) : !isClosureCode(movementCode) ? (
        <TargetsSection
          movementCode={movementCode}
          targets={targets}
          selectedTargetIds={selectedTargetIds}
          setSelectedTargetIds={setSelectedTargetIds}
          precisionDrafts={precisionDrafts}
          setPrecisionDrafts={setPrecisionDrafts}
          duplicataAttestationDrafts={duplicataAttestationDrafts}
          setDuplicataAttestationDrafts={setDuplicataAttestationDrafts}
          compagnieAssuranceId={contrat?.compagnieAssuranceId}
          compagnies={compagnies.data ?? []}
          usages={usages.data ?? []}
        />
      ) : (
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle>Cibles concernées</CardTitle>
            <CardDescription>{isEcheanceClosureCode(movementCode) ? "La résiliation à l'échéance conserve les cibles actives jusqu'à la date d'échéance." : "La résiliation portera sur toutes les cibles actives du contrat."}</CardDescription>
          </CardHeader>
          <CardContent><Badge variant="secondary">{targets.length} cible(s) active(s)</Badge></CardContent>
        </Card>
      )}

      <Card className="border-border/70 shadow-none">
        <CardHeader>
          <CardTitle>
            {movementCode === "CHV_M" ? "Quittance différentielle (nouveau - ancien restant)" : "Quittance"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QuittancePreviewCard preview={preview} loading={previewMutation.isPending} />
        </CardContent>
      </Card>

      <div className="flex justify-end border-t pt-4">
        <Button
          type="button"
          onClick={save}
          disabled={
            saveMutation.isPending
            || draftMutation.isPending
            || contextQuery.isLoading
            || rectificationQuery.isLoading
            || (!movementAvailable && !validatedMovementId)
            || (isGuaranteeModificationCode(movementCode) && !hasActiveTargets)
          }
        >
          <Save className="size-4" />
          {validatedMovementId ? "Valider les modifications" : "Valider l’avenant"}
        </Button>
      </div>

      <Sheet open={grilleConfiguratorOpen} onOpenChange={setGrilleConfiguratorOpen}>
        <SheetContent side="right" className="w-[min(96vw,1180px)] overflow-y-auto sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Configurer la grille tarifaire</SheetTitle>
            <SheetDescription>
              {configuredGrille?.libelle ?? "Grille tarifaire"}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {configuredGrille ? (
              <GrilleTarifaireConfigurator
                grille={configuredGrille}
                garanties={garanties.data ?? []}
                usages={usages.data ?? []}
                categoriesTransport={categoriesTransport.data ?? []}
                queryScope={`avenant-${contratId}-${configuredGrille.id}`}
                onSaved={() => setGrilleConfiguratorOpen(false)}
              />
            ) : (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                Ce contrat n'a pas de grille tarifaire assignée.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
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
  duplicataAttestationDrafts,
  setDuplicataAttestationDrafts,
  compagnieAssuranceId,
  compagnies,
  usages,
}: {
  movementCode: string;
  targets: Target[];
  selectedTargetIds: string[];
  setSelectedTargetIds: (value: string[] | ((current: string[]) => string[])) => void;
  precisionDrafts: Record<string, PrecisionDraft>;
  setPrecisionDrafts: (value: Record<string, PrecisionDraft> | ((current: Record<string, PrecisionDraft>) => Record<string, PrecisionDraft>)) => void;
  duplicataAttestationDrafts: Record<string, DuplicataAttestationDraft>;
  setDuplicataAttestationDrafts: (value: Record<string, DuplicataAttestationDraft> | ((current: Record<string, DuplicataAttestationDraft>) => Record<string, DuplicataAttestationDraft>)) => void;
  compagnieAssuranceId?: string | null;
  compagnies: ReferenceOption[];
  usages: ReferenceOption[];
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle>Cibles concernées</CardTitle>
        <CardDescription>{movementCode === "DUP_F" || movementCode === "DUP_M" ? "Sélectionnez les cibles du duplicata et renseignez leur nouvelle attestation." : "Sélectionnez les véhicules ou remorques concernés."}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className={cn("w-full border-collapse text-sm", isPrecisionCode(movementCode) || isDuplicataCode(movementCode) ? "min-w-[980px]" : "min-w-[820px]")}>
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-3" />
              <th className="px-3 py-3 text-left">Cible</th>
              <th className="px-3 py-3 text-left">Usage</th>
              {isPrecisionCode(movementCode) ? <th className="px-3 py-3 text-left">Nouvelle immatriculation / attestation</th> : null}
              {isDuplicataCode(movementCode) ? <th className="px-3 py-3 text-left">Nouvelle attestation</th> : null}
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
                  {isPrecisionCode(movementCode) ? (
                    <td className="px-3 py-2">
                      <div className="grid gap-2 md:grid-cols-3">
                        <Input disabled={!checked} placeholder="Immatriculation" value={precisionDrafts[key]?.immatriculation ?? ""} onChange={(event) => updatePrecision(key, { immatriculation: event.target.value }, setPrecisionDrafts)} />
                        {target.kind === "vehicule" ? <Input disabled={!checked} placeholder="WW" value={precisionDrafts[key]?.immatriculationProvisoire ?? ""} onChange={(event) => updatePrecision(key, { immatriculationProvisoire: event.target.value }, setPrecisionDrafts)} /> : null}
                        <AttestationNumberInput
                          disabled={!checked}
                          required={checked && Boolean(target.consommeAttestation)}
                          value={precisionDrafts[key]?.numeroAttestation ?? ""}
                          onChange={(value) => updatePrecision(key, { numeroAttestation: value }, setPrecisionDrafts)}
                          compagnieAssuranceId={compagnieAssuranceId}
                          usageId={target.usageId}
                          compagnies={compagnies}
                          usages={usages}
                          numeroCourant={target.numeroAttestation}
                          placeholder="Attestation"
                        />
                      </div>
                    </td>
                  ) : null}
                  {isDuplicataCode(movementCode) ? (
                    <td className="px-3 py-2">
                      <AttestationNumberInput
                        disabled={!checked}
                        required={checked && Boolean(target.consommeAttestation)}
                        value={duplicataAttestationDrafts[key]?.numeroAttestation ?? ""}
                        onChange={(value) => updateDuplicataAttestation(key, { numeroAttestation: value }, setDuplicataAttestationDrafts)}
                        compagnieAssuranceId={compagnieAssuranceId}
                        usageId={target.usageId}
                        compagnies={compagnies}
                        usages={usages}
                        numeroCourant={target.numeroAttestation}
                        placeholder="Attestation duplicata"
                      />
                      {checked && !target.consommeAttestation ? (
                        <p className="mt-1 text-xs text-muted-foreground">Stock non contrôlé pour cet usage.</p>
                      ) : null}
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

function normalizeVehicle(
  vehicle: VehiculeInput,
  dateEffet?: string,
  dateEcheance?: string,
  sharedCrm?: string
): VehiculeInput {
  return {
    ...vehicle,
    typeVehicule: vehicle.typeVehicule ?? "AUTOMOBILE",
    crm: vehicle.crm?.trim() || sharedCrm?.trim() || undefined,
    dateEffet,
    dateEcheance,
  };
}

function normalizeRemorque(remorque: RemorqueInput, dateEffet?: string, dateEcheance?: string): RemorqueInput {
  return { ...remorque, dateEffet, dateEcheance };
}

function buildAvenantAssistances(
  assistances: Record<string, AssistanceDraft>,
  options: { includeDisabled?: boolean; onlyModified?: boolean } = {}
): NonNullable<AvenantRequest["assistances"]> {
  return Object.entries(assistances).flatMap(([key, assistance]) => {
    const match = key.match(/^vehicule:(\d+)$/);
    if (!match
        || (!options.includeDisabled && !assistance.enabled)
        || (options.onlyModified && !assistance.modified)) {
      return [];
    }
    return [{
      assistanceId: assistance.assistanceId,
      vehiculeIndex: Number(match[1]),
      enabled: assistance.enabled,
      compagnieAssistanceId: assistance.compagnieAssistanceId,
      produitAssistanceId: assistance.produitAssistanceId,
      dateSouscription: assistance.dateSouscription,
      dateEffet: assistance.dateEffet,
      echeanceCode: assistance.echeanceCode,
      numeroContratOuQuittance: assistance.numeroContratOuQuittance,
      typeQuittance: "AVENANT",
    }];
  });
}

function buildAvenantAssistancesForTarget(
  assistances: Record<string, AssistanceDraft>,
  vehiculeIndex: number
): NonNullable<AvenantRequest["assistances"]> {
  return buildAvenantAssistances({
    "vehicule:0": assistances[`vehicule:${vehiculeIndex}`] ?? { enabled: false },
  }).filter((assistance) => assistance.compagnieAssistanceId && assistance.produitAssistanceId);
}

function hydrateAvenantAssistances(
  assistances?: AvenantRequest["assistances"]
): Record<string, AssistanceDraft> {
  const hydrated: Record<string, AssistanceDraft> = {};
  for (const assistance of assistances ?? []) {
    hydrated[`vehicule:${assistance.vehiculeIndex}`] = {
      assistanceId: assistance.assistanceId,
      enabled: assistance.enabled !== false,
      modified: true,
      compagnieAssistanceId: assistance.compagnieAssistanceId,
      produitAssistanceId: assistance.produitAssistanceId,
      dateSouscription: assistance.dateSouscription,
      dateEffet: assistance.dateEffet,
      echeanceCode: assistance.echeanceCode,
      numeroContratOuQuittance: assistance.numeroContratOuQuittance,
    };
  }
  return hydrated;
}

function mapCurrentAssistances(
  assistances: NonNullable<ContratSummary["assistances"]>,
  vehicules: Array<{ vehiculeId?: string | number | null }>
): Record<string, AssistanceDraft> {
  const mapped: Record<string, AssistanceDraft> = {};
  for (const assistance of assistances) {
    const vehiculeIndex = assistance.vehiculeId
      ? vehicules.findIndex((vehicule) => String(vehicule.vehiculeId) === String(assistance.vehiculeId))
      : -1;
    if (vehiculeIndex < 0) {
      continue;
    }
    mapped[`vehicule:${vehiculeIndex}`] = {
      assistanceId: assistance.id,
      enabled: true,
      modified: false,
      compagnieAssistanceId: assistance.compagnieAssistanceId ?? undefined,
      produitAssistanceId: assistance.produitAssistanceId ?? undefined,
      dateSouscription: assistance.dateSouscription ?? undefined,
      dateEffet: assistance.dateEffet ?? undefined,
      echeanceCode: assistance.echeanceCode ?? undefined,
      dateEcheance: assistance.dateEcheance ?? undefined,
      numeroContratOuQuittance: assistance.numeroContratOuQuittance ?? undefined,
    };
  }
  return mapped;
}

function assistanceValidationMessage(assistances: Record<string, AssistanceDraft>) {
  for (const assistance of Object.values(assistances)) {
    if (!assistance.enabled || (assistance.modified === false && assistance.assistanceId)) {
      continue;
    }
    if (!assistance.compagnieAssistanceId) {
      return "La compagnie d'assistance est obligatoire";
    }
    if (!assistance.produitAssistanceId) {
      return "Le produit d'assistance est obligatoire";
    }
  }
  return null;
}

function resolveAssistanceCategorieClientId(contrat?: ContratSummary) {
  const clients = contrat?.clients ?? [];
  const preferredRole = contrat?.typeContrat === "FLOTTE" ? "PROPRIETAIRE" : "SOUSCRIPTEUR";
  const preferred = clients
    .filter((link) => link.role === preferredRole)
    .sort((left, right) => Number(Boolean(right.principalPourRole)) - Number(Boolean(left.principalPourRole)))
    .find((link) => link.client?.categorieClientId);
  const fallback = clients.find((link) => link.role === "SOUSCRIPTEUR" && link.client?.categorieClientId);
  return preferred?.client?.categorieClientId ?? fallback?.client?.categorieClientId;
}

function vehicleValidationMessage(vehicle: VehiculeInput | undefined, usages: ReferenceOption[]) {
  if (!vehicle) {
    return "Véhicule introuvable";
  }
  if (!vehicle.usageId) {
    return "L'usage est obligatoire pour chaque véhicule";
  }
  if (!vehicle.marqueId && !vehicle.marqueLibelle?.trim()) {
    return "La marque est obligatoire pour chaque véhicule";
  }
  if (!vehicle.carrosserieId && !vehicle.carrosserieLibelle?.trim()) {
    return "La carrosserie est obligatoire pour chaque véhicule";
  }
  if (!vehicle.immatriculation?.trim()) {
    return "L'immatriculation est obligatoire pour chaque véhicule";
  }
  if (!vehicle.nombrePlaces?.trim()) {
    return "Le nombre de places est obligatoire pour chaque véhicule";
  }
  if (!vehicle.crm?.trim()) {
    return "Le CRM est obligatoire pour chaque véhicule";
  }
  const usage = usages.find((item) => item.id === vehicle.usageId);
  if (Boolean(usage?.byCarburantAndPf) && (!vehicle.carburant?.trim() || !vehicle.puissanceFiscale?.trim())) {
    return "Le carburant et la puissance fiscale sont obligatoires pour cet usage";
  }
  if (Boolean(usage?.bySousClasse) && !vehicle.sousClasse?.trim()) {
    return "La sous-classe est obligatoire pour cet usage";
  }
  if (Boolean(usage?.byPtc) && !vehicle.ptc?.trim()) {
    return "Le PTC est obligatoire pour cet usage";
  }
  if (Boolean(usage?.byCategorieTransport) && !vehicle.categorieTransportId) {
    return "La catégorie de transport est obligatoire pour cet usage";
  }
  if (Boolean(usage?.consommeAttestation) && !vehicle.numeroAttestation?.trim()) {
    return "Le numéro d'attestation est obligatoire pour chaque véhicule";
  }
  return null;
}

function remorqueValidationMessage(remorque: RemorqueInput | undefined) {
  if (!remorque) {
    return "Remorque introuvable";
  }
  return remorque.usageId ? null : "L'usage est obligatoire pour chaque remorque";
}

function ensureRcGaranties(
  selectedGaranties: GarantieInput[],
  vehiculeCount: number,
  remorqueCount: number,
  garanties: ReferenceOption[]
) {
  const rc = garanties.find((garantie) => Boolean(garantie.responsabiliteCivile));
  if (!rc) {
    return selectedGaranties;
  }
  const next = [...selectedGaranties];
  for (let index = 0; index < vehiculeCount; index++) {
    if (!next.some((garantie) => garantie.garantieId === rc.id && garantie.vehiculeIndex === index && garantie.remorqueIndex == null)) {
      next.push(rcGarantieInput(rc, { vehiculeIndex: index }));
    }
  }
  for (let index = 0; index < remorqueCount; index++) {
    if (!next.some((garantie) => garantie.garantieId === rc.id && garantie.remorqueIndex === index && garantie.vehiculeIndex == null)) {
      next.push(rcGarantieInput(rc, { remorqueIndex: index }));
    }
  }
  return next;
}

function scopeGarantiesForTarget(selectedGaranties: GarantieInput[], target: FlotteSectionTarget): GarantieInput[] {
  return selectedGaranties
    .filter((garantie) => target.kind === "vehicule" ? garantie.vehiculeIndex === target.index : garantie.remorqueIndex === target.index)
    .map((garantie) => target.kind === "vehicule"
      ? { ...garantie, vehiculeIndex: 0, remorqueIndex: undefined }
      : { ...garantie, remorqueIndex: 0, vehiculeIndex: undefined }
    );
}

function remapScopedPreview(preview: QuittancePreview, target: FlotteSectionTarget): QuittancePreview {
  const targetKind = target.kind.toUpperCase();
  return {
    ...preview,
    garanties: preview.garanties?.map((garantie) => target.kind === "vehicule"
      ? { ...garantie, vehiculeIndex: target.index, remorqueIndex: undefined }
      : { ...garantie, remorqueIndex: target.index, vehiculeIndex: undefined }
    ),
    targetSummaries: preview.targetSummaries?.map((summary) => (
      String(summary.kind ?? "").toUpperCase() === targetKind
        ? { ...summary, vehiculeIndex: target.kind === "vehicule" ? target.index : undefined, remorqueIndex: target.kind === "remorque" ? target.index : undefined }
        : summary
    )),
  };
}

function rcGarantieInput(rc: ReferenceOption, target: Pick<GarantieInput, "vehiculeIndex" | "remorqueIndex">): GarantieInput {
  return {
    garantieId: rc.id,
    ...target,
    modeSelectionne: String(rc.modeParDefaut ?? "TAUX"),
    sourceValeurSelectionnee: "AUCUNE",
  };
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

function updateDuplicataAttestation(
  key: string,
  patch: DuplicataAttestationDraft,
  setter: (value: Record<string, DuplicataAttestationDraft> | ((current: Record<string, DuplicataAttestationDraft>) => Record<string, DuplicataAttestationDraft>)) => void
) {
  setter((current) => ({ ...current, [key]: { ...(current[key] ?? {}), ...patch } }));
}

const supportedAvenantCodes = new Set([
  "EXG_M",
  "MOG_M",
  "EXR_M",
  "CHV_M",
  "PRI_M",
  "DUP_M",
  "PRO_M",
  "RES_M",
  "RCH_M",
  "ANN_M",
  "INC_F",
  "MOG_F",
  "RET_F",
  "EXR_F",
  "RES_F",
  "RCH_F",
  "PRI_F",
  "DUP_F",
]);

function normalizeCode(code?: string | null) {
  return (code ?? "").trim().toUpperCase();
}

function isGuaranteeModificationCode(code: string) {
  return code === "MOG_F" || code === "MOG_M" || code === "EXG_M";
}

function isPrecisionCode(code: string) {
  return code === "PRI_F" || code === "PRI_M";
}

function isDuplicataCode(code: string) {
  return code === "DUP_F" || code === "DUP_M";
}

function isVehicleTargetCreationCode(code: string) {
  return code === "INC_F" || code === "CHV_M" || code === "PRO_M";
}

function isSingleVehicleTargetCreationCode(code: string) {
  return code === "CHV_M" || code === "PRO_M";
}

function isEcheanceClosureCode(code: string) {
  return code === "RCH_F" || code === "RCH_M";
}

function isClosureCode(code: string) {
  return code === "RES_F" || code === "RES_M" || code === "RCH_F" || code === "RCH_M" || code === "ANN_M";
}

function isTargetCreationCode(code: string) {
  return isVehicleTargetCreationCode(code) || code === "EXR_M";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operation impossible";
}
