import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { AccessDenied, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";
import { sinistreApi, sinistreKeys } from "../api";
import type { ProviderKind, ProviderSpecialty } from "../types";

const initial = { code: "", libelle: "", typePrestataire: "GARAGE" as ProviderKind, actif: true, garantieIds: [] as string[] };

export default function SinistreSpecialitesPage() {
  const canManage = useAuthStore(s => s.user?.permissions.includes("sinistre:referentiel") ?? false);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderSpecialty | null>(null);
  const [form, setForm] = useState(initial);
  const [query, setQuery] = useState("");
  const data = useQuery({ queryKey: sinistreKeys.specialties(), queryFn: sinistreApi.specialties, enabled: canManage });
  const options = useQuery({ queryKey: sinistreKeys.providerOptions(), queryFn: sinistreApi.providerOptions, enabled: canManage });
  const save = useMutation({ mutationFn: () => sinistreApi.saveSpecialty(editing?.id ?? null, form),
    onSuccess: async () => { setOpen(false); await Promise.all([client.invalidateQueries({ queryKey: sinistreKeys.providers() }),
      client.invalidateQueries({ queryKey: [...sinistreKeys.all, "eligible-prestataires"] })]); toast.success("Spécialité enregistrée"); },
    onError: error => toast.error(error.message) });
  function edit(item: ProviderSpecialty | null) {
    setEditing(item); setQuery(""); setForm(item ? { code: item.code, libelle: item.libelle, typePrestataire: item.typePrestataire, actif: item.actif, garantieIds: item.garanties.map(g => g.id) } : initial); setOpen(true);
  }
  if (!canManage) return <AccessDenied />;
  return <div className="grid gap-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-medium text-sky-700 dark:text-sky-400">Sinistres · Prestataires</p><h1 className="mt-1 text-xl font-semibold">Spécialités et garanties</h1></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/app/sinistre/prestataires"><ArrowLeft className="size-4" />Prestataires</Link></Button><Button onClick={() => edit(null)}><Plus className="size-4" />Ajouter une spécialité</Button></div></header>
    <section className="overflow-hidden rounded-md border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm">
      <thead className="bg-sky-700 text-left text-xs uppercase text-white"><tr>{["Code", "Spécialité", "Type", "Garanties liées", "Statut", "Action"].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
      <tbody className="divide-y">{data.isPending ? <TableRowsSkeleton colSpan={6} rows={5} /> : data.isError ? <tr><td colSpan={6} className="p-8 text-center"><p role="alert" className="text-destructive">{data.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void data.refetch()}>Réessayer</Button></td></tr>
        : !data.data.length ? <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Aucune spécialité configurée.</td></tr>
          : data.data.map(item => <tr key={item.id}><td className="px-3 py-3">{item.code}</td><td className="px-3 py-3 font-medium">{item.libelle}</td><td className="px-3 py-3">{item.typePrestataire === "GARAGE" ? "Garage" : "Expert"}</td>
            <td className="max-w-xl px-3 py-3">{item.garanties.map(g => g.libelle).join(", ")}</td><td className="px-3 py-3"><Badge variant={item.actif ? "success" : "gray"}>{item.actif ? "Active" : "Inactive"}</Badge></td><td className="px-3 py-3"><Button variant="ghost" size="icon" title="Modifier la spécialité" aria-label={`Modifier ${item.libelle}`} onClick={() => edit(item)}><Pencil className="size-4" /></Button></td></tr>)}</tbody>
    </table></div></section>
    <Dialog open={open} onOpenChange={value => { if (!save.isPending) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{editing ? "Modifier la spécialité" : "Ajouter une spécialité"}</DialogTitle><DialogDescription className="sr-only">Spécialité et garanties compatibles</DialogDescription></DialogHeader>
      <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label>Code <span className="text-red-500">*</span></Label><Input maxLength={40} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} /></div>
        <div className="grid gap-1.5"><Label>Libellé <span className="text-red-500">*</span></Label><Input maxLength={180} value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} /></div>
        <div className="grid gap-1.5"><Label>Type de prestataire</Label><Select value={form.typePrestataire} onValueChange={value => setForm(f => ({ ...f, typePrestataire: value as ProviderKind }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GARAGE">Garage</SelectItem><SelectItem value="EXPERT">Expert</SelectItem></SelectContent></Select></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.actif} onCheckedChange={value => setForm(f => ({ ...f, actif: value === true }))} />Active</label>
        <div className="grid gap-3 border-t pt-3 sm:col-span-2"><Label>Garanties liées <span className="text-red-500">*</span></Label><Input aria-label="Rechercher une garantie" placeholder="Code ou libellé" value={query} onChange={e => setQuery(e.target.value)} />
          {options.isError ? <p role="alert" className="text-sm text-destructive">{options.error.message}</p> : options.isPending ? <p role="status" className="text-sm text-muted-foreground">Chargement des garanties…</p> : <div className="grid max-h-72 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
            {options.data.garanties.filter(g => g.libelle.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))).map(g => <label key={g.id} className="flex items-start gap-2 text-sm"><Checkbox checked={form.garantieIds.includes(g.id)} onCheckedChange={checked => setForm(f => ({ ...f, garantieIds: checked ? [...f.garantieIds, g.id] : f.garantieIds.filter(id => id !== g.id) }))} /><span>{g.libelle}</span></label>)}
          </div>}
        </div>
      </fieldset>
      <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>Annuler</Button><Button disabled={save.isPending || options.isPending || options.isError || !form.code.trim() || !form.libelle.trim() || !form.garantieIds.length} onClick={() => save.mutate()}>Enregistrer</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
