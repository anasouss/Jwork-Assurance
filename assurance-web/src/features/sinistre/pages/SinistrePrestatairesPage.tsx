import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, RotateCcw, Search, Settings2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { AccessDenied, ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { referenceApi } from "@/features/production/api/references";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";
import { sinistreApi, sinistreKeys } from "../api";
import { SinistreIntervenantDialog } from "../components/SinistreIntervenantDialog";
import { SinistreVilleSelect } from "../components/SinistreVilleSelect";
import type { Intervenant, ProviderKind } from "../types";

const initialFilters = { query: "", villeId: "", compagnieId: "ALL", specialiteId: "ALL", includeInactive: false };

export default function SinistrePrestatairesPage() {
  const canManage = useAuthStore(s => s.user?.permissions.includes("sinistre:referentiel") ?? false);
  const [params, setParams] = useSearchParams();
  const kind: ProviderKind = params.get("type") === "EXPERT" ? "EXPERT" : "GARAGE";
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Intervenant | null>(null);
  const [open, setOpen] = useState(false);
  const options = useQuery({ queryKey: sinistreKeys.providerOptions(), queryFn: sinistreApi.providerOptions, enabled: canManage });
  const specialties = useQuery({ queryKey: sinistreKeys.specialties(), queryFn: sinistreApi.specialties, enabled: canManage });
  const cities = useQuery({ queryKey: ["referentiel", "villes", "sinistre"], queryFn: () => referenceApi.list("villes"), enabled: canManage });
  const directory = useQuery({
    queryKey: [...sinistreKeys.providers(), "directory", kind, applied, page],
    queryFn: () => sinistreApi.providers({ typePrestataire: kind, query: applied.query || undefined,
      villeId: applied.villeId || undefined,
      compagnieId: applied.compagnieId === "ALL" ? undefined : applied.compagnieId,
      specialiteId: applied.specialiteId === "ALL" ? undefined : applied.specialiteId,
      includeInactive: applied.includeInactive, page, size: 25 }), enabled: canManage,
  });
  const save = useMutation({ mutationFn: (request: object) => kind === "EXPERT"
    ? sinistreApi.saveExpert(editing?.id ?? null, request) : sinistreApi.saveGarage(editing?.id ?? null, request),
    onSuccess: async () => {
      setOpen(false); setEditing(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: sinistreKeys.providers() }),
        queryClient.invalidateQueries({ queryKey: [...sinistreKeys.all, "eligible-prestataires"] }),
        queryClient.invalidateQueries({ queryKey: [...sinistreKeys.all, "experts"] }),
        queryClient.invalidateQueries({ queryKey: [...sinistreKeys.all, "garages"] })]);
      toast.success("Prestataire enregistré");
    }, onError: error => toast.error(error.message),
  });
  if (!canManage) return <AccessDenied />;
  return <div className="grid gap-4">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm font-medium text-sky-700 dark:text-sky-400">Sinistres</p><h1 className="mt-1 text-xl font-semibold">Prestataires</h1></div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to="/app/sinistre"><ArrowLeft className="size-4" />Module sinistres</Link></Button>
        <Button asChild variant="outline"><Link to="/app/sinistre/prestataires/specialites"><Settings2 className="size-4" />Spécialités et garanties</Link></Button>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" />{kind === "EXPERT" ? "Ajouter un expert" : "Ajouter un garage"}</Button>
      </div>
    </header>
    <section aria-label="Filtres des prestataires" className="grid gap-3 border-y bg-card p-4 sm:grid-cols-2 xl:grid-cols-5">
      <div className="grid gap-1.5"><Label htmlFor="provider-type">Type de prestataire</Label><Select value={kind} onValueChange={value => {
        setParams({ type: value }, { replace: true }); setPage(0);
        setFilters(current => ({ ...current, specialiteId: "ALL" }));
        setApplied(current => ({ ...current, specialiteId: "ALL" }));
        setOpen(false); setEditing(null);
      }}><SelectTrigger id="provider-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GARAGE">Garage</SelectItem><SelectItem value="EXPERT">Expert</SelectItem></SelectContent></Select></div>
      <div className="grid gap-1.5"><Label htmlFor="provider-search">Code, nom ou contact</Label><Input id="provider-search" value={filters.query}
        onChange={e => setFilters(f => ({ ...f, query: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") { setApplied(filters); setPage(0); } }} /></div>
      <div className="grid gap-1.5"><Label>Ville</Label><SinistreVilleSelect
        placeholder="Toutes les villes"
        cities={cities.data ?? []}
        value={filters.villeId} disabled={cities.isPending || cities.isError}
        onValueChange={value => setFilters(f => ({ ...f, villeId: value }))} /></div>
      <div className="grid gap-1.5"><Label>Compagnie liée</Label><Select value={filters.compagnieId} onValueChange={value => setFilters(f => ({ ...f, compagnieId: value }))}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les compagnies</SelectItem>{options.data?.compagnies.map(c => <SelectItem key={c.id} value={c.id}>{c.libelle}</SelectItem>)}</SelectContent>
      </Select></div>
      <div className="grid gap-1.5"><Label>Spécialité</Label><Select value={filters.specialiteId} onValueChange={value => setFilters(f => ({ ...f, specialiteId: value }))}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les spécialités</SelectItem>{specialties.data?.filter(s => s.typePrestataire === kind).map(s => <SelectItem key={s.id} value={s.id}>{s.libelle}</SelectItem>)}</SelectContent>
      </Select></div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 xl:col-span-5">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={filters.includeInactive} onCheckedChange={checked => setFilters(f => ({ ...f, includeInactive: checked === true }))} />Inclure les inactifs</label>
        <div className="flex gap-2"><Button size="icon" title="Rechercher" aria-label="Rechercher" onClick={() => { setApplied({ ...filters }); setPage(0); }}><Search className="size-4" /></Button>
          <Button variant="outline" size="icon" title="Réinitialiser" aria-label="Réinitialiser" onClick={() => { setFilters(initialFilters); setApplied(initialFilters); setPage(0); }}><RotateCcw className="size-4" /></Button></div>
      </div>
      {(options.isError || specialties.isError || cities.isError) && <p role="alert" className="text-sm text-destructive sm:col-span-2 xl:col-span-5">Impossible de charger les filtres.</p>}
    </section>
    <section className="min-w-0 overflow-hidden rounded-md border bg-card">
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-sky-700 text-left text-xs uppercase text-white"><tr>{["Code", "Prestataire", "Contact", "Ville", "Spécialités", "Compagnies et accords", "Statut", "Action"].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
        <tbody className="divide-y">{directory.isPending ? <TableRowsSkeleton colSpan={8} rows={6} />
          : directory.isError ? <tr><td colSpan={8} className="p-8 text-center"><p role="alert" className="text-destructive">{directory.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void directory.refetch()}>Réessayer</Button></td></tr>
            : !directory.data.items.length ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Aucun prestataire pour ces critères.</td></tr>
              : directory.data.items.map(item => <tr key={item.id} className="align-top hover:bg-muted/30">
                <td className="px-3 py-3 font-medium">{item.code}</td><td className="max-w-64 break-words px-3 py-3 font-medium">{item.nom}<p className="mt-1 text-xs font-normal text-muted-foreground">{item.adresse}</p></td>
                <td className="px-3 py-3">{item.telephone || "-"}<p className="text-xs text-muted-foreground">{item.email}</p></td><td className="px-3 py-3">{item.ville || "-"}</td>
                <td className="max-w-64 px-3 py-3"><div className="flex flex-wrap gap-1">{item.specialites?.map(s => <Badge key={s.id} variant={s.actif ? "info" : "gray"}>{s.libelle}</Badge>)}{!item.specialites?.length && "-"}</div></td>
                <td className="max-w-72 px-3 py-3"><p className="mb-1 text-xs text-muted-foreground">{item.toutesCompagnies ? "Toutes compagnies" : "Compagnies liées uniquement"}</p>
                  <ul className="space-y-1">{item.accords?.map(a => <li key={a.compagnieId}>{a.compagnie} <span className="text-xs text-muted-foreground">· {a.actif ? (a.conventionne ? "Conventionné" : "Non conventionné") : "Inactif"}{a.dateFin ? ` · au ${a.dateFin.split("-").reverse().join("/")}` : ""}</span></li>)}</ul></td>
                <td className="px-3 py-3"><Badge variant={item.actif ? "success" : "gray"}>{item.actif ? "Actif" : "Inactif"}</Badge></td>
                <td className="px-3 py-3"><Button variant="ghost" size="icon" title="Modifier le prestataire" aria-label={`Modifier ${item.nom}`} onClick={() => { setEditing(item); setOpen(true); }}><Pencil className="size-4" /></Button></td>
              </tr>)}</tbody>
      </table></div>
      <ServerPagination className="border-t px-4 py-3" page={directory.data?.page.number ?? page} totalPages={directory.data?.page.totalPages ?? 0}
        totalElements={directory.data?.page.totalElements ?? 0} loading={directory.isFetching} onPageChange={setPage} />
    </section>
    <SinistreIntervenantDialog open={open} kind={kind} intervenant={editing} cities={cities.data ?? []} saving={save.isPending}
      onOpenChange={setOpen} onSubmit={request => save.mutate(request)} />
  </div>;
}
