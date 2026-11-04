import type { DocumentOwnerOption, PieceJointe, TypePieceJointe } from "../types";

export function documentValidityDate(type?: TypePieceJointe, owner?: Partial<DocumentOwnerOption>) {
  switch (type?.documentValiditySource) {
    case "CLIENT_CIN": return owner?.cinValidite ?? undefined;
    case "CLIENT_PASSPORT": return owner?.passportValidite ?? undefined;
    case "CLIENT_PERMIS": return owner?.dateValiditePermis ?? undefined;
    case "VEHICULE_CARTE_GRISE": return owner?.dateExpirationCarteGrise ?? undefined;
    default: return undefined;
  }
}

export function documentStatus(piece: PieceJointe) {
  return piece.status === "ARCHIVED" ? "Archivé" : piece.status === "EXPIRED" ? "Expiré" : "Disponible";
}

export function formatDocumentDate(value?: string | null) {
  return value ? value.slice(0, 10).split("-").reverse().join("/") : "-";
}

export function numberValue(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized || normalized === ".") return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  return typeof value === "string" ? numberValue(value) : value ? Number(value) : undefined;
}

export function numberOrZero(value?: number | null) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatMoney(value?: number | null) {
  return `${moneyAmount(value)} MAD`;
}

export function formatOptionalMoney(value?: number | null) {
  return value == null ? "-" : formatMoney(value);
}

export function moneyAmount(value?: number | null) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0).replace(/[\u00a0\u202f]/g, " ");
}

export function money(value: unknown) {
  const parsed = toNumber(value);
  return parsed === undefined ? "-" : parsed.toLocaleString("fr-FR");
}

export function text(value: unknown) {
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

export function vehicleEngineCharacteristic(vehicle: { cylindree?: string | null; puissanceFiscale?: string | null }): [string, string] {
  const cylinderCapacity = vehicle.cylindree?.trim();
  return cylinderCapacity ? ["Cylindrée", cylinderCapacity] : ["Puissance fiscale", text(vehicle.puissanceFiscale?.trim())];
}

export function range(min: unknown, max: unknown) {
  const left = text(min);
  const right = text(max);
  return left === "-" && right === "-" ? "-" : `${left} / ${right}`;
}
