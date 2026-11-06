package com.assurance.activity;

import com.assurance.entity.BordereauCompagnie;
import com.assurance.entity.LigneBordereauCompagnie;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public final class CompanyBordereauActivity {
    private CompanyBordereauActivity() {
    }

    public static Map<String, String> snapshot(BordereauCompagnie slip) {
        ActivityValues values = new ActivityValues().put("Numero", slip.getNumero())
                .put("Compagnie", slip.getTiersCompagnie().getNom())
                .put("Base du bordereau", slip.getBaseBordereau() == null ? null : switch (slip.getBaseBordereau()) {
                    case EMISSION -> "Emission";
                    case ENCAISSEMENT -> "Encaissement";
                })
                .put("Statut", slip.getStatut() == null ? null : switch (slip.getStatut()) {
                    case BROUILLON -> "Brouillon";
                    case VALIDE -> "Valide";
                    case TRANSMIS -> "Transmis";
                    case ANNULE -> "Annule";
                })
                .put("Rapprochement", slip.getStatutRapprochement() == null ? null : switch (slip.getStatutRapprochement()) {
                    case A_RAPPROCHER -> "A rapprocher";
                    case AVEC_ECART -> "Avec ecart";
                    case RAPPROCHE -> "Rapproche";
                })
                .put("Periode du", slip.getPeriodeDebut()).put("Periode au", slip.getPeriodeFin())
                .put("Validation", slip.getDateValidation()).put("Transmission", slip.getDateTransmission())
                .put("Canal de transmission", slip.getCanalTransmission()).put("Reference de transmission", slip.getReferenceTransmission())
                .put("Accuse de reception", slip.getDateAccuseReception()).put("Reference de reception", slip.getReferenceAccuseReception())
                .put("Prime nette", slip.getPrimeNette()).put("Taxes", slip.getMontantTaxes()).put("Accessoires", slip.getAccessoires())
                .put("Montant TTC", slip.getMontantTtc()).put("Commission nette", slip.getCommissionNette())
                .put("Retenue", slip.getMontantRetenue()).put("Net compagnie", slip.getNetCompagnie())
                .put("Ecart de rapprochement", slip.getEcartRapprochement()).put("Note de rapprochement", slip.getNoteRapprochement())
                .put("Notes", slip.getNotes()).put("Annulation", slip.getDateAnnulation()).put("Motif d'annulation", slip.getMotifAnnulation());
        int index = 0;
        for (var line : slip.getLignes().stream().sorted(Comparator.comparing(LigneBordereauCompagnie::getNumeroQuittanceCompagnie)
                .thenComparing(LigneBordereauCompagnie::getDateEffet)).toList()) {
            String prefix = "Quittance " + (++index) + " - ";
            values.put(prefix + "Numero compagnie", line.getNumeroQuittanceCompagnie()).put(prefix + "Dossier", line.getNumeroDossier())
                    .put(prefix + "Police", line.getNumeroPolice()).put(prefix + "Mouvement", line.getMouvement())
                    .put(prefix + "Date d'effet", line.getDateEffet()).put(prefix + "Date d'echeance", line.getDateEcheance())
                    .put(prefix + "Prime nette", line.getPrimeNette()).put(prefix + "Taxes", line.getMontantTaxes())
                    .put(prefix + "Accessoires", line.getAccessoires()).put(prefix + "Montant TTC", line.getMontantTtc())
                    .put(prefix + "Commission nette", line.getCommissionNette()).put(prefix + "Retenue", line.getMontantRetenue())
                    .put(prefix + "Net compagnie", line.getNetCompagnie());
        }
        return values.snapshot();
    }

    public static ActivityCommand command(BordereauCompagnie slip, Map<String, String> before, ActivityAction action,
            String title, String origin) {
        return new ActivityCommand(slip.getAgence().getId(), ActivityModule.COMPTABILITE_COMPAGNIE, action, title, origin,
                ActivityReference.of(ActivityRecordType.BORDEREAU_COMPAGNIE, slip.getId(), slip.getNumero()),
                references(slip), ActivityValues.changes(before, snapshot(slip)));
    }

    public static List<ActivityReference> references(BordereauCompagnie slip) {
        List<ActivityReference> references = new ArrayList<>();
        references.add(ActivityReference.of(ActivityRecordType.TIERS_COMPAGNIE, slip.getTiersCompagnie().getId(), slip.getTiersCompagnie().getNom()));
        for (var line : slip.getLignes()) {
            var source = line.getAffectationSource();
            references.add(ActivityReference.of(ActivityRecordType.AFFECTATION_QUITTANCE_COMPAGNIE, source.getId(), line.getNumeroQuittanceCompagnie()));
            references.add(CompanyAssignmentActivity.quittanceReference(source.getQuittance()));
            references.addAll(CompanyAssignmentActivity.quittanceReferences(source.getQuittance()));
        }
        return references.stream().distinct().toList();
    }
}
