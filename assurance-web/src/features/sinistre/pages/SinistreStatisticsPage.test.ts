import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SinistreStatisticsPage from "./SinistreStatisticsPage";
import type { SinistreStatistics } from "../types";

const query = vi.hoisted(() => ({ data: undefined as SinistreStatistics | undefined,
  isPending: false, isError: false, isFetching: false, error: null as Error | null, refetch: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => query }));

const empty = (): SinistreStatistics => ({
  annee: 2025, dateSituation: "2026-11-12", anneesDisponibles: [2026, 2025], declares: 0, ouverts: 0,
  clotures: 0, rejetes: 0, actionsEnRetard: 0, delaiMoyenClotureJours: null, provisionsOuvertes: 0,
  reglementsCumules: 0, recoursCumules: 0, fraisCumules: 0, evolution: [], parEtape: [], parBranche: [], parCompagnie: [],
});
const render = () => renderToStaticMarkup(createElement(StaticRouter, { location: "/app/sinistre/statistiques?annee=2025" }, createElement(SinistreStatisticsPage)));

describe("claim statistics", () => {
  beforeEach(() => { Object.assign(query, { data: empty(), isPending: false, isError: false, isFetching: false, error: null }); });

  it("uses real empty states instead of sample charts or invented closure delays", () => {
    const html = render();
    expect(html).toContain("Déclarations 2025");
    expect(html).toContain("Aucun dossier déclaré sur cette année.");
    expect(html).not.toContain("0 jours");
    expect(html).not.toContain("Dossiers récents");
  });

  it("shows meaningful breakdowns and authoritative cumulative amounts", () => {
    query.data = { ...empty(), declares: 8, ouverts: 5, clotures: 2, rejetes: 1, delaiMoyenClotureJours: 3.5,
      reglementsCumules: 1234.5, parCompagnie: [{ id: "1", nom: "MATU", dossiers: 8, provisions: 0, reglements: 1234.5, recours: 0, frais: 0 }] };
    const html = render();
    for (const label of ["Déclarations par mois", "Étapes de suivi", "Répartition par branche", "Situation par compagnie", "MATU", "Règlements cumulés"]) expect(html).toContain(label);
    expect(html).toContain("3,5 jours");
    expect(html).toContain("non annulées");
  });

  it("never presents a failed request as an empty portfolio", () => {
    Object.assign(query, { data: undefined, isError: true, error: new Error("Accès refusé") });
    const html = render();
    expect(html).toContain("Accès refusé");
    expect(html).not.toContain("Aucun dossier déclaré");
  });
});
