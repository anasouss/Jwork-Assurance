import { describe, expect, it } from "vitest";
import { replacementAmountCents, replacementAmountInput, replacementTotalCents } from "./payment-instrument-replacement";

describe("replacement amounts", () => {
  it("accepts French amounts and sums without floating-point drift", () => {
    expect(replacementAmountCents("1 234,50")).toBe(123450);
    expect(replacementTotalCents(["0,10", "0.20"])).toBe(30);
    expect(replacementTotalCents(["100,01", "199,99", "700"])).toBe(100000);
    expect(replacementAmountInput(123450)).toBe("1234,50");
  });

  it.each(["", "-1", "1.001", "1,234", "1e3", "1,2,3", "90071992547410.00"])("rejects invalid or unsafe amount %s", (value) => {
    expect(replacementAmountCents(value)).toBeNull();
    expect(replacementTotalCents(["10", value])).toBeNull();
  });

  it("keeps zero distinct from an invalid amount", () => {
    expect(replacementAmountCents("0,00")).toBe(0);
    expect(replacementTotalCents([])).toBe(0);
  });
});
