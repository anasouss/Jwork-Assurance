import type { ContractTarget } from "./ContractTargetsSection";

export function contractTargetKey(target?: ContractTarget) {
  return target ? `${target.kind}:${target.index}` : "";
}

export function guaranteeCalculationKey(target: ContractTarget, garantieId: string) {
  return `${contractTargetKey(target)}:${garantieId}`;
}
