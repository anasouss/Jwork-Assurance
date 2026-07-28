import type { ReferenceOption } from "./types";
import { numberValue } from "./utils/format";

export function resolveAssistanceTariffAmount(
  product: ReferenceOption | undefined,
  tarifs: ReferenceOption[] | undefined,
  dateSouscription?: string,
  amountKey: "montantHt" | "montantTtc" = "montantHt"
) {
  const datedTarif = resolveAssistanceTariff(tarifs, dateSouscription);
  const datedAmount = numberValue(String(datedTarif?.[amountKey] ?? ""));
  if (datedAmount != null) {
    return datedAmount;
  }
  return numberValue(String(product?.[amountKey] ?? ""));
}

function resolveAssistanceTariff(tarifs: ReferenceOption[] | undefined, dateSouscription?: string) {
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
