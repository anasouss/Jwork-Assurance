import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { EcheanceInput } from "@/components/ui/echeance-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { computeDateEcheanceFromCode, toDateOnly } from "../date";
import type { AssistanceContrat, AssistanceDraft, ReferenceOption } from "../types";
import { formatMoney } from "../utils/format";
import type { ContractTarget } from "./ContractTargetsSection";

type TargetAssistanceTableProps = {
  target: ContractTarget;
  assistance: AssistanceDraft;
  onChange: (patch: Partial<AssistanceDraft>) => void;
  compagniesAssistance: ReferenceOption[];
  produitsAssistance: ReferenceOption[];
  categorieClientId?: string;
  preview?: AssistanceContrat;
};

export function TargetAssistanceTable({
  target,
  assistance,
  onChange,
  compagniesAssistance,
  produitsAssistance,
  categorieClientId,
  preview,
}: TargetAssistanceTableProps) {
  const filteredProducts = produitsAssistance.filter((produit) => {
    if (assistance.compagnieAssistanceId && produit.compagnieAssistanceId !== assistance.compagnieAssistanceId) {
      return false;
    }
    if (!assistanceProductMatchesCategory(produit, categorieClientId)) {
      return false;
    }
    const usageIds = Array.isArray(produit.usageIds) ? produit.usageIds.map(String) : [];
    return usageIds.length === 0 || !target.usageId || usageIds.includes(target.usageId);
  });
  const selectedProduct = produitsAssistance.find((produit) => produit.id === assistance.produitAssistanceId);
  const selectedProductId = assistance.produitAssistanceId ?? "";
  const selectableProducts = selectedProduct && !filteredProducts.some((produit) => produit.id === selectedProduct.id)
    ? [selectedProduct, ...filteredProducts]
    : filteredProducts;
  const prime = preview?.primeTotale;
  const trimestres = preview?.trimestres;

  const updateDateEffet = (dateEffet?: string) => {
    onChange({
      dateEffet,
      dateEcheance: computeDateEcheanceFromCode(dateEffet, assistance.echeanceCode, assistance.dateEcheance),
    });
  };

  const updateEcheance = (echeanceCode?: string) => {
    onChange({
      echeanceCode,
      dateEcheance: computeDateEcheanceFromCode(assistance.dateEffet, echeanceCode, assistance.dateEcheance),
    });
  };

  return (
    <div className="overflow-hidden rounded-md border xl:overflow-x-auto">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
        <Checkbox checked={assistance.enabled} onCheckedChange={(checked) => onChange({ enabled: Boolean(checked) })} />
        <span>Assistance</span>
      </div>
      <table className="block w-full border-collapse text-sm xl:table xl:min-w-[1100px]">
        <thead className="hidden bg-muted/60 text-xs uppercase text-muted-foreground xl:table-header-group">
          <tr>
            <th className="px-3 py-3 text-left">Date effet</th>
            <th className="px-3 py-3 text-left">Date souscription</th>
            <th className="px-3 py-3 text-left">Échéance</th>
            <th className="px-3 py-3 text-left">Date échéance</th>
            <th className="px-3 py-3 text-left">N° contrat</th>
            <th className="px-3 py-3 text-left">Compagnie</th>
            <th className="px-3 py-3 text-left">Produit</th>
            <th className="px-3 py-3 text-right">Prime</th>
          </tr>
        </thead>
        <tbody className="block xl:table-row-group">
          <tr className={cn("grid w-full grid-cols-2 border-t align-middle xl:table-row", !assistance.enabled && "bg-muted/20 text-muted-foreground")}>
            <ResponsiveRecordCell label="Date effet">
              <DatePicker disabled={!assistance.enabled} date={assistance.dateEffet} onSelect={(date) => updateDateEffet(toDateOnly(date))} />
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Date souscription">
              <DatePicker disabled={!assistance.enabled} date={assistance.dateSouscription} onSelect={(date) => onChange({ dateSouscription: toDateOnly(date) })} />
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Échéance">
              <EcheanceInput disabled={!assistance.enabled} value={assistance.echeanceCode ?? ""} onValueChange={updateEcheance} />
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Date échéance">
              <DatePicker disabled date={assistance.dateEcheance} onSelect={() => undefined} />
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="N° contrat">
              <Input
                disabled={!assistance.enabled}
                value={assistance.numeroContratOuQuittance ?? ""}
                placeholder="N° contrat"
                onChange={(event) => onChange({ numeroContratOuQuittance: event.target.value })}
              />
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Compagnie">
              <Select
                disabled={!assistance.enabled}
                value={assistance.compagnieAssistanceId ?? ""}
                onValueChange={(value) => onChange({ compagnieAssistanceId: value, produitAssistanceId: undefined })}
              >
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {compagniesAssistance.map((compagnie) => (
                    <SelectItem key={compagnie.id} value={compagnie.id}>{compagnie.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Produit">
              <div className="grid gap-1">
                <Select
                  disabled={!assistance.enabled || selectableProducts.length === 0}
                  value={selectedProductId}
                  onValueChange={(value) => onChange({ produitAssistanceId: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {selectableProducts.map((produit) => (
                      <SelectItem key={produit.id} value={produit.id}>{produit.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assistance.enabled && assistance.compagnieAssistanceId && selectableProducts.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Aucun produit compatible pour cette compagnie.
                  </p>
                ) : null}
              </div>
            </ResponsiveRecordCell>
            <ResponsiveRecordCell label="Prime" valueClassName="text-right font-medium">
              {assistance.enabled && prime != null ? formatMoney(prime) : "-"}
            </ResponsiveRecordCell>
          </tr>
        </tbody>
      </table>
      {trimestres ? (
        <div className="border-t px-3 py-2 text-xs font-medium text-muted-foreground">
          Trimestres: {trimestres}/4
        </div>
      ) : null}
    </div>
  );
}

function ResponsiveRecordCell({ label, children, valueClassName }: { label: string; children: ReactNode; valueClassName?: string }) {
  return (
    <td className="col-span-2 grid grid-cols-1 gap-1 border-t border-border/60 px-3 py-2 sm:grid-cols-[minmax(7.5rem,0.8fr)_minmax(0,1.2fr)] sm:items-center sm:gap-3 xl:table-cell xl:border-t-0">
      <span className="text-xs font-medium text-muted-foreground xl:hidden">{label}</span>
      <div className={cn("min-w-0", valueClassName)}>{children}</div>
    </td>
  );
}

function assistanceProductMatchesCategory(produit: ReferenceOption, categorieClientId?: string) {
  const productCategoryId = produit.categorieClientId == null ? "" : String(produit.categorieClientId);
  if (!productCategoryId) return true;
  return Boolean(categorieClientId) && productCategoryId === String(categorieClientId);
}
