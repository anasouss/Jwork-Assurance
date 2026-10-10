import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, LoaderCircle, MapPin, Pencil, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { referenceApi } from "@/features/production/api/references";
import { sinistreApi, sinistreKeys } from "../api";
import { SinistreDeclarationContextDialog } from "../components/SinistreDeclarationContextDialog";
import { SinistreVilleSelect } from "../components/SinistreVilleSelect";
import { natureLabels } from "../format";
import type { CoverageGuarantee, NatureSinistre } from "../types";

const GUARANTEE_GROUPS = [
  { type: "VEHICULE", label: "Garanties du risque" },
  { type: "PERSONNE", label: "Garanties de personnes" },
] as const;
const VALID_NATURES = new Set<NatureSinistre>([
  "ACCIDENT", "VOL", "INCENDIE", "BRIS_DE_GLACE", "DOMMAGE_VEHICULE", "CORPOREL", "ASSISTANCE", "AUTRE",
]);

export default function SinistreDeclarationPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const contratId = params.get("contratId") ?? "";
  const dateSinistre = params.get("dateSinistre") ?? "";
  const requestedVehicleId = params.get("vehiculeId") ?? "";
  const natureParam = params.get("nature") as NatureSinistre | null;
  const nature = natureParam && VALID_NATURES.has(natureParam) ? natureParam : null;
  const hasContext = Boolean(contratId && dateSinistre && nature);
  const [contextOpen, setContextOpen] = useState(!hasContext);
  const [dateDeclaration, setDateDeclaration] = useState(todayIso());
  const [heureSinistre, setHeureSinistre] = useState("");
  const [villeId, setVilleId] = useState("");
  const [lieu, setLieu] = useState("");
  const [circonstances, setCirconstances] = useState("");
  const [guaranteeIds, setGuaranteeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!hasContext) setContextOpen(true);
    setGuaranteeIds([]);
  }, [contratId, dateSinistre, hasContext, requestedVehicleId]);

  const coverage = useQuery({
    queryKey: hasContext ? sinistreKeys.coverage(contratId, dateSinistre) : ["sinistres", "coverage", "declaration-idle"],
    queryFn: () => sinistreApi.coverage(contratId, dateSinistre),
    enabled: hasContext,
    retry: false,
  });
  const automobile = coverage.data?.brancheCode === "AUTOMOBILE";
  const selectedVehicle = useMemo(() => {
    if (!coverage.data || !automobile) return undefined;
    return coverage.data.vehicules.find((vehicle) => vehicle.id === requestedVehicleId)
      ?? (coverage.data.vehicules.length === 1 ? coverage.data.vehicules[0] : undefined);
  }, [automobile, coverage.data, requestedVehicleId]);
  const guarantees = selectedVehicle?.garanties ?? coverage.data?.garanties ?? [];
  const initialContract = useMemo(() => coverage.data ? ({
    id: coverage.data.contratId,
    numeroPolice: coverage.data.numeroPolice,
    numeroDossier: coverage.data.numeroDossier,
    brancheAssuranceCode: coverage.data.brancheCode,
    brancheAssuranceLibelle: coverage.data.brancheLibelle,
    compagnieLibelle: coverage.data.compagnie,
    clients: [{
      clientId: "",
      nomAffichage: coverage.data.assure,
      role: "PROPRIETAIRE",
      principalPourRole: true,
    }],
  }) : undefined, [coverage.data]);
  const duplicates = useQuery({
    queryKey: hasContext && coverage.data && (!automobile || selectedVehicle)
      ? sinistreKeys.duplicates(contratId, selectedVehicle?.id, dateSinistre)
      : ["sinistres", "duplicates", "declaration-idle"],
    queryFn: () => sinistreApi.duplicates(contratId, selectedVehicle?.id, dateSinistre),
    enabled: Boolean(hasContext && coverage.data && (!automobile || selectedVehicle)),
  });
  const cities = useQuery({
    queryKey: ["referentiel", "villes", "sinistre"],
    queryFn: () => referenceApi.list("villes"),
    staleTime: 60_000,
  });
  const create = useMutation({
    mutationFn: (declarer: boolean) => sinistreApi.create({
      contratId,
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
      toast.success(result.statut === "BROUILLON" ? "Brouillon enregistré" : "Sinistre déclaré");
      navigate(`/app/sinistre/dossiers/${result.id}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });

  function submit(declarer: boolean) {
    if (!hasContext || !coverage.data || (automobile && !selectedVehicle)) {
      toast.error("Le contexte de couverture est incomplet");
      return;
    }
    if (!dateDeclaration) {
      toast.error("La date de déclaration est obligatoire");
      return;
    }
    if (declarer && (!circonstances.trim() || guaranteeIds.length === 0)) {
      toast.error("Les circonstances et une garantie impliquée sont obligatoires pour déclarer");
      return;
    }
    create.mutate(declarer);
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-2 -ml-3">
            <Link to="/app/sinistre/dossiers"><ArrowLeft className="size-4" /> Retour aux dossiers</Link>
          </Button>
          <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">Sinistres</p>
          <h1 className="text-xl font-semibold">Déclarer un sinistre</h1>
          <p className="text-sm text-muted-foreground">Complétez les circonstances et identifiez les garanties impliquées.</p>
        </div>
        {hasContext ? (
          <Button variant="outline" onClick={() => setContextOpen(true)}><Pencil className="size-4" /> Modifier le contexte</Button>
        ) : null}
      </div>

      {!hasContext ? (
        <div className="rounded-md border border-dashed px-6 py-12 text-center">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Aucune police sélectionnée</p>
          <p className="mt-1 text-sm text-muted-foreground">Sélectionnez la police et l’événement pour commencer la déclaration.</p>
          <Button className="mt-4" onClick={() => setContextOpen(true)}>Sélectionner une police</Button>
        </div>
      ) : null}
      {coverage.isFetching ? (
        <div className="flex min-h-40 items-center justify-center gap-2 rounded-md border text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Vérification de la couverture…
        </div>
      ) : null}
      {coverage.isError ? (
        <Alert variant="destructive"><AlertTitle>Contexte de couverture invalide</AlertTitle><AlertDescription>
          {coverage.error instanceof Error ? coverage.error.message : "La couverture n’a pas pu être chargée."}
        </AlertDescription></Alert>
      ) : null}

      {coverage.data && nature ? (
        <>
          <section className="overflow-hidden rounded-md border bg-card">
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
              <ContextItem label="Police" value={coverage.data.numeroPolice || coverage.data.numeroDossier || "-"} />
              <ContextItem label="Assuré" value={coverage.data.assure} />
              <ContextItem label="Branche" value={coverage.data.brancheLibelle || coverage.data.brancheCode || "-"} />
              <ContextItem label={automobile ? "Véhicule" : "Événement"} value={automobile
                ? selectedVehicle?.immatriculation || "Véhicule non sélectionné"
                : natureLabels[nature]} />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t bg-muted/20 px-4 py-3 text-sm">
              <span className="flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" /> Sinistre du <strong>{formatIsoDate(dateSinistre)}</strong></span>
              <strong>{natureLabels[nature]}</strong>
              <span className="text-muted-foreground">{coverage.data.compagnie} · mouvement {coverage.data.numeroMouvement}</span>
            </div>
          </section>

          {(duplicates.data?.length ?? 0) > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-medium">Un dossier existe déjà pour cette police, ce risque et cette date.</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {duplicates.data!.map((item) => (
                  <Link key={item.id} className="underline underline-offset-2" to={`/app/sinistre/dossiers/${item.id}`}>
                    {item.numeroSinistre} · {natureLabels[item.nature]}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <Section title="Circonstances de l’événement" description="Renseignez les informations connues au moment de la déclaration." icon={MapPin}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Date de déclaration *"><DatePicker date={dateDeclaration} maxDate={new Date()} onSelect={(date) => setDateDeclaration(toIso(date))} /></Field>
              <Field label="Heure du sinistre"><TimePicker value={heureSinistre} onChange={setHeureSinistre} /></Field>
              <Field label="Ville"><SinistreVilleSelect cities={cities.data ?? []} value={villeId} onValueChange={setVilleId} /></Field>
              <Field label="Lieu précis"><Input value={lieu} maxLength={500} onChange={(event) => setLieu(event.target.value)} /></Field>
              <div className="md:col-span-2 lg:col-span-4">
                <Field label="Circonstances *"><Textarea value={circonstances} rows={5} maxLength={4000}
                  placeholder="Décrivez les faits, les dommages constatés et les parties impliquées."
                  onChange={(event) => setCirconstances(event.target.value)} /></Field>
              </div>
            </div>
          </Section>

          <Section title="Garanties impliquées" description="Sélectionnez uniquement les garanties concernées par l’événement." icon={ShieldCheck}>
            <GuaranteeTable guarantees={guarantees} selectedIds={guaranteeIds} onToggle={(id, checked) =>
              setGuaranteeIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id))} />
          </Section>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={create.isPending} onClick={() => submit(false)}>
              {create.isPending && create.variables === false ? <LoaderCircle className="size-4 animate-spin" /> : null} Enregistrer en brouillon
            </Button>
            <Button disabled={create.isPending} onClick={() => submit(true)}>
              {create.isPending && create.variables === true ? <LoaderCircle className="size-4 animate-spin" /> : null} Créer et déclarer
            </Button>
          </div>
        </>
      ) : null}
      <SinistreDeclarationContextDialog
        open={contextOpen}
        onOpenChange={setContextOpen}
        initialContract={initialContract}
        initialDateSinistre={dateSinistre}
        initialNature={nature ?? undefined}
        initialVehicleId={selectedVehicle?.id}
      />
    </div>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-card px-4 py-3"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-1 truncate font-semibold" title={value}>{value}</p></div>;
}

function Section({ title, description, icon: Icon, children }: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return <section className="overflow-hidden rounded-md border bg-card">
    <div className="flex items-center gap-3 border-b bg-muted/25 px-5 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-background"><Icon className="size-4 text-sky-700 dark:text-sky-400" /></span>
      <div className="min-w-0"><h2 className="text-base font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
    </div>
    <div className="p-5">{children}</div>
  </section>;
}

function GuaranteeTable({ guarantees, selectedIds, onToggle }: {
  guarantees: CoverageGuarantee[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  return <div className="overflow-hidden rounded-md border"><Table>
    <TableHeader className="bg-sky-700 [&_th]:text-white"><TableRow className="hover:bg-sky-700">
      <TableHead className="w-12"><span className="sr-only">Sélection</span></TableHead><TableHead>Garantie</TableHead>
      <TableHead className="text-right">Valeur assurée</TableHead><TableHead className="text-right">Taux de franchise</TableHead><TableHead className="text-right">Franchise minimale</TableHead>
    </TableRow></TableHeader>
    <TableBody>
      {GUARANTEE_GROUPS.map((group) => {
        const items = guarantees.filter((guarantee) => guarantee.typeGarantie === group.type);
        if (items.length === 0) return null;
        return <Fragment key={group.type}>
          <TableRow className="bg-muted/40 hover:bg-muted/40"><TableCell colSpan={5} className="font-semibold">{group.label}</TableCell></TableRow>
          {items.map((guarantee) => {
            const checked = selectedIds.includes(guarantee.id);
            return <TableRow key={`${guarantee.mouvementGarantieId}-${guarantee.id}`} data-state={checked ? "selected" : undefined}>
              <TableCell><Checkbox checked={checked} aria-label={`Sélectionner la garantie ${guarantee.libelle}`} onCheckedChange={(value) => onToggle(guarantee.id, value === true)} /></TableCell>
              <TableCell className="whitespace-normal font-medium">{guarantee.code} · {guarantee.libelle}</TableCell>
              <TableCell className="text-right tabular-nums">{formatDecimal(guarantee.capital)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatRate(guarantee.tauxFranchise)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatDecimal(guarantee.franchiseMinimale)}</TableCell>
            </TableRow>;
          })}
        </Fragment>;
      })}
      {guarantees.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Aucune garantie applicable à la date du sinistre.</TableCell></TableRow> : null}
    </TableBody>
  </Table></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}

const decimalFormatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function formatDecimal(value?: number | null) {
  return value == null ? "-" : decimalFormatter.format(value).replace(/[\u00a0\u202f]/g, " ");
}
function formatRate(value?: number | null) {
  return value == null ? "-" : `${formatDecimal(value)} %`;
}
function todayIso() { return toIso(new Date()); }
function toIso(date?: Date) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function formatIsoDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
