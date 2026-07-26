import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { productionApi } from "../api";
import { contratSchema } from "../schemas";
import { emptyClient } from "../components/ClientSection";
import { emptyVehicule } from "../components/VehiculeSection";
import type {
  ClientInput,
  CreateContratRequest,
  GarantieInput,
  QuittanceInput,
  QuittancePreview,
  ReferenceOption,
  RemorqueInput,
  TypeContrat,
  VehiculeInput,
} from "../types";

export type ContratSectionKey = "souscripteur" | "proprietaire" | "contrat" | "grille";

export function useContratCreationForm(typeContrat: TypeContrat) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
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
  const [fractionnement, setFractionnement] = useState<CreateContratRequest["fractionnement"]>("ANNUEL");
  const [crmPartage, setCrmPartage] = useState(false);
  const [crmPartageValeur, setCrmPartageValeur] = useState("");
  const [assistanceEnabled, setAssistanceEnabled] = useState(false);
  const [saisiePrimeNette, setSaisiePrimeNette] = useState(false);
  const [clients, setClients] = useState<ClientInput[]>([emptyClient("SOUSCRIPTEUR"), emptyClient("PROPRIETAIRE")]);
  const [vehicules, setVehicules] = useState<VehiculeInput[]>([emptyVehicule()]);
  const [remorques, setRemorques] = useState<RemorqueInput[]>([]);
  const [garanties, setGaranties] = useState<GarantieInput[]>([]);
  const [quittances, setQuittances] = useState<QuittanceInput[]>(defaultQuittanceLines());
  const [preview, setPreview] = useState<QuittancePreview | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [savedSections, setSavedSections] = useState<Partial<Record<ContratSectionKey, boolean>>>({});

  const refs = {
    usages: useReference("usages"),
    marques: useReference("marques"),
    carrosseries: useReference("carrosseries"),
    categoriesTransport: useReference("categories-transport"),
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

  const availableUsages = useMemo(() => {
    const usages = refs.usages.data ?? [];
    if (typeContrat !== "CONVENTION") {
      return usages;
    }
    if (!conventionId || !selectedConvention) {
      return [];
    }
    const allowedIds = new Set(conventionUsageIds);
    return usages.filter((usage) => allowedIds.has(usage.id));
  }, [conventionId, conventionUsageIds, refs.usages.data, selectedConvention, typeContrat]);

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

  const grilleUsageFilter = typeContrat === "CONVENTION" ? usageId : undefined;
  const selectedConventionTypeEcheance = selectedConvention?.typeEcheance;
  const selectedConventionEcheance = typeof selectedConvention?.echeance === "string" ? selectedConvention.echeance : undefined;
  const effectiveEcheance = typeContrat === "CONVENTION" && selectedConventionTypeEcheance === "A_ECHEANCE"
    ? selectedConventionEcheance
    : echeance;
  const showContractEcheance = typeRenouvellement === "renouvelable" && fractionnement === "ANNUEL";

  const lignesGrille = useQuery({
    queryKey: ["lignes-grille", grilleTarifaireId, grilleUsageFilter],
    queryFn: () => productionApi.lignesGrille({ grilleId: grilleTarifaireId, usageId: grilleUsageFilter }),
    enabled: Boolean(grilleTarifaireId),
  });

  const formulesPersonne = useQuery({
    queryKey: ["formules-garantie-personne", grilleTarifaireId, grilleUsageFilter],
    queryFn: () => productionApi.formulesGarantiePersonne({ grilleId: grilleTarifaireId, usageId: grilleUsageFilter }),
    enabled: Boolean(grilleTarifaireId),
  });

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

  const request = useMemo<CreateContratRequest>(() => ({
    agenceId: user?.agenceId ?? "",
    typeContrat,
    numeroContrat,
    numeroPolice,
    numeroAttestation,
    compagnieAssuranceId: emptyToUndefined(compagnieAssuranceId),
    conventionId: typeContrat === "CONVENTION" ? emptyToUndefined(conventionId) : undefined,
    usageId: emptyToUndefined(usageId),
    grilleTarifaireId: typeContrat === "PARTICULIER" ? undefined : emptyToUndefined(grilleTarifaireId),
    dateEffet,
    dateEcheance,
    echeance: showContractEcheance ? effectiveEcheance : undefined,
    typeRenouvellement,
    periodicite: periodiciteFromFractionnement(fractionnement),
    modeReglement: typeContrat === "CONVENTION" ? modeReglement : undefined,
    numeroBonCommande: typeContrat === "CONVENTION" && modeReglement === "facture" ? emptyToUndefined(numeroBonCommande) : undefined,
    fractionnement,
    modeSaisieGaranties,
    saisiePrimeNette: typeContrat === "PARTICULIER" ? saisiePrimeNette : false,
    nombreVehicules: vehicules.length,
    nombreRemorques: remorques.length,
    prospection: false,
    assistance: typeContrat !== "PARTICULIER" ? assistanceEnabled : false,
    crmPartage: typeContrat === "FLOTTE" ? crmPartage : false,
    crmPartageValeur: typeContrat === "FLOTTE" && crmPartage ? crmPartageValeur : undefined,
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
      usageId: vehicule.usageId || usageId || undefined,
      dateEffet: vehicule.dateEffet || dateEffet,
      dateEcheance: vehicule.dateEcheance || dateEcheance,
      crm: typeContrat === "FLOTTE" && crmPartage ? crmPartageValeur : vehicule.crm,
    })),
    remorques: remorques.map((remorque) => ({
      ...remorque,
      usageId: remorque.usageId || usageId || undefined,
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
    grilleTarifaireId,
    dateEffet,
    dateEcheance,
    effectiveEcheance,
    showContractEcheance,
    typeRenouvellement,
    modeReglement,
    numeroBonCommande,
    fractionnement,
    crmPartage,
    crmPartageValeur,
    assistanceEnabled,
    modeSaisieGaranties,
    saisiePrimeNette,
    vehicules,
    remorques,
    clients,
    garanties,
    quittances,
  ]);

  const previewMutation = useMutation({
    mutationFn: productionApi.previewQuittance,
    onSuccess: (data) => {
      setPreview(data);
      toast.success("Prévisualisation calculée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Prévisualisation impossible"),
  });

  const autoPreviewMutation = useMutation({
    mutationFn: productionApi.previewQuittance,
    onSuccess: setPreview,
    onError: () => setPreview(null),
  });

  const createMutation = useMutation({
    mutationFn: productionApi.createContrat,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contrats"] });
      toast.success("Contrat créé");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const result = contratSchema.safeParse(request);
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
    const today = dateOnly(new Date());
    request.clients.forEach((item, index) => {
      if (typeContrat === "FLOTTE" && item.role === "PROPRIETAIRE" && !item.client.categorieClientId) {
        nextErrors[`clients.${index}.client.categorieClientId`] = "Catégorie obligatoire.";
      }
      if (
        item.client.typeClient !== "PERSONNE_MORALE"
        && (item.role === "CONDUCTEUR" || (item.role === "PROPRIETAIRE" && item.client.conducteurHabituel !== false))
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
      if (isBeforeToday(vehicule.dateExpirationCarteGrise, today)) {
        nextErrors[`vehicules.${index}.dateExpirationCarteGrise`] = "La validité CG ne doit pas être expirée.";
      }
      if (
        vehicule.valeurNeuf !== undefined
        && vehicule.valeurVenale !== undefined
        && Number(vehicule.valeurNeuf) < Number(vehicule.valeurVenale)
      ) {
        nextErrors[`vehicules.${index}.valeurNeuf`] = "La valeur à neuf doit être supérieure ou égale à la valeur vénale.";
      }
    });
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Corrigez les champs indiqués");
      return false;
    }
    return true;
  };

  const handlePreview = () => {
    if (validate()) {
      previewMutation.mutate(request);
    }
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
        if (
          client.typeClient !== "PERSONNE_MORALE"
          && role === "PROPRIETAIRE"
          && client.conducteurHabituel !== false
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
      requireField("numeroContrat", numeroContrat, "N° contrat obligatoire.");
      requireField("typeRenouvellement", typeRenouvellement, "Type de contrat obligatoire.");
      requireField("dateEffet", dateEffet, "Date effet obligatoire.");
      requireField("dateEcheance", dateEcheance, "Date échéance obligatoire.");
      if (showContractEcheance) {
        requireField("echeance", effectiveEcheance, "Échéance obligatoire.");
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
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0] ?? "Section incomplète");
      return false;
    }
    return true;
  };

  const handleSaveSection = (section: ContratSectionKey) => {
    const label = sectionLabel(section);
    if (!validateSection(section)) {
      return;
    }
    setSavedSections((current) => ({ ...current, [section]: true }));
    toast.success(`${label} enregistré`);
  };

  useEffect(() => {
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
    const computed = computeDateEcheance(dateEffet, effectiveEcheance);
    if (computed && computed !== dateEcheance) {
      setDateEcheance(computed);
    }
  }, [dateEffet, dateEcheance, effectiveEcheance, showContractEcheance]);

  return {
    typeContrat,
    refs,
    lignesGrille,
    formulesPersonne,
    request,
    preview,
    previewMutation,
    autoPreviewMutation,
    createMutation,
    handlePreview,
    handleCreate,
    handleSaveSection,
    savedSections,
    availableUsages,
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
    setGrilleTarifaireId,
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
    modeReglement,
    setModeReglement,
    numeroBonCommande,
    setNumeroBonCommande,
    fractionnement,
    setFractionnement,
    crmPartage,
    setCrmPartage,
    crmPartageValeur,
    setCrmPartageValeur,
    assistanceEnabled,
    setAssistanceEnabled,
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

function computeDateEcheance(dateEffet: string, echeance: string) {
  const match = echeance.match(/^(\d{2})\/(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const effectiveDate = new Date(`${dateEffet}T00:00:00`);
  if (Number.isNaN(effectiveDate.getTime()) || month < 1 || month > 12) {
    return undefined;
  }
  const effectiveYear = effectiveDate.getFullYear();
  if (day === 1 && month === 1) {
    return `${effectiveYear}-12-31`;
  }
  let expiration = new Date(effectiveYear, month - 1, day);
  if (expiration <= effectiveDate) {
    expiration = new Date(effectiveYear + 1, month - 1, day);
  }
  expiration.setDate(expiration.getDate() - 1);
  return dateOnly(expiration);
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

function canAutoPreview(typeContrat: TypeContrat, request: CreateContratRequest) {
  if (typeContrat === "PARTICULIER") {
    return false;
  }
  if (!request.agenceId || !request.numeroContrat || !request.grilleTarifaireId || !request.dateEffet || !request.dateEcheance) {
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

function sectionLabel(section: ContratSectionKey) {
  switch (section) {
    case "souscripteur":
      return "Souscripteur";
    case "proprietaire":
      return "Propriétaire";
    case "contrat":
      return "Contrat";
    case "grille":
      return "Grille tarifaire";
  }
}
