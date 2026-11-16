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
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { sinistreApi, sinistreKeys } from "../api";
import { providerTypes, providerTypeLabel } from "../provider-types";
import type { ProviderDomain, ProviderKind } from "../types";

const empty = { code: "", libelle: "", brancheId: "", actif: true, operateurs: [] as ProviderKind[] };

export default function SinistreDomainesPage() {
  const permissions = useAuthStore(s => s.user?.permissions ?? []);
  const canView = permissions.includes("domaine-prestataire:view");
  const canCreate = permissions.includes("domaine-prestataire:create");
  const canUpdate = permissions.includes("domaine-prestataire:update");
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderDomain | null>(null);
  const [form, setForm] = useState(empty);
  const result = useQuery({ queryKey: sinistreKeys.providerDomains(), queryFn: sinistreApi.providerDomains, enabled: canView });
  const options = useQuery({ queryKey: sinistreKeys.providerOptions(), queryFn: sinistreApi.providerOptions, enabled: canView });
  const save = useMutation({ mutationFn: () => sinistreApi.saveProviderDomain(editing?.id ?? null, form),
    onSuccess: async () => {
      setOpen(false);
      await client.invalidateQueries({ queryKey: sinistreKeys.providers() });
      toast.success("Domaine enregistré");
    }, onError: error => toast.error(error.message) });
  function edit(domain: ProviderDomain | null) {
    setEditing(domain);
    setForm(domain ? { code: domain.code, libelle: domain.libelle, brancheId: domain.brancheId, actif: domain.actif, operateurs: domain.operateurs } : empty);
    setOpen(true);
  }
  if (!canView) return <AccessDenied />;
  return <div className="grid gap-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-medium text-sky-700 dark:text-sky-400">Sinistres · Prestataires</p><h1 className="mt-1 text-xl font-semibold">Domaines d’intervention</h1></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/app/sinistre/prestataires"><ArrowLeft className="size-4" />Prestataires</Link></Button>{canCreate && <Button onClick={() => edit(null)}><Plus className="size-4" />Ajouter un domaine</Button>}</div>
    </header>
    <section className="overflow-hidden rounded-md border"><div className="overflow-x-auto"><table className="w-full min-w-[750px] text-sm">
      <thead className="bg-sky-700 text-left text-xs uppercase text-white"><tr>{["Code", "Domaine", "Branche de production", "Opérateurs autorisés", "Statut", "Actions"].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
      <tbody className="divide-y">{result.isPending ? <TableRowsSkeleton colSpan={6} rows={5} /> : result.isError ? <tr><td colSpan={6} className="p-8 text-center"><p role="alert" className="text-destructive">{result.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void result.refetch()}>Réessayer</Button></td></tr>
        : !result.data.length ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun domaine configuré.</td></tr>
          : result.data.map(domain => <tr key={domain.id}><td className="px-3 py-3">{domain.code}</td><td className="px-3 py-3 font-medium">{domain.libelle}</td><td className="px-3 py-3">{domain.branche}</td><td className="max-w-md px-3 py-3">{domain.operateurs.map(providerTypeLabel).join(", ")}</td><td className="px-3 py-3"><Badge variant={domain.actif ? "success" : "gray"}>{domain.actif ? "Actif" : "Inactif"}</Badge></td>
            <td className="px-3 py-3">{canUpdate && <Button variant="ghost" size="icon" title="Modifier le domaine" aria-label={`Modifier ${domain.libelle}`} onClick={() => edit(domain)}><Pencil className="size-4" /></Button>}</td></tr>)}</tbody>
    </table></div></section>
    <Dialog open={open} onOpenChange={value => { if (!save.isPending) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{editing ? "Modifier le domaine" : "Ajouter un domaine"}</DialogTitle><DialogDescription className="sr-only">Paramétrage du domaine, de sa branche et de ses opérateurs</DialogDescription></DialogHeader>
      <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="domain-code">Code <span className="text-destructive">*</span></Label><Input id="domain-code" maxLength={40} value={form.code} onChange={event => setForm(f => ({ ...f, code: event.target.value.toUpperCase() }))} /></div>
        <div className="grid gap-1.5"><Label htmlFor="domain-label">Libellé <span className="text-destructive">*</span></Label><Input id="domain-label" maxLength={180} value={form.libelle} onChange={event => setForm(f => ({ ...f, libelle: event.target.value }))} /></div>
        <div className="grid gap-1.5"><Label htmlFor="domain-branch">Branche de production <span className="text-destructive">*</span></Label><Select value={form.brancheId} onValueChange={value => setForm(f => ({ ...f, brancheId: value }))}>
          <SelectTrigger id="domain-branch"><SelectValue placeholder="Sélectionner une branche" /></SelectTrigger><SelectContent>
            {editing && !options.data?.branches.some(b => b.id === editing.brancheId) && <SelectItem value={editing.brancheId}>{editing.branche}</SelectItem>}
            {options.data?.branches.map(b => <SelectItem key={b.id} value={b.id}>{b.libelle}</SelectItem>)}
          </SelectContent></Select></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.actif} onCheckedChange={value => setForm(f => ({ ...f, actif: value === true }))} />Actif</label>
        <div className="grid gap-3 border-t pt-3 sm:col-span-2"><Label>Opérateurs autorisés <span className="text-destructive">*</span></Label><div className="grid gap-3 sm:grid-cols-2">
          {providerTypes.map(type => <label key={type.value} className="flex items-center gap-2 text-sm"><Checkbox checked={form.operateurs.includes(type.value)} onCheckedChange={checked => setForm(f => ({ ...f, operateurs: checked ? [...f.operateurs, type.value] : f.operateurs.filter(t => t !== type.value) }))} />{type.label}</label>)}
        </div></div>
      </fieldset>
      {options.isError && <p role="alert" className="text-sm text-destructive">{options.error.message}</p>}
      <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>Annuler</Button><Button disabled={(editing ? !canUpdate : !canCreate) || save.isPending || options.isPending || options.isError || !form.code.trim() || !form.libelle.trim() || !form.brancheId || !form.operateurs.length} onClick={() => save.mutate()}>Enregistrer</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
