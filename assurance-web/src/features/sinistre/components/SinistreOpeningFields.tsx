import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { referenceApi } from "@/features/production/api/references";
import { sinistreApi, sinistreKeys } from "../api";
import type { ModeReparationSinistre, OpeningDocument, ProviderEligibilityContext } from "../types";
import { SinistreVilleSelect } from "./SinistreVilleSelect";
import { appendOpeningFiles } from "../opening-files";
import { toast } from "@/lib/toast";

const openingDocumentLabels: Record<OpeningDocument["type"], string> = {
  CONSTAT: "Constat", PV_POLICE: "Procès-verbal", DECLARATION: "Déclaration",
};

export type OpeningFields = {
  modeReparation: ModeReparationSinistre | "";
  tauxResponsabilite: string;
  garageId: string;
  expertVilleId: string;
  expertId: string;
  dateMission: string;
};

export function SinistreOpeningFields({ automobile, responsabiliteCivile, value, onChange, documents, onDocumentsChange, disabled, onAddExpert, providerContext, onEligibilityChange }: {
  automobile: boolean;
  responsabiliteCivile: boolean;
  value: OpeningFields;
  onChange: (value: OpeningFields) => void;
  documents: OpeningDocument[];
  onDocumentsChange: (documents: OpeningDocument[]) => void;
  disabled: boolean;
  onAddExpert?: () => void;
  providerContext: ProviderEligibilityContext;
  onEligibilityChange: (valid: boolean) => void;
}) {
  const cities = useQuery({ queryKey: ["referentiel", "villes", "sinistre"], queryFn: () => referenceApi.list("villes"), staleTime: 60_000 });
  const expertContext = { ...providerContext, villeId: value.expertVilleId || undefined, dateIntervention: value.dateMission || undefined };
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
      <Field label="Ville de l’expert"><SinistreVilleSelect disabled={disabled} cities={cities.data ?? []} value={value.expertVilleId} onValueChange={(expertVilleId) => onChange({ ...value, expertVilleId, expertId: "" })} /></Field>
      <div className="grid content-start gap-1.5">
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
          <Label htmlFor="opening-expert">Expert initial</Label>
          {onAddExpert ? <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" disabled={disabled || cities.isPending || cities.isError} onClick={onAddExpert}><Plus className="size-3.5" />Ajouter un expert</Button> : null}
        </div>
        <Select disabled={disabled || experts.isPending || experts.isError} value={value.expertId || "NONE"} onValueChange={(next) => update("expertId", next === "NONE" ? "" : next)}>
          <SelectTrigger id="opening-expert"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Non désigné</SelectItem>{value.expertId && !experts.data?.some(item => item.id === value.expertId) ? <SelectItem value={value.expertId} disabled>Expert incompatible · à remplacer</SelectItem> : null}{(experts.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.nom}{item.ville ? ` · ${item.ville}` : ""}</SelectItem>)}{experts.isSuccess && !experts.data.length ? <SelectItem value="EMPTY" disabled>Aucun expert compatible</SelectItem> : null}</SelectContent>
        </Select>
      </div>
      {value.expertId ? <Field label="Date de mission initiale" required><DatePicker disabled={disabled} date={value.dateMission} onSelect={(date) => update("dateMission", date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "")} /></Field> : null}
    </fieldset>
    {!expertValid || !garageValid ? <p role="alert" className="text-sm text-destructive">Vérifiez les prestataires sélectionnés : compagnie, garanties et validité des accords.</p> : null}
    {experts.isError || garages.isError || cities.isError ? <p role="alert" className="text-sm text-destructive">{[experts.error, garages.error, cities.error].filter(Boolean).map((error) => error instanceof Error ? error.message : "Référentiel indisponible").join(" · ")}</p> : null}
    <div className="border-t pt-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Paperclip className="size-4" /> Pièces d’ouverture</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {(["CONSTAT", "PV_POLICE", "DECLARATION"] as const).map((type) => <div key={type} className="grid content-start gap-2">
          <h4 className="text-sm font-medium">{openingDocumentLabels[type]}</h4>
          <FileDropzone multiple disabled={disabled} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            title={`Déposer ${type === "DECLARATION" ? "une déclaration" : type === "PV_POLICE" ? "un procès-verbal" : "un constat"}`}
            description="PDF, JPG, PNG ou Word · 30 Mo par fichier · Parcourir"
            className="bg-background"
            onFilesSelect={(files) => {
              const result = appendOpeningFiles(documents, files, type);
              onDocumentsChange(result.documents);
              if (result.errors.length) toast.error(result.errors.join("\n"));
            }} />
          <span className="text-xs text-muted-foreground">{documents.filter((document) => document.type === type).length} fichier(s)</span>
        </div>)}
      </div>
      {documents.length > 0 ? <ul className="mt-3 divide-y">{documents.map((document, index) => <li key={`${index}-${document.file.name}`} className="flex items-center justify-between gap-3 py-2 text-sm">
        <span className="min-w-0 break-words">{document.file.name} <span className="text-muted-foreground">· {openingDocumentLabels[document.type]} · {(document.file.size / 1024 / 1024).toFixed(1).replace(".", ",")} Mo</span></span>
        <Button disabled={disabled} variant="ghost" size="icon" title="Retirer la pièce" aria-label={`Retirer ${document.file.name}`} onClick={() => onDocumentsChange(documents.filter((_, position) => position !== index))}><Trash2 className="size-4" /></Button>
      </li>)}</ul> : null}
    </div>
  </div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm"><Label asChild><span>{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span></Label>{children}</label>;
}
