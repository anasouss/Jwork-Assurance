import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import type { ClientPayment, PremiumReceiptOptions } from "../types";

type Archive = PremiumReceiptOptions["archives"][number];

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
  const keys = scope === "ALL" ? undefined : policies.filter(p => selected.has(p.key)).map(p => p.key);
  const existing = options.data?.archives.find(archive => keys === undefined
    ? archive.policyKeys === null
    : archive.policyKeys !== null && archive.policyKeys.length === keys.length && archive.policyKeys.every(key => keys.includes(key)));

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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Quittance de prime</DialogTitle>
          <DialogDescription>{payment.numero} · {payment.payeurNom}</DialogDescription>
        </DialogHeader>
        {options.isPending ? <p className="py-6 text-sm text-muted-foreground">Chargement des polices...</p>
          : options.isError ? <div role="alert" className="space-y-3 text-sm">
            <p>{options.error instanceof Error ? options.error.message : "Chargement impossible"}</p>
            <Button variant="outline" onClick={() => void options.refetch()}>Réessayer</Button>
          </div> : <>
            <RadioGroup value={scope} onValueChange={setScope} disabled={opening} className="flex flex-wrap gap-x-6 gap-y-3">
              <div className="flex items-center gap-2"><RadioGroupItem id="receipt-all" value="ALL" /><Label htmlFor="receipt-all">Toutes les polices</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem id="receipt-specific" value="SPECIFIC" /><Label htmlFor="receipt-specific">Polices spécifiques</Label></div>
            </RadioGroup>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr>
                  {scope === "SPECIFIC" && <th className="w-10 p-3">
                    <Checkbox aria-label="Sélectionner toutes les polices" disabled={opening || policies.length === 0}
                      checked={policies.length > 0 && policies.every(p => selected.has(p.key)) ? true : policies.some(p => selected.has(p.key)) ? "indeterminate" : false}
                      onCheckedChange={checked => setSelected(checked === true ? new Set(policies.map(p => p.key)) : new Set())} />
                  </th>}
                  <th className="p-3 text-left">Police / assureur</th><th className="p-3 text-right">Montant affecté</th>
                </tr></thead>
                <tbody className="divide-y">{policies.map(policy => <tr key={policy.key} className={scope === "ALL" || selected.has(policy.key) ? "bg-primary/5" : ""}>
                  {scope === "SPECIFIC" && <td className="p-3 align-top">
                    <Checkbox id={`receipt-${policy.key}`} disabled={opening} checked={selected.has(policy.key)} onCheckedChange={checked => toggle(policy.key, checked === true)} aria-label={`Sélectionner ${policy.descriptions.join(", ")}`} />
                  </td>}
                  <td className="p-3">
                    <label htmlFor={scope === "SPECIFIC" ? `receipt-${policy.key}` : undefined} className="block cursor-pointer whitespace-pre-line break-words">
                      {policy.descriptions.join("\n")}
                      {policy.key.startsWith("D:") && <span className="mt-1 block text-xs text-muted-foreground">Affectation globale au document</span>}
                    </label>
                  </td>
                  <td className="whitespace-nowrap p-3 text-right align-top font-medium tabular-nums">{formatAccountingAmount(policy.montant)}</td>
                </tr>)}</tbody>
              </table>
              {policies.length === 0 && <p className="px-3 py-5 text-sm text-muted-foreground">Aucune police affectée à ce règlement.</p>}
            </div>
            {(options.data?.archives.length ?? 0) > 0 && <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-semibold">Quittances émises</h3>
              <ul className="divide-y">{options.data?.archives.map(archive => <li key={archive.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 text-sm"><span className="font-medium">N° {archive.numero}</span>
                  <span className="block text-xs text-muted-foreground">{archive.dateEmission?.split("-").reverse().join("/")} · {archive.policyKeys === null ? "Toutes les polices" : "Sélection de polices"}</span>
                  {archive.policyKeys !== null && <span className="block break-words text-xs text-muted-foreground">
                    {archive.policyKeys.map(key => policies.find(policy => policy.key === key)?.descriptions[0]?.split("\n")[0]).filter(Boolean).join(" · ") || "Sélection archivée"}
                  </span>}
                </div>
                <Button variant="ghost" size="icon" title={`Ouvrir la quittance ${archive.numero}`} aria-label={`Ouvrir la quittance ${archive.numero}`} disabled={opening} onClick={() => void openPdf(archive)}><Printer className="size-4" /></Button>
              </li>)}</ul>
            </section>}
          </>}
        <DialogFooter>
          <Button variant="outline" disabled={opening} onClick={onClose}>Fermer</Button>
          <Button disabled={opening || !options.data || options.isError || (keys !== undefined && keys.length === 0) || (!existing && !canIssue)} onClick={() => void openPdf(existing)}>
            <FileText className="size-4" />{opening ? "Ouverture..." : existing ? "Ouvrir la quittance" : "Émettre la quittance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
