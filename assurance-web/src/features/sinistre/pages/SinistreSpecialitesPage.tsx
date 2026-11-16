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
import { providerTypes, providerTypeLabel } from "../provider-types";

const initial = { code: "", libelle: "", typePrestataire: "GARAGE" as ProviderKind, actif: true, garantieIds: [] as string[], domaineIds: [] as string[] };

export default function SinistreSpecialitesPage() {
  const permissions = useAuthStore(s => s.user?.permissions ?? []);
  const canView = permissions.includes("specialite-prestataire:view");
  const canCreate = permissions.includes("specialite-prestataire:create");
  const canUpdate = permissions.includes("specialite-prestataire:update");
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderSpecialty | null>(null);
  const [form, setForm] = useState(initial);
  const [query, setQuery] = useState("");
  const data = useQuery({ queryKey: sinistreKeys.specialties(), queryFn: sinistreApi.specialties, enabled: canView });
  const options = useQuery({ queryKey: sinistreKeys.providerOptions(), queryFn: sinistreApi.providerOptions, enabled: canView });
  const domains = useQuery({ queryKey: sinistreKeys.providerDomains(), queryFn: sinistreApi.providerDomains, enabled: canView });
  const save = useMutation({ mutationFn: () => sinistreApi.saveSpecialty(editing?.id ?? null, form),
    onSuccess: async () => { setOpen(false); await Promise.all([client.invalidateQueries({ queryKey: sinistreKeys.providers() }),
      client.invalidateQueries({ queryKey: [...sinistreKeys.all, "eligible-prestataires"] })]); toast.success("Spécialité enregistrée"); },
    onError: error => toast.error(error.message) });
  function edit(item: ProviderSpecialty | null) {
    if (item ? !canUpdate : !canCreate) return;
    setEditing(item); setQuery(""); setForm(item ? { code: item.code, libelle: item.libelle, typePrestataire: item.typePrestataire, actif: item.actif, garantieIds: item.garanties.map(g => g.id), domaineIds: item.domaines.map(d => d.id) } : initial); setOpen(true);
  }
  if (!canView) return <AccessDenied />;
  return <div className="grid gap-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-medium text-sky-700 dark:text-sky-400">Sinistres · Prestataires</p><h1 className="mt-1 text-xl font-semibold">Spécialités et garanties</h1></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/app/sinistre/prestataires"><ArrowLeft className="size-4" />Prestataires</Link></Button>{permissions.includes("domaine-prestataire:view") && <Button asChild variant="outline"><Link to="/app/sinistre/prestataires/domaines">Domaines d’intervention</Link></Button>}{canCreate ? <Button onClick={() => edit(null)}><Plus className="size-4" />Ajouter une spécialité</Button> : null}</div></header>
    <section className="overflow-hidden rounded-md border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm">
      <thead className="bg-sky-700 text-left text-xs uppercase text-white"><tr>{["Code", "Spécialité", "Opérateur", "Domaines", "Garanties liées", "Statut", "Action"].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
      <tbody className="divide-y">{data.isPending ? <TableRowsSkeleton colSpan={7} rows={5} /> : data.isError ? <tr><td colSpan={7} className="p-8 text-center"><p role="alert" className="text-destructive">{data.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void data.refetch()}>Réessayer</Button></td></tr>
        : !data.data.length ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Aucune spécialité configurée.</td></tr>
          : data.data.map(item => <tr key={item.id}><td className="px-3 py-3">{item.code}</td><td className="px-3 py-3 font-medium">{item.libelle}</td><td className="px-3 py-3">{providerTypeLabel(item.typePrestataire)}</td><td className="px-3 py-3">{item.domaines.map(d => d.libelle).join(", ") || "-"}</td>
            <td className="max-w-xl px-3 py-3">{item.garanties.map(g => g.libelle).join(", ")}</td><td className="px-3 py-3"><Badge variant={item.actif ? "success" : "gray"}>{item.actif ? "Active" : "Inactive"}</Badge></td><td className="px-3 py-3">{canUpdate ? <Button variant="ghost" size="icon" title="Modifier la spécialité" aria-label={`Modifier ${item.libelle}`} onClick={() => edit(item)}><Pencil className="size-4" /></Button> : null}</td></tr>)}</tbody>
    </table></div></section>
    <Dialog open={open} onOpenChange={value => { if (!save.isPending) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{editing ? "Modifier la spécialité" : "Ajouter une spécialité"}</DialogTitle><DialogDescription className="sr-only">Spécialité et garanties compatibles</DialogDescription></DialogHeader>
      <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label>Code <span className="text-red-500">*</span></Label><Input maxLength={40} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} /></div>
        <div className="grid gap-1.5"><Label>Libellé <span className="text-red-500">*</span></Label><Input maxLength={180} value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} /></div>
        <div className="grid gap-1.5"><Label>Opérateur</Label><Select value={form.typePrestataire} disabled={!!editing} onValueChange={value => setForm(f => ({ ...f, typePrestataire: value as ProviderKind, domaineIds: [] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{providerTypes.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.actif} onCheckedChange={value => setForm(f => ({ ...f, actif: value === true }))} />Active</label>
        <div className="grid gap-3 border-t pt-3 sm:col-span-2"><Label>Domaines d’intervention</Label><div className="grid gap-2 sm:grid-cols-2">
          {domains.data?.filter(d => d.operateurs.includes(form.typePrestataire) && (d.actif || form.domaineIds.includes(d.id))).map(domain => <label key={domain.id} className="flex items-center gap-2 text-sm"><Checkbox checked={form.domaineIds.includes(domain.id)} disabled={!domain.actif && !form.domaineIds.includes(domain.id)} onCheckedChange={checked => setForm(f => ({ ...f, domaineIds: checked ? [...f.domaineIds, domain.id] : f.domaineIds.filter(id => id !== domain.id) }))} />{domain.libelle}</label>)}
        </div>{domains.isError && <p role="alert" className="text-sm text-destructive">{domains.error.message}</p>}</div>
        <div className="grid gap-3 border-t pt-3 sm:col-span-2"><Label>Garanties liées <span className="text-red-500">*</span></Label><Input aria-label="Rechercher une garantie" placeholder="Rechercher une garantie" value={query} onChange={e => setQuery(e.target.value)} />
          {options.isError ? <p role="alert" className="text-sm text-destructive">{options.error.message}</p> : options.isPending ? <p role="status" className="text-sm text-muted-foreground">Chargement des garanties…</p> : <div className="grid max-h-72 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
            {options.data.garanties.filter(g => g.libelle.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))).map(g => <label key={g.id} className="flex items-start gap-2 text-sm"><Checkbox checked={form.garantieIds.includes(g.id)} onCheckedChange={checked => setForm(f => ({ ...f, garantieIds: checked ? [...f.garantieIds, g.id] : f.garantieIds.filter(id => id !== g.id) }))} /><span>{g.libelle}</span></label>)}
          </div>}
        </div>
      </fieldset>
      <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>Annuler</Button><Button disabled={(editing ? !canUpdate : !canCreate) || save.isPending || options.isPending || options.isError || domains.isPending || domains.isError || !form.code.trim() || !form.libelle.trim() || !form.garantieIds.length} onClick={() => save.mutate()}>Enregistrer</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
