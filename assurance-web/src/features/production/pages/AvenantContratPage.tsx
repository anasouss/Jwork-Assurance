import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { amendmentKeys, attestationStockKeys, contractKeys } from "@/lib/query-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { avenantApi } from "../api/avenants";
import {
  assistanceValidationMessage,
  buildAvenantAssistances,
  buildAvenantAssistancesForTarget,
  DEFAULT_VEHICLE,
  ensureRcGaranties,
  hydrateAvenantAssistances,
  isClosureCode,
  isDifferentialCode,
  isDuplicataCode,
  isEcheanceClosureCode,
  isGuaranteeModificationCode,
  isPrecisionCode,
  isSingleVehicleTargetCreationCode,
  isTargetCreationCode,
  isVehicleTargetCreationCode,
  mapCurrentAssistances,
  mapCurrentGaranties,
  normalizeRemorque,
  normalizeVehicle,
  remapScopedPreview,
  remorqueValidationMessage,
  resolveAssistanceCategorieClientId,
  scopeGarantiesForTarget,
  splitTargets,
  targetKey,
  vehicleValidationMessage,
  type AmendmentTarget,
  type DuplicataAttestationDraft,
  type FlotteSectionTarget,
  type PrecisionDraft,
} from "../avenants/amendment-form";
import { useAmendmentReferenceData } from "../avenants/use-amendment-reference-data";
import {
  amendmentLabel,
  isSupportedAmendmentCode,
  normalizeAmendmentCode,
} from "../avenants/amendment-policy";
import { AvenantSelectionTargets } from "../components/AvenantSelectionTargets";
import { GrilleTarifaireConfigurator } from "../components/GrilleTarifaireConfigurator";
import { ProductionFormSkeleton } from "../components/ProductionFormSkeleton";
import { AvenantTargetsSection } from "../components/AvenantTargetsSections";
import { QuittancePreviewCard } from "../components/QuittancePreviewCard";
import { toDateOnly } from "../date";
import type { AssistanceDraft, AvenantRequest, GarantieInput, RemorqueInput, VehiculeInput } from "../types";

export default function AvenantContratPage() {
  const { contratId = "", code = "INC_F" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const movementCode = normalizeAmendmentCode(code);
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
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof avenantApi.previewAvenant>> | null>(null);
  const [targetPreview, setTargetPreview] = useState<Awaited<ReturnType<typeof avenantApi.previewAvenant>> | null>(null);
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
    queryKey: amendmentKeys.context(contratId),
    queryFn: () => avenantApi.getAvenantContext(contratId),
    enabled: Boolean(contratId),
  });
  const draftQuery = useQuery({
    queryKey: amendmentKeys.draft(contratId, movementCode),
    queryFn: () => avenantApi.getAvenantDraft(contratId, movementCode),
    enabled: Boolean(contratId) && !validatedMovementId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const rectificationQuery = useQuery({
    queryKey: amendmentKeys.rectification(contratId, validatedMovementId ?? ""),
    queryFn: () => avenantApi.getAvenantRectification(contratId, validatedMovementId!),
    enabled: Boolean(contratId && validatedMovementId),
  });
  const savedAvenantQuery = useQuery({
    queryKey: amendmentKeys.detail(contratId, validatedMovementId ?? ""),
    queryFn: () => avenantApi.getAvenantDetail(contratId, validatedMovementId!),
    enabled: Boolean(contratId && validatedMovementId),
  });
  useEffect(() => {
    if (rectificationQuery.error) {
      toast.error(errorMessage(rectificationQuery.error));
    }
  }, [rectificationQuery.error]);
  const contrat = contextQuery.data?.contrat;
  const grilleTarifaireId = contrat?.grilleTarifaireId ? String(contrat.grilleTarifaireId) : undefined;
  const {
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
    isLoading: referencesLoading,
  } = useAmendmentReferenceData(grilleTarifaireId);
  const sharedCrm = contrat?.crmPartage
    ? contrat.crmPartageValeur?.trim() || undefined
    : undefined;
  const availableMovements = useMemo(
    () => (contextQuery.data?.mouvementsDisponibles ?? [])
      .filter((item) => isSupportedAmendmentCode(item.code))
      .filter((item) => !item.renouvelleContrat),
    [contextQuery.data?.mouvementsDisponibles]
  );
  const movementDefinition = availableMovements.find((item) => normalizeAmendmentCode(item.code) === movementCode);
  const movementAvailable = availableMovements.some((item) => normalizeAmendmentCode(item.code) === movementCode);
  const showAvenantAssistance = contrat?.typeContrat !== "PARTICULIER"
    && Boolean(movementDefinition?.autoriseAssistance);
  const contratKindLabel = contrat?.typeContrat === "FLOTTE" ? "flotte" : contrat?.typeContrat === "CONVENTION" ? "convention" : "mono";
  const assistanceCategorieClientId = useMemo(
    () => resolveAssistanceCategorieClientId(contrat),
    [contrat]
  );
  const targets = useMemo<AmendmentTarget[]>(() => [
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
  const lockedExtensionGaranties = useMemo(
    () => movementCode === "EXG_M" && contrat
      ? mapCurrentGaranties(contrat.garanties ?? [], vehicules, remorques)
      : [],
    [contrat, movementCode, remorques, vehicules]
  );
  const configuredGrille = useMemo(
    () => grilleTarifaireId
      ? (grilles.data ?? []).find((grille) => grille.id === grilleTarifaireId) ?? { id: grilleTarifaireId, libelle: "Grille tarifaire" }
      : null,
    [grilleTarifaireId, grilles.data]
  );
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
  const initialLoading = contextQuery.isLoading
    || sourceQuery.isLoading
    || savedAvenantQuery.isLoading
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
    if (isVehicleTargetCreationCode(movementCode)) {
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
  }, [movementCode, validatedMovementId]);

  useEffect(() => {
    if (!isDuplicataCode(movementCode) || targets.length === 0) {
      return;
    }
    setSelectedTargetIds((current) => current.length === 0 ? targets.map(targetKey) : current);
  }, [movementCode, targets]);

  useEffect(() => {
    if (!isGuaranteeModificationCode(movementCode) || !contrat) return;
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
    setTargetAssistances(mapCurrentAssistances(contrat.assistances ?? [], mappedVehicules));
  }, [contrat, movementCode]);

  useEffect(() => {
    const sourceFetched = validatedMovementId
      ? rectificationQuery.isFetched && savedAvenantQuery.isFetched
      : draftQuery.isFetchedAfterMount;
    if (!contrat || !sourceFetched || hydratedDraftCodeRef.current === hydrationKey) {
      return;
    }
    hydratedDraftCodeRef.current = hydrationKey;
    const request = validatedMovementId ? rectificationQuery.data : draftQuery.data?.request;
    if (!request) {
      if (isVehicleTargetCreationCode(movementCode)) {
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
      setHydratedSourceKey(hydrationKey);
      return;
    }
    setDateEffet(request.dateEffet ?? undefined);
    setDateEcheance(contrat?.dateEcheance ?? request.dateEcheance ?? undefined);
    if (isVehicleTargetCreationCode(movementCode)) {
      setVehicules(request.vehicules?.length ? request.vehicules : [{ ...DEFAULT_VEHICLE }]);
      setRemorques(movementCode === "INC_F" && request.remorques?.length ? request.remorques : []);
    } else if (movementCode === "EXR_M") {
      setVehicules([]);
      setRemorques(request.remorques?.length ? request.remorques : [{}]);
    }
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
      setPreview(savedAvenantQuery.data?.impactFinancier ?? null);
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
    draftQuery.isFetchedAfterMount,
    hydrationKey,
    movementCode,
    rectificationQuery.data,
    rectificationQuery.isFetched,
    savedAvenantQuery.data,
    savedAvenantQuery.isFetched,
    validatedMovementId,
  ]);

  const previewMutation = useMutation({
    mutationFn: (request: AvenantRequest) => avenantApi.previewAvenant(contratId, request, validatedMovementId),
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
    }) => avenantApi.previewAvenant(contratId, request, validatedMovementId),
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
    mutationFn: (request: AvenantRequest) => avenantApi.saveAvenantDraft(contratId, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: amendmentKeys.draft(contratId, movementCode) });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const saveMutation = useMutation({
    mutationFn: async (request: AvenantRequest) => {
      if (validatedMovementId) {
        return avenantApi.rectifyAvenant(contratId, validatedMovementId, request);
      }
      await avenantApi.saveAvenantDraft(contratId, request);
      return avenantApi.createAvenant(contratId, request);
    },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: amendmentKeys.draft(contratId, movementCode), exact: true });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: contractKeys.all }),
        queryClient.invalidateQueries({ queryKey: amendmentKeys.context(contratId) }),
        queryClient.invalidateQueries({ queryKey: attestationStockKeys.all }),
      ]);
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

  const buildAutoPreviewRequest = useEffectEvent(() => buildRequest(true));
  const runAutoPreview = useEffectEvent((request: AvenantRequest) => {
    previewMutation.mutate(request);
  });

  useEffect(() => {
    if (initialLoading || saveMutation.isPending || validatedMovementId) {
      return;
    }
    const request = buildAutoPreviewRequest();
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
      runAutoPreview(request);
    }, 350);
    return () => window.clearTimeout(timeout);
  // Effect Events read the latest request builder and mutation without retriggering.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialLoading,
    saveMutation.isPending,
    validatedMovementId,
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
    const request = buildAutoPreviewRequest();
    if (!request) {
      return;
    }
    previewedDraftCodeRef.current = hydrationKey;
    manualPreviewKeyRef.current = JSON.stringify(request);
    globalPreviewRequestKeyRef.current = JSON.stringify(request);
    runAutoPreview(request);
  // Effect Events read the latest request builder and mutation without retriggering.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            {validatedMovementId ? "Modification de l’avenant" : `Avenant ${contratKindLabel}`} - {amendmentLabel(movementCode)}
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
                  <SelectItem key={item.code} value={item.code}>{item.libelle ?? amendmentLabel(item.code)}</SelectItem>
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
          lockedGaranties={lockedExtensionGaranties}
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
          primeColumnLabel={isDifferentialCode(movementCode) ? "Prime différentielle" : undefined}
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
        <AvenantSelectionTargets
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
            {isDifferentialCode(movementCode) ? "Quittance différentielle" : "Quittance"}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-700 dark:text-neutral-300"><span>{label}</span>{children}</label>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operation impossible";
}
