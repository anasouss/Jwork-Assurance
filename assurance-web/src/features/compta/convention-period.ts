export function conventionPeriodLabel(frequency: string | null | undefined, number: number) {
  if (frequency === "TRIMESTRIEL") return `${number === 1 ? "1er" : `${number}e`} trimestre`;
  if (frequency === "SEMESTRIEL") return `${number === 1 ? "1er" : `${number}e`} semestre`;
  if (frequency === "MENSUEL") return `Mois ${number}`;
  if (frequency === "ANNUEL") return "Année";
  return `Période ${number}`;
}
