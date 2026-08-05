import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  ClipboardCheck,
  FilePlus2,
  FolderOpen,
  RotateCcw,
  Scale,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/store/auth-store";
import { sinistreApi, sinistreKeys } from "../api";
import { formatDate, formatMoney, natureLabels } from "../format";
import { SinistreStatusBadge } from "../components/SinistreStatusBadge";

export default function SinistreDashboardPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canCreate = permissions.includes("sinistre:create");
  const dashboard = useQuery({
    queryKey: sinistreKeys.dashboard(),
    queryFn: sinistreApi.dashboard,
  });

  const metrics = dashboard.data
    ? [
        {
          label: "Dossiers ouverts",
          value: dashboard.data.ouverts,
          icon: FolderOpen,
        },
        {
          label: "Déclarés ce mois",
          value: dashboard.data.declaresCeMois,
          icon: FilePlus2,
        },
        {
          label: "En expertise",
          value: dashboard.data.enExpertise,
          icon: ClipboardCheck,
        },
        {
          label: "En attente de règlement",
          value: dashboard.data.enAttenteReglement,
          icon: Banknote,
        },
        {
          label: "Provisions ouvertes",
          value: formatMoney(dashboard.data.provisionsOuvertes),
          icon: Scale,
        },
        {
          label: "Recours de l’année",
          value: formatMoney(dashboard.data.recoursAnnee),
          icon: RotateCcw,
        },
      ]
    : [];

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">
            Sinistres
          </p>
          <h1 className="text-xl font-semibold">Pilotage des sinistres</h1>
          <p className="text-sm text-muted-foreground">
            Dossiers, expertises, provisions et règlements de l’agence.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/app/sinistre/dossiers">Voir les dossiers</Link>
          </Button>
          {canCreate ? (
            <Button asChild>
              <Link to="/app/sinistre/declarer">
                <FilePlus2 className="size-4" />
                Déclarer
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {dashboard.isLoading
          ? Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-24" />
            ))
          : metrics.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="shadow-none">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-semibold">{value}</p>
                  </div>
                  <div className="grid size-10 place-items-center rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    <Icon className="size-5" />
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Dossiers récents</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/sinistre/dossiers">
              Tout afficher
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° sinistre</TableHead>
                  <TableHead>Assuré</TableHead>
                  <TableHead>Nature</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Compagnie</TableHead>
                  <TableHead>Provision</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dashboard.data?.recents ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                        to={`/app/sinistre/dossiers/${item.id}`}
                      >
                        {item.numeroSinistre}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {item.numeroPolice || "Sans police"}
                      </div>
                    </TableCell>
                    <TableCell>{item.assure || "-"}</TableCell>
                    <TableCell>{natureLabels[item.nature]}</TableCell>
                    <TableCell>{formatDate(item.dateSinistre)}</TableCell>
                    <TableCell>{item.compagnie || "-"}</TableCell>
                    <TableCell>{formatMoney(item.provisionCourante)}</TableCell>
                    <TableCell>
                      <SinistreStatusBadge statut={item.statut} />
                    </TableCell>
                  </TableRow>
                ))}
                {!dashboard.isLoading &&
                (dashboard.data?.recents.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Aucun sinistre enregistré.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
