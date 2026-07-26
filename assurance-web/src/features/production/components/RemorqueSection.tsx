import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Input } from "@/components/ui/input";
import { Field } from "./Field";
import { SectionCard } from "./SectionCard";
import { toDateOnly } from "../date";
import { numberValue } from "../utils/format";
import type { ReferenceOption, RemorqueInput } from "../types";
import type { ContratSectionKey } from "../contrat-creation/useContratCreationForm";

export function RemorqueSection({
  remorques,
  setRemorques,
  usages,
  marques,
  maxRemorques,
  openSection,
  onSectionOpenChange,
}: {
  remorques: RemorqueInput[];
  setRemorques: (remorques: RemorqueInput[]) => void;
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  maxRemorques?: number | null;
  openSection?: ContratSectionKey;
  onSectionOpenChange?: (section: ContratSectionKey, open: boolean) => void;
}) {
  const update = (index: number, patch: Partial<RemorqueInput>) => {
    setRemorques(remorques.map((remorque, idx) => (idx === index ? { ...remorque, ...patch } : remorque)));
  };
  const canAdd = maxRemorques == null || remorques.length < maxRemorques;

  return (
    <SectionCard
      title="Remorques"
      badge={`${remorques.length} remorque${remorques.length > 1 ? "s" : ""}`}
      tone="production"
      defaultOpen={false}
      open={openSection === "remorque"}
      onOpenChange={(open) => onSectionOpenChange?.("remorque", open)}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/50 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          disabled={!canAdd}
          onClick={() => setRemorques([...remorques, {}])}
        >
          <Plus className="size-4" />
          Remorque
        </Button>
      }
    >
      <div className="grid gap-4">
        {remorques.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Aucune remorque ajoutée.
          </div>
        ) : null}
        {remorques.map((remorque, index) => (
          <div key={index} className="rounded-lg border p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">Remorque {index + 1}</div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setRemorques(remorques.filter((_, idx) => idx !== index))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="grid max-w-6xl gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Usage" required>
                <AutocompleteSelect
                  value={remorque.usageId ?? ""}
                  placeholder="Usage remorque"
                  emptyText="Aucun usage trouvé"
                  invalidText="Usage invalide : choisissez une option existante."
                  options={usages.map((usage) => ({
                    value: usage.id,
                    label: usage.code ? `${usage.code} - ${usage.libelle}` : usage.libelle,
                    keywords: usage.code,
                  }))}
                  onValueChange={(value) => update(index, { usageId: value })}
                />
              </Field>
              <Field label="Immatriculation">
                <Input value={remorque.immatriculation ?? ""} onChange={(event) => update(index, { immatriculation: event.target.value })} />
              </Field>
              <Field label="Marque">
                <AutocompleteSelect
                  value={remorque.marqueId ?? ""}
                  customValue={remorque.marqueLibelle}
                  allowCustomValue
                  placeholder="Marque"
                  emptyText="Aucune marque trouvée"
                  options={marques.map((marque) => ({ value: marque.id, label: marque.libelle, keywords: marque.code }))}
                  onValueChange={(value) => update(index, { marqueId: value || undefined, marqueLibelle: undefined })}
                  onCustomValueChange={(value) => update(index, { marqueId: undefined, marqueLibelle: value })}
                />
              </Field>
              <Field label="PTC">
                <Input value={remorque.ptc ?? ""} onChange={(event) => update(index, { ptc: event.target.value })} />
              </Field>
              <Field label="Date mise en circulation">
                <DatePicker date={remorque.dateMiseEnCirculation} onSelect={(date) => update(index, { dateMiseEnCirculation: toDateOnly(date) })} />
              </Field>
              <Field label="Date d'effet">
                <DatePicker date={remorque.dateEffet} onSelect={(date) => update(index, { dateEffet: toDateOnly(date) })} />
              </Field>
              <Field label="Date d'échéance">
                <DatePicker date={remorque.dateEcheance} onSelect={(date) => update(index, { dateEcheance: toDateOnly(date) })} />
              </Field>
              <Field label="CRM">
                <Input value={remorque.crm ?? ""} onChange={(event) => update(index, { crm: event.target.value })} />
              </Field>
              <Field label="N° attestation">
                <Input value={remorque.numeroAttestation ?? ""} onChange={(event) => update(index, { numeroAttestation: event.target.value })} />
              </Field>
              <Field label="Valeur assurée">
                <Input type="number" value={remorque.valeurAssuree ?? ""} onChange={(event) => update(index, { valeurAssuree: numberValue(event.target.value) })} />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
