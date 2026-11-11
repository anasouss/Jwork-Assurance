import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { moneyAmount } from "@/features/production/utils/format";
import { formatDate } from "../dashboard-format";
import type { DashboardRecentActivity } from "../types";

export function DashboardRecentMovements({
  rows,
  canView,
  dateFrom,
  dateTo,
}: {
  rows: DashboardRecentActivity[];
  canView: boolean;
  dateFrom: string;
  dateTo: string;
}) {
  if (!canView) return null;
  return (
    <section className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Derniers mouvements validés</h2>
          <p className="mt-1 text-xs text-muted-foreground">Du {formatDate(dateFrom)} au {formatDate(dateTo)} · date d’effet</p>
        </div>
        {canView ? (
          <Button asChild variant="outline" size="sm">
            <Link to={`/app/production/registre?typeDate=EFFET&statut=VALIDE&dateDu=${dateFrom}&dateAu=${dateTo}`}>
              Voir la liste
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto border-y border-emerald-200 bg-card dark:border-emerald-900/60">
          <table className="w-full min-w-[940px] text-sm">
            <thead className="bg-emerald-100/80 text-left text-xs text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-100">
              <tr>
                <th className="px-5 py-3 font-semibold">Police / contrat</th>
                <th className="px-4 py-3 font-semibold">Dossier</th>
                <th className="px-4 py-3 font-semibold">Mouvement</th>
                <th className="px-4 py-3 font-semibold">Compagnie</th>
                <th className="px-4 py-3 font-semibold">Date d'effet</th>
                <th className="px-4 py-3 text-right font-semibold">TTC (MAD)</th>
                <th className="w-12 px-4 py-3"><span className="sr-only">Consulter</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.mouvementId} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-semibold">{row.numeroPolice || "-"}</div>
                    <div className="text-xs text-muted-foreground">{row.branche || row.typeContrat}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{row.numeroDossier || `Contrat #${row.contratId}`}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.mouvement}</div>
                    {row.detail ? <div className="text-xs text-muted-foreground">{row.detail}</div> : null}
                  </td>
                  <td className="max-w-64 break-words px-4 py-3">{row.compagnie || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(row.dateEffet)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                    {moneyAmount(row.primeTotale)}
                  </td>
                  <td className="px-4 py-3">
                    {canView ? (
                      <Button asChild variant="ghost" size="icon" title="Voir le mouvement" aria-label={`Voir le mouvement ${row.mouvement} · ${row.numeroDossier || row.numeroPolice || row.contratId}`}>
                        <Link to={`/app/production/contrats/${row.contratId}?mouvementId=${row.mouvementId}`}>
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">Aucun mouvement validé.</div>
      )}
    </section>
  );
}
