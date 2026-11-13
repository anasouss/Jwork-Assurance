package com.assurance.activity;

import com.assurance.entity.CarteVerte;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class GreenCardActivity {
    private GreenCardActivity() {
    }

    public static ActivityReference reference(CarteVerte card) {
        return ActivityReference.of(ActivityRecordType.CARTE_VERTE, card.getId(),
                card.getNumero() == null || card.getNumero().isBlank() ? "Carte verte" : "Carte verte - " + card.getNumero());
    }

    public static Map<String, String> snapshot(CarteVerte card) {
        ActivityValues values = new ActivityValues().put("Numéro", card.getNumero())
                .put("Immatriculation", card.getImmatriculation()).put("Marque", card.getMarque())
                .put("Compagnie", card.getCompagnieAssurance() == null ? null : card.getCompagnieAssurance().getNom())
                .put("Date d'effet", card.getDateEffet()).put("Date d'échéance", card.getDateEcheance())
                .put("Montant", card.getMontant()).put("Actif", card.getActif());
        AssistanceActivity.billableValues(values, card.getElementFacturable());
        return values.snapshot();
    }

    public static List<ActivityReference> references(CarteVerte card) {
        List<ActivityReference> references = AssistanceActivity.context(card.getContrat(), card.getMouvementContrat(),
                card.getVehicule(), card.getElementFacturable());
        if (card.getCompagnieAssurance() != null) references.add(ActivityReference.of(ActivityRecordType.COMPAGNIE,
                card.getCompagnieAssurance().getId(), card.getCompagnieAssurance().getNom()));
        return references;
    }

    public static ActivityCommand command(CarteVerte card, Map<String, String> before, List<ActivityReference> previousReferences,
            ActivityAction action, String title, String origin) {
        List<ActivityReference> references = new ArrayList<>(previousReferences);
        references.addAll(references(card));
        return new ActivityCommand(card.getContrat().getAgence().getId(), ActivityModule.PRODUCTION, action, title, origin,
                reference(card), references.stream().distinct().toList(), ActivityValues.changes(before, snapshot(card)));
    }
}
