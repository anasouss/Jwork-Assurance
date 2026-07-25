import { FlotteContratForm } from "../contrat-creation/FlotteContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";

export default function FlotteContratCreationPage() {
  const form = useContratCreationForm("FLOTTE");

  return <FlotteContratForm form={form} />;
}
