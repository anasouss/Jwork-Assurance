package com.assurance.security;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Assignable business capabilities. Labels are metadata, never authorization aliases.
 */
public final class PermissionCatalog {
    private static final Map<String, Definition> DEFINITIONS = build();

    private PermissionCatalog() {
    }

    public static List<Definition> definitions() {
        return List.copyOf(DEFINITIONS.values());
    }

    public static Definition find(String code) {
        return DEFINITIONS.get(code);
    }

    public static boolean contains(String code) {
        return DEFINITIONS.containsKey(code);
    }

    private static Map<String, Definition> build() {
        Map<String, Definition> result = new LinkedHashMap<>();
        resource(result, "production", "contrat", "Contrats", "view,create,update,renew,delete,recalculate-financial-history,import,export");
        resource(result, "production", "avenant", "Avenants", "view,create,update-draft,delete-draft,rectify,delete");
        resource(result, "production", "assistance", "Assistance des contrats", "view,create,update,deactivate");
        resource(result, "production", "carte-verte", "Cartes vertes", "view,create,update,deactivate");
        resource(result, "production", "piece-jointe", "Pièces jointes des contrats", "view,upload,delete");
        resource(result, "production", "attestation-stock", "Stock et réceptions d’attestations", "view,create,receive,validate,cancel,configure");
        resource(result, "production", "vehicule", "Recherche de véhicules", "view");
        resource(result, "production", "garantie", "Garanties", "view,create,update");
        resource(result, "production", "regle-fiscale", "Règles fiscales", "view,create,update,deactivate");
        resource(result, "production", "usage", "Usages", "view,create,update");
        resource(result, "production", "marque", "Marques", "view,create,update");
        resource(result, "production", "carrosserie", "Carrosseries", "view,create,update");
        resource(result, "production", "carburant", "Carburants", "view,create,update");
        resource(result, "production", "sous-classe", "Sous-classes", "view,create,update");
        resource(result, "production", "categorie-transport", "Catégories de transport", "view,create,update");
        resource(result, "production", "categorie-client", "Catégories client", "view,create,update");
        resource(result, "production", "groupe-usage-attestation", "Groupes de stock d’attestations", "view,create,update");
        resource(result, "production", "tarif-usage", "Tarifs par usage", "view,create,update,delete,adjust");
        resource(result, "production", "type-piece-jointe", "Paramètres des pièces jointes", "view,create,update,deactivate");
        resource(result, "sinistre", "sinistre", "Dossiers sinistre", "view,create,update,transition,delete");
        resource(result, "sinistre", "sinistre-document", "Pièces du dossier sinistre", "upload,update,delete");
        resource(result, "sinistre", "sinistre-mission", "Missions d’expertise", "create,update");
        resource(result, "sinistre", "sinistre-provision", "Provisions des sinistres", "create");
        resource(result, "sinistre", "sinistre-operation", "Opérations financières des sinistres", "create,cancel");
        resource(result, "sinistre", "prestataire-sinistre", "Experts et garages", "view,create,update");
        resource(result, "sinistre", "specialite-prestataire", "Spécialités des prestataires", "view,create,update");
        resource(result, "companies", "compagnie-assurance", "Compagnies d’assurance", "view,create,update");
        resource(result, "companies", "compagnie-assistance", "Compagnies d’assistance", "view,create,update,deactivate");
        resource(result, "companies", "convention", "Configuration des conventions", "view,create,update");
        resource(result, "companies", "grille-tarifaire", "Grilles tarifaires et formules", "view,create,update");
        resource(result, "companies", "contact-compagnie", "Contacts compagnie", "view,create,update,deactivate");
        resource(result, "companies", "produit-assistance", "Produits d’assistance", "view,create,update,deactivate,delete");
        resource(result, "companies", "tarif-assistance", "Tarifs des produits d’assistance", "view,create,update,delete");
        resource(result, "companies", "promo-assistance", "Codes promotionnels d’assistance", "view,create,update,delete");
        resource(result, "crm", "client", "Clients", "view,create,update");
        resource(result, "crm", "client-portal-account", "Comptes du portail client", "view,create,deactivate,reset-password,assign");
        resource(result, "crm", "client-portal-publication", "Publications du portail client", "view,create,deactivate");
        resource(result, "crm", "groupe-client", "Groupes de clients", "view,create,update,assign,end-membership");
        resource(result, "crm", "origine-commerciale", "Origines commerciales", "view,create,update");
        resource(result, "crm", "acquisition-client", "Acquisition client", "update");
        resource(result, "crm", "condition-paiement", "Conditions de paiement des clients", "view,create");
        resource(result, "crm", "document-crm", "Documents des clients", "view,upload,delete");
        resource(result, "compta", "quittance-affectation", "Affectation des quittances compagnie", "view,update,delete,import,export");
        resource(result, "compta", "regle-quittance", "Règles d’affectation des quittances", "view,create,update,delete");
        resource(result, "compta", "document-client", "Relevés et factures clients", "view,issue,revise,cancel,delete");
        resource(result, "compta", "production-convention", "États de production des conventions", "view,export");
        resource(result, "compta", "facture-convention", "Factures des conventions", "view,issue,revise,cancel,delete");
        resource(result, "compta", "reglement-client", "Règlements clients et conventions", "view,create,refund,cancel,adjust,configure");
        resource(result, "compta", "instrument-reglement", "Moyens de règlement et rejets", "view,confirm,reject,replace,represent,followup");
        resource(result, "compta", "quittance-prime", "Quittances de prime", "view,issue,delete");
        resource(result, "compta", "compte-tresorerie", "Comptes de trésorerie", "view,create,update,configure-access");
        resource(result, "compta", "operation-tresorerie", "Opérations et journal de trésorerie", "view,transfer,adjust,cancel");
        resource(result, "compta", "session-caisse", "Sessions de caisse", "view,open,close");
        resource(result, "compta", "bordereau-remise", "Bordereaux bancaires", "view,create,update,deposit,confirm,reject,delete");
        resource(result, "compta", "rapprochement-bancaire", "Rapprochement bancaire", "view,import,update,validate");
        resource(result, "compta", "banque", "Paramètres des banques", "view,create,update");
        resource(result, "compta", "bordereau-compagnie", "Bordereaux compagnies", "view,create,update,validate,transmit,reconcile,cancel");
        resource(result, "compta", "reglement-compagnie", "Règlements compagnies", "view,create,confirm,reject,cancel");
        resource(result, "administration", "user", "Utilisateurs de l’agence", "view,create,update,deactivate,reset-password,revoke-session,assign-role");
        resource(result, "administration", "role", "Rôles et permissions", "view,create,update,delete,assign-permissions");
        resource(result, "administration", "audit", "Audit technique", "view");
        resource(result, "administration", "activity", "Activité métier", "view");
        resource(result, "administration", "agence", "Agence", "view,create,update,manage-self");
        resource(result, "administration", "config", "Administration de la plateforme", "view,manage");
        return Map.copyOf(result);
    }

    private static void resource(Map<String, Definition> result, String module, String resource,
                                 String resourceLabel, String actions) {
        for (String action : actions.split(",")) {
            String code = resource + ":" + action;
            boolean platformOnly = resource.equals("config")
                    || (resource.equals("agence") && !action.equals("manage-self"));
            boolean sensitive = Set.of("delete", "delete-draft", "cancel", "refund", "adjust", "rectify",
                    "recalculate-financial-history", "configure-access", "assign-permissions").contains(action);
            String label = actionLabel(resource, action);
            String description = resourceLabel + " : " + label.toLowerCase(java.util.Locale.FRENCH) + ".";
            if (code.equals("sinistre:view")) {
                description = "Consulter le dossier complet, les documents, missions, provisions et opérations.";
            }
            if (sensitive) {
                description += " Action sensible ; les contrôles d’agence et d’éligibilité restent obligatoires.";
            }
            Definition definition = new Definition(code, label + " · " + resourceLabel, module, resource,
                    resourceLabel, action, label, description, platformOnly, sensitive);
            if (result.put(code, definition) != null) {
                throw new IllegalStateException("Duplicate permission: " + code);
            }
        }
    }

    private static String actionLabel(String resource, String action) {
        if (resource.equals("client-portal-account") && action.equals("assign")) return "Partager ou retirer un dossier";
        if (resource.equals("client-portal-publication") && action.equals("create")) return "Publier un document ou un suivi";
        if (resource.equals("client-portal-publication") && action.equals("deactivate")) return "Retirer une publication";
        if (resource.equals("contrat") && action.equals("import")) return "Importer les véhicules Excel";
        if (resource.equals("contrat") && action.equals("export")) return "Exporter les véhicules Excel";
        if (resource.equals("contrat") && action.equals("delete")) return "Supprimer un contrat brouillon";
        if (resource.equals("avenant") && action.equals("delete")) return "Supprimer le dernier avenant";
        if (resource.equals("tarif-usage") && action.equals("adjust")) return "Ajuster les primes nettes";
        if ((resource.equals("document-client") || resource.equals("facture-convention")) && action.equals("delete")) {
            return "Supprimer définitivement une facture éligible";
        }
        return switch (action) {
            case "view" -> "Consulter";
            case "create" -> "Créer";
            case "update" -> "Modifier";
            case "renew" -> "Renouveler";
            case "delete" -> "Supprimer";
            case "recalculate-financial-history" -> "Recalculer l’historique financier";
            case "update-draft" -> "Modifier un brouillon";
            case "delete-draft" -> "Supprimer un brouillon";
            case "rectify" -> "Rectifier";
            case "deactivate" -> "Désactiver ou réactiver";
            case "upload" -> "Déposer ou remplacer un document";
            case "receive" -> "Réceptionner les lots";
            case "validate" -> "Valider";
            case "cancel" -> "Annuler";
            case "configure" -> "Configurer";
            case "adjust" -> "Accorder un écart ou ajustement";
            case "transition" -> "Changer le statut";
            case "assign" -> "Rattacher un membre";
            case "end-membership" -> "Terminer un rattachement";
            case "import" -> "Importer";
            case "export" -> "Exporter";
            case "issue" -> "Émettre";
            case "revise" -> "Rectifier le document";
            case "refund" -> "Régler une ristourne";
            case "confirm" -> "Confirmer";
            case "reject" -> "Enregistrer un rejet";
            case "replace" -> "Remplacer un moyen";
            case "represent" -> "Représenter un moyen";
            case "followup" -> "Enregistrer un suivi de rejet";
            case "configure-access" -> "Attribuer les accès aux comptes";
            case "transfer" -> "Effectuer un transfert";
            case "open" -> "Ouvrir une session";
            case "close" -> "Clôturer une session";
            case "deposit" -> "Déposer en banque";
            case "transmit" -> "Transmettre";
            case "reconcile" -> "Rapprocher";
            case "reset-password" -> "Réinitialiser un mot de passe";
            case "revoke-session" -> "Révoquer les sessions";
            case "assign-role" -> "Attribuer un rôle";
            case "assign-permissions" -> "Attribuer les permissions";
            case "manage-self" -> "Modifier sa propre agence";
            case "manage" -> "Administrer la plateforme";
            default -> throw new IllegalArgumentException("Unknown permission action: " + action);
        };
    }

    public record Definition(String code, String name, String module, String resource, String resourceLabel,
                             String action, String actionLabel, String description,
                             boolean superAdminOnly, boolean sensitive) {
    }
}
