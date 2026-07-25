import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ParticulierContratForm } from "../contrat-creation/ParticulierContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";

export default function ParticulierContratCreationPage() {
  const [params] = useSearchParams();
  const form = useContratCreationForm("PARTICULIER");
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
