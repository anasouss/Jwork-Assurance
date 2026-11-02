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
    motifBlocage: z.string().nullish(),
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
    // Only legacy "all" archives may omit policyKeys; new numbered archives send an explicit null for all policies.
    z.object({ ...archiveFields, id: z.literal("all"), policyKeys: z.null().optional() })
      .transform(archive => ({ ...archive, policyKeys: null })),
    z.object({ ...archiveFields, id: z.string().regex(/^[0-9]+$/), policyKeys: z.array(z.string()).min(1).nullable() }),
  ])),
});

export function normalizePremiumReceiptOptions(value: unknown): PremiumReceiptOptions {
  const result = optionsSchema.safeParse(value);
  if (!result.success) {
    throw new Error("La réponse des quittances de prime est incomplète. Vérifiez que le backend est à jour.");
  }
  return result.data;
}

export function premiumReceiptPolicyBlockReason(policy: PremiumReceiptOptions["policies"][number]): string | undefined {
  return policy.eligible ? undefined : policy.motifBlocage?.trim() || "Quittance indisponible pour cette police.";
}

export function premiumReceiptBlockReason({ policies, keys, hasArchive, canIssue, cancelled, hasRejectedInstrument }: {
  policies: PremiumReceiptOptions["policies"];
  keys?: string[];
  hasArchive: boolean;
  canIssue: boolean;
  cancelled: boolean;
  hasRejectedInstrument: boolean;
}): string | undefined {
  if (cancelled) return "Le règlement est annulé.";
  if (keys !== undefined && keys.length === 0) return "Sélectionnez au moins une police éligible.";
  if (hasArchive) return undefined;
  if (!canIssue) return "Vous ne disposez pas de l'autorisation d'émettre une quittance.";
  if (policies.length === 0) return "Aucune prime n'est affectée à ce règlement.";
  if (keys === undefined && hasRejectedInstrument) return "Le règlement contient un moyen de paiement rejeté.";
  const selected = keys === undefined ? policies : policies.filter(policy => keys.includes(policy.key));
  if (keys !== undefined && selected.length !== keys.length) {
    return "Une police sélectionnée n'appartient plus à ce règlement.";
  }
  const reasons = selected.map(premiumReceiptPolicyBlockReason).filter(Boolean);
  return reasons.length > 0 ? [...new Set(reasons)].join(" ") : undefined;
}
