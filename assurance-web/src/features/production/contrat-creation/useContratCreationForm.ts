import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { productionApi } from "../api";
import { computeDateEcheanceFromCode, computeDateEcheanceFromMonths } from "../date";
import { contratSchema } from "../schemas";
import { emptyClient } from "../components/ClientSection";
import { emptyVehicule } from "../components/VehiculeSection";
import { validateValeurVenale } from "../utils/vehicle-validation";
import type {
  AssistanceDraft,
  ClientInput,
  ContratSummary,
  CreateContratRequest,
  GarantieInput,
  QuittanceInput,
  QuittancePreview,
  ReferenceOption,
  RemorqueInput,
  TypeContrat,
  VehiculeInput,
  TypePayeurPrime,
  ModeFacturationContrat,
} from "../types";

export type SavableContratSectionKey = "souscripteur" | "proprietaire" | "contrat" | "grille" | "vehicule" | "garanties";
export type ContratSectionKey = SavableContratSectionKey | "vehicule" | "remorque" | "flotteTargets" | "garanties" | "quittances";
export type ContratTargetKey = { kind: "vehicule" | "remorque"; index: number };

export function useContratCreationForm(typeContrat: TypeContrat, draftId?: string, options?: { prospectionMode?: boolean }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [numeroContrat, setNumeroContrat] = useState("");
  const [numeroPolice, setNumeroPolice] = useState("");
  const [numeroAttestation, setNumeroAttestation] = useState("");
  const [compagnieAssuranceId, setCompagnieAssuranceId] = useState("");
  const [conventionId, setConventionId] = useState("");
  const [usageId, setUsageId] = useState("");
  const [grilleTarifaireId, setGrilleTarifaireId] = useState("");
  const [dateEffet, setDateEffet] = useState<string | undefined>();
  const [dateEcheance, setDateEcheance] = useState<string | undefined>();
  const [typeRenouvellement, setTypeRenouvellement] = useState<"renouvelable" | "ferme">("renouvelable");
  const [echeance, setEcheance] = useState<string | undefined>();
  const [modeReglement, setModeReglement] = useState("bureau");
  const [numeroBonCommande, setNumeroBonCommande] = useState("");
  const [typePayeurPrime, setTypePayeurPrime] = useState<TypePayeurPrime>("SOUSCRIPTEUR");
  const [payeurPrimeClientId, setPayeurPrimeClientId] = useState("");
  const [groupeFacturationId, setGroupeFacturationId] = useState("");
  const [modeFacturation, setModeFacturation] = useState<ModeFacturationContrat>("DIRECTE");
  const [referenceMandatPayeur, setReferenceMandatPayeur] = useState("");
  const [fractionnement, setFractionnement] = useState<CreateContratRequest["fractionnement"]>("ANNUEL");
  const [crmPartage, setCrmPartage] = useState(false);
  const [crmPartageValeur, setCrmPartageValeur] = useState("");
  const [tauxRc, setTauxRc] = useState("");
  const [assistanceEnabled, setAssistanceEnabled] = useState(false);
  const [assistanceDraft, setAssistanceDraft] = useState<AssistanceDraft>({ enabled: false });
  const [targetAssistances, setTargetAssistances] = useState<Record<string, AssistanceDraft>>({});
  const [saisiePrimeNette, setSaisiePrimeNette] = useState(false);
  const [clients, setClients] = useState<ClientInput[]>([emptyClient("SOUSCRIPTEUR"), emptyClient("PROPRIETAIRE")]);
  const [vehicules, setVehicules] = useState<VehiculeInput[]>([emptyVehicule()]);
  const [remorques, setRemorques] = useState<RemorqueInput[]>([]);
  const [garanties, setGaranties] = useState<GarantieInput[]>([]);
  const [quittances, setQuittances] = useState<QuittanceInput[]>(defaultQuittanceLines());
  const [preview, setPreview] = useState<QuittancePreview | null>(null);
  const [targetPreview, setTargetPreview] = useState<QuittancePreview | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [savedSections, setSavedSections] = useState<Partial<Record<SavableContratSectionKey, boolean>>>({});
  const [hydratedDraftId, setHydratedDraftId] = useState<string | null>(null);

  const refs = {
    usages: useReference("usages"),
    marques: useReference("marques"),
    carrosseries: useReference("carrosseries"),
    categoriesTransport: useReference("categories-transport"),
    sousClasses: useReference("sous-classes"),
    garanties: useReference("garanties"),
    compagnies: useReference("compagnies-assurance"),
    compagniesAssistance: useReference("compagnies-assistance"),
    produitsAssistance: useReference("produits-assistance"),
    conventions: useReference("conventions"),
    grilles: useReference("grilles-tarifaires"),
    villes: useReference("villes"),
    categoriesClient: useReference("categories-client"),
  };

  const selectedConvention = useMemo(
    () => refs.conventions.data?.find((item) => item.id === conventionId) ?? null,
    [conventionId, refs.conventions.data]
  );

  const conventionUsageIds = useMemo(
    () => referenceStringArray(selectedConvention, "usageIds"),
    [selectedConvention]
  );
  const flotteCategorieClientId = useMemo(() => {
    const proprietaire = clients.find((client) => client.role === "PROPRIETAIRE")?.client.categorieClientId;
    const souscripteur = clients.find((client) => client.role === "SOUSCRIPTEUR")?.client.categorieClientId;
    return proprietaire || souscripteur || "";
  }, [clients]);
  const selectedFlotteCategorie = useMemo(
    () => refs.categoriesClient.data?.find((item) => item.id === flotteCategorieClientId) ?? null,
    [flotteCategorieClientId, refs.categoriesClient.data]
  );
  const isFlotteLocationCategory = typeContrat === "FLOTTE" && String(selectedFlotteCategorie?.code ?? "").trim().toUpperCase() === "LOCATION";
  const flotteUsageIds = useMemo(
    () => referenceStringArray(selectedFlotteCategorie, "usageIds"),
    [selectedFlotteCategorie]
  );

  const availableUsages = useMemo(() => {
    const usages = refs.usages.data ?? [];
    if (typeContrat === "FLOTTE") {
      if (!flotteCategorieClientId || flotteUsageIds.length === 0) {
        return usages;
      }
      const allowedIds = new Set(flotteUsageIds);
      return usages.filter((usage) => allowedIds.has(usage.id));
    }
    if (typeContrat !== "CONVENTION") {
      return usages;
    }
    if (!conventionId || !selectedConvention) {
      return [];
    }
    const allowedIds = new Set(conventionUsageIds);
    return usages.filter((usage) => allowedIds.has(usage.id));
  }, [conventionId, conventionUsageIds, flotteCategorieClientId, flotteUsageIds, refs.usages.data, selectedConvention, typeContrat]);

  useEffect(() => {
    if (typeContrat !== "CONVENTION" || !usageId || !selectedConvention) {
      return;
    }
    if (conventionUsageIds.includes(usageId)) {
      return;
    }
    setUsageId("");
    setVehicules((current) => current.map((vehicule) => ({ ...vehicule, usageId: "" })));
  }, [conventionUsageIds, selectedConvention, typeContrat, usageId]);

  useEffect(() => {
    if (typeContrat !== "FLOTTE" || flotteUsageIds.length === 0) {
      return;
    }
    const allowedIds = new Set(flotteUsageIds);
    setVehicules((current) => {
      const next = current.map((vehicule) => (
        vehicule.usageId && !allowedIds.has(vehicule.usageId) ? { ...vehicule, usageId: "" } : vehicule
      ));
      return next.some((vehicule, index) => vehicule.usageId !== current[index]?.usageId) ? next : current;
    });
  }, [flotteUsageIds, typeContrat]);

  const grilleUsageFilter = typeContrat === "CONVENTION" ? usageId : undefined;
  const selectedConventionTypeEcheance = selectedConvention?.typeEcheance;
  const selectedConventionEcheance = typeof selectedConvention?.echeance === "string" ? selectedConvention.echeance : undefined;
  const conventionHasFixedEcheance = typeContrat === "CONVENTION" && selectedConventionTypeEcheance === "A_ECHEANCE";
  const conventionUsesPeriodicite = typeContrat === "CONVENTION" && selectedConventionTypeEcheance === "DATE_A_DATE";
  const effectiveEcheance = typeContrat === "CONVENTION" && selectedConventionTypeEcheance === "A_ECHEANCE"
    ? selectedConventionEcheance
    : echeance;
  const showContractEcheance = typeRenouvellement === "renouvelable"
    && (typeContrat === "CONVENTION" ? conventionHasFixedEcheance : fractionnement === "ANNUEL");
  const lockDateEcheance = showContractEcheance || conventionUsesPeriodicite;

  const lignesGrille = useQuery({
    queryKey: ["lignes-grille", grilleTarifaireId, grilleUsageFilter],
    queryFn: () => productionApi.lignesGrille({ grilleId: grilleTarifaireId, usageId: grilleUsageFilter }),
    enabled: Boolean(grilleTarifaireId),
  });

  const groupesClients = useQuery({
    queryKey: ["groupes-clients"],
    queryFn: productionApi.listGroupesClients,
    staleTime: 60_000,
  });

  const formulesPersonne = useQuery({
    queryKey: ["formules-garantie-personne", grilleTarifaireId, grilleUsageFilter],
    queryFn: () => productionApi.formulesGarantiePersonne({ grilleId: grilleTarifaireId, usageId: grilleUsageFilter }),
    enabled: Boolean(grilleTarifaireId),
  });

  const draftQuery = useQuery({
    queryKey: ["contrat-draft", draftId],
    queryFn: () => productionApi.getContratDraft(draftId ?? ""),
    enabled: Boolean(draftId),
  });
  const correctionMode = String(draftQuery.data?.statut ?? "").toUpperCase() === "ACTIVE"
    && !draftQuery.data?.prospection
    && !draftQuery.data?.brouillon;

  useEffect(() => {
    const draft = draftQuery.data;
    if (!draftId || !draft || hydratedDraftId === draftId) {
      return;
    }
    const hydrated = hydrateDraft(draft);
    setNumeroContrat(hydrated.numeroContrat);
    setNumeroPolice(hydrated.numeroPolice);
    setNumeroAttestation(hydrated.numeroAttestation);
    setCompagnieAssuranceId(hydrated.compagnieAssuranceId);
    setConventionId(hydrated.conventionId);
    setUsageId(hydrated.usageId);
    setGrilleTarifaireId(hydrated.grilleTarifaireId);
    setDateEffet(hydrated.dateEffet);
    setDateEcheance(hydrated.dateEcheance);
    setTypeRenouvellement(hydrated.typeRenouvellement);
    setEcheance(hydrated.echeance);
    setModeReglement(hydrated.modeReglement);
    setNumeroBonCommande(hydrated.numeroBonCommande);
    setTypePayeurPrime(hydrated.typePayeurPrime);
    setPayeurPrimeClientId(hydrated.payeurPrimeClientId);
    setGroupeFacturationId(hydrated.groupeFacturationId);
    setModeFacturation(hydrated.modeFacturation);
    setReferenceMandatPayeur(hydrated.referenceMandatPayeur);
    setFractionnement(hydrated.fractionnement);
    setCrmPartage(hydrated.crmPartage);
    setCrmPartageValeur(hydrated.crmPartageValeur);
    setTauxRc(hydrated.tauxRc);
    setAssistanceEnabled(hydrated.assistanceEnabled);
    setTargetAssistances(hydrated.targetAssistances);
    setSaisiePrimeNette(hydrated.saisiePrimeNette);
    setClients(hydrated.clients);
    setVehicules(hydrated.vehicules);
    setRemorques(hydrated.remorques);
    setGaranties(hydrated.garanties);
    setPreview(hydrated.preview);
    setTargetPreview(hydrated.targetPreview);
    setHydratedDraftId(draftId);
  }, [draftId, draftQuery.data, hydratedDraftId]);

  useEffect(() => {
    if (!isFlotteLocationCategory && tauxRc) {
      setTauxRc("");
    }
  }, [isFlotteLocationCategory, tauxRc]);

  useEffect(() => {
    const garantiesReference = refs.garanties.data ?? [];
    const mandatory = garantiesReference.filter((garantie) => garantie.responsabiliteCivile);
    if (mandatory.length === 0) {
      return;
    }
    setGaranties((current) => {
      const existingIds = new Set(current.map((item) => item.garantieId));
      const missing = mandatory.filter((garantie) => !existingIds.has(garantie.id));
      if (missing.length === 0) {
        return current;
      }
      return [
        ...current,
        ...missing.map((garantie) => ({
          garantieId: garantie.id,
          vehiculeIndex: String(garantie.typeGarantie ?? "VEHICULE") === "VEHICULE" ? 0 : undefined,
          modeSelectionne: String(garantie.modeParDefaut ?? "TAUX"),
          sourceValeurSelectionnee: String(garantie.sourceValeurParDefaut ?? "AUCUNE"),
        })),
      ];
    });
  }, [refs.garanties.data]);

  const modeSaisieGaranties = typeContrat === "PARTICULIER"
    ? saisiePrimeNette ? "MANUELLE_AVEC_PRIME_NETTE" : "MANUELLE"
    : "AUTOMATIQUE_GRILLE";
  const contractUsageFallback = typeContrat === "FLOTTE" ? "" : usageId;

  const request = useMemo<CreateContratRequest>(() => ({
    agenceId: user?.agenceId ?? "",
    typeContrat,
    numeroContrat: typeContrat === "PARTICULIER" ? numeroContrat : undefined,
    numeroPolice,
    numeroAttestation: typeContrat === "FLOTTE" ? undefined : numeroAttestation,
    compagnieAssuranceId: emptyToUndefined(compagnieAssuranceId),
    conventionId: typeContrat === "CONVENTION" ? emptyToUndefined(conventionId) : undefined,
    usageId: typeContrat === "FLOTTE" ? undefined : emptyToUndefined(usageId),
    grilleTarifaireId: typeContrat === "PARTICULIER" ? undefined : emptyToUndefined(grilleTarifaireId),
    dateEffet,
    dateEcheance,
    echeance: showContractEcheance ? effectiveEcheance : undefined,
    typeRenouvellement,
    periodicite: periodiciteFromFractionnement(fractionnement),
    modeReglement: typeContrat === "CONVENTION" ? modeReglement : undefined,
    numeroBonCommande: typeContrat === "CONVENTION" && modeReglement === "facture" ? emptyToUndefined(numeroBonCommande) : undefined,
    typePayeurPrime,
    payeurPrimeClientId: typePayeurPrime === "MEMBRE_GROUPE" || typePayeurPrime === "TIERS_MANDATE"
      ? emptyToUndefined(payeurPrimeClientId)
      : undefined,
    groupeFacturationId: emptyToUndefined(groupeFacturationId),
    modeFacturation,
    referenceMandatPayeur: typePayeurPrime === "TIERS_MANDATE"
      ? emptyToUndefined(referenceMandatPayeur)
      : undefined,
    fractionnement,
    modeSaisieGaranties,
    saisiePrimeNette: typeContrat === "PARTICULIER" ? saisiePrimeNette : false,
    nombreVehicules: vehicules.length,
    nombreRemorques: remorques.length,
    prospection: Boolean(options?.prospectionMode),
    assistance: typeContrat !== "PARTICULIER" ? assistanceEnabled || assistanceDraft.enabled : false,
    crmPartage: typeContrat === "FLOTTE" ? crmPartage : false,
    crmPartageValeur: typeContrat === "FLOTTE" && crmPartage ? crmPartageValeur : undefined,
    tauxRc: isFlotteLocationCategory ? positiveNumberOrUndefined(tauxRc) : undefined,
    clients: clients.map((client) => ({
      ...client,
      client: {
        ...client.client,
        agenceId: user?.agenceId ?? "",
        telephone: principalTelephone(client.client.telephones),
        telephones: (client.client.telephones ?? []).filter((telephone) => telephone.numero.trim()),
      },
    })),
    vehicules: vehicules.map((vehicule) => ({
      ...vehicule,
      usageId: vehicule.usageId || contractUsageFallback || undefined,
      dateEffet: vehicule.dateEffet || dateEffet,
      dateEcheance: vehicule.dateEcheance || dateEcheance,
      crm: typeContrat === "FLOTTE" && crmPartage ? crmPartageValeur : vehicule.crm,
    })),
    remorques: remorques.map((remorque) => ({
      ...remorque,
      usageId: remorque.usageId || contractUsageFallback || undefined,
    })),
    garanties,
    quittances: typeContrat === "PARTICULIER"
      ? quittances.map((ligne) => ({
          ...ligne,
          primeTotale: totalLine(ligne),
        }))
      : undefined,
  }), [
    user?.agenceId,
    typeContrat,
    numeroContrat,
    numeroPolice,
    numeroAttestation,
    compagnieAssuranceId,
    conventionId,
    usageId,
    contractUsageFallback,
    grilleTarifaireId,
    dateEffet,
    dateEcheance,
    effectiveEcheance,
    showContractEcheance,
    typeRenouvellement,
    modeReglement,
    numeroBonCommande,
    typePayeurPrime,
    payeurPrimeClientId,
    groupeFacturationId,
    modeFacturation,
    referenceMandatPayeur,
    fractionnement,
    crmPartage,
    crmPartageValeur,
    isFlotteLocationCategory,
    tauxRc,
    assistanceEnabled,
    assistanceDraft.enabled,
    modeSaisieGaranties,
    saisiePrimeNette,
    vehicules,
    remorques,
    clients,
    garanties,
    quittances,
    options?.prospectionMode,
  ]);

  useEffect(() => {
    setValidationErrors((current) => {
      const today = dateOnly(new Date());
      const next = Object.fromEntries(
        Object.entries(current).filter(([key]) => !isValidationErrorResolved(key, request, today))
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [request]);

  const previewMutation = useMutation({
    mutationFn: productionApi.previewQuittance,
    onSuccess: (data) => {
      setPreview(data);
      setTargetPreview(null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Prévisualisation impossible"),
  });

  const targetPreviewMutation = useMutation({
    mutationFn: productionApi.previewQuittance,
    onSuccess: setTargetPreview,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Calcul impossible"),
  });

  const autoPreviewMutation = useMutation({
    mutationFn: productionApi.previewQuittance,
    onSuccess: (data) => {
      setPreview(data);
      setTargetPreview(null);
    },
    onError: () => setPreview(null),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateContratRequest) =>
      draftId ? productionApi.finalizeContratDraft(draftId, payload) : productionApi.createContrat(payload),
    onSuccess: async (contrat) => {
      await queryClient.invalidateQueries({ queryKey: ["contrats"] });
      if (draftId) {
        await queryClient.invalidateQueries({ queryKey: ["contrat-draft", draftId] });
      }
      if (options?.prospectionMode) {
        await queryClient.invalidateQueries({ queryKey: ["prospections"] });
        toast.success("Devis créé");
        navigate("/app/production/prospection");
        return;
      }
      if (correctionMode) {
        toast.success("Contrat modifié");
        navigate("/app/production/contrats");
        return;
      }
      toast.success("Contrat créé");
      navigate(`/app/production/contrats/${contrat.id}/pieces-jointes`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : correctionMode ? "Modification impossible" : "Création impossible"),
  });

  const saveDraftMutation = useMutation({
    mutationFn: (payload: CreateContratRequest) => {
      if (!draftId) {
        throw new Error("Brouillon introuvable pour enregistrer cette section");
      }
      return productionApi.updateContratDraft(draftId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contrat-draft", draftId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const saveTargetDraftMutation = useMutation({
    mutationFn: async ({ target, part }: { target: ContratTargetKey; part: "info" | "garanties" }) => {
      if (!draftId) {
        throw new Error("Brouillon introuvable pour enregistrer cette section");
      }
      if (target.kind === "vehicule" && part === "info") {
        return productionApi.saveDraftVehicule(draftId, target.index, request.vehicules[target.index]);
      }
      if (target.kind === "vehicule") {
        const draft = await productionApi.saveDraftVehiculeGaranties(draftId, target.index, targetGaranties(request.garanties, target));
        return syncDraftVehiculeAssistance(draftId, draft, target, targetAssistances[targetKey(target)]);
      }
      if (part === "info") {
        return productionApi.saveDraftRemorque(draftId, target.index, request.remorques[target.index]);
      }
      return productionApi.saveDraftRemorqueGaranties(draftId, target.index, targetGaranties(request.garanties, target));
    },
    onSuccess: async (draft, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["contrat-draft", draftId] });
      const hydrated = hydrateDraft(draft);
      if (variables.part === "garanties") {
        setTargetAssistances(hydrated.targetAssistances);
      }
      if (variables.target.kind === "vehicule") {
        const saved = draft.vehicules?.[variables.target.index];
        if (saved?.vehiculeId != null) {
          setVehicules((current) => current.map((vehicule, index) => (
            index === variables.target.index ? { ...vehicule, vehiculeId: saved.vehiculeId } : vehicule
          )));
        }
      } else {
        const saved = draft.remorques?.[variables.target.index];
        if (saved?.remorqueId != null) {
          setRemorques((current) => current.map((remorque, index) => (
            index === variables.target.index ? { ...remorque, remorqueId: saved.remorqueId } : remorque
          )));
        }
      }
      if (variables.part === "garanties") {
        const savedTargetGaranties = targetGaranties(hydrated.garanties, variables.target);
        setGaranties((current) => [
          ...current.filter((garantie) => !isTargetGarantie(garantie, variables.target)),
          ...savedTargetGaranties,
        ]);
        setPreview(hydrated.preview);
        setTargetPreview(hydrated.targetPreview);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const result = contratSchema.safeParse(options?.prospectionMode && typeContrat === "FLOTTE"
      ? { ...request, numeroPolice: request.numeroPolice || "DEVIS" }
      : request);
    if (!result.success) {
      setValidationErrors({});
      toast.error(result.error.issues[0]?.message ?? "Formulaire incomplet");
      return false;
    }
    if (typeContrat === "CONVENTION" && !conventionId) {
      setValidationErrors({});
      toast.error("Une convention est obligatoire pour un contrat convention");
      return false;
    }
    if (typeContrat !== "PARTICULIER" && !grilleTarifaireId) {
      setValidationErrors({});
      toast.error("Une grille tarifaire est obligatoire pour convention/flotte");
      return false;
    }
    if (showContractEcheance && !effectiveEcheance) {
      setValidationErrors({ echeance: "Échéance obligatoire." });
      toast.error("Échéance obligatoire.");
      return false;
    }
    if (typeContrat === "CONVENTION" && modeReglement === "facture" && !numeroBonCommande.trim()) {
      setValidationErrors({ numeroBonCommande: "N° bon de commande obligatoire." });
      toast.error("N° bon de commande obligatoire.");
      return false;
    }
    if (isFlotteLocationCategory && !positiveNumberOrUndefined(tauxRc)) {
      nextErrors.tauxRc = "Taux RC obligatoire.";
    }
    if ((typePayeurPrime === "MEMBRE_GROUPE" || typePayeurPrime === "TIERS_MANDATE") && !payeurPrimeClientId) {
      nextErrors.payeurPrimeClientId = "Payeur obligatoire.";
    }
    if (typePayeurPrime === "TIERS_MANDATE" && !referenceMandatPayeur.trim()) {
      nextErrors.referenceMandatPayeur = "Référence du mandat obligatoire.";
    }
    if (modeFacturation === "CONSOLIDEE_GROUPE" && !groupeFacturationId) {
      nextErrors.groupeFacturationId = "Groupe de facturation obligatoire.";
    }
    const today = dateOnly(new Date());
    request.clients.forEach((item, index) => {
      if (typeContrat === "FLOTTE" && item.role === "PROPRIETAIRE" && !item.client.categorieClientId) {
        nextErrors[`clients.${index}.client.categorieClientId`] = "Catégorie obligatoire.";
      }
      if (item.role === "PROPRIETAIRE" && !hasTelephone(item.client.telephones)) {
        nextErrors[`clients.${index}.client.telephones`] = "Téléphone obligatoire.";
      }
      if (
        (
          item.role === "CONDUCTEUR"
          || (item.role === "PROPRIETAIRE" && (typeContrat === "FLOTTE" || (item.client.typeClient !== "PERSONNE_MORALE" && item.client.conducteurHabituel !== false)))
        )
        && !item.client.dateValiditePermis
      ) {
        nextErrors[`clients.${index}.client.dateValiditePermis`] = "Validité permis obligatoire.";
      }
      if (isBeforeToday(item.client.cinValidite, today)) {
        nextErrors[`clients.${index}.client.cinValidite`] = "La validité CIN ne doit pas être expirée.";
      }
      if (isBeforeToday(item.client.dateValiditePermis, today)) {
        nextErrors[`clients.${index}.client.dateValiditePermis`] = "La validité permis ne doit pas être expirée.";
      }
    });
    request.vehicules.forEach((vehicule, index) => {
      if (!vehicule.crm?.trim()) {
        nextErrors[`vehicules.${index}.crm`] = "CRM obligatoire.";
      }
      if (!vehicule.nombrePlaces?.trim()) {
        nextErrors[`vehicules.${index}.nombrePlaces`] = "Nombre de places obligatoire.";
      }
      if (isBeforeToday(vehicule.dateExpirationCarteGrise, today)) {
        nextErrors[`vehicules.${index}.dateExpirationCarteGrise`] = "La validité CG ne doit pas être expirée.";
      }
      const valeurVenaleError = validateValeurVenale(vehicule);
      if (valeurVenaleError) {
        nextErrors[`vehicules.${index}.valeurVenale`] = valeurVenaleError;
      }
    });
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0] ?? "Corrigez les champs indiqués");
      return false;
    }
    return true;
  };

  const handlePreview = () => {
    if (validate()) {
      previewMutation.mutate(request);
    }
  };

  const handlePreviewTarget = (target: ContratTargetKey) => {
    if (!validateTarget(target, "garanties")) {
      return;
    }
    targetPreviewMutation.mutate(scopedTargetRequest(request, target));
  };

  const handleCreate = () => {
    if (validate()) {
      createMutation.mutate(request);
    }
  };

  const validateSection = (section: ContratSectionKey) => {
    const nextErrors: Record<string, string> = {};
    const today = dateOnly(new Date());
    const requireField = (key: string, value: unknown, message: string) => {
      if (value == null || (typeof value === "string" && value.trim() === "")) {
        nextErrors[key] = message;
      }
    };
    const validateClient = (role: ClientInput["role"]) => {
      request.clients.forEach((item, index) => {
        if (item.role !== role) {
          return;
        }
        const client = item.client;
        requireField(`clients.${index}.client.typeClient`, client.typeClient, "Type obligatoire.");
        requireField(`clients.${index}.client.villeId`, client.villeId, "Ville obligatoire.");
        requireField(`clients.${index}.client.adresse`, client.adresse, "Adresse obligatoire.");
        if (client.typeClient === "PERSONNE_MORALE") {
          requireField(`clients.${index}.client.rc`, client.rc, "RC obligatoire.");
          requireField(`clients.${index}.client.raisonSociale`, client.raisonSociale, "Raison sociale obligatoire.");
        } else {
          requireField(`clients.${index}.client.civilite`, client.civilite, "Intitulé obligatoire.");
          requireField(`clients.${index}.client.cin`, client.cin, "CIN obligatoire.");
          requireField(`clients.${index}.client.cinValidite`, client.cinValidite, "Validité CIN obligatoire.");
          requireField(`clients.${index}.client.nom`, client.nom, "Nom obligatoire.");
          requireField(`clients.${index}.client.prenom`, client.prenom, "Prénom obligatoire.");
          if (isBeforeToday(client.cinValidite, today)) {
            nextErrors[`clients.${index}.client.cinValidite`] = "La validité CIN ne doit pas être expirée.";
          }
        }
        if (typeContrat === "FLOTTE" && role === "PROPRIETAIRE") {
          requireField(`clients.${index}.client.categorieClientId`, client.categorieClientId, "Catégorie obligatoire.");
        }
        if (role === "PROPRIETAIRE" && !hasTelephone(client.telephones)) {
          nextErrors[`clients.${index}.client.telephones`] = "Téléphone obligatoire.";
        }
        if (
          role === "PROPRIETAIRE"
          && (typeContrat === "FLOTTE" || (client.typeClient !== "PERSONNE_MORALE" && client.conducteurHabituel !== false))
        ) {
          requireField(`clients.${index}.client.dateValiditePermis`, client.dateValiditePermis, "Validité permis obligatoire.");
        }
        if (isBeforeToday(client.dateValiditePermis, today)) {
          nextErrors[`clients.${index}.client.dateValiditePermis`] = "La validité permis ne doit pas être expirée.";
        }
      });
    };

    if (section === "souscripteur") {
      validateClient("SOUSCRIPTEUR");
    }
    if (section === "proprietaire") {
      validateClient("PROPRIETAIRE");
      request.clients
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.role === "CONDUCTEUR")
        .forEach(({ item, index }) => {
          const client = item.client;
          requireField(`clients.${index}.client.civilite`, client.civilite, "Intitulé conducteur obligatoire.");
          requireField(`clients.${index}.client.cin`, client.cin, "CIN conducteur obligatoire.");
          requireField(`clients.${index}.client.nom`, client.nom, "Nom conducteur obligatoire.");
          requireField(`clients.${index}.client.prenom`, client.prenom, "Prénom conducteur obligatoire.");
          requireField(`clients.${index}.client.dateValiditePermis`, client.dateValiditePermis, "Validité permis obligatoire.");
          if (isBeforeToday(client.dateValiditePermis, today)) {
            nextErrors[`clients.${index}.client.dateValiditePermis`] = "La validité permis ne doit pas être expirée.";
          }
        });
    }
    if (section === "contrat") {
      requireField("compagnieAssuranceId", compagnieAssuranceId, "Compagnie obligatoire.");
      if (typeContrat === "FLOTTE") {
        if (!options?.prospectionMode) {
          requireField("numeroPolice", numeroPolice, "N° police obligatoire.");
        }
      } else if (typeContrat === "PARTICULIER") {
        requireField("numeroContrat", numeroContrat, "N° contrat obligatoire.");
      } else if (typeContrat === "CONVENTION") {
        requireField("numeroPolice", numeroPolice, "N° police obligatoire.");
      }
      requireField("typeRenouvellement", typeRenouvellement, "Type de contrat obligatoire.");
      requireField("dateEffet", dateEffet, "Date effet obligatoire.");
      requireField("dateEcheance", dateEcheance, "Date échéance obligatoire.");
      if (showContractEcheance) {
        requireField("echeance", effectiveEcheance, "Échéance obligatoire.");
      }
      if (isFlotteLocationCategory && !positiveNumberOrUndefined(tauxRc)) {
        nextErrors.tauxRc = "Taux RC obligatoire.";
      }
      if ((typePayeurPrime === "MEMBRE_GROUPE" || typePayeurPrime === "TIERS_MANDATE") && !payeurPrimeClientId) {
        nextErrors.payeurPrimeClientId = "Payeur obligatoire.";
      }
      if (typePayeurPrime === "TIERS_MANDATE" && !referenceMandatPayeur.trim()) {
        nextErrors.referenceMandatPayeur = "Référence du mandat obligatoire.";
      }
      if (modeFacturation === "CONSOLIDEE_GROUPE" && !groupeFacturationId) {
        nextErrors.groupeFacturationId = "Groupe de facturation obligatoire.";
      }
      if (typeContrat === "CONVENTION") {
        requireField("conventionId", conventionId, "Convention obligatoire.");
        requireField("modeReglement", modeReglement, "Mode de règlement obligatoire.");
        if (modeReglement === "facture") {
          requireField("numeroBonCommande", numeroBonCommande, "N° bon de commande obligatoire.");
        }
      }
    }
    if (section === "grille") {
      requireField("grilleTarifaireId", grilleTarifaireId, "Grille tarifaire obligatoire.");
    }
    if (section === "vehicule" || section === "flotteTargets") {
      request.vehicules.forEach((vehicule, index) => {
        const vehiculeUsageId = vehicule.usageId || contractUsageFallback;
        const vehiculeUsage = refs.usages.data?.find((usage) => usage.id === vehiculeUsageId);
        requireField(`vehicules.${index}.typeVehicule`, vehicule.typeVehicule, "Type véhicule obligatoire.");
        requireField(`vehicules.${index}.usageId`, vehiculeUsageId, "Usage véhicule obligatoire.");
        requireField(`vehicules.${index}.immatriculation`, vehicule.immatriculation, "Immatriculation obligatoire.");
        requireField(`vehicules.${index}.marqueId`, vehicule.marqueId || vehicule.marqueLibelle, "Marque obligatoire.");
        requireField(`vehicules.${index}.carrosserieId`, vehicule.carrosserieId || vehicule.carrosserieLibelle, "Carrosserie obligatoire.");
        if (vehiculeUsage?.byCarburantAndPf) {
          requireField(`vehicules.${index}.carburant`, vehicule.carburant, "Carburant obligatoire.");
          requireField(`vehicules.${index}.puissanceFiscale`, vehicule.puissanceFiscale, "Puissance fiscale obligatoire.");
        }
        if (vehiculeUsage?.bySousClasse) {
          requireField(`vehicules.${index}.sousClasse`, vehicule.sousClasse, "Sous-classe obligatoire.");
        }
        if (vehiculeUsage?.byPtc) {
          requireField(`vehicules.${index}.ptc`, vehicule.ptc, "PTC obligatoire.");
        }
        if (vehiculeUsage?.byCategorieTransport) {
          requireField(`vehicules.${index}.categorieTransportId`, vehicule.categorieTransportId, "Catégorie transport obligatoire.");
        }
        requireField(`vehicules.${index}.crm`, vehicule.crm, "CRM obligatoire.");
        requireField(`vehicules.${index}.nombrePlaces`, vehicule.nombrePlaces, "Nombre de places obligatoire.");
        if (isBeforeToday(vehicule.dateExpirationCarteGrise, today)) {
          nextErrors[`vehicules.${index}.dateExpirationCarteGrise`] = "La validité CG ne doit pas être expirée.";
        }
        const valeurVenaleError = validateValeurVenale(vehicule);
        if (valeurVenaleError) {
          nextErrors[`vehicules.${index}.valeurVenale`] = valeurVenaleError;
        }
      });
    }
    if (section === "remorque") {
      request.remorques.forEach((remorque, index) => {
        requireField(`remorques.${index}.usageId`, remorque.usageId, "Usage remorque obligatoire.");
      });
    }
    if (section === "garanties" && request.garanties.length === 0) {
      nextErrors.garanties = "Au moins une garantie est obligatoire.";
    }
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0] ?? "Section incomplète");
      return false;
    }
    return true;
  };

  const handleSaveSection = (section: SavableContratSectionKey) => {
    const label = sectionLabel(section);
    if (!validateSection(section)) {
      return;
    }
    saveDraftMutation.mutate(request, {
      onSuccess: () => {
        setSavedSections((current) => ({ ...current, [section]: true }));
        toast.success(`${label} enregistré`);
      },
    });
  };

  const validateTarget = (target: ContratTargetKey, part: "info" | "garanties" = "info") => {
    const nextErrors: Record<string, string> = {};
    const today = dateOnly(new Date());
    const requireField = (key: string, value: unknown, message: string) => {
      if (value == null || (typeof value === "string" && value.trim() === "")) {
        nextErrors[key] = message;
      }
    };
    if (target.kind === "vehicule") {
      const vehicule = request.vehicules[target.index];
      if (!vehicule) {
        nextErrors[`vehicules.${target.index}.immatriculation`] = "Véhicule introuvable.";
      } else {
        const vehiculeUsageId = vehicule.usageId || contractUsageFallback;
        const vehiculeUsage = refs.usages.data?.find((usage) => usage.id === vehiculeUsageId);
        requireField(`vehicules.${target.index}.typeVehicule`, vehicule.typeVehicule, "Type véhicule obligatoire.");
        requireField(`vehicules.${target.index}.usageId`, vehiculeUsageId, "Usage véhicule obligatoire.");
        requireField(`vehicules.${target.index}.immatriculation`, vehicule.immatriculation, "Immatriculation obligatoire.");
        requireField(`vehicules.${target.index}.marqueId`, vehicule.marqueId || vehicule.marqueLibelle, "Marque obligatoire.");
        requireField(`vehicules.${target.index}.carrosserieId`, vehicule.carrosserieId || vehicule.carrosserieLibelle, "Carrosserie obligatoire.");
        if (vehiculeUsage?.byCarburantAndPf) {
          requireField(`vehicules.${target.index}.carburant`, vehicule.carburant, "Carburant obligatoire.");
          requireField(`vehicules.${target.index}.puissanceFiscale`, vehicule.puissanceFiscale, "Puissance fiscale obligatoire.");
        }
        if (vehiculeUsage?.bySousClasse) {
          requireField(`vehicules.${target.index}.sousClasse`, vehicule.sousClasse, "Sous-classe obligatoire.");
        }
        if (vehiculeUsage?.byPtc) {
          requireField(`vehicules.${target.index}.ptc`, vehicule.ptc, "PTC obligatoire.");
        }
        if (vehiculeUsage?.byCategorieTransport) {
          requireField(`vehicules.${target.index}.categorieTransportId`, vehicule.categorieTransportId, "Catégorie transport obligatoire.");
        }
        requireField(`vehicules.${target.index}.crm`, vehicule.crm, "CRM obligatoire.");
        requireField(`vehicules.${target.index}.nombrePlaces`, vehicule.nombrePlaces, "Nombre de places obligatoire.");
        if (isBeforeToday(vehicule.dateExpirationCarteGrise, today)) {
          nextErrors[`vehicules.${target.index}.dateExpirationCarteGrise`] = "La validité CG ne doit pas être expirée.";
        }
        const valeurVenaleError = validateValeurVenale(vehicule);
        if (valeurVenaleError) {
          nextErrors[`vehicules.${target.index}.valeurVenale`] = valeurVenaleError;
        }
      }
    } else {
      const remorque = request.remorques[target.index];
      if (!remorque) {
        nextErrors[`remorques.${target.index}.usageId`] = "Remorque introuvable.";
      } else {
        requireField(`remorques.${target.index}.usageId`, remorque.usageId, "Usage remorque obligatoire.");
      }
    }
    if (part === "garanties" && targetGaranties(request.garanties, target).length === 0) {
      nextErrors.garanties = "Au moins une garantie est obligatoire.";
    }
    const assistance = targetAssistances[targetKey(target)];
    if (part === "garanties" && target.kind === "vehicule" && assistance?.enabled) {
      if (!assistance.compagnieAssistanceId) {
        nextErrors.garanties = "Compagnie assistance obligatoire.";
      } else if (!assistance.produitAssistanceId) {
        nextErrors.garanties = "Produit assistance obligatoire.";
      }
    }
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0] ?? "Section incomplète");
      return false;
    }
    return true;
  };

  const handleSaveDraft = (label: string, onSuccess?: () => void) => {
    saveDraftMutation.mutate(request, {
      onSuccess: () => {
        onSuccess?.();
        toast.success(`${label} enregistré`);
      },
    });
  };

  const handleSaveTargetDraft = (target: ContratTargetKey, part: "info" | "garanties", label: string, onSuccess?: () => void) => {
    if (!validateTarget(target, part)) {
      return false;
    }
    saveTargetDraftMutation.mutate(
      { target, part },
      {
        onSuccess: () => {
          onSuccess?.();
          toast.success(`${label} enregistré`);
        },
      }
    );
    return true;
  };

  const saveGrilleSelection = (value: string) => {
    setGrilleTarifaireId(value);
    setSavedSections((current) => ({ ...current, grille: false }));
    if (!draftId) {
      return;
    }
    saveDraftMutation.mutate(
      {
        ...request,
        grilleTarifaireId: typeContrat === "PARTICULIER" ? undefined : emptyToUndefined(value),
      },
      {
        onSuccess: () => {
          setSavedSections((current) => ({ ...current, grille: true }));
          toast.success("Grille tarifaire enregistrée");
        },
      }
    );
  };

  useEffect(() => {
    if (typeContrat === "FLOTTE") {
      return;
    }
    if (!canAutoPreview(typeContrat, request)) {
      setPreview(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      autoPreviewMutation.mutate(request);
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [request, typeContrat]);

  const setCompagnieForContrat = (value: string) => {
    if (value === compagnieAssuranceId) {
      return;
    }
    setCompagnieAssuranceId(value);
    setConventionId("");
    setUsageId("");
    setVehicules((current) => current.map((vehicule) => ({ ...vehicule, usageId: "" })));
  };

  const setConventionForContrat = (value: string) => {
    if (value !== conventionId) {
      setUsageId("");
      setVehicules((current) => current.map((vehicule) => ({ ...vehicule, usageId: "" })));
    }
    setConventionId(value);
    const convention = refs.conventions.data?.find((item) => item.id === value);
    const conventionFractionnement = convention?.fractionnement;
    if (isFractionnement(conventionFractionnement)) {
      setFractionnement(conventionFractionnement);
    }
    const conventionEcheance = typeof convention?.echeance === "string" ? convention.echeance : "";
    if (convention?.typeEcheance === "A_ECHEANCE" && conventionEcheance) {
      setEcheance(conventionEcheance);
    }
  };

  const applyConventionContext = (context: { compagnieAssuranceId?: string | null; conventionId?: string | null; usageId?: string | null }) => {
    const nextCompagnieId = context.compagnieAssuranceId ?? "";
    const nextConventionId = context.conventionId ?? "";
    const nextUsageId = context.usageId ?? "";
    if (nextCompagnieId) {
      setCompagnieAssuranceId(nextCompagnieId);
    }
    if (nextConventionId) {
      setConventionId(nextConventionId);
      const convention = refs.conventions.data?.find((item) => item.id === nextConventionId);
      const conventionFractionnement = convention?.fractionnement;
      if (isFractionnement(conventionFractionnement)) {
        setFractionnement(conventionFractionnement);
      }
      const conventionEcheance = typeof convention?.echeance === "string" ? convention.echeance : "";
      if (convention?.typeEcheance === "A_ECHEANCE" && conventionEcheance) {
        setEcheance(conventionEcheance);
      }
      const conventionGrilleId = typeof convention?.grilleTarifaireId === "string" ? convention.grilleTarifaireId : "";
      if (conventionGrilleId) {
        setGrilleTarifaireId(conventionGrilleId);
      }
    }
    if (nextUsageId) {
      setUsageId(nextUsageId);
      setVehicules((current) => current.map((vehicule) => ({ ...vehicule, usageId: nextUsageId })));
    }
  };

  const setUsageForContrat = (value: string) => {
    setUsageId(value);
    setVehicules((current) => current.map((vehicule) => ({ ...vehicule, usageId: value })));
  };

  useEffect(() => {
    if (!showContractEcheance || !dateEffet || !effectiveEcheance) {
      return;
    }
    const computed = computeDateEcheanceFromCode(dateEffet, effectiveEcheance);
    if (computed && computed !== dateEcheance) {
      setDateEcheance(computed);
    }
  }, [dateEffet, dateEcheance, effectiveEcheance, showContractEcheance]);

  useEffect(() => {
    if (!conventionUsesPeriodicite || !dateEffet) {
      return;
    }
    const computed = computeDateEcheanceFromMonths(dateEffet, monthsFromFractionnement(fractionnement));
    if (computed && computed !== dateEcheance) {
      setDateEcheance(computed);
    }
  }, [conventionUsesPeriodicite, dateEffet, dateEcheance, fractionnement]);

  return {
    typeContrat,
    refs,
    groupesClients,
    lignesGrille,
    formulesPersonne,
    request,
    draftId,
    draftQuery,
    preview,
    targetPreview,
    previewMutation,
    targetPreviewMutation,
    autoPreviewMutation,
    createMutation,
    saveDraftMutation,
    saveTargetDraftMutation,
    handlePreview,
    handlePreviewTarget,
    handleCreate,
    handleSaveSection,
    handleSaveDraft,
    handleSaveTargetDraft,
    validateSection,
    validateTarget,
    savedSections,
    availableUsages,
    selectedConvention,
    conventionUsageIds,
    numeroContrat,
    setNumeroContrat,
    numeroPolice,
    setNumeroPolice,
    numeroAttestation,
    setNumeroAttestation,
    compagnieAssuranceId,
    setCompagnieAssuranceId: setCompagnieForContrat,
    conventionId,
    setConventionId: setConventionForContrat,
    applyConventionContext,
    usageId,
    setUsageId: setUsageForContrat,
    grilleTarifaireId,
    setGrilleTarifaireId: saveGrilleSelection,
    dateEffet,
    setDateEffet,
    dateEcheance,
    setDateEcheance,
    typeRenouvellement,
    setTypeRenouvellement,
    echeance,
    setEcheance,
    effectiveEcheance,
    showContractEcheance,
    lockDateEcheance,
    modeReglement,
    setModeReglement,
    numeroBonCommande,
    setNumeroBonCommande,
    typePayeurPrime,
    setTypePayeurPrime,
    payeurPrimeClientId,
    setPayeurPrimeClientId,
    groupeFacturationId,
    setGroupeFacturationId,
    modeFacturation,
    setModeFacturation,
    referenceMandatPayeur,
    setReferenceMandatPayeur,
    fractionnement,
    setFractionnement,
    crmPartage,
    setCrmPartage,
    crmPartageValeur,
    setCrmPartageValeur,
    tauxRc,
    setTauxRc,
    isFlotteLocationCategory,
    assistanceEnabled,
    setAssistanceEnabled,
    assistanceDraft,
    setAssistanceDraft,
    targetAssistances,
    setTargetAssistances,
    saisiePrimeNette,
    setSaisiePrimeNette,
    clients,
    setClients,
    vehicules,
    setVehicules,
    remorques,
    setRemorques,
    garanties,
    setGaranties,
    quittances,
    setQuittances,
    validationErrors,
    prospectionMode: Boolean(options?.prospectionMode),
    correctionMode,
  };
}

export type ContratCreationFormState = ReturnType<typeof useContratCreationForm>;

function useReference(path: string) {
  return useQuery<ReferenceOption[]>({
    queryKey: ["referentiel", path],
    queryFn: () => productionApi.referentiel(path),
    staleTime: 60_000,
  });
}

function emptyToUndefined(value: string) {
  return value.trim() ? value : undefined;
}

function referenceStringArray(option: ReferenceOption | null | undefined, key: string) {
  const value = option?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function principalTelephone(telephones?: { numero: string; principal?: boolean }[]) {
  const valid = (telephones ?? []).filter((telephone) => telephone.numero.trim());
  return valid.find((telephone) => telephone.principal)?.numero ?? valid[0]?.numero;
}

function hasTelephone(telephones?: { numero: string }[]) {
  return (telephones ?? []).some((telephone) => telephone.numero.trim());
}

function defaultQuittanceLines(): QuittanceInput[] {
  return [
    { categorie: "AUTOMOBILE", ordre: 10 },
    { categorie: "CORPOREL", ordre: 20 },
    { categorie: "EVCAT", ordre: 30 },
  ];
}

function totalLine(ligne: QuittanceInput) {
  return roundMoney(
    numberOrZero(ligne.primeNette)
      + numberOrZero(ligne.taxe)
      + numberOrZero(ligne.taxeParafiscale)
      + numberOrZero(ligne.accessoire)
      + numberOrZero(ligne.cnpac)
  );
}

function numberOrZero(value?: number) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function positiveNumberOrUndefined(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isFractionnement(value: unknown): value is CreateContratRequest["fractionnement"] {
  return value === "ANNUEL" || value === "SEMESTRIEL" || value === "TRIMESTRIEL" || value === "MENSUEL";
}

function periodiciteFromFractionnement(value: CreateContratRequest["fractionnement"]) {
  switch (value) {
    case "MENSUEL":
      return "1";
    case "TRIMESTRIEL":
      return "2";
    case "SEMESTRIEL":
      return "3";
    case "ANNUEL":
    default:
      return "4";
  }
}

function monthsFromFractionnement(value: CreateContratRequest["fractionnement"]) {
  switch (value) {
    case "MENSUEL":
      return 1;
    case "TRIMESTRIEL":
      return 3;
    case "SEMESTRIEL":
      return 6;
    case "ANNUEL":
    default:
      return 12;
  }
}

function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isBeforeToday(value: string | undefined | null, today: string) {
  return Boolean(value && value < today);
}

function isValidationErrorResolved(key: string, request: CreateContratRequest, today: string) {
  const clientMatch = key.match(/^clients\.(\d+)\.client\.(.+)$/);
  if (clientMatch) {
    const client = request.clients[Number(clientMatch[1])]?.client;
    if (!client) {
      return false;
    }
    const field = clientMatch[2] as keyof ClientInput["client"] | "telephones";
    if (field === "telephones") {
      return hasTelephone(client.telephones);
    }
    if (field === "cinValidite" || field === "dateValiditePermis") {
      const value = client[field];
      return Boolean(value && !isBeforeToday(value, today));
    }
    const value = client[field as keyof ClientInput["client"]];
    return value != null && (typeof value !== "string" || value.trim() !== "");
  }

  const vehiculeMatch = key.match(/^vehicules\.(\d+)\.(.+)$/);
  if (vehiculeMatch) {
    const vehicule = request.vehicules[Number(vehiculeMatch[1])];
    if (!vehicule) {
      return false;
    }
    const field = vehiculeMatch[2] as keyof VehiculeInput;
    if (field === "dateExpirationCarteGrise") {
      const value = vehicule[field];
      return Boolean(value && !isBeforeToday(value, today));
    }
    if (field === "valeurVenale") {
      return !validateValeurVenale(vehicule);
    }
    const value = vehicule[field];
    return value != null && (typeof value !== "string" || value.trim() !== "");
  }

  if (key === "echeance") {
    return Boolean(request.echeance);
  }
  if (key === "numeroBonCommande") {
    return Boolean(request.numeroBonCommande?.trim());
  }
  const value = request[key as keyof CreateContratRequest];
  return value != null && (typeof value !== "string" || value.trim() !== "");
}

function canAutoPreview(typeContrat: TypeContrat, request: CreateContratRequest) {
  if (typeContrat === "PARTICULIER") {
    return false;
  }
  const hasContractReference = Boolean(request.prospection) || Boolean(request.numeroPolice);
  if (!request.agenceId || !hasContractReference || !request.grilleTarifaireId || !request.dateEffet || !request.dateEcheance) {
    return false;
  }
  if (typeContrat === "CONVENTION" && !request.conventionId) {
    return false;
  }
  if (!request.vehicules.length && !request.remorques.length) {
    return false;
  }
  return request.garanties.length > 0;
}

function scopedTargetRequest(request: CreateContratRequest, target: ContratTargetKey): CreateContratRequest {
  return {
    ...request,
    garanties: targetGaranties(request.garanties, target),
  };
}

function targetKey(target: ContratTargetKey) {
  return `${target.kind}:${target.index}`;
}

function targetGaranties(garanties: GarantieInput[], target: ContratTargetKey) {
  return garanties.filter((garantie) => (
    target.kind === "vehicule"
      ? garantie.vehiculeIndex === target.index
      : garantie.remorqueIndex === target.index
  ));
}

async function syncDraftVehiculeAssistance(
  draftId: string,
  draft: ContratSummary,
  target: ContratTargetKey,
  assistance?: AssistanceDraft
) {
  const vehiculeId = draft.vehicules?.[target.index]?.vehiculeId;
  const existing = findDraftAssistanceForVehicule(draft, vehiculeId);
  if (!assistance?.enabled) {
    const assistanceId = assistance?.assistanceId ?? existing?.id;
    if (!assistanceId) {
      return draft;
    }
    await productionApi.deleteAssistance(draftId, String(assistanceId));
    return productionApi.getContratDraft(draftId);
  }
  if (!vehiculeId) {
    throw new Error("Enregistrez les informations véhicule avant l'assistance.");
  }
  if (!assistance.compagnieAssistanceId || !assistance.produitAssistanceId) {
    throw new Error("Compagnie et produit assistance obligatoires.");
  }
  await productionApi.saveAssistance(draftId, {
    vehiculeId: String(vehiculeId),
    compagnieAssistanceId: assistance.compagnieAssistanceId,
    produitAssistanceId: assistance.produitAssistanceId,
    dateSouscription: emptyToUndefined(assistance.dateSouscription ?? ""),
    dateEffet: emptyToUndefined(assistance.dateEffet ?? ""),
    echeanceCode: emptyToUndefined(assistance.echeanceCode ?? ""),
    numeroContratOuQuittance: emptyToUndefined(assistance.numeroContratOuQuittance ?? ""),
  });
  return productionApi.getContratDraft(draftId);
}

function findDraftAssistanceForVehicule(draft: ContratSummary, vehiculeId?: string | number | null) {
  if (vehiculeId == null) {
    return undefined;
  }
  return (draft.assistances ?? []).find((assistance) => String(assistance.vehiculeId ?? "") === String(vehiculeId));
}

function isTargetGarantie(garantie: GarantieInput, target: ContratTargetKey) {
  return target.kind === "vehicule"
    ? garantie.vehiculeIndex === target.index
    : garantie.remorqueIndex === target.index;
}

function sectionLabel(section: SavableContratSectionKey) {
  switch (section) {
    case "souscripteur":
      return "Souscripteur";
    case "proprietaire":
      return "Propriétaire";
    case "contrat":
      return "Contrat";
    case "grille":
      return "Grille tarifaire";
    case "vehicule":
      return "Véhicule";
    case "garanties":
      return "Garanties";
  }
}

function hydrateDraft(draft: ContratSummary) {
  const vehicleIdToIndex = new Map((draft.vehicules ?? []).map((vehicule, index) => [vehicule.vehiculeId, index]));
  const remorqueIdToIndex = new Map((draft.remorques ?? []).map((remorque, index) => [remorque.remorqueId, index]));
  let clients = (draft.clients ?? []).length > 0
    ? (draft.clients ?? []).map((link) => {
        const role = asRole(link.role);
        return {
          clientId: link.clientId,
          role,
          principalPourRole: Boolean(link.principalPourRole),
          groupeClientId: idString(link.client?.groupe?.id) || undefined,
          relationGroupe: link.client?.groupe?.typeRelation ?? undefined,
          client: {
            ...emptyClient(role).client,
            ...(link.client ?? {}),
            agenceId: link.client?.agenceId,
            typeClient: link.client?.typeClient ?? emptyClient(role).client.typeClient,
            telephones: (link.client?.telephones ?? []).map((telephone) => ({
              numero: telephone.numero,
              principal: telephone.principal,
              whatsapp: telephone.whatsapp,
            })),
          },
        } satisfies ClientInput;
      })
    : [emptyClient("SOUSCRIPTEUR"), emptyClient("PROPRIETAIRE")];
  const souscripteur = clients.find((client) => client.role === "SOUSCRIPTEUR");
  const proprietaire = clients.find((client) => client.role === "PROPRIETAIRE");
  if (souscripteur?.clientId && proprietaire?.clientId && souscripteur.clientId === proprietaire.clientId) {
    clients = clients.map((client) =>
      client.role === "PROPRIETAIRE"
        ? { ...client, sameAsRole: "SOUSCRIPTEUR" }
        : client
    );
  }

  const vehicules = (draft.vehicules ?? []).length > 0
    ? (draft.vehicules ?? []).map((vehicule) => ({
        ...emptyVehicule(),
        vehiculeId: vehicule.vehiculeId,
        typeVehicule: asVehiculeType(vehicule.typeVehicule),
        usageId: nullToUndefined(vehicule.usageId),
        marqueId: nullToUndefined(vehicule.marqueId),
        marqueLibelle: nullToUndefined(vehicule.marque),
        carrosserieId: nullToUndefined(vehicule.carrosserieId),
        carrosserieLibelle: nullToUndefined(vehicule.carrosserie),
        categorieTransportId: nullToUndefined(vehicule.categorieTransportId),
        immatriculation: nullToUndefined(vehicule.immatriculation),
        carburant: nullToUndefined(vehicule.carburant),
        puissanceFiscale: nullToUndefined(vehicule.puissanceFiscale),
        nombrePlaces: nullToUndefined(vehicule.nombrePlaces),
        sousClasse: nullToUndefined(vehicule.sousClasse),
        ptc: nullToUndefined(vehicule.ptc),
        datePremiereCirculation: nullToUndefined(vehicule.datePremiereCirculation),
        dateExpirationCarteGrise: nullToUndefined(vehicule.dateExpirationCarteGrise),
        dateEffet: nullToUndefined(vehicule.dateEffet),
        dateEcheance: nullToUndefined(vehicule.dateEcheance),
        crm: nullToUndefined(vehicule.crm),
        numeroAttestation: nullToUndefined(vehicule.numeroAttestation),
        coefficientProrata: nullToUndefined(vehicule.coefficientProrata),
        remorque: Boolean(vehicule.remorque),
        valeurVenale: nullToUndefined(vehicule.valeurVenale),
        valeurNeuf: nullToUndefined(vehicule.valeurNeuf),
        valeurGlace: nullToUndefined(vehicule.valeurGlace),
        organismeCredit: Boolean(vehicule.organismeCredit),
        nomOrganismeCredit: nullToUndefined(vehicule.nomOrganismeCredit),
        montantCredit: nullToUndefined(vehicule.montantCredit),
        dateFinCredit: nullToUndefined(vehicule.dateFinCredit),
      } satisfies VehiculeInput))
    : [emptyVehicule()];

  const remorques = (draft.remorques ?? []).map((remorque) => ({
    remorqueId: remorque.remorqueId,
    usageId: nullToUndefined(remorque.usageId),
    marqueId: nullToUndefined(remorque.marqueId),
    marqueLibelle: nullToUndefined(remorque.marque),
    immatriculation: nullToUndefined(remorque.immatriculation),
    ptc: nullToUndefined(remorque.ptc),
    dateMiseEnCirculation: nullToUndefined(remorque.dateMiseEnCirculation),
    dateEffet: nullToUndefined(remorque.dateEffet),
    dateEcheance: nullToUndefined(remorque.dateEcheance),
    crm: nullToUndefined(remorque.crm),
    numeroAttestation: nullToUndefined(remorque.numeroAttestation),
    coefficientProrata: nullToUndefined(remorque.coefficientProrata),
    valeurAssuree: nullToUndefined(remorque.valeurAssuree),
  } satisfies RemorqueInput));

  const garanties = (draft.garanties ?? []).map((garantie) => ({
    garantieId: garantie.garantieId,
    ligneGrilleTarifaireId: nullToUndefined(garantie.ligneGrilleTarifaireId),
    clientId: nullToUndefined(garantie.clientId),
    vehiculeIndex: garantie.vehiculeId ? vehicleIdToIndex.get(garantie.vehiculeId) : undefined,
    remorqueIndex: garantie.remorqueId ? remorqueIdToIndex.get(garantie.remorqueId) : undefined,
    modeSelectionne: nullToUndefined(garantie.modeSelectionne),
    sourceValeurSelectionnee: nullToUndefined(garantie.sourceValeurSelectionnee),
    formuleGarantiePersonneId: nullToUndefined(garantie.formuleGarantiePersonneId),
    valeurVenale: nullToUndefined(garantie.valeurVenale),
    valeurNeuf: nullToUndefined(garantie.valeurNeuf),
    valeurGlace: nullToUndefined(garantie.valeurGlace),
    valeurAssuree: nullToUndefined(garantie.valeurAssuree),
    formule: nullToUndefined(garantie.formule),
    montantDeces: nullToUndefined(garantie.montantDeces),
    montantInvalidite: nullToUndefined(garantie.montantInvalidite),
    montantFraisMedicaux: nullToUndefined(garantie.montantFraisMedicaux),
    montantFraisHospitalisation: nullToUndefined(garantie.montantFraisHospitalisation),
    montantFraisFuneraires: nullToUndefined(garantie.montantFraisFuneraires),
    montantFraisChirurgie: nullToUndefined(garantie.montantFraisChirurgie),
    accessoire: nullToUndefined(garantie.accessoire),
    capital: nullToUndefined(garantie.capital),
    taux: nullToUndefined(garantie.taux),
    prime: nullToUndefined(garantie.prime),
    tauxFranchise: nullToUndefined(garantie.tauxFranchise),
    franchiseMinimale: nullToUndefined(garantie.franchiseMinimale),
  } satisfies GarantieInput));

  const targetAssistances: Record<string, AssistanceDraft> = {};
  for (const assistance of draft.assistances ?? []) {
    const vehiculeIndex = assistance.vehiculeId ? vehicleIdToIndex.get(assistance.vehiculeId) : undefined;
    if (vehiculeIndex == null) {
      continue;
    }
    targetAssistances[`vehicule:${vehiculeIndex}`] = {
      assistanceId: idString(assistance.id),
      enabled: true,
      compagnieAssistanceId: idString(assistance.compagnieAssistanceId),
      produitAssistanceId: idString(assistance.produitAssistanceId),
      dateEffet: nullToUndefined(assistance.dateEffet),
      dateSouscription: nullToUndefined(assistance.dateSouscription),
      echeanceCode: nullToUndefined(assistance.echeanceCode),
      dateEcheance: nullToUndefined(assistance.dateEcheance),
      numeroContratOuQuittance: nullToUndefined(assistance.numeroContratOuQuittance),
    };
  }

  return {
    numeroContrat: draft.numeroContrat ?? "",
    numeroPolice: draft.numeroPolice ?? "",
    numeroAttestation: draft.numeroAttestation ?? "",
    compagnieAssuranceId: idString(draft.compagnieAssuranceId),
    conventionId: idString(draft.conventionId),
    usageId: idString(draft.usageId),
    grilleTarifaireId: idString(draft.grilleTarifaireId),
    dateEffet: draft.dateEffet,
    dateEcheance: draft.dateEcheance,
    typeRenouvellement: draft.typeRenouvellement === "ferme" ? "ferme" as const : "renouvelable" as const,
    echeance: draft.echeance ?? undefined,
    modeReglement: draft.modeReglement ?? "bureau",
    numeroBonCommande: draft.numeroBonCommande ?? "",
    typePayeurPrime: draft.typePayeurPrime ?? "SOUSCRIPTEUR",
    payeurPrimeClientId: idString(draft.payeurPrimeClientId),
    groupeFacturationId: idString(draft.groupeFacturationId),
    modeFacturation: draft.modeFacturation ?? "DIRECTE",
    referenceMandatPayeur: draft.referenceMandatPayeur ?? "",
    fractionnement: asFractionnement(draft.fractionnement),
    crmPartage: Boolean(draft.crmPartage),
    crmPartageValeur: draft.crmPartageValeur ?? "",
    tauxRc: draft.tauxRc == null ? "" : String(draft.tauxRc),
    assistanceEnabled: Boolean(draft.assistance) || Object.values(targetAssistances).some((assistance) => assistance.enabled),
    saisiePrimeNette: Boolean(draft.saisiePrimeNette),
    clients,
    vehicules,
    remorques,
    garanties,
    targetAssistances,
    preview: quittanceGeneraleFromDraft(draft),
    targetPreview: targetQuittanceGeneraleFromDraft(draft),
  };
}

function quittanceGeneraleFromDraft(draft: ContratSummary): QuittancePreview | null {
  if (draft.quittanceGenerale) {
    return draft.quittanceGenerale;
  }
  return null;
}

function targetQuittanceGeneraleFromDraft(draft: ContratSummary): QuittancePreview | null {
  if (draft.quittanceGenerale) {
    return draft.quittanceGenerale;
  }
  if (!draft.targetSummaries?.length) {
    return null;
  }
  return {
    numeroContrat: draft.numeroContrat ?? draft.numeroPolice ?? draft.numeroDevis ?? undefined,
    type: draft.typeContrat,
    primeNette: 0,
    taxe: 0,
    taxeParafiscale: 0,
    accessoire: 0,
    cnpac: 0,
    primeTotale: 0,
    lignes: [],
    garanties: [],
    targetSummaries: draft.targetSummaries,
  };
}

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value == null ? undefined : value;
}

function idString(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

function asRole(value: string): ClientInput["role"] {
  return value === "PROPRIETAIRE" || value === "CONDUCTEUR" || value === "BENEFICIAIRE" ? value : "SOUSCRIPTEUR";
}

function asVehiculeType(value: string): VehiculeInput["typeVehicule"] {
  return value === "CAMION" || value === "MOTO" || value === "BUS" || value === "TRACTEUR" || value === "AUTRE"
    ? value
    : "AUTOMOBILE";
}

function asFractionnement(value: string | null | undefined): CreateContratRequest["fractionnement"] {
  return isFractionnement(value) ? value : "ANNUEL";
}
