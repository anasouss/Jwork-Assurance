import { ArrowRight, CalendarClock, FileClock, ReceiptText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDate } from "../dashboard-format";
import type { DashboardData } from "../types";

export function DashboardWorkQueue({ data, permissions }: { data: DashboardData; permissions: string[] }) {
  const rows = [
    {
      label: "Dossiers à échéance · 30 jours",
      value: data.workload.echeances30Jours,
      detail: `Du ${formatDate(data.workload.echeancesDu)} au ${formatDate(data.workload.echeancesAu)}`,
      icon: CalendarClock,
      href: `/app/production/echeances?dateDu=${data.workload.echeancesDu}&dateAu=${data.workload.echeancesAu}`,
      permissions: ["contrat:view"],
    },
    {
      label: "Quittances sans affectation compagnie",
      value: data.workload.quittancesAAffecter,
      detail: "Aucune affectation compagnie enregistrée",
      icon: ReceiptText,
      href: "/app/compta/quittances?nature=SANS_QUITTANCE",
      permissions: ["quittance:view"],
    },
    {
      label: "Créances sans document",
      value: data.workload.documentsAEmettre,
      detail: "Solde restant, sans relevé ni facture émis",
      icon: FileClock,
      href: "/app/compta/releves-factures?tab=sources&sourceDocumentState=SANS_DOCUMENT",
      permissions: ["quittance:view"],
    },
    {
      label: "Seuils de stock atteints",
      value: data.workload.alertesStock,
      detail: data.workload.controleStockActif ? "Seuils atteints par compagnie / usage" : "Contrôle à la saisie désactivé",
      icon: ShieldCheck,
      href: "/app/production/attestations-stock",
      permissions: ["attestation-stock:view", "attestation-stock:manage"],
    },
  ].filter((row) => row.permissions.some(permission => permissions.includes(permission)))
    .sort((left, right) => Number(right.value > 0) - Number(left.value > 0));

  if (!rows.length) return null;

  return (
    <section aria-labelledby="work-queue-title" className="min-w-0 border-y bg-card">
      <div className="border-b bg-foreground/[0.06] px-4 py-3">
        <h2 id="work-queue-title" className="text-base font-semibold">À traiter</h2>
        <p className="mt-1 text-xs text-muted-foreground">Situation au {formatDate(data.dateReference)}</p>
      </div>
      <div className="grid divide-y px-4">
        {rows.map((row) => (
          <Link key={row.label} to={row.href} className="group flex items-center gap-3 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <span className={cn("grid size-8 shrink-0 place-items-center text-muted-foreground", row.value > 0 && "text-amber-700 dark:text-amber-300")}>
              <row.icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-medium group-hover:underline", row.value === 0 && "text-muted-foreground")}>{row.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{row.detail}</span>
            </span>
            <span className={cn("shrink-0 text-base font-semibold tabular-nums", row.value > 0 ? "rounded-sm bg-amber-100 px-2 py-0.5 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200" : "text-muted-foreground")}>{row.value.toLocaleString("fr-FR")}</span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}
