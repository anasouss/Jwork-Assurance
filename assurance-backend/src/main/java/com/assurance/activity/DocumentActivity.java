package com.assurance.activity;

import com.assurance.entity.MouvementContrat;
import com.assurance.entity.PieceJointe;
import com.assurance.entity.TypePieceJointe;
import com.assurance.entity.DocumentPolicy;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class DocumentActivity {
    private DocumentActivity() {
    }

    public static ActivityReference reference(PieceJointe document) {
        String type = document.getTypePieceJointe() == null ? "Document" : document.getTypePieceJointe().getLibelle();
        return ActivityReference.of(ActivityRecordType.PIECE_JOINTE, document.getId(), type + " - " + document.getNomFichier());
    }

    public static ActivityReference movement(MouvementContrat movement) {
        String label = movement.getTypeMouvement() == null ? "Mouvement" : movement.getTypeMouvement().getLibelle();
        return ActivityReference.of(ActivityRecordType.MOUVEMENT_CONTRAT, movement.getId(),
                movement.getNumeroMouvement() == null ? label : label + " - " + movement.getNumeroMouvement());
    }

    public static Map<String, String> snapshot(PieceJointe document) {
        return new ActivityValues().put("Document", document.getTypePieceJointe() == null ? null : document.getTypePieceJointe().getLibelle())
                .put("Fichier", document.getNomFichier()).put("Validité", document.getExpiresOn())
                .put("Archivé", document.getArchived()).put("Motif", document.getChangeReason())
                .put("Titulaire", document.getClient() == null ? null : ClientActivity.reference(document.getClient()).label())
                .put("Véhicule", document.getVehicule() == null ? null : document.getVehicule().getImmatriculation())
                .snapshot();
    }

    public static Map<String, String> type(TypePieceJointe type) {
        return new ActivityValues().put("Document", type.getLibelle())
                .put("Nature", type.getNaturePieceJointe() == null ? null : type.getNaturePieceJointe().getLibelle())
                .put("Branche", type.getBrancheAssurance() == null ? null : type.getBrancheAssurance().getLibelle())
                .put("Type d'assistance", type.getTypeAssistance() == null ? null : switch (type.getTypeAssistance()) {
                    case VOYAGE -> "Assistance voyage";
                    case AUTOMOBILE -> "Assistance automobile";
                })
                .put("Type de contrat", type.getTypeContrat() == null ? null : switch (type.getTypeContrat()) {
                    case PARTICULIER -> "Mono";
                    case CONVENTION -> "Convention";
                    case FLOTTE -> "Flotte";
                })
                .put("Type de client", type.getTypeClient() == null ? null : switch (type.getTypeClient()) {
                    case PERSONNE_PHYSIQUE -> "Personne physique";
                    case PERSONNE_MORALE -> "Personne morale";
                })
                .put("Mouvement", type.getTypeMouvement() == null ? null : type.getTypeMouvement().getLibelle())
                .put("Obligatoire", type.getObligatoire()).put("Actif", type.getActif())
                .put("Ordre d'affichage", type.getOrdreAffichage()).snapshot();
    }

    public static Map<String, String> policy(DocumentPolicy policy) {
        return new ActivityValues().put("Rattachement", policy.getOwner() == null ? null : switch (policy.getOwner()) {
            case CLIENT -> "Client";
            case VEHICULE -> "Véhicule";
            case CONTRAT -> "Contrat";
            case MOUVEMENT -> "Mouvement";
        }).put("Validité", policy.getExpiry() == null ? null : switch (policy.getExpiry()) {
            case NONE -> "Sans date de validité";
            case OPTIONAL -> "Date de validité facultative";
            case REQUIRED -> "Date de validité obligatoire";
        }).put("Source de validité", policy.getValiditySource() == null ? null : switch (policy.getValiditySource()) {
            case MANUAL -> "Saisie manuelle";
            case CLIENT_CIN -> "Validité CIN du client";
            case CLIENT_PASSPORT -> "Validité passeport du client";
            case CLIENT_PERMIS -> "Validité permis du client";
            case VEHICULE_CARTE_GRISE -> "Validité carte grise du véhicule";
        }).snapshot();
    }

    public static List<ActivityReference> references(PieceJointe document) {
        List<ActivityReference> references = new ArrayList<>();
        if (document.getContrat() != null) references.add(ContractActivity.reference(document.getContrat()));
        if (document.getClient() != null) references.add(ClientActivity.reference(document.getClient()));
        if (document.getVehicule() != null) {
            var vehicle = document.getVehicule();
            references.add(ActivityReference.of(ActivityRecordType.VEHICULE, vehicle.getId(),
                    vehicle.getImmatriculation() == null ? "Véhicule" : vehicle.getImmatriculation()));
        }
        if (document.getMouvementContrat() != null) references.add(movement(document.getMouvementContrat()));
        if (document.getPreviousVersion() != null) references.add(reference(document.getPreviousVersion()));
        return references;
    }

    public static ActivityCommand command(PieceJointe document, ActivityModule module, ActivityAction action,
            String title, String origin, Map<String, String> before, Map<String, String> after,
            List<ActivityReference> additionalReferences) {
        var references = references(document);
        if (additionalReferences != null) references.addAll(additionalReferences);
        return new ActivityCommand(document.getAgence().getId(), module, action, title, origin,
                reference(document), references.stream().distinct().toList(), ActivityValues.changes(before, after));
    }
}
