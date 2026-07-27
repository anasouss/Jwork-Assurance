export function toDateOnly(date?: Date) {
  if (!date) {
    return undefined;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computeDateEcheanceFromCode(dateEffet?: string | null, echeance?: string | null, fallback?: string | null) {
  if (!dateEffet || !echeance) {
    return fallback ?? undefined;
  }
  const code = normalizeEcheanceCode(echeance);
  if (!code) {
    return fallback ?? undefined;
  }
  const [dayText, monthText] = code.split("/");
  const day = Number(dayText);
  const month = Number(monthText);
  const effectiveDate = new Date(`${dateEffet}T00:00:00`);
  if (Number.isNaN(effectiveDate.getTime())) {
    return fallback ?? undefined;
  }
  if (day === 1 && month === 1) {
    return `${effectiveDate.getFullYear()}-12-31`;
  }
  let expiration = new Date(effectiveDate.getFullYear(), month - 1, day);
  if (expiration <= effectiveDate) {
    expiration = new Date(effectiveDate.getFullYear() + 1, month - 1, day);
  }
  expiration.setDate(expiration.getDate() - 1);
  return toDateOnly(expiration);
}

export function computeDateEcheanceFromMonths(dateEffet?: string | null, monthsToAdd?: number | null, fallback?: string | null) {
  if (!dateEffet || !monthsToAdd || monthsToAdd <= 0) {
    return fallback ?? undefined;
  }
  const effectiveDate = new Date(`${dateEffet}T00:00:00`);
  if (Number.isNaN(effectiveDate.getTime())) {
    return fallback ?? undefined;
  }
  const expiration = addMonthsClamped(effectiveDate, monthsToAdd);
  expiration.setDate(expiration.getDate() - 1);
  return toDateOnly(expiration);
}

function addMonthsClamped(date: Date, monthsToAdd: number) {
  const targetMonthIndex = date.getMonth() + monthsToAdd;
  const targetYear = date.getFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(date.getDate(), lastDayOfTargetMonth));
}

function normalizeEcheanceCode(echeance: string) {
  const match = echeance.trim().replaceAll(" ", "").match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) {
    return undefined;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || month < 1 || month > 12) {
    return undefined;
  }
  const validationDate = new Date(2024, month - 1, day);
  if (validationDate.getFullYear() !== 2024 || validationDate.getMonth() !== month - 1 || validationDate.getDate() !== day) {
    return undefined;
  }
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}
