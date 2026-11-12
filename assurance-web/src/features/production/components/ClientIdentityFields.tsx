import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import { toDateOnly } from "../date";
import { IDENTITY_DOCUMENTS, identityDocument, internationalClient, type ClientProfile } from "../client-profile";

export function ClientIdentityFields({ client, onChange, onIdentityChange = onChange, onLookup, disabled,
  errors = {}, errorPrefix = "", lookupMessage }: {
  client: ClientProfile;
  onChange: (patch: Partial<ClientProfile>) => void;
  onIdentityChange?: (patch: Partial<ClientProfile>) => void;
  onLookup?: (params: { cin?: string; passport?: string; carteResidence?: string }, immediate: boolean) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
  errorPrefix?: string;
  lookupMessage?: ReactNode;
}) {
  const document = identityDocument(client);
  return <>
    {internationalClient(client) ? <Field label="Pièce d'identité" required error={errors[`${errorPrefix}typePieceIdentite`]}>
      <Select value={document.value} disabled={disabled} onValueChange={(value) => {
        onChange({ typePieceIdentite: value as ClientProfile["typePieceIdentite"], clientEtranger: true });
      }}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{IDENTITY_DOCUMENTS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </Field> : null}
    <Field label={`N° ${document.label}`} required error={errors[`${errorPrefix}${document.numberKey}`]}>
      <Input disabled={disabled} value={client[document.numberKey] ?? ""} maxLength={120}
        onBlur={() => onLookup?.({ [document.numberKey]: client[document.numberKey] }, true)}
        onChange={(event) => {
          onIdentityChange({ [document.numberKey]: event.target.value, typePieceIdentite: document.value });
          onLookup?.({ [document.numberKey]: event.target.value }, false);
        }} />
      {lookupMessage}
    </Field>
    <Field label={document.expiryLabel} required error={errors[`${errorPrefix}${document.expiryKey}`]}>
      <DatePicker date={client[document.expiryKey]} disabled={disabled}
        onSelect={(date) => onChange({ [document.expiryKey]: toDateOnly(date), typePieceIdentite: document.value })} />
    </Field>
  </>;
}
