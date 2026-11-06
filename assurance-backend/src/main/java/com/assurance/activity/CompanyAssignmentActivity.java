package com.assurance.activity;

import com.assurance.entity.AffectationQuittanceCompagnie;
import com.assurance.entity.Quittance;
import com.assurance.entity.RegleAffectationQuittance;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public final class CompanyAssignmentActivity {
    private CompanyAssignmentActivity() {
    }

    public static ActivityReference quittanceReference(Quittance quittance) {
        String label = quittance.getNumeroQuittance();
        if (label == null || label.isBlank()) label = "Quittance du dossier " + quittance.getContrat().getNumeroDossier();
        return ActivityReference.of(ActivityRecordType.QUITTANCE, quittance.getId(), label);
    }

    public static List<ActivityReference> quittanceReferences(Quittance quittance) {
        List<ActivityReference> references = new ArrayList<>();
        var contract = quittance.getContrat();
        references.add(ActivityReference.of(ActivityRecordType.CONTRAT, contract.getId(), contract.getNumeroDossier()));
        if (quittance.getMouvementContrat() != null) references.add(ActivityReference.of(ActivityRecordType.MOUVEMENT_CONTRAT,
                quittance.getMouvementContrat().getId(), "Mouvement " + quittance.getMouvementContrat().getNumeroMouvement()));
        if (quittance.getElementFacturable() != null) {
            String label = quittance.getElementFacturable().getLibelle();
            references.add(ActivityReference.of(ActivityRecordType.ELEMENT_FACTURABLE,
                    quittance.getElementFacturable().getId(), label == null || label.isBlank()
                            ? "Element facturable du dossier " + contract.getNumeroDossier() : label));
        }
        return references;
    }

    public static Map<String, String> snapshot(List<Quittance> quittances, List<AffectationQuittanceCompagnie> assignments) {
        ActivityValues values = new ActivityValues();
        int index = 0;
        for (var quittance : quittances.stream().sorted(Comparator.comparing(Quittance::getId)).toList()) {
            String prefix = "Quittance " + (++index) + " - ";
            var lines = assignments.stream().filter(line -> line.getQuittance().getId().equals(quittance.getId()))
                    .sorted(Comparator.comparing(AffectationQuittanceCompagnie::getNumeroQuittanceCompagnie)
                            .thenComparing(AffectationQuittanceCompagnie::getDateEffet)
                            .thenComparing(line -> line.getCategorieQuittance() == null ? "" : line.getCategorieQuittance().name()))
                    .toList();
            if (lines.isEmpty()) continue;
            values.put(prefix + "Reference", quittanceReference(quittance).label()).put(prefix + "Dossier", quittance.getContrat().getNumeroDossier())
                    .put(prefix + "Police", quittance.getContrat().getNumeroPolice());
            int lineIndex = 0;
            for (var line : lines) {
                String item = prefix + "Affectation " + (++lineIndex) + " - ";
                values.put(item + "Numero compagnie", line.getNumeroQuittanceCompagnie()).put(item + "Compagnie", line.getTiersCompagnie().getNom())
                        .put(item + "Source", line.getSource() == null ? null : switch (line.getSource()) {
                            case AUTOMATIQUE -> "Automatique";
                            case MANUEL -> "Saisie manuelle";
                            case IMPORT -> "Import Excel";
                        })
                        .put(item + "Date d'effet", line.getDateEffet()).put(item + "Date d'echeance", line.getDateEcheance())
                        .put(item + "Acte", line.getActeSource()).put(item + "Categorie source", line.getCategorieSource())
                        .put(item + "Categorie", line.getCategorieQuittance()).put(item + "Statut compagnie", line.getStatutSource())
                        .put(item + "Fichier source", filename(line.getFichierSource()))
                        .put(item + "Prime nette", line.getPrimeNette()).put(item + "Taxes", line.getMontantTaxes())
                        .put(item + "Accessoires", line.getAccessoires()).put(item + "Montant TTC", line.getMontantTtc())
                        .put(item + "Commission nette", line.getCommissionNette()).put(item + "Avec retenue", line.getAvecRetenue())
                        .put(item + "Taux de retenue", line.getTauxRetenue()).put(item + "Montant retenu", line.getMontantRetenue())
                        .put(item + "Net compagnie", line.getNetCompagnie());
            }
        }
        return values.snapshot();
    }

    public static ActivityCommand command(List<Quittance> quittances, List<AffectationQuittanceCompagnie> oldAssignments,
            List<AffectationQuittanceCompagnie> assignments, ActivityAction action, String title, String origin) {
        var before = snapshot(quittances, oldAssignments);
        List<ActivityReference> references = new ArrayList<>();
        for (var quittance : quittances) {
            references.add(quittanceReference(quittance));
            references.addAll(quittanceReferences(quittance));
        }
        var allAssignments = new ArrayList<>(oldAssignments);
        allAssignments.addAll(assignments);
        for (var line : allAssignments) {
            references.add(ActivityReference.of(ActivityRecordType.TIERS_COMPAGNIE, line.getTiersCompagnie().getId(), line.getTiersCompagnie().getNom()));
            if (line.getId() != null) references.add(ActivityReference.of(ActivityRecordType.AFFECTATION_QUITTANCE_COMPAGNIE,
                    line.getId(), line.getNumeroQuittanceCompagnie()));
        }
        var first = quittances.get(0);
        ActivityReference subject = quittances.size() > 1 ? references.stream().filter(ref -> ref.type() == ActivityRecordType.CONTRAT).findFirst().orElseThrow()
                : quittanceReference(first);
        return new ActivityCommand(first.getContrat().getAgence().getId(), ActivityModule.COMPTABILITE_COMPAGNIE, action, title, origin,
                subject, references.stream().filter(ref -> !ref.equals(subject)).distinct().toList(), ActivityValues.changes(before, snapshot(quittances, assignments)));
    }

    public static Map<String, String> snapshot(RegleAffectationQuittance rule) {
        return new ActivityValues().put("Compagnie", rule.getTiersCompagnie().getNom()).put("Branche", rule.getBrancheAssurance().getLibelle())
                .put("Produit", rule.getTypeContrat() == null ? null : switch (rule.getTypeContrat()) {
                    case PARTICULIER -> "Mono";
                    case CONVENTION -> "Convention";
                    case FLOTTE -> "Flotte";
                })
                .put("Mode d'affectation", rule.getModeAffectation() == null ? null : switch (rule.getModeAffectation()) {
                    case AUTOMATIQUE -> "Automatique";
                    case MANUEL_OU_IMPORT -> "Saisie manuelle ou import";
                })
                .put("Ventilation", rule.getModeVentilation() == null ? null : switch (rule.getModeVentilation()) {
                    case GLOBALE -> "Globale";
                    case PAR_CATEGORIE -> "Par categorie";
                })
                .put("Calcul de commission", rule.getModeCalculCommission() == null ? null : switch (rule.getModeCalculCommission()) {
                    case TAUX_NET -> "Taux net";
                    case TAUX_BRUT_TVA_INCLUSE -> "Taux brut, TVA incluse";
                })
                .put("Commission automobile (%)", rule.getTauxCommissionAutomobile()).put("Commission EVCAT (%)", rule.getTauxCommissionEvcat())
                .put("Commission corporel (%)", rule.getTauxCommissionCorporel()).put("Commission assistance (%)", rule.getTauxCommissionAssistance())
                .put("TVA incluse (%)", rule.getTauxTvaIncluseCommission()).put("Retenue par defaut", rule.getRetenueParDefaut())
                .put("Taux de retenue (%)", rule.getTauxRetenue()).put("Seuil d'avertissement", rule.getSeuilAvertissementEcart())
                .put("Marge manquante maximale", rule.getMargeManquanteMaximale()).put("Marge de depassement maximale", rule.getMargeDepassementMaximale())
                .put("Valable du", rule.getDateDebut()).put("Valable au", rule.getDateFin()).put("Actif", rule.getActif())
                .put("Excel - Feuille", rule.getExcelFeuille()).put("Excel - Ligne d'entete", rule.getExcelLigneEntete())
                .put("Excel - Police", rule.getExcelColonneNumeroPolice()).put("Excel - Quittance", rule.getExcelColonneNumeroQuittance())
                .put("Excel - Effet", rule.getExcelColonneDateEffet()).put("Excel - Echeance", rule.getExcelColonneDateEcheance())
                .put("Excel - Prime nette", rule.getExcelColonnePrimeNette()).put("Excel - Taxes", rule.getExcelColonneTaxes())
                .put("Excel - Accessoires", rule.getExcelColonneAccessoires()).put("Excel - TTC", rule.getExcelColonneMontantTtc())
                .put("Excel - Commission nette", rule.getExcelColonneCommissionNette()).put("Excel - Net compagnie", rule.getExcelColonneNetCompagnie())
                .put("Excel - Acte", rule.getExcelColonneActe()).put("Excel - Categorie", rule.getExcelColonneCategorie())
                .put("Excel - Statut", rule.getExcelColonneStatut()).snapshot();
    }

    public static ActivityCommand ruleCommand(RegleAffectationQuittance rule, Map<String, String> before,
            ActivityAction action, List<ActivityReference> oldReferences) {
        var references = new ArrayList<>(ruleReferences(rule));
        if (oldReferences != null) references.addAll(oldReferences);
        return new ActivityCommand(rule.getAgence().getId(), ActivityModule.COMPTABILITE_COMPAGNIE, action,
                switch (action) {
                    case CREATED -> "Regle d'affectation compagnie creee";
                    case DELETED -> "Regle d'affectation compagnie supprimee";
                    default -> "Regle d'affectation compagnie modifiee";
                }, "COMPANY_ASSIGNMENT_RULE",
                ActivityReference.of(ActivityRecordType.REGLE_AFFECTATION_QUITTANCE, rule.getId(),
                        rule.getTiersCompagnie().getNom() + " - " + rule.getBrancheAssurance().getLibelle()),
                references.stream().distinct().toList(), ActivityValues.changes(before, action == ActivityAction.DELETED ? Map.of() : snapshot(rule)));
    }

    public static List<ActivityReference> ruleReferences(RegleAffectationQuittance rule) {
        return List.of(ActivityReference.of(ActivityRecordType.TIERS_COMPAGNIE, rule.getTiersCompagnie().getId(), rule.getTiersCompagnie().getNom()),
                new ActivityReference(ActivityRecordType.REFERENTIEL, "BRANCHE_ASSURANCE:" + rule.getBrancheAssurance().getId(), rule.getBrancheAssurance().getLibelle()));
    }

    private static String filename(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            var name = java.nio.file.Path.of(value.replace('\\', '/')).getFileName();
            return name == null ? null : name.toString();
        } catch (java.nio.file.InvalidPathException ignored) {
            return "Fichier source";
        }
    }
}
