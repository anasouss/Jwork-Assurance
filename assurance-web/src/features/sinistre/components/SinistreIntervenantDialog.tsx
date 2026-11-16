import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateOnly } from "@/features/production/date";
import { sinistreApi, sinistreKeys } from "../api";
import type { Intervenant, ProviderAgreement, ProviderKind } from "../types";
import { providerTypes } from "../provider-types";
import { ProviderAgreementUsageSelect } from "./ProviderAgreementUsageSelect";
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
      accords: intervenant?.accords?.map(a => ({ ...a, tousUsages: a.tousUsages ?? true, usages: a.usages ?? [] })) ?? [],
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
      accords: form.accords.map(a => ({ compagnieId: a.compagnieId, actif: a.actif, conventionne: a.conventionne,
        dateDebut: a.dateDebut, dateFin: a.dateFin,
        ...(kind === "GARAGE" ? { tousUsages: a.tousUsages, usageIds: a.usages.map(u => u.id) } : {}) })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl" showCloseButton={!saving}>
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <DialogTitle>
            {intervenant ? "Modifier" : "Ajouter"}{" "}
            {providerTypes.find(type => type.value === kind)?.singular ?? "un prestataire"}
          </DialogTitle>
          <DialogDescription className="sr-only">Coordonnées de l’intervenant</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="sm:col-span-2 lg:col-span-3">
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
          {form.accords.length > 0 && <div className="min-w-0 overflow-x-auto"><table className="w-full min-w-[600px] table-fixed text-sm">
            <caption className="sr-only">Accords avec les compagnies</caption>
            <colgroup><col /><col className="w-14" /><col className="w-28" />{kind === "GARAGE" && <col className="w-48" />}<col className="w-20" /></colgroup>
            <thead className="border-b text-left text-xs text-muted-foreground"><tr>
              <th className="px-2 py-2 font-medium">Compagnie <span className="text-destructive">*</span></th><th className="px-2 py-2 text-center font-medium">Actif</th>
              <th className="px-2 py-2 text-center font-medium">Conventionné</th>{kind === "GARAGE" && <th className="px-2 py-2 font-medium">Usages autorisés</th>}
              <th className="px-2 py-2"><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody className="divide-y">{form.accords.map((agreement, index) => {
            const change = (patch: Partial<ProviderAgreement>) => update("accords", form.accords.map((a, i) => i === index ? { ...a, ...patch } : a));
            const invalidPeriod = Boolean(agreement.dateDebut && agreement.dateFin && agreement.dateDebut > agreement.dateFin);
            return <tr key={index}>
              <td className="px-2 py-2"><Select value={agreement.compagnieId} disabled={saving} onValueChange={value => change({ compagnieId: value })}>
                <SelectTrigger aria-label={`Compagnie de l'accord ${index + 1}`}><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{(options.data?.compagnies ?? []).filter(c => c.id === agreement.compagnieId || !form.accords.some(a => a.compagnieId === c.id)).map(c => <SelectItem key={c.id} value={c.id}>{c.libelle}</SelectItem>)}</SelectContent>
              </Select></td>
              <td className="px-2 py-2 text-center"><Checkbox aria-label={`Accord ${index + 1} actif`} checked={agreement.actif} onCheckedChange={value => change({ actif: value === true })} /></td>
              <td className="px-2 py-2 text-center"><Checkbox aria-label={`Accord ${index + 1} conventionné`} checked={agreement.conventionne} onCheckedChange={value => change({ conventionne: value === true })} /></td>
              {kind === "GARAGE" && <td className="px-2 py-2"><ProviderAgreementUsageSelect agreement={agreement} options={options.data?.usages ?? []} disabled={saving || options.isPending || options.isError} onChange={change} /></td>}
              <td className="px-1 py-2"><div className="flex items-center justify-end">
                <Popover><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" disabled={saving}
                  className={invalidPeriod ? "text-destructive" : agreement.dateDebut || agreement.dateFin ? "text-primary" : "text-muted-foreground"}
                  title={invalidPeriod ? "Période de validité invalide" : "Période de validité"} aria-label={`Période de validité de l'accord ${index + 1}`}>
                  <CalendarDays className="size-4" />
                </Button></PopoverTrigger><PopoverContent align="end" className="grid w-[min(22rem,calc(100vw-2rem))] gap-3">
                  <p className="text-sm font-semibold">Période de validité</p>
                  <Field label="Du"><DatePicker disabled={saving} date={agreement.dateDebut ?? ""} onSelect={date => change({ dateDebut: toDateOnly(date) ?? null })} /></Field>
                  <Field label="Au"><DatePicker disabled={saving} date={agreement.dateFin ?? ""} onSelect={date => change({ dateFin: toDateOnly(date) ?? null })} /></Field>
                  {invalidPeriod && <p role="alert" className="text-sm text-destructive">La fin ne peut pas précéder le début.</p>}
                </PopoverContent></Popover>
                <Button type="button" variant="ghost" size="icon" title="Retirer l'accord" aria-label={`Retirer l'accord ${index + 1}`} onClick={() => update("accords", form.accords.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button>
              </div></td>
            </tr>;
          })}</tbody></table></div>}
          {form.accords.some(a => a.dateDebut && a.dateFin && a.dateDebut > a.dateFin) && <p role="alert" className="text-sm text-destructive">Un accord contient une période de validité invalide.</p>}
          <Button type="button" variant="outline" className="justify-self-start" disabled={options.isPending || options.isError || form.accords.some(a => !a.compagnieId)} onClick={() => update("accords", [...form.accords, { compagnieId: "", actif: true, conventionne: false, tousUsages: true, usages: [], conventionneActuellement: false }])}><Plus className="size-4" />Ajouter une compagnie</Button>
        </fieldset>
        {(options.isError || specialties.isError) && <p role="alert" className="text-sm text-destructive">{options.error?.message || specialties.error?.message}</p>}
        </div>
        <DialogFooter className="shrink-0 border-t px-5 py-3">
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!form.code.trim() || !form.nom.trim() || saving || options.isPending || specialties.isPending || options.isError || specialties.isError || domains.isPending || domains.isError
              || (!form.toutesCompagnies && !form.accords.length) || form.accords.some(a => !a.compagnieId
                || (kind === "GARAGE" && !a.tousUsages && !a.usages.length)
                || (a.dateDebut && a.dateFin && a.dateDebut > a.dateFin))}
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
