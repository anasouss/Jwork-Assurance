import { ArrowLeft, FilePlus2, ListChecks, WalletCards } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";

export const conventionActions = [
  { title: "Consultation et édition des états de production", shortTitle: "États de production", href: "/app/compta/conventions/production", icon: ListChecks, permission: "quittance:view" },
  { title: "Établissement des factures", shortTitle: "Factures", href: "/app/compta/conventions/factures", icon: FilePlus2, permission: "quittance:view" },
  { title: "Encaissement des factures", shortTitle: "Encaissements", href: "/app/compta/conventions/encaissements", icon: WalletCards, permission: "reglement-client:view" },
];

export function ConventionWorkspaceHeader({ title }: { title: string }) {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
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
    <nav aria-label="Département conventions" className="flex flex-wrap gap-2 border-b pb-3">
      {conventionActions.filter(action => permissions.includes(action.permission)).map(action => <NavLink
        key={action.href} to={action.href}
        className={({ isActive }) => `inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive
          ? "border-orange-600 bg-orange-600 text-white"
          : "bg-background hover:bg-muted"}`}>
        <action.icon className="size-4 shrink-0" />{action.shortTitle}
      </NavLink>)}
    </nav>
  </header>;
}
