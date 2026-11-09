import { describe, expect, it } from "vitest";
import type { BankRejectionFollowUp } from "./types";
import { instrumentHistoryRows } from "./payment-instrument-history";

describe("payment instrument history labels", () => {
  it("distinguishes preparation, redeposit, replacement and collection", () => {
    const events = [
      { type: "REMISE_EN_BANQUE", instrumentSourceId: "1" },
      { type: "REJET", instrumentSourceId: "1" },
      { type: "PREPARATION_REMISE", instrumentSourceId: "1" },
      { type: "REMISE_EN_BANQUE", instrumentSourceId: "1" },
      { type: "REMPLACEMENT", instrumentSourceId: "1" },
      { type: "REMISE_EN_BANQUE", instrumentSourceId: "2" },
      { type: "ENCAISSEMENT", instrumentSourceId: "2" },
    ].map((event, index) => ({ ...event, id: String(index), date: "2026-11-09", statut: "INSTANCE" })) as BankRejectionFollowUp["mouvements"];
    expect(instrumentHistoryRows(events, "1").map(event => event.title)).toEqual([
      "Remis en banque", "Retourné impayé", "Nouvelle remise préparée, non encore déposée",
      "Remis à nouveau en banque", "Remplacé par contre-valeur", "Remis en banque", "Encaissement confirmé",
    ]);
    expect(events[4].type).toBe("REMPLACEMENT");
  });
});
