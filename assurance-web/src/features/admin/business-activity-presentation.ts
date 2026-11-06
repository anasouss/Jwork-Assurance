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
