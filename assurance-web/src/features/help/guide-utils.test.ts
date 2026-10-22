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
    ["/app/production/contrats/12/pieces-jointes", "pieces-jointes-contrat"],
    ["/app/production/contrats/12/assistance", "assistance-contrat"],
    ["/app/production/contrats/12/cartes-vertes", "cartes-vertes-contrat"],
    ["/app/production/ajouter-dossier/assistance-voyage", "assistance-voyage"],
    ["/app/production/ajouter-dossier/assistance-automobile", "assistance-automobile"],
    ["/app/production/contrats/12/assistance-voyage/modifier", "assistance-voyage"],
    ["/app/production/contrats/12/assistance-automobile/modifier", "assistance-automobile"],
    ["/app/production/echeances", "echeances-production"],
    ["/app/production/registre", "registre-production"],
    ["/app/production/portefeuille-clients/12", "portefeuille-client-production"],
    ["/app/production/parametres/tarifs-usage", "tarifs-usage"],
    ["/app/production/parametres/usages", "usages-production"],
    ["/app/production/parametres/groupes-stock-attestations", "groupes-stock-production"],
    ["/app/production/parametres/categories-client", "categories-client-production"],
    ["/app/production/parametres/garanties", "garanties-production"],
    ["/app/production/parametres/carrosseries", "referentiels-vehicule-production"],
    ["/app/production/parametres/sous-classes", "sous-classes-production"],
    ["/app/production/parametres/categories-transport", "categories-transport-production"],
    ["/app/production/parametres/pieces-jointes", "pieces-jointes-production"],
    ["/app/production/attestations-stock/commandes", "commandes-attestations"],
    ["/app/production/attestations-stock/receptions", "receptions-attestations"],
    ["/app/sinistre/dossiers/12", "gestion-sinistre"],
    ["/app/sinistre/dossiers", "liste-sinistres"],
    ["/app/companies", "companies-navigation"],
    ["/app/companies/contacts", "contacts-compagnies"],
    ["/app/companies/assistance/produits", "produits-assistance-parametres"],
    ["/app/compta/reglements/etat-encaissements", "etat-encaissements"],
    ["/app/compta/tresorerie/impayes-clients", "impayes-clients"],
    ["/app/compta/tresorerie/journal", "journal-tresorerie"],
    ["/app/compta/tresorerie/operations", "operations-tresorerie"],
    ["/app/compta/parametres/banques", "banques-compta"],
    ["/app/compta/parametres/reglements-clients", "reglages-reglements-clients"],
  ])("maps %s to the specific topic %s", (route, topicId) => {
    expect(findContextualGuideTopic(guideModules, route)?.id).toBe(topicId);
  });

  it("searches accents and procedural content", () => {
    const modules = searchGuideModules(guideModules, "regle deja appliquee");
    expect(modules.flatMap((module) => module.topics).map((topic) => topic.id)).toContain("regles-fiscales");
  });

  it("searches alternative contract paths", () => {
    const modules = searchGuideModules(guideModules, "flotte entreprise");
    expect(modules.flatMap((module) => module.topics).map((topic) => topic.id)).toContain("creation-contrat");
  });

  it("links every alternative path to an existing topic", () => {
    const topics = guideModules.flatMap((module) => module.topics);
    const topicIds = new Set(topics.map((topic) => topic.id));
    topics.flatMap((topic) => topic.paths ?? []).forEach((path) => {
      if (path.topicId) expect(topicIds.has(path.topicId), path.topicId).toBe(true);
    });
  });

  it.each([
    ["production-navigation", ["Ajouter un dossier", "Liste des dossiers", "Gestion des échéances", "Registre de production", "Portefeuille client", "Prospection", "Gestion du stock", "Paramètres"]],
    ["creation-contrat", ["Assurance", "Automobile", "Risques divers", "Flotte entreprise", "Particulier", "Convention", "Assistance voyage", "Assistance automobile", "Compagnie d’assistance", "Produit", "Ajouter reste désactivé"]],
    ["contrat-particulier", ["Souscripteur", "Propriétaire", "Contrat", "Véhicule", "Garanties", "Quittance générale", "Créer contrat"]],
    ["contrat-flotte", ["Souscripteur", "Propriétaire", "Contrat", "Grille tarifaire", "Véhicules", "Remorques", "Importer Excel", "Exporter Excel", "Quittance générale", "Créer contrat"]],
    ["contrat-convention", ["Souscripteur", "Propriétaire", "Contrat", "Véhicule", "Garanties", "Quittance générale", "Bulletin", "Créer contrat"]],
    ["assistance-voyage", ["Souscripteur", "Personnes assurées", "Contrat", "Ajouter un assuré", "Prime nette", "Prime TTC", "Créer le dossier"]],
    ["assistance-automobile", ["Souscripteur", "Assuré", "Véhicule assuré", "Produit d’assistance", "Prime nette", "Créer le dossier"]],
    ["companies-navigation", ["Liste des compagnies", "Conventions", "Grilles tarifaires", "Assistance", "Produits assistance", "Contacts"]],
    ["compta-navigation", ["Affectation des quittances", "Relevés et factures", "Facturation conventions", "Règlements clients", "Encaissements en attente", "Bordereaux bancaires", "Journal de trésorerie", "Rejets bancaires", "Bordereaux compagnies"]],
    ["sinistres-liste", ["Dossiers ouverts", "Actions en retard", "En expertise", "En attente de règlement", "Provisions ouvertes", "Recours de l’année", "Voir les dossiers", "Déclarer", "Experts & garages"]],
    ["tarifs-usage", ["Ajouter tarif usage", "Ajuster les tarifs", "Réinitialiser", "Paramétrer par usage", "Historique", "Prime nette", "Prime par place"]],
    ["usages-production", ["Code", "Libellé", "Critère", "Groupe attestation", "Consomme attestation", "Carburant", "Puissance fiscale", "Sous-classe", "PTC", "Places / prime", "Catégorie transport", "Garanties personne"]],
    ["garanties-production", ["Groupe d’exclusion", "Branche", "Type", "Traitement métier", "Modes", "Valeur assurée", "Prorata"]],
    ["stock-attestations", ["Total validé", "Disponible", "Réservée", "Utilisée", "Alertes seuil", "Contrôle à la saisie"]],
  ])("documents every visible entry action in %s", (topicId, labels) => {
    const topic = guideModules.flatMap((module) => module.topics).find((item) => item.id === topicId);
    const documentation = JSON.stringify(topic);
    labels.forEach((label) => expect(documentation).toContain(label));
  });

  it.each([
    "/app",
    "/app/aide",
    "/app/platform",
    "/app/profile",
    "/app/production",
    "/app/production/ajouter-dossier",
    "/app/production/ajouter-dossier/assistance-voyage",
    "/app/production/ajouter-dossier/assistance-automobile",
    "/app/production/prospection",
    "/app/production/prospection/ajouter-devis",
    "/app/production/prospection/devis/flotte/12",
    "/app/production/ajouter-dossier/particulier",
    "/app/production/ajouter-dossier/particulier/12",
    "/app/production/ajouter-dossier/flotte",
    "/app/production/ajouter-dossier/flotte/12",
    "/app/production/ajouter-dossier/convention",
    "/app/production/ajouter-dossier/convention/12",
    "/app/production/renouvellements/particulier/12",
    "/app/production/renouvellements/convention/12",
    "/app/production/renouvellements/flotte/12",
    "/app/production/contrats",
    "/app/production/registre",
    "/app/production/contrats/12",
    "/app/production/contrats/12/pdf",
    "/app/production/portefeuille-clients/12",
    "/app/production/contrats/12/avenants/RESILIATION",
    "/app/production/echeances",
    "/app/production/contrats/12/pieces-jointes",
    "/app/production/contrats/12/assistance",
    "/app/production/contrats/12/cartes-vertes",
    "/app/production/attestations-stock",
    "/app/production/attestations-stock/commandes",
    "/app/production/attestations-stock/receptions",
    "/app/production/parametres",
    "/app/production/parametres/tarifs-usage",
    "/app/production/parametres/usages",
    "/app/production/parametres/groupes-stock-attestations",
    "/app/production/parametres/categories-client",
    "/app/production/parametres/garanties",
    "/app/production/parametres/marques",
    "/app/production/parametres/carrosseries",
    "/app/production/parametres/carburants",
    "/app/production/parametres/sous-classes",
    "/app/production/parametres/categories-transport",
    "/app/production/parametres/pieces-jointes",
    "/app/production/parametres/regles-fiscales",
    "/app/sinistre",
    "/app/sinistre/dossiers",
    "/app/sinistre/dossiers/12",
    "/app/sinistre/declarer",
    "/app/sinistre/referentiels",
    "/app/companies",
    "/app/companies/liste",
    "/app/companies/conventions",
    "/app/companies/grilles-tarifaires",
    "/app/companies/contacts",
    "/app/companies/assistance",
    "/app/companies/assistance/produits",
    "/app/crm",
    "/app/crm/parametres",
    "/app/crm/parametres/origines-commerciales",
    "/app/compta",
    "/app/compta/parametres",
    "/app/compta/quittances",
    "/app/compta/releves-factures",
    "/app/compta/facturation-conventions",
    "/app/compta/reglements",
    "/app/compta/reglements/nouveau",
    "/app/compta/reglements/historique",
    "/app/compta/reglements/etat-encaissements",
    "/app/compta/reglements/12",
    "/app/compta/reglements/12/modifier",
    "/app/compta/bordereaux-compagnies",
    "/app/compta/bordereaux-compagnies/nouveau",
    "/app/compta/bordereaux-compagnies/reglement",
    "/app/compta/bordereaux-compagnies/12",
    "/app/compta/bordereaux-compagnies/12/modifier",
    "/app/compta/tresorerie/comptes",
    "/app/compta/tresorerie/comptes/12",
    "/app/compta/tresorerie/encaissements-en-attente",
    "/app/compta/tresorerie/impayes-clients",
    "/app/compta/tresorerie/bordereaux-remise/12",
    "/app/compta/tresorerie/bordereaux-remise/nouveau",
    "/app/compta/tresorerie/journal",
    "/app/compta/tresorerie/rapprochement-bancaire",
    "/app/compta/tresorerie/operations",
    "/app/compta/parametres/banques",
    "/app/compta/parametres/reglements-clients",
    "/app/admin",
    "/app/admin/utilisateurs",
    "/app/admin/roles",
    "/app/admin/roles/12",
    "/app/admin/audit",
    "/app/admin/agence",
    "/app/admin/agences",
    "/app/admin/administrateurs-plateforme",
  ])("maps the active route %s to a guide topic", (route) => {
    const topic = findContextualGuideTopic(guideModules, route);
    expect(topic, route).not.toBeNull();
    if (route !== "/app") {
      expect(topic?.id, route).not.toBe("dashboard-agence");
    }
  });
});
