import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { ClientIdentityFields } from "./ClientIdentityFields";
import { ClientResidenceFields } from "./ClientResidenceFields";
import type { ClientProfile } from "../client-profile";

describe("client profile disclosure", () => {
  const client: ClientProfile = { typeClient: "PERSONNE_PHYSIQUE", cin: "AB123", cinValidite: "2031-01-01" };

  it("shows CIN and validity without an identity selector by default", () => {
    const html = renderToStaticMarkup(createElement(ClientIdentityFields, { client, onChange: () => {} }));
    expect(html).toContain("N° CIN");
    expect(html).toContain("Validité CIN");
    expect(html).toContain('data-state="unchecked"');
    expect(html).not.toContain('data-slot="select-trigger"');
  });

  it("automatically discloses the selector for an existing passport", () => {
    const html = renderToStaticMarkup(createElement(ClientIdentityFields, {
      client: { ...client, typePieceIdentite: "PASSEPORT", passport: "PA123" }, onChange: () => {},
    }));
    expect(html).toContain('data-state="checked"');
    expect(html).toContain('data-slot="select-trigger"');
    expect(html).toContain("Validité passeport");
    expect(html).toContain("PA123");
  });

  function residence(profile: ClientProfile) {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() },
      createElement(ClientResidenceFields, { client: profile, onChange: () => {}, villes: [{ id: "1", libelle: "Agadir" }] })));
  }

  it("hides the country selector for a Moroccan residence", () => {
    const html = residence({ ...client, villeId: "1", paysResidence: "MA" });
    expect(html).not.toContain("Pays de résidence");
    expect(html).toContain('data-state="unchecked"');
    expect(html).toContain("Adresse");
  });

  it("automatically discloses an existing foreign country and city", () => {
    const html = residence({ ...client, paysResidence: "FR", villeEtrangere: "Lyon" });
    expect(html).toContain("Pays de résidence");
    expect(html).toContain('data-state="checked"');
    expect(html).toContain("Lyon");
  });
});
