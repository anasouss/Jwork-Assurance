import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateOnly } from "@/features/production/date";
import { sinistreApi, sinistreKeys } from "../api";
import type { Intervenant, ProviderAgreement, ProviderKind } from "../types";
import { providerTypes } from "../provider-types";
import {
  SinistreVilleSelect,
  type CityOption,
} from "./SinistreVilleSelect";

export type IntervenantKind = ProviderKind;

export function SinistreIntervenantDialog({
  open,
  kind,
  intervenant,
  cities,
  saving,
  onOpenChange,
  onSubmit,
  initialDomaineId,
  initialSpecialiteId,
}: {
  open: boolean;
  kind: IntervenantKind;
  intervenant: Intervenant | null;
  cities: CityOption[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: object) => void;
  initialDomaineId?: string;
  initialSpecialiteId?: string;
}) {
  const [form, setForm] = useState({
    code: "",
    nom: "",
    telephone: "",
    email: "",
    adresse: "",
    villeId: "",
    actif: true,
    toutesCompagnies: true,
    specialiteIds: [] as string[],
    domaineIds: [] as string[],
    accords: [] as ProviderAgreement[],
  });
  const options = useQuery({ queryKey: sinistreKeys.providerOptions(), queryFn: sinistreApi.providerOptions, enabled: open });
  const specialties = useQuery({ queryKey: sinistreKeys.specialties(), queryFn: sinistreApi.specialties, enabled: open });
  const domains = useQuery({ queryKey: sinistreKeys.providerDomains(), queryFn: sinistreApi.providerDomains, enabled: open });

  useEffect(() => {
    if (!open) return;
    setForm({
      code: intervenant?.code ?? "",
      nom: intervenant?.nom ?? "",
      telephone: intervenant?.telephone ?? "",
      email: intervenant?.email ?? "",
      adresse: intervenant?.adresse ?? "",
      villeId: intervenant?.villeId ?? "",
      actif: intervenant?.actif ?? true,
      toutesCompagnies: intervenant?.toutesCompagnies ?? true,
      specialiteIds: intervenant?.specialites?.map(s => s.id) ?? (initialSpecialiteId ? [initialSpecialiteId] : []),
      domaineIds: intervenant?.domaines?.map(d => d.id) ?? (initialDomaineId ? [initialDomaineId] : []),
      accords: intervenant?.accords?.map(a => ({ ...a })) ?? [],
    });
  }, [intervenant, open, initialDomaineId, initialSpecialiteId]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    onSubmit({
      code: form.code.trim(),
      [kind === "GARAGE" ? "raisonSociale" : "nom"]: form.nom.trim(),
      telephone: form.telephone.trim() || undefined,
      email: form.email.trim() || undefined,
      adresse: form.adresse.trim() || undefined,
      villeId: form.villeId || undefined,
      actif: form.actif,
      toutesCompagnies: form.toutesCompagnies,
      specialiteIds: form.specialiteIds,
      domaineIds: form.domaineIds,
      accords: form.accords,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>
            {intervenant ? "Modifier" : "Ajouter"}{" "}
            {providerTypes.find(type => type.value === kind)?.singular ?? "un prestataire"}
          </DialogTitle>
          <DialogDescription className="sr-only">Coordonnées de l’intervenant</DialogDescription>
        </DialogHeader>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" required>
            <Input
              value={form.code}
              maxLength={40}
              onChange={(event) =>
                update("code", event.target.value.toUpperCase())
              }
            />
          </Field>
          <Field label={kind === "GARAGE" ? "Raison sociale" : "Nom"} required>
            <Input
              value={form.nom}
              maxLength={180}
              onChange={(event) => update("nom", event.target.value)}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={form.telephone}
              maxLength={60}
              onChange={(event) => update("telephone", event.target.value)}
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={form.email}
              maxLength={180}
              onChange={(event) => update("email", event.target.value)}
            />
          </Field>
          <Field label="Ville">
            <SinistreVilleSelect
              cities={cities}
              value={form.villeId}
              onValueChange={(value) => update("villeId", value)}
            />
          </Field>
          <div className="flex items-end">
            <label className="flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm">
              Actif
              <Switch
                checked={form.actif}
                onCheckedChange={(value) => update("actif", value)}
              />
            </label>
          </div>
          <div className="sm:col-span-2">
            <Field label="Adresse">
              <Input
                value={form.adresse}
                maxLength={500}
                onChange={(event) => update("adresse", event.target.value)}
              />
            </Field>
          </div>
        </fieldset>
        <fieldset disabled={saving} className="grid gap-3 border-t pt-4">
          <legend className="text-sm font-semibold">Domaines d’intervention</legend>
          <div className="grid gap-2 sm:grid-cols-2">{domains.data?.filter(d => d.operateurs.includes(kind) && (d.actif || form.domaineIds.includes(d.id))).map(domain => <label key={domain.id} className="flex items-start gap-2 text-sm">
            <Checkbox checked={form.domaineIds.includes(domain.id)} disabled={!domain.actif && !form.domaineIds.includes(domain.id)} onCheckedChange={checked => update("domaineIds", checked ? [...form.domaineIds, domain.id] : form.domaineIds.filter(id => id !== domain.id))} />
            <span>{domain.libelle}{!domain.actif ? " (inactif)" : ""}</span>
          </label>)}</div>
          {domains.isError && <p role="alert" className="text-sm text-destructive">{domains.error.message}</p>}
        </fieldset>
        <fieldset disabled={saving} className="grid gap-3 border-t pt-4">
          <legend className="text-sm font-semibold">Spécialités</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(specialties.data ?? []).filter(s => s.typePrestataire === kind).map(s => <label key={s.id} className="flex items-start gap-2 text-sm">
              <Checkbox checked={form.specialiteIds.includes(s.id)} disabled={!s.actif && !form.specialiteIds.includes(s.id)} onCheckedChange={checked => update("specialiteIds", checked ? [...form.specialiteIds, s.id] : form.specialiteIds.filter(id => id !== s.id))} />
              <span>{s.libelle}{!s.actif ? " (inactive)" : ""}<span className="block text-xs text-muted-foreground">{s.garanties.map(g => g.libelle).join(", ")}</span></span>
            </label>)}
          </div>
          {specialties.isSuccess && !specialties.data.some(s => s.typePrestataire === kind) && <p className="text-sm text-muted-foreground">Aucune spécialité configurée pour ce type de prestataire.</p>}
        </fieldset>
        <fieldset disabled={saving} className="grid gap-3 border-t pt-4">
          <legend className="text-sm font-semibold">Compagnies et accords</legend>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.toutesCompagnies} onCheckedChange={checked => update("toutesCompagnies", checked === true)} />Intervient pour toutes les compagnies, même sans accord</label>
          {form.accords.map((agreement, index) => {
            const change = (patch: Partial<ProviderAgreement>) => update("accords", form.accords.map((a, i) => i === index ? { ...a, ...patch } : a));
            return <div key={index} className="grid items-end gap-3 border-b pb-3 sm:grid-cols-2 lg:grid-cols-[minmax(160px,1fr)_auto_auto_140px_140px_auto]">
              <Field label="Compagnie" required><Select value={agreement.compagnieId} onValueChange={value => change({ compagnieId: value })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{(options.data?.compagnies ?? []).filter(c => c.id === agreement.compagnieId || !form.accords.some(a => a.compagnieId === c.id)).map(c => <SelectItem key={c.id} value={c.id}>{c.libelle}</SelectItem>)}</SelectContent>
              </Select></Field>
              <label className="flex h-10 items-center gap-2 text-sm"><Checkbox checked={agreement.actif} onCheckedChange={value => change({ actif: value === true })} />Actif</label>
              <label className="flex h-10 items-center gap-2 text-sm"><Checkbox checked={agreement.conventionne} onCheckedChange={value => change({ conventionne: value === true })} />Conventionné</label>
              <Field label="Du"><DatePicker date={agreement.dateDebut ?? ""} onSelect={date => change({ dateDebut: toDateOnly(date) ?? null })} /></Field>
              <Field label="Au"><DatePicker date={agreement.dateFin ?? ""} onSelect={date => change({ dateFin: toDateOnly(date) ?? null })} /></Field>
              <Button type="button" variant="ghost" size="icon" title="Retirer l'accord" aria-label="Retirer l'accord" onClick={() => update("accords", form.accords.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button>
            </div>;
          })}
          <Button type="button" variant="outline" className="justify-self-start" disabled={options.isPending || options.isError || form.accords.some(a => !a.compagnieId)} onClick={() => update("accords", [...form.accords, { compagnieId: "", actif: true, conventionne: false }])}><Plus className="size-4" />Ajouter une compagnie</Button>
        </fieldset>
        {(options.isError || specialties.isError) && <p role="alert" className="text-sm text-destructive">{options.error?.message || specialties.error?.message}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!form.code.trim() || !form.nom.trim() || saving || options.isPending || specialties.isPending || options.isError || specialties.isError || domains.isPending || domains.isError
              || (!form.toutesCompagnies && !form.accords.length) || form.accords.some(a => !a.compagnieId || (a.dateDebut && a.dateFin && a.dateDebut > a.dateFin))}
            onClick={submit}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required ? <span className="text-red-500">*</span> : null}</Label>
      {children}
    </div>
  );
}
