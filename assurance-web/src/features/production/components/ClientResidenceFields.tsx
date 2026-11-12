import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Field } from "./Field";
import { referenceApi } from "../api/references";
import { foreignResidence, type ClientProfile } from "../client-profile";
import type { ReferenceOption } from "../types";

export function ClientResidenceFields({ client, onChange, villes, disabled, errors = {}, errorPrefix = "", addressClassName }: {
  client: ClientProfile;
  onChange: (patch: Partial<ClientProfile>) => void;
  villes: ReferenceOption[];
  disabled?: boolean;
  errors?: Record<string, string>;
  errorPrefix?: string;
  addressClassName?: string;
}) {
  const countries = useQuery({ queryKey: ["referentiel", "pays"], queryFn: () => referenceApi.list("pays"), staleTime: Infinity });
  const foreign = foreignResidence(client);
  const country = client.paysResidence ?? "MA";
  return <>
    <Field label="Pays de résidence" required error={errors[`${errorPrefix}paysResidence`]}>
      <AutocompleteSelect value={country} disabled={disabled} placeholder="Pays"
        options={(countries.data ?? []).map((item) => ({ value: item.id, label: item.libelle, keywords: item.code }))}
        emptyText={countries.isError ? "Liste des pays indisponible" : "Aucun pays trouvé"}
        invalidText="Sélectionnez un pays existant."
        onValueChange={(value) => onChange({ paysResidence: value || undefined,
          villeId: value === country ? client.villeId : undefined,
          villeEtrangere: value === country ? client.villeEtrangere : undefined })} />
    </Field>
    {foreign ? <Field label="Ville à l'étranger" required error={errors[`${errorPrefix}villeEtrangere`]}>
      <Input value={client.villeEtrangere ?? ""} maxLength={160} disabled={disabled}
        onChange={(event) => onChange({ villeEtrangere: event.target.value })} />
    </Field> : <Field label="Ville" required error={errors[`${errorPrefix}villeId`]}>
      <AutocompleteSelect value={client.villeId ?? ""} disabled={disabled} placeholder="Ville"
        options={villes.map((ville) => ({ value: ville.id, label: ville.libelle, keywords: ville.code }))}
        emptyText="Aucune ville trouvée" invalidText="Choisissez une ville existante."
        onValueChange={(value) => onChange({ villeId: value })} />
    </Field>}
    <Field label="Adresse" required error={errors[`${errorPrefix}adresse`]} className={addressClassName}>
      <Input value={client.adresse ?? ""} maxLength={255} disabled={disabled}
        onChange={(event) => onChange({ adresse: event.target.value })} />
    </Field>
  </>;
}
