package com.assurance.activity;

import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutSuiviRejetBancaire;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public final class PaymentActivity {
    private PaymentActivity() {
    }

    public static ActivityReference reference(ReglementClient payment) {
        return ActivityReference.of(ActivityRecordType.REGLEMENT_CLIENT, payment.getId(),
                text(payment.getNumero(), "Règlement client"));
    }

    public static ActivityReference reference(InstrumentReglementClient instrument) {
        return ActivityReference.of(ActivityRecordType.INSTRUMENT_REGLEMENT, instrument.getId(),
                mode(instrument.getMode()) + (instrument.getReferenceInstrument() == null ? ""
                        : " - " + instrument.getReferenceInstrument()));
    }

    public static Map<String, String> snapshot(ReglementClient payment) {
        ActivityValues values = header(payment);
        values.put("Justificatif", payment.getBordereauNomFichier()).put("Notes", payment.getNotes())
                .put("Date d'annulation", payment.getDateAnnulation()).put("Motif d'annulation", payment.getMotifAnnulation());
        int index = 0;
        for (var instrument : payment.getInstruments().stream()
                .sorted(Comparator.comparing(InstrumentReglementClient::getId, Comparator.nullsLast(Comparator.naturalOrder()))).toList()) {
            instrumentValues(values, instrument, "Moyen " + (++index) + " - ");
        }
        index = 0;
        for (var adjustment : payment.getEcarts().stream()
                .sorted(Comparator.comparing(e -> e.getElementFacturable().getId())).toList()) {
            String prefix = "Écart " + (++index) + " - ";
            values.put(prefix + "Écriture", sourceLabel(adjustment.getElementFacturable()))
                    .put(prefix + "Document", adjustment.getDocumentClient() == null ? null : adjustment.getDocumentClient().getNumero())
                    .put(prefix + "Montant", adjustment.getMontant()).put(prefix + "Motif", adjustment.getMotif());
        }
        return values.snapshot();
    }

    public static Map<String, String> instrumentSnapshot(InstrumentReglementClient instrument) {
        ActivityValues values = header(instrument.getReglement());
        instrumentValues(values, instrument, "Moyen - ");
        return values.snapshot();
    }

    private static ActivityValues header(ReglementClient payment) {
        return new ActivityValues().put("Règlement", payment.getNumero()).put("Date du règlement", payment.getDateReglement())
                .put("Sens", payment.getSens() == com.assurance.enums.SensMouvementTresorerie.SORTIE ? "Décaissement" : "Encaissement")
                .put("Payeur", payment.getPayeurNom()).put("Multi-clients", payment.getMultiPayeur())
                .put("Déposant", payment.getDeposantNom()).put("Montant total", payment.getMontantTotal())
                .put("Montant non affecte", payment.getMontantNonAffecte())
                .put("Statut du règlement", payment.getStatut() == null ? null : switch (payment.getStatut()) {
                    case VALIDE -> "Enregistré";
                    case ANNULE -> "Annulé";
                });
    }

    private static void instrumentValues(ActivityValues values, InstrumentReglementClient instrument, String prefix) {
        values.put(prefix + "Mode", mode(instrument.getMode()))
                .put(prefix + "Référence", instrument.getReferenceInstrument()).put(prefix + "Montant", instrument.getMontant())
                .put(prefix + "Réception", instrument.getDateInstrument()).put(prefix + "Échéance", instrument.getDateEcheance())
                .put(prefix + "Banque émettrice", instrument.getBanqueEmettriceReference() == null ? null : instrument.getBanqueEmettriceReference().getLibelle())
                .put(prefix + "Compte de trésorerie", instrument.getCompteTresorerie() == null ? null
                        : instrument.getCompteTresorerie().getCode() + " - " + instrument.getCompteTresorerie().getLibelle())
                .put(prefix + "Règlement au bureau", instrument.getReglementBureau())
                .put(prefix + "Statut", instrument.getStatut() == null ? null : switch (instrument.getStatut()) {
                    case EN_ATTENTE -> "En attente d'encaissement";
                    case REMIS_EN_BANQUE -> "Remis en banque";
                    case CONFIRME -> "Encaisse";
                    case REJETE -> "Rejeté";
                    case REMPLACE -> "Remplacé";
                })
                .put(prefix + "Date de traitement", instrument.getDateStatut()).put(prefix + "Motif", instrument.getMotifStatut())
                .put(prefix + "Date de rejet", instrument.getDateRejet()).put(prefix + "Motif de rejet", instrument.getMotifRejet())
                .put(prefix + "Suivi du rejet", rejectionStatus(instrument.getSuiviRejet()))
                .put(prefix + "Moyen remplacé", instrument.getInstrumentRemplace() == null ? null : reference(instrument.getInstrumentRemplace()).label());
        int index = 0;
        for (var allocation : instrument.getAffectations().stream().sorted(Comparator.comparing(PaymentActivity::allocationKey)).toList()) {
            String allocationPrefix = prefix + "Affectation " + (++index) + " - ";
            values.put(allocationPrefix + "Écriture", allocation.getElementFacturable() == null ? null : sourceLabel(allocation.getElementFacturable()))
                    .put(allocationPrefix + "Document", allocation.getDocumentClient() == null ? null : allocation.getDocumentClient().getNumero())
                    .put(allocationPrefix + "Payeur", allocation.getPayeurNomSnapshot()).put(allocationPrefix + "Montant", allocation.getMontant())
                    .put(allocationPrefix + "Statut", allocation.getStatut() == null ? null : switch (allocation.getStatut()) {
                        case EN_ATTENTE -> "En attente";
                        case CONFIRMEE -> "Confirmée";
                        case ANNULEE -> "Annulée";
                    });
        }
    }

    public static ActivityCommand command(ReglementClient payment, Map<String, String> before,
            ActivityAction action, String title, String origin, ActivityReference subject) {
        List<ActivityReference> references = new ArrayList<>(payerReferences(payment));
        references.add(reference(payment));
        for (var instrument : payment.getInstruments()) {
            if (instrument.getId() != null) references.add(reference(instrument));
            references.addAll(instrumentReferences(instrument));
        }
        for (var adjustment : payment.getEcarts()) {
            addSourceReferences(references, adjustment.getElementFacturable());
            if (adjustment.getDocumentClient() != null) references.add(InvoiceActivity.reference(adjustment.getDocumentClient()));
        }
        ActivityReference primary = subject == null ? reference(payment) : subject;
        return new ActivityCommand(payment.getAgence().getId(), ActivityModule.COMPTABILITE_CLIENT, action, title, origin,
                primary, withoutSubject(references, primary), allocationContext(payment, ActivityValues.changes(before, snapshot(payment))));
    }

    private static List<ActivityChange> allocationContext(ReglementClient payment, List<ActivityChange> changes) {
        List<ActivityChange> result = new ArrayList<>(changes);
        int index = 0;
        for (var instrument : payment.getInstruments().stream()
                .sorted(Comparator.comparing(InstrumentReglementClient::getId, Comparator.nullsLast(Comparator.naturalOrder()))).toList()) {
            String prefix = "Moyen " + (++index) + " - Affectation ";
            // Keep the instrument reference with allocation-only changes, where the
            // unchanged instrument header would otherwise be absent from the event.
            changes.stream().filter(change -> change.label().startsWith(prefix))
                    .map(change -> change.label().substring(0, change.label().lastIndexOf(" - ")))
                    .distinct().forEach(group -> result.add(new ActivityChange(
                            group + " - Moyen de paiement", null, reference(instrument).label())));
        }
        return List.copyOf(result);
    }

    public static ActivityCommand instrumentCommand(InstrumentReglementClient instrument, Map<String, String> before,
            ActivityAction action, String title, String origin) {
        var references = new ArrayList<>(payerReferences(instrument.getReglement()));
        references.add(reference(instrument.getReglement()));
        references.addAll(instrumentReferences(instrument));
        return new ActivityCommand(instrument.getAgence().getId(), ActivityModule.COMPTABILITE_CLIENT, action, title, origin,
                reference(instrument), withoutSubject(references, reference(instrument)),
                ActivityValues.changes(before, instrumentSnapshot(instrument)));
    }

    private static List<ActivityReference> payerReferences(ReglementClient payment) {
        List<ActivityReference> references = new ArrayList<>();
        if (payment.getClientPayeur() != null) references.add(ClientActivity.reference(payment.getClientPayeur()));
        if (payment.getGroupePayeur() != null) references.add(ClientGroupActivity.reference(payment.getGroupePayeur()));
        if (payment.getConventionPayeur() != null) references.add(ActivityReference.of(ActivityRecordType.CONVENTION,
                payment.getConventionPayeur().getId(), payment.getPayeurNom()));
        return references;
    }

    private static List<ActivityReference> instrumentReferences(InstrumentReglementClient instrument) {
        List<ActivityReference> references = new ArrayList<>();
        if (instrument.getInstrumentRemplace() != null) references.add(reference(instrument.getInstrumentRemplace()));
        if (instrument.getCompteTresorerie() != null) references.add(ActivityReference.of(ActivityRecordType.COMPTE_TRESORERIE,
                instrument.getCompteTresorerie().getId(), instrument.getCompteTresorerie().getCode() + " - " + instrument.getCompteTresorerie().getLibelle()));
        for (var allocation : instrument.getAffectations()) {
            if (allocation.getElementFacturable() != null) addSourceReferences(references, allocation.getElementFacturable());
            if (allocation.getDocumentClient() != null) references.add(InvoiceActivity.reference(allocation.getDocumentClient()));
            if (allocation.getClientPayeur() != null) references.add(ClientActivity.reference(allocation.getClientPayeur()));
            if (allocation.getGroupePayeur() != null) references.add(ClientGroupActivity.reference(allocation.getGroupePayeur()));
            if (allocation.getConventionPayeur() != null) references.add(ActivityReference.of(ActivityRecordType.CONVENTION,
                    allocation.getConventionPayeur().getId(), allocation.getPayeurNomSnapshot()));
        }
        return references;
    }

    private static void addSourceReferences(List<ActivityReference> references, ElementFacturable source) {
        references.add(ActivityReference.of(ActivityRecordType.ELEMENT_FACTURABLE, source.getId(), sourceLabel(source)));
        if (source.getContrat() != null) references.add(ContractActivity.reference(source.getContrat()));
        if (source.getMouvementContrat() != null) references.add(DocumentActivity.movement(source.getMouvementContrat()));
    }

    private static String sourceLabel(ElementFacturable source) {
        return (source.getContrat() == null ? "Écriture" : ContractActivity.reference(source.getContrat()).label())
                + (source.getReferenceSource() == null ? "" : " - " + source.getReferenceSource())
                + (source.getLibelle() == null ? "" : " - " + source.getLibelle());
    }

    private static String allocationKey(AffectationReglementClient allocation) {
        return (allocation.getDocumentClient() == null ? "" : allocation.getDocumentClient().getId()) + ":"
                + (allocation.getElementFacturable() == null ? "" : allocation.getElementFacturable().getId()) + ":"
                + (allocation.getClientPayeur() == null ? "" : allocation.getClientPayeur().getId()) + ":"
                + (allocation.getGroupePayeur() == null ? "" : allocation.getGroupePayeur().getId());
    }

    private static List<ActivityReference> withoutSubject(List<ActivityReference> references, ActivityReference subject) {
        return references.stream().filter(ref -> ref.type() != subject.type() || !ref.id().equals(subject.id())).distinct().toList();
    }

    public static String rejectionStatus(StatutSuiviRejetBancaire status) {
        if (status == null) return null;
        return switch (status) {
            case INSTANCE -> "En instance";
            case REPRESENTE -> "Représenté";
            case REGLE_CV -> "Réglé C/V";
            case CONTENTIEUX -> "Contentieux";
        };
    }

    public static String mode(ModeReglementClient mode) {
        if (mode == null) return "Moyen de paiement";
        return switch (mode) {
            case ESPECES -> "Espèces";
            case CHEQUE -> "Chèque";
            case EFFET -> "Effet";
            case VIREMENT -> "Virement";
            case VERSEMENT_BANCAIRE -> "Versement bancaire";
        };
    }

    private static String text(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
