import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClaimAssistance } from "../types";

export function SinistreAssistanceTable({ items, selectedIds, onToggle, disabled = false }: {
  items: ClaimAssistance[];
  selectedIds?: string[];
  onToggle?: (id: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  if (!items.length) return null;
  return <div className="mt-5 grid gap-3 border-t pt-4">
    <h3 className="text-sm font-semibold">Assistance liée</h3>
    <div className="min-w-0 overflow-x-auto rounded-md border">
      <Table className="min-w-[640px]">
        <TableHeader className="bg-sky-700 [&_th]:text-white"><TableRow>
          {onToggle ? <TableHead className="w-12"><span className="sr-only">Assistance concernée</span></TableHead> : null}
          <TableHead>Compagnie</TableHead><TableHead>Produit</TableHead><TableHead>Référence</TableHead><TableHead>Du</TableHead><TableHead>Au</TableHead>
        </TableRow></TableHeader>
        <TableBody>{items.map(item => <TableRow key={item.id}>
          {onToggle ? <TableCell><Checkbox checked={selectedIds?.includes(item.id) ?? false} disabled={disabled}
            aria-label={`Assistance concernée par le sinistre : ${item.produit || item.reference || item.id}`}
            onCheckedChange={checked => onToggle(item.id, checked === true)} /></TableCell> : null}
          <TableCell>{item.compagnie || "-"}</TableCell><TableCell>{item.produit || "-"}</TableCell><TableCell>{item.reference || "-"}</TableCell>
          <TableCell className="whitespace-nowrap">{item.dateEffet.split("-").reverse().join("/")}</TableCell>
          <TableCell className="whitespace-nowrap">{item.dateEcheance.split("-").reverse().join("/")}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
  </div>;
}
