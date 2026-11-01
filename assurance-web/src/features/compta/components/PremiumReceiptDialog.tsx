import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive as ArchiveIcon, CornerDownRight, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import { formatTreasuryDate } from "../pages/treasury-format";
import type { ClientPayment, PremiumReceiptOptions } from "../types";

type Archive = PremiumReceiptOptions["archives"][number];
type Policy = PremiumReceiptOptions["policies"][number];
type Movement = Policy["mouvements"][number];

export function PremiumReceiptDialog({ payment, canIssue, onClose }: {
  payment: ClientPayment;
  canIssue: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opening, setOpening] = useState(false);
  const options = useQuery({
    queryKey: ["compta", "client-payments", payment.id, "premium-receipts"],
    queryFn: () => comptaApi.premiumReceiptOptions(payment.id),
  });
  const policies = options.data?.policies ?? [];
  const eligiblePolicies = policies.filter(policy => policy.eligible);
  const keys = scope === "ALL" ? undefined : policies.filter(p => selected.has(p.key)).map(p => p.key);
  const existing = options.data?.archives.find(archive => keys === undefined
    ? archive.policyKeys === null
    : archive.policyKeys !== null && archive.policyKeys.length === keys.length && archive.policyKeys.every(key => keys.includes(key)));
  const canIssueSelection = scope === "ALL"
    ? policies.length > 0 && policies.every(policy => policy.eligible)
      && payment.instruments.filter(instrument => instrument.statut !== "REMPLACE").every(instrument => instrument.statut === "CONFIRME")
    : policies.some(policy => selected.has(policy.key)) && policies.filter(policy => selected.has(policy.key)).every(policy => policy.eligible);

  function toggle(key: string, checked: boolean) {
    setSelected(current => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function openPdf(archive?: Archive) {
    const preview = window.open("about:blank", "_blank");
    if (!preview) {
      toast.error("Autorisez les fenêtres contextuelles pour ouvrir le PDF");
      return;
    }
    preview.opener = null;
    setOpening(true);
    try {
      const blob = archive
        ? archive.id === "all"
          ? await comptaApi.premiumReceiptPdf(payment.id)
          : await comptaApi.selectedPremiumReceiptPdf(payment.id, archive.id)
        : await comptaApi.premiumReceiptPdf(payment.id, true, keys);
      const url = URL.createObjectURL(blob);
      preview.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      await queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] });
    } catch (error) {
      preview.close();
      toast.error(error instanceof Error ? error.message : "Ouverture de la quittance impossible");
    } finally {
      setOpening(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !opening) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b bg-emerald-50/70 p-5 pr-12 text-left dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white"><FileText className="size-5" /></div>
            <div className="min-w-0">
              <DialogTitle>Quittance de prime</DialogTitle>
              <DialogDescription className="mt-1 break-words">{payment.numero} · {payment.payeurNom}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5">
        {options.isPending ? <p className="py-6 text-sm text-muted-foreground">Chargement des polices...</p>
          : options.isError ? <div role="alert" className="space-y-3 text-sm">
            <p>{options.error instanceof Error ? options.error.message : "Chargement impossible"}</p>
            <Button variant="outline" onClick={() => void options.refetch()}>Réessayer</Button>
          </div> : <>
            <RadioGroup value={scope} onValueChange={setScope} disabled={opening} className="flex flex-wrap gap-x-6 gap-y-3 border-b pb-4">
              <div className="flex items-center gap-2"><RadioGroupItem id="receipt-all" value="ALL" /><Label htmlFor="receipt-all">Toutes les polices</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem id="receipt-specific" value="SPECIFIC" /><Label htmlFor="receipt-specific">Polices spécifiques</Label></div>
            </RadioGroup>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
                  <th className="p-3 text-left">
                    <div className="flex items-center gap-3">
                    {scope === "SPECIFIC" && <Checkbox aria-label="Sélectionner toutes les polices réglées" disabled={opening || eligiblePolicies.length === 0}
                      checked={eligiblePolicies.length > 0 && eligiblePolicies.every(p => selected.has(p.key)) ? true : eligiblePolicies.some(p => selected.has(p.key)) ? "indeterminate" : false}
                      onCheckedChange={checked => setSelected(checked === true ? new Set(eligiblePolicies.map(p => p.key)) : new Set())} />}
                    Mouvement / prestation
                    </div>
                  </th>
                  <th className="w-32 p-3 text-left">Du / Au</th>
                  <th className="w-32 p-3 text-right">Prime TTC</th>
                  <th className="w-40 p-3 text-right">État</th>
                </tr></thead>
                <tbody className="divide-y">{policies.map(policy => <Fragment key={policy.key}>
                  <tr className={policy.eligible && (scope === "ALL" || selected.has(policy.key))
                    ? "bg-emerald-50 dark:bg-emerald-950/25" : "bg-muted/40"}>
                    <td colSpan={4} className="p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          {scope === "SPECIFIC" && <Checkbox id={`receipt-${policy.key}`} className="mt-1" disabled={opening || !policy.eligible} checked={selected.has(policy.key)} onCheckedChange={checked => toggle(policy.key, checked === true)} aria-label={`Sélectionner ${policy.descriptions.join(", ")}`} />}
                          <div className="min-w-0">
                            <label htmlFor={scope === "SPECIFIC" ? `receipt-${policy.key}` : undefined} className="block whitespace-pre-line break-words font-semibold">
                              {policy.descriptions.join("\n")}
                            </label>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {policy.mouvements.length > 0 ? `${policy.mouvements.length} mouvement${policy.mouvements.length > 1 ? "s" : ""}` : "Détail indisponible"}
                              {policy.key.startsWith("D:") ? " · Affectation globale au document" : ""}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 space-y-1.5 text-right">
                          <div className="font-semibold tabular-nums">{formatAccountingAmount(policy.montant)}</div>
                          <PolicyState policy={policy} />
                        </div>
                      </div>
                    </td>
                  </tr>
                  {policy.mouvements.map(movement => <tr key={`${movement.documentClientId ?? "direct"}:${movement.elementFacturableId}`} className="bg-background hover:bg-muted/20">
                    <td className="p-3">
                      <div className="flex items-start gap-2 pl-2"><CornerDownRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="break-words">{movement.libelle}</span></div>
                    </td>
                    <td className="whitespace-nowrap p-3 text-xs tabular-nums">
                      <div>{formatTreasuryDate(movement.dateDebut)}</div>
                      <div className="mt-1 text-muted-foreground">{formatTreasuryDate(movement.dateFin)}</div>
                    </td>
                    <td className="whitespace-nowrap p-3 text-right font-medium tabular-nums">{formatAccountingAmount(movement.montant)}</td>
                    <td className="p-3 text-right"><MovementState movement={movement} /></td>
                  </tr>)}
                </Fragment>)}</tbody>
              </table>
              {policies.length === 0 && <p className="px-3 py-5 text-sm text-muted-foreground">Aucune police affectée à ce règlement.</p>}
            </div>
            {(options.data?.archives.length ?? 0) > 0 && <section className="space-y-2 border-t pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><ArchiveIcon className="size-4 text-sky-700 dark:text-sky-400" />Quittances émises <Badge variant="info">Archives</Badge></h3>
              <ul className="divide-y">{options.data?.archives.map(archive => <li key={archive.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 text-sm"><span className="font-medium">N° {archive.numero}</span>
                  <span className="block text-xs text-muted-foreground">{archive.dateEmission?.split("-").reverse().join("/")} · {archive.policyKeys === null ? "Toutes les polices" : "Sélection de polices"}</span>
                  {archive.policyKeys !== null && <span className="block break-words text-xs text-muted-foreground">
                    {archive.policyKeys.map(key => policies.find(policy => policy.key === key)?.descriptions[0]?.split("\n")[0]).filter(Boolean).join(" · ") || "Sélection archivée"}
                  </span>}
                </div>
                <Button variant="outline" size="icon" className="shrink-0" title={`Ouvrir l'archive ${archive.numero}`} aria-label={`Ouvrir l'archive ${archive.numero}`} disabled={opening} onClick={() => void openPdf(archive)}><Printer className="size-4" /></Button>
              </li>)}</ul>
            </section>}
          </>}
        </div>
        <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-4">
          <Button variant="outline" disabled={opening} onClick={onClose}>Fermer</Button>
          <Button disabled={opening || !options.data || options.isError || (keys !== undefined && keys.length === 0) || (!existing && (!canIssue || !canIssueSelection))} onClick={() => void openPdf(existing)}>
            {existing ? <Printer className="size-4" /> : <FileText className="size-4" />}{opening ? "Ouverture..." : existing ? "Ouvrir l'archive" : "Émettre la quittance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PolicyState({ policy }: { policy: Policy }) {
  if (policy.eligible) return <Badge variant="success">Éligible</Badge>;
  if (policy.mouvements.some(movement => movement.statut === "EN_ATTENTE_ENCAISSEMENT")) {
    return <Badge variant="info">Encaissement en attente</Badge>;
  }
  return <Badge variant="warning">Non éligible</Badge>;
}

function MovementState({ movement }: { movement: Movement }) {
  if (movement.statut === "REGLEE") return <Badge variant="success">Réglé</Badge>;
  if (movement.statut === "EN_ATTENTE_ENCAISSEMENT") return <Badge variant="info">En attente</Badge>;
  return <Badge variant="warning">Non soldé</Badge>;
}
