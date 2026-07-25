import { Save, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ClientSection } from "../components/ClientSection";
import { Field } from "../components/Field";
import { GarantieSection } from "../components/GarantieSection";
import { QuittancePreviewCard } from "../components/QuittancePreviewCard";
import { SectionCard } from "../components/SectionCard";
import { VehiculeSection } from "../components/VehiculeSection";
import type { CreateContratRequest } from "../types";
import type { ContratCreationFormState } from "./useContratCreationForm";

type Props = {
  form: ContratCreationFormState;
  badge: string;
  description: string;
  showConvention?: boolean;
  showGrille?: boolean;
  allowSaisiePrimeNette?: boolean;
  allowMultipleVehicules?: boolean;
};

export function ContratFormLayout({
  form,
  badge,
  description,
  showConvention = false,
  showGrille = true,
  allowSaisiePrimeNette = false,
  allowMultipleVehicules = false,
}: Props) {
  const filteredConventions = (form.refs.conventions.data ?? []).filter(
    (convention) => !form.compagnieAssuranceId || convention.compagnieAssuranceId === form.compagnieAssuranceId
  );
  const filteredGrilles = (form.refs.grilles.data ?? []).filter(
    (grille) => !form.compagnieAssuranceId || grille.compagnieAssuranceId === form.compagnieAssuranceId
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ajouter dossier</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={form.handlePreview} disabled={form.previewMutation.isPending}>
            <Wand2 className="size-4" />
            Prévisualiser
          </Button>
          <Button onClick={form.handleCreate} disabled={form.createMutation.isPending}>
            <Save className="size-4" />
            Créer contrat
          </Button>
        </div>
      </div>

      <SectionCard title="Contrat" badge={badge} tone="production">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Compagnie">
            <Select value={form.compagnieAssuranceId} onValueChange={form.setCompagnieAssuranceId}>
              <SelectTrigger><SelectValue placeholder="Compagnie" /></SelectTrigger>
              <SelectContent>
                {form.refs.compagnies.data?.map((item) => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {showConvention ? (
            <Field label="Convention / produit">
              <Select value={form.conventionId} onValueChange={form.setConventionId}>
                <SelectTrigger><SelectValue placeholder="Convention" /></SelectTrigger>
                <SelectContent>
                  {filteredConventions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} - ` : ""}{item.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field label="Usage contrat">
            <Select value={form.usageId} onValueChange={form.setUsageId}>
              <SelectTrigger><SelectValue placeholder="Usage" /></SelectTrigger>
              <SelectContent>
                {form.refs.usages.data?.map((item) => <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} - ` : ""}{item.libelle}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {showGrille ? (
            <Field label="Grille tarifaire">
              <Select value={form.grilleTarifaireId} onValueChange={form.setGrilleTarifaireId}>
                <SelectTrigger><SelectValue placeholder="Grille" /></SelectTrigger>
                <SelectContent>
                  {filteredGrilles.map((item) => <SelectItem key={item.id} value={item.id}>{item.libelle}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field label="N° contrat">
            <Input value={form.numeroContrat} onChange={(event) => form.setNumeroContrat(event.target.value)} />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="N° police">
            <Input value={form.numeroPolice} onChange={(event) => form.setNumeroPolice(event.target.value)} />
          </Field>
          <Field label="N° attestation">
            <Input value={form.numeroAttestation} onChange={(event) => form.setNumeroAttestation(event.target.value)} />
          </Field>
          <Field label="Date effet">
            <DatePicker date={form.dateEffet} onSelect={(date) => form.setDateEffet(toIso(date))} />
          </Field>
          <Field label="Date échéance">
            <DatePicker date={form.dateEcheance} onSelect={(date) => form.setDateEcheance(toIso(date))} />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="Fractionnement">
            <Select value={form.fractionnement} onValueChange={(value) => form.setFractionnement(value as CreateContratRequest["fractionnement"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ANNUEL">Annuel</SelectItem>
                <SelectItem value="SEMESTRIEL">Semestriel</SelectItem>
                <SelectItem value="TRIMESTRIEL">Trimestriel</SelectItem>
                <SelectItem value="MENSUEL">Mensuel</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {allowSaisiePrimeNette ? (
            <div className="flex items-end gap-2 pb-2">
              <Switch checked={form.saisiePrimeNette} onCheckedChange={form.setSaisiePrimeNette} />
              <span className="text-sm">Saisie prime nette</span>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <ClientSection
        clients={form.clients}
        setClients={form.setClients}
        villes={form.refs.villes.data ?? []}
        categoriesClient={form.refs.categoriesClient.data ?? []}
      />

      <VehiculeSection
        vehicules={form.vehicules}
        remorques={form.remorques}
        setVehicules={form.setVehicules}
        setRemorques={form.setRemorques}
        usages={form.refs.usages.data ?? []}
        marques={form.refs.marques.data ?? []}
        carrosseries={form.refs.carrosseries.data ?? []}
        categoriesTransport={form.refs.categoriesTransport.data ?? []}
        allowMultipleVehicules={allowMultipleVehicules}
      />

      <GarantieSection
        garanties={form.refs.garanties.data ?? []}
        selected={form.garanties}
        setSelected={form.setGaranties}
        lignes={showGrille ? form.lignesGrille.data ?? [] : []}
        vehiculeCount={form.vehicules.length}
        showLigneGrille={showGrille}
      />

      <SectionCard title="Quittances" tone="production" defaultOpen={false}>
        <QuittancePreviewCard preview={form.preview} />
      </SectionCard>
    </div>
  );
}

function toIso(date?: Date) {
  return date ? date.toISOString().slice(0, 10) : undefined;
}
