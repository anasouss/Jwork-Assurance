import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sinistreApi, sinistreKeys } from "../api";
import type { ModeReparationSinistre, OpeningDocument, ProviderEligibilityContext } from "../types";
import { appendOpeningFiles } from "../opening-files";
import { toast } from "@/lib/toast";

const openingDocumentLabels: Record<OpeningDocument["type"], string> = {
  CONSTAT: "Constat", PV_POLICE: "Procès-verbal", DECLARATION: "Déclaration",
};

export type OpeningFields = {
  modeReparation: ModeReparationSinistre | "";
  tauxResponsabilite: string;
  garageId: string;
  expertId: string;
  dateMission: string;
};

export function SinistreOpeningFields({ automobile, responsabiliteCivile, value, onChange, disabled, onAddExpert, providerContext, onEligibilityChange }: {
  automobile: boolean;
  responsabiliteCivile: boolean;
  value: OpeningFields;
  onChange: (value: OpeningFields) => void;
  disabled: boolean;
  onAddExpert?: () => void;
  providerContext: ProviderEligibilityContext;
  onEligibilityChange: (valid: boolean) => void;
}) {
  const expertContext = { ...providerContext, dateIntervention: value.dateMission || undefined };
  const garageContext = { ...providerContext, modeReparation: value.modeReparation || undefined };
  const experts = useQuery({ queryKey: sinistreKeys.eligible("EXPERT", expertContext), queryFn: () => sinistreApi.eligibleProviders("EXPERT", expertContext) });
  const garages = useQuery({ queryKey: sinistreKeys.eligible("GARAGE", garageContext), queryFn: () => sinistreApi.eligibleProviders("GARAGE", garageContext), enabled: automobile });
  const expertValid = !value.expertId || (!experts.isFetching && !experts.isError && !!experts.data?.some(item => item.id === value.expertId));
  const garageValid = !value.garageId || (!garages.isFetching && !garages.isError && !!garages.data?.some(item => item.id === value.garageId));
  useEffect(() => { onEligibilityChange(expertValid && garageValid); }, [expertValid, garageValid, onEligibilityChange]);
  const update = <K extends keyof OpeningFields>(key: K, next: OpeningFields[K]) => onChange({ ...value, [key]: next });
  return <div className="grid gap-5">
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {automobile ? <>
        <Field label="Mode de réparation" required><Select disabled={disabled} value={value.modeReparation} onValueChange={(next) => onChange({ ...value, modeReparation: next as ModeReparationSinistre, garageId: "" })}>
          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="PEC">Prise en charge (PEC)</SelectItem><SelectItem value="RAPIDE">Rapide</SelectItem></SelectContent>
        </Select></Field>
        <Field label={value.modeReparation === "PEC" ? "Garage conventionné" : "Garage"} required={value.modeReparation === "PEC"}><Select disabled={disabled || garages.isPending || garages.isError} value={value.garageId || "NONE"} onValueChange={(next) => update("garageId", next === "NONE" ? "" : next)}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Non désigné</SelectItem>
            {value.garageId && !garages.data?.some(item => item.id === value.garageId) ? <SelectItem value={value.garageId} disabled>Garage incompatible · à remplacer</SelectItem> : null}
            {(garages.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.nom}{item.ville ? ` · ${item.ville}` : ""}</SelectItem>)}
            {garages.isSuccess && !garages.data.length ? <SelectItem value="EMPTY" disabled>Aucun garage compatible</SelectItem> : null}
          </SelectContent></Select></Field>
      </> : null}
      {responsabiliteCivile ? <Field label="Responsabilité RC" required><Select disabled={disabled} value={value.tauxResponsabilite} onValueChange={(next) => update("tauxResponsabilite", next)}>
        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="0">0 %</SelectItem><SelectItem value="50">50 %</SelectItem><SelectItem value="100">100 %</SelectItem></SelectContent>
      </Select></Field> : null}
      <div className="grid content-start gap-1.5">
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
          <Label htmlFor="opening-expert">Expert initial</Label>
          {onAddExpert ? <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" disabled={disabled} onClick={onAddExpert}><Plus className="size-3.5" />Ajouter un expert</Button> : null}
        </div>
        <Select disabled={disabled || experts.isPending || experts.isError} value={value.expertId || "NONE"} onValueChange={(next) => update("expertId", next === "NONE" ? "" : next)}>
          <SelectTrigger id="opening-expert"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Non désigné</SelectItem>{value.expertId && !experts.data?.some(item => item.id === value.expertId) ? <SelectItem value={value.expertId} disabled>Expert incompatible · à remplacer</SelectItem> : null}{(experts.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.nom}{item.ville ? ` · ${item.ville}` : ""}</SelectItem>)}{experts.isSuccess && !experts.data.length ? <SelectItem value="EMPTY" disabled>Aucun expert compatible</SelectItem> : null}</SelectContent>
        </Select>
      </div>
      {value.expertId ? <Field label="Date de mission initiale" required><DatePicker disabled={disabled} date={value.dateMission} onSelect={(date) => update("dateMission", date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "")} /></Field> : null}
    </fieldset>
    {!expertValid || !garageValid ? <p role="alert" className="text-sm text-destructive">Vérifiez les prestataires sélectionnés : compagnie, garanties et validité des accords.</p> : null}
    {experts.isError || garages.isError ? <p role="alert" className="text-sm text-destructive">{[experts.error, garages.error].filter(Boolean).map((error) => error instanceof Error ? error.message : "Référentiel indisponible").join(" · ")}</p> : null}
  </div>;
}

export function SinistreOpeningDocuments({ documents, onChange, disabled }: {
  documents: OpeningDocument[];
  onChange: (documents: OpeningDocument[]) => void;
  disabled: boolean;
}) {
  const [selectedType, setSelectedType] = useState<OpeningDocument["type"] | "">("");
  const document = documents[0];
  const type = document?.type ?? selectedType;

  return <div className="grid gap-4">
    <div className="grid gap-1.5 sm:max-w-sm">
      <Label htmlFor="opening-document-type">Type de document</Label>
      <Select disabled={disabled} value={type} onValueChange={(next) => {
        const nextType = next as OpeningDocument["type"];
        setSelectedType(nextType);
        if (document) onChange([{ ...document, type: nextType }]);
      }}>
        <SelectTrigger id="opening-document-type"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
        <SelectContent>{(["CONSTAT", "PV_POLICE", "DECLARATION"] as const).map((item) =>
          <SelectItem key={item} value={item}>{openingDocumentLabels[item]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <FileDropzone disabled={disabled || !type} file={document?.file ?? null}
      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" title="Déposer un document"
      description="PDF, JPG, PNG ou Word · 30 Mo maximum · Parcourir"
      onFileChange={(file) => {
        if (!file) { onChange([]); return; }
        if (!type) return;
        const result = appendOpeningFiles([], [file], type);
        if (result.errors.length) toast.error(result.errors.join("\n"));
        else onChange(result.documents);
      }} />
  </div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm"><Label asChild><span>{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span></Label>{children}</label>;
}
