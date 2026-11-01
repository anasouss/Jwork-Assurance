import { z } from "zod";
import type { PremiumReceiptOptions } from "./types";

const archiveFields = {
  numero: z.string(),
  dateEmission: z.string(),
};

const optionsSchema = z.object({
  policies: z.array(z.object({
    key: z.string(),
    descriptions: z.array(z.string()).min(1),
    montant: z.number().finite(),
    eligible: z.boolean().default(false),
    mouvements: z.array(z.object({
      elementFacturableId: z.string(),
      documentClientId: z.string().nullish(),
      libelle: z.string(),
      dateDebut: z.string().nullish(),
      dateFin: z.string().nullish(),
      montant: z.number().finite(),
      statut: z.enum(["REGLEE", "EN_ATTENTE_ENCAISSEMENT", "NON_SOLDEE"]),
    })).default([]),
  })),
  archives: z.array(z.union([
    // Older backends omit null properties; only the explicit "all" archive has no selection.
    z.object({ ...archiveFields, id: z.literal("all"), policyKeys: z.null().optional() })
      .transform(archive => ({ ...archive, policyKeys: null })),
    z.object({ ...archiveFields, id: z.string().regex(/^[0-9]+$/), policyKeys: z.array(z.string()).min(1) }),
  ])),
});

export function normalizePremiumReceiptOptions(value: unknown): PremiumReceiptOptions {
  const result = optionsSchema.safeParse(value);
  if (!result.success) {
    throw new Error("La réponse des quittances de prime est incomplète. Vérifiez que le backend est à jour.");
  }
  return result.data;
}
