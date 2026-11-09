import { describe, expect, it } from "vitest";
import { clientDocumentReference } from "./format";

describe("client document references", () => {
  it("uses the saved assistance contract, never the parent policy", () => {
    expect(clientDocumentReference({ nature: "ASSISTANCE", numeroPolice: "PARENT", numeroQuittance: "ASSIST-1" })).toBe("ASSIST-1");
    expect(clientDocumentReference({ nature: "ASSISTANCE", numeroPolice: "PARENT" })).toBe("-");
  });

  it("retains insurance policy references", () => {
    expect(clientDocumentReference({ nature: "CONTRAT", numeroPolice: "POLICE-1", numeroQuittance: "QUITTANCE-1" })).toBe("POLICE-1");
  });
});
