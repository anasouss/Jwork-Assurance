package com.assurance.activity;

import com.assurance.entity.ImportReleveBancaire;
import com.assurance.entity.LigneReleveBancaire;
import com.assurance.enums.StatutRapprochementBancaire;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public final class BankStatementActivity {
    private BankStatementActivity() {
    }

    public static Map<String, String> snapshot(ImportReleveBancaire bankImport, List<LigneReleveBancaire> lines) {
        ActivityValues values = new ActivityValues().put("Fichier", bankImport.getNomFichier())
                .put("Compte bancaire", TreasuryActivity.accountLabel(bankImport.getCompteTresorerie()))
                .put("Format", bankImport.getFormat())
                .put("Profil d'import", bankImport.getProfilImport() == null ? null : bankImport.getProfilImport().getNom())
                .put("Statut", bankImport.getStatut() == null ? null : switch (bankImport.getStatut()) {
                    case BROUILLON -> "En préparation";
                    case VALIDE -> "Validé";
                    case ANNULE -> "Annulé";
                })
                .put("Nombre de lignes", bankImport.getNombreLignes()).put("Total débits", bankImport.getTotalDebits())
                .put("Total crédits", bankImport.getTotalCredits()).put("Solde d'ouverture", bankImport.getSoldeOuverture())
                .put("Solde de clôture", bankImport.getSoldeCloture()).put("Validation", bankImport.getValideLe());
        for (var line : lines.stream().sorted(Comparator.comparing(LigneReleveBancaire::getNumeroLigne)).toList()) {
            String prefix = "Ligne " + line.getNumeroLigne() + " - ";
            values.put(prefix + "Date", line.getDateOperation()).put(prefix + "Date de valeur", line.getDateValeur())
                    .put(prefix + "Libellé", line.getLibelle()).put(prefix + "Référence", line.getReferenceBancaire())
                    .put(prefix + "Contrepartie", line.getContrepartie()).put(prefix + "Débit", line.getDebit())
                    .put(prefix + "Crédit", line.getCredit()).put(prefix + "Solde", line.getSolde())
                    .put(prefix + "Traitement", line.getStatut() == null ? null : switch (line.getStatut()) {
                        case NON_RAPPROCHEE -> "Non rapprochée";
                        case SUGGEREE -> "Correspondances sélectionnées";
                        case PARTIELLEMENT_RAPPROCHEE -> "Partiellement rapprochée";
                        case RAPPROCHEE -> "Rapprochée";
                        case IGNOREE -> "Ignorée";
                    });
            int index = 0;
            for (var selection : line.getRapprochements().stream().filter(row -> active(row.getStatut()))
                    .sorted(Comparator.comparing(row -> row.getInstrumentReglement().getId())).toList()) {
                String selectionPrefix = prefix + "Correspondance " + (++index) + " - ";
                values.put(selectionPrefix + "Moyen", PaymentActivity.reference(selection.getInstrumentReglement()).label())
                        .put(selectionPrefix + "Règlement", selection.getInstrumentReglement().getReglement().getNumero())
                        .put(selectionPrefix + "Payeur", selection.getInstrumentReglement().getReglement().getPayeurNom())
                        .put(selectionPrefix + "Montant", selection.getMontant())
                        .put(selectionPrefix + "Statut", selection.getStatut() == StatutRapprochementBancaire.VALIDE ? "Validée" : "Sélectionnée");
            }
        }
        return values.snapshot();
    }

    public static ActivityCommand command(ImportReleveBancaire bankImport, List<LigneReleveBancaire> lines,
            Map<String, String> before, ActivityAction action, String title, String origin) {
        List<ActivityReference> references = new ArrayList<>();
        references.add(TreasuryActivity.reference(bankImport.getCompteTresorerie()));
        for (var line : lines) {
            for (var selection : line.getRapprochements()) {
                if (!active(selection.getStatut())) continue;
                references.add(PaymentActivity.reference(selection.getInstrumentReglement()));
                references.add(PaymentActivity.reference(selection.getInstrumentReglement().getReglement()));
                if (selection.getMouvementTresorerie() != null) references.add(ActivityReference.of(ActivityRecordType.MOUVEMENT_TRESORERIE,
                        selection.getMouvementTresorerie().getId(), selection.getMouvementTresorerie().getLibelle()));
            }
        }
        return new ActivityCommand(bankImport.getAgence().getId(), ActivityModule.TRESORERIE, action, title, origin,
                ActivityReference.of(ActivityRecordType.RELEVE_BANCAIRE, bankImport.getId(), bankImport.getNomFichier()),
                references.stream().distinct().toList(), ActivityValues.changes(before, snapshot(bankImport, lines)));
    }

    private static boolean active(StatutRapprochementBancaire status) {
        return status == StatutRapprochementBancaire.SELECTIONNE || status == StatutRapprochementBancaire.VALIDE;
    }
}
