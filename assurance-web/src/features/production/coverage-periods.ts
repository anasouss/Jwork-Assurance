import { computeDateEcheanceFromMonths, toDateOnly } from "./date";

export const PERIODES_COUVERTURE = [
  { value: "J5", label: "5 jours", jours: 5, mois: 0 },
  { value: "J10", label: "10 jours", jours: 10, mois: 0 },
  { value: "M1", label: "1 mois", jours: 0, mois: 1 },
  { value: "M3", label: "3 mois", jours: 0, mois: 3 },
  { value: "M6", label: "6 mois", jours: 0, mois: 6 },
  { value: "M12", label: "12 mois", jours: 0, mois: 12 },
] as const;

export type PeriodeCouverture = typeof PERIODES_COUVERTURE[number]["value"];

export function periodesForUsage(usage?: { periodesAutorisees?: unknown } | null) {
  const values = usage?.periodesAutorisees;
  return PERIODES_COUVERTURE.filter((periode) => Array.isArray(values) && values.includes(periode.value));
}

export function coverageExpiration(dateEffet?: string, periode?: string) {
  const option = PERIODES_COUVERTURE.find((item) => item.value === periode);
  if (!dateEffet || !option) return undefined;
  if (option.mois) return computeDateEcheanceFromMonths(dateEffet, option.mois);
  const date = new Date(`${dateEffet}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setDate(date.getDate() + option.jours - 1);
  return toDateOnly(date);
}
