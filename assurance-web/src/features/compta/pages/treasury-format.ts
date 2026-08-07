import type { PaymentInstrument } from "../types";

export const TREASURY_PAGE_SIZE = 25;
export const TODAY = new Date().toISOString().slice(0, 10);

export function formatTreasuryMoney(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
