import { Badge } from "@/components/ui/badge";
import type { Intervenant } from "../types";

export function DoctorProviderCells({ item, specialiteId }: {
  item: Intervenant;
  specialiteId: string;
}) {
  const specialties = (item.specialites ?? []).filter(s => specialiteId === "ALL" || s.id === specialiteId);

  return <>
    <td className="max-w-64 break-words px-3 py-3 font-medium">{item.nom}
      {!item.actif && <Badge className="ml-2" variant="gray">Inactif</Badge>}
    </td>
    <td className="max-w-40 break-words px-3 py-3">{item.ville || "-"}</td>
    <td className="max-w-72 break-words px-3 py-3">{item.adresse || "-"}</td>
    <td className="max-w-64 px-3 py-3"><div className="grid gap-1">
      {item.telephone && <a className="break-words hover:underline" href={`tel:${item.telephone}`}>{item.telephone}</a>}
      {item.email && <a className="break-all hover:underline" href={`mailto:${item.email}`}>{item.email}</a>}
      {!item.telephone && !item.email && "-"}
    </div></td>
    <td className="max-w-64 px-3 py-3"><div className="flex flex-wrap gap-1">
      {specialties.map(s => <Badge key={s.id} variant={s.actif ? "info" : "gray"}>{s.libelle}</Badge>)}
      {!specialties.length && "-"}
    </div></td>
  </>;
}
