import type { ReactNode } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import type { ClientResponse } from "@/features/production/types";
import { cn } from "@/lib/utils";
import { clientProfileSections } from "../client-record";

export function ClientProfileDetails({ client, className }: { client: ClientResponse; className?: string }) {
  const sections = clientProfileSections(client);
  const phones: NonNullable<ClientResponse["telephones"]> = client.telephones?.length ? client.telephones : client.telephone ? [{ numero: client.telephone }] : [];
  return <div className={cn("grid items-start gap-6", className)}>
    {sections.filter(section => section.key === "identity").map(section => <ProfileSection key={section.key} section={section} />)}
    <section className="min-w-0 space-y-3">
      <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">Coordonnées</h3>
      <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
        <ProfileField label="Téléphones" icon={<Phone className="size-3.5" aria-hidden="true" />}>
          {phones.length ? <ul className="space-y-1.5">{phones.map((phone, index) => <li key={`${phone.numero}-${index}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <a className="text-blue-700 underline-offset-4 hover:underline focus-visible:underline dark:text-blue-300" href={`tel:${phone.numero.replace(/\s/g, "")}`}>{phone.numero}</a>
            {phone.principal && <span className="text-xs text-muted-foreground">(principal)</span>}
            {phone.whatsapp && <span className="text-xs text-emerald-700 dark:text-emerald-300">WhatsApp</span>}
          </li>)}</ul> : "-"}
        </ProfileField>
        {client.email && <ProfileField label="E-mail" icon={<Mail className="size-3.5" aria-hidden="true" />}><a className="break-all text-blue-700 underline-offset-4 hover:underline focus-visible:underline dark:text-blue-300" href={`mailto:${client.email}`}>{client.email}</a></ProfileField>}
        {(client.adresse || client.ville) && <div className="sm:col-span-2"><ProfileField label="Adresse" icon={<MapPin className="size-3.5" aria-hidden="true" />}>{[client.adresse, client.ville].filter(Boolean).join(", ")}</ProfileField></div>}
      </dl>
    </section>
    {sections.filter(section => section.key === "licence").map(section => <ProfileSection key={section.key} section={section} />)}
  </div>;
}

function ProfileSection({ section }: { section: ReturnType<typeof clientProfileSections>[number] }) {
  return <section className="min-w-0 space-y-3">
    <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">{section.title}</h3>
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {section.fields.map(field => <ProfileField key={field.label} label={field.label}>{field.value}</ProfileField>)}
    </dl>
  </section>;
}

function ProfileField({ label, children, icon }: { label: string; children: ReactNode; icon?: ReactNode }) {
  return <div className="min-w-0"><dt className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</dt><dd className="break-words font-medium">{children}</dd></div>;
}
