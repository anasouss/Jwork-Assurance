import type { TypeDommageSinistre } from "./types";

export function parseOpeningDamage(value: string | null): TypeDommageSinistre | "" {
  return value === "MATERIEL" || value === "CORPOREL" || value === "MIXTE" ? value : "";
}

export function openingContextParams(context: {
  contratId: string;
  dateSinistre: string;
  dateDeclaration: string;
  vehiculeId: string;
  automobile: boolean;
  typeDommage: TypeDommageSinistre | "";
}) {
  const params = new URLSearchParams({ contratId: context.contratId, dateSinistre: context.dateSinistre, dateDeclaration: context.dateDeclaration });
  if (context.vehiculeId) params.set("vehiculeId", context.vehiculeId);
  if (context.automobile && context.typeDommage) params.set("typeDommage", context.typeDommage);
  return params;
}
