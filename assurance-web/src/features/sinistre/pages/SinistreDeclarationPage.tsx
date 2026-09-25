import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Check, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { contractApi } from "@/features/production/api/contracts";
import { referenceApi } from "@/features/production/api/references";
import type { ContratListItem } from "@/features/production/types";
import { sinistreApi, sinistreKeys } from "../api";
import { SinistreVilleSelect } from "../components/SinistreVilleSelect";
import { natureLabels } from "../format";
import type { NatureSinistre } from "../types";

const NATURES = Object.entries(natureLabels) as Array<[NatureSinistre, string]>;

export default function SinistreDeclarationPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [contract, setContract] = useState<ContratListItem | null>(null);
  const [dateSinistre, setDateSinistre] = useState("");
  const [dateDeclaration, setDateDeclaration] = useState(todayIso());
  const [heureSinistre, setHeureSinistre] = useState("");
  const [nature, setNature] = useState<NatureSinistre>("ACCIDENT");
  const [vehiculeId, setVehiculeId] = useState("");
  const [villeId, setVilleId] = useState("");
  const [lieu, setLieu] = useState("");
  const [circonstances, setCirconstances] = useState("");
  const [guaranteeIds, setGuaranteeIds] = useState<string[]>([]);

  const contracts = useQuery({
    queryKey: ["contracts", "sinistre-search", appliedSearch],
    queryFn: () =>
      contractApi.listContrats({
        search: appliedSearch,
        typeDate: "EFFET",
        page: 0,
        size: 12,
      }),
    enabled: appliedSearch.length >= 2,
  });
  const contractItems = useMemo(
    () =>
      (contracts.data?.items ?? [])
        .flatMap((group) => group.contrats)
        .filter((item) => !item.brouillon && item.statut === "ACTIVE"),
    [contracts.data],
  );
  const coverage = useQuery({
    queryKey:
      contract && dateSinistre
        ? sinistreKeys.coverage(contract.id, dateSinistre)
        : ["sinistres", "coverage", "idle"],
    queryFn: () => sinistreApi.coverage(contract!.id, dateSinistre),
    enabled: Boolean(contract && dateSinistre),
  });
  const cities = useQuery({
    queryKey: ["referentiel", "villes", "sinistre"],
    queryFn: () => referenceApi.list("villes"),
    staleTime: 60_000,
  });
  const selectedVehicle =
    coverage.data?.vehicules.find((vehicle) => vehicle.id === vehiculeId) ??
    (coverage.data?.vehicules.length === 1
      ? coverage.data.vehicules[0]
      : undefined);

  const create = useMutation({
    mutationFn: (declarer: boolean) =>
      sinistreApi.create({
        contratId: contract!.id,
        vehiculeId: selectedVehicle?.id,
        nature,
        dateSinistre,
        heureSinistre: heureSinistre || undefined,
        dateDeclaration,
        villeId: villeId || undefined,
        lieu: lieu.trim() || undefined,
        circonstances: circonstances.trim() || undefined,
        garantieIds: guaranteeIds,
        declarer,
      }),
    onSuccess: (result) => {
      toast.success(
        result.statut === "BROUILLON"
          ? "Brouillon enregistré"
          : "Sinistre déclaré",
      );
      navigate(`/app/sinistre/dossiers/${result.id}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Création impossible",
      ),
  });

  function selectContract(item: ContratListItem) {
    setContract(item);
    setVehiculeId("");
    setGuaranteeIds([]);
  }
  function selectVehicle(value: string) {
    setVehiculeId(value);
    setGuaranteeIds([]);
  }
  function runContractSearch() {
    const term = search.trim();
    if (term.length < 2) return;
    if (term === appliedSearch) {
      void contracts.refetch();
      return;
    }
    setAppliedSearch(term);
  }
  function submit(declarer: boolean) {
    if (!contract || !dateSinistre || !dateDeclaration || !selectedVehicle) {
      toast.error("Sélectionnez le contrat, les dates et le véhicule couvert");
      return;
    }
    if (declarer && (!circonstances.trim() || guaranteeIds.length === 0)) {
      toast.error(
        "Les circonstances et une garantie impliquée sont obligatoires pour déclarer",
      );
      return;
    }
    create.mutate(declarer);
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <div>
        <Button asChild variant="ghost" className="mb-2 -ml-3">
          <Link to="/app/sinistre/dossiers">
            <ArrowLeft className="size-4" />
            Retour aux dossiers
          </Link>
        </Button>
        <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">
          Sinistres
        </p>
        <h1 className="text-xl font-semibold">Déclarer un sinistre</h1>
        <p className="text-sm text-muted-foreground">
          La couverture est déterminée à la date exacte du sinistre.
        </p>
      </div>

      <Section
        number="1"
        title="Rechercher le contrat"
        description="Identifiez le contrat actif concerné par le sinistre."
        icon={Search}
        tone="sky"
      >
        <div className="flex max-w-3xl gap-2">
          <Input
            value={search}
            placeholder="N° police, dossier, assuré ou immatriculation"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && search.trim().length >= 2)
                runContractSearch();
            }}
          />
          <Button
            size="icon"
            aria-label="Rechercher"
            title={contracts.isFetching ? "Recherche en cours" : "Rechercher"}
            onClick={runContractSearch}
            disabled={search.trim().length < 2 || contracts.isFetching}
          >
            {contracts.isFetching ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
          </Button>
        </div>
        {contract ? (
          <Alert className="mt-4 border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950">
            <ShieldCheck className="size-4" />
            <AlertTitle>
              {contract.numeroPolice || contract.numeroDossier}
            </AlertTitle>
            <AlertDescription>
              {mainInsured(contract)} ·{" "}
              {contract.compagnieLibelle || contract.compagnieCode} · couverture
              du {contract.dateEffet} au {contract.dateEcheance}
            </AlertDescription>
          </Alert>
        ) : null}
        {!contract && appliedSearch && contracts.isFetching ? (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50/60 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
            <LoaderCircle className="size-4 animate-spin" />
            Recherche des contrats actifs...
          </div>
        ) : null}
        {!contract && appliedSearch && contracts.isError ? (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Recherche impossible</AlertTitle>
            <AlertDescription>
              {contracts.error instanceof Error ? contracts.error.message : "Les contrats n'ont pas pu être chargés."}
            </AlertDescription>
          </Alert>
        ) : null}
        {!contract && appliedSearch && !contracts.isFetching && !contracts.isError ? (
          <div className="mt-4 divide-y rounded-md border">
            {contractItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center justify-between gap-4 p-3 text-left hover:bg-muted/60"
                onClick={() => selectContract(item)}
              >
                <span>
                  <span className="block font-medium">
                    {item.numeroPolice || item.numeroDossier}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {mainInsured(item)} ·{" "}
                    {item.compagnieLibelle || item.compagnieCode}
                  </span>
                </span>
                <Check className="size-4 text-muted-foreground" />
              </button>
            ))}
            {contractItems.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Aucun contrat actif trouvé.
              </p>
            ) : null}
          </div>
        ) : null}
        {contract ? (
          <Button
            variant="link"
            className="mt-2 px-0"
            onClick={() => {
              setContract(null);
              setGuaranteeIds([]);
            }}
          >
            Changer de contrat
          </Button>
        ) : null}
      </Section>

      <Section
        number="2"
        title="Événement"
        description="Renseignez la date, le lieu et les circonstances exactes."
        icon={CalendarDays}
        tone="violet"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Date du sinistre *">
            <DatePicker
              date={dateSinistre}
              maxDate={new Date()}
              onSelect={(date) => {
                setDateSinistre(toIso(date));
                setVehiculeId("");
                setGuaranteeIds([]);
              }}
            />
          </Field>
          <Field label="Heure">
            <TimePicker
              value={heureSinistre}
              onChange={setHeureSinistre}
            />
          </Field>
          <Field label="Date de déclaration *">
            <DatePicker
              date={dateDeclaration}
              maxDate={new Date()}
              onSelect={(date) => setDateDeclaration(toIso(date))}
            />
          </Field>
          <Field label="Nature *">
            <Select
              value={nature}
              onValueChange={(value) => setNature(value as NatureSinistre)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATURES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ville">
            <SinistreVilleSelect
              cities={cities.data ?? []}
              value={villeId}
              onValueChange={setVilleId}
            />
          </Field>
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Lieu">
              <Input
                value={lieu}
                maxLength={500}
                onChange={(event) => setLieu(event.target.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <Field label="Circonstances">
              <Textarea
                value={circonstances}
                rows={5}
                maxLength={4000}
                onChange={(event) => setCirconstances(event.target.value)}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        number="3"
        title="Couverture impliquée"
        description="La couverture applicable est calculée à la date du sinistre."
        icon={ShieldCheck}
        tone="emerald"
      >
        {!contract || !dateSinistre ? (
          <p className="text-sm text-muted-foreground">
            Sélectionnez un contrat et la date du sinistre.
          </p>
        ) : null}
        {coverage.isFetching ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Vérification de la couverture...
          </div>
        ) : null}
        {coverage.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Couverture introuvable</AlertTitle>
            <AlertDescription>
              {coverage.error instanceof Error
                ? coverage.error.message
                : "Le contrat ne couvre pas cette date."}
            </AlertDescription>
          </Alert>
        ) : null}
        {coverage.data ? (
          <div className="grid gap-4">
            {coverage.data.vehicules.length > 1 ? (
              <Field label="Véhicule *">
                <Select value={vehiculeId} onValueChange={selectVehicle}>
                  <SelectTrigger className="max-w-xl">
                    <SelectValue placeholder="Sélectionner le véhicule concerné" />
                  </SelectTrigger>
                  <SelectContent>
                    {coverage.data.vehicules.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.immatriculation || "Sans immatriculation"} ·{" "}
                        {vehicle.marque || "Marque non renseignée"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {selectedVehicle ? (
              <div className="rounded-md border">
                <div className="border-b bg-muted/40 px-4 py-3">
                  <p className="font-medium">
                    {selectedVehicle.immatriculation || "Véhicule"} ·{" "}
                    {selectedVehicle.marque || "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Mouvement {coverage.data.numeroMouvement} ·{" "}
                    {coverage.data.mouvement} · attestation{" "}
                    {selectedVehicle.numeroAttestation || "-"}
                  </p>
                </div>
                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedVehicle.garanties.map((guarantee) => {
                    const checked = guaranteeIds.includes(guarantee.id);
                    return (
                      <label
                        key={guarantee.id}
                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            setGuaranteeIds((current) =>
                              value
                                ? [...current, guarantee.id]
                                : current.filter((id) => id !== guarantee.id),
                            )
                          }
                        />
                        <span>
                          <span className="block font-medium">
                            {guarantee.code} · {guarantee.libelle}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Capital{" "}
                            {guarantee.capital?.toLocaleString("fr-MA") ?? "-"}{" "}
                            MAD
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Section>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          disabled={create.isPending}
          onClick={() => submit(false)}
        >
          {create.isPending && create.variables === false ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Enregistrer en brouillon
        </Button>
        <Button disabled={create.isPending} onClick={() => submit(true)}>
          {create.isPending && create.variables === true ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Créer et déclarer
        </Button>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  description,
  icon: Icon,
  tone,
  children,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "sky" | "violet" | "emerald";
  children: React.ReactNode;
}) {
  const tones = {
    sky: "border-sky-200 bg-sky-50/60 text-sky-800 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-200",
    violet: "border-violet-200 bg-violet-50/60 text-violet-800 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-200",
    emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200",
  }[tone];
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className={`flex items-center gap-3 border-b px-5 py-4 ${tones}`}>
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-background/80 shadow-sm">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold"><span className="mr-1.5">{number}.</span>{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function mainInsured(contract: ContratListItem) {
  return (
    contract.clients?.find((client) => client.role === "SOUSCRIPTEUR")
      ?.nomAffichage ||
    contract.clients?.[0]?.nomAffichage ||
    "Assuré non renseigné"
  );
}
function todayIso() {
  return toIso(new Date());
}
function toIso(date?: Date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
