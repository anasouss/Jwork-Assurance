package com.assurance.activity;

import com.assurance.entity.AffectationCompteTresorerie;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.MouvementTresorerie;
import com.assurance.entity.OperationTresorerie;
import com.assurance.entity.SessionCaisse;
import com.assurance.enums.NiveauAccesCompteTresorerie;
import com.assurance.enums.SensMouvementTresorerie;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/** Business snapshots only: no running-balance recomputation or ledger-row events. */
public final class TreasuryActivity {
    private TreasuryActivity() {
    }

    public static ActivityReference reference(CompteTresorerie account) {
        return ActivityReference.of(ActivityRecordType.COMPTE_TRESORERIE, account.getId(), accountLabel(account));
    }

    public static String accountLabel(CompteTresorerie account) {
        return account == null ? null : account.getCode() + " - " + account.getLibelle();
    }

    public static Map<String, String> snapshot(CompteTresorerie account) {
        return new ActivityValues().put("Code", account.getCode()).put("Libellé", account.getLibelle())
                .put("Type de compte", account.getTypeCompte() == null ? null : switch (account.getTypeCompte()) {
                    case BANQUE -> "Banque";
                    case CAISSE -> "Caisse";
                })
                .put("Nature de caisse", account.getNatureCaisse() == null ? null : switch (account.getNatureCaisse()) {
                    case CENTRALE -> "Centrale";
                    case INDIVIDUELLE -> "Individuelle";
                })
                .put("Titulaire", account.getUtilisateurTitulaire() == null ? null : account.getUtilisateurTitulaire().getFullName())
                .put("Banque", account.getBanqueReference() == null ? null : account.getBanqueReference().getLibelle())
                .put("RIB", account.getRib()).put("Devise", account.getDevise())
                .put("Solde initial", account.getSoldeInitial()).put("Actif", account.getActif()).snapshot();
    }

    public static ActivityCommand accountCommand(CompteTresorerie account, Map<String, String> before,
            ActivityAction action, String title, String origin) {
        List<ActivityReference> references = new ArrayList<>();
        if (account.getUtilisateurTitulaire() != null) references.add(ActivityReference.of(ActivityRecordType.UTILISATEUR,
                account.getUtilisateurTitulaire().getId(), account.getUtilisateurTitulaire().getFullName()));
        return command(account.getAgence().getId(), action, title, origin, reference(account), references, before, snapshot(account));
    }

    public static Map<String, String> assignments(Collection<AffectationCompteTresorerie> assignments) {
        ActivityValues values = new ActivityValues();
        // Inactive omitted rows are equivalent to no access, regardless of historical join IDs.
        assignments.stream().filter(row -> Boolean.TRUE.equals(row.getActif()))
                .sorted(Comparator.comparing(row -> row.getUtilisateur().getId()))
                .forEach(row -> values.put("Accès - " + row.getUtilisateur().getFullName() + " (" + row.getUtilisateur().getEmail() + ")",
                        accessLevel(row.getNiveauAcces())));
        return values.snapshot();
    }

    private static String accessLevel(NiveauAccesCompteTresorerie level) {
        return level == null ? null : switch (level) {
            case CONSULTATION -> "Consultation";
            case UTILISATION -> "Utilisation";
            case GESTION -> "Gestion";
            case SUPERVISION -> "Supervision";
        };
    }

    public static ActivityReference reference(OperationTresorerie operation) {
        return ActivityReference.of(ActivityRecordType.OPERATION_TRESORERIE, operation.getId(), operation.getNumero());
    }

    public static Map<String, String> snapshot(OperationTresorerie operation) {
        return new ActivityValues().put("Numéro", operation.getNumero())
                .put("Opération", operation.getTypeOperation() == null ? null : switch (operation.getTypeOperation()) {
                    case TRANSFERT -> "Transfert";
                    case AJUSTEMENT -> "Ajustement";
                    case SINISTRE -> "Opération de sinistre";
                    case ANNULATION_TRANSFERT -> "Annulation de transfert";
                    case ANNULATION_AJUSTEMENT -> "Annulation d'ajustement";
                    case ANNULATION_SINISTRE -> "Annulation d'opération de sinistre";
                })
                .put("Statut", operation.getStatut() == null ? null : switch (operation.getStatut()) {
                    case CONFIRMEE -> "Confirmée";
                    case ANNULEE -> "Annulée";
                })
                .put("Compte source", accountLabel(operation.getCompteSource()))
                .put("Compte destinataire", accountLabel(operation.getCompteDestination()))
                .put("Sens de l'ajustement", direction(operation.getSensAjustement()))
                .put("Montant", operation.getMontant()).put("Date d'opération", operation.getDateOperation())
                .put("Date de valeur", operation.getDateValeur()).put("Référence", operation.getReference())
                .put("Motif", operation.getMotif()).put("Opération annulée", operation.getOperationExtournee() == null
                        ? null : operation.getOperationExtournee().getNumero())
                .put("Date d'annulation", operation.getAnnuleeLe()).put("Motif d'annulation", operation.getMotifAnnulation()).snapshot();
    }

    public static ActivityCommand operationCommand(OperationTresorerie operation, Map<String, String> before,
            ActivityAction action, String title, String origin, OperationTresorerie reversal) {
        List<ActivityReference> references = new ArrayList<>();
        addAccount(references, operation.getCompteSource());
        addAccount(references, operation.getCompteDestination());
        Map<String, String> after = new java.util.LinkedHashMap<>(snapshot(operation));
        if (reversal != null) {
            references.add(reference(reversal));
            snapshot(reversal).forEach((label, value) -> after.put("Extourne - " + label, value));
        }
        if (operation.getOperationExtournee() != null) references.add(reference(operation.getOperationExtournee()));
        return command(operation.getAgence().getId(), action, title, origin, reference(operation), references, before, after);
    }

    public static ActivityCommand movementCommand(MouvementTresorerie movement, String title, String origin) {
        List<ActivityReference> references = new ArrayList<>();
        addAccount(references, movement.getCompteTresorerie());
        if (movement.getInstrumentReglement() != null) {
            references.add(PaymentActivity.reference(movement.getInstrumentReglement()));
            references.add(PaymentActivity.reference(movement.getInstrumentReglement().getReglement()));
        }
        if (movement.getInstrumentReglementCompagnie() != null) {
            var instrument = movement.getInstrumentReglementCompagnie();
            references.add(CompanyPaymentActivity.reference(instrument));
            references.add(ActivityReference.of(ActivityRecordType.REGLEMENT_COMPAGNIE,
                    instrument.getReglement().getId(), instrument.getReglement().getNumero()));
        }
        if (movement.getLigneReleveBancaire() != null) {
            var bankImport = movement.getLigneReleveBancaire().getImportReleve();
            references.add(ActivityReference.of(ActivityRecordType.RELEVE_BANCAIRE, bankImport.getId(), bankImport.getNomFichier()));
        }
        if (movement.getMouvementExtourneId() != null) references.add(ActivityReference.of(ActivityRecordType.MOUVEMENT_TRESORERIE,
                movement.getMouvementExtourneId(), "Écriture d'origine - " + movement.getReference()));
        Map<String, String> after = new ActivityValues().put("Compte", accountLabel(movement.getCompteTresorerie()))
                .put("Sens", direction(movement.getSens())).put("Montant", movement.getMontant())
                .put("Date d'opération", movement.getDateOperation()).put("Date de valeur", movement.getDateValeur())
                .put("Référence", movement.getReference()).put("Libellé", movement.getLibelle()).snapshot();
        return command(movement.getAgence().getId(), ActivityAction.CONFIRMED, title, origin,
                ActivityReference.of(ActivityRecordType.MOUVEMENT_TRESORERIE, movement.getId(), movement.getLibelle()), references, Map.of(), after);
    }

    public static Map<String, String> snapshot(SessionCaisse session) {
        return new ActivityValues().put("Caisse", accountLabel(session.getCompteTresorerie()))
                .put("Caissier", session.getUtilisateur().getFullName())
                .put("Statut", session.getStatut() == null ? null : switch (session.getStatut()) {
                    case OUVERTE -> "Ouverte";
                    case CLOTUREE -> "Clôturée";
                })
                .put("Ouverture", session.getOuverteLe()).put("Clôture", session.getFermeeLe())
                .put("Solde théorique d'ouverture", session.getSoldeTheoriqueOuverture())
                .put("Montant compté à l'ouverture", session.getMontantOuverture()).put("Écart d'ouverture", session.getEcartOuverture())
                .put("Note d'ouverture", session.getNoteOuverture())
                .put("Solde théorique de clôture", session.getSoldeTheoriqueCloture())
                .put("Montant compté à la clôture", session.getMontantCompteCloture()).put("Écart de clôture", session.getEcartCloture())
                .put("Note de clôture", session.getNoteCloture()).snapshot();
    }

    public static ActivityCommand sessionCommand(SessionCaisse session, Map<String, String> before,
            ActivityAction action, String title, String origin) {
        return command(session.getAgence().getId(), action, title, origin,
                ActivityReference.of(ActivityRecordType.SESSION_CAISSE, session.getId(), "Session - " + accountLabel(session.getCompteTresorerie())),
                List.of(reference(session.getCompteTresorerie()), ActivityReference.of(ActivityRecordType.UTILISATEUR,
                        session.getUtilisateur().getId(), session.getUtilisateur().getFullName())), before, snapshot(session));
    }

    private static String direction(SensMouvementTresorerie direction) {
        return direction == null ? null : switch (direction) {
            case ENTREE -> "Entrée";
            case SORTIE -> "Sortie";
        };
    }

    private static void addAccount(List<ActivityReference> references, CompteTresorerie account) {
        if (account != null) references.add(reference(account));
    }

    private static ActivityCommand command(Long agencyId, ActivityAction action, String title, String origin,
            ActivityReference subject, List<ActivityReference> references, Map<String, String> before, Map<String, String> after) {
        return new ActivityCommand(agencyId, ActivityModule.TRESORERIE, action, title, origin, subject,
                references.stream().distinct().toList(), ActivityValues.changes(before, after));
    }
}
