import type { ReferenceOption } from "../types";
import { money, toNumber } from "../utils/format";

export function tariffSelectionLabel(line: ReferenceOption, index = 0) {
  if (line.critereSelectionTarif === "TAUX_FRANCHISE") {
    const tauxFranchise = toNumber(line.tauxFranchise);
    if (tauxFranchise != null) {
      return `${money(tauxFranchise)} %`;
    }
  }

  const mode = String(line.modeTarification ?? "").toUpperCase();
  const taux = toNumber(line.taux);
  if (mode === "TAUX" && taux != null) {
    return `${money(taux)} %`;
  }
  if (mode === "CAPITAL") {
    const label = String(line.libelle ?? "");
    return label.toLowerCase().includes("formule") ? label : `Formule ${index + 1}`;
  }
  return String(line.libelle ?? (taux == null ? "" : `${money(taux)} %`));
}
