import { useEffect, useEffectEvent } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { ParticulierContratForm } from "../contrat-creation/ParticulierContratForm";
import { useContratCreationForm } from "../contrat-creation/useContratCreationForm";

export default function ParticulierContratCreationPage() {
  const { draftId } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const form = useContratCreationForm("PARTICULIER", draftId, {
    prospectionMode: location.pathname.includes("/prospection"),
    renewalMode: location.pathname.includes("/renouvellements/"),
  });
  const categorieClientId = params.get("categorieClientId");
  const applyCategorieClient = useEffectEvent(() => {
    form.setClients((current) => {
      const souscripteur = current.find((client) => client.role === "SOUSCRIPTEUR");
      if (souscripteur?.client.categorieClientId) {
        return current;
      }
      return current.map((client) =>
        client.role === "SOUSCRIPTEUR"
          ? { ...client, client: { ...client.client, categorieClientId: categorieClientId ?? undefined } }
          : client
      );
    });
  });

  useEffect(() => {
    if (!categorieClientId || form.initialLoading) {
      return;
    }
    applyCategorieClient();
  // `applyCategorieClient` is an Effect Event and must not be a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorieClientId, form.initialLoading]);

  return <ParticulierContratForm form={form} />;
}
