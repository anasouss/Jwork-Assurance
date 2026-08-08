const ACCOUNTING_AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAccountingAmount(value?: number | null) {
  return ACCOUNTING_AMOUNT_FORMATTER
    .format(value ?? 0)
    .replace(/[\u00a0\u202f]/g, " ");
}

export function formatAccountingMoney(value?: number | null) {
  return `${formatAccountingAmount(value)} MAD`;
}

export function parseAccountingAmount(value: string) {
  const normalized = value
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}
