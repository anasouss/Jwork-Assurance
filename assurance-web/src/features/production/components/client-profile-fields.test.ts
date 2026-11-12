import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { ClientIdentityFields } from "./ClientIdentityFields";
import { ClientResidenceFields } from "./ClientResidenceFields";
import { ClientInternationalToggle } from "./ClientInternationalToggle";
import type { ClientProfile } from "../client-profile";

describe("client profile disclosure", () => {
  const client: ClientProfile = { typeClient: "PERSONNE_PHYSIQUE", cin: "AB123", cinValidite: "2031-01-01" };

  it("shows CIN and validity without an identity selector by default", () => {
    const html = renderToStaticMarkup(createElement(ClientIdentityFields, { client, onChange: () => {} }));
    expect(html).toContain("N° CIN");
    expect(html).toContain("Validité CIN");
    expect(html).not.toContain('role="checkbox"');
    expect(html).not.toContain('data-slot="select-trigger"');
  });

  it("automatically discloses the selector for an existing passport", () => {
    const html = renderToStaticMarkup(createElement(ClientIdentityFields, {
      client: { ...client, typePieceIdentite: "PASSEPORT", passport: "PA123" }, onChange: () => {},
    }));
    expect(html).not.toContain('role="checkbox"');
    expect(html).toContain('data-slot="select-trigger"');
    expect(html).toContain("Validité passeport");
    expect(html).toContain("PA123");
  });

  function residence(profile: ClientProfile) {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["referentiel", "pays"], [{ id: "MA", libelle: "Maroc" }, { id: "FR", libelle: "France" }]);
    return renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient },
      createElement(ClientResidenceFields, { client: profile, onChange: () => {}, villes: [{ id: "1", libelle: "Agadir" }] })));
  }

  it("hides the country selector for a Moroccan residence", () => {
    const html = residence({ ...client, villeId: "1", paysResidence: "MA" });
    expect(html).not.toContain("Pays de résidence");
    expect(html).not.toContain('role="checkbox"');
    expect(html).toContain("Adresse");
  });

  it("automatically discloses an existing foreign country and city", () => {
    const html = residence({ ...client, paysResidence: "FR", villeEtrangere: "Lyon" });
    expect(html).toContain("Pays de résidence");
    expect(html).not.toContain('role="checkbox"');
    expect(html).toContain("Lyon");
  });

  it("keeps Morocco and its reference-city selector available in expanded mode", () => {
    const html = residence({ ...client, typePieceIdentite: "PASSEPORT", paysResidence: "MA", villeId: "1" });
    expect(html).toContain("Pays de résidence");
    expect(html).toContain("Maroc");
    expect(html).toContain("Agadir");
    expect(html).not.toContain("Ville à l");
  });

  it("renders a single foreign-client checkbox beside the heading", () => {
    const html = renderToStaticMarkup(createElement("section", null,
      createElement("header", null, "Identité souscripteur", createElement(ClientInternationalToggle, { client, onChange: () => {} })),
      createElement(ClientIdentityFields, { client, onChange: () => {} })));
    expect(html.match(/role="checkbox"/g)).toHaveLength(1);
    expect(html).toContain("Client étranger");
    expect(html).toContain('data-state="unchecked"');
  });

  it("initializes the heading checkbox from saved passport details", () => {
    const html = renderToStaticMarkup(createElement(ClientInternationalToggle, {
      client: { ...client, typePieceIdentite: "PASSEPORT", paysResidence: "MA" }, onChange: () => {},
    }));
    expect(html).toContain('data-state="checked"');
  });

  it("keeps the selector and checkbox visible when a foreign client selects CIN", () => {
    const profile: ClientProfile = { ...client, clientEtranger: true, typePieceIdentite: "CIN", paysResidence: "MA" };
    const fields = renderToStaticMarkup(createElement(ClientIdentityFields, { client: profile, onChange: () => {} }));
    const toggle = renderToStaticMarkup(createElement(ClientInternationalToggle, { client: profile, onChange: () => {} }));
    expect(fields).toContain('data-slot="select-trigger"');
    expect(fields).toContain("N° CIN");
    expect(fields).toContain("Validité CIN");
    expect(toggle).toContain('data-state="checked"');
  });
});
