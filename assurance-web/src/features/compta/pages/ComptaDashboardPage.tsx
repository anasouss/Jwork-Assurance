import { Link } from "react-router-dom";
import {
  Archive,
  Banknote,
  Building2,
  FileCheck2,
  FileText,
  History,
  Landmark,
  ReceiptText,
  Scale,
  ScrollText,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

type ComptaAction = {
  title: string;
  icon: LucideIcon;
  href?: string;
  permission?: string;
  primary?: boolean;
  disabled?: boolean;
};

type ComptaGroup = {
  title: string;
  actions: ComptaAction[];
};

const groups: ComptaGroup[] = [
  {
    title: "Client",
    actions: [
      {
        title: "Affectation des quittances",
        icon: ReceiptText,
        href: "/app/compta/quittances",
        permission: "quittance:view",
        primary: true,
      },
      {
        title: "Relevés et factures",
        icon: FileText,
        href: "/app/compta/releves-factures",
        permission: "quittance:view",
      },
      {
        title: "Facturation conventions",
        icon: ReceiptText,
        href: "/app/compta/facturation-conventions",
        permission: "quittance:view",
      },
      {
        title: "Encaissements clients",
        icon: WalletCards,
        href: "/app/compta/reglements",
        permission: "reglement-client:view",
      },
      {
        title: "Règlements enregistrés",
        icon: History,
        href: "/app/compta/reglements/historique",
        permission: "reglement-client:view",
      },
    ],
  },
  {
    title: "Trésorerie",
    actions: [
      {
        title: "Caisses et banques",
        icon: Banknote,
        href: "/app/compta/tresorerie/comptes",
        permission: "tresorerie:view",
      },
      {
        title: "Instruments à encaisser",
        icon: ScrollText,
        href: "/app/compta/tresorerie/instruments",
        permission: "tresorerie:view",
      },
      {
        title: "Journal de trésorerie",
        icon: Landmark,
        href: "/app/compta/tresorerie/journal",
        permission: "tresorerie:view",
      },
    ],
  },
  {
    title: "Compagnie",
    actions: [
      { title: "Bordereaux compagnies", icon: Building2, disabled: true },
      { title: "Rapprochement compagnie", icon: FileCheck2, disabled: true },
      { title: "Balance compagnie", icon: Scale, disabled: true },
    ],
  },
  {
    title: "Documents",
    actions: [
      { title: "Archivage comptable", icon: Archive, disabled: true },
      { title: "Pièces justificatives", icon: FileCheck2, disabled: true },
      { title: "Export documentaire", icon: FileText, disabled: true },
    ],
  },
];

export default function ComptaDashboardPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);

  return (
    <div className="grid gap-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="text-sm font-medium text-orange-700 dark:text-orange-400">Comptabilité</div>
        <h1 className="mt-1 text-xl font-semibold">Module comptabilité</h1>
      </div>

      <div className="-mx-4 border-y bg-card">
        <div className="mx-auto grid w-full max-w-7xl divide-y">
          {groups.map((group) => {
            const actions = group.actions.filter(
              (action) => !action.permission || permissions.includes(action.permission)
            );
            if (!actions.length) return null;

            return (
              <section key={group.title} className="grid gap-3 px-4 py-5 lg:grid-cols-[180px_1fr]">
                <h2 className="pt-3 text-sm font-semibold uppercase text-muted-foreground">{group.title}</h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {actions.map((action) => {
                    if (action.disabled || !action.href) {
                      return (
                        <button
                          key={action.title}
                          type="button"
                          disabled
                          className="flex h-12 items-center gap-3 rounded-md border border-dashed bg-muted/30 px-4 text-left text-sm font-semibold text-muted-foreground"
                        >
                          <action.icon className="size-4 shrink-0" />
                          <span>{action.title}</span>
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={action.title}
                        to={action.href}
                        className={
                          action.primary
                            ? "flex h-12 items-center gap-3 rounded-md bg-orange-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
                            : "flex h-12 items-center gap-3 rounded-md border bg-background px-4 text-sm font-semibold transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-800 dark:hover:border-orange-900 dark:hover:bg-orange-950/30 dark:hover:text-orange-200"
                        }
                      >
                        <action.icon className="size-4 shrink-0" />
                        <span>{action.title}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
