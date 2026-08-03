import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReferenceOption } from "../types";

export const ALL_DELIVERY_FILTERS = "ALL";

type Props = {
  compagnieAssuranceId: string;
  annee: string;
  compagnies: ReferenceOption[];
  onCompagnieChange: (value: string) => void;
  onAnneeChange: (value: string) => void;
  onReset: () => void;
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 12 }, (_, index) => String(currentYear + 1 - index));

export function AttestationDeliveryFilters({
  compagnieAssuranceId,
  annee,
  compagnies,
  onCompagnieChange,
  onAnneeChange,
  onReset,
}: Props) {
  const yearOptions = annee !== ALL_DELIVERY_FILTERS && !years.includes(annee)
    ? [annee, ...years]
    : years;

  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_180px_auto] lg:items-end">
        <div className="space-y-1.5">
          <Label>Compagnie</Label>
          <Select value={compagnieAssuranceId} onValueChange={onCompagnieChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DELIVERY_FILTERS}>Toutes les compagnies</SelectItem>
              {compagnies.map((compagnie) => (
                <SelectItem key={compagnie.id} value={String(compagnie.id)}>
                  {compagnie.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Année de réception</Label>
          <Select value={annee} onValueChange={onAnneeChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DELIVERY_FILTERS}>Toutes les années</SelectItem>
              {yearOptions.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          className="sm:col-span-2 lg:col-span-1"
          disabled={compagnieAssuranceId === ALL_DELIVERY_FILTERS && annee === ALL_DELIVERY_FILTERS}
          onClick={onReset}
        >
          <RotateCcw className="size-4" />
          Réinitialiser
        </Button>
      </CardContent>
    </Card>
  );
}
