import type { PaymentInstrument } from "../types";
import { formatAccountingAmount } from "../format";

export const TREASURY_PAGE_SIZE = 25;
export const TODAY = new Date().toISOString().slice(0, 10);

export function formatTreasuryMoney(value: number) {
  return formatAccountingAmount(value);
}

export function formatTreasuryDate(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}

export function paymentModeLabel(value: PaymentInstrument["mode"]) {
  const labels = {
    ESPECES: "Espèces",
    CHEQUE: "Chèque",
    EFFET: "Effet",
    VIREMENT: "Virement",
    VERSEMENT_BANCAIRE: "Versement bancaire",
    CARTE: "Carte",
    PRELEVEMENT: "Prélèvement",
  } as const;

  return labels[value];
}
