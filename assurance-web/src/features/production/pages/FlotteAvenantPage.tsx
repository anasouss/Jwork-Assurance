import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calculator, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { productionApi } from "../api";
import { QuittancePreviewCard } from "../components/QuittancePreviewCard";
import { toDateOnly } from "../date";
import type { FlotteAvenantRequest, GarantieInput, ReferenceOption, VehiculeInput } from "../types";

type Target = {
  kind: "vehicule" | "remorque";
  id: string;
  label: string;
  sublabel?: string | null;
  immatriculation?: string | null;
  usage?: string | null;
};

type PrecisionDraft = {
  immatriculation?: string;
  immatriculationProvisoire?: string;
  numeroAttestation?: string;
};

const MOVEMENT_LABELS: Record<string, string> = {
  INC_F: "Incorporation",
  RET_F: "Retrait",
  RES_F: "Résiliation",
  PRI_F: "Précision immatriculation",
  DUP_F: "Duplicata",
};

const DEFAULT_VEHICLE: VehiculeInput = {
  typeVehicule: "AUTOMOBILE",
  carburant: "Diesel",
  puissanceFiscale: "",
  nombrePlaces: "",
  immatriculation: "",
  datePremiereCirculation: "",
  valeurVenale: undefined,
  valeurNeuf: undefined,
  valeurGlace: undefined,
};

export default function FlotteAvenantPage() {
  const { contratId = "", code = "INC_F" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const movementCode = code.toUpperCase();
  const [dateEffet, setDateEffet] = useState<string>();
  const [dateEcheance, setDateEcheance] = useState<string>();
  const [numeroMouvement, setNumeroMouvement] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [precisionDrafts, setPrecisionDrafts] = useState<Record<string, PrecisionDraft>>({});
  const [vehicle, setVehicle] = useState<VehiculeInput>(DEFAULT_VEHICLE);
  const [selectedGaranties, setSelectedGaranties] = useState<string[]>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof productionApi.previewFlotteAvenant>> | null>(null);

  const contextQuery = useQuery({
    queryKey: ["flotte-avenant-context", contratId],
    queryFn: () => productionApi.getFlotteAvenantContext(contratId),
    enabled: Boolean(contratId),
  });
  const usages = useQuery({ queryKey: ["referentiel", "usages", "avenant-flotte"], queryFn: () => productionApi.referentiel("usages") });
  const marques = useQuery({ queryKey: ["referentiel", "marques", "avenant-flotte"], queryFn: () => productionApi.referentiel("marques") });
  const carrosseries = useQuery({ queryKey: ["referentiel", "carrosseries", "avenant-flotte"], queryFn: () => productionApi.referentiel("carrosseries") });
  const garanties = useQuery({ queryKey: ["referentiel", "garanties", "avenant-flotte"], queryFn: productionApi.garantiesParametrage });

  const contrat = contextQuery.data?.contrat;
  const availableMovements = useMemo(
    () => (contextQuery.data?.mouvementsDisponibles ?? []).filter((item) => item.code?.toUpperCase().endsWith("_F")),
    [contextQuery.data?.mouvementsDisponibles]
  );
  const targets = useMemo<Target[]>(() => [
    ...(contrat?.vehicules ?? []).map((item, index) => ({
      kind: "vehicule" as const,
      id: String(item.vehiculeId),
      label: item.immatriculation || `Véhicule ${index + 1}`,
      sublabel: [item.marque, item.carrosserie].filter(Boolean).join(" - "),
      immatriculation: item.immatriculation,
      usage: item.usageLibelle ?? item.usageCode,
    })),
    ...(contrat?.remorques ?? []).map((item, index) => ({
      kind: "remorque" as const,
      id: String(item.remorqueId),
      label: item.immatriculation || `Remorque ${index + 1}`,
      sublabel: item.marque,
      immatriculation: item.immatriculation,
      usage: item.usageLibelle ?? item.usageCode,
    })),
  ], [contrat?.remorques, contrat?.vehicules]);

  useEffect(() => {
    if (!contrat) return;
    setDateEffet((current) => current ?? contrat.dateEffet ?? undefined);
    setDateEcheance((current) => current ?? contrat.dateEcheance ?? undefined);
    setVehicle((current) => ({
      ...current,
      usageId: current.usageId ?? contrat.vehicules?.[0]?.usageId ?? undefined,
      crm: current.crm ?? contrat.crmPartageValeur ?? contrat.vehicules?.[0]?.crm ?? undefined,
      dateEffet: current.dateEffet ?? contrat.dateEffet ?? undefined,
      dateEcheance: current.dateEcheance ?? contrat.dateEcheance ?? undefined,
    }));
  }, [contrat]);

  useEffect(() => {
    const rcIds = (garanties.data ?? []).filter((garantie) => Boolean(garantie.responsabiliteCivile)).map((garantie) => garantie.id);
    if (rcIds.length) {
      setSelectedGaranties((current) => Array.from(new Set([...rcIds, ...current])));
    }
  }, [garanties.data]);

  const previewMutation = useMutation({
    mutationFn: (request: FlotteAvenantRequest) => productionApi.previewFlotteAvenant(contratId, request),
    onSuccess: setPreview,
    onError: (error) => toast.error(errorMessage(error)),
  });
  const saveMutation = useMutation({
    mutationFn: (request: FlotteAvenantRequest) => productionApi.createFlotteAvenant(contratId, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contrats"] });
      await queryClient.invalidateQueries({ queryKey: ["flotte-avenant-context", contratId] });
      toast.success("Avenant flotte enregistré");
      navigate("/app/production/contrats");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const buildRequest = (): FlotteAvenantRequest | null => {
    if (!dateEffet) {
      toast.error("La date d'effet est obligatoire");
      return null;
    }
    const request: FlotteAvenantRequest = {
      codeTypeMouvement: movementCode,
      numeroMouvement: numeroMouvement.trim() || undefined,
      dateEffet,
      dateEcheance: dateEcheance || contrat?.dateEcheance || undefined,
      notes: notes.trim() || undefined,
    };
    if (movementCode === "INC_F") {
      const vehicule = normalizeVehicle(vehicle, dateEffet, request.dateEcheance);
      if (!vehicule.usageId || !vehicule.marqueId || !vehicule.immatriculation || !vehicule.puissanceFiscale) {
        toast.error("Usage, marque, immatriculation et puissance fiscale sont obligatoires");
        return null;
      }
      const garantieInputs = selectedGaranties.map((garantieId) => garantieInput(garantieId, garanties.data ?? []));
      if (garantieInputs.length === 0) {
        toast.error("Sélectionnez au moins une garantie");
        return null;
      }
      request.vehicules = [vehicule];
      request.garanties = garantieInputs;
    }
    if (movementCode === "RET_F") {
      const selected = splitTargets(targets, selectedTargetIds);
      if (!selected.vehiculeIds.length && !selected.remorqueIds.length) {
        toast.error("Sélectionnez au moins une cible à retirer");
        return null;
      }
      request.vehiculeIds = selected.vehiculeIds;
      request.remorqueIds = selected.remorqueIds;
    }
    if (movementCode === "PRI_F") {
      const selected = splitTargets(targets, selectedTargetIds);
      const precisions: NonNullable<FlotteAvenantRequest["precisions"]> = [];
      selectedTargetIds.forEach((targetId) => {
        const target = targets.find((item) => targetKey(item) === targetId);
        if (!target) return;
        const draft = precisionDrafts[targetId] ?? {};
        precisions.push(target.kind === "vehicule" ? { vehiculeId: target.id, ...draft } : { remorqueId: target.id, ...draft });
      });
      if (!precisions.length) {
        toast.error("Sélectionnez au moins une cible à préciser");
        return null;
      }
      request.vehiculeIds = selected.vehiculeIds;
      request.remorqueIds = selected.remorqueIds;
      request.precisions = precisions;
    }
    if (movementCode === "DUP_F") {
      const selected = splitTargets(targets, selectedTargetIds);
      request.vehiculeIds = selected.vehiculeIds;
      request.remorqueIds = selected.remorqueIds;
    }
    return request;
  };

  const runPreview = () => {
    const request = buildRequest();
    if (request) previewMutation.mutate(request);
  };
  const save = () => {
    const request = buildRequest();
    if (request) saveMutation.mutate(request);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/app/production/contrats"><ArrowLeft className="size-4" />Retour liste</Link>
          </Button>
          <h1 className="mt-1 text-xl font-semibold">Avenant flotte - {MOVEMENT_LABELS[movementCode] ?? movementCode}</h1>
          <p className="text-sm text-muted-foreground">{contrat?.numeroDossier ?? contrat?.numeroContrat ?? contratId}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={runPreview} disabled={previewMutation.isPending || contextQuery.isLoading}>
            <Calculator className="size-4" />Prévisualiser quittance
          </Button>
          <Button type="button" onClick={save} disabled={saveMutation.isPending || contextQuery.isLoading}>
            <Save className="size-4" />Enregistrer
          </Button>
        </div>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader>
          <CardTitle>Paramètres de l'avenant</CardTitle>
          <CardDescription>La quittance est calculée sur les cibles de cet avenant, puis sauvegardée avec le mouvement.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Field label="Type">
            <Select value={movementCode} onValueChange={(value) => navigate(`/app/production/contrats/${contratId}/avenants/${value}`)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(availableMovements.length ? availableMovements : Object.entries(MOVEMENT_LABELS).map(([code, libelle]) => ({ code, libelle }))).map((item) => (
                  <SelectItem key={item.code} value={item.code}>{item.libelle ?? MOVEMENT_LABELS[item.code] ?? item.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date d'effet">
            <DatePicker date={dateEffet} onSelect={(date) => setDateEffet(toDateOnly(date))} />
          </Field>
          <Field label="Date d'échéance">
            <DatePicker date={dateEcheance} onSelect={(date) => setDateEcheance(toDateOnly(date))} />
          </Field>
          <Field label="N° mouvement">
            <Input value={numeroMouvement} onChange={(event) => setNumeroMouvement(event.target.value)} />
          </Field>
          <div className="md:col-span-4">
            <Field label="Notes">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {movementCode === "INC_F" ? (
        <IncorporationSection
          vehicle={vehicle}
          setVehicle={setVehicle}
          usages={usages.data ?? []}
          marques={marques.data ?? []}
          carrosseries={carrosseries.data ?? []}
          garanties={garanties.data ?? []}
          selectedGaranties={selectedGaranties}
          setSelectedGaranties={setSelectedGaranties}
        />
      ) : movementCode !== "RES_F" ? (
        <TargetsSection
          movementCode={movementCode}
          targets={targets}
          selectedTargetIds={selectedTargetIds}
          setSelectedTargetIds={setSelectedTargetIds}
          precisionDrafts={precisionDrafts}
          setPrecisionDrafts={setPrecisionDrafts}
        />
      ) : (
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle>Cibles concernées</CardTitle>
            <CardDescription>La résiliation portera sur toutes les cibles actives du contrat.</CardDescription>
          </CardHeader>
          <CardContent><Badge variant="secondary">{targets.length} cible(s) active(s)</Badge></CardContent>
        </Card>
      )}

      <Card className="border-border/70 shadow-none">
        <CardHeader><CardTitle>Quittance</CardTitle></CardHeader>
        <CardContent>
          <QuittancePreviewCard preview={preview} loading={previewMutation.isPending} />
        </CardContent>
      </Card>
    </div>
  );
}

function IncorporationSection({
  vehicle,
  setVehicle,
  usages,
  marques,
  carrosseries,
  garanties,
  selectedGaranties,
  setSelectedGaranties,
}: {
  vehicle: VehiculeInput;
  setVehicle: (value: VehiculeInput | ((current: VehiculeInput) => VehiculeInput)) => void;
  usages: ReferenceOption[];
  marques: ReferenceOption[];
  carrosseries: ReferenceOption[];
  garanties: ReferenceOption[];
  selectedGaranties: string[];
  setSelectedGaranties: (value: string[] | ((current: string[]) => string[])) => void;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader><CardTitle>Véhicule à incorporer</CardTitle></CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Usage">
            <Select value={vehicle.usageId ?? ""} onValueChange={(value) => setVehicle((current) => ({ ...current, usageId: value }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{usages.map((item) => <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} - ` : ""}{item.libelle}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Marque">
            <Select value={vehicle.marqueId ?? ""} onValueChange={(value) => setVehicle((current) => ({ ...current, marqueId: value }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{marques.map((item) => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Carrosserie">
            <Select value={vehicle.carrosserieId ?? ""} onValueChange={(value) => setVehicle((current) => ({ ...current, carrosserieId: value }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{carrosseries.map((item) => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Immatriculation">
            <Input value={vehicle.immatriculation ?? ""} onChange={(event) => setVehicle((current) => ({ ...current, immatriculation: event.target.value }))} />
          </Field>
          <Field label="Puissance fiscale">
            <Input value={vehicle.puissanceFiscale ?? ""} onChange={(event) => setVehicle((current) => ({ ...current, puissanceFiscale: event.target.value }))} />
          </Field>
          <Field label="Énergie">
            <Input value={vehicle.carburant ?? ""} onChange={(event) => setVehicle((current) => ({ ...current, carburant: event.target.value }))} />
          </Field>
          <Field label="1ère circulation">
            <DatePicker date={vehicle.datePremiereCirculation} onSelect={(date) => setVehicle((current) => ({ ...current, datePremiereCirculation: toDateOnly(date) }))} />
          </Field>
          <Field label="Nombre places">
            <Input value={vehicle.nombrePlaces ?? ""} onChange={(event) => setVehicle((current) => ({ ...current, nombrePlaces: event.target.value }))} />
          </Field>
          <Field label="Valeur vénale">
            <Input type="number" value={vehicle.valeurVenale ?? ""} onChange={(event) => setVehicle((current) => ({ ...current, valeurVenale: numberOrUndefined(event.target.value) }))} />
          </Field>
          <Field label="Valeur à neuf">
            <Input type="number" value={vehicle.valeurNeuf ?? ""} onChange={(event) => setVehicle((current) => ({ ...current, valeurNeuf: numberOrUndefined(event.target.value) }))} />
          </Field>
          <Field label="Valeur glace">
            <Input type="number" value={vehicle.valeurGlace ?? ""} onChange={(event) => setVehicle((current) => ({ ...current, valeurGlace: numberOrUndefined(event.target.value) }))} />
          </Field>
          <Field label="CRM">
            <Input value={vehicle.crm ?? ""} onChange={(event) => setVehicle((current) => ({ ...current, crm: event.target.value }))} />
          </Field>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr><th className="w-12 px-3 py-3" /><th className="px-3 py-3 text-left">Garantie</th><th className="px-3 py-3 text-left">Type</th><th className="px-3 py-3 text-left">Mode</th></tr>
            </thead>
            <tbody>
              {garanties.map((garantie) => {
                const checked = selectedGaranties.includes(garantie.id);
                const isRc = Boolean(garantie.responsabiliteCivile);
                return (
                  <tr key={garantie.id} className={cn("border-t", checked && "bg-emerald-50/50 dark:bg-emerald-950/20")}>
                    <td className="px-3 py-2"><Checkbox checked={checked} disabled={isRc} onCheckedChange={(value) => toggleId(garantie.id, Boolean(value), setSelectedGaranties)} /></td>
                    <td className="px-3 py-2 font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</td>
                    <td className="px-3 py-2">{String(garantie.typeGarantie ?? "VEHICULE")}</td>
                    <td className="px-3 py-2">{String(garantie.modeParDefaut ?? "TAUX")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TargetsSection({
  movementCode,
  targets,
  selectedTargetIds,
  setSelectedTargetIds,
  precisionDrafts,
  setPrecisionDrafts,
}: {
  movementCode: string;
  targets: Target[];
  selectedTargetIds: string[];
  setSelectedTargetIds: (value: string[] | ((current: string[]) => string[])) => void;
  precisionDrafts: Record<string, PrecisionDraft>;
  setPrecisionDrafts: (value: Record<string, PrecisionDraft> | ((current: Record<string, PrecisionDraft>) => Record<string, PrecisionDraft>)) => void;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle>Cibles concernées</CardTitle>
        <CardDescription>{movementCode === "DUP_F" ? "Sans sélection, le duplicata concerne toutes les cibles actives." : "Sélectionnez les véhicules ou remorques concernés."}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-3" />
              <th className="px-3 py-3 text-left">Cible</th>
              <th className="px-3 py-3 text-left">Usage</th>
              {movementCode === "PRI_F" ? <th className="px-3 py-3 text-left">Nouvelle immatriculation / attestation</th> : null}
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => {
              const key = targetKey(target);
              const checked = selectedTargetIds.includes(key);
              return (
                <tr key={key} className={cn("border-t", checked && "bg-emerald-50/50 dark:bg-emerald-950/20")}>
                  <td className="px-3 py-2"><Checkbox checked={checked} onCheckedChange={(value) => toggleId(key, Boolean(value), setSelectedTargetIds)} /></td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{target.label}</div>
                    <div className="text-xs text-muted-foreground">{target.sublabel || target.kind}</div>
                  </td>
                  <td className="px-3 py-2">{target.usage ?? "-"}</td>
                  {movementCode === "PRI_F" ? (
                    <td className="px-3 py-2">
                      <div className="grid gap-2 md:grid-cols-3">
                        <Input disabled={!checked} placeholder="Immatriculation" value={precisionDrafts[key]?.immatriculation ?? ""} onChange={(event) => updatePrecision(key, { immatriculation: event.target.value }, setPrecisionDrafts)} />
                        {target.kind === "vehicule" ? <Input disabled={!checked} placeholder="WW" value={precisionDrafts[key]?.immatriculationProvisoire ?? ""} onChange={(event) => updatePrecision(key, { immatriculationProvisoire: event.target.value }, setPrecisionDrafts)} /> : null}
                        <Input disabled={!checked} placeholder="Attestation" value={precisionDrafts[key]?.numeroAttestation ?? ""} onChange={(event) => updatePrecision(key, { numeroAttestation: event.target.value }, setPrecisionDrafts)} />
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-700 dark:text-neutral-300"><span>{label}</span>{children}</label>;
}

function normalizeVehicle(vehicle: VehiculeInput, dateEffet: string, dateEcheance?: string): VehiculeInput {
  return { ...vehicle, typeVehicule: vehicle.typeVehicule ?? "AUTOMOBILE", dateEffet, dateEcheance };
}

function garantieInput(garantieId: string, garanties: ReferenceOption[]): GarantieInput {
  const garantie = garanties.find((item) => item.id === garantieId);
  return {
    garantieId,
    vehiculeIndex: 0,
    modeSelectionne: String(garantie?.modeParDefaut ?? (garantie?.typeGarantie === "PERSONNE" ? "PROTECTION" : "TAUX")),
    sourceValeurSelectionnee: defaultSource(garantie),
  };
}

function defaultSource(garantie?: ReferenceOption) {
  if (garantie?.sourceValeurParDefaut) return String(garantie.sourceValeurParDefaut);
  if (garantie?.requiertValeurVenale) return "VENALE";
  if (garantie?.requiertValeurNeuf) return "NEUF";
  if (garantie?.requiertValeurGlace) return "GLACE";
  return "AUCUNE";
}

function splitTargets(targets: Target[], selectedTargetIds: string[]) {
  const selected = targets.filter((target) => selectedTargetIds.includes(targetKey(target)));
  return {
    vehiculeIds: selected.filter((target) => target.kind === "vehicule").map((target) => target.id),
    remorqueIds: selected.filter((target) => target.kind === "remorque").map((target) => target.id),
  };
}

function targetKey(target: Target) {
  return `${target.kind}:${target.id}`;
}

function toggleId(id: string, checked: boolean, setter: (value: string[] | ((current: string[]) => string[])) => void) {
  setter((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
}

function updatePrecision(
  key: string,
  patch: PrecisionDraft,
  setter: (value: Record<string, PrecisionDraft> | ((current: Record<string, PrecisionDraft>) => Record<string, PrecisionDraft>)) => void
) {
  setter((current) => ({ ...current, [key]: { ...(current[key] ?? {}), ...patch } }));
}

function numberOrUndefined(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== "" ? parsed : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operation impossible";
}
