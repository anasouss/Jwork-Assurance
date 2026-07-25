import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./Field";
import { SectionCard } from "./SectionCard";
import { toDateOnly } from "../date";
import type { ReferenceOption, RemorqueInput } from "../types";

export function RemorqueSection({
  remorques,
  setRemorques,
  usages,
  marques,
  maxRemorques,
}: {
  remorques: RemorqueInput[];
  setRemorques: (remorques: RemorqueInput[]) => void;
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  maxRemorques?: number | null;
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
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Usage" required>
                <Select value={remorque.usageId ?? ""} onValueChange={(value) => update(index, { usageId: value })}>
                  <SelectTrigger><SelectValue placeholder="Usage remorque" /></SelectTrigger>
                  <SelectContent>
                    {usages.map((usage) => <SelectItem key={usage.id} value={usage.id}>{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Immatriculation">
                <Input value={remorque.immatriculation ?? ""} onChange={(event) => update(index, { immatriculation: event.target.value })} />
              </Field>
              <Field label="Marque">
                <Select value={remorque.marqueId ?? ""} onValueChange={(value) => update(index, { marqueId: value })}>
                  <SelectTrigger><SelectValue placeholder="Marque" /></SelectTrigger>
                  <SelectContent>
                    {marques.map((marque) => <SelectItem key={marque.id} value={marque.id}>{marque.libelle}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Modèle">
                <Input value={remorque.modele ?? ""} onChange={(event) => update(index, { modele: event.target.value })} />
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

function numberValue(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
