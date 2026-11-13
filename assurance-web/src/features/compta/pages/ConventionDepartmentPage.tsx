import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { AccessDenied } from "@/components/shared";
import { useAuthStore } from "@/store/auth-store";
import { conventionActions } from "../components/ConventionWorkspaceHeader";

export default function ConventionDepartmentPage() {
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const available = conventionActions.filter(action => permissions.includes(action.permission));
  if (!available.length) return <AccessDenied />;
  return <div className="grid gap-6">
    <header className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
        <h1 className="mt-1 text-xl font-semibold">Département conventions</h1>
      </div>
      <Link to="/app/compta" className="inline-flex items-center gap-2 text-sm font-medium hover:underline"><ArrowLeft className="size-4" />Comptabilité</Link>
    </header>
    <section aria-label="Opérations conventions" className="-mx-4 border-y bg-card px-4 py-5">
      <div className="mx-auto grid w-full max-w-7xl gap-3 md:grid-cols-2 lg:grid-cols-3">
        {available.map(action => <Link key={action.href} to={action.href}
          className="flex min-h-20 items-center gap-3 rounded-md border bg-background px-4 py-4 text-sm font-semibold transition-colors hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-orange-800 dark:hover:bg-orange-950/30">
          <action.icon className="size-5 shrink-0 text-orange-600 dark:text-orange-400" />
          <span className="min-w-0 break-words">{action.title}</span>
        </Link>)}
      </div>
    </section>
  </div>;
}
