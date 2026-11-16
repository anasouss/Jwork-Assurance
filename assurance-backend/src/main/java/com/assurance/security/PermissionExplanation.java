package com.assurance.security;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** User-facing help only; authorization remains in controllers and business services. */
public final class PermissionExplanation {
    private record Area(String page, String example) {
    }

    public record Details(String page, String allows, String example, List<String> restrictions) {
    }

    private static final Map<String, Area> AREAS = Map.ofEntries(
            Map.entry("client-portal-account", new Area("CRM > Comptes du portail client", "un compte de consultation client")),
            Map.entry("client-portal-publication", new Area("CRM > Portail client > Publications", "un document ou un suivi destiné au client")),
            Map.entry("contrat", new Area("Production > Liste des dossiers / Ajouter un dossier", "un dossier automobile")),
            Map.entry("avenant", new Area("Production > Liste des dossiers > Actions > Avenant", "un changement de véhicule")),
            Map.entry("assistance", new Area("Production > Dossier > Assistance", "une assistance automobile liée à un véhicule")),
            Map.entry("carte-verte", new Area("Production > Dossier > Cartes vertes", "une carte verte pour un véhicule assuré")),
            Map.entry("piece-jointe", new Area("Production > Dossier > Pièces jointes", "une pièce justificative du contrat")),
            Map.entry("attestation-stock", new Area("Production > Gestion du stock > Attestations, commandes et réceptions", "un lot d'attestations reçu d'une compagnie")),
            Map.entry("vehicule", new Area("Production > Recherche de véhicules et sélecteurs véhicule", "un véhicule identifié par son immatriculation")),
            Map.entry("garantie", new Area("Production > Paramètres > Garanties", "la garantie Bris de glace")),
            Map.entry("regle-fiscale", new Area("Production > Paramètres > Règles fiscales", "une règle de taxe applicable à une quittance")),
            Map.entry("usage", new Area("Production > Paramètres > Usages", "l'usage d'un véhicule de tourisme")),
            Map.entry("marque", new Area("Production > Paramètres > Marques", "la marque DACIA")),
            Map.entry("carrosserie", new Area("Production > Paramètres > Carrosseries", "une carrosserie de type berline")),
            Map.entry("carburant", new Area("Production > Paramètres > Carburants", "le carburant Diesel")),
            Map.entry("sous-classe", new Area("Production > Paramètres > Sous-classes", "une sous-classe avec ses critères véhicule et conducteur")),
            Map.entry("categorie-transport", new Area("Production > Paramètres > Catégories de transport", "une catégorie de transport utilisée par les tarifs")),
            Map.entry("categorie-client", new Area("Production > Paramètres > Catégories client", "une catégorie de clients utilisée en production")),
            Map.entry("groupe-usage-attestation", new Area("Production > Paramètres > Groupes de stock d'attestations", "un groupe d'usages partageant un stock d'attestations")),
            Map.entry("tarif-usage", new Area("Production > Paramètres > Tarifs par usage", "un tarif de responsabilité civile pour un usage")),
            Map.entry("type-piece-jointe", new Area("Production > Paramètres > Pièces jointes", "une règle de document obligatoire avec sa validité")),
            Map.entry("sinistre", new Area("Sinistre > Nouvelle ouverture / Consultation et suivi / Registre / Statistiques", "un sinistre lié à une police et à sa date de survenance")),
            Map.entry("sinistre-document", new Area("Sinistre > Détail du dossier > Pièces du dossier", "un rapport d'expertise déposé dans le dossier")),
            Map.entry("sinistre-mission", new Area("Sinistre > Détail du dossier > Missions d'expertise", "une mission confiée à un expert")),
            Map.entry("sinistre-provision", new Area("Sinistre > Détail du dossier > Provisions", "une estimation du coût du sinistre")),
            Map.entry("sinistre-operation", new Area("Sinistre > Détail du dossier > Opérations financières", "une opération de règlement ou de recours")),
            Map.entry("prestataire-sinistre", new Area("Sinistre > Prestataires", "un garage, un expert ou un prestataire médical avec ses domaines et accords compagnies")),
            Map.entry("specialite-prestataire", new Area("Sinistre > Prestataires > Spécialités", "une spécialité liée à la garantie Bris de glace")),
            Map.entry("domaine-prestataire", new Area("Sinistre > Prestataires > Domaines d’intervention", "un domaine Accidents du travail lié à Risques divers et à ses opérateurs médicaux")),
            Map.entry("compagnie-assurance", new Area("Compagnies > Liste des compagnies", "une compagnie d'assurance et son code intermédiaire")),
            Map.entry("compagnie-assistance", new Area("Compagnies > Assistance > Compagnies d'assistance", "une compagnie proposant des produits d'assistance")),
            Map.entry("convention", new Area("Compagnies > Conventions", "une convention avec sa grille et son fractionnement")),
            Map.entry("grille-tarifaire", new Area("Compagnies > Grilles tarifaires > Configuration", "une grille et ses garanties par usage")),
            Map.entry("contact-compagnie", new Area("Compagnies > Contacts", "un interlocuteur de la compagnie")),
            Map.entry("produit-assistance", new Area("Compagnies > Assistance > Produits", "un produit d'assistance automobile")),
            Map.entry("tarif-assistance", new Area("Compagnies > Assistance > Produits > Tarifs", "un tarif d'assistance avec sa durée et ses dates")),
            Map.entry("promo-assistance", new Area("Compagnies > Assistance > Produits > Codes promotionnels", "un code de réduction applicable à l'assistance")),
            Map.entry("client", new Area("CRM > Clients > Fiche client", "la fiche d'un souscripteur ou d'une société")),
            Map.entry("groupe-client", new Area("CRM > Clients > Groupes et organisation du client", "une société rattachée à un groupe de clients")),
            Map.entry("origine-commerciale", new Area("CRM > Paramètres > Origines commerciales", "une campagne ou un partenaire apporteur")),
            Map.entry("acquisition-client", new Area("CRM > Fiche client > Acquisition commerciale", "l'origine commerciale d'un client")),
            Map.entry("condition-paiement", new Area("CRM > Fiche client > Conditions de paiement", "un délai de paiement accordé au client")),
            Map.entry("document-crm", new Area("CRM > Fiche client > Documents client", "une pièce d'identité ou un justificatif du client")),
            Map.entry("quittance-affectation", new Area("Compta > Affectation des quittances", "une quittance compagnie affectée à une production")),
            Map.entry("regle-quittance", new Area("Compta > Affectation des quittances > Règles d'affectation", "une règle de ventilation ou de commission")),
            Map.entry("document-client", new Area("Compta > Relevés et factures", "une facture client regroupant des éléments à payer")),
            Map.entry("production-convention", new Area("Compta > Département conventions > Consultation de la production", "l'état de production d'une convention sur une période")),
            Map.entry("facture-convention", new Area("Compta > Département conventions > Factures / Encaissements", "une facture de convention pour une période facturée")),
            Map.entry("reglement-client", new Area("Compta > Règlements clients / Département conventions > Encaissements", "un règlement affecté aux créances sélectionnées")),
            Map.entry("instrument-reglement", new Area("Compta > Encaissements en attente / Rejets bancaires", "un chèque suivi jusqu'à son encaissement ou son rejet")),
            Map.entry("quittance-prime", new Area("Compta > Règlements enregistrés > Quittance de prime", "la quittance de prime d'un règlement")),
            Map.entry("compte-tresorerie", new Area("Compta > Trésorerie > Comptes", "un compte bancaire ou une caisse")),
            Map.entry("operation-tresorerie", new Area("Compta > Trésorerie > Journal / Opérations", "un transfert entre une caisse et un compte bancaire")),
            Map.entry("session-caisse", new Area("Trésorerie > Sessions de caisse (API)", "une session de caisse ouverte pour un caissier")),
            Map.entry("bordereau-remise", new Area("Compta > Trésorerie > Bordereaux bancaires", "un bordereau regroupant des chèques à remettre en banque")),
            Map.entry("rapprochement-bancaire", new Area("Compta > Trésorerie > Rapprochement bancaire", "une ligne de relevé bancaire rapprochée d'un instrument")),
            Map.entry("banque", new Area("Compta > Paramètres > Banques", "une banque proposée lors de la saisie d'un règlement")),
            Map.entry("bordereau-compagnie", new Area("Compta > Bordereaux compagnies", "un bordereau de productions pour une compagnie et une période")),
            Map.entry("reglement-compagnie", new Area("Compta > Bordereaux compagnies > Règlements", "un virement affecté à un bordereau compagnie")),
            Map.entry("user", new Area("Administration > Utilisateurs", "le compte d'un collaborateur de l'agence")),
            Map.entry("role", new Area("Administration > Rôles et permissions", "un rôle attribué aux collaborateurs")),
            Map.entry("audit", new Area("Administration > Audit technique", "la trace technique d'une modification de données")),
            Map.entry("activity", new Area("Administration > Activité métier", "une opération enregistrée dans l'historique métier")),
            Map.entry("agence", new Area("Administration > Mon agence / Agences", "les coordonnées et documents de l'agence")),
            Map.entry("config", new Area("Administration plateforme > Administrateurs plateforme", "un compte administrateur de la plateforme"))
    );

    private PermissionExplanation() {
    }

    public static Details forPermission(PermissionCatalog.Definition permission) {
        if (permission == null) {
            return null;
        }
        Area area = AREAS.get(permission.resource());
        if (area == null) {
            throw new IllegalArgumentException("Missing permission help area: " + permission.resource());
        }
        String allows = specificAllows(permission);
        List<String> restrictions = new ArrayList<>();
        restrictions.add("Les règles de validation et le périmètre de données restent applicables. Cette autorisation ne donne pas un accès inter-agences.");
        if (permission.resource().startsWith("client-portal-")) {
            restrictions.add("Le portail client est en consultation seule. La création du compte ne partage aucun dossier automatiquement. Vérifiez l'identité ou le mandat du bénéficiaire avant tout partage ; être payeur ne constitue pas une autorisation d'accès.");
            restrictions.add("Les comptes et publications concernent uniquement l'agence courante. Les droits de consultation du contrat ou du sinistre source sont contrôlés séparément lors du partage et de la publication.");
        }
        if (List.of("garantie", "regle-fiscale", "usage", "marque", "carrosserie", "carburant", "sous-classe",
                "categorie-transport", "categorie-client", "groupe-usage-attestation", "tarif-usage",
                "compagnie-assurance", "compagnie-assistance", "convention", "grille-tarifaire",
                "produit-assistance", "tarif-assistance", "promo-assistance").contains(permission.resource())) {
            restrictions.add("Cette rubrique contient des données de référence partagées. Leur modification peut affecter plusieurs agences ; les configurations propres à l'agence restent séparées.");
        }
        if (permission.superAdminOnly()) {
            restrictions.add("Réservée à l'administration de la plateforme ; non attribuable à un rôle d'agence.");
        }
        if (permission.resource().equals("role") || permission.code().equals("user:assign-role")) {
            restrictions.add("Les permissions déléguées doivent être détenues par l'utilisateur qui les attribue. Les droits plateforme ne peuvent pas être attribués à un rôle d'agence.");
        }
        if (permission.code().equals("contrat:update")) {
            restrictions.add("La modification directe d'un contrat actif reste soumise à son historique et aux blocages de production ou de comptabilité.");
        }
        if (permission.code().equals("contrat:create")) {
            restrictions.add("Inclut la saisie et l'enregistrement du brouillon de création. Ne permet pas de corriger un contrat actif ni de modifier un brouillon de renouvellement.");
        }
        if (permission.code().equals("contrat:import")) {
            restrictions.add("Uniquement pendant la préparation d'une flotte. Demande aussi Créer ou Modifier pour un brouillon ordinaire, ou Renouveler pour un brouillon de renouvellement. L'import ne valide pas le contrat.");
        }
        if (permission.code().equals("contrat:export")) {
            restrictions.add("Uniquement les véhicules et garanties enregistrés de la flotte de l'agence. Les modifications non enregistrées et les vues historiques d'un mouvement ne sont pas exportées.");
        }
        if (permission.code().equals("attestation-stock:create")) {
            restrictions.add("Une réception directe valide immédiatement le stock : elle demande aussi les autorisations Réceptionner les lots et Valider.");
        }
        if (List.of("document-client:delete", "facture-convention:delete").contains(permission.code())) {
            restrictions.add("Uniquement une facture émise éligible, non remplacée et sans historique de paiement ou d'affectation, même annulé. Les périodes convention sont libérées et une trace d'audit est conservée.");
        }
        if (permission.resource().contains("tresorerie") || List.of("session-caisse", "instrument-reglement", "bordereau-remise", "rapprochement-bancaire", "reglement-compagnie", "sinistre-operation").contains(permission.resource())) {
            restrictions.add("Les accès aux comptes de trésorerie concernés sont contrôlés séparément ; cette permission ne remplace pas ces accès.");
        }
        if (List.of("document-client", "facture-convention").contains(permission.resource())) {
            restrictions.add("Le backend vérifie l'origine réelle du document. Les factures de convention et les documents clients ordinaires ont des autorisations distinctes.");
        }
        if (permission.code().equals("sinistre:view")) {
            restrictions.add("La consultation porte sur le dossier complet, y compris son historique financier ; les écritures de provision et de règlement demandent leurs propres permissions.");
        }
        String page = switch (permission.code()) {
            case "contrat:import" -> "Production > Création / renouvellement flotte > Véhicules > Importer Excel";
            case "contrat:export" -> "Production > Dossier flotte ou préparation du dossier > Exporter Excel";
            default -> area.page();
        };
        return new Details(page, allows, example(permission, area), List.copyOf(restrictions));
    }

    private static String example(PermissionCatalog.Definition permission, Area area) {
        return switch (permission.code()) {
            case "contrat:import" -> "Analyser un fichier de dix véhicules puis les ajouter au brouillon flotte, avant de les enregistrer avec les droits de création, modification ou renouvellement appropriés.";
            case "contrat:export" -> "Télécharger le parc enregistré depuis la fiche d'une flotte, avec Consultation et Exporter les véhicules Excel, sans disposer de Modifier.";
            case "contrat:update" -> "Corriger une information dans un contrat dont la modification directe est encore autorisée, sans le supprimer.";
            case "reglement-client:refund" -> "Régler au bénéficiaire une sélection de ristournes dont le total est négatif.";
            case "reglement-client:adjust" -> "Accorder un écart motivé sur une créance, dans la limite configurée pour l'agence.";
            case "facture-convention:issue" -> "Sélectionner les échéances éligibles d'une convention et établir la facture de la période.";
            case "facture-convention:revise" -> "Remplacer une facture de convention sans historique de règlement, ajouter des échéances éligibles de même convention, compagnie, période et sens, conserver ou retirer ses échéances et rectifier sa date limite autorisée. Un motif est obligatoire et les notes existantes sont conservées. L'original reste consultable.";
            case "sinistre-provision:create" -> "Enregistrer une estimation du coût d'un sinistre ; aucun paiement n'est créé par cette provision.";
            case "user:assign-role" -> "Attribuer le rôle Consultation à un collaborateur sans modifier son nom ou son adresse e-mail.";
            default -> "Action « " + permission.actionLabel() + " » appliquée à " + area.example() + ", dans la rubrique « " + permission.resourceLabel() + " ».";
        };
    }

    private static String specificAllows(PermissionCatalog.Definition permission) {
        return switch (permission.code()) {
            case "client-portal-account:view" -> "Consulter les comptes clients de l'agence et leurs accès explicites aux dossiers, sans voir les mots de passe.";
            case "client-portal-account:create" -> "Créer un compte pour un client existant avec un identifiant CIN, RC ou autre identifiant vérifié, et un mot de passe initial à changer. Aucun dossier n'est partagé automatiquement.";
            case "client-portal-account:deactivate" -> "Désactiver ou réactiver un compte client. La désactivation révoque immédiatement ses sessions.";
            case "client-portal-account:reset-password" -> "Définir un nouveau mot de passe initial, révoquer les sessions et imposer son changement à la prochaine connexion.";
            case "client-portal-account:assign" -> "Partager ou retirer explicitement un contrat ou un sinistre de l'agence pour un compte client vérifié. Ne modifie pas le dossier métier et ne donne pas de droits de salarié au client.";
            case "client-portal-publication:view" -> "Consulter les documents et messages publiés ou retirés pour un accès client.";
            case "client-portal-publication:create" -> "Publier un document existant du dossier ou rédiger une mise à jour de sinistre destinée au client. Les notes internes ne sont pas publiées automatiquement.";
            case "client-portal-publication:deactivate" -> "Retirer un document ou message du portail client sans supprimer le document métier d'origine.";
            case "contrat:import" -> "Télécharger le modèle Excel, analyser les véhicules et garanties du fichier, puis les ajouter au formulaire flotte avant enregistrement.";
            case "contrat:export" -> "Télécharger le fichier Excel des véhicules et garanties enregistrés d'un dossier flotte, sans pouvoir le modifier ni importer un fichier.";
            case "contrat:view" -> "Consulter les dossiers, leur détail, le registre de production, les échéances et les documents de production accessibles par ces écrans.";
            case "contrat:create" -> "Créer un dossier et saisir ses clients, véhicules, garanties et quittances dans le parcours de création, avec enregistrement du brouillon.";
            case "contrat:update" -> "Modifier les informations d'un dossier existant lorsque la modification directe est autorisée, ou poursuivre un brouillon ordinaire.";
            case "contrat:delete" -> "Supprimer un dossier brouillon ou un devis éligible. Cette action n'est pas une annulation d'un contrat actif.";
            case "avenant:delete" -> "Supprimer le dernier avenant uniquement lorsque les contrôles de chronologie et d'utilisation l'autorisent.";
            case "avenant:create" -> "Préparer et valider un nouvel avenant sur un contrat éligible, en conservant ses effets sur les véhicules, garanties et quittances.";
            case "attestation-stock:create" -> "Créer une commande d'attestations ou démarrer une réception directe. Une réception directe exige aussi les droits de réception et de validation.";
            case "attestation-stock:configure" -> "Modifier les seuils de stock et activer ou désactiver le contrôle des numéros d'attestation lors de la saisie des contrats.";
            case "attestation-stock:cancel" -> "Annuler une attestation disponible avec un motif, lorsque son état autorise cette action.";
            case "assistance:deactivate", "carte-verte:deactivate" -> "Retirer ou désactiver la ligne liée au contrat lorsque son état et ses utilisations le permettent. Ce n'est pas la suppression du contrat principal.";
            case "sinistre:view" -> "Consulter les dossiers, garanties impliquées, parties, documents, missions, provisions et opérations, ainsi que le registre et les statistiques des sinistres.";
            case "sinistre:create" -> "Ouvrir un sinistre à partir d'une police, de la date du sinistre et de la couverture applicable, puis enregistrer les informations d'ouverture.";
            case "sinistre:delete" -> "Supprimer un dossier sinistre encore éligible à une suppression précoce. Ne remplace pas une transition d'annulation ou de clôture.";
            case "sinistre-document:update" -> "Mettre à jour le suivi ou la qualification d'un document du dossier. Le dépôt et la suppression sont des actions distinctes.";
            case "sinistre-provision:create" -> "Enregistrer une provision estimative du sinistre. Une provision ne constitue pas une opération de paiement.";
            case "sinistre-operation:create" -> "Enregistrer une opération financière réelle du sinistre, selon son type et les comptes autorisés.";
            case "quittance-affectation:update" -> "Enregistrer ou corriger une affectation compagnie, individuellement ou par lot, avec ses montants et sa ventilation.";
            case "quittance-affectation:delete" -> "Retirer une affectation de quittance compagnie éligible. Ne supprime pas la production ni un document client.";
            case "reglement-client:create" -> "Enregistrer un règlement entrant et ses affectations, ou un versement multi-clients compatible. La direction du règlement est contrôlée par le backend.";
            case "reglement-client:refund" -> "Enregistrer un règlement sortant pour une sélection dont le montant net est négatif, notamment une ristourne.";
            case "reglement-client:adjust" -> "Accorder un écart de règlement motivé dans les limites de la politique de l'agence. Cette permission seule ne crée pas un règlement.";
            case "reglement-client:configure" -> "Modifier la politique et les plafonds des écarts de règlement ; ne donne pas le droit d'accorder un écart dans une opération.";
            case "document-client:issue" -> "Émettre un relevé ou une facture à partir de sources clients éligibles, ou établir une facture depuis un relevé. Cela ne confirme aucun paiement.";
            case "facture-convention:issue" -> "Prévisualiser et établir une facture à partir des échéances éligibles d'une convention. Cela n'enregistre ni encaissement ni règlement de ristourne.";
            case "quittance-prime:issue" -> "Émettre une quittance de prime pour les éléments éligibles d'un règlement existant ; ne crée pas un nouveau règlement.";
            case "quittance-prime:delete" -> "Supprimer une quittance de prime archivée éligible. Le règlement et ses affectations restent distincts.";
            case "bordereau-remise:update" -> "Ajouter ou retirer des moyens sur un bordereau bancaire brouillon compatible, sans le déposer ni le supprimer.";
            case "bordereau-remise:delete" -> "Supprimer un bordereau bancaire brouillon éligible ; ne supprime pas les règlements qui portaient ses moyens.";
            case "bordereau-remise:confirm" -> "Confirmer le traitement d'une ligne du bordereau déposé, selon son état et les contrôles de trésorerie.";
            case "bordereau-remise:reject" -> "Enregistrer le rejet d'une ligne du bordereau déposé, avec sa date et son motif.";
            case "rapprochement-bancaire:update" -> "Enregistrer les associations et corrections du rapprochement sans effectuer sa validation finale.";
            case "rapprochement-bancaire:validate" -> "Valider le rapprochement enregistré et appliquer ses conséquences autorisées sur les instruments et la trésorerie.";
            case "produit-assistance:delete" -> "Supprimer définitivement un produit d'assistance lorsque les contrôles d'utilisation l'autorisent, au lieu de le désactiver seulement.";
            case "tarif-assistance:delete", "promo-assistance:delete", "tarif-usage:delete" -> "Retirer la ligne du catalogue actif selon le traitement de suppression ou de désactivation prévu pour cette rubrique ; son historique d'utilisation n'est pas effacé par cette permission.";
            case "role:update" -> "Modifier les informations du rôle. Un changement des permissions demande en plus l'autorisation Attribuer les permissions.";
            case "role:delete" -> "Supprimer un rôle non système qui n'est attribué à aucun utilisateur.";
            case "role:assign-permissions" -> "Changer les autorisations d'un rôle, avec ajout des prérequis et contrôle des droits que l'utilisateur est autorisé à déléguer.";
            case "user:assign-role" -> "Attribuer un rôle compatible à un utilisateur de l'agence sans devoir modifier son profil. Ne permet pas d'attribuer un rôle plateforme.";
            case "user:update" -> "Modifier le profil d'un utilisateur. Le rôle, le statut actif et le mot de passe demandent leurs permissions distinctes lorsqu'ils changent.";
            case "user:deactivate" -> "Désactiver un utilisateur de l'agence et révoquer ses sessions. La désactivation de son propre compte est interdite ; une réactivation depuis le formulaire demande aussi la modification du profil.";
            default -> actionAllows(permission);
        };
    }

    private static String actionAllows(PermissionCatalog.Definition permission) {
        String area = "Dans la rubrique « " + permission.resourceLabel() + " », ";
        return area + switch (permission.action()) {
            case "view" -> "consulter les informations accessibles, sans accorder automatiquement les actions d'écriture.";
            case "create" -> "créer un nouvel enregistrement avec les informations demandées par le formulaire ou l'API.";
            case "update" -> "modifier les informations d'un enregistrement existant éligible.";
            case "delete" -> "supprimer un enregistrement uniquement lorsque son état et ses utilisations l'autorisent.";
            case "renew" -> "préparer, enregistrer et finaliser un renouvellement à partir d'un contrat éligible, selon le mode de terme choisi.";
            case "update-draft" -> "enregistrer les modifications d'un brouillon d'avenant. La validation ou la rectification finale reste une action distincte.";
            case "delete-draft" -> "supprimer un brouillon d'avenant, sans supprimer un mouvement déjà validé.";
            case "rectify" -> "rectifier un avenant déjà validé lorsque son historique et ses utilisations permettent cette correction.";
            case "recalculate-financial-history" -> "prévisualiser puis appliquer un recalcul de l'historique financier du dossier selon les contrôles métier.";
            case "deactivate" -> "désactiver une entrée éligible. Si une réactivation passe par le formulaire de modification, la permission Modifier est également nécessaire.";
            case "upload" -> "déposer de nouveaux fichiers ou remplacer une version de document, sans accorder la suppression.";
            case "receive" -> "enregistrer les lots et plages de numéros reçus pour une commande d'attestations.";
            case "validate" -> "effectuer la validation finale d'un enregistrement éligible ; la création ou la modification ne donne pas automatiquement ce droit.";
            case "cancel" -> "annuler une opération éligible selon les règles métier, avec motif lorsque demandé. Annuler n'est pas supprimer son historique.";
            case "configure" -> "modifier les paramètres de fonctionnement de cette rubrique, pas les droits d'accès des utilisateurs.";
            case "transition" -> "changer le statut ou l'étape du sinistre lorsque la transition et ses prérequis sont autorisés.";
            case "assign" -> "rattacher un client à un groupe en précisant sa relation. La fin d'un rattachement est une permission distincte.";
            case "end-membership" -> "terminer un rattachement client-groupe existant sans supprimer le client ni le groupe.";
            case "import" -> "importer ou prévisualiser un fichier selon le parcours prévu. L'enregistrement ou la validation peut demander les permissions indiquées en prérequis.";
            case "export" -> "exporter les résultats correspondant aux filtres et au périmètre autorisés, sans modifier les données.";
            case "confirm" -> "confirmer un moyen de règlement éligible et ses conséquences financières autorisées. Le rejet est une permission distincte.";
            case "reject" -> "enregistrer le rejet d'un moyen de règlement éligible et son motif, sans créer automatiquement un remplacement.";
            case "replace" -> "remplacer un moyen rejeté éligible par un ou plusieurs moyens compatibles, en conservant les liens de suivi.";
            case "represent" -> "enregistrer la représentation d'un moyen rejeté éligible pour une nouvelle remise.";
            case "followup" -> "enregistrer un mouvement de suivi d'un rejet bancaire. Cela n'autorise pas à confirmer un encaissement ou remplacer le moyen.";
            case "configure-access" -> "attribuer les accès des utilisateurs aux comptes de trésorerie. Les permissions de rôle restent nécessaires pour chaque opération.";
            case "transfer" -> "enregistrer un transfert entre comptes de trésorerie autorisés, avec ses écritures liées.";
            case "adjust" -> "enregistrer une opération d'ajustement de trésorerie avec les informations et contrôles demandés.";
            case "open" -> "ouvrir une session de caisse éligible sur un compte autorisé.";
            case "close" -> "clôturer une session de caisse éligible avec les informations de clôture demandées.";
            case "deposit" -> "enregistrer la remise effective en banque d'un bordereau préparé, avec date et référence bancaire.";
            case "transmit" -> "enregistrer la transmission à la compagnie d'un bordereau éligible et ses références de transmission.";
            case "reconcile" -> "enregistrer le rapprochement du bordereau compagnie, ses écarts et les références d'accusé de réception.";
            case "reset-password" -> "réinitialiser le mot de passe d'un utilisateur autorisé. Cette permission ne permet pas de changer son rôle.";
            case "revoke-session" -> "révoquer une session ou les sessions d'un utilisateur autorisé, sans supprimer son compte.";
            case "manage-self" -> "modifier l'identité, les coordonnées et les documents de sa propre agence, pas créer une agence ni changer son statut plateforme.";
            case "manage" -> "administrer les comptes et opérations réservés à la plateforme, selon les contrôles de contexte plateforme.";
            case "issue" -> "émettre un document éligible sans enregistrer de paiement automatiquement.";
            case "revise" -> "rectifier un document selon son cycle de vie et les règles de remplacement, sans réécriture silencieuse de son historique.";
            default -> throw new IllegalArgumentException("Missing permission explanation: " + permission.code());
        };
    }
}
