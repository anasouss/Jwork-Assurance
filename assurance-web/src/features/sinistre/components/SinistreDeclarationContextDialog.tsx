import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Car,
  Check,
  LoaderCircle,
  Search,
  Shield,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contractApi } from "@/features/production/api/contracts";
import type { ContratListItem } from "@/features/production/types";
import { cn } from "@/lib/utils";
import { sinistreApi, sinistreKeys } from "../api";
import { natureLabels } from "../format";
import type { NatureSinistre } from "../types";

const NATURES = Object.entries(natureLabels) as Array<[NatureSinistre, string]>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContract?: ContextContract;
  initialDateSinistre?: string;
  initialNature?: NatureSinistre;
  initialVehicleId?: string;
};

type ContextContract = Pick<
  ContratListItem,
  | "id"
  | "numeroPolice"
  | "numeroDossier"
  | "brancheAssuranceCode"
  | "brancheAssuranceLibelle"
  | "compagnieCode"
  | "compagnieLibelle"
  | "clients"
>;

export function SinistreDeclarationContextDialog({
  open,
  onOpenChange,
  initialContract,
  initialDateSinistre = "",
  initialNature = "ACCIDENT",
  initialVehicleId = "",
}: Props) {
  const navigate = useNavigate();
  const wasOpen = useRef(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [contract, setContract] = useState<ContextContract | null>(null);
  const [dateSinistre, setDateSinistre] = useState("");
  const [nature, setNature] = useState<NatureSinistre>("ACCIDENT");
  const [vehiculeId, setVehiculeId] = useState("");

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSearch("");
      setContract(initialContract ?? null);
      setDateSinistre(initialDateSinistre);
      setNature(initialNature);
      setVehiculeId(initialVehicleId);
    }
    wasOpen.current = open;
  }, [initialContract, initialDateSinistre, initialNature, initialVehicleId, open]);

  const contracts = useQuery({
    queryKey: ["contracts", "sinistre-context-search", deferredSearch],
    queryFn: () =>
      contractApi.listContrats({
        search: deferredSearch,
        typeDate: "EFFET",
        page: 0,
        size: 10,
      }),
    enabled: open && deferredSearch.length >= 2 && !contract,
  });
  const contractItems = useMemo(
    () =>
      (contracts.data?.items ?? [])
        .flatMap((group) => group.contrats)
        .filter((item) => !item.brouillon && !item.prospection && item.statut !== "DRAFT"),
    [contracts.data],
  );
  const coverage = useQuery({
    queryKey:
      contract && dateSinistre
        ? sinistreKeys.coverage(contract.id, dateSinistre)
        : ["sinistres", "coverage", "context-idle"],
    queryFn: () => sinistreApi.coverage(contract!.id, dateSinistre),
    enabled: open && Boolean(contract && dateSinistre),
    retry: false,
  });
  const automobile =
    (coverage.data?.brancheCode ?? contract?.brancheAssuranceCode) === "AUTOMOBILE";

  useEffect(() => {
    if (!coverage.data) return;
    if (coverage.data.vehicules.length === 1) {
      setVehiculeId(coverage.data.vehicules[0].id);
    } else if (!automobile) {
      setVehiculeId("");
    }
  }, [automobile, coverage.data]);

  function selectContract(item: ContextContract) {
    setContract(item);
    setSearch("");
    setVehiculeId("");
  }

  function resetContract() {
    setContract(null);
    setVehiculeId("");
  }

  function continueDeclaration() {
    if (!contract || !dateSinistre || !coverage.data) return;
    const params = new URLSearchParams({
      contratId: contract.id,
      dateSinistre,
      nature,
    });
    if (vehiculeId) params.set("vehiculeId", vehiculeId);
    onOpenChange(false);
    navigate(`/app/sinistre/declarer?${params.toString()}`);
  }

  const vehicleRequired = automobile && (coverage.data?.vehicules.length ?? 0) > 1;
  const canContinue = Boolean(
    contract &&
      dateSinistre &&
      coverage.data &&
      !coverage.isFetching &&
      (!automobile || vehiculeId),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:!max-w-3xl">
        <DialogHeader>
          <DialogTitle>Commencer une déclaration</DialogTitle>
          <DialogDescription>
            Identifiez la police et l’événement. Les garanties seront vérifiées à la date du sinistre.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-1">
          <div className="grid gap-2">
            <Label htmlFor="claim-contract-search">Police ou assuré</Label>
            {contract ? (
              <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/35 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{contract.numeroPolice || contract.numeroDossier}</p>
                    <Badge variant="outline">
                      {contract.brancheAssuranceLibelle || contract.brancheAssuranceCode || "Branche non renseignée"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mainInsured(contract)} · {contract.compagnieLibelle || contract.compagnieCode || "-"}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={resetContract}>
                  Changer
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="claim-contract-search"
                  className="pl-9"
                  autoFocus
                  value={search}
                  placeholder="N° police, dossier, assuré, immatriculation ou attestation"
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search.trim().length >= 2 ? (
                  <div className="mt-2 overflow-hidden rounded-md border bg-background">
                    {contracts.isFetching ? (
                      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" /> Recherche en cours…
                      </p>
                    ) : contractItems.length > 0 ? (
                      <div className="divide-y">
                        {contractItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="flex w-full cursor-pointer items-center justify-between gap-4 p-3 text-left hover:bg-muted/60"
                            onClick={() => selectContract(item)}
                          >
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-2 font-medium">
                                {item.numeroPolice || item.numeroDossier}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {item.brancheAssuranceLibelle || item.brancheAssuranceCode || "-"}
                                </span>
                              </span>
                              <span className="block truncate text-sm text-muted-foreground">
                                {mainInsured(item)} · {item.compagnieLibelle || item.compagnieCode || "-"}
                              </span>
                            </span>
                            <Check className="size-4 shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="p-4 text-sm text-muted-foreground">Aucun contrat trouvé.</p>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Date du sinistre *</Label>
              <DatePicker
                date={dateSinistre}
                maxDate={new Date()}
                onSelect={(date) => {
                  setDateSinistre(toIso(date));
                  setVehiculeId("");
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>Nature de l’événement *</Label>
              <Select value={nature} onValueChange={(value) => setNature(value as NatureSinistre)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NATURES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {coverage.isFetching ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Vérification de la couverture…
            </p>
          ) : null}
          {coverage.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Couverture indisponible</AlertTitle>
              <AlertDescription>
                {coverage.error instanceof Error ? coverage.error.message : "La police ne couvre pas cette date."}
              </AlertDescription>
            </Alert>
          ) : null}
          {coverage.data ? (
            <div className="grid gap-4 overflow-hidden rounded-md border border-sky-200 bg-sky-50/35 p-4 dark:border-sky-900 dark:bg-sky-950/20">
              <div className="flex flex-wrap items-center gap-3 border-b border-sky-200 pb-3 text-sm dark:border-sky-900">
                <span className="flex items-center gap-2 font-medium">
                  <Shield className="size-4 text-sky-700" />
                  {coverage.data.brancheLibelle || coverage.data.brancheCode || "Branche"}
                </span>
                <span className="text-muted-foreground">
                  Couverture du {formatIsoDate(coverage.data.dateEffet)} au {formatIsoDate(coverage.data.dateEcheance)}
                </span>
              </div>
              {automobile ? (
                <div className="grid gap-2">
                  <Label>Véhicule concerné *</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {coverage.data.vehicules.map((vehicle) => {
                      const selected = vehicle.id === vehiculeId;
                      return (
                        <button
                          key={vehicle.id}
                          type="button"
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-md border p-3 text-left",
                            selected
                              ? "border-sky-600 bg-sky-100/80 shadow-sm dark:border-sky-500 dark:bg-sky-950/55"
                              : "bg-background/80 hover:border-sky-300 hover:bg-background dark:hover:border-sky-800",
                          )}
                          onClick={() => setVehiculeId(vehicle.id)}
                        >
                          <Car className="size-5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block font-medium">{vehicle.immatriculation || "Sans immatriculation"}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {vehicle.marque || "Marque non renseignée"} · {vehicle.usageLibelle || vehicle.usageCode || "Usage non renseigné"}
                            </span>
                          </span>
                          {selected ? <Check className="ml-auto size-4 shrink-0 text-sky-700" /> : null}
                        </button>
                      );
                    })}
                  </div>
                  {vehicleRequired && !vehiculeId ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">Sélectionnez le véhicule impliqué.</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun véhicule n’est requis pour cette branche.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" disabled={!canContinue} onClick={continueDeclaration}>
            Continuer la déclaration
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mainInsured(contract: ContextContract) {
  return (
    contract.clients?.find((client) => client.role === "PROPRIETAIRE")?.nomAffichage ||
    contract.clients?.find((client) => client.role === "SOUSCRIPTEUR")?.nomAffichage ||
    contract.clients?.[0]?.nomAffichage ||
    "Assuré non renseigné"
  );
}

function toIso(date?: Date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
