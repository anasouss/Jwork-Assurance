import type { ReferenceOption } from "./types";
import { numberValue, roundMoney } from "./utils/format";

type AssistanceTariff = {
  dateDebut?: unknown;
  dateFin?: unknown;
  montantHt?: unknown;
  montantTtc?: unknown;
};

export function resolveAssistanceTariffAmount(
  product: ReferenceOption | undefined,
  tarifs: AssistanceTariff[] | undefined,
  dateSouscription?: string,
  amountKey: "montantHt" | "montantTtc" = "montantHt"
) {
  const datedTarif = resolveAssistanceTariff(tarifs, dateSouscription);
  const datedAmount = numberValue(String(datedTarif?.[amountKey] ?? ""));
  if (datedAmount != null) {
    return datedAmount;
  }
  if (tarifs) {
    return undefined;
  }
  return numberValue(String(product?.[amountKey] ?? ""));
}

export function resolveAssistanceQuarterCount(dateEffet?: string, dateEcheance?: string) {
  const start = parseDateOnly(dateEffet);
  const end = parseDateOnly(dateEcheance);
  if (!start || !end || end < start) {
    return 4;
  }

  const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  let months = (endExclusive.getFullYear() - start.getFullYear()) * 12
    + (endExclusive.getMonth() - start.getMonth());
  const startPlusMonths = addMonthsClamped(start, months);
  if (startPlusMonths < endExclusive) {
    months += 1;
  }

  return Math.max(1, Math.min(4, Math.ceil(Math.max(1, months) / 3)));
}

export function resolveAssistanceDraftTotal(
  product: ReferenceOption | undefined,
  dateSouscription?: string,
  dateEffet?: string,
  dateEcheance?: string
) {
  const tarifs = Array.isArray(product?.tarifs) ? product.tarifs as AssistanceTariff[] : undefined;
  const annualTotal = resolveAssistanceTariffAmount(
    product,
    tarifs,
    dateSouscription ?? dateEffet,
    "montantTtc"
  );
  if (annualTotal == null) {
    return undefined;
  }
  return roundMoney(annualTotal * resolveAssistanceQuarterCount(dateEffet, dateEcheance) / 4);
}

function resolveAssistanceTariff(tarifs: AssistanceTariff[] | undefined, dateSouscription?: string) {
  if (!dateSouscription || !tarifs || tarifs.length === 0) {
    return undefined;
  }
  const reference = parseDateOnly(dateSouscription);
  if (!reference) {
    return undefined;
  }
  return tarifs.find((tarif) => {
    const start = parseDateOnly(String(tarif.dateDebut ?? ""));
    const end = parseDateOnly(String(tarif.dateFin ?? ""));
    if (!start) {
      return false;
    }
    return start <= reference && (!end || reference <= end);
  });
}

function parseDateOnly(value?: string) {
  if (!value) {
    return undefined;
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
    return undefined;
  }
  return date;
}

function addMonthsClamped(date: Date, months: number) {
  const targetMonth = date.getMonth() + months;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay));
}
