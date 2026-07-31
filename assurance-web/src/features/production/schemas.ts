import { z } from "zod";

const optionalNumber = z
  .union([z.number(), z.nan(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "" || Number.isNaN(value)) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  });

export const contratSchema = z.object({
  agenceId: z.string().min(1, "Agence obligatoire"),
  typeContrat: z.enum(["PARTICULIER", "CONVENTION", "FLOTTE"]),
  numeroPolice: z.string().optional(),
  compagnieAssuranceId: z.string().optional(),
  usageId: z.string().optional(),
  grilleTarifaireId: z.string().optional(),
  dateEffet: z.string().optional(),
  dateEcheance: z.string().optional(),
  clients: z.array(z.any()).min(1, "Au moins un client est obligatoire"),
  vehicules: z.array(z.any()),
  remorques: z.array(z.any()),
  garanties: z.array(z.any()),
}).superRefine((value, ctx) => {
  if (!value.numeroPolice?.trim()) {
    ctx.addIssue({ code: "custom", path: ["numeroPolice"], message: "Numéro de police obligatoire" });
  }
});

export const transportCategorySchema = z.object({
  code: z.string().min(2, "Code obligatoire"),
  libelle: z.string().min(2, "Libelle obligatoire"),
  description: z.string().optional(),
  actif: z.boolean().optional(),
});

export const clientCategorySchema = z.object({
  code: z.string().min(2, "Code obligatoire"),
  libelle: z.string().min(2, "Libelle obligatoire"),
  usageIds: z.array(z.string()).optional(),
  actif: z.boolean().optional(),
});

export const grilleTarifaireSchema = z.object({
  compagnieAssuranceId: z.string().min(1, "Compagnie obligatoire"),
  libelle: z.string().min(2, "Libelle obligatoire"),
  description: z.string().optional(),
});

export const ligneGrilleTarifaireSchema = z.object({
  garantieId: z.string().min(1, "Garantie obligatoire"),
  usageId: z.string().optional(),
  categorieTransportId: z.string().optional(),
  puissanceFiscaleMin: z.number().optional(),
  puissanceFiscaleMax: z.number().optional(),
  nombrePlacesMin: z.number().optional(),
  nombrePlacesMax: z.number().optional(),
  ptcMin: z.number().optional(),
  ptcMax: z.number().optional(),
  sousClasse: z.string().optional(),
  carburant: z.string().optional(),
  modeTarification: z.string().optional(),
  libelleOption: z.string().optional(),
  prime: z.number().optional(),
  capital: z.number().optional(),
  taux: z.number().optional(),
  tauxFranchise: z.number().optional(),
  franchiseMinimale: z.number().optional(),
  ordreAffichage: z.number().optional(),
});

export const formuleGarantiePersonneSchema = z.object({
  garantieId: z.string().min(1, "Garantie personne obligatoire"),
  usageId: z.string().optional(),
  formule: z.string().optional(),
  montantDeces: z.number().optional(),
  montantInvalidite: z.number().optional(),
  montantFraisMedicaux: z.number().optional(),
  montantFraisHospitalisation: z.number().optional(),
  montantFraisFuneraires: z.number().optional(),
  montantFraisChirurgie: z.number().optional(),
  primeNette: z.number().optional(),
  accessoire: z.number().optional(),
});

export const usageSchema = z.object({
  code: z.string().min(1, "Code obligatoire"),
  libelle: z.string().min(2, "Libelle obligatoire"),
  criteria: z.string().optional(),
  groupeUsageAttestationId: z.string().optional(),
  consommeAttestation: z.boolean().optional(),
  byCarburantAndPf: z.boolean().optional(),
  bySousClasse: z.boolean().optional(),
  byPtc: z.boolean().optional(),
  byPrime: z.boolean().optional(),
  byCategorieTransport: z.boolean().optional(),
  garantiesPersonne: z.boolean().optional(),
  actif: z.boolean().optional(),
});

export const groupeUsageAttestationSchema = z.object({
  code: z.string().min(1, "Code obligatoire"),
  libelle: z.string().min(2, "Libelle obligatoire"),
  couleur: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Couleur invalide").optional().or(z.literal("")),
  compagnieRestrictionIds: z.array(z.string()).optional(),
  visibleStock: z.boolean().optional(),
  actif: z.boolean().optional(),
});

export const garantieSchema = z.object({
  code: z.string().min(1, "Code obligatoire"),
  libelle: z.string().min(2, "Libelle obligatoire"),
  description: z.string().optional(),
  branche: z.string().optional(),
  groupeExclusionId: z.string().optional(),
  typeGarantie: z.enum(["VEHICULE", "PERSONNE"]),
  obligatoire: z.boolean().optional(),
  responsabiliteCivile: z.boolean().optional(),
  defenseRecours: z.boolean().optional(),
  requiertValeurVenale: z.boolean().optional(),
  requiertValeurNeuf: z.boolean().optional(),
  requiertValeurGlace: z.boolean().optional(),
  avecFranchise: z.boolean().optional(),
  avecFranchiseMinimale: z.boolean().optional(),
  avecCapital: z.boolean().optional(),
  tarificationMultiple: z.boolean().optional(),
  modesTarificationMultiple: z.array(z.enum(["TAUX", "CAPITAL", "PROTECTION", "PRIME_FIXE"])).optional(),
  modesAutorises: z.array(z.enum(["TAUX", "CAPITAL", "PROTECTION", "PRIME_FIXE"])).min(1, "Au moins un mode est obligatoire"),
  modeParDefaut: z.enum(["TAUX", "CAPITAL", "PROTECTION", "PRIME_FIXE"]),
  sourcesValeurAutorisees: z.array(z.enum(["VENALE", "NEUF", "GLACE", "MANUEL"])).optional(),
  sourceValeurParDefaut: z.enum(["AUCUNE", "VENALE", "NEUF", "GLACE", "MANUEL"]),
  saisieManuelleAutorisee: z.boolean().optional(),
  verrouillee: z.boolean().optional(),
  compagniesSansProrataIds: z.array(z.string()).optional(),
  ordreAffichage: z.number().int().min(0).optional(),
  actif: z.boolean().optional(),
}).superRefine((value, context) => {
  if (!value.modesAutorises.includes(value.modeParDefaut)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["modeParDefaut"], message: "Le mode par défaut doit être autorisé" });
  }
  if (value.typeGarantie === "PERSONNE" && (value.modeParDefaut !== "PROTECTION" || !value.modesAutorises.includes("PROTECTION"))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["modeParDefaut"], message: "Une garantie personne doit utiliser le mode PROTECTION" });
  }
  if (value.typeGarantie === "VEHICULE" && (value.modeParDefaut === "PROTECTION" || value.modesAutorises.includes("PROTECTION"))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["modeParDefaut"], message: "Le mode PROTECTION est réservé aux garanties personne" });
  }
  const invalidMultipleMode = (value.modesTarificationMultiple ?? []).find((mode) => !value.modesAutorises.includes(mode));
  if (invalidMultipleMode) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["modesTarificationMultiple"], message: "Les modes multiples doivent faire partie des modes autorisés" });
  }
  if ((value.modesTarificationMultiple ?? []).length > 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["modesTarificationMultiple"], message: "Un seul mode multiple est autorisé" });
  }
  if (value.sourceValeurParDefaut !== "AUCUNE" && !(value.sourcesValeurAutorisees ?? []).includes(value.sourceValeurParDefaut)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceValeurParDefaut"], message: "La source par défaut doit être autorisée" });
  }
});

export const groupeExclusionGarantieSchema = z.object({
  code: z.string().min(1, "Code obligatoire"),
  libelle: z.string().min(2, "Libellé obligatoire"),
  typeGarantie: z.enum(["VEHICULE", "PERSONNE"]).optional(),
  actif: z.boolean().optional(),
});

export const tarifUsageSchema = z.object({
  usageId: z.string().min(1, "Usage obligatoire"),
  categorieTransportId: z.string().optional(),
  puissanceFiscaleMin: z.number().optional(),
  puissanceFiscaleMax: z.number().optional(),
  nombrePlacesMin: z.number().optional(),
  nombrePlacesMax: z.number().optional(),
  ptcMin: z.number().optional(),
  ptcMax: z.number().optional(),
  sousClasse: z.string().optional(),
  carburant: z.string().optional(),
  primeNette: z.number().optional(),
  primeParPlace: z.number().optional(),
  actif: z.boolean().optional(),
});

export const bulkTarifUsageSchema = z.object({
  tarifIds: z.array(z.string()).optional(),
  usageIds: z.array(z.string()).optional(),
  adjustmentType: z.enum(["PERCENT", "FIXED"]),
  direction: z.enum(["INCREASE", "DECREASE"]),
  value: z.number().positive("Valeur obligatoire"),
});

export const compagnieAssuranceSchema = z.object({
  code: z.string().min(1, "Code obligatoire"),
  nom: z.string().min(2, "Nom obligatoire"),
  adresse: z.string().optional(),
  ville: z.string().optional(),
  email: z.string().optional(),
  telephone: z.string().optional(),
  rc: z.string().optional(),
  ice: z.string().optional(),
  prefixeAttestation: z.string().optional(),
  prefixeCarteVerte: z.string().optional(),
  ordreAffichage: z.number().int().min(0).optional(),
  actif: z.boolean().optional(),
});

export const referenceSchema = z.object({
  libelle: z.string().min(2, "Libelle obligatoire"),
  actif: z.boolean().optional(),
});

export const codeReferenceSchema = z.object({
  code: z.string().min(1, "Code obligatoire"),
  libelle: z.string().min(1, "Libelle obligatoire"),
  actif: z.boolean().optional(),
});

export function cleanNumber(value: string): number | undefined {
  return optionalNumber.parse(value);
}
