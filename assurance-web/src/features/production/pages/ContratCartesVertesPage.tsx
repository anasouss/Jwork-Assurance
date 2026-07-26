import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productionApi } from "../api";
import { toDateOnly } from "../date";
import type { CarteVerte, CarteVerteContext, UpsertCarteVerteRequest } from "../types";

type FormState = {
  vehiculeId?: string;
  numero?: string;
  dateEffet?: string;
};

const PAGE_SIZE_OPTIONS = ["10", "25", "50"];

export default function ContratCartesVertesPage() {
  const { contratId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const mouvementId = numericParam(searchParams.get("mouvementId"));
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({});
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState("10");
  const [page, setPage] = useState(1);

  const contextQuery = useQuery({
    queryKey: ["contrat-cartes-vertes", contratId, mouvementId],
    queryFn: () => productionApi.getCarteVerteContext(contratId, { mouvementId }),
    enabled: Boolean(contratId),
  });
  const context = contextQuery.data;
  const selectedVehicle = useMemo(
    () => context?.vehiculesEligibles.find((vehicule) => String(vehicule.id) === form.vehiculeId),
    [context?.vehiculesEligibles, form.vehiculeId]
  );
  const dateEcheance = selectedVehicle?.dateEcheance ?? context?.dateEcheance ?? undefined;
  const filteredCartes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return context?.cartesVertes ?? [];
    return (context?.cartesVertes ?? []).filter((carte) =>
      [carte.numero, carte.vehiculeImmatriculation, carte.numeroPoliceContrat, carte.numeroDossier]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [context?.cartesVertes, search]);
  const totalPages = Math.max(1, Math.ceil(filteredCartes.length / Number(pageSize)));
  const visibleCartes = filteredCartes.slice((page - 1) * Number(pageSize), page * Number(pageSize));

  useEffect(() => {
    if (!context) return;
    const firstVehicle = context.vehiculesEligibles[0];
    setForm((current) => ({
      vehiculeId: current.vehiculeId ?? (firstVehicle ? String(firstVehicle.id) : undefined),
      numero: current.numero,
      dateEffet: current.dateEffet ?? firstVehicle?.dateEffet ?? context.dateEffet ?? undefined,
    }));
  }, [context]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const saveMutation = useMutation({
    mutationFn: (request: UpsertCarteVerteRequest) => productionApi.saveCarteVerte(contratId, request),
    onSuccess: async () => {
      setForm((current) => ({
        dateEffet: current.dateEffet,
      }));
      await queryClient.invalidateQueries({ queryKey: ["contrat-cartes-vertes", contratId] });
      toast.success("Carte verte enregistrée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const deleteMutation = useMutation({
    mutationFn: (carteVerteId: string) => productionApi.deleteCarteVerte(contratId, carteVerteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contrat-cartes-vertes", contratId] });
      toast.success("Carte verte supprimée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Suppression impossible"),
  });

  function submit() {
    if (!form.vehiculeId || !form.numero?.trim() || !form.dateEffet) {
      toast.error("Véhicule, N° carte verte et date d'effet sont obligatoires.");
      return;
    }
    saveMutation.mutate({
      mouvementContratId: context?.mouvementContratId ?? mouvementId,
      vehiculeId: form.vehiculeId,
      numero: form.numero,
      dateEffet: form.dateEffet,
    });
  }

  function updateVehicle(vehiculeId: string) {
    const vehicle = context?.vehiculesEligibles.find((item) => String(item.id) === vehiculeId);
    setForm((current) => ({
      ...current,
      vehiculeId,
      dateEffet: vehicle?.dateEffet ?? context?.dateEffet ?? current.dateEffet,
    }));
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
          <h1 className="text-xl font-semibold tracking-tight">Cartes vertes</h1>
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
          <CardTitle className="text-sm">Carte verte</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4">
          {contextQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement...</div>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-3">
                <Field label="Véhicule" required>
                  <Select value={form.vehiculeId} onValueChange={updateVehicle}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {(context?.vehiculesEligibles ?? []).map((vehicule) => (
                        <SelectItem key={vehicule.id} value={String(vehicule.id)}>{vehicleLabel(vehicule)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="N° carte verte" required>
                  <Input value={form.numero ?? ""} onChange={(event) => setForm((current) => ({ ...current, numero: event.target.value }))} />
                </Field>
                <Field label="Date d'effet" required>
                  <DatePicker date={form.dateEffet} onSelect={(date) => setForm((current) => ({ ...current, dateEffet: toDateOnly(date) }))} />
                </Field>
                <Field label="Police N°">
                  <Input value={context?.numeroPolice ?? ""} disabled />
                </Field>
                <Field label="Date d'échéance">
                  <Input value={formatDate(dateEcheance)} disabled />
                </Field>
                <Field label="Montant total">
                  <Input value={moneyDh(context?.montant)} disabled />
                </Field>
              </div>

              {(context?.vehiculesEligibles ?? []).length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Aucun véhicule éligible. Les véhicules ayant déjà une carte verte active ne sont pas proposés.
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
          <CardTitle className="text-sm">Cartes vertes enregistrées</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm">
              <span>Afficher</span>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="h-9 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
              <span>entrées</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span>Recherche</span>
              <Input className="h-9 w-64 max-w-full" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-emerald-600 text-xs uppercase text-white">
                <tr>
                  <th className="px-3 py-3 text-left">Police N°</th>
                  <th className="px-3 py-3 text-left">Véhicule</th>
                  <th className="px-3 py-3 text-left">N° carte verte</th>
                  <th className="px-3 py-3 text-left">Date d'effet</th>
                  <th className="px-3 py-3 text-left">Date d'échéance</th>
                  <th className="px-3 py-3 text-right">Montant</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCartes.length ? visibleCartes.map((carte) => (
                  <CarteVerteRow
                    key={carte.id}
                    carte={carte}
                    deleting={deleteMutation.variables === String(carte.id)}
                    onDelete={() => deleteMutation.mutate(String(carte.id))}
                  />
                )) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Aucune carte verte enregistrée.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Affichage {filteredCartes.length ? (page - 1) * Number(pageSize) + 1 : 0} à {Math.min(page * Number(pageSize), filteredCartes.length)} sur {filteredCartes.length} entrées</span>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Précédent</Button>
              <span>Page {page} / {totalPages}</span>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Suivant</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CarteVerteRow({ carte, deleting, onDelete }: { carte: CarteVerte; deleting: boolean; onDelete: () => void }) {
  return (
    <tr className="border-t">
      <td className="px-3 py-2">{carte.numeroPoliceContrat ?? "-"}</td>
      <td className="px-3 py-2">{carte.vehiculeImmatriculation ?? carte.vehiculeId ?? "-"}</td>
      <td className="px-3 py-2 font-medium">{carte.numero ?? "-"}</td>
      <td className="px-3 py-2">{formatDate(carte.dateEffet)}</td>
      <td className="px-3 py-2">{formatDate(carte.dateEcheance)}</td>
      <td className="px-3 py-2 text-right">{moneyDh(carte.montant)}</td>
      <td className="px-3 py-2 text-right">
        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" disabled={deleting} onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </td>
    </tr>
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

function vehicleLabel(vehicule: CarteVerteContext["vehiculesEligibles"][number]) {
  return [vehicule.immatriculation || `Véhicule #${vehicule.id}`, vehicule.usageCode].filter(Boolean).join(" · ");
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function moneyDh(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} DH`;
}
