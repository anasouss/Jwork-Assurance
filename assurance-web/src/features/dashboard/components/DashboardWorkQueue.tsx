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
      color: "text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300",
    },
    {
      label: "Quittances sans affectation compagnie",
      value: data.workload.quittancesAAffecter,
      detail: "Aucune affectation compagnie enregistrée",
      icon: ReceiptText,
      href: "/app/compta/quittances?nature=SANS_QUITTANCE",
      permissions: ["quittance:view"],
      color: "text-orange-700 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-300",
    },
    {
      label: "Créances sans document",
      value: data.workload.documentsAEmettre,
      detail: "Solde restant, sans relevé ni facture émis",
      icon: FileClock,
      href: "/app/compta/releves-factures?tab=sources&sourceDocumentState=SANS_DOCUMENT",
      permissions: ["quittance:view"],
      color: "text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300",
    },
    {
      label: "Seuils de stock atteints",
      value: data.workload.alertesStock,
      detail: data.workload.controleStockActif ? "Seuils atteints par compagnie / usage" : "Contrôle à la saisie désactivé",
      icon: ShieldCheck,
      href: "/app/production/attestations-stock",
      permissions: ["attestation-stock:view", "attestation-stock:manage"],
      color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300",
    },
  ].filter((row) => row.permissions.some(permission => permissions.includes(permission)))
    .sort((left, right) => Number(right.value > 0) - Number(left.value > 0));

  if (!rows.length) return null;

  return (
    <section aria-labelledby="work-queue-title" className="min-w-0 border-y border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-amber-200/70 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
        <h2 id="work-queue-title" className="text-base font-semibold text-amber-950 dark:text-amber-100">À traiter</h2>
        <p className="text-xs text-amber-800/80 dark:text-amber-200/80">Situation au {formatDate(data.dateReference)}</p>
      </div>
      <div className="grid px-4 md:grid-cols-2 md:gap-x-6">
        {rows.map((row) => (
          <Link key={row.label} to={row.href} className="group flex items-center gap-3 border-b py-3 outline-none transition-colors hover:bg-amber-100/50 dark:hover:bg-amber-950/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", row.value > 0 ? row.color : "bg-muted text-muted-foreground")}>
              <row.icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-medium group-hover:underline", row.value === 0 && "text-muted-foreground")}>{row.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{row.detail}</span>
            </span>
            <span className={cn("text-lg font-semibold tabular-nums", row.value === 0 && "text-muted-foreground")}>{row.value.toLocaleString("fr-FR")}</span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}
