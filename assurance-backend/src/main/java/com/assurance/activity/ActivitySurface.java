package com.assurance.activity;

public enum ActivitySurface {
    CONTRACT_CREATION("Création ou modification de contrat"),
    CONTRACT_AMENDMENT("Saisie d'avenant"),
    CONTRACT_REGISTER("Liste des dossiers"),
    ASSISTANCE_CREATION("Saisie d'assistance"),
    GREEN_CARDS("Cartes vertes du contrat"),
    CLIENT_REGISTER("CRM clients"),
    CLIENT_RECORD("Fiche client"),
    CLIENT_ACCOUNTING("Relevés et factures clients"),
    CLIENT_PAYMENTS("Règlements clients"),
    CONVENTION_BILLING("Facturation des conventions"),
    BANK_REMITTANCES("Bordereaux bancaires"),
    BANK_REJECTIONS("Rejets bancaires"),
    BANK_RECONCILIATION("Rapprochement bancaire"),
    TREASURY("Trésorerie"),
    COMPANY_ACCOUNTING("Comptabilité compagnie"),
    COMPANY_ASSIGNMENTS("Affectation des quittances compagnie"),
    CLAIM_FILE("Dossier sinistre"),
    CLAIM_REGISTER("Gestion des sinistres"),
    CLAIM_DECLARATION("Déclaration de sinistre"),
    CLAIM_SETTINGS("Référentiels sinistres"),
    ATTESTATION_STOCK("Stock d'attestations"),
    COMPANY_SETTINGS("Compagnies et produits"),
    PRODUCTION_SETTINGS("Paramètres de production"),
    CRM_SETTINGS("Paramètres CRM"),
    ADMINISTRATION("Administration"),
    OTHER_APPLICATION("Application"),
    API("API"),
    IMPORT("Import"),
    SYSTEM("Traitement automatique");

    private final String label;

    ActivitySurface(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    /** A browser hint describes location only, never a trusted command or actor. */
    public static ActivitySurface browserHint(String value) {
        if (value == null || value.length() > 50) return API;
        try {
            ActivitySurface surface = valueOf(value);
            return surface == SYSTEM || surface == IMPORT ? API : surface;
        } catch (IllegalArgumentException exception) {
            return API;
        }
    }
}
