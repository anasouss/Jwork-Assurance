import type { NiveauEcartAffectation, Rule } from "./types";

export type AllocationTolerance = {
  level: NiveauEcartAffectation;
  allowed: boolean;
  warningThreshold: number;
  blockingThreshold: number;
};

export function classifyAllocationDifference(
  difference: number,
  rule?: Pick<Rule, "seuilAvertissementEcart" | "seuilBlocageEcart"> | null
): AllocationTolerance {
  const warningThreshold = Math.max(0, rule?.seuilAvertissementEcart ?? 0.01);
  const blockingThreshold = Math.max(warningThreshold, rule?.seuilBlocageEcart ?? 50);
  const absoluteDifference = Math.abs(roundMoney(difference));

  if (absoluteDifference === 0 || absoluteDifference < warningThreshold) {
    return { level: "EQUILIBRE", allowed: true, warningThreshold, blockingThreshold };
  }
  if (absoluteDifference <= blockingThreshold) {
    return { level: "AVERTISSEMENT", allowed: true, warningThreshold, blockingThreshold };
  }
  return { level: "BLOQUANT", allowed: false, warningThreshold, blockingThreshold };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
