import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ConventionContratForm } from "../contrat-creation/ConventionContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";

export default function ConventionContratCreationPage() {
  const [params] = useSearchParams();
  const form = useContratCreationForm("CONVENTION");
  const compagnieAssuranceId = params.get("compagnieAssuranceId");
  const conventionId = params.get("conventionId");
  const usageId = params.get("usageId");

  useEffect(() => {
    form.applyConventionContext({ compagnieAssuranceId, conventionId, usageId });
  }, [compagnieAssuranceId, conventionId, usageId, form.refs.conventions.data]);

  return <ConventionContratForm form={form} />;
}
