import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CheckCircle2, Landmark, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { RemittanceSlipLine } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY } from "./treasury-format";

const STATUS_LABELS = {
  BROUILLON: "Brouillon",
  DEPOSE: "Déposé",
  PARTIELLEMENT_TRAITE: "Partiellement traité",
  CLOTURE: "Clôturé",
  ANNULE: "Annulé",
} as const;

const LINE_STATUS_LABELS = {
  PREPAREE: "Préparée",
  REMISE: "Remise",
  ENCAISSEE: "Encaissée",
  REJETEE: "Rejetée",
} as const;

export default function BordereauRemiseDetailPage() {
  const { bordereauId = "" } = useParams();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositDate, setDepositDate] = useState(TODAY);
  const [depositReference, setDepositReference] = useState("");
  const [activeLine, setActiveLine] = useState<RemittanceSlipLine>();
  const [lineAction, setLineAction] = useState<"SETTLE" | "REJECT">("SETTLE");
  const [operationDate, setOperationDate] = useState(TODAY);
  const [reason, setReason] = useState("");

  const slip = useQuery({
    queryKey: ["compta", "treasury", "remittance-slip", bordereauId],
    queryFn: () => comptaApi.remittanceSlip(bordereauId),
    enabled: Boolean(bordereauId),
  });

  const deposit = useMutation({
    mutationFn: () => comptaApi.depositRemittanceSlip(bordereauId, {
      dateDepot: depositDate,
      referenceBancaire: depositReference.trim() || undefined,
    }),
    onSuccess: async () => {
      toast.success("Bordereau déposé");
      setDepositOpen(false);
      await invalidate();
    },
    onError: showError,
  });
  const cancel = useMutation({
    mutationFn: () => comptaApi.cancelRemittanceSlip(bordereauId),
    onSuccess: async () => {
      toast.success("Bordereau annulé");
      await invalidate();
    },
    onError: showError,
  });
  const processLine = useMutation({
    mutationFn: () => lineAction === "SETTLE"
      ? comptaApi.settleRemittanceLine(bordereauId, activeLine!.id, operationDate)
      : comptaApi.rejectRemittanceLine(bordereauId, activeLine!.id, {
        dateOperation: operationDate,
        motif: reason.trim(),
      }),
    onSuccess: async () => {
      toast.success(lineAction === "SETTLE" ? "Instrument encaissé" : "Instrument rejeté");
      setActiveLine(undefined);
      setReason("");
      await invalidate();
    },
    onError: showError,
  });

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
      queryClient.invalidateQueries({ queryKey: ["compta", "client-receivables"] }),
      queryClient.invalidateQueries({ queryKey: ["compta", "client-payments"] }),
    ]);
  }

  function openLine(line: RemittanceSlipLine, action: "SETTLE" | "REJECT") {
    setActiveLine(line);
    setLineAction(action);
    setOperationDate(TODAY);
    setReason("");
  }

  if (slip.isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Chargement du bordereau…</div>;
  }
  if (!slip.data) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Bordereau introuvable.</div>;
  }

  const data = slip.data;
  const instrumentSlip = data.type !== "VERSEMENT_ESPECES";

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" className="mb-2 -ml-3"><Link to="/app/compta/tresorerie/bordereaux-remise"><ArrowLeft className="size-4" /> Retour aux bordereaux</Link></Button>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">{data.numero}</h1>
          <p className="text-sm text-muted-foreground">
            {data.type === "CHEQUE" ? "Bordereau de chèques" : data.type === "EFFET" ? "Bordereau d’effets" : "Versement d’espèces"}
          </p>
        </div>
        <div className="flex gap-2">
          {data.statut === "BROUILLON" && <>
            <Button variant="outline" disabled={!canManage || cancel.isPending} onClick={() => cancel.mutate()}>Annuler</Button>
            <Button disabled={!canManage} onClick={() => {
              setDepositReference(data.referenceBancaire ?? "");
              setDepositOpen(true);
            }}><Send className="size-4" /> Marquer comme déposé</Button>
          </>}
          {data.operationTresorerieId && <Button asChild variant="outline"><Link to={`/app/compta/tresorerie/operations?search=${data.numero}`}><Landmark className="size-4" /> Voir l’opération</Link></Button>}
        </div>
      </header>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-2 lg:grid-cols-5">
        <Summary label="Statut" value={STATUS_LABELS[data.statut]} />
        <Summary label="Date" value={formatTreasuryDate(data.dateBordereau)} />
        <Summary label="Dépôt" value={formatTreasuryDate(data.dateDepot)} />
        <Summary label="Destination" value={data.compteDestination} />
        <Summary label="Montant total" value={formatTreasuryMoney(data.montantTotal)} strong />
      </section>

      {(data.referenceBancaire || data.notes) && <section className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-2">
        <div><div className="text-xs uppercase text-muted-foreground">Référence bancaire</div><div className="mt-1 font-medium">{data.referenceBancaire || "-"}</div></div>
        <div><div className="text-xs uppercase text-muted-foreground">Notes</div><div className="mt-1 whitespace-pre-wrap">{data.notes || "-"}</div></div>
      </section>}

      {instrumentSlip && <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Instruments remis</h2><p className="text-sm text-muted-foreground">Chaque ligne conserve son propre résultat d’encaissement.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
            <th className="px-4 py-3 text-left">Référence</th><th className="px-4 py-3 text-left">Payeur</th>
            <th className="px-4 py-3 text-left">Règlement</th><th className="px-4 py-3 text-left">Mode</th>
            <th className="px-4 py-3 text-left">Échéance</th><th className="px-4 py-3 text-right">Montant</th>
            <th className="px-4 py-3 text-left">Statut</th><th className="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody className="divide-y">{data.lignes.map((line) => <tr key={line.id} className="hover:bg-muted/30">
            <td className="px-4 py-3 font-semibold">{line.referenceInstrument || "-"}</td><td className="px-4 py-3">{line.payeur}</td>
            <td className="px-4 py-3">{line.numeroReglement}</td><td className="px-4 py-3">{paymentModeLabel(line.mode)}</td>
            <td className="px-4 py-3">{formatTreasuryDate(line.dateEcheance)}</td><td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(line.montant)}</td>
            <td className="px-4 py-3"><div>{LINE_STATUS_LABELS[line.statut]}</div>{line.motifRejet && <div className="text-xs text-red-600">{line.motifRejet}</div>}</td>
            <td className="px-4 py-3"><div className="flex justify-end gap-2">{line.statut === "REMISE" ? <>
              <Button size="sm" disabled={!canManage} onClick={() => openLine(line, "SETTLE")}><CheckCircle2 className="size-4" /> Encaissé</Button>
              <Button size="sm" variant="outline" disabled={!canManage} onClick={() => openLine(line, "REJECT")}><Ban className="size-4" /> Rejeté</Button>
            </> : <span className="text-muted-foreground">-</span>}</div></td>
          </tr>)}</tbody>
        </table></div>
      </section>}

      {!instrumentSlip && <section className="rounded-md border bg-card p-4">
        <h2 className="font-semibold">Transfert de trésorerie</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Summary label="Caisse source" value={data.compteSource || "-"} />
          <Summary label="Compte bancaire" value={data.compteDestination} />
          <Summary label="Référence bancaire" value={data.referenceBancaire || "-"} />
        </div>
      </section>}

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Confirmer le dépôt</DialogTitle><DialogDescription>{instrumentSlip ? "Les instruments passeront au statut remis en banque." : "Le transfert de la caisse vers la banque sera enregistré."}</DialogDescription></DialogHeader>
          <div className="grid gap-4"><div className="grid gap-2"><Label>Date de dépôt</Label><DatePicker date={depositDate} onSelect={(value) => setDepositDate(toDateOnly(value) ?? "")} /></div>
            <div className="grid gap-2"><Label htmlFor="deposit-reference">Référence bancaire</Label><Input id="deposit-reference" value={depositReference} onChange={(event) => setDepositReference(event.target.value)} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setDepositOpen(false)}>Annuler</Button><Button disabled={!depositDate || deposit.isPending} onClick={() => deposit.mutate()}>Confirmer le dépôt</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeLine)} onOpenChange={(open) => !open && setActiveLine(undefined)}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{lineAction === "SETTLE" ? "Confirmer l’encaissement" : "Enregistrer le rejet"}</DialogTitle><DialogDescription>{activeLine?.referenceInstrument || activeLine?.numeroReglement} · {formatTreasuryMoney(activeLine?.montant ?? 0)}</DialogDescription></DialogHeader>
          <div className="grid gap-4"><div className="grid gap-2"><Label>Date d’opération</Label><DatePicker date={operationDate} onSelect={(value) => setOperationDate(toDateOnly(value) ?? "")} /></div>
            {lineAction === "REJECT" && <div className="grid gap-2"><Label htmlFor="rejection-reason">Motif du rejet</Label><Textarea id="rejection-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></div>}</div>
          <DialogFooter><Button variant="outline" onClick={() => setActiveLine(undefined)}>Annuler</Button><Button disabled={!operationDate || (lineAction === "REJECT" && !reason.trim()) || processLine.isPending} onClick={() => processLine.mutate()}>{lineAction === "SETTLE" ? "Confirmer" : "Enregistrer le rejet"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="min-w-0 border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><div className="text-xs uppercase text-muted-foreground">{label}</div><div className={`mt-1 truncate ${strong ? "text-lg font-semibold" : "font-medium"}`}>{value}</div></div>;
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
