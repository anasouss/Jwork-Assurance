import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "../Field";
import type { ReferenceOption } from "../../types";
import {
  COMPANY_CONTACT_SERVICES,
  COMPANY_CONTACT_SERVICE_LABELS,
  type CompanyContact,
  type CompanyContactService,
  type UpsertCompanyContactRequest,
} from "../../company-contacts/types";

type ContactForm = UpsertCompanyContactRequest & { compagnieId: string };

type Props = {
  open: boolean;
  contact: CompanyContact | null;
  initialCompanyId?: string;
  companies: ReferenceOption[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (companyId: string, request: UpsertCompanyContactRequest) => void;
};

export function CompanyContactDialog({
  open, contact, initialCompanyId, companies, saving, onOpenChange, onSubmit,
}: Props) {
  const [form, setForm] = useState<ContactForm>(() => emptyForm(initialCompanyId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(contact ? contactForm(contact) : emptyForm(initialCompanyId));
    setError(null);
  }, [contact, initialCompanyId, open]);

  function submit() {
    const normalized = normalize(form);
    if (!form.compagnieId) return setError("La compagnie est obligatoire.");
    if (!normalized.nom) return setError("Le nom est obligatoire.");
    if (!normalized.email && !normalized.telephoneMobile && !normalized.telephoneFixe) {
      return setError("Renseignez au moins un e-mail, un mobile ou un téléphone fixe.");
    }
    if (normalized.whatsapp && !normalized.telephoneMobile) {
      return setError("Un numéro mobile est requis pour activer WhatsApp.");
    }
    setError(null);
    onSubmit(form.compagnieId, normalized);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-5 text-amber-600" />
            {contact ? "Modifier le contact" : "Ajouter un contact"}
          </DialogTitle>
          <DialogDescription>
            Interlocuteur opérationnel de votre agence auprès de la compagnie.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Compagnie" required>
            <Select
              value={form.compagnieId}
              disabled={Boolean(contact)}
              onValueChange={(value) => setForm((current) => ({ ...current, compagnieId: value }))}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner une compagnie" /></SelectTrigger>
              <SelectContent>
                {companies.filter((company) => company.actif !== false).map((company) => (
                  <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Service" required>
            <Select
              value={form.service}
              onValueChange={(value) => setForm((current) => ({ ...current, service: value as CompanyContactService }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPANY_CONTACT_SERVICES.map((service) => (
                  <SelectItem key={service} value={service}>{COMPANY_CONTACT_SERVICE_LABELS[service]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nom" required>
            <Input value={form.nom} maxLength={100} onChange={(event) => update(setForm, { nom: event.target.value })} />
          </Field>
          <Field label="Prénom">
            <Input value={form.prenom ?? ""} maxLength={100} onChange={(event) => update(setForm, { prenom: event.target.value })} />
          </Field>
          <Field label="Fonction">
            <Input value={form.fonction ?? ""} maxLength={150} onChange={(event) => update(setForm, { fonction: event.target.value })} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email ?? ""} maxLength={150} onChange={(event) => update(setForm, { email: event.target.value })} />
          </Field>
          <Field label="Téléphone mobile">
            <Input type="tel" value={form.telephoneMobile ?? ""} maxLength={50} onChange={(event) => update(setForm, { telephoneMobile: event.target.value })} />
          </Field>
          <Field label="Téléphone fixe">
            <Input type="tel" value={form.telephoneFixe ?? ""} maxLength={50} onChange={(event) => update(setForm, { telephoneFixe: event.target.value })} />
          </Field>
          <Field label="Poste téléphonique">
            <Input value={form.posteTelephonique ?? ""} maxLength={30} onChange={(event) => update(setForm, { posteTelephonique: event.target.value })} />
          </Field>
          <Field label="Fax">
            <Input type="tel" value={form.fax ?? ""} maxLength={50} onChange={(event) => update(setForm, { fax: event.target.value })} />
          </Field>
          <ToggleField
            label="WhatsApp"
            description="Le numéro mobile peut être contacté sur WhatsApp."
            checked={Boolean(form.whatsapp)}
            onCheckedChange={(checked) => update(setForm, { whatsapp: checked })}
          />
          <ToggleField
            label="Contact principal"
            description="Remplace le contact principal actuel de ce service."
            checked={Boolean(form.principal)}
            onCheckedChange={(checked) => update(setForm, { principal: checked })}
          />
          <Field label="Notes" className="md:col-span-2">
            <Textarea
              rows={3}
              maxLength={1000}
              value={form.notes ?? ""}
              onChange={(event) => update(setForm, { notes: event.target.value })}
            />
          </Field>
        </div>

        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="button" disabled={saving} onClick={submit}>
            {contact ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleField({ label, description, checked, onCheckedChange }: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 rounded-md border px-3 py-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function emptyForm(companyId?: string): ContactForm {
  return { compagnieId: companyId ?? "", nom: "", service: "PRODUCTION", whatsapp: false, principal: false };
}

function contactForm(contact: CompanyContact): ContactForm {
  return {
    compagnieId: contact.compagnieAssuranceId,
    nom: contact.nom,
    prenom: contact.prenom ?? "",
    service: contact.service,
    fonction: contact.fonction ?? "",
    email: contact.email ?? "",
    telephoneMobile: contact.telephoneMobile ?? "",
    telephoneFixe: contact.telephoneFixe ?? "",
    posteTelephonique: contact.posteTelephonique ?? "",
    whatsapp: contact.whatsapp,
    fax: contact.fax ?? "",
    principal: contact.principal,
    notes: contact.notes ?? "",
  };
}

function normalize(form: ContactForm): UpsertCompanyContactRequest {
  return {
    nom: form.nom.trim(),
    prenom: optional(form.prenom),
    service: form.service,
    fonction: optional(form.fonction),
    email: optional(form.email)?.toLowerCase(),
    telephoneMobile: optional(form.telephoneMobile),
    telephoneFixe: optional(form.telephoneFixe),
    posteTelephonique: optional(form.posteTelephonique),
    whatsapp: Boolean(form.whatsapp),
    fax: optional(form.fax),
    principal: Boolean(form.principal),
    notes: optional(form.notes),
  };
}

function optional(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function update(setter: Dispatch<SetStateAction<ContactForm>>, patch: Partial<ContactForm>) {
  setter((current) => ({ ...current, ...patch }));
}
