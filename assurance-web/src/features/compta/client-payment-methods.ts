import type { ClientPaymentMode } from "./types";

const BANK_ACCOUNT_AT_ENTRY_MODES = new Set<ClientPaymentMode>([
  "VIREMENT",
  "VERSEMENT_BANCAIRE",
  "CARTE",
  "PRELEVEMENT",
]);

const ORIGINATING_BANK_MODES = new Set<ClientPaymentMode>([
  "CHEQUE",
  "EFFET",
  "VIREMENT",
  "VERSEMENT_BANCAIRE",
]);

const REFERENCE_REQUIRED_MODES = new Set<ClientPaymentMode>([
  "CHEQUE",
  "EFFET",
]);

export function requiresBankAccountAtEntry(mode: ClientPaymentMode) {
  return BANK_ACCOUNT_AT_ENTRY_MODES.has(mode);
}

export function showsOriginatingBank(mode: ClientPaymentMode) {
  return ORIGINATING_BANK_MODES.has(mode);
}

export function requiresPaymentReference(mode: ClientPaymentMode) {
  return REFERENCE_REQUIRED_MODES.has(mode);
}
