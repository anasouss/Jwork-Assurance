import { useLocation, useParams } from "react-router-dom";
import { FlotteContratForm } from "../contrat-creation/FlotteContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";

export default function FlotteContratCreationPage() {
  const { draftId } = useParams();
  const location = useLocation();
  const form = useContratCreationForm("FLOTTE", draftId, {
    prospectionMode: location.pathname.includes("/prospection"),
    renewalMode: location.pathname.includes("/renouvellements/"),
  });

  return <FlotteContratForm form={form} />;
}
