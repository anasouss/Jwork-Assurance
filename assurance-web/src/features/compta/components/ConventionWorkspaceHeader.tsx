import { ArrowLeft, Banknote, FilePlus2, ListChecks, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";

export const conventionActions = [
  { title: "Consultation", href: "/app/compta/conventions/production", icon: ListChecks, permission: "production-convention:view" },
  { title: "Facturation", href: "/app/compta/conventions/factures", icon: FilePlus2, permission: "facture-convention:view" },
  { title: "Encaissements", href: "/app/compta/conventions/encaissements", icon: WalletCards, permission: "reglement-client:view" },
  { title: "Règlements", href: "/app/compta/conventions/reglements", icon: Banknote, permission: "reglement-client:view" },
];

export function ConventionWorkspaceHeader({ title }: { title: string }) {
  return <header className="grid gap-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Département conventions</div>
        <h1 className="mt-1 text-xl font-semibold">{title}</h1>
      </div>
      <Link to="/app/compta/conventions" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
        <ArrowLeft className="size-4" />Département conventions
      </Link>
    </div>
  </header>;
}
