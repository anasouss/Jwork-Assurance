import { Link } from "react-router-dom";
import { BadgeCheck, Car, Fuel, Layers3, ShieldCheck, Tags, Truck, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const settings = [
  {
    title: "Tarifs par usage",
    description: "Barèmes RC par usage, puissance, PTC, places et sous-classe.",
    href: "/app/production/parametres/tarifs-usage",
    icon: Tags,
  },
  {
    title: "Usages",
    description: "Critères de calcul, attestations et garanties personne.",
    href: "/app/production/parametres/usages",
    icon: BadgeCheck,
  },
  {
    title: "Garanties",
    description: "Modes, valeurs, franchises, ordre et formules multiples.",
    href: "/app/production/parametres/garanties",
    icon: ShieldCheck,
  },
  {
    title: "Marques",
    description: "Référentiel des marques véhicule.",
    href: "/app/production/parametres/marques",
    icon: Car,
  },
  {
    title: "Carrosseries",
    description: "Référentiel des carrosseries autorisées.",
    href: "/app/production/parametres/carrosseries",
    icon: Truck,
  },
  {
    title: "Carburants",
    description: "Types de carburant utilisés dans les tarifs et véhicules.",
    href: "/app/production/parametres/carburants",
    icon: Fuel,
  },
  {
    title: "Sous-classes",
    description: "Référentiel SC1, SC2, SC3, SC4 pour les usages concernés.",
    href: "/app/production/parametres/sous-classes",
    icon: Layers3,
  },
  {
    title: "Catégories transport",
    description: "Catégories utilisées par les usages et les tarifs.",
    href: "/app/production/parametres/categories-transport",
    icon: Layers3,
  },
];

export default function ProductionSettingsPage() {
  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
        <h1 className="text-xl font-semibold tracking-tight">Paramétrage production</h1>
        <p className="text-sm text-muted-foreground">Choisissez le référentiel à gérer.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} to={item.href} className="group">
              <Card className={cn("h-full border-border/70 shadow-none transition-colors", "group-hover:border-emerald-500/70 group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-950/20")}>
                <CardContent className="flex h-full items-start gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
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

      <Card className="border-border/70 shadow-none">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Wrench className="mt-0.5 size-4 text-emerald-700 dark:text-emerald-400" />
          <p>
            Les grilles tarifaires compagnie restent dans le workflow de création flotte/convention. Cette zone sert aux
            référentiels transverses de production, notamment les tarifs RC par usage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
