import { BarChart3, FilePlus2, Files, ScrollText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";

const actions = [
  { title: "Nouvelle ouverture", subtitle: "Police, véhicule et garanties impliquées.", href: "/app/sinistre/declarer", icon: FilePlus2, permissions: ["sinistre:create"], primary: true },
  { title: "Consultation et suivi", subtitle: "Dossiers, étapes et historique.", href: "/app/sinistre/dossiers", icon: Files, permissions: ["sinistre:view", "sinistre:manage", "sinistre:finance"] },
  { title: "Registre des sinistres", subtitle: "Références, assurés et compagnies.", href: "/app/sinistre/registre", icon: ScrollText, permissions: ["sinistre:view", "sinistre:manage", "sinistre:finance"] },
  { title: "Statistiques", subtitle: "Déclarations, délais et montants.", href: "/app/sinistre/statistiques", icon: BarChart3, permissions: ["sinistre:view", "sinistre:manage", "sinistre:finance"] },
  { title: "Experts et garages", subtitle: "Intervenants, coordonnées et villes.", href: "/app/sinistre/referentiels", icon: Users, permissions: ["sinistre:referentiel"] },
];

export default function SinistreDashboardPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const available = actions.filter((action) => action.permissions.some((permission) => permissions.includes(permission)));

  return <div className="grid gap-6">
    <header className="mx-auto w-full max-w-7xl">
      <div className="text-sm font-medium text-sky-700 dark:text-sky-400">Sinistres</div>
      <div className="mt-1">
        <h1 className="text-xl font-semibold">Module sinistres</h1>
        <p className="text-sm text-muted-foreground">Dossiers sinistres, garanties et intervenants.</p>
      </div>
    </header>
    <section aria-label="Opérations sinistres" className="-mx-4 border-y bg-card px-4 py-5">
      <div className="mx-auto grid w-full max-w-7xl gap-3 md:grid-cols-2 lg:grid-cols-3">
        {available.map(({ title, subtitle, href, icon: Icon, primary }) => <Link key={href} to={href}
          className={primary
            ? "flex min-h-16 items-center gap-3 rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            : "flex min-h-16 items-center gap-3 rounded-md border bg-background px-4 py-3 text-sm font-semibold transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:border-sky-800 dark:hover:bg-sky-950/30 dark:hover:text-sky-200"}>
          <Icon className={`size-4 shrink-0 ${primary ? "" : "text-sky-700 dark:text-sky-400"}`} />
          <span className="min-w-0 break-words">
            <span className="block">{title}</span>
            <span className={`block text-xs font-normal ${primary ? "text-white/80" : "text-muted-foreground"}`}>{subtitle}</span>
          </span>
        </Link>)}
      </div>
      {available.length === 0 ? <p className="mx-auto w-full max-w-7xl text-sm text-muted-foreground">Aucune opération autorisée.</p> : null}
    </section>
  </div>;
}
