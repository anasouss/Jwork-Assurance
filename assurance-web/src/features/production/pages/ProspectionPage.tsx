import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FilePlus2, LifeBuoy, MoreHorizontal, Pencil, Search, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { productionApi } from "../api";
import { Field } from "../components/Field";
import { toDateOnly } from "../date";
import type { AssistanceContrat, ContratSummary, ReferenceOption } from "../types";

type Filters = {
  compagnieId: "ALL" | string;
  du?: string;
  au?: string;
  codeClient: string;
  numeroDevis: string;
};

type DevisScope = "all" | "vehicles" | "usages";

const DEFAULT_FILTERS: Filters = {
  compagnieId: "ALL",
  codeClient: "",
  numeroDevis: "",
};

export default function ProspectionPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [pdfTarget, setPdfTarget] = useState<ContratSummary | null>(null);
  const [pdfScope, setPdfScope] = useState<DevisScope>("all");
  const [selectedVehicules, setSelectedVehicules] = useState<string[]>([]);
  const [selectedUsages, setSelectedUsages] = useState<string[]>([]);
  const [convertTarget, setConvertTarget] = useState<ContratSummary | null>(null);
  const [numeroPolice, setNumeroPolice] = useState("");
  const [attestations, setAttestations] = useState<Record<string, string>>({});
  const [assistanceRefs, setAssistanceRefs] = useState<Record<string, string>>({});

  const prospections = useQuery({ queryKey: ["prospections"], queryFn: productionApi.listProspections });
  const companies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance", "prospections"],
    queryFn: () => productionApi.referentiel("compagnies-assurance"),
  });
  const assistanceContext = useQuery({
    queryKey: ["prospection-assistances", convertTarget?.id],
    queryFn: () => productionApi.getAssistanceContext(convertTarget!.id),
    enabled: Boolean(convertTarget),
  });

  const companyMap = useMemo(() => optionMap(companies.data), [companies.data]);
  const rows = useMemo(
    () => (prospections.data ?? []).filter((contrat) => matchesFilters(contrat, appliedFilters, companyMap)),
    [appliedFilters, companyMap, prospections.data]
  );
  const usageOptions = useMemo(() => uniqueUsages(pdfTarget), [pdfTarget]);

  const convertMutation = useMutation({
    mutationFn: () => {
      if (!convertTarget) {
        throw new Error("Aucun devis sélectionné");
      }
      return productionApi.convertProspection(convertTarget.id, {
        numeroPolice,
        vehicules: (convertTarget.vehicules ?? []).map((vehicule) => ({
          vehiculeId: vehicule.vehiculeId,
          numeroAttestation: attestations[`vehicule-${vehicule.vehiculeId}`],
        })),
        remorques: (convertTarget.remorques ?? []).map((remorque) => ({
          remorqueId: remorque.remorqueId,
          numeroAttestation: attestations[`remorque-${remorque.remorqueId}`],
        })),
        assistances: (assistanceContext.data?.assistances ?? []).map((assistance) => ({
          assistanceId: assistance.id,
          numeroContratOuQuittance: assistanceRefs[assistance.id],
        })),
      });
    },
    onSuccess: async () => {
      toast.success("Devis converti en contrat");
      setConvertTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["prospections"] });
      await queryClient.invalidateQueries({ queryKey: ["contrats"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Conversion impossible"),
  });

  const openPdfModal = (contrat: ContratSummary) => {
    setPdfTarget(contrat);
    setPdfScope("all");
    setSelectedVehicules([]);
    setSelectedUsages([]);
  };

  const generatePdf = async () => {
    if (!pdfTarget) return;
    if (pdfScope === "vehicles" && selectedVehicules.length === 0) {
      toast.error("Sélectionnez au moins un véhicule");
      return;
    }
    if (pdfScope === "usages" && selectedUsages.length === 0) {
      toast.error("Sélectionnez au moins un usage");
      return;
    }
    const blob = await productionApi.downloadDevisPdf(pdfTarget.id, {
      vehiculeIds: pdfScope === "vehicles" ? selectedVehicules : undefined,
      usageIds: pdfScope === "usages" ? selectedUsages : undefined,
    });
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  };

  const openConvertModal = (contrat: ContratSummary) => {
    setConvertTarget(contrat);
    setNumeroPolice(contrat.numeroPolice ?? "");
    setAttestations(Object.fromEntries([
      ...(contrat.vehicules ?? []).map((vehicule) => [`vehicule-${vehicule.vehiculeId}`, vehicule.numeroAttestation ?? ""] as const),
      ...(contrat.remorques ?? []).map((remorque) => [`remorque-${remorque.remorqueId}`, remorque.numeroAttestation ?? ""] as const),
    ]));
    setAssistanceRefs({});
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">
          <Link to="/app/production" className="text-blue-600 hover:underline">Dashboard</Link>
          <span className="mx-2 text-muted-foreground">›</span>
          <span>Prospection</span>
        </div>
        <Button asChild>
          <Link to="/app/production/prospection/ajouter-devis">
            <FilePlus2 className="size-4" />
            Ajouter devis
          </Link>
        </Button>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
            <Field label="Compagnie">
              <Select value={filters.compagnieId} onValueChange={(value) => setFilters((current) => ({ ...current, compagnieId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les compagnies</SelectItem>
                  {(companies.data ?? []).map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Du">
              <DatePicker date={filters.du} onSelect={(date) => setFilters((current) => ({ ...current, du: toDateOnly(date) }))} />
            </Field>
            <Field label="Au">
              <DatePicker date={filters.au} onSelect={(date) => setFilters((current) => ({ ...current, au: toDateOnly(date) }))} />
            </Field>
            <Field label="Code ou client">
              <Input value={filters.codeClient} onChange={(event) => setFilters((current) => ({ ...current, codeClient: event.target.value }))} />
            </Field>
            <Field label="N° devis">
              <Input value={filters.numeroDevis} onChange={(event) => setFilters((current) => ({ ...current, numeroDevis: event.target.value }))} />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="button" className="h-9 px-4" onClick={() => setAppliedFilters(filters)}>
                <Search className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setAppliedFilters(DEFAULT_FILTERS);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead className="bg-emerald-600 text-xs uppercase leading-tight text-white dark:bg-emerald-700">
                <tr>
                  <HeaderCell>N° dossier</HeaderCell>
                  <HeaderCell>Type</HeaderCell>
                  <HeaderCell>Code client</HeaderCell>
                  <HeaderCell>Assuré</HeaderCell>
                  <HeaderCell>N° devis</HeaderCell>
                  <HeaderCell>Compagnie</HeaderCell>
                  <HeaderCell>Date création</HeaderCell>
                  <HeaderCell>Statut</HeaderCell>
                  <HeaderCell>Actions</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {prospections.isLoading ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Chargement des devis...</td></tr>
                ) : rows.length ? (
                  rows.map((contrat) => (
                    <ProspectionRow
                      key={contrat.id}
                      contrat={contrat}
                      companyLabel={companyLabel(contrat, companyMap)}
                      onDownload={() => openPdfModal(contrat)}
                      onConvert={() => openConvertModal(contrat)}
                    />
                  ))
                ) : (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Aucun devis ne correspond aux filtres.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(pdfTarget)} onOpenChange={(open) => !open && setPdfTarget(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Télécharger devis flotte</DialogTitle>
          </DialogHeader>
          <RadioGroup value={pdfScope} onValueChange={(value) => setPdfScope(value as DevisScope)}>
            <RadioOption value="all" label="Tous les véhicules" />
            <RadioOption value="vehicles" label="Véhicules spécifiques" />
            {pdfScope === "vehicles" ? (
              <Checklist
                emptyText="Aucun véhicule."
                items={(pdfTarget?.vehicules ?? []).map((vehicule) => ({
                  id: vehicule.vehiculeId,
                  label: vehicleLabel(vehicule),
                }))}
                values={selectedVehicules}
                onChange={setSelectedVehicules}
              />
            ) : null}
            <RadioOption value="usages" label="Usages spécifiques" />
            {pdfScope === "usages" ? (
              <Checklist emptyText="Aucun usage." items={usageOptions} values={selectedUsages} onChange={setSelectedUsages} />
            ) : null}
          </RadioGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPdfTarget(null)}>Annuler</Button>
            <Button type="button" onClick={generatePdf}>
              Générer le PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(convertTarget)} onOpenChange={(open) => !open && setConvertTarget(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Convertir en contrat</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="N° devis">
                <Input value={convertTarget?.numeroDevis ?? convertTarget?.numeroPolice ?? ""} readOnly />
              </Field>
              <Field label="N° police" required>
                <Input value={numeroPolice} onChange={(event) => setNumeroPolice(event.target.value)} />
              </Field>
            </div>
            {(assistanceContext.data?.assistances ?? []).length ? (
              <div className="grid gap-2">
                <div className="text-sm font-semibold uppercase text-blue-700">Contrats assistance</div>
                {(assistanceContext.data?.assistances ?? []).map((assistance) => (
                  <Field key={assistance.id} label={assistanceLabel(assistance)} required>
                    <Input
                      value={assistanceRefs[assistance.id] ?? assistance.numeroContratOuQuittance ?? ""}
                      onChange={(event) => setAssistanceRefs((current) => ({ ...current, [assistance.id]: event.target.value }))}
                      placeholder="N contrat assistance"
                    />
                  </Field>
                ))}
              </div>
            ) : null}
            <div className="grid gap-2">
              <div className="text-sm font-semibold uppercase text-blue-700">Numéros d'attestation par véhicule</div>
              <AttestationInputs contrat={convertTarget} values={attestations} onChange={setAttestations} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConvertTarget(null)}>Annuler</Button>
            <Button type="button" onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
              {convertMutation.isPending ? "Conversion..." : "Convertir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProspectionRow({
  contrat,
  companyLabel,
  onDownload,
  onConvert,
}: {
  contrat: ContratSummary;
  companyLabel: string;
  onDownload: () => void;
  onConvert: () => void;
}) {
  return (
    <tr className="border-b transition-colors hover:bg-emerald-50/40">
      <Cell className="text-center">{dossierNumber(contrat)}</Cell>
      <Cell className="text-center"><TypeBadge /></Cell>
      <Cell className="text-center uppercase">{clientCode(contrat)}</Cell>
      <Cell className="uppercase">{mainClient(contrat)}</Cell>
      <Cell className="text-center uppercase">{contrat.numeroDevis ?? contrat.numeroPolice ?? "-"}</Cell>
      <Cell className="text-center">{companyLabel}</Cell>
      <Cell className="text-center">{formatDate(contrat.createdAt ?? contrat.dateEffet)}</Cell>
      <Cell className="text-center"><StatusBadge contrat={contrat} /></Cell>
      <Cell className="text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" className="h-8 w-8 bg-sky-600 hover:bg-sky-700">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDownload}>
              <Download className="size-4" />
              Télécharger devis
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/app/production/contrats/${contrat.id}/assistance`}>
                <LifeBuoy className="size-4" />
                Ajout Assistance
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/app/production/prospection/devis/flotte/${contrat.id}`}>
                <Pencil className="size-4" />
                Modifier
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onConvert}>
              <ShieldCheck className="size-4" />
              Convertir en contrat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Cell>
    </tr>
  );
}

function AttestationInputs({
  contrat,
  values,
  onChange,
}: {
  contrat: ContratSummary | null;
  values: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  const rows = [
    ...(contrat?.vehicules ?? []).map((vehicule) => ({
      key: `vehicule-${vehicule.vehiculeId}`,
      usage: vehicule.usageCode ?? vehicule.usageLibelle ?? "Sans usage",
      label: vehicleLabel(vehicule),
      required: Boolean(vehicule.consommeAttestation),
    })),
    ...(contrat?.remorques ?? []).map((remorque) => ({
      key: `remorque-${remorque.remorqueId}`,
      usage: remorque.usageCode ?? remorque.usageLibelle ?? "Remorques",
      label: remorqueLabel(remorque),
      required: Boolean(remorque.consommeAttestation),
    })),
  ];
  if (!rows.length) {
    return <div className="rounded-md border px-3 py-4 text-sm text-muted-foreground">Aucun véhicule.</div>;
  }
  const grouped = rows.reduce<Map<string, typeof rows>>((map, row) => {
    map.set(row.usage, [...(map.get(row.usage) ?? []), row]);
    return map;
  }, new Map());
  return (
    <div className="grid max-h-[340px] gap-4 overflow-y-auto rounded-md border p-3">
      {[...grouped.entries()].map(([usage, usageRows]) => (
        <Fragment key={usage}>
          <div className="text-xs font-bold uppercase text-slate-700">{usage}</div>
          <div className="grid gap-3">
            {usageRows.map((row) => (
              <Field key={row.key} label={row.label} required={row.required}>
                <Input
                  value={values[row.key] ?? ""}
                  onChange={(event) => onChange({ ...values, [row.key]: event.target.value })}
                  placeholder="Numéro d'attestation"
                />
              </Field>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function Checklist({
  items,
  values,
  onChange,
  emptyText,
}: {
  items: { id: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  emptyText: string;
}) {
  if (!items.length) {
    return <div className="ml-7 rounded-md border px-3 py-4 text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <div className="ml-7 grid max-h-64 gap-2 overflow-y-auto rounded-md border bg-background p-3">
      {items.map((item) => {
        const checked = values.includes(item.id);
        return (
          <label key={item.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) =>
                onChange(value ? [...values, item.id] : values.filter((selected) => selected !== item.id))
              }
            />
            <span>{item.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function RadioOption({ value, label }: { value: DevisScope; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <RadioGroupItem value={value} />
      <span>{label}</span>
    </label>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return <th className="px-3 py-3 text-center font-bold">{children}</th>;
}

function Cell({ className, children }: { className?: string; children?: ReactNode }) {
  return <td className={cn("px-3 py-2 align-middle", className)}>{children}</td>;
}

function TypeBadge() {
  return <Badge className="min-w-5 justify-center rounded bg-emerald-600 px-1.5 py-0.5 text-white hover:bg-emerald-600">F</Badge>;
}

function StatusBadge({ contrat }: { contrat: ContratSummary }) {
  const expired = Boolean(contrat.dateEcheance && contrat.dateEcheance < new Date().toISOString().slice(0, 10));
  return (
    <Badge className={cn("rounded px-2 py-0.5 text-[11px] text-white", expired ? "bg-amber-500 hover:bg-amber-500" : "bg-green-600 hover:bg-green-600")}>
      {expired ? "Expiré" : "En cours"}
    </Badge>
  );
}

function matchesFilters(contrat: ContratSummary, filters: Filters, companyMap: Map<string, ReferenceOption>) {
  if (contrat.typeContrat !== "FLOTTE") return false;
  if (filters.compagnieId !== "ALL" && String(contrat.compagnieAssuranceId ?? "") !== filters.compagnieId) return false;
  if (filters.numeroDevis.trim() && !includesNormalized(contrat.numeroDevis ?? contrat.numeroPolice, filters.numeroDevis)) return false;
  if (filters.du && (!contrat.createdAt || contrat.createdAt < filters.du)) return false;
  if (filters.au && (!contrat.createdAt || contrat.createdAt > filters.au)) return false;
  if (filters.codeClient.trim()) {
    const haystack = [clientCode(contrat), mainClient(contrat), companyLabel(contrat, companyMap)].join(" ");
    if (!includesNormalized(haystack, filters.codeClient)) return false;
  }
  return true;
}

function optionMap(options?: ReferenceOption[]) {
  return new Map((options ?? []).map((option) => [String(option.id), option]));
}

function dossierNumber(contrat: ContratSummary) {
  return contrat.numeroDossier ?? contrat.numeroDevis ?? contrat.numeroPolice ?? `#${contrat.id}`;
}

function clientCode(contrat: ContratSummary) {
  const client = contrat.clients?.find((item) => item.role === "SOUSCRIPTEUR") ?? contrat.clients?.[0];
  return client?.client?.codeClient
    ?? client?.client?.rc
    ?? client?.client?.cin
    ?? client?.nomAffichage
    ?? "-";
}

function mainClient(contrat: ContratSummary) {
  return contrat.clients?.find((client) => client.role === "SOUSCRIPTEUR")?.nomAffichage
    ?? contrat.clients?.[0]?.nomAffichage
    ?? "-";
}

function companyLabel(contrat: ContratSummary, companyMap: Map<string, ReferenceOption>) {
  const company = contrat.compagnieAssuranceId ? companyMap.get(String(contrat.compagnieAssuranceId)) : undefined;
  return String(company?.code ?? company?.libelle ?? contrat.compagnieAssuranceId ?? "-");
}

function uniqueUsages(contrat: ContratSummary | null) {
  const map = new Map<string, string>();
  for (const vehicule of contrat?.vehicules ?? []) {
    if (vehicule.usageId) {
      map.set(vehicule.usageId, vehicule.usageCode ?? vehicule.usageLibelle ?? "Sans usage");
    }
  }
  return [...map.entries()].map(([id, label]) => ({ id, label }));
}

function vehicleLabel(vehicule: NonNullable<ContratSummary["vehicules"]>[number]) {
  const parts = [vehicule.marque, vehicule.immatriculation].filter(Boolean);
  const base = parts.length ? parts.join(" - ") : `Véhicule #${vehicule.vehiculeId}`;
  return vehicule.usageCode || vehicule.usageLibelle ? `${base} (${vehicule.usageCode ?? vehicule.usageLibelle})` : base;
}

function remorqueLabel(remorque: NonNullable<ContratSummary["remorques"]>[number]) {
  const parts = [remorque.marque, remorque.immatriculation].filter(Boolean);
  return parts.length ? parts.join(" - ") : `Remorque #${remorque.remorqueId}`;
}

function assistanceLabel(assistance: AssistanceContrat) {
  const parts = [assistance.produit, assistance.vehiculeImmatriculation].filter(Boolean);
  return parts.length ? parts.join(" - ") : `Assistance #${assistance.id}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function includesNormalized(value: unknown, search: string) {
  return normalize(value).includes(normalize(search));
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
}
