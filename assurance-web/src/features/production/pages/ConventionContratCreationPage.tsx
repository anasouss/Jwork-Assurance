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
    if (compagnieAssuranceId) {
      form.setCompagnieAssuranceId(compagnieAssuranceId);
    }
    if (conventionId) {
      form.setConventionId(conventionId);
    }
    if (usageId) {
      form.setUsageId(usageId);
    }
  }, [compagnieAssuranceId, conventionId, usageId]);

  return <ConventionContratForm form={form} />;
}
