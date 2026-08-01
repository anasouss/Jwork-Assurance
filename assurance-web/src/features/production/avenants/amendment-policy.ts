export const AMENDMENT_CODES = [
  "EXG_M",
  "MOG_M",
  "EXR_M",
  "CHV_M",
  "PRI_M",
  "DUP_M",
  "PRO_M",
  "RES_M",
  "RCH_M",
  "ANN_M",
  "INC_F",
  "MOG_F",
  "RET_F",
  "EXR_F",
  "RES_F",
  "RCH_F",
  "PRI_F",
  "DUP_F",
] as const;

export type AmendmentCode = (typeof AMENDMENT_CODES)[number];

export type AmendmentPolicy = {
  code: AmendmentCode;
  label: string;
  operation: "TARGET_CREATION" | "GUARANTEE_MODIFICATION" | "TARGET_SELECTION" | "PRECISION" | "DUPLICATA" | "CLOSURE";
  target: "VEHICLE" | "TRAILER" | "MIXED" | "EXISTING";
  differential: boolean;
  singleVehicle: boolean;
  closureAtTerm: boolean;
};

const policies: Record<AmendmentCode, AmendmentPolicy> = {
  EXG_M: policy("EXG_M", "Extension garanties", "GUARANTEE_MODIFICATION", "EXISTING", true),
  MOG_M: policy("MOG_M", "Modification garanties", "GUARANTEE_MODIFICATION", "EXISTING", true),
  EXR_M: policy("EXR_M", "Extension remorque", "TARGET_CREATION", "TRAILER", true),
  CHV_M: policy("CHV_M", "Changement véhicule", "TARGET_CREATION", "VEHICLE", true, true),
  PRI_M: policy("PRI_M", "Précision immatriculation", "PRECISION", "EXISTING", false),
  DUP_M: policy("DUP_M", "Duplicata", "DUPLICATA", "EXISTING", false),
  PRO_M: policy("PRO_M", "Provisoire", "TARGET_CREATION", "VEHICLE", false, true),
  RES_M: policy("RES_M", "Résiliation", "CLOSURE", "EXISTING", false),
  RCH_M: policy("RCH_M", "Résiliation à l'échéance", "CLOSURE", "EXISTING", false, false, true),
  ANN_M: policy("ANN_M", "Annulation", "CLOSURE", "EXISTING", false),
  INC_F: policy("INC_F", "Incorporation", "TARGET_CREATION", "MIXED", true),
  MOG_F: policy("MOG_F", "Modification garanties", "GUARANTEE_MODIFICATION", "EXISTING", true),
  RET_F: policy("RET_F", "Retrait", "TARGET_SELECTION", "EXISTING", false),
  EXR_F: policy("EXR_F", "Extension remorque", "TARGET_SELECTION", "TRAILER", true),
  RES_F: policy("RES_F", "Résiliation", "CLOSURE", "EXISTING", false),
  RCH_F: policy("RCH_F", "Résiliation à l'échéance", "CLOSURE", "EXISTING", false, false, true),
  PRI_F: policy("PRI_F", "Précision immatriculation", "PRECISION", "EXISTING", false),
  DUP_F: policy("DUP_F", "Duplicata", "DUPLICATA", "EXISTING", false),
};

export function normalizeAmendmentCode(code?: string | null) {
  return (code ?? "").trim().toUpperCase();
}

export function isSupportedAmendmentCode(code?: string | null): code is AmendmentCode {
  return Object.hasOwn(policies, normalizeAmendmentCode(code));
}

export function getAmendmentPolicy(code?: string | null): AmendmentPolicy | undefined {
  const normalized = normalizeAmendmentCode(code);
  return isSupportedAmendmentCode(normalized) ? policies[normalized] : undefined;
}

export function amendmentLabel(code?: string | null) {
  return getAmendmentPolicy(code)?.label ?? normalizeAmendmentCode(code);
}

function policy(
  code: AmendmentCode,
  label: string,
  operation: AmendmentPolicy["operation"],
  target: AmendmentPolicy["target"],
  differential: boolean,
  singleVehicle = false,
  closureAtTerm = false,
): AmendmentPolicy {
  return { code, label, operation, target, differential, singleVehicle, closureAtTerm };
}
