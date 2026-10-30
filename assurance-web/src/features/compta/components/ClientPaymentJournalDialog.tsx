import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateOnly } from "@/features/production/date";
import { comptaApi } from "../api";
import type { ClientPayment, ClientPaymentMode } from "../types";

const modes: Record<ClientPaymentMode, string> = {
  ESPECES: "Espèces", CHEQUE: "Chèque", EFFET: "Effet",
  VIREMENT: "Virement", VERSEMENT_BANCAIRE: "Versement bancaire",
};

export function ClientPaymentJournalDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reportDate, setReportDate] = useState(() => toDateOnly(new Date())!);
  const [userId, setUserId] = useState("ALL");
  const [mode, setMode] = useState<ClientPaymentMode | "ALL">("ALL");
  const [status, setStatus] = useState<ClientPayment["statut"] | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const users = useQuery({
    queryKey: ["compta", "client-payment-journal-users"],
    queryFn: comptaApi.clientPaymentJournalUsers,
    enabled: open,
  });

  async function previewJournal() {
    if (loading) return;
    if (!reportDate) {
      toast.error("Renseignez la date de l’état d’encaissement");
      return;
    }
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Autorisez les fenêtres contextuelles pour ouvrir le PDF");
      return;
    }
    previewWindow.opener = null;
    setLoading(true);
    try {
      const blob = await comptaApi.clientPaymentJournalPdf({
        dateDu: reportDate,
        dateAu: reportDate,
        utilisateurId: userId === "ALL" ? undefined : userId,
        mode: mode === "ALL" ? undefined : mode,
        statut: status === "ALL" ? undefined : status,
      });
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow.close();
      toast.error(error instanceof Error ? error.message : "Génération de l’état impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>État d’encaissement journalier</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Date de l’état</Label>
            <DatePicker date={reportDate} onSelect={(date) => setReportDate(toDateOnly(date) ?? "")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="journal-user">Utilisateur</Label>
            <Select value={userId} onValueChange={setUserId} disabled={users.isLoading}>
              <SelectTrigger id="journal-user"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les utilisateurs</SelectItem>
                {(users.data ?? []).map((user) => <SelectItem key={user.id} value={user.id}>
                  {user.nomComplet}{user.actif ? "" : " (inactif)"}
                </SelectItem>)}
              </SelectContent>
            </Select>
            {users.isError ? <div role="alert" className="text-xs text-destructive">
              Chargement des utilisateurs impossible.
              <Button type="button" variant="link" size="sm" onClick={() => void users.refetch()}>Réessayer</Button>
            </div> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="journal-mode">Mode de règlement</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as ClientPaymentMode | "ALL")}>
              <SelectTrigger id="journal-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les modes</SelectItem>
                {Object.entries(modes).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="journal-status">Statut du règlement</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as ClientPayment["statut"] | "ALL")}>
              <SelectTrigger id="journal-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="VALIDE">Enregistrés</SelectItem>
                <SelectItem value="ANNULE">Annulés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button type="button" disabled={loading || !reportDate} onClick={() => void previewJournal()}>
            <Printer className="size-4" />{loading ? "Génération..." : "Imprimer l’état PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
