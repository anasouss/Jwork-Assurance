import { useEffect } from "react";
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

  useEffect(() => {
    if (draftId) {
      return;
    }
    form.applyConventionContext({ compagnieAssuranceId, conventionId, usageId });
  }, [compagnieAssuranceId, conventionId, usageId, form.refs.conventions.data, draftId]);

  return <ConventionContratForm form={form} />;
}
