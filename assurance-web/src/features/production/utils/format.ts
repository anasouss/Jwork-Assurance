export function numberValue(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toNumber(value: unknown) {
  return typeof value === "number" ? value : value ? Number(value) : undefined;
}

export function numberOrZero(value?: number | null) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(value ?? 0);
}

export function formatOptionalMoney(value?: number | null) {
  return value == null ? "-" : formatMoney(value);
}

export function money(value: unknown) {
  const parsed = toNumber(value);
  return parsed === undefined ? "-" : parsed.toLocaleString("fr-FR");
}

export function text(value: unknown) {
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

export function range(min: unknown, max: unknown) {
  const left = text(min);
  const right = text(max);
  return left === "-" && right === "-" ? "-" : `${left} / ${right}`;
}
