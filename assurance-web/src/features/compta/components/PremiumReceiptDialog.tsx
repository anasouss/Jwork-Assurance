import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive as ArchiveIcon, ChevronDown, ChevronRight, CornerDownRight, FileText, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { comptaApi } from "../api";
import { formatAccountingAmount } from "../format";
import { premiumReceiptBlockReason, premiumReceiptPolicyBlockReason } from "../premium-receipt-options";
import { formatTreasuryDate } from "../pages/treasury-format";
import type { ClientPayment, PremiumReceiptOptions } from "../types";
import { useAuthStore } from "@/store/auth-store";

type Archive = PremiumReceiptOptions["archives"][number];
type Policy = PremiumReceiptOptions["policies"][number];
type Movement = Policy["mouvements"][number];

export function PremiumReceiptDialog({ payment, canIssue, onClose }: {
  payment: ClientPayment;
  canIssue: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canDelete = useAuthStore(state => state.user?.permissions?.includes("reglement-client:manage") ?? false);
  const [scope, setScope] = useState("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opening, setOpening] = useState(false);
  const [archiveToDelete, setArchiveToDelete] = useState<Archive>();
  const deleteArchive = useMutation({
    mutationFn: (archive: Archive) => comptaApi.deletePremiumReceipt(payment.id, archive.id),
    onSuccess: async (_result, archive) => {
      queryClient.setQueryData<PremiumReceiptOptions>(["compta", "client-payments", payment.id, "premium-receipts"], current =>
        current ? { ...current, archives: current.archives.filter(item => item.id !== archive.id) } : current);
      setArchiveToDelete(undefined);
      toast.success("Archive de quittance supprimée");
      await queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] });
    },
    onError: error => toast.error(error instanceof Error ? error.message : "Suppression de l'archive impossible"),
  });
  const busy = opening || deleteArchive.isPending;
  const options = useQuery({
    queryKey: ["compta", "client-payments", payment.id, "premium-receipts"],
    queryFn: () => comptaApi.premiumReceiptOptions(payment.id),
  });
  const policies = options.data?.policies ?? [];
  const movements = policies.flatMap(policy => policy.mouvements);
  const assistanceOnly = movements.length > 0 && movements.every(movement => movement.assistance === true);
  const insuranceOnly = movements.length > 0 && movements.every(movement => movement.assistance === false);
  const referenceHeading = assistanceOnly ? "N° contrat" : insuranceOnly ? "N° police" : "N° police / contrat";
  const hasExpandablePolicies = policies.some(policy => policy.mouvements.length > 1);
  const showControls = scope === "SPECIFIC" || hasExpandablePolicies;
  const eligiblePolicies = policies.filter(policy => policy.eligible);
  const keys = scope === "ALL" ? undefined : policies.filter(p => selected.has(p.key)).map(p => p.key);
  const existing = options.data?.archives.find(archive => keys === undefined
    ? archive.policyKeys === null
    : archive.policyKeys !== null && archive.policyKeys.length === keys.length && archive.policyKeys.every(key => keys.includes(key)));
  const blockedReason = options.isSuccess ? premiumReceiptBlockReason({
    policies, keys, hasArchive: Boolean(existing), canIssue, cancelled: payment.statut === "ANNULE",
    hasRejectedInstrument: payment.instruments.some(instrument => instrument.statut === "REJETE"),
  }) : undefined;

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
    <Dialog open onOpenChange={open => { if (!open && !busy && !archiveToDelete) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-7xl">
        <DialogHeader className="shrink-0 border-b bg-emerald-50/70 p-5 pr-12 text-left dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white"><FileText className="size-5" /></div>
            <div className="min-w-0">
              <DialogTitle>Quittance de prime</DialogTitle>
              <DialogDescription className="mt-1 break-words">{payment.numero} · {payment.payeurNom}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {options.isSuccess && <RadioGroup value={scope} onValueChange={setScope} disabled={busy} className="flex shrink-0 flex-wrap gap-x-6 gap-y-3 border-b px-4 py-3">
          <div className="flex items-center gap-2"><RadioGroupItem id="receipt-all" value="ALL" /><Label htmlFor="receipt-all">Toutes les polices</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem id="receipt-specific" value="SPECIFIC" /><Label htmlFor="receipt-specific">Polices spécifiques</Label></div>
        </RadioGroup>}
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {options.isPending ? <p className="py-6 text-sm text-muted-foreground">Chargement des polices...</p>
          : options.isError ? <div role="alert" className="space-y-3 text-sm">
            <p>{options.error instanceof Error ? options.error.message : "Chargement impossible"}</p>
            <Button variant="outline" onClick={() => void options.refetch()}>Réessayer</Button>
          </div> : <>
            <div className="min-w-[920px] rounded-md border">
              <table className="w-full table-fixed text-xs">
                <colgroup>
                  {showControls && <col className={scope === "SPECIFIC" ? (hasExpandablePolicies ? "w-16" : "w-8") : "w-11"} />}
                  <col /><col className="w-[13%]" /><col className="w-[14%]" />
                  <col className="w-[18%]" /><col className="w-[11%]" /><col className="w-[9%]" /><col className="w-[13%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-orange-600 text-xs uppercase text-white"><tr>
                  {showControls && <th scope="col" className="rounded-tl-md px-2 py-3 text-left">
                    <span className="sr-only">Sélection et détails</span>
                    {scope === "SPECIFIC" && <Checkbox aria-label="Sélectionner toutes les polices réglées" disabled={busy || eligiblePolicies.length === 0}
                      checked={eligiblePolicies.length > 0 && eligiblePolicies.every(p => selected.has(p.key)) ? true : eligiblePolicies.some(p => selected.has(p.key)) ? "indeterminate" : false}
                      onCheckedChange={checked => setSelected(checked === true ? new Set(eligiblePolicies.map(p => p.key)) : new Set())} />}
                  </th>}
                  <th scope="col" className={`px-2 py-3 text-left ${showControls ? "" : "rounded-tl-md"}`}>Client</th>
                  <th scope="col" className="px-2 py-3 text-left">{referenceHeading}</th>
                  <th scope="col" className="px-2 py-3 text-left">Compagnie</th>
                  <th scope="col" className="px-2 py-3 text-left">Mouvement / prestation</th>
                  <th scope="col" className="px-2 py-3 text-left">Du / Au</th>
                  <th scope="col" className="px-2 py-3 text-right">Prime TTC</th>
                  <th scope="col" className="rounded-tr-md px-2 py-3 text-right">Situation</th>
                </tr></thead>
                {policies.map(policy => <PolicyRows key={policy.key} policy={policy} scope={scope} busy={busy} showControls={showControls}
                  selected={selected.has(policy.key)} onSelect={checked => toggle(policy.key, checked)} />)}
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
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="icon" title={`Ouvrir l'archive ${archive.numero}`} aria-label={`Ouvrir l'archive ${archive.numero}`} disabled={busy} onClick={() => void openPdf(archive)}><Printer className="size-4" /></Button>
                  {canDelete && <Button variant="ghost" size="icon" className="text-destructive hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/25" title={`Supprimer l'archive ${archive.numero}`} aria-label={`Supprimer l'archive ${archive.numero}`} disabled={busy} onClick={() => setArchiveToDelete(archive)}><Trash2 className="size-4" /></Button>}
                </div>
              </li>)}</ul>
            </section>}
          </>}
        </div>
        <DialogFooter className="shrink-0 gap-3 border-t bg-muted/20 px-5 py-4 sm:items-center sm:justify-between">
          <p role="status" className="min-w-0 text-left text-xs text-muted-foreground sm:mr-auto">{blockedReason}</p>
          <div className="flex shrink-0 justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>Fermer</Button>
          <Button disabled={busy || !options.data || options.isError || Boolean(blockedReason)} onClick={() => void openPdf(existing)}>
            {existing ? <Printer className="size-4" /> : <FileText className="size-4" />}{opening ? "Ouverture..." : existing ? "Ouvrir l'archive" : "Émettre la quittance"}
          </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={Boolean(archiveToDelete)} onOpenChange={open => { if (!open && !deleteArchive.isPending) setArchiveToDelete(undefined); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement cette archive ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le PDF et l'archive N° {archiveToDelete?.numero} seront supprimés. Le règlement, ses affectations et les contrats resteront inchangés. Une nouvelle émission recevra un nouveau numéro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteArchive.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteArchive.isPending || !canDelete} onClick={event => {
              event.preventDefault();
              if (archiveToDelete && canDelete) deleteArchive.mutate(archiveToDelete);
            }}><Trash2 className="size-4" />{deleteArchive.isPending ? "Suppression..." : "Supprimer l'archive"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function PolicyRows({ policy, scope, selected, busy, showControls, onSelect }: {
  policy: Policy; scope: string; selected: boolean; busy: boolean; showControls: boolean; onSelect: (checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const checkboxId = useId();
  const single = policy.mouvements.length === 1 ? policy.mouvements[0] : undefined;
  const multiple = policy.mouvements.length > 1;
  const period = policy.mouvements[0];
  const sharedPeriod = period !== undefined && policy.mouvements.every(movement =>
    movement.dateDebut === period.dateDebut && movement.dateFin === period.dateFin);
  const policyLabel = policy.polices.length ? policy.polices.join("\n") : policy.descriptions.join("\n");
  return <>
    <tbody><tr className={`border-b hover:bg-muted/30 ${policy.eligible && (scope === "ALL" || selected) ? "bg-emerald-50/40 dark:bg-emerald-950/15" : "bg-background"}`}>
      {showControls && <td className="px-2 py-2 align-middle"><div className="flex items-center gap-1">
        {scope === "SPECIFIC" && <Checkbox id={checkboxId} disabled={busy || !policy.eligible} checked={selected}
          onCheckedChange={checked => onSelect(checked === true)} aria-label={`Sélectionner ${policyLabel}`} />}
        {multiple && <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" disabled={busy}
          aria-expanded={expanded} aria-controls={detailId} title={expanded ? "Masquer les mouvements" : "Afficher les mouvements"}
          aria-label={`${expanded ? "Masquer" : "Afficher"} les ${policy.mouvements.length} mouvements de ${policyLabel}`}
          onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</Button>}
      </div></td>}
      <td className="whitespace-pre-line break-words px-2 py-2 font-medium">{policy.clients.join("\n") || "-"}</td>
      <th scope="row" className="whitespace-pre-line break-words px-2 py-2 text-left font-semibold"><label htmlFor={scope === "SPECIFIC" ? checkboxId : undefined}>{policyLabel}</label></th>
      <td className="whitespace-pre-line break-words px-2 py-2">{policy.compagnies.join("\n") || "-"}</td>
      <td className="break-words px-2 py-2">{single?.libelle ?? (multiple ? `${policy.mouvements.length} mouvements` : "Détail indisponible")}
        {policy.key.startsWith("D:") && <div className="mt-1 text-muted-foreground">Affectation globale au document</div>}
      </td>
      <td className="px-2 py-2">{sharedPeriod && period ? <CoverageDates movement={period} /> : <span className="text-muted-foreground">{multiple ? "Périodes multiples" : "-"}</span>}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums">{formatAccountingAmount(policy.montant)}</td>
      <td className="px-2 py-2 text-right"><PolicyState policy={policy} /></td>
    </tr></tbody>
    {multiple && <tbody id={detailId} hidden={!expanded} className="bg-muted/20">{policy.mouvements.map(movement => <tr key={`${movement.documentClientId ?? "direct"}:${movement.elementFacturableId}`} className="border-b">
      {showControls && <td className="px-2 py-2 text-right"><CornerDownRight className="ml-auto size-4 text-muted-foreground" /></td>}
      <td className="break-words px-2 py-2">{movement.clientNom || "-"}</td>
      <td className="break-words px-2 py-2">{movement.numeroPolice || "-"}</td>
      <td className="break-words px-2 py-2">{movement.compagnie || "-"}</td>
      <td className="break-words px-2 py-2">{movement.libelle}</td>
      <td className="px-2 py-2"><CoverageDates movement={movement} /></td>
      <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums">{formatAccountingAmount(movement.montant)}</td>
      <td className="px-2 py-2 text-right"><MovementState movement={movement} /></td>
    </tr>)}</tbody>}
  </>;
}

function CoverageDates({ movement }: { movement: Movement }) {
  return <div className="whitespace-nowrap leading-4 tabular-nums"><div>{formatTreasuryDate(movement.dateDebut)}</div>
    <div className="text-muted-foreground">{formatTreasuryDate(movement.dateFin)}</div></div>;
}

function PolicyState({ policy }: { policy: Policy }) {
  if (policy.eligible) return <Badge variant="success">Éligible</Badge>;
  return <Tooltip><TooltipTrigger asChild><span tabIndex={0} className="inline-flex" aria-label={premiumReceiptPolicyBlockReason(policy)}>
    <Badge variant="warning">Non éligible</Badge>
  </span></TooltipTrigger><TooltipContent className="max-w-72"><p>{premiumReceiptPolicyBlockReason(policy)}</p></TooltipContent></Tooltip>;
}

function MovementState({ movement }: { movement: Movement }) {
  if (movement.statut === "REGLEE" || movement.statut === "EN_ATTENTE_ENCAISSEMENT") return <Badge variant="success">Couvert</Badge>;
  return <Badge variant="warning">Non couvert</Badge>;
}
