import { useParams } from "react-router-dom";
import { FlotteContratForm } from "../contrat-creation/FlotteContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";

export default function FlotteContratCreationPage() {
  const { draftId } = useParams();
  const form = useContratCreationForm("FLOTTE", draftId);

  return <FlotteContratForm form={form} />;
}
