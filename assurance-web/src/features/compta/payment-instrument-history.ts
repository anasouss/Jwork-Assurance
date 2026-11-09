import type { BankRejectionFollowUp } from "./types";

export function instrumentHistoryRows(events: BankRejectionFollowUp["mouvements"], instrumentId: string) {
  const rejected = new Set<string>();
  return events.map(event => {
    const sourceId = event.instrumentSourceId || instrumentId;
    const titles = {
      REJET: "Retourné impayé",
      PREPARATION_REMISE: "Nouvelle remise préparée, non encore déposée",
      REMISE_EN_BANQUE: rejected.has(sourceId) ? "Remis à nouveau en banque" : "Remis en banque",
      REMPLACEMENT: "Remplacé par contre-valeur",
      ENCAISSEMENT: "Encaissement confirmé",
      SUIVI: event.libelle || "Suivi du moyen",
    };
    if (event.type === "REJET") rejected.add(sourceId);
    return { ...event, title: titles[event.type] };
  });
}
