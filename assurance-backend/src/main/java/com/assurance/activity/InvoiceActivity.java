package com.assurance.activity;

import com.assurance.entity.DocumentClient;
import com.assurance.enums.TypeDocumentClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** A statement/invoice is one business document, including its source lines. */
public final class InvoiceActivity {
    private InvoiceActivity() {
    }

    public static String name(DocumentClient document) {
        return document.getTypeDocument() == TypeDocumentClient.FACTURE ? "Facture" : "Releve";
    }

    public static ActivityReference reference(DocumentClient document) {
        return ActivityReference.of(ActivityRecordType.DOCUMENT_CLIENT, document.getId(), name(document) + " " + document.getNumero());
    }

    public static Map<String, String> snapshot(DocumentClient document) {
        ActivityValues values = new ActivityValues().put("Document", name(document)).put("Numero", document.getNumero())
                .put("Statut", document.getStatut() == null ? null : switch (document.getStatut()) {
                    case EMIS -> "Emis";
                    case REMPLACE -> "Remplace";
                    case ANNULE -> "Annule";
                })
                .put("Payeur", document.getPayeurNom()).put("Identifiant du payeur", document.getPayeurIdentifiant())
                .put("ICE", document.getPayeurIce()).put("Adresse", document.getPayeurAdresse())
                .put("Date d'emission", document.getDateEmission())
                .put("Periode du", document.getPeriodeDebut()).put("Periode au", document.getPeriodeFin())
                .put("Date d'echeance", document.getDateEcheance()).put("Delai de paiement (jours)", document.getDelaiPaiementJours())
                .put("Condition de paiement", document.getOrigineDelaiPaiement() == null ? null : switch (document.getOrigineDelaiPaiement()) {
                    case DEFAUT_60_JOURS -> "Delai par defaut";
                    case CONDITION_CLIENT -> "Condition du client";
                    case CONDITION_GROUPE -> "Condition du groupe";
                })
                .put("Debit", document.getTotalDebit()).put("Credit", document.getTotalCredit())
                .put("Montant du document", document.getTotalDocument()).put("Notes", document.getNotes())
                .put("Version", document.getVersionDocument())
                .put("Document d'origine", document.getDocumentOrigine() == null ? null : document.getDocumentOrigine().getNumero())
                .put("Date de remplacement", document.getDateRemplacement()).put("Motif de remplacement", document.getMotifRemplacement())
                .put("Date d'annulation", document.getDateAnnulation()).put("Motif d'annulation", document.getMotifAnnulation());
        int index = 0;
        for (var line : document.getLignes()) {
            String prefix = "Ligne " + (++index) + " - ";
            values.put(prefix + "Dossier", line.getNumeroDossier()).put(prefix + "Police", line.getNumeroPolice())
                    .put(prefix + "Quittance", line.getNumeroQuittance()).put(prefix + "Mouvement", line.getMouvement())
                    .put(prefix + "Libelle", line.getLibelleDocument()).put(prefix + "Compagnie", line.getCompagnie())
                    .put(prefix + "Du", line.getDateOperation()).put(prefix + "Au", line.getDateEcheance())
                    .put(prefix + "Prime nette", line.getPrimeNette()).put(prefix + "Taxes", line.getTaxes())
                    .put(prefix + "Accessoires", line.getAccessoires()).put(prefix + "Montant TTC", line.getMontantTtc())
                    .put(prefix + "Debit", line.getDebit()).put(prefix + "Credit", line.getCredit())
                    .put(prefix + "Ecart de reglement", line.getEcartReglement());
            if (line.getEcheanceFacturationConvention() != null) {
                values.put(prefix + "Periode de convention", line.getEcheanceFacturationConvention().getNumeroPeriode());
            }
        }
        return values.snapshot();
    }

    public static ActivityCommand command(DocumentClient document, Map<String, String> before,
            ActivityAction action, String title, String origin, List<ActivityReference> additionalReferences) {
        List<ActivityReference> references = new ArrayList<>();
        if (document.getClientPayeur() != null) references.add(ClientActivity.reference(document.getClientPayeur()));
        if (document.getGroupePayeur() != null) references.add(ClientGroupActivity.reference(document.getGroupePayeur()));
        if (document.getDocumentOrigine() != null) references.add(reference(document.getDocumentOrigine()));
        for (var line : document.getLignes()) {
            if (line.getQuittance() != null) references.add(ActivityReference.of(ActivityRecordType.QUITTANCE,
                    line.getQuittance().getId(), line.getNumeroQuittance() == null ? "Quittance" : line.getNumeroQuittance()));
            if (line.getElementFacturable() != null) {
                var element = line.getElementFacturable();
                String label = (line.getNumeroDossier() == null ? "Ecriture" : line.getNumeroDossier())
                        + (line.getMouvement() == null ? "" : " - " + line.getMouvement());
                references.add(ActivityReference.of(ActivityRecordType.ELEMENT_FACTURABLE, element.getId(), label));
                if (element.getContrat() != null) references.add(ContractActivity.reference(element.getContrat()));
                if (element.getMouvementContrat() != null) references.add(DocumentActivity.movement(element.getMouvementContrat()));
            }
            if (line.getEcheanceFacturationConvention() != null) {
                var schedule = line.getEcheanceFacturationConvention();
                references.add(ActivityReference.of(ActivityRecordType.ECHEANCE_FACTURATION_CONVENTION,
                        schedule.getId(), "Periode " + schedule.getNumeroPeriode() + " - " + line.getNumeroDossier()));
            }
        }
        if (additionalReferences != null) references.addAll(additionalReferences);
        return new ActivityCommand(document.getAgence().getId(), ActivityModule.COMPTABILITE_CLIENT,
                action, title, origin, reference(document), references.stream().distinct().toList(),
                ActivityValues.changes(before, snapshot(document)));
    }
}
