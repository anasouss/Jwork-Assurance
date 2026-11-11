import { format } from "date-fns";
import { moneyAmount } from "@/features/production/utils/format";

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-").map(Number);
  return format(new Date(year, month - 1, day), "dd/MM/yyyy");
}

export function compactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${moneyAmount(value / 1_000_000)} M`;
  if (Math.abs(value) >= 1_000) return `${moneyAmount(value / 1_000)} k`;
  return moneyAmount(value);
}

export function dateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}
