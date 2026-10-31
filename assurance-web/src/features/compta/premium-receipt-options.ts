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
