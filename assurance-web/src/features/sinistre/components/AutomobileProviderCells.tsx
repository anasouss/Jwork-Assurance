import { Badge } from "@/components/ui/badge";
import { providerTypeLabel } from "../provider-types";
import type { Intervenant } from "../types";

export function AutomobileProviderCells({ item, compagnieId, specialiteId }: {
  item: Intervenant;
  compagnieId: string;
  specialiteId: string;
}) {
  const agreements = (item.accords ?? []).filter(a => a.conventionneActuellement
    && (compagnieId === "ALL" || a.compagnieId === compagnieId));
  const specialties = (item.specialites ?? []).filter(s => s.actif
    && (specialiteId === "ALL" || s.id === specialiteId));
  const garage = item.typePrestataire === "GARAGE";
  const showGarageType = garage && (specialiteId === "ALL" || !specialties.length);

  return <>
    <td className="max-w-56 px-3 py-3">
      <div className="grid gap-1.5">
        {showGarageType && <div>{agreements.length ? "Garage conventionné" : "Garage"}
          {compagnieId === "ALL" && agreements.length > 0 && <p className="text-xs text-muted-foreground">{agreements.map(a => a.compagnie).join(", ")}</p>}
        </div>}
        {garage ? specialties.map(s => <div key={s.id}>{s.libelle}</div>) : item.typePrestataire ? providerTypeLabel(item.typePrestataire) : "-"}
      </div>
    </td>
    <td className="max-w-64 px-3 py-3">
      {garage && agreements.length ? <ul className="space-y-2">{agreements.map(a => <li key={a.compagnieId}>
        {compagnieId === "ALL" && <span className="block text-xs text-muted-foreground">{a.compagnie}</span>}
        {a.tousUsages ? "Tous les usages" : a.usages.map(u => u.libelle).join(", ") || "-"}
      </li>)}</ul> : "-"}
    </td>
    <td className="max-w-64 break-words px-3 py-3 font-medium">{item.nom}
      {!item.actif && <Badge className="ml-2" variant="gray">Inactif</Badge>}
    </td>
    <td className="whitespace-nowrap px-3 py-3">{item.telephone ? <a className="hover:underline" href={`tel:${item.telephone}`}>{item.telephone}</a> : "-"}</td>
    <td className="max-w-56 break-all px-3 py-3">{item.email ? <a className="hover:underline" href={`mailto:${item.email}`}>{item.email}</a> : "-"}</td>
    <td className="max-w-72 break-words px-3 py-3">{item.adresse || "-"}</td>
    <td className="max-w-40 break-words px-3 py-3">{item.ville || "-"}</td>
  </>;
}
