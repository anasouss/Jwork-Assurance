import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { sinistreApi, sinistreKeys } from "../api";
import { CoverageSection, GeneralSection } from "../components/SinistreDossierSections";
import { SinistreStatusBadge } from "../components/SinistreStatusBadge";
import type { SinistreDetail } from "../types";
import { isAtLeastTransmitted } from "../workflow";

export default function SinistreEditPage() {
  const { sinistreId = "" } = useParams();
  const [params] = useSearchParams();
  const guarantees = params.get("section") === "garanties";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useAuthStore((state) => state.user?.permissions.includes("sinistre:update") ?? false);
  const detailUrl = `/app/sinistre/dossiers/${sinistreId}`;
  const returnUrl = `${detailUrl}#${guarantees ? "garanties" : "informations"}`;
  const detail = useQuery({
    queryKey: sinistreKeys.detail(sinistreId),
    queryFn: () => sinistreApi.get(sinistreId),
    enabled: Boolean(sinistreId),
  });
  const managers = useQuery({
    queryKey: sinistreKeys.managers(),
    queryFn: sinistreApi.managers,
    enabled: canUpdate && detail.data?.editable === true && !guarantees,
  });
  const accept = (result: SinistreDetail) => {
    queryClient.setQueryData(sinistreKeys.detail(sinistreId), result);
    queryClient.invalidateQueries({ queryKey: sinistreKeys.lists() });
    queryClient.invalidateQueries({ queryKey: sinistreKeys.dashboard() });
    toast.success(guarantees ? "Garanties mises à jour" : "Dossier mis à jour");
    navigate(returnUrl, { replace: true });
  };
  const fail = (error: unknown) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
  const update = useMutation({
    mutationFn: (request: object) => sinistreApi.update(sinistreId, request),
    onSuccess: accept,
    onError: fail,
  });
  const coverage = useMutation({
    mutationFn: (request: object[]) => sinistreApi.updateGuarantees(sinistreId, request),
    onSuccess: accept,
    onError: fail,
  });

  if (detail.isPending) return <Skeleton className="h-96" />;
  if (!detail.data) return <div role="alert" className="grid gap-3">
    <h1 className="text-xl font-semibold">Dossier indisponible</h1>
    <p>{detail.error instanceof Error ? detail.error.message : "Chargement impossible."}</p>
    <Button variant="outline" onClick={() => detail.refetch()}>Réessayer</Button>
    <Button asChild variant="ghost"><Link to="/app/sinistre/dossiers">Retour aux dossiers</Link></Button>
  </div>;
  const dossier = detail.data;
  if (!canUpdate || !dossier.editable) return <div className="grid gap-3">
    <h1 className="text-xl font-semibold">Dossier en lecture seule</h1>
    <Button asChild variant="outline"><Link to={detailUrl}><ArrowLeft className="size-4" />Retour au dossier</Link></Button>
  </div>;

  return <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-5 bg-muted/25 p-3 sm:p-5">
    <header className="border-b border-sky-200 bg-sky-50 px-4 pb-4 pt-2 dark:border-sky-900 dark:bg-sky-950/25">
      <Button variant="ghost" className="mb-3 -ml-3" disabled={update.isPending || coverage.isPending} onClick={() => navigate(returnUrl)}><ArrowLeft className="size-4" />Retour au dossier</Button>
      <h1 className="text-xl font-semibold">{guarantees ? "Modifier les garanties" : "Modifier le dossier"}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span>{dossier.numeroSinistre} · {dossier.couverture.assure}</span><SinistreStatusBadge statut={dossier.statut} /></div>
    </header>
    <section aria-label="Modification du dossier" className="min-w-0 border-y bg-card px-4">
      {!guarantees && managers.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm text-destructive"><span>Chargement des gestionnaires impossible.</span><Button variant="outline" size="sm" onClick={() => managers.refetch()}>Réessayer</Button></div> : null}
      {guarantees ? <CoverageSection
        key={`coverage-${dossier.id}`}
        dossier={dossier}
        assessmentVisible={isAtLeastTransmitted(dossier.statut)}
        editable
        editMode
        saving={coverage.isPending}
        onSave={(request) => coverage.mutateAsync(request)}
        onCancel={() => navigate(returnUrl)}
      /> : <GeneralSection
        key={dossier.id}
        dossier={dossier}
        managers={managers.data ?? []}
        responsibilityVisible={dossier.garanties.some((item) => item.impliquee && item.responsabiliteCivile)}
        editable
        editMode
        saving={update.isPending}
        onSave={(request) => update.mutateAsync(request)}
        onCancel={() => navigate(returnUrl)}
      />}
    </section>
  </div>;
}
