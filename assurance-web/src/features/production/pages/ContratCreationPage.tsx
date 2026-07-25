import { useMemo, useState } from "react";
import { ArrowRight, Building2, Car, FilePlus2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../components/Field";
import { ConventionContratForm } from "../contrat-creation/ConventionContratForm";
import { FlotteContratForm } from "../contrat-creation/FlotteContratForm";
import { ParticulierContratForm } from "../contrat-creation/ParticulierContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";
import type { TypeContrat } from "../types";

export default function ContratCreationPage() {
  const [started, setStarted] = useState(false);
  const [assurance, setAssurance] = useState("");
  const [typeContrat, setTypeContrat] = useState<TypeContrat | "">("");
  const [categorieClientId, setCategorieClientId] = useState("");
  const form = useContratCreationForm((typeContrat || "PARTICULIER") as TypeContrat);
  const categoriesClient = form.refs.categoriesClient.data ?? [];
  const categoriesClientBlocked = typeContrat === "PARTICULIER" && !form.refs.categoriesClient.isLoading && !form.refs.categoriesClient.isError && categoriesClient.length === 0;

  const filteredConventions = useMemo(
    () => (form.refs.conventions.data ?? []).filter(
      (convention) => !form.compagnieAssuranceId || convention.compagnieAssuranceId === form.compagnieAssuranceId
    ),
    [form.compagnieAssuranceId, form.refs.conventions.data]
  );

  const canStart =
    assurance === "automobile" &&
    Boolean(typeContrat) &&
    (typeContrat !== "PARTICULIER" || Boolean(categorieClientId)) &&
    (typeContrat !== "CONVENTION" || Boolean(form.compagnieAssuranceId && form.conventionId && form.usageId));

  const handleStart = () => {
    if (typeContrat === "PARTICULIER" && categorieClientId) {
      form.setClients(
        form.clients.map((client) =>
          client.role === "SOUSCRIPTEUR"
            ? { ...client, client: { ...client.client, categorieClientId } }
            : client
        )
      );
    }
    setStarted(true);
  };

  if (started && typeContrat === "CONVENTION") {
    return <ConventionContratForm form={form} />;
  }

  if (started && typeContrat === "FLOTTE") {
    return <FlotteContratForm form={form} />;
  }

  if (started && typeContrat === "PARTICULIER") {
    return <ParticulierContratForm form={form} />;
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6">
      <div>
        <div className="text-sm font-medium text-emerald-700">Production</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Ajouter un dossier</h1>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-none">
        <CardHeader className="bg-emerald-600 text-white">
          <CardTitle className="flex items-center justify-center gap-2 text-base uppercase">
            <FilePlus2 className="size-4" />
            Ajouter un dossier
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Assurance">
              <Select value={assurance} onValueChange={(value) => {
                setAssurance(value);
                setTypeContrat("");
              }}>
                <SelectTrigger><SelectValue placeholder="Choisir une option" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="automobile">Automobile</SelectItem>
                  <SelectItem value="risques-divers" disabled>Risques divers</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {assurance === "automobile" ? (
              <Field label="Type du dossier">
                <Select value={typeContrat} onValueChange={(value) => {
                  setTypeContrat(value as TypeContrat);
                  setCategorieClientId("");
                  form.setCompagnieAssuranceId("");
                  form.setConventionId("");
                  form.setUsageId("");
                }}>
                  <SelectTrigger><SelectValue placeholder="Choisir une option" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PARTICULIER">
                      <span className="inline-flex items-center gap-2"><Car className="size-4" /> Particulier</span>
                    </SelectItem>
                    <SelectItem value="FLOTTE">
                      <span className="inline-flex items-center gap-2"><Users className="size-4" /> Flotte entreprise</span>
                    </SelectItem>
                    <SelectItem value="CONVENTION">
                      <span className="inline-flex items-center gap-2"><Building2 className="size-4" /> Convention</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>

          {typeContrat === "PARTICULIER" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Catégorie">
                <Select
                  value={categorieClientId}
                  onValueChange={setCategorieClientId}
                  disabled={form.refs.categoriesClient.isLoading || form.refs.categoriesClient.isError || categoriesClientBlocked}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir une option" /></SelectTrigger>
                  <SelectContent>
                    {form.refs.categoriesClient.isLoading ? (
                      <SelectItem value="loading" disabled>Chargement des catégories...</SelectItem>
                    ) : null}
                    {categoriesClientBlocked ? (
                      <SelectItem value="empty" disabled>Aucune catégorie configurée</SelectItem>
                    ) : null}
                    {categoriesClient.map((categorie) => (
                      <SelectItem key={categorie.id} value={categorie.id}>{categorie.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.refs.categoriesClient.isError ? (
                  <p className="mt-1 text-xs text-red-600">Impossible de charger les catégories client.</p>
                ) : null}
              </Field>
            </div>
          ) : null}

          {typeContrat === "CONVENTION" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Compagnie">
                <Select value={form.compagnieAssuranceId} onValueChange={(value) => {
                  form.setCompagnieAssuranceId(value);
                  form.setConventionId("");
                  form.setUsageId("");
                }}>
                  <SelectTrigger><SelectValue placeholder="Choisir une option" /></SelectTrigger>
                  <SelectContent>
                    {form.refs.compagnies.data?.map((compagnie) => (
                      <SelectItem key={compagnie.id} value={compagnie.id}>{compagnie.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Convention">
                <Select value={form.conventionId} onValueChange={form.setConventionId} disabled={!form.compagnieAssuranceId}>
                  <SelectTrigger><SelectValue placeholder="Choisir une option" /></SelectTrigger>
                  <SelectContent>
                    {filteredConventions.map((convention) => (
                      <SelectItem key={convention.id} value={convention.id}>{convention.code ? `${convention.code} - ` : ""}{convention.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Usage">
                <Select value={form.usageId} onValueChange={form.setUsageId} disabled={!form.conventionId}>
                  <SelectTrigger><SelectValue placeholder="Choisir une option" /></SelectTrigger>
                  <SelectContent>
                    {form.refs.usages.data?.map((usage) => (
                      <SelectItem key={usage.id} value={usage.id}>{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}

          <div>
            <Button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-muted disabled:text-muted-foreground"
            >
              Ajouter
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
