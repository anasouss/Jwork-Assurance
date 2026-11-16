import type { ProviderKind } from "./types";

export const providerTypes: { value: ProviderKind; label: string; singular: string }[] = [
  { value: "GARAGE", label: "Garage", singular: "un garage" },
  { value: "EXPERT", label: "Expert", singular: "un expert" },
  { value: "MEDECIN", label: "Médecin", singular: "un médecin" },
  { value: "CLINIQUE", label: "Clinique", singular: "une clinique" },
  { value: "PHARMACIE", label: "Pharmacie", singular: "une pharmacie" },
  { value: "RADIOLOGIE", label: "Radiologie", singular: "un centre de radiologie" },
  { value: "KINESITHERAPIE", label: "Kinésithérapie", singular: "un kinésithérapeute" },
];

export function providerTypeLabel(type: ProviderKind) {
  return providerTypes.find(item => item.value === type)?.label ?? type;
}
