import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Car, FilePlus2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productionApi } from "../api";
import { Field } from "../components/Field";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";
import type { TypeContrat } from "../types";

export default function ContratCreationPage() {
  const navigate = useNavigate();
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
  const selectedConvention = useMemo(
    () => filteredConventions.find((convention) => convention.id === form.conventionId) ?? null,
    [filteredConventions, form.conventionId]
  );
  const assignedGrilleId = typeof selectedConvention?.grilleTarifaireId === "string" ? selectedConvention.grilleTarifaireId : "";
  const shouldCheckConventionGrille = typeContrat === "CONVENTION" && Boolean(assignedGrilleId && form.usageId);
  const conventionGrilleLines = useQuery({
    queryKey: ["entry-convention-grille-lines", assignedGrilleId, form.usageId],
    queryFn: () => productionApi.lignesGrille({ grilleId: assignedGrilleId, usageId: form.usageId }),
    enabled: shouldCheckConventionGrille,
    staleTime: 60_000,
  });
  const conventionPersonneFormules = useQuery({
    queryKey: ["entry-convention-personne-formules", assignedGrilleId, form.usageId],
    queryFn: () => productionApi.formulesGarantiePersonne({ grilleId: assignedGrilleId, usageId: form.usageId }),
    enabled: shouldCheckConventionGrille,
    staleTime: 60_000,
  });
  const conventionGrilleChecking = shouldCheckConventionGrille && (conventionGrilleLines.isLoading || conventionPersonneFormules.isLoading);
  const conventionGrilleConfigured = shouldCheckConventionGrille
    && !conventionGrilleChecking
    && ((conventionGrilleLines.data?.length ?? 0) > 0 || (conventionPersonneFormules.data?.length ?? 0) > 0);
  const conventionStartBlockedReason = conventionStartBlockReason({
    typeContrat,
    conventionSelected: Boolean(form.conventionId),
    usageSelected: Boolean(form.usageId),
    assignedGrilleId,
    checking: conventionGrilleChecking,
    configured: conventionGrilleConfigured,
  });

  const canStart =
    assurance === "automobile" &&
    Boolean(typeContrat) &&
    (typeContrat !== "PARTICULIER" || Boolean(categorieClientId)) &&
    (typeContrat !== "CONVENTION" || Boolean(form.compagnieAssuranceId && form.conventionId && form.usageId && !conventionStartBlockedReason));

  const createDraftMutation = useMutation({
    mutationFn: productionApi.createContratDraft,
    onSuccess: (draft) => {
      if (typeContrat === "PARTICULIER") {
        navigate(`/app/production/ajouter-dossier/particulier/${draft.id}?categorieClientId=${encodeURIComponent(categorieClientId)}`);
        return;
      }
      if (typeContrat === "FLOTTE") {
        navigate(`/app/production/ajouter-dossier/flotte/${draft.id}`);
        return;
      }
      if (typeContrat === "CONVENTION") {
        navigate(`/app/production/ajouter-dossier/convention/${draft.id}`);
      }
    },
  });

  const handleStart = () => {
    if (!typeContrat) {
      return;
    }
    createDraftMutation.mutate({
      ...form.request,
      typeContrat,
      compagnieAssuranceId: form.compagnieAssuranceId || undefined,
      conventionId: typeContrat === "CONVENTION" ? form.conventionId || undefined : undefined,
      usageId: form.usageId || undefined,
      grilleTarifaireId: typeContrat === "CONVENTION" ? assignedGrilleId || undefined : form.grilleTarifaireId || undefined,
      clients: typeContrat === "PARTICULIER"
        ? form.request.clients.map((client) =>
            client.role === "SOUSCRIPTEUR"
              ? { ...client, client: { ...client.client, categorieClientId } }
              : client
          )
        : form.request.clients,
    });
  };

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
                <Select value={form.usageId} onValueChange={form.setUsageId} disabled={!form.conventionId || form.availableUsages.length === 0}>
                  <SelectTrigger><SelectValue placeholder="Choisir une option" /></SelectTrigger>
                  <SelectContent>
                    {form.availableUsages.map((usage) => (
                      <SelectItem key={usage.id} value={usage.id}>{usage.code ? `${usage.code} - ` : ""}{usage.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {conventionStartBlockedReason ? (
                  <p className="mt-1 text-xs text-red-600">{conventionStartBlockedReason}</p>
                ) : null}
              </Field>
            </div>
          ) : null}

          <div>
            <Button
              type="button"
              onClick={handleStart}
              disabled={!canStart || createDraftMutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-muted disabled:text-muted-foreground"
            >
              {createDraftMutation.isPending ? "Création..." : "Ajouter"}
              <ArrowRight className="size-4" />
            </Button>
            {createDraftMutation.isError ? (
              <p className="mt-2 text-xs text-red-600">
                {createDraftMutation.error instanceof Error ? createDraftMutation.error.message : "Création du brouillon impossible"}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function conventionStartBlockReason({
  typeContrat,
  conventionSelected,
  usageSelected,
  assignedGrilleId,
  checking,
  configured,
}: {
  typeContrat: TypeContrat | "";
  conventionSelected: boolean;
  usageSelected: boolean;
  assignedGrilleId: string;
  checking: boolean;
  configured: boolean;
}) {
  if (typeContrat !== "CONVENTION" || !conventionSelected) {
    return "";
  }
  if (!assignedGrilleId) {
    return "Cette convention n'a pas de grille tarifaire affectée.";
  }
  if (!usageSelected) {
    return "";
  }
  if (checking) {
    return "Vérification de la grille tarifaire...";
  }
  if (!configured) {
    return "La grille affectée à cette convention ne contient aucun tarif/formule pour cet usage.";
  }
  return "";
}
