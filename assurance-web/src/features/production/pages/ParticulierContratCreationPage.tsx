import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { ParticulierContratForm } from "../contrat-creation/ParticulierContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";

export default function ParticulierContratCreationPage() {
  const { draftId } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const categorieClientId = params.get("categorieClientId") ?? undefined;
  const form = useContratCreationForm("PARTICULIER", draftId, {
    prospectionMode: location.pathname.includes("/prospection"),
    renewalMode: location.pathname.includes("/renouvellements/"),
    initialCategorieClientId: categorieClientId,
  });

  return <ParticulierContratForm form={form} />;
}
