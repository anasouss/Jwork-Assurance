import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const settings = [
  {
    title: "Origines commerciales",
    description: "Canaux, partenaires, campagnes et membres de l’équipe à l’origine des clients.",
    href: "/app/crm/parametres/origines-commerciales",
    icon: Megaphone,
  },
];

export default function CrmSettingsPage() {
  return (
    <div className="grid gap-5">
      <header>
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">CRM</p>
        <h1 className="text-xl font-semibold tracking-tight">Paramétrage CRM</h1>
        <p className="text-sm text-muted-foreground">Gérez les référentiels utilisés pour le suivi commercial.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} to={item.href} className="group">
              <Card
                className={cn(
                  "h-full border-border/70 shadow-none transition-colors",
                  "group-hover:border-blue-500/70 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-950/20"
                )}
              >
                <CardContent className="flex h-full items-start gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
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
