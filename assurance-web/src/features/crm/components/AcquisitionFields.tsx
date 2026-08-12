import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clientApi } from "@/features/production/api/clients";
import { toDateOnly } from "@/features/production/date";
import type { AcquisitionClient, AcquisitionOptions } from "@/features/production/types";

type AcquisitionFieldsProps = {
  value?: AcquisitionClient;
  options?: AcquisitionOptions;
  onChange: (value?: AcquisitionClient) => void;
  excludedClientId?: string;
  showNotes?: boolean;
};

export function AcquisitionFields({
  value,
  options,
  onChange,
  excludedClientId,
  showNotes = true,
}: AcquisitionFieldsProps) {
  const [clientSearch, setClientSearch] = useState("");
  const deferredClientSearch = useDeferredValue(clientSearch.trim());
  const selectedOrigin = options?.origines.find((origin) => origin.id === value?.origineCommercialeId);
  const clientResults = useQuery({
    queryKey: ["crm", "acquisition-referrer", deferredClientSearch],
    queryFn: () => clientApi.listClients({ query: deferredClientSearch, page: 0, size: 25 }),
    enabled: selectedOrigin?.type === "CLIENT" && deferredClientSearch.length >= 2,
    staleTime: 30_000,
  });
  const referringClients = useMemo(() => {
    const rows = (clientResults.data?.items ?? [])
      .filter((client) => client.id !== excludedClientId)
      .map((client) => ({
        id: client.id,
        label: client.nomAffichage || client.codeClient || client.id,
        keywords: [client.codeClient, client.cin, client.rc, client.ice].filter(Boolean).join(" "),
      }));
    if (value?.recommandeParClientId && value.recommandeParClientNom
      && !rows.some((client) => client.id === value.recommandeParClientId)) {
      return [{
        id: value.recommandeParClientId,
        label: value.recommandeParClientNom,
        keywords: "",
      }, ...rows];
    }
    return rows;
  }, [clientResults.data?.items, excludedClientId, value?.recommandeParClientId, value?.recommandeParClientNom]);

  const patch = (next: Partial<AcquisitionClient>) => {
    if (value) onChange({ ...value, ...next });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Origine du client">
        <Select
          value={value?.origineCommercialeId ?? "NON_RENSEIGNEE"}
          onValueChange={(originId) => {
            if (originId === "NON_RENSEIGNEE") {
              onChange(undefined);
              return;
            }
            onChange({
              origineCommercialeId: originId,
              dateAcquisition: value?.dateAcquisition ?? today(),
              notes: value?.notes,
            });
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NON_RENSEIGNEE">Non renseignée</SelectItem>
            {(options?.origines ?? [])
              .filter((origin) => origin.actif || origin.id === value?.origineCommercialeId)
              .map((origin) => (
                <SelectItem key={origin.id} value={origin.id}>{origin.libelle}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>

      {value ? (
        <Field label="Date d’acquisition">
          <DatePicker
            date={value.dateAcquisition ?? undefined}
            onSelect={(date) => patch({ dateAcquisition: toDateOnly(date) })}
          />
        </Field>
      ) : null}

      {selectedOrigin?.type === "COLLABORATEUR" && value ? (
        <Field label="Collaborateur recommandant" required>
          <Select
            value={value.recommandeParUtilisateurId ?? ""}
            onValueChange={(id) => patch({ recommandeParUtilisateurId: id, recommandeParClientId: null })}
          >
            <SelectTrigger><SelectValue placeholder="Choisir un collaborateur" /></SelectTrigger>
            <SelectContent>
              {(options?.collaborateurs ?? []).filter((user) => user.actif).map((user) => (
                <SelectItem key={user.id} value={user.id}>{user.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {selectedOrigin?.type === "CLIENT" && value ? (
        <Field label="Client recommandant" required>
          <AutocompleteSelect
            value={value.recommandeParClientId ?? ""}
            onQueryChange={setClientSearch}
            onValueChange={(id) => {
              const client = referringClients.find((item) => item.id === id);
              patch({
                recommandeParClientId: id,
                recommandeParClientNom: client?.label,
                recommandeParUtilisateurId: null,
              });
            }}
            options={referringClients.map((client) => ({
              value: client.id,
              label: client.label,
              keywords: client.keywords,
            }))}
            placeholder="Rechercher un client"
            emptyText={clientSearch.trim().length < 2 ? "Saisissez au moins 2 caractères" : "Aucun client trouvé"}
            invalidText="Choisissez un client existant."
          />
        </Field>
      ) : null}

      {value && showNotes ? (
        <Field label="Note d’attribution" className="md:col-span-2">
          <Textarea
            value={value.notes ?? ""}
            maxLength={1000}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </Field>
      ) : null}
    </div>
  );
}

function Field({ label, required, className, children }: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`grid content-start gap-2 text-sm ${className ?? ""}`}>
      <span className="font-medium">
        {label}{required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
