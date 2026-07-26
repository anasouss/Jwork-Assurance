import type { VehiculeInput } from "../types";

export const VALEUR_VENALE_MAX_ERROR = "La valeur vénale ne doit pas dépasser la valeur à neuf.";

export function validateValeurVenale(vehicule: Pick<VehiculeInput, "valeurNeuf" | "valeurVenale">) {
  if (
    vehicule.valeurNeuf !== undefined
    && vehicule.valeurVenale !== undefined
    && Number(vehicule.valeurVenale) > Number(vehicule.valeurNeuf)
  ) {
    return VALEUR_VENALE_MAX_ERROR;
  }
  return undefined;
}
