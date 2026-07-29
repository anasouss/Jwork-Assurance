import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { EcheanceInput } from "@/components/ui/echeance-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productionApi } from "../api";
import { computeDateEcheanceFromCode, toDateOnly } from "../date";
import type { AssistanceContratContext, UpsertAssistanceContratRequest } from "../types";

type FormState = {
  vehiculeId?: string;
  numeroContratOuQuittance?: string;
  dateEffet?: string;
  dateSouscription?: string;
  echeanceCode?: string;
  compagnieAssistanceId?: string;
  produitAssistanceId?: string;
};

export default function ContratAssistancePage() {
  const { contratId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const mouvementId = numericParam(searchParams.get("mouvementId"));
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({});
  const [assistanceToDelete, setAssistanceToDelete] = useState<AssistanceContratContext["assistances"][number] | null>(null);
  const contextQuery = useQuery({
    queryKey: ["contrat-assistance", contratId, mouvementId, form.dateSouscription],
    queryFn: () => productionApi.getAssistanceContext(contratId, { mouvementId, dateSouscription: form.dateSouscription }),
    enabled: Boolean(contratId),
  });
  const context = contextQuery.data;

  const selectedVehicle = useMemo(
    () => context?.vehiculesEligibles.find((vehicule) => vehicule.id === form.vehiculeId),
    [context?.vehiculesEligibles, form.vehiculeId]
  );
  const filteredProducts = useMemo(() => {
    const products = context?.produits ?? [];
    return products.filter((product) => {
      if (form.compagnieAssistanceId && String(product.compagnieAssistanceId ?? "") !== form.compagnieAssistanceId) return false;
      if (context?.categorieClientId && product.categorieClientId && String(product.categorieClientId) !== String(context.categorieClientId)) return false;
      const usageIds = product.usageIds ?? [];
      if (selectedVehicle?.usageId && usageIds.length > 0 && !usageIds.map(String).includes(String(selectedVehicle.usageId))) return false;
      return true;
    });
  }, [context?.categorieClientId, context?.produits, form.compagnieAssistanceId, selectedVehicle?.usageId]);
  const selectedProduct = filteredProducts.find((product) => product.id === form.produitAssistanceId);
  const computedDateEcheance = computeDateEcheanceFromCode(form.dateEffet, form.echeanceCode, context?.dateEcheance);

  useEffect(() => {
    if (!context) return;
    setForm((current) => ({
      vehiculeId: context.vehiculesEligibles.some((vehicule) => vehicule.id === current.vehiculeId)
        ? current.vehiculeId
        : context.vehiculesEligibles[0]?.id,
      numeroContratOuQuittance: current.numeroContratOuQuittance,
      dateEffet: current.dateEffet ?? context.dateEffet ?? undefined,
      dateSouscription: current.dateSouscription,
      echeanceCode: current.echeanceCode ?? context.echeanceCode ?? undefined,
      compagnieAssistanceId: current.compagnieAssistanceId,
      produitAssistanceId: current.produitAssistanceId,
    }));
  }, [context]);

  useEffect(() => {
    if (form.produitAssistanceId && !filteredProducts.some((product) => product.id === form.produitAssistanceId)) {
      setForm((current) => ({ ...current, produitAssistanceId: undefined }));
    }
  }, [filteredProducts, form.produitAssistanceId]);

  const saveMutation = useMutation({
    mutationFn: (request: UpsertAssistanceContratRequest) => productionApi.saveAssistance(contratId, request),
    onSuccess: async () => {
      setForm((current) => ({
        dateEffet: current.dateEffet,
        dateSouscription: current.dateSouscription,
        echeanceCode: current.echeanceCode,
      }));
      await queryClient.invalidateQueries({ queryKey: ["contrat-assistance", contratId] });
      toast.success("Assistance enregistrée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const deleteMutation = useMutation({
    mutationFn: (assistanceId: string) => productionApi.deleteAssistance(contratId, assistanceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contrat-assistance", contratId] });
      setAssistanceToDelete(null);
      toast.success("Assistance supprimée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Suppression impossible"),
  });

  function submit() {
    if (!form.vehiculeId || !form.compagnieAssistanceId || !form.produitAssistanceId) {
      toast.error("Véhicule, compagnie et produit sont obligatoires.");
      return;
    }
    saveMutation.mutate({
      mouvementContratId: context?.mouvementContratId ?? mouvementId,
      vehiculeId: form.vehiculeId,
      compagnieAssistanceId: form.compagnieAssistanceId,
      produitAssistanceId: form.produitAssistanceId,
      dateSouscription: form.dateSouscription,
      dateEffet: form.dateEffet,
      echeanceCode: form.echeanceCode,
      numeroContratOuQuittance: form.numeroContratOuQuittance,
      typeQuittance: "ASSISTANCE",
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
          <h1 className="text-xl font-semibold tracking-tight">Contrat assistance</h1>
          <p className="text-sm text-muted-foreground">
            {context?.numeroDossier ?? `Contrat #${contratId}`} · {context?.mouvementLibelle ?? "Mouvement contrat"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/production/contrats">Retour liste</Link>
        </Button>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="border-b bg-emerald-50/70 py-3 dark:bg-emerald-950/30">
          <CardTitle className="text-sm">Assistance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4">
          {contextQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement...</div>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-3">
                <Field label="Police N°">
                  <Input value={context?.numeroPolice ?? ""} disabled />
                </Field>
                <Field label="Échéance (JJ/MM)" required>
                  <EcheanceInput value={form.echeanceCode} onValueChange={(value) => setForm((current) => ({ ...current, echeanceCode: value }))} />
                </Field>
                <Field label="Date d'échéance">
                  <Input value={formatDate(computedDateEcheance)} disabled />
                </Field>
                <Field label="Type contrat assistance">
                  <Input value="Individuel" disabled />
                </Field>
                <Field label="Véhicule" required>
                  <Select value={form.vehiculeId} onValueChange={(value) => setForm((current) => ({ ...current, vehiculeId: value, produitAssistanceId: undefined }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {(context?.vehiculesEligibles ?? []).map((vehicule) => (
                        <SelectItem key={vehicule.id} value={vehicule.id}>{vehicleLabel(vehicule)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="N° contrat/quittance" required>
                  <Input value={form.numeroContratOuQuittance ?? ""} onChange={(event) => setForm((current) => ({ ...current, numeroContratOuQuittance: event.target.value }))} />
                </Field>
                <Field label="Date d'effet" required>
                  <DatePicker date={form.dateEffet} onSelect={(date) => setForm((current) => ({ ...current, dateEffet: toDateOnly(date) }))} />
                </Field>
                <Field label="Date souscription" required>
                  <DatePicker date={form.dateSouscription} onSelect={(date) => setForm((current) => ({ ...current, dateSouscription: toDateOnly(date) }))} />
                </Field>
                <Field label="Compagnie d'assistance" required>
                  <Select value={form.compagnieAssistanceId} onValueChange={(value) => setForm((current) => ({ ...current, compagnieAssistanceId: value, produitAssistanceId: undefined }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {(context?.compagnies ?? []).map((compagnie) => (
                        <SelectItem key={compagnie.id} value={compagnie.id}>{compagnie.libelle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Produit d'assistance" required>
                  <Select value={form.produitAssistanceId} disabled={!form.compagnieAssistanceId || filteredProducts.length === 0} onValueChange={(value) => setForm((current) => ({ ...current, produitAssistanceId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {filteredProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>{product.libelle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Montant total">
                  <Input value={selectedProduct?.montantTtc != null ? money(selectedProduct.montantTtc) : ""} disabled />
                </Field>
              </div>

              {selectedProduct ? (
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  Tarif: {money(selectedProduct.montantHt)} HT / {money(selectedProduct.montantTtc)} TTC
                  {selectedProduct.dateDebutTarif ? ` · Depuis ${formatDate(selectedProduct.dateDebutTarif)}` : ""}
                </div>
              ) : null}

              {(context?.vehiculesEligibles ?? []).length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Aucun véhicule éligible. Les véhicules déjà liés à une assistance active ne sont pas proposés.
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button asChild type="button" variant="destructive">
                  <Link to="/app/production/contrats">Annuler</Link>
                </Button>
                <Button type="button" disabled={saveMutation.isPending || (context?.vehiculesEligibles ?? []).length === 0} onClick={submit}>
                  <Save className="size-4" />
                  Enregistrer
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="border-b bg-emerald-600 py-3 text-white dark:bg-emerald-700">
          <CardTitle className="text-sm">Assistances enregistrées</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="px-3 py-3 text-left">Véhicule</th>
                  <th className="px-3 py-3 text-left">Compagnie</th>
                  <th className="px-3 py-3 text-left">Produit</th>
                  <th className="px-3 py-3 text-left">Date effet</th>
                  <th className="px-3 py-3 text-left">Date échéance</th>
                  <th className="px-3 py-3 text-right">Prime nette</th>
                  <th className="px-3 py-3 text-right">Prime totale</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(context?.assistances ?? []).length ? (context?.assistances ?? []).map((assistance) => (
                  <tr key={assistance.id} className="border-t">
                    <td className="px-3 py-2">{assistance.vehiculeImmatriculation ?? assistance.vehiculeId ?? "-"}</td>
                    <td className="px-3 py-2">{assistance.compagnieAssistanceLibelle ?? "-"}</td>
                    <td className="px-3 py-2">{assistance.produit ?? "-"}</td>
                    <td className="px-3 py-2">{formatDate(assistance.dateEffet)}</td>
                    <td className="px-3 py-2">{formatDate(assistance.dateEcheance)}</td>
                    <td className="px-3 py-2 text-right">{money(assistance.primeNette)}</td>
                    <td className="px-3 py-2 text-right">{money(assistance.primeTotale)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        disabled={deleteMutation.isPending}
                        title="Supprimer l’assistance"
                        onClick={() => setAssistanceToDelete(assistance)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Aucune assistance enregistrée.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(assistanceToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setAssistanceToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l’assistance ?</AlertDialogTitle>
            <AlertDialogDescription>
              L’assistance
              {assistanceToDelete?.vehiculeImmatriculation
                ? ` du véhicule ${assistanceToDelete.vehiculeImmatriculation}`
                : ""}
              {" "}sera retirée du mouvement et de la quittance. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (assistanceToDelete) {
                  deleteMutation.mutate(assistanceToDelete.id);
                }
              }}
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-700 dark:text-neutral-300">
      <span>{label} {required ? <span className="text-red-600">*</span> : null}</span>
      {children}
    </label>
  );
}

function numericParam(value: string | null) {
  return value && /^\d+$/.test(value) ? value : null;
}

function vehicleLabel(vehicule: AssistanceContratContext["vehiculesEligibles"][number]) {
  return [vehicule.immatriculation || `Véhicule #${vehicule.id}`, vehicule.usageCode].filter(Boolean).join(" · ");
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function money(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}
