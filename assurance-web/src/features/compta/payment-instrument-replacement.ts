export function replacementAmountCents(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function replacementTotalCents(amounts: string[]): number | null {
  let total = 0;
  for (const amount of amounts) {
    const cents = replacementAmountCents(amount);
    if (cents === null || !Number.isSafeInteger(total + cents)) return null;
    total += cents;
  }
  return total;
}

export function replacementAmountInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
