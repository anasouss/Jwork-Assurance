package com.assurance.activity;

import com.assurance.entity.BordereauRemise;
import com.assurance.entity.CompteTresorerie;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public final class BankRemittanceActivity {
    private BankRemittanceActivity() {
    }

    public static ActivityReference reference(BordereauRemise slip) {
        return ActivityReference.of(ActivityRecordType.BORDEREAU_BANCAIRE, slip.getId(), slip.getNumero());
    }

    public static Map<String, String> snapshot(BordereauRemise slip) {
        ActivityValues values = new ActivityValues().put("Bordereau", slip.getNumero())
                .put("Type", slip.getType() == null ? null : switch (slip.getType()) {
                    case CHEQUE -> "Remise de cheques";
                    case EFFET -> "Remise d'effets";
                    case VERSEMENT_ESPECES -> "Versement d'especes";
                })
                .put("Statut", slip.getStatut() == null ? null : switch (slip.getStatut()) {
                    case BROUILLON -> "Provisoire";
                    case DEPOSE -> "Remis a la banque";
                    case PARTIELLEMENT_TRAITE -> "Partiellement traite";
                    case CLOTURE -> "Cloture";
                    case ANNULE -> "Annule";
                })
                .put("Date du bordereau", slip.getDateBordereau()).put("Date de remise", slip.getDateDepot())
                .put("Compte destinataire", account(slip.getCompteDestination())).put("Compte source", account(slip.getCompteSource()))
                .put("Montant total", slip.getMontantTotal()).put("Reference bancaire", slip.getReferenceBancaire()).put("Notes", slip.getNotes());
        int index = 0;
        for (var line : slip.getLignes().stream().sorted(Comparator.comparing(l -> l.getInstrument().getId())).toList()) {
            String prefix = "Moyen " + (++index) + " - ";
            values.put(prefix + "Reference", PaymentActivity.reference(line.getInstrument()).label())
                    .put(prefix + "Reglement", line.getInstrument().getReglement().getNumero())
                    .put(prefix + "Payeur", line.getInstrument().getReglement().getPayeurNom())
                    .put(prefix + "Montant", line.getMontant()).put(prefix + "Date de traitement", line.getDateTraitement())
                    .put(prefix + "Motif de rejet", line.getMotifRejet())
                    .put(prefix + "Statut", line.getStatut() == null ? null : switch (line.getStatut()) {
                        case PREPAREE -> "Prepare";
                        case REMISE -> "Remis a la banque";
                        case ENCAISSEE -> "Encaisse";
                        case REJETEE -> "Rejete";
                    });
        }
        index = 0;
        for (var line : slip.getLignesEspeces().stream().sorted(Comparator.comparing(l -> l.getMouvementTresorerie().getId())).toList()) {
            String prefix = "Especes " + (++index) + " - ";
            var movement = line.getMouvementTresorerie();
            values.put(prefix + "Caisse", account(movement.getCompteTresorerie()))
                    .put(prefix + "Journee", movement.getDateOperation()).put(prefix + "Reference", movement.getReference())
                    .put(prefix + "Montant", line.getMontant());
        }
        return values.snapshot();
    }

    public static ActivityCommand command(BordereauRemise slip, Map<String, String> before, ActivityAction action,
            String title, String origin, List<ActivityReference> additionalReferences) {
        List<ActivityReference> references = new ArrayList<>();
        addAccount(references, slip.getCompteSource());
        addAccount(references, slip.getCompteDestination());
        for (var line : slip.getLignes()) {
            references.add(PaymentActivity.reference(line.getInstrument()));
            references.add(PaymentActivity.reference(line.getInstrument().getReglement()));
        }
        for (var line : slip.getLignesEspeces()) {
            var movement = line.getMouvementTresorerie();
            addAccount(references, movement.getCompteTresorerie());
            references.add(ActivityReference.of(ActivityRecordType.MOUVEMENT_TRESORERIE, movement.getId(),
                    movement.getLibelle() == null ? "Encaissement en especes" : movement.getLibelle()));
            if (movement.getInstrumentReglement() != null) {
                references.add(PaymentActivity.reference(movement.getInstrumentReglement()));
                references.add(PaymentActivity.reference(movement.getInstrumentReglement().getReglement()));
            }
            if (line.getOperationTresorerie() != null) references.add(ActivityReference.of(ActivityRecordType.OPERATION_TRESORERIE,
                    line.getOperationTresorerie().getId(), "Transfert de caisse - " + slip.getNumero()));
        }
        if (slip.getOperationTresorerieId() != null) references.add(ActivityReference.of(ActivityRecordType.OPERATION_TRESORERIE,
                slip.getOperationTresorerieId(), "Transfert - " + slip.getNumero()));
        if (additionalReferences != null) references.addAll(additionalReferences);
        return new ActivityCommand(slip.getAgence().getId(), ActivityModule.TRESORERIE, action, title, origin,
                reference(slip), references.stream().distinct().toList(),
                ActivityValues.changes(before, action == ActivityAction.DELETED ? Map.of() : snapshot(slip)));
    }

    private static String account(CompteTresorerie account) {
        return account == null ? null : account.getCode() + " - " + account.getLibelle();
    }

    private static void addAccount(List<ActivityReference> references, CompteTresorerie account) {
        if (account != null) references.add(ActivityReference.of(ActivityRecordType.COMPTE_TRESORERIE, account.getId(), account(account)));
    }
}
