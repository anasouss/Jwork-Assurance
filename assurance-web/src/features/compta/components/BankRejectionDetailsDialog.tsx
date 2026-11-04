import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Landmark } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { comptaApi } from "../api";
import { rejectionStatusLabels } from "../bank-rejection-status";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel } from "../pages/treasury-format";
import type { BankRejectionFollowUp } from "../types";

const eventLabels: Record<BankRejectionFollowUp["mouvements"][number]["type"], string> = {
  REJET: "Rejet bancaire", PREPARATION_REMISE: "Nouvelle remise préparée", REMISE_EN_BANQUE: "Remise en banque",
  REMPLACEMENT: "Contre-valeur enregistrée", ENCAISSEMENT: "Encaissement confirmé", SUIVI: "Mouvement de suivi",
};

export function BankRejectionDetailsDialog({ rejectionId, onClose }: { rejectionId: string; onClose: () => void }) {
  const query = useQuery({ queryKey: ["compta", "treasury", "bank-rejections", "occurrence", rejectionId],
    queryFn: () => comptaApi.bankRejectionDetail(rejectionId) });
  const detail = query.data;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
      <DialogHeader className="shrink-0 border-b p-5 pr-12 text-left">
        <div className="flex items-center gap-3">
          <CircleAlert className="size-5 shrink-0 text-red-600" />
          <div className="min-w-0"><DialogTitle>Rejet bancaire{detail ? ` ${detail.numero}` : ""}</DialogTitle>
            <DialogDescription className="mt-1 break-words">{detail
              ? `${paymentModeLabel(detail.mode)} ${detail.referenceInstrument || "-"} · ${detail.payeurNom}`
              : "Détail du rejet"}</DialogDescription></div>
        </div>
      </DialogHeader>
      <div className="min-h-0 space-y-5 overflow-y-auto p-5">
        {query.isPending ? <p className="text-sm text-muted-foreground">Chargement...</p>
          : query.isError ? <div role="alert" className="space-y-3 text-sm"><p>{query.error instanceof Error ? query.error.message : "Chargement impossible"}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>Réessayer</Button></div>
          : detail && <>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[["Date de retour", formatTreasuryDate(detail.dateRejet)], ["Montant (MAD)", formatTreasuryMoney(detail.montant)],
                ["Banque", detail.banque || "-"], ["Opérateur", detail.utilisateur || "-"],
                ["Règlement", detail.numeroReglement]].map(([label, value]) => <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd>
                </div>)}
              <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Motif du rejet</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">{detail.motif}</dd></div>
              {detail.bordereauId && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Remise associée</dt>
                <dd className="mt-1"><Link className="inline-flex items-center gap-1.5 font-medium text-blue-700 hover:underline dark:text-blue-300"
                  to={`/app/compta/tresorerie/bordereaux-remise/${detail.bordereauId}`}>
                  <Landmark className="size-3.5" />{detail.numeroBordereau || "Voir le bordereau"}</Link></dd></div>}
            </dl>
            <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">Mouvements de ce rejet</h3>
              <ol className="divide-y">{detail.mouvements.map(event => <li key={event.id} className="space-y-1 py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{event.libelle || eventLabels[event.type]}</span>
                  <time dateTime={event.date} className="text-xs text-muted-foreground">{formatTreasuryDate(event.date)}</time></div>
                <p className="text-xs text-muted-foreground">{rejectionStatusLabels[event.statut]}</p>
                {event.motif && <p className="whitespace-pre-wrap break-words">{event.motif}</p>}
                {event.utilisateur && <p className="text-xs text-muted-foreground">{event.utilisateur}</p>}
              </li>)}</ol>
              {!detail.mouvements.length && <p className="text-sm text-muted-foreground">Aucun mouvement de suivi enregistré.</p>}
            </section>
          </>}
      </div>
      <DialogFooter className="shrink-0 border-t px-5 py-4"><Button variant="outline" onClick={onClose}>Retour à l’historique</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
