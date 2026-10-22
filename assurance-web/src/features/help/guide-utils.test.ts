import { describe, expect, it } from "vitest";
import { guideModules } from "./guide-content";
import { accessibleGuideModules, findContextualGuideTopic, searchGuideModules } from "./guide-utils";

describe("guide utilities", () => {
  it("filters topics with the current user's permissions", () => {
    const modules = accessibleGuideModules(guideModules, ["audit:view"]);
    expect(modules.flatMap((module) => module.topics).map((topic) => topic.id)).toContain("audit");
    expect(modules.flatMap((module) => module.topics).map((topic) => topic.id)).not.toContain("contrat-flotte");
  });

  it("selects the most specific topic for a nested route", () => {
    const topic = findContextualGuideTopic(guideModules, "/app/production/parametres/regles-fiscales");
    expect(topic?.id).toBe("regles-fiscales");
  });

  it.each([
    ["/app/production/contrats/12", "detail-contrat"],
    ["/app/production/contrats/12/pdf", "detail-contrat"],
    ["/app/production/contrats/12/avenants/RESILIATION", "avenants-renouvellements"],
    ["/app/production/contrats/12/pieces-jointes", "documents-assistance"],
    ["/app/production/contrats/12/assistance", "documents-assistance"],
    ["/app/production/contrats/12/cartes-vertes", "documents-assistance"],
    ["/app/production/contrats/12/assistance-voyage/modifier", "creation-contrat"],
    ["/app/production/contrats/12/assistance-automobile/modifier", "creation-contrat"],
    ["/app/sinistre/dossiers/12", "gestion-sinistre"],
  ])("maps %s to the specific topic %s", (route, topicId) => {
    expect(findContextualGuideTopic(guideModules, route)?.id).toBe(topicId);
  });

  it("searches accents and procedural content", () => {
    const modules = searchGuideModules(guideModules, "regle deja appliquee");
    expect(modules.flatMap((module) => module.topics).map((topic) => topic.id)).toContain("regles-fiscales");
  });

  it.each([
    "/app",
    "/app/platform",
    "/app/profile",
    "/app/production",
    "/app/production/ajouter-dossier",
    "/app/production/ajouter-dossier/assistance-voyage",
    "/app/production/ajouter-dossier/assistance-automobile",
    "/app/production/prospection",
    "/app/production/prospection/devis/flotte/12",
    "/app/production/ajouter-dossier/particulier/12",
    "/app/production/ajouter-dossier/flotte/12",
    "/app/production/ajouter-dossier/convention/12",
    "/app/production/renouvellements/flotte/12",
    "/app/production/contrats",
    "/app/production/registre",
    "/app/production/contrats/12",
    "/app/production/echeances",
    "/app/production/attestations-stock/receptions",
    "/app/production/parametres/regles-fiscales",
    "/app/sinistre",
    "/app/sinistre/dossiers/12",
    "/app/sinistre/declarer",
    "/app/sinistre/referentiels",
    "/app/companies",
    "/app/companies/conventions",
    "/app/companies/grilles-tarifaires",
    "/app/companies/assistance/produits",
    "/app/crm",
    "/app/crm/parametres/origines-commerciales",
    "/app/compta",
    "/app/compta/quittances",
    "/app/compta/releves-factures",
    "/app/compta/facturation-conventions",
    "/app/compta/reglements/nouveau",
    "/app/compta/reglements/historique",
    "/app/compta/reglements/etat-encaissements",
    "/app/compta/bordereaux-compagnies/12",
    "/app/compta/tresorerie/comptes/12",
    "/app/compta/tresorerie/encaissements-en-attente",
    "/app/compta/tresorerie/impayes-clients",
    "/app/compta/tresorerie/bordereaux-remise/12",
    "/app/compta/tresorerie/journal",
    "/app/compta/tresorerie/rapprochement-bancaire",
    "/app/compta/tresorerie/operations",
    "/app/compta/parametres/banques",
    "/app/admin/utilisateurs",
    "/app/admin/roles/12",
    "/app/admin/audit",
    "/app/admin/agence",
    "/app/admin/administrateurs-plateforme",
  ])("maps the active route %s to a guide topic", (route) => {
    expect(findContextualGuideTopic(guideModules, route), route).not.toBeNull();
  });
});
