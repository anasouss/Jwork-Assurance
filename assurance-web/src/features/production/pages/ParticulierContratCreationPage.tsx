import { useEffect } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { ParticulierContratForm } from "../contrat-creation/ParticulierContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";

export default function ParticulierContratCreationPage() {
  const { draftId } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const form = useContratCreationForm("PARTICULIER", draftId, { prospectionMode: location.pathname.includes("/prospection") });
  const categorieClientId = params.get("categorieClientId");

  useEffect(() => {
    if (!categorieClientId) {
      return;
    }
    form.setClients(
      form.clients.map((client) =>
        client.role === "SOUSCRIPTEUR"
          ? { ...client, client: { ...client.client, categorieClientId } }
          : client
      )
    );
  }, [categorieClientId]);

  return <ParticulierContratForm form={form} />;
}
