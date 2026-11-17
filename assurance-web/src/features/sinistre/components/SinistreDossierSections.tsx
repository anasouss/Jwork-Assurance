import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { sinistreApi, sinistreKeys } from "../api";
import { formatDate, formatMoney } from "../format";
import { damageLabels, repairLabels } from "../workflow";
import { SinistreAssistanceTable } from "./SinistreAssistanceTable";
import type { DecisionCouverture, ModeReparationSinistre, SinistreDetail } from "../types";

function generalForm(dossier: SinistreDetail) {
  return {
    referenceCompagnie: dossier.referenceCompagnie || "",
    responsabilite: dossier.tauxResponsabilite == null ? "NON_DETERMINEE" : String(dossier.tauxResponsabilite),
    notes: dossier.notes || "",
    gestionnaireId: dossier.gestionnaireId || "",
    prochaineAction: dossier.prochaineAction || "",
    dateEcheanceAction: dossier.dateEcheanceAction || "",
    typeDommage: dossier.typeDommage || "",
    modeReparation: dossier.modeReparation || "",
    garageId: dossier.garageId || "",
  };
}

export function GeneralSection({
  dossier,
  managers,
  responsibilityVisible,
  editable,
  saving,
  onSave,
  editMode = false,
  onCancel,
}: {
  dossier: SinistreDetail;
  managers: Array<{ id: string; nom: string }>;
  responsibilityVisible: boolean;
  editable: boolean;
  saving: boolean;
  onSave?: (request: object) => Promise<unknown>;
  editMode?: boolean;
  onCancel?: () => void;
}) {
  const [editing, setEditing] = useState(editMode && editable);
  const [form, setForm] = useState(() => generalForm(dossier));
  const [trackingOpen, setTrackingOpen] = useState(
    Boolean(
      dossier.prochaineAction || dossier.dateEcheanceAction || dossier.notes,
    ),
  );
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const garageContext = { sinistreId: dossier.id, modeReparation: (form.modeReparation || undefined) as ModeReparationSinistre | undefined,
    garantieIds: dossier.garanties.filter(g => g.impliquee).map(g => g.garantieId) };
  const garageQuery = useQuery({ queryKey: sinistreKeys.eligible("GARAGE", garageContext), queryFn: () => sinistreApi.eligibleProviders("GARAGE", garageContext), enabled: editing && editable && dossier.couverture.brancheCode === "AUTOMOBILE" });
  const garages = garageQuery.data ?? [];
  const historicalGarage = form.garageId === dossier.garageId && form.modeReparation === dossier.modeReparation;
  const garageChanged = form.garageId !== (dossier.garageId || "") || form.modeReparation !== (dossier.modeReparation || "");
  const garageInvalid = !!form.garageId && !historicalGarage && !garages.some(item => item.id === form.garageId);
  return (
      <section className="min-w-0 py-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Informations du sinistre</h2>
          {editable && !editing ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="size-4" />Modifier</Button> : null}
          {editable && editing ? (
            <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={saving} onClick={() => { setForm(generalForm(dossier)); setEditing(false); onCancel?.(); }}>Annuler</Button>
            <Button
              size="sm"
              disabled={saving || garageInvalid || (garageChanged && (garageQuery.isFetching || garageQuery.isError)) || (dossier.statut !== "BROUILLON" && !form.referenceCompagnie.trim()) || (responsibilityVisible && form.responsabilite === "NON_DETERMINEE") || (form.modeReparation === "PEC" && !form.garageId)}
              onClick={() =>
                void onSave?.({
                  referenceCompagnie:
                    form.referenceCompagnie.trim() || undefined,
                  ...(responsibilityVisible
                    ? {
                        tauxResponsabilite:
                          form.responsabilite === "NON_DETERMINEE"
                            ? null
                            : Number(form.responsabilite),
                      }
                    : {}),
                  notes: form.notes.trim() || undefined,
                  gestionnaireId: form.gestionnaireId || dossier.gestionnaireId,
                  prochaineAction: form.prochaineAction.trim() || undefined,
                  dateEcheanceAction: form.dateEcheanceAction || undefined,
                  ...(dossier.couverture.brancheCode === "AUTOMOBILE" ? {
                    typeDommage: form.typeDommage || undefined,
                    modeReparation: form.modeReparation || undefined,
                    garageId: form.garageId || null,
                  } : {}),
                }).then(() => setEditing(false)).catch(() => undefined)
              }
            >
              <Save className="size-4" />
              Enregistrer
            </Button>
            </div>
          ) : null}
        </div>
        {!editing ? <dl className="grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Police" value={dossier.couverture.numeroPolice} />
          <Info label="Dossier" value={dossier.couverture.numeroDossier} />
          <Info label="Compagnie" value={dossier.couverture.compagnie} />
          <Info label="Assuré" value={dossier.couverture.assure} />
          <Info label="Date de déclaration" value={formatDate(dossier.dateDeclaration)} />
          <Info label="Référence compagnie" value={dossier.referenceCompagnie} />
          <Info label="Dommages" value={dossier.typeDommage ? damageLabels[dossier.typeDommage] : undefined} />
          <Info label="Réparation" value={dossier.modeReparation ? repairLabels[dossier.modeReparation] : undefined} />
          <Info label="Garage" value={dossier.garage} />
          <Info
            label="Mouvement"
            value={`${dossier.couverture.numeroMouvement} · ${formatDate(dossier.couverture.dateEffet)}`}
          />
          <Info
            label="Véhicule"
            value={[
              dossier.couverture.immatriculation,
              dossier.couverture.marque,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <Info
            label="Attestation"
            value={dossier.couverture.numeroAttestation}
          />
          {responsibilityVisible ? <Info label="Responsabilité RC" value={dossier.tauxResponsabilite == null ? undefined : `${dossier.tauxResponsabilite} %`} /> : null}
          <Info label="Gestionnaire" value={dossier.gestionnaire} />
          <Info label="Prochaine action" value={dossier.prochaineAction} />
          <Info label="Échéance de l’action" value={formatDate(dossier.dateEcheanceAction)} />
          {dossier.notes ? <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs text-muted-foreground">Notes internes</dt><dd className="mt-1 whitespace-pre-wrap break-words">{dossier.notes}</dd></div> : null}
        </dl> : null}
        {editing && editable ? <fieldset disabled={saving} className="mt-5 min-w-0 border-t pt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dossier.couverture.brancheCode === "AUTOMOBILE" ? <>
            <Field label="Dommages"><Select disabled={!editable || saving} value={form.typeDommage} onValueChange={(value) => update("typeDommage", value)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{Object.entries(damageLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select></Field>
            <Field label="Mode de réparation"><Select disabled={!editable || saving} value={form.modeReparation} onValueChange={(value) => setForm((current) => ({ ...current, modeReparation: value, garageId: "" }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{Object.entries(repairLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select></Field>
            <Field label={form.modeReparation === "PEC" ? "Garage conventionné" : "Garage"} required={form.modeReparation === "PEC"}><Select disabled={!editable || saving || garageQuery.isFetching || garageQuery.isError} value={form.garageId || "NONE"} onValueChange={(value) => update("garageId", value === "NONE" ? "" : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Non désigné</SelectItem>{historicalGarage && dossier.garageId && !garages.some((item) => item.id === dossier.garageId) ? <SelectItem value={dossier.garageId}>{dossier.garage || "Garage actuel"}</SelectItem> : null}{garages.map((item) => <SelectItem key={item.id} value={item.id}>{item.nom}</SelectItem>)}</SelectContent>
            </Select></Field>
            {garageQuery.isError ? <p role="alert" className="text-sm text-destructive">{garageQuery.error.message}</p> : null}
          </> : null}
          <Field label="Référence compagnie" required={dossier.statut !== "BROUILLON"}>
            <Input
              disabled={!editable}
              maxLength={100}
              value={form.referenceCompagnie}
              onChange={(event) =>
                update("referenceCompagnie", event.target.value)
              }
            />
          </Field>
          {responsibilityVisible ? (
            <div className="sm:col-span-2">
              <Field label="Responsabilité RC" required>
                <Select
                  disabled={!editable}
                  value={form.responsabilite === "NON_DETERMINEE" ? "" : form.responsabilite}
                  onValueChange={(value) => update("responsabilite", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 %</SelectItem>
                    <SelectItem value="50">50 %</SelectItem>
                    <SelectItem value="100">100 %</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}
        </div>
        <Collapsible
          open={trackingOpen}
          onOpenChange={setTrackingOpen}
          className="mt-4 border-t pt-3"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between py-1 text-left"
            >
              <span>
                <span className="text-sm font-semibold">Suivi interne</span>
                {!trackingOpen && form.prochaineAction ? (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {form.prochaineAction}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${trackingOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Gestionnaire">
                <Select
                  disabled={!editable}
                  value={form.gestionnaireId}
                  onValueChange={(value) => update("gestionnaireId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Échéance de l’action">
                <DatePicker
                  disabled={!editable}
                  date={form.dateEcheanceAction}
                  onSelect={(date) =>
                    update("dateEcheanceAction", toIsoDate(date))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Prochaine action">
                  <Input
                    disabled={!editable}
                    maxLength={500}
                    value={form.prochaineAction}
                    onChange={(event) =>
                      update("prochaineAction", event.target.value)
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes internes">
                  <Textarea
                    disabled={!editable}
                    rows={2}
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                  />
                </Field>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        </fieldset> : null}
      </section>
  );
}

export function CoverageSection({
  dossier,
  assessmentVisible,
  editable,
  saving,
  onSave,
  editMode = false,
  onCancel,
}: {
  dossier: SinistreDetail;
  assessmentVisible: boolean;
  editable: boolean;
  saving: boolean;
  onSave?: (guarantees: object[]) => Promise<unknown>;
  editMode?: boolean;
  onCancel?: () => void;
}) {
  const [editing, setEditing] = useState(editMode && editable);
  const [drafts, setDrafts] = useState<Record<string, GuaranteeDraft>>(() =>
    Object.fromEntries(
      dossier.garanties.map((item) => [item.id, toGuaranteeDraft(item)]),
    ),
  );

  const changed = dossier.garanties.filter((item) =>
    guaranteeDraftChanged(item, drafts[item.id]),
  );
  const involvedCount = dossier.garanties.filter(
    (item) => editing && editable ? drafts[item.id]?.involved ?? item.impliquee : item.impliquee,
  ).length;

  return (
    <section className="min-w-0">
    <SectionHeader
      title={assessmentVisible ? "Décision de couverture" : "Garanties impliquées"}
      action={
        editable && !editing ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="size-4" />Modifier</Button> : editable ? (
          <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={saving} onClick={() => {
            setDrafts(Object.fromEntries(dossier.garanties.map((item) => [item.id, toGuaranteeDraft(item)])));
            setEditing(false);
            onCancel?.();
          }}>Annuler</Button>
          <Button
            size="sm"
            disabled={saving || changed.length === 0}
            onClick={() =>
              void onSave?.(
                changed.map((item) => {
                  const draft = drafts[item.id];
                  return {
                    id: item.id,
                    decisionCouverture: draft.decision,
                    impliquee: draft.involved,
                    franchiseAppliquee: draft.franchise
                      ? Number(draft.franchise)
                      : undefined,
                    montantIndemnisable: draft.indemnisable
                      ? Number(draft.indemnisable)
                      : undefined,
                  };
                }),
              ).then(() => setEditing(false)).catch(() => undefined)
            }
          >
            <Save className="size-4" />
            Enregistrer
          </Button>
          </div>
        ) : null
      }
    />
      <p className="px-4 py-2 text-sm text-muted-foreground">{involvedCount} sur {dossier.garanties.length} garantie(s) impliquée(s) · Montants en MAD</p>
      {!editing || !editable ? <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Garantie</TableHead>
              <TableHead>Impliquée</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              {assessmentVisible ? <>
                <TableHead>Décision</TableHead>
                <TableHead className="text-right">Franchise appliquée</TableHead>
                <TableHead className="text-right">Indemnisable</TableHead>
              </> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dossier.garanties.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-normal">
                  <span className="font-medium">{item.code} · {item.libelle}</span>
                  <p className="text-xs text-muted-foreground">Franchise contractuelle {item.tauxFranchise ?? 0} % / {formatMoney(item.franchiseMinimale)}</p>
                </TableCell>
                <TableCell>{item.impliquee ? "Oui" : "Non"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(item.capital)}</TableCell>
                {assessmentVisible ? <>
                  <TableCell>{coverageDecisionLabels[item.decisionCouverture]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(item.franchiseAppliquee)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(item.montantIndemnisable)}</TableCell>
                </> : null}
              </TableRow>
            ))}
            {dossier.garanties.length === 0 ? <TableRow><TableCell colSpan={assessmentVisible ? 6 : 3} className="py-6 text-center text-muted-foreground">Aucune garantie.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div> : <div className={assessmentVisible ? "grid gap-3 py-4" : "divide-y"}>
        {dossier.garanties.map((item) => {
          const draft = drafts[item.id] ?? toGuaranteeDraft(item);
          return (
            <GuaranteeRow
              key={item.id}
              item={item}
              draft={draft}
              assessmentVisible={assessmentVisible}
              editable={editable && !saving}
              onChange={(next) =>
                setDrafts((current) => ({ ...current, [item.id]: next }))
              }
            />
          );
        })}
      </div>}
      {dossier.assistances?.length ? <div className="px-4 pb-4"><SinistreAssistanceTable items={dossier.assistances} /></div> : null}
    </section>
  );
}

type GuaranteeDraft = {
  decision: DecisionCouverture;
  involved: boolean;
  franchise: string;
  indemnisable: string;
};

const coverageDecisionLabels: Record<DecisionCouverture, string> = {
  A_ETUDIER: "À étudier",
  ACCEPTEE: "Acceptée",
  PARTIELLE: "Partiellement acceptée",
  REFUSEE: "Refusée",
};

function GuaranteeRow({
  item,
  draft,
  assessmentVisible,
  editable,
  onChange,
}: {
  item: SinistreDetail["garanties"][number];
  draft: GuaranteeDraft;
  assessmentVisible: boolean;
  editable: boolean;
  onChange: (draft: GuaranteeDraft) => void;
}) {
  return (
    <div
      className={
        assessmentVisible
          ? "grid items-end gap-3 border-b py-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_190px_150px_170px]"
          : "grid items-center gap-3 px-4 py-3"
      }
    >
      <div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={draft.involved}
            disabled={!editable}
            onCheckedChange={(checked) =>
              onChange({ ...draft, involved: checked === true })
            }
            aria-label={`Garantie impliquée ${item.libelle}`}
          />
          <p className="font-medium">
            {item.code} · {item.libelle}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Capital {formatMoney(item.capital)} · franchise contractuelle{" "}
          {item.tauxFranchise ?? 0}% / {formatMoney(item.franchiseMinimale)}
        </p>
      </div>
      {assessmentVisible ? (
      <>
      <Field label="Décision">
        <Select
          disabled={!editable}
          value={draft.decision}
          onValueChange={(value) =>
            onChange({ ...draft, decision: value as DecisionCouverture })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A_ETUDIER">À étudier</SelectItem>
            <SelectItem value="ACCEPTEE">Acceptée</SelectItem>
            <SelectItem value="PARTIELLE">Partiellement acceptée</SelectItem>
            <SelectItem value="REFUSEE">Refusée</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Franchise appliquée">
        <Input
          disabled={!editable}
          type="number"
          min="0"
          value={draft.franchise}
          onChange={(event) =>
            onChange({ ...draft, franchise: event.target.value })
          }
        />
      </Field>
      <Field label="Montant indemnisable">
        <Input
          disabled={!editable}
          type="number"
          min="0"
          value={draft.indemnisable}
          onChange={(event) =>
            onChange({ ...draft, indemnisable: event.target.value })
          }
        />
      </Field>
      </>
      ) : null}
    </div>
  );
}

function toGuaranteeDraft(
  item: SinistreDetail["garanties"][number],
): GuaranteeDraft {
  return {
    decision: item.decisionCouverture,
    involved: item.impliquee,
    franchise:
      item.franchiseAppliquee == null ? "" : String(item.franchiseAppliquee),
    indemnisable:
      item.montantIndemnisable == null
        ? ""
        : String(item.montantIndemnisable),
  };
}

function guaranteeDraftChanged(
  item: SinistreDetail["garanties"][number],
  draft?: GuaranteeDraft,
) {
  if (!draft) return false;
  const initial = toGuaranteeDraft(item);
  return (
    draft.decision !== initial.decision ||
    draft.involved !== initial.involved ||
    draft.franchise !== initial.franchise ||
    draft.indemnisable !== initial.indemnisable
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label>{label}{required ? <span className="text-red-500">*</span> : null}</Label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value || "-"}</dd>
    </div>
  );
}

function toIsoDate(date?: Date) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
