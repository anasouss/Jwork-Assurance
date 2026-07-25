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
  numeroContrat: z.string().min(1, "Numero contrat obligatoire"),
  compagnieAssuranceId: z.string().optional(),
  usageId: z.string().optional(),
  grilleTarifaireId: z.string().optional(),
  dateEffet: z.string().optional(),
  dateEcheance: z.string().optional(),
  clients: z.array(z.any()).min(1, "Au moins un client est obligatoire"),
  vehicules: z.array(z.any()),
  remorques: z.array(z.any()),
  garanties: z.array(z.any()),
});

export const transportCategorySchema = z.object({
  code: z.string().min(2, "Code obligatoire"),
  libelle: z.string().min(2, "Libelle obligatoire"),
  description: z.string().optional(),
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
  modeTarification: z.string().optional(),
  libelleOption: z.string().optional(),
  prime: z.number().optional(),
  capital: z.number().optional(),
  taux: z.number().optional(),
  tauxFranchise: z.number().optional(),
  franchiseMinimale: z.number().optional(),
});

export function cleanNumber(value: string): number | undefined {
  return optionalNumber.parse(value);
}
