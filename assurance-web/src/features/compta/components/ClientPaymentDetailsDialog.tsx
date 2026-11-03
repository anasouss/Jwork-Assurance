import { useQuery } from "@tanstack/react-query";
import { ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { comptaApi } from "../api";
import { ClientPaymentDetails } from "./ClientPaymentDetails";
import { formatTreasuryDate } from "../pages/treasury-format";

export function ClientPaymentDetailsDialog({ paymentId, onClose, closeLabel = "Fermer" }: {
  paymentId: string;
  onClose: () => void;
  closeLabel?: string;
}) {
  const query = useQuery({
    queryKey: ["compta", "client-payment", paymentId],
    queryFn: () => comptaApi.clientPayment(paymentId),
  });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
      <DialogHeader className="shrink-0 border-b bg-orange-50/70 p-5 pr-12 text-left dark:bg-orange-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-orange-600 text-white"><ReceiptText className="size-5" /></div>
            <div className="min-w-0 space-y-1"><DialogTitle>Détail du règlement{query.data ? ` N° ${query.data.numero}` : ""}</DialogTitle>
              <DialogDescription className="sr-only">Détail des productions et encaissements du règlement client.</DialogDescription>
            </div>
          </div>
          {query.data && <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Date du règlement : <span className="font-medium">{formatTreasuryDate(query.data.dateReglement)}</span></span>
            <Badge variant={query.data.statut === "VALIDE" ? "success" : "red"}>{query.data.statut === "VALIDE" ? "Enregistré" : "Annulé"}</Badge>
          </div>}
        </div>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
        {query.isPending ? <div role="status" className="space-y-5"><span className="sr-only">Chargement du règlement...</span><Skeleton className="h-28 w-full" /><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div>
          : query.isError ? <div role="alert" className="space-y-3 py-6 text-sm"><p>{query.error instanceof Error ? query.error.message : "Chargement du règlement impossible."}</p><Button variant="outline" onClick={() => void query.refetch()}>Réessayer</Button></div>
            : <ClientPaymentDetails payment={query.data} />}
      </div>
      <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-4"><Button variant="outline" onClick={onClose}>{closeLabel}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
