import type { CreateClientPaymentRequest } from "./types";

type Target = {
  elementFacturableId?: string | null;
  documentClientId?: string | null;
  soldeOuvert: number;
  montantRegle: number;
};

export function distributeSettlementAdjustment(targets: Target[], amount: number, reason: string) {
  const requested = Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
  let remaining = requested;
  const ecarts: NonNullable<CreateClientPaymentRequest["ecarts"]> = [];
  for (const target of targets) {
    if (!target.elementFacturableId || target.montantRegle <= 0 || remaining <= 0) continue;
    const capacity = Math.max(0, Math.round(target.soldeOuvert * 100) - Math.round(target.montantRegle * 100));
    const assigned = Math.min(remaining, capacity);
    if (assigned > 0) {
      ecarts.push({ elementFacturableId: target.elementFacturableId, documentClientId: target.documentClientId ?? undefined,
        montant: assigned / 100, motif: reason.trim() });
      remaining -= assigned;
    }
  }
  return { ecarts, unassigned: remaining / 100, total: (requested - remaining) / 100 };
}
