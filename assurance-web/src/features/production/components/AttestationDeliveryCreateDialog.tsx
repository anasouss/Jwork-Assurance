import type { FormEvent, ReactNode } from "react";
import { Plus } from "lucide-react";
import { AutocompleteSelect } from "@/components/ui/autocomplete-select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "../date";
import type { ReferenceOption } from "../types";
import { AttestationUsageSelectionTable } from "./AttestationUsageSelectionTable";

export type LivraisonSource = "COMMANDE" | "RECEPTION_DIRECTE";

export type CreateLivraisonLine = {
  id: string;
  groupeUsageAttestationCode: string;
  quantiteDemandee: string;
  numeroDebut: string;
  numeroFin: string;
};

export type CreateLivraisonForm = {
  compagnieAssuranceId: string;
  dateDemande: string;
  dateReception: string;
  referenceBl: string;
  commentaireDecision: string;
  lignes: CreateLivraisonLine[];
};

type Props = {
  open: boolean;
  source: LivraisonSource;
  form: CreateLivraisonForm;
  compagnies: ReferenceOption[];
  groupes: ReferenceOption[];
  groupesDisponibles: ReferenceOption[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (value: CreateLivraisonForm | ((current: CreateLivraisonForm) => CreateLivraisonForm)) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleUsage: (groupe: ReferenceOption, checked: boolean) => void;
  onQuantityChange: (line: CreateLivraisonLine, value: string) => void;
  onRangeChange: (line: CreateLivraisonLine, patch: { numeroDebut?: string; numeroFin?: string }) => void;
};

export function AttestationDeliveryCreateDialog({
  open,
  source,
  form,
  compagnies,
  groupes,
  groupesDisponibles,
  pending,
  onOpenChange,
  onFormChange,
  onSubmit,
  onToggleUsage,
  onQuantityChange,
  onRangeChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{source === "COMMANDE" ? "Nouvelle commande" : "Nouvelle réception directe"}</DialogTitle>
          <DialogDescription>
            Sélectionnez les usages concernés et renseignez les quantités
            {source === "RECEPTION_DIRECTE" ? " ainsi que les plages reçues." : "."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Compagnie">
              <AutocompleteSelect
                value={form.compagnieAssuranceId}
                onValueChange={(value) => onFormChange((current) => ({
                  ...current,
                  compagnieAssuranceId: value,
                  lignes: value
                    ? current.lignes.filter((line) => {
                        const groupe = groupes.find(
                          (item) => String(item.code ?? item.id) === line.groupeUsageAttestationCode
                        );
                        return groupe ? groupAllowedForCompany(groupe, value) : false;
                      })
                    : [],
                }))}
                options={compagnies.map((compagnie) => ({
                  value: String(compagnie.id),
                  label: compagnie.libelle,
                  keywords: compagnie.code,
                }))}
                placeholder="Rechercher une compagnie"
                emptyText="Aucune compagnie"
                invalidText="Sélectionnez une compagnie existante."
                openOnFocus={false}
              />
            </Field>
            <Field label={source === "COMMANDE" ? "Date de demande" : "Date de réception"}>
              <DatePicker
                date={source === "COMMANDE" ? form.dateDemande : form.dateReception}
                onSelect={(date) => onFormChange((current) =>
                  source === "COMMANDE"
                    ? { ...current, dateDemande: toDateOnly(date) ?? "" }
                    : { ...current, dateReception: toDateOnly(date) ?? "" }
                )}
              />
            </Field>
            <Field
              label={source === "COMMANDE" ? "Référence externe (optionnelle)" : "Référence BL"}
              required={source === "RECEPTION_DIRECTE"}
            >
              <Input
                value={form.referenceBl}
                required={source === "RECEPTION_DIRECTE"}
                onChange={(event) => onFormChange((current) => ({ ...current, referenceBl: event.target.value }))}
              />
            </Field>
          </div>

          <AttestationUsageSelectionTable
            groupes={groupesDisponibles}
            lines={form.lignes}
            showRanges={source === "RECEPTION_DIRECTE"}
            disabled={!form.compagnieAssuranceId}
            quantityValue={(line) => line.quantiteDemandee}
            onToggle={onToggleUsage}
            onQuantityChange={onQuantityChange}
            onRangeChange={onRangeChange}
          />

          <Field label="Commentaire">
            <Textarea
              rows={3}
              value={form.commentaireDecision}
              onChange={(event) => onFormChange((current) => ({ ...current, commentaireDecision: event.target.value }))}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" />
              {source === "COMMANDE" ? "Créer la commande" : "Créer la réception"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}{required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

function groupAllowedForCompany(groupe: ReferenceOption, compagnieAssuranceId: string) {
  const rawRestrictions = groupe.compagnieRestrictionIds;
  if (!Array.isArray(rawRestrictions) || rawRestrictions.length === 0 || !compagnieAssuranceId) return true;
  return rawRestrictions.map(String).includes(compagnieAssuranceId);
}
