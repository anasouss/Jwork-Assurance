import type { NiveauEcartAffectation, Rule } from "./types";

export type AllocationTolerance = {
  level: NiveauEcartAffectation;
  allowed: boolean;
  warningThreshold: number;
  blockingThreshold: number;
  shortageLimit: number;
  excessLimit: number;
};

export function classifyAllocationDifference(
  difference: number,
  rule?: Pick<
    Rule,
    "seuilAvertissementEcart" | "margeManquanteMaximale" | "margeDepassementMaximale"
  > | null
): AllocationTolerance {
  const warningThreshold = Math.max(0, rule?.seuilAvertissementEcart ?? 0.01);
  const shortageLimit = Math.max(warningThreshold, rule?.margeManquanteMaximale ?? 20);
  const excessLimit = Math.max(warningThreshold, rule?.margeDepassementMaximale ?? 50);
  const roundedDifference = roundMoney(difference);
  const absoluteDifference = Math.abs(roundedDifference);
  const blockingThreshold = roundedDifference < 0 ? shortageLimit : excessLimit;

  if (absoluteDifference <= warningThreshold) {
    return {
      level: "EQUILIBRE",
      allowed: true,
      warningThreshold,
      blockingThreshold,
      shortageLimit,
      excessLimit,
    };
  }
  if (absoluteDifference <= blockingThreshold) {
    return {
      level: "AVERTISSEMENT",
      allowed: true,
      warningThreshold,
      blockingThreshold,
      shortageLimit,
      excessLimit,
    };
  }
  return {
    level: "BLOQUANT",
    allowed: false,
    warningThreshold,
    blockingThreshold,
    shortageLimit,
    excessLimit,
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
