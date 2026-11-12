import { useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { foreignResidence, identityDocument, internationalClient, type ClientProfile } from "../client-profile";

export function ClientInternationalToggle({ client, onChange, disabled }: {
  client: ClientProfile;
  onChange: (patch: Partial<ClientProfile>) => void;
  disabled?: boolean;
}) {
  const previous = useRef({ document: identityDocument(client).value,
    country: client.paysResidence ?? "MA", localCity: client.villeId, foreignCity: client.villeEtrangere });
  const physical = client.typeClient === "PERSONNE_PHYSIQUE";
  return <label className="flex items-center gap-2 text-sm font-medium">
    <Checkbox checked={internationalClient(client)} disabled={disabled} onCheckedChange={(checked) => {
      if (!foreignResidence(client)) previous.current.localCity = client.villeId;
      if (checked) {
        const country = physical ? previous.current.country
          : previous.current.country === "MA" ? "" : previous.current.country;
        const document = previous.current.document !== "CIN" || country !== "MA"
          ? previous.current.document
          : client.passport ? "PASSEPORT" : client.carteResidence ? "CARTE_RESIDENCE" : "PASSEPORT";
        onChange({ typePieceIdentite: physical
          ? document : undefined,
        paysResidence: country,
        villeId: country === "MA" ? previous.current.localCity : undefined,
        villeEtrangere: country === "MA" ? undefined : previous.current.foreignCity });
      } else {
        previous.current.document = identityDocument(client).value;
        previous.current.country = client.paysResidence ?? "MA";
        previous.current.foreignCity = client.villeEtrangere;
        onChange({ typePieceIdentite: physical ? "CIN" : undefined, paysResidence: "MA",
          villeId: previous.current.localCity, villeEtrangere: undefined });
      }
    }} />
    Client étranger
  </label>;
}
