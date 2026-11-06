package com.assurance.activity;

import com.assurance.entity.RegleFiscale;
import com.assurance.enums.CategorieQuittance;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class FiscalRuleActivity {
    private FiscalRuleActivity() {
    }

    public static Map<String, String> snapshot(RegleFiscale rule) {
        return new ActivityValues().put("Code", rule.getCode()).put("Libelle", rule.getLibelle())
                .put("Nature", rule.getNature() == null ? null : switch (rule.getNature()) {
                    case TAXE_ASSURANCE -> "Taxe d'assurance";
                    case TPF -> "Taxe parafiscale";
                    case EVCAT -> "EVCAT";
                    case CNPAC -> "CNPAC";
                })
                .put("Mode de calcul", rule.getModeCalcul() == null ? null : switch (rule.getModeCalcul()) {
                    case TAUX -> "Taux decimal";
                    case MONTANT_FIXE -> "Montant fixe";
                }).put("Valeur", rule.getValeur())
                .put("Base de calcul", rule.getBaseCalcul() == null ? null : switch (rule.getBaseCalcul()) {
                    case PRIME_GARANTIE -> "Prime de garantie";
                    case PRIME_CATEGORIE -> "Prime de categorie";
                    case UNITE_ASSUREE -> "Unite assuree";
                })
                .put("Categorie de base", category(rule.getCategorieBase())).put("Categorie resultat", category(rule.getCategorieResultat()))
                .put("Branche", rule.getBrancheAssurance() == null ? null : rule.getBrancheAssurance().getLibelle())
                .put("Compagnie", rule.getCompagnieAssurance() == null ? null : rule.getCompagnieAssurance().getNom())
                .put("Categorie client", rule.getCategorieClient() == null ? null : rule.getCategorieClient().getLibelle())
                .put("Garanties", rule.getGaranties().stream().map(guarantee -> guarantee.getCode() + " - " + guarantee.getLibelle())
                        .sorted().collect(Collectors.joining("\n")))
                .put("Type de garantie", rule.getTypeGarantie() == null ? null : switch (rule.getTypeGarantie()) {
                    case VEHICULE -> "Vehicule";
                    case PERSONNE -> "Personne";
                })
                .put("Usage", rule.getUsage() == null ? null : rule.getUsage().getCode() + " - " + rule.getUsage().getLibelle())
                .put("Groupe d'attestations", rule.getGroupeUsageAttestation() == null ? null : rule.getGroupeUsageAttestation().getLibelle())
                .put("Type de contrat", rule.getTypeContrat() == null ? null : switch (rule.getTypeContrat()) {
                    case PARTICULIER -> "Particulier";
                    case CONVENTION -> "Convention";
                    case FLOTTE -> "Flotte";
                })
                .put("Debut d'application", rule.getDateDebut()).put("Fin d'application", rule.getDateFin())
                .put("Applicable", rule.getApplicable()).put("Priorite", rule.getPriorite()).put("Actif", rule.getActif())
                .put("Description", rule.getDescription()).put("Reference reglementaire", rule.getReferenceReglementaire()).snapshot();
    }

    public static List<ActivityReference> references(RegleFiscale rule) {
        List<ActivityReference> references = new ArrayList<>();
        if (rule.getCompagnieAssurance() != null) references.add(ActivityReference.of(ActivityRecordType.COMPAGNIE,
                rule.getCompagnieAssurance().getId(), rule.getCompagnieAssurance().getNom()));
        if (rule.getBrancheAssurance() != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "BRANCHE_ASSURANCE:" + rule.getBrancheAssurance().getId(), rule.getBrancheAssurance().getLibelle()));
        if (rule.getCategorieClient() != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "CATEGORIE_CLIENT:" + rule.getCategorieClient().getId(), rule.getCategorieClient().getLibelle()));
        if (rule.getUsage() != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "USAGE:" + rule.getUsage().getId(), rule.getUsage().getCode() + " - " + rule.getUsage().getLibelle()));
        if (rule.getGroupeUsageAttestation() != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "GROUPE_USAGE_ATTESTATION:" + rule.getGroupeUsageAttestation().getId(), rule.getGroupeUsageAttestation().getLibelle()));
        for (var guarantee : rule.getGaranties()) references.add(ActivityReference.of(ActivityRecordType.GARANTIE,
                guarantee.getId(), guarantee.getCode() + " - " + guarantee.getLibelle()));
        return references;
    }

    public static ActivityCommand command(RegleFiscale rule, Map<String, String> before, List<ActivityReference> oldReferences,
            ActivityAction action, String title, String origin) {
        List<ActivityReference> references = new ArrayList<>(oldReferences);
        references.addAll(references(rule));
        return new ActivityCommand(null, ActivityModule.REFERENTIELS, action, title, origin,
                ActivityReference.of(ActivityRecordType.REGLE_FISCALE, rule.getId(), rule.getCode() + " - " + rule.getLibelle()),
                references.stream().distinct().toList(), ActivityValues.changes(before, snapshot(rule)));
    }

    private static String category(CategorieQuittance category) {
        if (category == null) return null;
        return switch (category) {
            case AUTOMOBILE -> "Automobile";
            case CORPOREL -> "Corporel";
            case EVCAT -> "EVCAT";
            case ASSISTANCE -> "Assistance";
            case TOTAL -> "Total";
        };
    }
}
