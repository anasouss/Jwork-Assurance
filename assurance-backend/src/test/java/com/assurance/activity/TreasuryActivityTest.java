package com.assurance.activity;

import com.assurance.entity.Agence;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.ImportReleveBancaire;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneReleveBancaire;
import com.assurance.entity.OperationTresorerie;
import com.assurance.entity.RapprochementBancaire;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutImportReleveBancaire;
import com.assurance.enums.StatutLigneReleveBancaire;
import com.assurance.enums.StatutOperationTresorerie;
import com.assurance.enums.StatutRapprochementBancaire;
import com.assurance.enums.TypeOperationTresorerie;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TreasuryActivityTest {
    @Test
    void transferIsOneBusinessOperationWithBothAccountReferences() {
        var agency = agency();
        var source = account(1L, agency, "Caisse");
        var destination = account(2L, agency, "Banque");
        var operation = OperationTresorerie.builder().agence(agency).numero("OP-26-000001")
                .typeOperation(TypeOperationTresorerie.TRANSFERT).statut(StatutOperationTresorerie.CONFIRMEE)
                .compteSource(source).compteDestination(destination).montant(new BigDecimal("1234.50")).build();
        operation.setId(10L);
        var command = TreasuryActivity.operationCommand(operation, Map.of(), ActivityAction.CONFIRMED,
                "Transfert confirme", "TREASURY_TRANSFER", null);
        assertThat(command.subject().type()).isEqualTo(ActivityRecordType.OPERATION_TRESORERIE);
        assertThat(command.references()).extracting(ActivityReference::id).containsExactly("1", "2");
        assertThat(command.changes()).contains(new ActivityChange("Montant", null, "1 234,50"));
    }

    @Test
    void bankSelectionRecreationAndMatchScoresAreNotUserChanges() {
        var bankImport = bankImport();
        var line = line(bankImport);
        var selection = selection(14L);
        line.getRapprochements().add(selection);
        var before = BankStatementActivity.snapshot(bankImport, List.of(line));
        selection.setId(999L);
        selection.setScoreCorrespondance(99);
        selection.setMotifCorrespondance("Automatic parser score");
        assertThat(ActivityValues.changes(before, BankStatementActivity.snapshot(bankImport, List.of(line)))).isEmpty();
    }

    @Test
    void automaticSuggestionsAreExcludedAndActualValidationIsRecorded() {
        var bankImport = bankImport();
        var line = line(bankImport);
        var selection = selection(14L);
        selection.setStatut(StatutRapprochementBancaire.SUGGERE);
        line.getRapprochements().add(selection);
        var suggested = BankStatementActivity.snapshot(bankImport, List.of(line));
        assertThat(suggested.keySet()).noneMatch(label -> label.contains("Correspondance"));
        selection.setStatut(StatutRapprochementBancaire.SELECTIONNE);
        var before = BankStatementActivity.snapshot(bankImport, List.of(line));
        selection.setStatut(StatutRapprochementBancaire.VALIDE);
        bankImport.setStatut(StatutImportReleveBancaire.VALIDE);
        line.setStatut(StatutLigneReleveBancaire.RAPPROCHEE);
        var command = BankStatementActivity.command(bankImport, List.of(line), before, ActivityAction.RECONCILED,
                "Rapprochement valide", "BANK_RECONCILIATION_VALIDATION");
        assertThat(command.changes()).contains(new ActivityChange("Ligne 4 - Correspondance 1 - Statut", "Selectionnee", "Validee"));
        assertThat(command.references()).extracting(ActivityReference::type)
                .contains(ActivityRecordType.COMPTE_TRESORERIE, ActivityRecordType.REGLEMENT_CLIENT, ActivityRecordType.INSTRUMENT_REGLEMENT);
        assertThat(command.changes().toString()).doesNotContain("secret-storage", "technical-hash", "configurationJson");
    }

    private ImportReleveBancaire bankImport() {
        var agency = agency();
        var bankImport = ImportReleveBancaire.builder().agence(agency).compteTresorerie(account(2L, agency, "Banque"))
                .nomFichier("releve.csv").statut(StatutImportReleveBancaire.BROUILLON).cleStockage("secret-storage")
                .sha256("technical-hash").configurationJson("{\"private\":true}").nombreLignes(1).build();
        bankImport.setId(12L);
        return bankImport;
    }

    private LigneReleveBancaire line(ImportReleveBancaire bankImport) {
        return LigneReleveBancaire.builder().importReleve(bankImport).numeroLigne(4).libelle("Virement client")
                .credit(new BigDecimal("100.00")).statut(StatutLigneReleveBancaire.SUGGEREE).build();
    }

    private RapprochementBancaire selection(Long id) {
        var payment = ReglementClient.builder().numero("REG-26-000001").payeurNom("Client test").build();
        payment.setId(20L);
        var instrument = InstrumentReglementClient.builder().reglement(payment).mode(ModeReglementClient.VIREMENT)
                .referenceInstrument("VIR-001").build();
        instrument.setId(30L);
        var selection = RapprochementBancaire.builder().instrumentReglement(instrument)
                .montant(new BigDecimal("100.00")).statut(StatutRapprochementBancaire.SELECTIONNE).build();
        selection.setId(id);
        return selection;
    }

    private Agence agency() {
        var agency = Agence.builder().nom("Agence test").build();
        agency.setId(7L);
        return agency;
    }

    private CompteTresorerie account(Long id, Agence agency, String label) {
        var account = CompteTresorerie.builder().agence(agency).code("COMPTE-" + id).libelle(label).build();
        account.setId(id);
        return account;
    }
}
