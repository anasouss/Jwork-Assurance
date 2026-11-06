package com.assurance.activity;

import com.assurance.dto.response.AcquisitionClientResponse;
import com.assurance.entity.OrigineCommerciale;
import com.assurance.enums.TypeOrigineCommerciale;

import java.util.Map;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;

public final class AcquisitionActivity {
    private AcquisitionActivity() {
    }

    public static Map<String, String> snapshot(AcquisitionClientResponse acquisition) {
        if (acquisition == null) return Map.of();
        return new ActivityValues().put("Origine commerciale", acquisition.getOrigineLibelle())
                .put("Collaborateur prescripteur", acquisition.getRecommandeParUtilisateurNom())
                .put("Client prescripteur", acquisition.getRecommandeParClientNom())
                .put("Date d'acquisition", acquisition.getDateAcquisition())
                .put("Notes commerciales", acquisition.getNotes()).snapshot();
    }

    public static List<ActivityChange> changes(AcquisitionClientResponse before, AcquisitionClientResponse after) {
        List<ActivityChange> changes = new ArrayList<>(ActivityValues.changes(snapshot(before), snapshot(after)));
        if (before != null) {
            referenceChange(changes, "Origine commerciale", before.getOrigineCommercialeId(), after.getOrigineCommercialeId());
            referenceChange(changes, "Collaborateur prescripteur", before.getRecommandeParUtilisateurId(), after.getRecommandeParUtilisateurId());
            referenceChange(changes, "Client prescripteur", before.getRecommandeParClientId(), after.getRecommandeParClientId());
        }
        return List.copyOf(changes);
    }

    public static List<ActivityReference> references(AcquisitionClientResponse before, AcquisitionClientResponse after) {
        Map<String, ActivityReference> references = new LinkedHashMap<>();
        addReferences(references, before);
        addReferences(references, after);
        return List.copyOf(references.values());
    }

    private static void addReferences(Map<String, ActivityReference> references, AcquisitionClientResponse acquisition) {
        if (acquisition == null) return;
        addReference(references, ActivityRecordType.ORIGINE_COMMERCIALE, acquisition.getOrigineCommercialeId(), acquisition.getOrigineLibelle(), "Origine commerciale");
        addReference(references, ActivityRecordType.UTILISATEUR, acquisition.getRecommandeParUtilisateurId(), acquisition.getRecommandeParUtilisateurNom(), "Collaborateur prescripteur");
        addReference(references, ActivityRecordType.CLIENT, acquisition.getRecommandeParClientId(), acquisition.getRecommandeParClientNom(), "Client prescripteur");
    }

    private static void addReference(Map<String, ActivityReference> references, ActivityRecordType type, Long id, String name, String fallback) {
        if (id == null) return;
        references.put(type + ":" + id, ActivityReference.of(type, id, name == null || name.isBlank() ? fallback : name));
    }

    private static void referenceChange(List<ActivityChange> changes, String label, Long before, Long after) {
        if (!Objects.equals(before, after) && changes.stream().noneMatch(change -> label.equals(change.label()))) {
            changes.add(new ActivityChange(label, null, "Selection actualisee"));
        }
    }

    public static Map<String, String> origin(OrigineCommerciale origin) {
        return new ActivityValues().put("Code", origin.getCode()).put("Libellé", origin.getLibelle())
                .put("Type d'origine", type(origin.getType())).put("Actif", origin.getActif())
                .put("Ordre d'affichage", origin.getOrdre()).snapshot();
    }

    private static String type(TypeOrigineCommerciale type) {
        if (type == null) return null;
        return switch (type) {
            case PASSAGE_AGENCE -> "Passage en agence";
            case COLLABORATEUR -> "Collaborateur";
            case CLIENT -> "Client";
            case PARTENAIRE -> "Partenaire";
            case CAMPAGNE -> "Campagne";
            case SITE_WEB -> "Site web";
            case RESEAUX_SOCIAUX -> "Réseaux sociaux";
            case AUTRE -> "Autre";
        };
    }
}
