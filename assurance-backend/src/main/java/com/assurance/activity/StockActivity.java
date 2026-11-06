package com.assurance.activity;

import com.assurance.entity.AttestationStock;
import com.assurance.entity.LivraisonAttestation;
import com.assurance.entity.SeuilStockAttestation;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public final class StockActivity {
    private StockActivity() {
    }

    public static Map<String, String> snapshot(AttestationStock stock) {
        return new ActivityValues().put("Numero d'attestation", stock.getNumero())
                .put("Compagnie", stock.getCompagnieAssurance().getNom())
                .put("Groupe d'usage", stock.getGroupeUsageAttestation().getLibelle())
                .put("Statut", stock.getStatut() == null ? null : switch (stock.getStatut()) {
                    case DISPONIBLE -> "Disponible";
                    case RESERVEE -> "Reservee";
                    case UTILISEE -> "Utilisee";
                    case ANNULEE -> "Annulee";
                    case DESACTIVEE -> "Desactivee";
                })
                .put("Dossier", stock.getNumeroDossier()).put("Police", stock.getNumeroPolice())
                .put("Vehicule", stock.getVehicule() == null ? null : stock.getVehicule().getImmatriculation())
                .put("Remorque", stock.getRemorque() == null ? null : stock.getRemorque().getImmatriculation())
                .put("Date d'utilisation", stock.getDateUtilisation()).put("Date d'annulation", stock.getDateAnnulation())
                .put("Motif d'annulation", stock.getMotifAnnulation()).snapshot();
    }

    public static List<ActivityReference> references(AttestationStock stock) {
        List<ActivityReference> references = new ArrayList<>();
        references.add(ActivityReference.of(ActivityRecordType.COMPAGNIE, stock.getCompagnieAssurance().getId(), stock.getCompagnieAssurance().getNom()));
        references.add(deliveryReference(stock.getLot().getLivraison()));
        if (stock.getContrat() != null) references.add(ActivityReference.of(ActivityRecordType.CONTRAT,
                stock.getContrat().getId(), label(stock.getContrat().getNumeroDossier(), "Contrat")));
        if (stock.getMouvementContrat() != null) references.add(ActivityReference.of(ActivityRecordType.MOUVEMENT_CONTRAT,
                stock.getMouvementContrat().getId(), "Mouvement " + stock.getMouvementContrat().getNumeroMouvement()));
        if (stock.getVehicule() != null) references.add(ActivityReference.of(ActivityRecordType.VEHICULE,
                stock.getVehicule().getId(), label(stock.getVehicule().getImmatriculation(), "Vehicule")));
        if (stock.getRemorque() != null) references.add(ActivityReference.of(ActivityRecordType.REMORQUE,
                stock.getRemorque().getId(), label(stock.getRemorque().getImmatriculation(), "Remorque")));
        return references;
    }

    public static ActivityCommand command(AttestationStock stock, Map<String, String> before, List<ActivityReference> oldReferences,
            ActivityAction action, String title, String origin) {
        List<ActivityReference> references = new ArrayList<>(references(stock));
        if (oldReferences != null) references.addAll(oldReferences);
        return new ActivityCommand(stock.getLot().getLivraison().getAgence().getId(), ActivityModule.STOCK_ATTESTATIONS,
                action, title, origin, ActivityReference.of(ActivityRecordType.ATTESTATION, stock.getId(), stock.getNumero()),
                references.stream().distinct().toList(), ActivityValues.changes(before, snapshot(stock)));
    }

    public static ActivityReference deliveryReference(LivraisonAttestation delivery) {
        return ActivityReference.of(ActivityRecordType.LIVRAISON_ATTESTATIONS, delivery.getId(),
                delivery.getReferenceCommande() == null ? "Livraison d'attestations" : delivery.getReferenceCommande());
    }

    public static Map<String, String> snapshot(LivraisonAttestation delivery) {
        ActivityValues values = new ActivityValues().put("Reference commande", delivery.getReferenceCommande())
                .put("Compagnie", delivery.getCompagnieAssurance().getNom())
                .put("Origine", delivery.getSource() == null ? null : switch (delivery.getSource()) {
                    case COMMANDE -> "Commande";
                    case RECEPTION_DIRECTE -> "Reception directe";
                })
                .put("Statut", delivery.getStatut() == null ? null : switch (delivery.getStatut()) {
                    case DEMANDEE -> "Demandee";
                    case REFUSEE -> "Refusee";
                    case RECEPTION_PARTIELLE -> "Reception partielle";
                    case RECEPTION_COMPLETE -> "Reception complete";
                    case VALIDEE -> "Validee";
                })
                .put("Date de demande", delivery.getDateDemande()).put("Date de reception", delivery.getDateReception())
                .put("Reference BL", delivery.getReferenceBl()).put("Quantite demandee", delivery.getQuantiteDemandee())
                .put("Quantite recue", delivery.getQuantiteRecue()).put("Commentaire", delivery.getCommentaireDecision());
        int index = 0;
        for (var line : delivery.getLignes().stream().sorted(Comparator.comparing(row -> row.getGroupeUsageAttestation().getId())).toList()) {
            String prefix = "Demande " + (++index) + " - ";
            values.put(prefix + "Usage", line.getGroupeUsageAttestation().getLibelle())
                    .put(prefix + "Quantite demandee", line.getQuantiteDemandee()).put(prefix + "Quantite recue", line.getQuantiteRecue());
        }
        index = 0;
        for (var lot : delivery.getLots().stream().sorted(Comparator.comparing(row -> row.getId())).toList()) {
            String prefix = "Lot " + (++index) + " - ";
            values.put(prefix + "Usage", lot.getGroupeUsageAttestation().getLibelle()).put(prefix + "Prefixe", lot.getPrefixe())
                    .put(prefix + "Serie debut", lot.getNumeroDebut()).put(prefix + "Serie fin", lot.getNumeroFin())
                    .put(prefix + "Quantite", lot.getQuantite());
        }
        return values.snapshot();
    }

    public static ActivityCommand deliveryCommand(LivraisonAttestation delivery, Map<String, String> before,
            ActivityAction action, String title, String origin) {
        List<ActivityReference> references = new ArrayList<>();
        references.add(ActivityReference.of(ActivityRecordType.COMPAGNIE, delivery.getCompagnieAssurance().getId(), delivery.getCompagnieAssurance().getNom()));
        delivery.getLots().forEach(lot -> references.add(ActivityReference.of(ActivityRecordType.LOT_ATTESTATIONS,
                lot.getId(), "Lot " + lot.getNumeroDebut() + " - " + lot.getNumeroFin())));
        return new ActivityCommand(delivery.getAgence().getId(), ActivityModule.STOCK_ATTESTATIONS, action, title, origin,
                deliveryReference(delivery), references, ActivityValues.changes(before, snapshot(delivery)));
    }

    public static Map<String, String> snapshot(SeuilStockAttestation threshold) {
        return new ActivityValues().put("Compagnie", threshold.getCompagnieAssurance().getNom())
                .put("Groupe d'usage", threshold.getGroupeUsageAttestation().getLibelle())
                .put("Stock minimum", threshold.getMinimumStock()).put("Actif", threshold.getActif()).snapshot();
    }

    public static ActivityCommand thresholdCommand(SeuilStockAttestation threshold, Map<String, String> before, boolean created) {
        return new ActivityCommand(threshold.getAgence().getId(), ActivityModule.STOCK_ATTESTATIONS,
                created ? ActivityAction.CREATED : ActivityAction.UPDATED,
                created ? "Seuil de stock cree" : "Seuil de stock modifie", "ATTESTATION_STOCK_THRESHOLD",
                ActivityReference.of(ActivityRecordType.SEUIL_STOCK_ATTESTATION, threshold.getId(),
                        threshold.getCompagnieAssurance().getNom() + " - " + threshold.getGroupeUsageAttestation().getLibelle()),
                List.of(ActivityReference.of(ActivityRecordType.COMPAGNIE, threshold.getCompagnieAssurance().getId(), threshold.getCompagnieAssurance().getNom())),
                ActivityValues.changes(before, snapshot(threshold)));
    }

    private static String label(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
