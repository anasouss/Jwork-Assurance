import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { moneyAmount } from "../utils/format";

export default function QuittancesPage() {
  const quittances = useQuery({ queryKey: ["elements-facturables"], queryFn: productionApi.listQuittances });
  const rows = (quittances.data ?? []) as Record<string, unknown>[];
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Éléments facturables / quittances</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Nature</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Prime totale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item, index) => (
              <TableRow key={String(item.id ?? index)}>
                <TableCell>{String(item.libelle ?? "-")}</TableCell>
                <TableCell>{String(item.nature ?? "-")}</TableCell>
                <TableCell>{String(item.statut ?? "-")}</TableCell>
                <TableCell className="text-right">{moneyAmount(Number(item.primeTotale ?? 0))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
