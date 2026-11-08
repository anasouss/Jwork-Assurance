package com.assurance.activity;

import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.Agence;
import com.assurance.entity.Contrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutInstrumentReglement;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PaymentActivityTest {
    @Test
    void allocationOnlyChangesKeepTheChequeReferenceWithoutCreatingAnUnchangedEvent() {
        ReglementClient payment = payment();
        var before = PaymentActivity.snapshot(payment);
        assertThat(PaymentActivity.command(payment, before, ActivityAction.UPDATED,
                "Affectations", "PAYMENT_ALLOCATION_INVOICING", null).changes()).isEmpty();
        payment.getInstruments().get(0).getAffectations().get(0).setStatut(StatutAffectationReglement.ANNULEE);
        var command = PaymentActivity.command(payment, before, ActivityAction.UPDATED,
                "Affectations", "PAYMENT_ALLOCATION_INVOICING", null);
        assertThat(command.changes()).contains(
                new ActivityChange("Moyen 1 - Affectation 1 - Statut", "En attente", "Annulee"),
                new ActivityChange("Moyen 1 - Affectation 1 - Moyen de paiement", null, "Cheque - CH-1"));
    }

    @Test
    void paymentCreationDoesNotMisrepresentAPendingChequeAsCollected() {
        ReglementClient payment = payment();
        var command = PaymentActivity.command(payment, Map.of(), ActivityAction.CREATED,
                "Reglement client enregistre", "CLIENT_PAYMENT_CREATION", null);
        assertThat(command.changes()).contains(new ActivityChange("Statut du reglement", null, "Enregistre"),
                new ActivityChange("Moyen 1 - Statut", null, "En attente d'encaissement"));
        assertThat(command.changes()).extracting(ActivityChange::afterValue).doesNotContain("Encaisse");
        assertThat(command.references()).extracting(ActivityReference::type)
                .contains(ActivityRecordType.CONTRAT, ActivityRecordType.ELEMENT_FACTURABLE, ActivityRecordType.INSTRUMENT_REGLEMENT);
    }

    @Test
    void allocationRowIdentityAndCollectionOrderAreNotBusinessChanges() {
        ReglementClient payment = payment();
        var instrument = payment.getInstruments().get(0);
        var second = AffectationReglementClient.builder().elementFacturable(source(2L)).montant(new BigDecimal("25"))
                .statut(StatutAffectationReglement.EN_ATTENTE).build();
        instrument.getAffectations().add(second);
        var before = PaymentActivity.snapshot(payment);
        instrument.getAffectations().get(0).setId(1000L);
        Collections.reverse(instrument.getAffectations());
        assertThat(ActivityValues.changes(before, PaymentActivity.snapshot(payment))).isEmpty();
    }

    @Test
    void snapshotsDoNotExposeReceiptStoragePathsOrTechnicalMetadata() {
        ReglementClient payment = payment();
        payment.setBordereauCheminStockage("private/agency/bank-evidence.pdf");
        payment.setBordereauNomFichier("justificatif.pdf");
        var values = PaymentActivity.snapshot(payment);
        assertThat(values).containsEntry("Justificatif", "justificatif.pdf");
        assertThat(values.values()).doesNotContain("private/agency/bank-evidence.pdf");
    }

    private ReglementClient payment() {
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).numero("REG-26-00001")
                .payeurNom("Client test").montantTotal(new BigDecimal("125.00")).build();
        payment.setId(8L);
        var instrument = InstrumentReglementClient.builder().agence(agency).reglement(payment).mode(ModeReglementClient.CHEQUE)
                .referenceInstrument("CH-1").statut(StatutInstrumentReglement.EN_ATTENTE).montant(new BigDecimal("125.00")).build();
        instrument.setId(9L);
        instrument.getAffectations().add(AffectationReglementClient.builder().instrument(instrument).elementFacturable(source(1L))
                .montant(new BigDecimal("100.00")).statut(StatutAffectationReglement.EN_ATTENTE).build());
        payment.getInstruments().add(instrument);
        return payment;
    }

    private ElementFacturable source(Long id) {
        Contrat contract = Contrat.builder().numeroDossier("MATU26-0026").build();
        contract.setId(99L);
        ElementFacturable source = ElementFacturable.builder().contrat(contract).libelle("Affaire nouvelle").build();
        source.setId(id);
        return source;
    }
}
