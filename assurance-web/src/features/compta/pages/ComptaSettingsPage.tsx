import { Banknote } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const settings = [
  {
    title: "Caisses et banques",
    description: "Comptes de trésorerie utilisés pour les encaissements et les règlements.",
    href: "/app/compta/tresorerie/comptes",
    icon: Banknote,
  },
];

export default function ComptaSettingsPage() {
  return (
    <div className="grid gap-5">
      <header>
        <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
          Comptabilité
        </p>
        <h1 className="text-xl font-semibold">Paramétrage comptable</h1>
        <p className="text-sm text-muted-foreground">
          Gérez les référentiels de comptabilité et de trésorerie.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} to={item.href} className="group">
              <Card className="h-full border-border/70 shadow-none transition-colors group-hover:border-orange-500/70 group-hover:bg-orange-50/50 dark:group-hover:bg-orange-950/20">
                <CardContent className="flex h-full items-start gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-orange-600 text-white">
                    <Icon className="size-5" />
                  </span>
                  <span className="grid gap-1">
                    <span className="font-semibold">{item.title}</span>
                    <span className="text-sm text-muted-foreground">{item.description}</span>
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
