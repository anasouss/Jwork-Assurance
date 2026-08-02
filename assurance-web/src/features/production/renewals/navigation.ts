import type { TypeContrat } from "../types";

type RenewalDraftRoute = {
  id: string;
  typeContrat: TypeContrat;
};

export function renewalDraftPath(draft: RenewalDraftRoute, returnTo: string) {
  const segment = draft.typeContrat === "FLOTTE"
    ? "flotte"
    : draft.typeContrat === "CONVENTION"
      ? "convention"
      : "particulier";
  return `/app/production/renouvellements/${segment}/${draft.id}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function renewalReturnPath(value: string | null) {
  return value?.startsWith("/app/production/echeances")
    ? value
    : "/app/production/echeances";
}
