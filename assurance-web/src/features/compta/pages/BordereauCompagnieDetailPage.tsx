import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Check,
  Edit3,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import { formatAccountingAmount, parseAccountingAmount } from "../format";
import type { CompanyBordereauPaymentSummary } from "../types";

const today = new Date().toISOString().slice(0, 10);

export default function BordereauCompagnieDetailPage() {
  const { bordereauId } = useParams();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const queryClient = useQueryClient();
  const [validateOpen, setValidateOpen] = useState(false);
  const [transmitOpen, setTransmitOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [transmissionDate, setTransmissionDate] = useState(today);
  const [transmissionChannel, setTransmissionChannel] = useState("EMAIL");
  const [transmissionReference, setTransmissionReference] = useState("");
  const [ackDate, setAckDate] = useState("");
  const [ackReference, setAckReference] = useState("");
  const [difference, setDifference] = useState("0");
  const [reconciliationNote, setReconciliationNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [instrumentAction, setInstrumentAction] = useState<{
    instrument: CompanyBordereauPaymentSummary;
    status: "CONFIRME" | "REJETE";
  }>();
  const [accountId, setAccountId] = useState("");
  const [operationDate, setOperationDate] = useState(today);
  const [instrumentReason, setInstrumentReason] = useState("");

  const detail = useQuery({
    queryKey: ["compta", "company-bordereau", bordereauId],
    queryFn: () => comptaApi.companyBordereau(bordereauId!),
    enabled: Boolean(bordereauId),
  });
  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["compta", "company-bordereau", bordereauId] }),
      queryClient.invalidateQueries({ queryKey: ["compta", "company-bordereaux"] }),
      queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
    ]);
  };

  const validateBordereau = useMutation({
    mutationFn: () => comptaApi.validateCompanyBordereau(bordereauId!),
    onSuccess: async () => {
      toast.success("Bordereau validé");
      setValidateOpen(false);
      await refresh();
    },
    onError: notifyError,
  });
  const transmit = useMutation({
    mutationFn: () => comptaApi.transmitCompanyBordereau(bordereauId!, {
      dateTransmission: transmissionDate,
      canalTransmission: transmissionChannel,
      referenceTransmission: transmissionReference.trim() || undefined,
    }),
    onSuccess: async () => {
      toast.success("Transmission enregistrée");
      setTransmitOpen(false);
      await refresh();
    },
    onError: notifyError,
  });
  const reconcile = useMutation({
    mutationFn: () => {
      const amount = parseAccountingAmount(difference);
      return comptaApi.reconcileCompanyBordereau(bordereauId!, {
        statut: Math.abs(amount) < 0.005 ? "RAPPROCHE" : "AVEC_ECART",
        ecart: amount,
        note: reconciliationNote.trim() || undefined,
        dateAccuseReception: ackDate || undefined,
        referenceAccuseReception: ackReference.trim() || undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Rapprochement enregistré");
      setReconcileOpen(false);
      await refresh();
    },
    onError: notifyError,
  });
  const cancel = useMutation({
    mutationFn: () => comptaApi.cancelCompanyBordereau(bordereauId!, cancelReason.trim()),
    onSuccess: async () => {
      toast.success("Bordereau annulé");
      setCancelOpen(false);
      await refresh();
    },
    onError: notifyError,
  });
  const changeInstrument = useMutation({
    mutationFn: () => comptaApi.changeCompanyPaymentInstrumentStatus(
      instrumentAction!.instrument.instrumentId,
      {
        statut: instrumentAction!.status,
        compteTresorerieId: instrumentAction!.status === "CONFIRME" ? accountId : undefined,
        dateOperation: operationDate,
        motif: instrumentReason.trim() || undefined,
      }
    ),
    onSuccess: async () => {
      toast.success(instrumentAction?.status === "CONFIRME"
        ? "Sortie bancaire confirmée"
        : "Moyen de règlement rejeté");
      setInstrumentAction(undefined);
      setAccountId("");
      setInstrumentReason("");
      await refresh();
    },
    onError: notifyError,
  });

  const row = detail.data;
  if (detail.isLoading) {
    return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;
  }
  if (!row) {
    return <div className="py-20 text-center text-muted-foreground">Bordereau introuvable.</div>;
  }

  const bankAccounts = (accounts.data ?? []).filter(
    (account) => account.actif && account.typeCompte === "BANQUE"
  );

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Compagnie</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{row.numero}</h1>
            <StatusBadge value={row.statut} />
          </div>
          <p className="text-sm text-muted-foreground">
            {row.compagnie} · {row.baseBordereau === "EMISSION" ? "Bordereau d’émissions" : "Bordereau d’encaissements"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/app/compta/bordereaux-compagnies"><ArrowLeft className="size-4" />Retour</Link>
          </Button>
          {row.statut === "BROUILLON" && permissions.includes("bordereau-compagnie:create") ? (
            <Button asChild variant="outline">
              <Link to={`/app/compta/bordereaux-compagnies/${row.id}/modifier`}>
                <Edit3 className="size-4" />Modifier
              </Link>
            </Button>
          ) : null}
          {row.statut === "BROUILLON" && permissions.includes("bordereau-compagnie:validate") ? (
            <Button onClick={() => setValidateOpen(true)}><ShieldCheck className="size-4" />Valider</Button>
          ) : null}
          {row.statut === "VALIDE" && permissions.includes("bordereau-compagnie:transmit") ? (
            <Button onClick={() => setTransmitOpen(true)}><Send className="size-4" />Transmettre</Button>
          ) : null}
          {row.statut === "TRANSMIS" && permissions.includes("reglement-compagnie:create") && row.soldeRestant > 0.004 ? (
            <Button asChild>
              <Link to={`/app/compta/bordereaux-compagnies/reglement?bordereauIds=${row.id}`}>
                <WalletCards className="size-4" />Enregistrer un règlement
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <section className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-4">
        <Summary label="Net compagnie" value={money(row.netCompagnie)} />
        <Summary label="Réglé" value={money(row.montantRegle)} />
        <Summary label="En attente" value={money(row.montantEnAttente)} />
        <Summary label="Solde à régler" value={money(row.soldeRestant)} />
      </section>

      <section className="grid gap-4 rounded-md border bg-card p-4 lg:grid-cols-3">
        <Info label="Compagnie" value={row.compagnie} />
        <Info label="Période" value={`${date(row.periodeDebut)} au ${date(row.periodeFin)}`} />
        <Info label="Créé par" value={row.creePar} />
        <Info label="Transmission" value={row.dateTransmission
          ? `${date(row.dateTransmission)} · ${row.canalTransmission ?? "-"}`
          : "Non transmise"} />
        <Info label="Référence d’envoi" value={row.referenceTransmission || "-"} />
        <Info label="Accusé de réception" value={row.dateAccuseReception
          ? `${date(row.dateAccuseReception)} · ${row.referenceAccuseReception ?? "-"}`
          : "Non renseigné"} />
        <Info label="Rapprochement" value={statusLabel(row.statutRapprochement)} />
        <Info label="Écart" value={money(row.ecartRapprochement)} />
        <Info label="État du règlement" value={statusLabel(row.statutReglement)} />
        {row.notes ? <div className="lg:col-span-3"><Info label="Notes" value={row.notes} /></div> : null}
      </section>

      {row.statut === "TRANSMIS" && permissions.includes("bordereau-compagnie:reconcile") ? (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => {
            setDifference(String(row.ecartRapprochement ?? 0));
            setAckDate(row.dateAccuseReception ?? "");
            setAckReference(row.referenceAccuseReception ?? "");
            setReconciliationNote(row.noteRapprochement ?? "");
            setReconcileOpen(true);
          }}>
            <Check className="size-4" />Rapprocher le bordereau
          </Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Écritures déclarées</h2>
          <p className="text-xs text-muted-foreground">{row.lignes.length} ligne(s) figée(s) dans le bordereau.</p>
        </div>
        <Table className="min-w-[1050px]">
          <TableHeader className="bg-muted/35 text-xs uppercase">
            <TableRow>
              <TableHead>Mouvement</TableHead>
              <TableHead>Police</TableHead>
              <TableHead>N° quittance</TableHead>
              <TableHead>Date d’effet</TableHead>
              <TableHead className="text-right">Prime nette</TableHead>
              <TableHead className="text-right">Taxes</TableHead>
              <TableHead className="text-right">TTC</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Retenue</TableHead>
              <TableHead className="text-right">Net compagnie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.lignes.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-medium">{line.mouvement || "-"}</TableCell>
                <TableCell>{line.numeroPolice || "-"}</TableCell>
                <TableCell>{line.numeroQuittanceCompagnie || "-"}</TableCell>
                <TableCell>{date(line.dateEffet)}</TableCell>
                <TableCell className="text-right">{money(line.primeNette)}</TableCell>
                <TableCell className="text-right">{money(line.montantTaxes)}</TableCell>
                <TableCell className="text-right font-semibold">{money(line.montantTtc)}</TableCell>
                <TableCell className="text-right">{money(line.commissionNette)}</TableCell>
                <TableCell className="text-right">{money(line.montantRetenue)}</TableCell>
                <TableCell className="text-right font-semibold">{money(line.netCompagnie)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Règlements compagnie</h2>
          <p className="text-xs text-muted-foreground">Historique des moyens affectés à ce bordereau.</p>
        </div>
        <Table className="min-w-[920px]">
          <TableHeader className="bg-muted/35 text-xs uppercase">
            <TableRow>
              <TableHead>N° règlement</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead className="text-right">Montant affecté</TableHead>
              <TableHead className="text-center">Statut</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.reglements.map((payment) => (
              <TableRow key={payment.instrumentId}>
                <TableCell className="font-semibold">{payment.numeroReglement}</TableCell>
                <TableCell>{statusLabel(payment.mode)}</TableCell>
                <TableCell>{date(payment.dateInstrument)}</TableCell>
                <TableCell>{payment.referenceInstrument || "-"}</TableCell>
                <TableCell className="text-right font-semibold">{money(payment.montantAffecte)}</TableCell>
                <TableCell className="text-center"><StatusBadge value={payment.statut} /></TableCell>
                <TableCell className="text-right">
                  {payment.statut === "EN_ATTENTE" && permissions.includes("reglement-compagnie:manage") ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setInstrumentAction({ instrument: payment, status: "CONFIRME" })}>
                        Confirmer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setInstrumentAction({ instrument: payment, status: "REJETE" })}>
                        Rejeter
                      </Button>
                    </div>
                  ) : "-"}
                </TableCell>
              </TableRow>
            ))}
            {row.reglements.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Aucun règlement enregistré.</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>

      {row.statut !== "ANNULE" && permissions.includes("bordereau-compagnie:cancel") ? (
        <div className="flex justify-end border-t pt-4">
          <Button variant="destructive" onClick={() => setCancelOpen(true)}><Ban className="size-4" />Annuler le bordereau</Button>
        </div>
      ) : null}

      <AlertDialog open={validateOpen} onOpenChange={setValidateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider ce bordereau ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les montants et les lignes seront figés. La validation ne constitue pas encore une transmission à la compagnie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => validateBordereau.mutate()}>Valider</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={transmitOpen} onOpenChange={setTransmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer la transmission</DialogTitle>
            <DialogDescription>Tracez l’envoi effectif du bordereau à la compagnie.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date de transmission">
              <DatePicker date={transmissionDate} onSelect={(value) => setTransmissionDate(toDateOnly(value) ?? "")} />
            </Field>
            <Field label="Canal">
              <Select value={transmissionChannel} onValueChange={setTransmissionChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="PORTAIL">Portail compagnie</SelectItem>
                  <SelectItem value="COURRIER">Courrier</SelectItem>
                  <SelectItem value="MAIN_PROPRE">Remise en main propre</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Référence de transmission">
                <Input value={transmissionReference} onChange={(event) => setTransmissionReference(event.target.value)} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransmitOpen(false)}>Annuler</Button>
            <Button disabled={!transmissionDate || !transmissionChannel} onClick={() => transmit.mutate()}>Enregistrer l’envoi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reconcileOpen} onOpenChange={setReconcileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rapprocher le bordereau</DialogTitle>
            <DialogDescription>Enregistrez l’accusé et l’écart constaté avec la compagnie.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date de l’accusé">
              <DatePicker date={ackDate} onSelect={(value) => setAckDate(toDateOnly(value) ?? "")} />
            </Field>
            <Field label="Référence de l’accusé">
              <Input value={ackReference} onChange={(event) => setAckReference(event.target.value)} />
            </Field>
            <Field label="Écart compagnie">
              <Input inputMode="decimal" value={difference} onChange={(event) => setDifference(event.target.value)} />
            </Field>
            <div className="flex items-end pb-2 text-sm text-muted-foreground">
              {Math.abs(parseAccountingAmount(difference)) < 0.005 ? "Rapprochement exact" : "Rapprochement avec écart"}
            </div>
            <div className="sm:col-span-2">
              <Field label="Note de rapprochement">
                <Textarea value={reconciliationNote} onChange={(event) => setReconciliationNote(event.target.value)} rows={3} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconcileOpen(false)}>Annuler</Button>
            <Button disabled={Math.abs(parseAccountingAmount(difference)) >= 0.005 && !reconciliationNote.trim()} onClick={() => reconcile.mutate()}>
              Enregistrer le rapprochement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler le bordereau</DialogTitle>
            <DialogDescription>Les lignes redeviendront disponibles. L’historique du bordereau sera conservé.</DialogDescription>
          </DialogHeader>
          <Field label="Motif obligatoire">
            <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Retour</Button>
            <Button variant="destructive" disabled={!cancelReason.trim()} onClick={() => cancel.mutate()}>Confirmer l’annulation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(instrumentAction)} onOpenChange={(open) => !open && setInstrumentAction(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{instrumentAction?.status === "CONFIRME" ? "Confirmer la sortie bancaire" : "Rejeter le moyen de règlement"}</DialogTitle>
            <DialogDescription>
              {instrumentAction?.instrument.numeroReglement} · {money(instrumentAction?.instrument.montantAffecte)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Date d’opération">
              <DatePicker date={operationDate} onSelect={(value) => setOperationDate(toDateOnly(value) ?? "")} />
            </Field>
            {instrumentAction?.status === "CONFIRME" ? (
              <Field label="Compte bancaire débité">
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un compte bancaire" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field label="Motif du rejet">
                <Textarea value={instrumentReason} onChange={(event) => setInstrumentReason(event.target.value)} rows={3} />
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstrumentAction(undefined)}>Annuler</Button>
            <Button
              disabled={!operationDate || (instrumentAction?.status === "CONFIRME" ? !accountId : !instrumentReason.trim())}
              onClick={() => changeInstrument.mutate()}
            >Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs uppercase text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value}</div></div>;
}

function StatusBadge({ value }: { value: string }) {
  const variant = value === "ANNULE" || value === "REJETE" || value === "AVEC_ECART"
    ? "destructive"
    : value === "TRANSMIS" || value === "CONFIRME" || value === "REGLE" || value === "RAPPROCHE"
      ? "default"
      : "secondary";
  return <Badge variant={variant}>{statusLabel(value)}</Badge>;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    BROUILLON: "Brouillon",
    VALIDE: "Validé",
    TRANSMIS: "Transmis",
    ANNULE: "Annulé",
    A_RAPPROCHER: "À rapprocher",
    AVEC_ECART: "Avec écart",
    RAPPROCHE: "Rapproché",
    NON_REGLE: "Non réglé",
    EN_ATTENTE: "En attente",
    PARTIELLEMENT_REGLE: "Partiellement réglé",
    REGLE: "Réglé",
    CONFIRME: "Confirmé",
    REJETE: "Rejeté",
    VIREMENT: "Virement",
    CHEQUE: "Chèque",
    EFFET: "Effet",
    COMPENSATION: "Compensation",
  };
  return labels[value] ?? value;
}

function money(value?: number | null) {
  return formatAccountingAmount(value);
}

function date(value?: string | null) {
  return value ? value.split("-").reverse().join("/") : "-";
}

function notifyError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
