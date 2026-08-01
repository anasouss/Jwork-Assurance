import { useQuery } from "@tanstack/react-query";
import { referenceKeys } from "@/lib/query-keys";
import { referenceApi } from "../api/references";

export function useAmendmentReferenceData(grilleTarifaireId?: string) {
  const usages = useQuery({
    queryKey: referenceKeys.list("usages"),
    queryFn: () => referenceApi.list("usages"),
  });
  const compagnies = useQuery({
    queryKey: referenceKeys.list("compagnies-assurance"),
    queryFn: () => referenceApi.list("compagnies-assurance"),
  });
  const marques = useQuery({
    queryKey: referenceKeys.list("marques"),
    queryFn: () => referenceApi.list("marques"),
  });
  const carrosseries = useQuery({
    queryKey: referenceKeys.list("carrosseries"),
    queryFn: () => referenceApi.list("carrosseries"),
  });
  const sousClasses = useQuery({
    queryKey: referenceKeys.list("sous-classes"),
    queryFn: () => referenceApi.list("sous-classes"),
  });
  const garanties = useQuery({
    queryKey: referenceKeys.list("garanties-parametrage"),
    queryFn: referenceApi.configuredGuarantees,
  });
  const categoriesTransport = useQuery({
    queryKey: referenceKeys.list("categories-transport"),
    queryFn: () => referenceApi.list("categories-transport"),
  });
  const compagniesAssistance = useQuery({
    queryKey: referenceKeys.list("compagnies-assistance"),
    queryFn: () => referenceApi.list("compagnies-assistance"),
  });
  const produitsAssistance = useQuery({
    queryKey: referenceKeys.list("produits-assistance"),
    queryFn: () => referenceApi.list("produits-assistance"),
  });
  const grilles = useQuery({
    queryKey: referenceKeys.list("grilles-tarifaires"),
    queryFn: () => referenceApi.list("grilles-tarifaires"),
  });
  const lignesGrille = useQuery({
    queryKey: ["lignes-grille", grilleTarifaireId, "avenant-contrat"],
    queryFn: () => referenceApi.pricingLines({ grilleId: grilleTarifaireId }),
    enabled: Boolean(grilleTarifaireId),
  });
  const formulesPersonne = useQuery({
    queryKey: ["formules-garantie-personne", grilleTarifaireId, "avenant-contrat"],
    queryFn: () => referenceApi.personGuaranteeFormulas({ grilleId: grilleTarifaireId }),
    enabled: Boolean(grilleTarifaireId),
  });

  const queries = {
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
  };

  return {
    ...queries,
    isLoading: Object.values(queries).some((query) => query.isLoading),
  };
}
