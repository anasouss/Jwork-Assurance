import { useEffect, useRef, useState } from "react";
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
import { referenceApi } from "@/features/production/api/references";
import { cn } from "@/lib/utils";
import { sinistreApi, sinistreKeys } from "../api";
import { damageLabels } from "../workflow";
import { openingContextParams } from "../opening-context";
import type { SinistreContractOption, TypeDommageSinistre, TypeRechercheContratSinistre } from "../types";

const searchLabels: Record<TypeRechercheContratSinistre, string> = { POLICE: "N° de police", IMMATRICULATION: "Immatriculation", ASSURE: "Assuré" };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContract?: SinistreContractOption;
  initialDateSinistre?: string;
  initialDateDeclaration?: string;
  initialVehicleId?: string;
  initialTypeDommage?: TypeDommageSinistre | "";
};

export function SinistreDeclarationContextDialog({
  open,
  onOpenChange,
  initialContract,
  initialDateSinistre = "",
  initialDateDeclaration = "",
  initialVehicleId = "",
  initialTypeDommage = "",
}: Props) {
  const navigate = useNavigate();
  const wasOpen = useRef(false);
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState<TypeRechercheContratSinistre>("POLICE");
  const [submittedSearch, setSubmittedSearch] = useState<{ brancheId: string; query: string; type: TypeRechercheContratSinistre } | null>(null);
  const [searchError, setSearchError] = useState("");
  const [contract, setContract] = useState<SinistreContractOption | null>(null);
  const [dateSinistre, setDateSinistre] = useState("");
  const [dateDeclaration, setDateDeclaration] = useState("");
  const [vehiculeId, setVehiculeId] = useState("");
  const [brancheId, setBrancheId] = useState("");
  const [typeDommage, setTypeDommage] = useState<TypeDommageSinistre | "">("");
  const branches = useQuery({
    queryKey: ["referentiel", "branches-assurance"],
    queryFn: () => referenceApi.list("branches-assurance"),
    enabled: open,
    staleTime: 60_000,
  });
  const effectiveBrancheId = brancheId || branches.data?.find((item) => item.code === contract?.brancheAssuranceCode)?.id || "";

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSearch("");
      setSearchType("POLICE");
      setSubmittedSearch(null);
      setSearchError("");
      setContract(initialContract ?? null);
      setDateSinistre(initialDateSinistre);
      setDateDeclaration(initialDateDeclaration || toIso(new Date()));
      setVehiculeId(initialVehicleId);
      setBrancheId("");
      setTypeDommage(initialTypeDommage);
    }
    wasOpen.current = open;
  }, [initialContract, initialDateSinistre, initialDateDeclaration, initialVehicleId, initialTypeDommage, open]);

  const automobile = (branches.data?.find((item) => item.id === effectiveBrancheId)?.code
    ?? contract?.brancheAssuranceCode) === "AUTOMOBILE";

  const contracts = useQuery({
    queryKey: sinistreKeys.contracts(submittedSearch?.brancheId ?? "", submittedSearch?.query ?? "", submittedSearch?.type ?? searchType),
    queryFn: () => sinistreApi.lookupContracts(submittedSearch!.brancheId, submittedSearch!.query, submittedSearch!.type),
    enabled: open && !!submittedSearch && !contract,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const contractItems = contracts.data ?? [];
  const searchAllowed = !!effectiveBrancheId && (!automobile || !!typeDommage);
  const searchComplete = search.trim().length >= (searchType === "ASSURE" ? 3 : 1);
  function runSearch() {
    if (!searchAllowed) return;
    if (!searchComplete) {
      setSearchError(searchType === "ASSURE" ? "Renseignez au moins 3 caractères du nom de l’assuré." : "Renseignez la référence complète.");
      return;
    }
    setSearchError("");
    if (submittedSearch?.brancheId === effectiveBrancheId && submittedSearch.type === searchType && submittedSearch.query === search.trim()) {
      void contracts.refetch();
    } else {
      setSubmittedSearch({ brancheId: effectiveBrancheId, query: search.trim(), type: searchType });
    }
  }
  const coverage = useQuery({
    queryKey:
      contract && dateSinistre
        ? sinistreKeys.coverage(contract.id, dateSinistre)
        : ["sinistres", "coverage", "context-idle"],
    queryFn: () => sinistreApi.coverage(contract!.id, dateSinistre),
    enabled: open && Boolean(contract && dateSinistre),
    retry: false,
  });

  useEffect(() => {
    if (!coverage.data) return;
    const coveredVehicles = coverage.data.vehicules;
    setVehiculeId(current => {
      if (!automobile) return "";
      if (coveredVehicles.some(vehicle => vehicle.id === current)) return current;
      const matchedIds = new Set(contract?.vehiculesCorrespondants?.map(vehicle => vehicle.id) ?? []);
      if (matchedIds.size) {
        const matches = coveredVehicles.filter(vehicle => matchedIds.has(vehicle.id));
        return matches.length === 1 ? matches[0].id : "";
      }
      return coveredVehicles.length === 1 ? coveredVehicles[0].id : "";
    });
  }, [automobile, coverage.data, contract, dateSinistre]);

  function selectContract(item: SinistreContractOption) {
    setContract(item);
    setSearch("");
    setSubmittedSearch(null);
    const matchedIds = [...new Set(item.vehiculesCorrespondants?.map(vehicle => vehicle.id) ?? [])];
    setVehiculeId(matchedIds.length === 1 ? matchedIds[0] : "");
  }

  function resetContract() {
    setBrancheId(effectiveBrancheId);
    setContract(null);
    setSubmittedSearch(null);
    setVehiculeId("");
  }

  function continueDeclaration() {
    if (!canContinue || !contract || !coverage.data) return;
    if (automobile && !typeDommage) return;
    const params = openingContextParams({
      contratId: contract.id,
      dateSinistre,
      dateDeclaration,
      vehiculeId,
      automobile,
      typeDommage,
    });
    onOpenChange(false);
    navigate(`/app/sinistre/declarer?${params.toString()}`);
  }

  const vehicleRequired = automobile && (coverage.data?.vehicules.length ?? 0) > 1;
  const canContinue = Boolean(
    contract &&
      dateSinistre &&
      dateDeclaration && dateDeclaration >= dateSinistre && dateDeclaration <= toIso(new Date()) &&
      dateSinistre <= toIso(new Date()) &&
      coverage.data &&
      !coverage.isFetching &&
      (!automobile || typeDommage) &&
      (!automobile || coverage.data.vehicules.some(vehicle => vehicle.id === vehiculeId)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:!max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouvelle ouverture</DialogTitle>
          <DialogDescription className="sr-only">Police et événement du sinistre</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Branche <span className="text-red-500">*</span></Label>
            <Select value={effectiveBrancheId}
              onValueChange={(value) => { setBrancheId(value); setContract(null); setVehiculeId(""); setSearch(""); setSubmittedSearch(null); setSearchError(""); setTypeDommage(""); }}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une branche" /></SelectTrigger>
              <SelectContent>{(branches.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}</SelectContent>
            </Select>
            {branches.isError ? <p role="alert" className="text-sm text-destructive">Chargement des branches impossible.</p> : null}
          </div>
          {automobile ? <div className="grid gap-2">
            <Label htmlFor="opening-damage">Dommages <span className="text-red-500">*</span></Label>
            <Select value={typeDommage} onValueChange={(value) => setTypeDommage(value as TypeDommageSinistre)}>
              <SelectTrigger id="opening-damage"><SelectValue placeholder="Sélectionner les dommages" /></SelectTrigger>
              <SelectContent>{(Object.entries(damageLabels) as [TypeDommageSinistre, string][]).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="claim-contract-search">Police, assuré ou immatriculation <span className="text-red-500">*</span></Label>
            {contract ? (
              <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/35 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">Police sélectionnée</p>
                    <Badge variant="outline">
                      {contract.brancheAssuranceLibelle || contract.brancheAssuranceCode || "Branche non renseignée"}
                    </Badge>
                  </div>
                  <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
                    <SummaryValue label="N° de police" value={contract.numeroPolice || "-"} />
                    <SummaryValue label="Assuré" value={mainInsured(contract)} />
                    <SummaryValue label="Compagnie" value={contract.compagnieLibelle || contract.compagnieCode || "-"} />
                    <SummaryValue label="Date d’effet" value={contract.dateEffet ? formatIsoDate(contract.dateEffet) : "-"} />
                    <SummaryValue label="Date d’expiration" value={contract.dateEcheance ? formatIsoDate(contract.dateEcheance) : "-"} />
                  </dl>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={resetContract}>
                  Changer
                </Button>
              </div>
            ) : (
              <div>
                <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_40px]">
                <Select value={searchType} onValueChange={value => { setSearchType(value as TypeRechercheContratSinistre); setSubmittedSearch(null); setSearchError(""); setSearch(""); }} disabled={!searchAllowed}>
                  <SelectTrigger aria-label="Type de recherche"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(searchLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
                <Input
                  id="claim-contract-search"
                  autoFocus
                  disabled={!searchAllowed}
                  value={search}
                  placeholder={searchLabels[searchType]}
                  maxLength={120}
                  onChange={(event) => { setSearch(event.target.value); setSubmittedSearch(null); setSearchError(""); }}
                  onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); runSearch(); } }}
                />
                <Button type="button" size="icon" title="Rechercher" aria-label="Rechercher" disabled={!searchAllowed || !searchComplete || contracts.isFetching} onClick={runSearch}><Search className="size-4" /></Button>
                </div>
                {searchError ? <p role="alert" className="mt-2 text-sm text-destructive">{searchError}</p> : null}
                {submittedSearch ? (
                  <div className="mt-2 overflow-hidden rounded-md border bg-background">
                    {contracts.isFetching ? (
                      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" /> Recherche en cours…
                      </p>
                    ) : contracts.isError ? (
                      <p role="alert" className="p-4 text-sm text-destructive">{contracts.error instanceof Error ? contracts.error.message : "Recherche impossible."}</p>
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
                                N° de police : {item.numeroPolice || "-"}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {item.brancheAssuranceLibelle || item.brancheAssuranceCode || "-"}
                                </span>
                              </span>
                              <span className="block truncate text-sm text-muted-foreground">
                                Assuré : {mainInsured(item)} · Compagnie : {item.compagnieLibelle || item.compagnieCode || "-"}
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">{contractPeriod(item)}</span>
                              {item.vehiculesCorrespondants?.length ? <span className="mt-1 block break-words text-xs text-sky-700 dark:text-sky-400">Immatriculation : {[...new Set(item.vehiculesCorrespondants.map(vehicle => vehicle.immatriculation || "-"))].join(", ")}</span> : null}
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
              <Label>Date du sinistre <span className="text-red-500">*</span></Label>
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
              <Label>Date de déclaration <span className="text-red-500">*</span></Label>
              <DatePicker date={dateDeclaration} maxDate={new Date()} onSelect={date => setDateDeclaration(toIso(date))} />
              {dateDeclaration && dateSinistre && dateDeclaration < dateSinistre ? <p role="alert" className="text-sm text-destructive">La déclaration ne peut pas précéder le sinistre.</p> : null}
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
                  <Label>Véhicule concerné <span className="text-red-500">*</span></Label>
                  {contract?.vehiculesCorrespondants?.length && !coverage.data.vehicules.some(vehicle => contract.vehiculesCorrespondants?.some(match => match.id === vehicle.id)) ? <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">Le véhicule recherché n’est pas couvert à cette date. Vérifiez la police, la date et le véhicule concerné.</p> : null}
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
            Continuer l’ouverture
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mainInsured(contract: SinistreContractOption) {
  return (
    contract.clients?.find((client) => client.role === "PROPRIETAIRE")?.nomAffichage ||
    contract.clients?.find((client) => client.role === "SOUSCRIPTEUR")?.nomAffichage ||
    contract.clients?.[0]?.nomAffichage ||
    "Assuré non renseigné"
  );
}

function contractPeriod(contract: SinistreContractOption) {
  return `Effet : ${contract.dateEffet ? formatIsoDate(contract.dateEffet) : "-"} · Expiration : ${contract.dateEcheance ? formatIsoDate(contract.dateEcheance) : "-"}`;
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words font-medium">{value}</dd></div>;
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
