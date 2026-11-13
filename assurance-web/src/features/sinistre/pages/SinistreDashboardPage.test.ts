import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SinistreDashboardPage from "./SinistreDashboardPage";

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (select: (state: { user: { permissions: string[] } }) => unknown) =>
    select({ user: { permissions: auth.permissions } }),
}));

function render() {
  return renderToStaticMarkup(createElement(StaticRouter, { location: "/app/sinistre" },
    createElement(SinistreDashboardPage)));
}

describe("claims module entry page", () => {
  beforeEach(() => { auth.permissions = []; });

  it("provides distinct workflows without loading a dashboard table", () => {
    auth.permissions = ["sinistre:create", "sinistre:view", "sinistre:referentiel"];
    const html = render();
    for (const route of ["declarer", "dossiers", "registre", "statistiques", "prestataires"]) {
      expect(html).toContain(`href="/app/sinistre/${route}"`);
    }
    expect(html).toContain("Module sinistres");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Dossiers récents");
  });

  it("only offers the actions authorized for the user", () => {
    auth.permissions = ["sinistre:create"];
    const html = render();
    expect(html).toContain('href="/app/sinistre/declarer"');
    expect(html).not.toContain('href="/app/sinistre/dossiers"');
    expect(html).not.toContain('href="/app/sinistre/experts"');
    expect(html).not.toContain('href="/app/sinistre/garages"');
    expect(html).not.toContain('href="/app/sinistre/prestataires"');
  });

  it("shows an explicit empty state when no claims action is authorized", () => {
    const html = render();
    expect(html).toContain("Aucune opération autorisée.");
    expect(html).not.toContain("href=");
  });
});
