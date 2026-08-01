import type { GarantieInput, ReferenceOption } from "../types";

export type GuaranteeTarget = {
  kind: "vehicule" | "remorque";
  index: number;
};

export function targetedGuaranteeInput(
  garantie: ReferenceOption,
  target: GuaranteeTarget,
  sourceValeurSelectionnee: string
): GarantieInput {
  return {
    garantieId: garantie.id,
    vehiculeIndex: target.kind === "vehicule" ? target.index : undefined,
    remorqueIndex: target.kind === "remorque" ? target.index : undefined,
    modeSelectionne: String(garantie.modeParDefaut ?? "TAUX"),
    sourceValeurSelectionnee,
  };
}

export function sameGuaranteeTarget(item: GarantieInput, target?: GuaranteeTarget) {
  if (!target) return false;
  return target.kind === "vehicule"
    ? item.vehiculeIndex === target.index
    : item.remorqueIndex === target.index;
}

export function removeGuaranteeExclusionConflicts(
  selected: GarantieInput[],
  garanties: ReferenceOption[],
  target: GuaranteeTarget,
  garantie: ReferenceOption
) {
  const groupeExclusionId = String(garantie.groupeExclusionId ?? "");
  if (!groupeExclusionId || garantie.groupeExclusionActif === false) return selected;

  const incompatibleGarantieIds = new Set(
    garanties
      .filter((candidate) => candidate.id !== garantie.id && String(candidate.groupeExclusionId ?? "") === groupeExclusionId)
      .map((candidate) => candidate.id)
  );
  if (incompatibleGarantieIds.size === 0) return selected;

  return selected.filter((item) => !(
    sameGuaranteeTarget(item, target) && incompatibleGarantieIds.has(item.garantieId)
  ));
}
