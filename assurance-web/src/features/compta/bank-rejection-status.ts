import type { BankRejectionFollowUpStatus, PaymentInstrumentStatus } from "./types";

export const rejectionStatusLabels: Record<BankRejectionFollowUpStatus, string> = {
  INSTANCE: "En instance", REPRESENTE: "Représenté", REGLE_CV: "Réglé C/V", CONTENTIEUX: "Contentieux",
};

export const rejectionStatusVariants = {
  INSTANCE: "warning", REPRESENTE: "info", REGLE_CV: "success", CONTENTIEUX: "destructive",
} as const;

export const rejectionInstrumentLabels: Record<PaymentInstrumentStatus, string> = {
  EN_ATTENTE: "En attente", REMIS_EN_BANQUE: "Remis en banque", CONFIRME: "Encaissé", REJETE: "Rejeté", REMPLACE: "Remplacé",
};
