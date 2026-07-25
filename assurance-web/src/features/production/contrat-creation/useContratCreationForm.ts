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
  QuittancePreview,
  ReferenceOption,
  RemorqueInput,
  TypeContrat,
  VehiculeInput,
} from "../types";

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
  const [fractionnement, setFractionnement] = useState<CreateContratRequest["fractionnement"]>("ANNUEL");
  const [saisiePrimeNette, setSaisiePrimeNette] = useState(false);
  const [clients, setClients] = useState<ClientInput[]>([emptyClient("SOUSCRIPTEUR"), emptyClient("PROPRIETAIRE")]);
  const [vehicules, setVehicules] = useState<VehiculeInput[]>([emptyVehicule()]);
  const [remorques, setRemorques] = useState<RemorqueInput[]>([]);
  const [garanties, setGaranties] = useState<GarantieInput[]>([]);
  const [preview, setPreview] = useState<QuittancePreview | null>(null);

  const refs = {
    usages: useReference("usages"),
    marques: useReference("marques"),
    carrosseries: useReference("carrosseries"),
    categoriesTransport: useReference("categories-transport"),
    garanties: useReference("garanties"),
    compagnies: useReference("compagnies-assurance"),
    conventions: useReference("conventions"),
    grilles: useReference("grilles-tarifaires"),
    villes: useReference("villes"),
    categoriesClient: useReference("categories-client"),
  };

  const lignesGrille = useQuery({
    queryKey: ["lignes-grille", grilleTarifaireId, usageId],
    queryFn: () => productionApi.lignesGrille({ grilleId: grilleTarifaireId, usageId }),
    enabled: Boolean(grilleTarifaireId),
  });

  useEffect(() => {
    const garantiesReference = refs.garanties.data ?? [];
    const mandatory = garantiesReference.filter((garantie) => garantie.responsabiliteCivile || garantie.obligatoire);
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
    fractionnement,
    modeSaisieGaranties,
    saisiePrimeNette: typeContrat === "PARTICULIER" ? saisiePrimeNette : false,
    nombreVehicules: vehicules.length,
    nombreRemorques: remorques.length,
    prospection: false,
    assistance: false,
    clients: clients.map((client) => ({
      ...client,
      client: {
        ...client.client,
        agenceId: user?.agenceId ?? "",
        telephones: client.client.telephone
          ? [{ numero: client.client.telephone, principal: true, whatsapp: false }]
          : client.client.telephones ?? [],
      },
    })),
    vehicules: vehicules.map((vehicule) => ({
      ...vehicule,
      usageId: vehicule.usageId || usageId || undefined,
      dateEffet: vehicule.dateEffet || dateEffet,
      dateEcheance: vehicule.dateEcheance || dateEcheance,
    })),
    remorques: remorques.map((remorque) => ({
      ...remorque,
      usageId: remorque.usageId || usageId || undefined,
    })),
    garanties,
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
    fractionnement,
    modeSaisieGaranties,
    saisiePrimeNette,
    vehicules,
    remorques,
    clients,
    garanties,
  ]);

  const previewMutation = useMutation({
    mutationFn: productionApi.previewQuittance,
    onSuccess: (data) => {
      setPreview(data);
      toast.success("Prévisualisation calculée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Prévisualisation impossible"),
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
    const result = contratSchema.safeParse(request);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Formulaire incomplet");
      return false;
    }
    if (typeContrat === "CONVENTION" && !conventionId) {
      toast.error("Une convention est obligatoire pour un contrat convention");
      return false;
    }
    if (typeContrat !== "PARTICULIER" && !grilleTarifaireId) {
      toast.error("Une grille tarifaire est obligatoire pour convention/flotte");
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

  const setUsageForContrat = (value: string) => {
    setUsageId(value);
    setVehicules(vehicules.map((vehicule) => ({ ...vehicule, usageId: value })));
  };

  return {
    typeContrat,
    refs,
    lignesGrille,
    request,
    preview,
    previewMutation,
    createMutation,
    handlePreview,
    handleCreate,
    numeroContrat,
    setNumeroContrat,
    numeroPolice,
    setNumeroPolice,
    numeroAttestation,
    setNumeroAttestation,
    compagnieAssuranceId,
    setCompagnieAssuranceId,
    conventionId,
    setConventionId,
    usageId,
    setUsageId: setUsageForContrat,
    grilleTarifaireId,
    setGrilleTarifaireId,
    dateEffet,
    setDateEffet,
    dateEcheance,
    setDateEcheance,
    fractionnement,
    setFractionnement,
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
