import type { FormEvent, ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReferenceOption, SeuilStockAttestation } from "../types";

export type AttestationThresholdForm = {
  id: string;
  compagnieAssuranceId: string;
  groupeUsageAttestationId: string;
  minimumStock: string;
};

type Props = {
  form: AttestationThresholdForm;
  compagnies: ReferenceOption[];
  groupes: ReferenceOption[];
  seuils: SeuilStockAttestation[];
  pending: boolean;
  onFormChange: (form: AttestationThresholdForm | ((current: AttestationThresholdForm) => AttestationThresholdForm)) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AttestationThresholdsDialog({
  form,
  compagnies,
  groupes,
  seuils,
  pending,
  onFormChange,
  onSubmit,
}: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Settings2 className="size-4" />
          Seuils d’alerte
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Seuils d’alerte stock</DialogTitle>
          <DialogDescription>Configuration par compagnie et usage stock.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form className="space-y-3" onSubmit={onSubmit}>
            <Field label="Compagnie">
              <Select
                value={form.compagnieAssuranceId}
                onValueChange={(value) => onFormChange((current) => ({ ...current, compagnieAssuranceId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {compagnies.map((compagnie) => (
                    <SelectItem key={compagnie.id} value={String(compagnie.id)}>{compagnie.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Usage stock">
              <Select
                value={form.groupeUsageAttestationId}
                onValueChange={(value) => onFormChange((current) => ({ ...current, groupeUsageAttestationId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {groupes.map((groupe) => (
                    <SelectItem key={groupe.id} value={String(groupe.id)}>
                      {groupe.code} · {groupe.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Seuil minimum">
              <Input
                inputMode="numeric"
                value={form.minimumStock}
                onChange={(event) => onFormChange((current) => ({ ...current, minimumStock: event.target.value }))}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={pending}>
              {form.id ? "Modifier le seuil" : "Ajouter le seuil"}
            </Button>
          </form>

          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
                <TableRow className="hover:bg-emerald-700">
                  <TableHead>Compagnie</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Seuil</TableHead>
                  <TableHead className="text-right">Dispo.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seuils.map((seuil) => (
                  <TableRow key={seuil.id} className="cursor-pointer" onClick={() => onFormChange(toForm(seuil))}>
                    <TableCell>{seuil.compagnieAssuranceNom}</TableCell>
                    <TableCell>
                      <Badge variant={seuil.stockFaible ? "destructive" : "outline"}>{seuil.groupeUsageAttestationCode}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{seuil.minimumStock}</TableCell>
                    <TableCell className="text-right">{seuil.stockDisponible}</TableCell>
                  </TableRow>
                ))}
                {seuils.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                      Aucun seuil paramétré.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-700 dark:text-neutral-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function toForm(seuil: SeuilStockAttestation): AttestationThresholdForm {
  return {
    id: String(seuil.id),
    compagnieAssuranceId: String(seuil.compagnieAssuranceId),
    groupeUsageAttestationId: String(seuil.groupeUsageAttestationId),
    minimumStock: String(seuil.minimumStock),
  };
}
