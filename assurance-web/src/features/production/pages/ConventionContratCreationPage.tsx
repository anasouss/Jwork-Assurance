import { useEffect, useEffectEvent } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { ConventionContratForm } from "../contrat-creation/ConventionContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";

export default function ConventionContratCreationPage() {
  const { draftId } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const form = useContratCreationForm("CONVENTION", draftId, {
    prospectionMode: location.pathname.includes("/prospection"),
    renewalMode: location.pathname.includes("/renouvellements/"),
  });
  const compagnieAssuranceId = params.get("compagnieAssuranceId");
  const conventionId = params.get("conventionId");
  const usageId = params.get("usageId");
  const applyConventionContext = useEffectEvent(() => {
    form.applyConventionContext({ compagnieAssuranceId, conventionId, usageId });
  });

  useEffect(() => {
    if (draftId) {
      return;
    }
    applyConventionContext();
  // `applyConventionContext` is an Effect Event and must not be a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compagnieAssuranceId, conventionId, usageId, form.refs.conventions.data, draftId]);

  return <ConventionContratForm form={form} />;
}
