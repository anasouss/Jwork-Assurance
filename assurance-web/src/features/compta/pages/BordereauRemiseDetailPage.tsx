import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Landmark, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type { CashRemittanceLine, RemittanceSlipLine } from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel, TODAY } from "./treasury-format";

const STATUS_LABELS = {
  BROUILLON: "Provisoire",
  DEPOSE: "Remis à la banque",
  PARTIELLEMENT_TRAITE: "Remis à la banque",
  CLOTURE: "Clôturé",
  ANNULE: "Annulé",
} as const;

const LINE_STATUS_LABELS = {
  PREPAREE: "Préparée",
  REMISE: "Remise",
  ENCAISSEE: "Encaissée",
  REJETEE: "Impayée",
} as const;

export default function BordereauRemiseDetailPage() {
  const { bordereauId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositDate, setDepositDate] = useState(TODAY);
  const [depositReference, setDepositReference] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lineToRemove, setLineToRemove] = useState<RemittanceSlipLine>();

  const slip = useQuery({
    queryKey: ["compta", "treasury", "remittance-slip", bordereauId],
    queryFn: () => comptaApi.remittanceSlip(bordereauId),
    enabled: Boolean(bordereauId),
  });

  const deposit = useMutation({
    mutationFn: () => comptaApi.depositRemittanceSlip(bordereauId, {
      dateDepot: depositDate,
      referenceBancaire: depositReference.trim(),
    }),
    onSuccess: async () => {
      toast.success("Bordereau validé");
      setDepositOpen(false);
      await invalidate();
    },
    onError: showError,
  });
  const deleteDraft = useMutation({
    mutationFn: () => comptaApi.deleteRemittanceSlipDraft(bordereauId),
    onSuccess: async () => {
      toast.success("Bordereau provisoire supprimé");
      setDeleteOpen(false);
      navigate("/app/compta/tresorerie/bordereaux-remise", { replace: true });
      await invalidate();
    },
    onError: showError,
  });
  const removeLine = useMutation({
    mutationFn: () => comptaApi.removeRemittanceSlipLine(bordereauId, lineToRemove!.id),
    onSuccess: async () => {
      toast.success("Instrument retiré du bordereau provisoire");
      setLineToRemove(undefined);
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

  async function previewPdf() {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      toast.error("Autorisez les fenêtres contextuelles pour ouvrir le PDF");
      return;
    }
    previewWindow.opener = null;
    setPdfLoading(true);
    try {
      const blob = await comptaApi.remittanceSlipPdf(bordereauId);
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow.close();
      showError(error);
    } finally {
      setPdfLoading(false);
    }
  }

  if (slip.isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Chargement du bordereau…</div>;
  }
  if (!slip.data) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Bordereau introuvable.</div>;
  }

  const data = slip.data;
  const instrumentSlip = data.type !== "VERSEMENT_ESPECES";
  const cashDays = groupCashLines(data.lignesEspeces);
  const statusTone: SummaryTone = data.statut === "ANNULE"
    ? "danger"
    : data.statut === "CLOTURE"
      ? "success"
      : data.statut === "BROUILLON"
        ? "muted"
        : "info";

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" className="mb-2 -ml-3"><Link to="/app/compta/tresorerie/bordereaux-remise"><ArrowLeft className="size-4" /> Retour aux bordereaux</Link></Button>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">{data.numero}</h1>
          <p className="text-sm text-muted-foreground">
            {data.type === "CHEQUE" ? "Bordereau de chèques" : data.type === "EFFET" ? "Bordereau d’effets" : "Versement d’espèces"}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={pdfLoading} onClick={previewPdf}>
            <Printer className="size-4" />
            {pdfLoading ? "Génération..." : "Imprimer le PDF"}
          </Button>
          {data.statut === "BROUILLON" && <>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={!canManage || deleteDraft.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> Supprimer
            </Button>
            <Button disabled={!canManage || (instrumentSlip && data.lignes.length === 0)} onClick={() => {
              setDepositReference(data.referenceBancaire ?? "");
              setDepositOpen(true);
            }}><CheckCircle2 className="size-4" /> Valider le bordereau</Button>
          </>}
          {(data.operationTresorerieId || data.lignesEspeces.some((line) => line.operationTresorerieId)) && <Button asChild variant="outline"><Link to={`/app/compta/tresorerie/operations?search=${data.numero}`}><Landmark className="size-4" /> Voir les opérations</Link></Button>}
        </div>
      </header>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-2 lg:grid-cols-5">
        <Summary label="Statut" value={STATUS_LABELS[data.statut]} tone={statusTone} />
        <Summary label="Date" value={formatTreasuryDate(data.dateBordereau)} />
        <Summary label="Remis le" value={formatTreasuryDate(data.dateDepot)} />
        <Summary label="Destination" value={data.compteDestination} tone="info" />
        <Summary label="Montant total" value={formatTreasuryMoney(data.montantTotal)} strong tone="success" />
      </section>

      {(data.referenceBancaire || data.notes) && <section className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-2">
        <div><div className="text-xs uppercase text-muted-foreground">N° bordereau banque</div><div className="mt-1 font-medium">{data.referenceBancaire || "-"}</div></div>
        <div><div className="text-xs uppercase text-muted-foreground">Notes</div><div className="mt-1 whitespace-pre-wrap">{data.notes || "-"}</div></div>
      </section>}

      {instrumentSlip && <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b bg-muted/30 px-4 py-3"><h2 className="font-semibold">Instruments du bordereau</h2><p className="text-sm text-muted-foreground">Chaque ligne conserve son état de remise et son résultat bancaire. Le traitement s’effectue depuis les encaissements en attente.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-orange-600 text-xs uppercase text-white"><tr>
            <th className="px-4 py-3 text-left">Référence</th><th className="px-4 py-3 text-left">Payeur</th>
            <th className="px-4 py-3 text-left">Règlement</th><th className="px-4 py-3 text-left">Mode</th>
            <th className="px-4 py-3 text-left">{data.type === "CHEQUE" ? "Date portée" : "Échéance"}</th><th className="px-4 py-3 text-right">Montant</th>
            <th className="px-4 py-3 text-left">Statut</th><th className="px-4 py-3 text-right">Action</th>
          </tr></thead>
          <tbody className="divide-y">{data.lignes.map((line) => <tr key={line.id} className="hover:bg-muted/30">
            <td className="px-4 py-3 font-semibold">{line.referenceInstrument || "-"}</td><td className="px-4 py-3">{line.payeur}</td>
            <td className="px-4 py-3">{line.numeroReglement}</td><td className="px-4 py-3">{paymentModeLabel(line.mode)}</td>
            <td className="px-4 py-3">{formatTreasuryDate(line.dateEcheance)}</td><td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(line.montant)}</td>
            <td className="px-4 py-3"><div>{LINE_STATUS_LABELS[line.statut]}</div>{line.motifRejet && <div className="text-xs text-red-600">{line.motifRejet}</div>}</td>
            <td className="px-4 py-3 text-right">
              {data.statut === "BROUILLON" && line.statut === "PREPAREE" && canManage ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  title="Retirer du bordereau"
                  aria-label={`Retirer ${line.referenceInstrument || "l'instrument"} du bordereau`}
                  onClick={() => setLineToRemove(line)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : "-"}
            </td>
          </tr>)}
          {data.lignes.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Aucun instrument dans ce bordereau provisoire.</td></tr>
          )}</tbody>
        </table></div>
      </section>}

      {!instrumentSlip && <section className="overflow-hidden rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
          <div><h2 className="font-semibold">Journées de caisse</h2><p className="text-sm text-muted-foreground">Encaissements inclus dans ce versement bancaire.</p></div>
          <div className="text-right"><div className="text-xs uppercase text-muted-foreground">Destination</div><div className="font-medium">{data.compteDestination}</div></div>
        </div>
        {cashDays.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead className="bg-emerald-700 text-xs uppercase text-white"><tr>
            <th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Caisse</th>
            <th className="px-4 py-3 text-left">Caissier</th><th className="px-4 py-3 text-center">Encaissements</th>
            <th className="px-4 py-3 text-right">Montant</th><th className="px-4 py-3 text-left">Transfert</th>
          </tr></thead>
          <tbody className="divide-y">{cashDays.map((day) => <tr key={day.key}>
            <td className="px-4 py-3 font-medium">{formatTreasuryDate(day.dateJournee)}</td>
            <td className="px-4 py-3">{day.compteSource}</td><td className="px-4 py-3">{day.caissier || "-"}</td>
            <td className="px-4 py-3 text-center">{day.count}</td><td className="px-4 py-3 text-right font-semibold">{formatTreasuryMoney(day.montant)}</td>
            <td className="px-4 py-3">{day.operationTresorerieId ? "Enregistré" : "À enregistrer"}</td>
          </tr>)}</tbody>
        </table></div> : <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Summary label="Caisse source" value={data.compteSource || "-"} />
          <Summary label="Compte bancaire" value={data.compteDestination} />
          <Summary label="N° bordereau banque" value={data.referenceBancaire || "-"} />
        </div>}
      </section>}

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Valider le bordereau</DialogTitle><DialogDescription>{instrumentSlip ? "Les instruments passeront au statut remis en banque." : "Le transfert de la caisse vers la banque sera enregistré."}</DialogDescription></DialogHeader>
          <div className="grid gap-4"><div className="grid gap-2"><Label>Date de remise</Label><DatePicker date={depositDate} onSelect={(value) => setDepositDate(toDateOnly(value) ?? "")} /></div>
            <div className="grid gap-2"><Label htmlFor="deposit-reference">N° bordereau banque *</Label><Input id="deposit-reference" value={depositReference} onChange={(event) => setDepositReference(event.target.value)} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setDepositOpen(false)}>Annuler</Button><Button disabled={!depositDate || !depositReference.trim() || deposit.isPending} onClick={() => deposit.mutate()}>{deposit.isPending ? "Validation en cours..." : "Valider le bordereau"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bordereau provisoire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette préparation sera supprimée définitivement. Les instruments redeviendront disponibles pour un autre bordereau.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDraft.isPending}>Retour</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDraft.isPending}
              onClick={() => deleteDraft.mutate()}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(lineToRemove)} onOpenChange={(open) => !open && setLineToRemove(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer cet instrument du bordereau ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le bordereau restera provisoire et l’instrument redeviendra disponible pour une autre remise.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeLine.isPending}>Retour</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeLine.isPending}
              onClick={() => removeLine.mutate()}
            >
              Retirer du bordereau
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

type SummaryTone = "default" | "muted" | "info" | "success" | "danger";

function groupCashLines(lines: CashRemittanceLine[]) {
  const grouped = new Map<string, {
    key: string;
    dateJournee: string;
    compteSource: string;
    caissier?: string | null;
    count: number;
    montant: number;
    operationTresorerieId?: string | null;
  }>();
  lines.forEach((line) => {
    const key = `${line.compteSourceId}:${line.dateJournee}`;
    const current = grouped.get(key);
    if (current) {
      current.count += 1;
      current.montant += line.montant;
      current.operationTresorerieId ??= line.operationTresorerieId;
    } else {
      grouped.set(key, {
        key,
        dateJournee: line.dateJournee,
        compteSource: line.compteSource,
        caissier: line.caissier,
        count: 1,
        montant: line.montant,
        operationTresorerieId: line.operationTresorerieId,
      });
    }
  });
  return [...grouped.values()].sort((left, right) =>
    right.dateJournee.localeCompare(left.dateJournee)
      || left.compteSource.localeCompare(right.compteSource)
  );
}

const SUMMARY_TONE_CLASSES: Record<SummaryTone, string> = {
  default: "",
  muted: "bg-slate-50/80 dark:bg-slate-900/40",
  info: "bg-sky-50/70 dark:bg-sky-950/25",
  success: "bg-emerald-50/70 dark:bg-emerald-950/25",
  danger: "bg-red-50/70 dark:bg-red-950/25",
};

function Summary({
  label,
  value,
  strong = false,
  tone = "default",
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: SummaryTone;
}) {
  return <div className={`min-w-0 border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${SUMMARY_TONE_CLASSES[tone]}`}><div className="text-xs uppercase text-muted-foreground">{label}</div><div className={`mt-1 truncate ${strong ? "text-lg font-semibold" : "font-medium"}`}>{value}</div></div>;
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
