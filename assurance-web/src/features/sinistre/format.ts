import type { NatureSinistre, StatutSinistre } from "./types";

export const STATUS_LABELS: Record<StatutSinistre, string> = {
  BROUILLON: "Brouillon",
  DECLARE: "Déclaré",
  DOSSIER_INCOMPLET: "Dossier incomplet",
  TRANSMIS_COMPAGNIE: "Transmis compagnie",
  EXPERTISE: "En expertise",
  EN_ATTENTE_REGLEMENT: "En attente de règlement",
  PARTIELLEMENT_REGLE: "Partiellement réglé",
  REGLE: "Réglé",
  CLOTURE: "Clôturé",
  REJETE: "Rejeté",
  ANNULE: "Annulé",
  ROUVERT: "Rouvert",
};

export const NATURE_LABELS: Record<NatureSinistre, string> = {
  ACCIDENT: "Accident",
  VOL: "Vol",
  INCENDIE: "Incendie",
  BRIS_DE_GLACE: "Bris de glace",
  DOMMAGE_VEHICULE: "Dommage au véhicule",
  CORPOREL: "Corporel",
  ASSISTANCE: "Assistance",
  AUTRE: "Autre",
};

export const statusLabels = STATUS_LABELS;
export const natureLabels = NATURE_LABELS;

export function formatMoney(value?: number | null) {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
  return `${formatted.replace(/[\u00a0\u202f]/g, " ")} MAD`;
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR").format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}
