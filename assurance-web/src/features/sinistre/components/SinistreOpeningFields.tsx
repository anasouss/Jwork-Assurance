import { useQuery } from "@tanstack/react-query";
import { Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { referenceApi } from "@/features/production/api/references";
import { sinistreApi, sinistreKeys } from "../api";
import type { ModeReparationSinistre, OpeningDocument, TypeDommageSinistre } from "../types";
import { SinistreVilleSelect } from "./SinistreVilleSelect";

const openingDocumentLabels: Record<OpeningDocument["type"], string> = {
  CONSTAT: "Constat", PV_POLICE: "Procès-verbal", DECLARATION: "Déclaration",
};

export type OpeningFields = {
  referenceCompagnie: string;
  numeroPv: string;
  typeDommage: TypeDommageSinistre | "";
  modeReparation: ModeReparationSinistre | "";
  tauxResponsabilite: string;
  garageId: string;
  expertVilleId: string;
  expertId: string;
  dateMission: string;
};

export function SinistreOpeningFields({ automobile, responsabiliteCivile, value, onChange, documents, onDocumentsChange, disabled }: {
  automobile: boolean;
  responsabiliteCivile: boolean;
  value: OpeningFields;
  onChange: (value: OpeningFields) => void;
  documents: OpeningDocument[];
  onDocumentsChange: (documents: OpeningDocument[]) => void;
  disabled: boolean;
}) {
  const cities = useQuery({ queryKey: ["referentiel", "villes", "sinistre"], queryFn: () => referenceApi.list("villes"), staleTime: 60_000 });
  const experts = useQuery({ queryKey: sinistreKeys.experts(false, value.expertVilleId || undefined), queryFn: () => sinistreApi.experts(false, value.expertVilleId || undefined) });
  const garages = useQuery({ queryKey: sinistreKeys.garages(false), queryFn: () => sinistreApi.garages(false), enabled: automobile });
  const update = <K extends keyof OpeningFields>(key: K, next: OpeningFields[K]) => onChange({ ...value, [key]: next });
  return <div className="grid gap-5">
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Référence compagnie"><Input maxLength={100} value={value.referenceCompagnie} onChange={(event) => update("referenceCompagnie", event.target.value)} /></Field>
      <Field label="N° de procès-verbal"><Input maxLength={120} value={value.numeroPv} onChange={(event) => update("numeroPv", event.target.value)} /></Field>
      {automobile ? <>
        <Field label="Dommages *"><Select disabled={disabled} value={value.typeDommage} onValueChange={(next) => update("typeDommage", next as TypeDommageSinistre)}>
          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>
            <SelectItem value="MATERIEL">Matériel</SelectItem><SelectItem value="CORPOREL">Corporel</SelectItem><SelectItem value="MIXTE">Mixte</SelectItem>
          </SelectContent></Select></Field>
        <Field label="Mode de réparation *"><Select disabled={disabled} value={value.modeReparation} onValueChange={(next) => onChange({ ...value, modeReparation: next as ModeReparationSinistre, garageId: "" })}>
          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="PEC">Prise en charge (PEC)</SelectItem><SelectItem value="RAPIDE">Rapide</SelectItem></SelectContent>
        </Select></Field>
        <Field label={value.modeReparation === "PEC" ? "Garage conventionné *" : "Garage"}><Select disabled={disabled || garages.isPending || garages.isError} value={value.garageId || "NONE"} onValueChange={(next) => update("garageId", next === "NONE" ? "" : next)}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Non désigné</SelectItem>
            {(garages.data ?? []).filter((item) => item.actif && (value.modeReparation !== "PEC" || item.conventionne)).map((item) => <SelectItem key={item.id} value={item.id}>{item.nom}{item.ville ? ` · ${item.ville}` : ""}</SelectItem>)}
          </SelectContent></Select></Field>
      </> : null}
      {responsabiliteCivile ? <Field label="Responsabilité RC *"><Select disabled={disabled} value={value.tauxResponsabilite} onValueChange={(next) => update("tauxResponsabilite", next)}>
        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="0">0 %</SelectItem><SelectItem value="50">50 %</SelectItem><SelectItem value="100">100 %</SelectItem></SelectContent>
      </Select></Field> : null}
      <Field label="Ville de l’expert"><SinistreVilleSelect disabled={disabled} cities={cities.data ?? []} value={value.expertVilleId} onValueChange={(expertVilleId) => onChange({ ...value, expertVilleId, expertId: "" })} /></Field>
      <Field label="Expert initial"><Select disabled={disabled || experts.isPending || experts.isError} value={value.expertId || "NONE"} onValueChange={(next) => update("expertId", next === "NONE" ? "" : next)}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Non désigné</SelectItem>{(experts.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.nom}{item.ville ? ` · ${item.ville}` : ""}</SelectItem>)}</SelectContent>
      </Select></Field>
      {value.expertId ? <Field label="Date de mission initiale *"><DatePicker disabled={disabled} date={value.dateMission} onSelect={(date) => update("dateMission", date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "")} /></Field> : null}
    </fieldset>
    {experts.isError || garages.isError || cities.isError ? <p role="alert" className="text-sm text-destructive">{[experts.error, garages.error, cities.error].filter(Boolean).map((error) => error instanceof Error ? error.message : "Référentiel indisponible").join(" · ")}</p> : null}
    <div className="border-t pt-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Paperclip className="size-4" /> Pièces d’ouverture</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {(["CONSTAT", "PV_POLICE", "DECLARATION"] as const).map((type) => <Field key={type} label={openingDocumentLabels[type]}>
          <Input type="file" multiple disabled={disabled} aria-label={`Joindre : ${openingDocumentLabels[type]}`} onChange={(event) => {
            onDocumentsChange([...documents, ...Array.from(event.target.files ?? []).map((file) => ({ file, type }))]);
            event.target.value = "";
          }} />
        </Field>)}
      </div>
      {documents.length > 0 ? <ul className="mt-3 divide-y">{documents.map((document, index) => <li key={`${index}-${document.file.name}`} className="flex items-center justify-between gap-3 py-2 text-sm">
        <span className="min-w-0 break-words">{document.file.name} <span className="text-muted-foreground">· {openingDocumentLabels[document.type]} · {(document.file.size / 1024 / 1024).toFixed(1).replace(".", ",")} Mo</span></span>
        <Button disabled={disabled} variant="ghost" size="icon" title="Retirer la pièce" aria-label={`Retirer ${document.file.name}`} onClick={() => onDocumentsChange(documents.filter((_, position) => position !== index))}><Trash2 className="size-4" /></Button>
      </li>)}</ul> : null}
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm"><Label asChild><span>{label}</span></Label>{children}</label>;
}
