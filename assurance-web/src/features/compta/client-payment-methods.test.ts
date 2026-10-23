import { describe, expect, it } from "vitest";
import {
  requiresBankAccountAtEntry,
  requiresPaymentReference,
  showsOriginatingBank,
} from "./client-payment-methods";

describe("client payment methods", () => {
  it("treats a bank deposit as money already credited to an agency bank account", () => {
    expect(requiresBankAccountAtEntry("VERSEMENT_BANCAIRE")).toBe(true);
    expect(requiresPaymentReference("VERSEMENT_BANCAIRE")).toBe(true);
    expect(showsOriginatingBank("VERSEMENT_BANCAIRE")).toBe(false);
  });

  it("keeps cheque and bill processing separate from direct bank deposits", () => {
    expect(requiresBankAccountAtEntry("CHEQUE")).toBe(false);
    expect(requiresPaymentReference("CHEQUE")).toBe(true);
    expect(showsOriginatingBank("CHEQUE")).toBe(true);
  });
});
