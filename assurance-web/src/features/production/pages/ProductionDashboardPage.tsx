import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Archive,
  CalendarDays,
  FilePlus2,
  FileText,
  List,
  Plus,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { toDateOnly } from "../date";

type ProductionAction = {
  title: string;
  icon: typeof FilePlus2;
  href?: string;
  permission: string;
  primary?: boolean;
  disabled?: boolean;
  modal?: "echeances";
};

export default function ProductionDashboardPage() {
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const [echeanceDialogOpen, setEcheanceDialogOpen] = useState(false);
  const [echeanceFilters, setEcheanceFilters] = useState<{ dateDu?: string; dateAu?: string }>({});

  const actions: ProductionAction[] = [
    { title: "Ajouter un dossier", icon: FilePlus2, href: "/app/production/ajouter-dossier", permission: "contrat:create", primary: true },
    { title: "Ajouter un avenant", icon: Plus, href: "/app/production/contrats", permission: "contrat:update" },
    { title: "Liste des dossiers", icon: List, href: "/app/production/contrats", permission: "contrat:view" },
    { title: "Gestion des échéances", icon: CalendarDays, permission: "contrat:view", modal: "echeances" },
    { title: "Registre de production", icon: FileText, href: "/app/production/contrats", permission: "contrat:view" },
    { title: "Portefeuille client", icon: Users, href: "/app/production/contrats", permission: "client:view" },
    { title: "Prospection", icon: Target, href: "/app/production/prospection", permission: "contrat:view" },
    { title: "Gestion du stock", icon: Archive, href: "/app/production/attestations-stock", permission: "contrat:view" },
  ].filter((item) => !item.permission || permissions.includes(item.permission));

  const hasDateError = Boolean(echeanceFilters.dateDu && echeanceFilters.dateAu && echeanceFilters.dateDu > echeanceFilters.dateAu);
  const canOpenEcheances = Boolean(echeanceFilters.dateDu && echeanceFilters.dateAu && !hasDateError);

  function openEcheances() {
    if (!canOpenEcheances) {
      return;
    }
    const params = new URLSearchParams({
      nature: "AUTOMOBILE",
      dateDu: echeanceFilters.dateDu ?? "",
      dateAu: echeanceFilters.dateAu ?? "",
    });
    navigate(`/app/production/echeances?${params.toString()}`);
    setEcheanceDialogOpen(false);
  }

  return (
    <div className="grid gap-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Production</div>
        <div className="mt-1">
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Module production</h1>
          <p className="text-sm text-muted-foreground">Choisissez l'opération à effectuer.</p>
        </div>
      </div>

      <section className="-mx-4 border-y bg-card px-4 py-5">
        <div className="mx-auto grid w-full max-w-7xl gap-3 md:grid-cols-2 xl:grid-cols-4">
          {actions.map((item) => {
            const content = (
              <>
                <span className={item.primary ? "text-white" : "text-emerald-700 dark:text-emerald-400"}>
                  <item.icon className="size-4" />
                </span>
                <span>{item.title}</span>
              </>
            );
            const className = item.primary
              ? "flex h-12 items-center gap-3 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              : "flex h-12 items-center gap-3 rounded-md border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-200";

            if (item.disabled) {
              return (
                <button
                  key={item.title}
                  type="button"
                  disabled
                  className="flex h-12 items-center gap-3 rounded-md border border-dashed bg-muted/30 px-4 text-sm font-semibold text-muted-foreground"
                >
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </button>
              );
            }

            if (item.modal === "echeances") {
              return (
                <button key={item.title} type="button" className={className} onClick={() => setEcheanceDialogOpen(true)}>
                  {content}
                </button>
              );
            }

            return (
              <Link key={item.title} to={item.href ?? "#"} className={className}>
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      <Dialog open={echeanceDialogOpen} onOpenChange={setEcheanceDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gestion des échéances</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <EcheanceNatureCard title="Automobile" status="Actif" active />
              <EcheanceNatureCard title="Risques divers" status="À venir" disabled />
              <EcheanceNatureCard title="Assistance" status="À venir" disabled />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-semibold uppercase text-emerald-950">
                <span>Date du</span>
                <DatePicker
                  date={echeanceFilters.dateDu}
                  onSelect={(date) => setEcheanceFilters((current) => ({ ...current, dateDu: toDateOnly(date) }))}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold uppercase text-emerald-950">
                <span>Date au</span>
                <DatePicker
                  date={echeanceFilters.dateAu}
                  onSelect={(date) => setEcheanceFilters((current) => ({ ...current, dateAu: toDateOnly(date) }))}
                />
              </label>
            </div>
            {hasDateError ? <p className="text-sm font-medium text-red-600">La date du doit être inférieure ou égale à la date au.</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEcheanceDialogOpen(false)}>Annuler</Button>
            <Button className="bg-green-600 hover:bg-green-700" disabled={!canOpenEcheances} onClick={openEcheances}>
              Afficher l'échéancier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EcheanceNatureCard({ title, status, active, disabled }: { title: string; status: string; active?: boolean; disabled?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-20 items-start justify-between rounded-md border p-4",
        active && "border-emerald-500 bg-emerald-50",
        disabled && "border-dashed bg-muted/20 text-muted-foreground"
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn("size-3 rounded-full border", active && "border-emerald-600 bg-emerald-600")} />
        <span className="font-semibold">{title}</span>
      </span>
      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", disabled ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
        {status}
      </span>
    </div>
  );
}
