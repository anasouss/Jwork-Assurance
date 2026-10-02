import type { ClientReceivable } from "./types";

export function receivableDocumentReference(row: ClientReceivable) {
  return row.source.documentClientId ? row.source.reference || "-" : "-";
}

export function receivableCoverageReference(row: ClientReceivable) {
  if (row.source.nature === "ASSISTANCE") {
    return row.source.referenceSource
      || (row.source.documentClientId ? "-" : row.source.reference)
      || "-";
  }
  return row.source.police || "-";
}

export function receivableTypeLabel(row: ClientReceivable) {
  if (row.source.typeContrat === "PARTICULIER") return "Mono";
  if (row.source.typeContrat === "CONVENTION") return "Convention";
  if (row.source.typeContrat === "FLOTTE") return "Flotte";
  if (row.source.documentClientId) {
    if (row.source.reference?.startsWith("REL-")) return "Relevé";
    if (row.source.reference?.startsWith("FAC-")) return "Facture";
    return "Document";
  }
  return "-";
}
