import type { EtapeSuiviSinistre, ModeReparationSinistre, TypeDommageSinistre } from "./types";

export const suiviSteps: EtapeSuiviSinistre[] = ["OUVERTURE", "EXPERTISE_AVANT", "INSTANCE_CLIENT", "EXPERTISE_APRES", "COMPAGNIE", "CLOTURE"];
export const suiviLabels: Record<EtapeSuiviSinistre, string> = {
  OUVERTURE: "Ouverture",
  EXPERTISE_AVANT: "Expertise avant réparation",
  INSTANCE_CLIENT: "Instance client",
  EXPERTISE_APRES: "Expertise après réparation",
  COMPAGNIE: "Compagnie",
  CLOTURE: "Clôture",
};
export const repairLabels: Record<ModeReparationSinistre, string> = { NORMAL: "Normal", PEC: "Prise en charge", RAPIDE: "Rapide" };
export const damageLabels: Record<TypeDommageSinistre, string> = { MATERIEL: "Matériel", CORPOREL: "Corporel", MIXTE: "Mixte" };
