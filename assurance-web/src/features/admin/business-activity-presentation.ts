import type { ActivityReference, BusinessActivity } from "./business-activity";

export const activityActionVariants = {
  CREATED: "success", SAVED: "info", UPDATED: "info", VALIDATED: "success",
  CANCELLED: "warning", DELETED: "red", ARCHIVED: "gray", REPLACED: "warning",
  ISSUED: "success", RENEWED: "success", IMPORTED: "info", RECALCULATED: "info",
  REMITTED: "info", CONFIRMED: "success", REJECTED: "red", ALLOCATED: "info",
  RECONCILED: "success", TRANSMITTED: "info", OPENED: "info", CLOSED: "gray",
  RESTORED: "success", ASSIGNED: "info", UNASSIGNED: "warning", SELECTED: "info",
  CONTEXT_CHANGED: "gray",
} as const satisfies Record<BusinessActivity["action"], string>;

const referenceLabels: Record<string, string> = {
  CONTRAT: "Dossiers", MOUVEMENT_CONTRAT: "Mouvements", AVENANT_BROUILLON: "Avenants en préparation",
  VEHICULE: "Véhicules", REMORQUE: "Remorques", GARANTIE: "Garanties", ASSISTANCE: "Assistances",
  COMPAGNIE_ASSISTANCE: "Compagnies d’assistance", PRODUIT_ASSISTANCE: "Produits d’assistance",
  TARIF_ASSISTANCE: "Tarifs d’assistance", CARTE_VERTE: "Cartes vertes", CLIENT: "Clients",
  GROUPE_CLIENT: "Groupes clients", ORIGINE_COMMERCIALE: "Origines commerciales",
  CONDITION_PAIEMENT: "Conditions de paiement", DOCUMENT_CLIENT: "Relevés et factures",
  PIECE_JOINTE: "Documents", TYPE_DOCUMENT: "Types de documents", POLITIQUE_DOCUMENT: "Règles documentaires",
  QUITTANCE: "Quittances", ELEMENT_FACTURABLE: "Écritures à facturer",
  ECHEANCE_FACTURATION_CONVENTION: "Échéances de facturation", QUITTANCE_PRIME: "Quittances de prime",
  REGLEMENT_CLIENT: "Règlements clients", INSTRUMENT_REGLEMENT: "Moyens de règlement clients",
  INSTRUMENT_REGLEMENT_COMPAGNIE: "Moyens de règlement compagnies", BORDEREAU_BANCAIRE: "Bordereaux bancaires",
  REJET_BANCAIRE: "Rejets bancaires", COMPTE_TRESORERIE: "Comptes de trésorerie",
  OPERATION_TRESORERIE: "Opérations de trésorerie", MOUVEMENT_TRESORERIE: "Mouvements de trésorerie",
  RELEVE_BANCAIRE: "Relevés bancaires", SESSION_CAISSE: "Sessions de caisse",
  BORDEREAU_COMPAGNIE: "Bordereaux compagnies", REGLEMENT_COMPAGNIE: "Règlements compagnies",
  TIERS_COMPAGNIE: "Tiers compagnies", AFFECTATION_QUITTANCE_COMPAGNIE: "Affectations de quittances",
  REGLE_AFFECTATION_QUITTANCE: "Règles d’affectation", FACTURATION_CONVENTION: "Facturations conventions",
  SINISTRE: "Sinistres", EVENEMENT_SINISTRE: "Événements du sinistre", GARANTIE_SINISTRE: "Garanties du sinistre",
  PARTIE_SINISTRE: "Parties impliquées", MISSION_EXPERTISE: "Missions d’expertise",
  PROVISION_SINISTRE: "Provisions", OPERATION_SINISTRE: "Opérations du sinistre",
  DOCUMENT_SINISTRE: "Documents du sinistre", EXPERT_SINISTRE: "Experts", GARAGE_SINISTRE: "Garages",
  INTERVENANT_SINISTRE: "Intervenants", ATTESTATION: "Attestations", LIVRAISON_ATTESTATIONS: "Livraisons d’attestations",
  LOT_ATTESTATIONS: "Lots d’attestations", SEUIL_STOCK_ATTESTATION: "Seuils de stock",
  COMPAGNIE: "Compagnies", AGENCE_COMPAGNIE_ASSURANCE: "Agences compagnies",
  CODE_PROMO_ASSISTANCE: "Codes promotionnels", CONTACT_COMPAGNIE: "Contacts compagnies",
  BANQUE: "Banques", REGLE_FISCALE: "Règles fiscales", TARIF_USAGE: "Tarifs par usage",
  AJUSTEMENT_TARIF_USAGE: "Ajustements tarifaires", USAGE: "Usages", CONFIGURATION_USAGES: "Configurations des usages",
  MARQUE: "Marques", CARROSSERIE: "Carrosseries", CARBURANT: "Carburants", SOUS_CLASSE: "Sous-classes",
  CATEGORIE_CLIENT: "Catégories clients", CATEGORIE_TRANSPORT: "Catégories de transport",
  GROUPE_USAGE_ATTESTATION: "Groupes d’usage", GROUPE_EXCLUSION_GARANTIE: "Groupes d’exclusion",
  CONVENTION: "Conventions", GRILLE_TARIFAIRE: "Grilles tarifaires", LIGNE_GRILLE_TARIFAIRE: "Tarifs des garanties",
  FORMULE_GARANTIE_PERSONNE: "Formules de protection", REFERENTIEL: "Référentiels",
  UTILISATEUR: "Utilisateurs", ROLE: "Rôles", AGENCE: "Agences", PARAMETRE: "Paramètres",
};

export function groupActivityReferences(event: BusinessActivity) {
  const groups = new Map<string, { type: string; label: string; references: ActivityReference[] }>();
  const seen = new Set([`${event.subject.type}:${event.subject.id}`]);
  for (const reference of event.references) {
    const identity = `${reference.type}:${reference.id}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const group = groups.get(reference.type) ?? {
      type: reference.type, label: referenceLabels[reference.type] ?? "Autres références", references: [],
    };
    group.references.push(reference);
    groups.set(reference.type, group);
  }
  return [...groups.values()];
}

type Change = BusinessActivity["changes"][number];

export function groupActivityChanges(changes: Change[]) {
  const groups = new Map<string, { title: string; changes: Change[] }>();
  for (const change of changes) {
    // Snapshot labels use " - " to separate an item from its field name.
    const separator = change.label.lastIndexOf(" - ");
    const title = separator < 0 ? "Informations générales" : change.label.slice(0, separator);
    const group = groups.get(title) ?? { title, changes: [] };
    group.changes.push({ ...change, label: separator < 0 ? change.label : change.label.slice(separator + 3) });
    groups.set(title, group);
  }
  return [...groups.values()].map(group => ({
    ...group,
    mode: group.changes.every(change => change.beforeValue == null) ? "added" as const
      : group.changes.every(change => change.afterValue == null) ? "removed" as const : "compared" as const,
  }));
}

export type ActivityChangeGroup = ReturnType<typeof groupActivityChanges>[number];
type ChangeSection = { title: string; kind: "fields" | "vehicle" | "person" | "guarantees" | "quittance"; groups: ActivityChangeGroup[] };

const personFields = new Set(["Deces", "Décès", "Invalidite", "Invalidité", "Frais medicaux", "Frais médicaux", "Hospitalisation", "Frais funeraires", "Frais funéraires", "Chirurgie", "Personne assuree"]);
const guaranteeFields = new Set(["Couverture", "Selection", "Mode de tarification", "Base assuree", "Capital", "Valeur assuree", "Valeur venale", "Valeur a neuf", "Valeur glace", "Prime", "Taux", "Franchise", "Franchise minimale", "Formule", "Accessoire", "Accessoires", ...personFields]);

export function activityChangeSections(changes: Change[], module: BusinessActivity["module"]) {
  const sections: ChangeSection[] = [];
  const groups = groupActivityChanges(changes);
  const target = (title: string) => title.slice(title.lastIndexOf(" (") + 2, -1);
  const vehicleTargets = new Set(groups.filter(group => / \(.+\)$/.test(group.title)
    && group.changes.some(change => change.label === "Base assuree"
      && [change.beforeValue, change.afterValue].some(value => ["Valeur venale", "Valeur a neuf", "Valeur glace"].includes(value ?? ""))))
    .map(group => target(group.title)));
  for (const group of groups) {
    let kind: ChangeSection["kind"] = "fields";
    let title = group.title;
    if (module === "PRODUCTION") {
      if (group.title === "Quittance" || group.title.startsWith("Quittance - ")) {
        kind = "quittance";
        title = "Quittance";
      } else if (/ \(.+\)$/.test(group.title) && group.changes.some(change => guaranteeFields.has(change.label))) {
        const protection = group.changes.some(change => personFields.has(change.label)
          || (change.label === "Mode de tarification" && [change.beforeValue, change.afterValue].includes("Protection")));
        const vehicle = vehicleTargets.has(target(group.title));
        kind = protection ? "person" : vehicle ? "vehicle" : "guarantees";
        title = protection ? "Garanties des personnes" : vehicle ? "Garanties véhicule" : "Garanties";
      }
    }
    const section = kind === "fields" ? undefined : sections.find(item => item.kind === kind);
    if (section) section.groups.push(group);
    else sections.push({ title, kind, groups: [group] });
  }
  if (module === "PRODUCTION") {
    const rank = (section: ChangeSection) => section.kind === "quittance" ? 6
      : section.kind === "vehicle" ? 2 : section.kind === "person" ? 3 : section.kind === "guarantees" ? 4
        : section.title === "Informations générales" ? 0 : /^(V[eé]hicule|Remorque) \d+$/.test(section.title) ? 1 : 5;
    sections.sort((first, second) => rank(first) - rank(second));
    const quittance = sections.find(section => section.kind === "quittance");
    const order = ["Quittance", "Quittance - Automobile", "Quittance - Corporel", "Quittance - EVCAT"];
    quittance?.groups.sort((first, second) => {
      const firstIndex = order.indexOf(first.title);
      const secondIndex = order.indexOf(second.title);
      return (firstIndex < 0 ? order.length : firstIndex) - (secondIndex < 0 ? order.length : secondIndex);
    });
  }
  return sections;
}

export function guaranteeSummaryFields(group: ActivityChangeGroup, person: boolean) {
  const columns = person
    ? [["Deces", "Décès"], ["Invalidite", "Invalidité"], ["Frais medicaux", "Frais médicaux"], ["Prime"]]
    : [["Valeur assuree", "Capital"], ["Franchise"], ["Franchise minimale"], ["Prime"]];
  const summary = columns.map(labels => labels.map(label => group.changes.find(change => change.label === label)).find(Boolean));
  const selected = new Set(summary.filter(change => change != null));
  return { summary, additional: group.changes.filter(change => !selected.has(change)) };
}
