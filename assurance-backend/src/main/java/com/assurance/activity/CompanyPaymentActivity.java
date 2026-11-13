package com.assurance.activity;

import com.assurance.entity.InstrumentReglementCompagnie;
import com.assurance.entity.ReglementCompagnie;
import com.assurance.enums.ModeReglementCompagnie;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public final class CompanyPaymentActivity {
    private CompanyPaymentActivity() {
    }

    public static ActivityReference reference(InstrumentReglementCompagnie instrument) {
        return ActivityReference.of(ActivityRecordType.INSTRUMENT_REGLEMENT_COMPAGNIE, instrument.getId(),
                mode(instrument.getMode()) + (instrument.getReferenceInstrument() == null ? "" : " - " + instrument.getReferenceInstrument()));
    }

    public static Map<String, String> snapshot(ReglementCompagnie payment) {
        ActivityValues values = new ActivityValues().put("Numéro", payment.getNumero())
                .put("Compagnie", payment.getTiersCompagnie().getNom()).put("Date de règlement", payment.getDateReglement())
                .put("Statut", payment.getStatut() == null ? null : switch (payment.getStatut()) {
                    case VALIDE -> "Enregistré";
                    case ANNULE -> "Annulé";
                })
                .put("Montant total", payment.getMontantTotal()).put("Montant non affecte", payment.getMontantNonAffecte())
                .put("Notes", payment.getNotes()).put("Date d'annulation", payment.getDateAnnulation())
                .put("Motif d'annulation", payment.getMotifAnnulation());
        int index = 0;
        for (var instrument : payment.getInstruments().stream().sorted(Comparator.comparing(InstrumentReglementCompagnie::getId)).toList()) {
            String prefix = "Moyen " + (++index) + " - ";
            values.put(prefix + "Mode", mode(instrument.getMode())).put(prefix + "Référence", instrument.getReferenceInstrument())
                    .put(prefix + "Montant", instrument.getMontant()).put(prefix + "Date", instrument.getDateInstrument())
                    .put(prefix + "Échéance", instrument.getDateEcheance()).put(prefix + "Banque bénéficiaire", instrument.getBanqueBeneficiaire())
                    .put(prefix + "Compte", TreasuryActivity.accountLabel(instrument.getCompteTresorerie()))
                    .put(prefix + "Statut", instrument.getStatut() == null ? null : switch (instrument.getStatut()) {
                        case EN_ATTENTE -> "En attente";
                        case REMIS_EN_BANQUE -> "Remis en banque";
                        case CONFIRME -> "Confirmé";
                        case REJETE -> "Rejeté";
                        case REMPLACE -> "Remplacé";
                    })
                    .put(prefix + "Date de statut", instrument.getDateStatut()).put(prefix + "Motif", instrument.getMotifStatut())
                    .put(prefix + "Moyen remplacé", instrument.getInstrumentRemplace() == null ? null : reference(instrument.getInstrumentRemplace()).label());
            int allocationIndex = 0;
            for (var allocation : instrument.getAffectations().stream().sorted(Comparator.comparing(row -> row.getBordereau().getId())).toList()) {
                String allocationPrefix = prefix + "Affectation " + (++allocationIndex) + " - ";
                values.put(allocationPrefix + "Bordereau", allocation.getBordereau().getNumero()).put(allocationPrefix + "Montant", allocation.getMontant())
                        .put(allocationPrefix + "Statut", allocation.getStatut() == null ? null : switch (allocation.getStatut()) {
                            case EN_ATTENTE -> "En attente";
                            case CONFIRMEE -> "Confirmée";
                            case ANNULEE -> "Annulée";
                        });
            }
        }
        return values.snapshot();
    }

    public static ActivityCommand command(ReglementCompagnie payment, Map<String, String> before, ActivityAction action,
            String title, String origin, InstrumentReglementCompagnie subjectInstrument) {
        ActivityReference paymentReference = ActivityReference.of(ActivityRecordType.REGLEMENT_COMPAGNIE, payment.getId(), payment.getNumero());
        List<ActivityReference> references = new ArrayList<>();
        references.add(ActivityReference.of(ActivityRecordType.TIERS_COMPAGNIE, payment.getTiersCompagnie().getId(), payment.getTiersCompagnie().getNom()));
        if (subjectInstrument != null) references.add(paymentReference);
        for (var instrument : payment.getInstruments()) {
            if (subjectInstrument == null || !subjectInstrument.getId().equals(instrument.getId())) references.add(reference(instrument));
            if (instrument.getCompteTresorerie() != null) references.add(TreasuryActivity.reference(instrument.getCompteTresorerie()));
            for (var allocation : instrument.getAffectations()) references.add(ActivityReference.of(ActivityRecordType.BORDEREAU_COMPAGNIE,
                    allocation.getBordereau().getId(), allocation.getBordereau().getNumero()));
        }
        return new ActivityCommand(payment.getAgence().getId(), ActivityModule.COMPTABILITE_COMPAGNIE, action, title, origin,
                subjectInstrument == null ? paymentReference : reference(subjectInstrument), references.stream().distinct().toList(),
                ActivityValues.changes(before, snapshot(payment)));
    }

    private static String mode(ModeReglementCompagnie mode) {
        return mode == null ? "Moyen de paiement compagnie" : switch (mode) {
            case VIREMENT -> "Virement";
            case CHEQUE -> "Chèque";
            case EFFET -> "Effet";
            case COMPENSATION -> "Compensation";
        };
    }
}
