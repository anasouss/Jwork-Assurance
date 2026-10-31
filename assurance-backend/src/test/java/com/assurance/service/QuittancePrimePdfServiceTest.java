package com.assurance.service;

import com.assurance.entity.*;
import com.assurance.enums.*;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AssistanceContratRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyCollection;

class QuittancePrimePdfServiceTest {
    private final AssistanceContratRepository assistance = mock(AssistanceContratRepository.class);
    private final QuittancePrimePdfService service = new QuittancePrimePdfService(
            mock(AgencyLogoStorageService.class), assistance);

    @Test
    void oneReceiptCoversSeveralPoliciesWithoutTreatingPartialPaymentsAsFullPremiums() throws Exception {
        ReglementClient payment = payment(2);
        try (PDDocument pdf = PDDocument.load(service.render(payment, "2026000001", LocalDate.of(2026, 10, 31)))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(pdf.getNumberOfPages()).isEqualTo(1);
            assertThat(text).contains("QUITTANCE DE PRIME", "2026000001", "POLICE-1", "POLICE-2", "200,00", "100,00");
            assertThat(text).contains("sous réserve d'encaissement", "cabinet", "MONTANT RÉGLÉ");
            assertThat(text).contains("Payeur", "Adresse", "Intermédiaire", "Réf. règlement", "Date du règlement",
                    "CATÉGORIE", "N° POLICE", "Moyen(s) de règlement", "Chèque", "CH-001", "Total :");
            assertThat(text.indexOf("CATÉGORIE")).isLessThan(text.indexOf("N° POLICE"));
            assertThat(text).doesNotContain("BRANCHE / MOUVEMENT", "Prime assurance", "Total de la sélection", "Montants en MAD");
            assertThat(text).doesNotContain("Dont encaissé", "Dont acompte non affecté", "MONTANT (MAD)");
            assertThat(text).doesNotContain("0,25%", "TVA", "FICHE DE RÈGLEMENT CLIENT");
        }
    }

    @Test
    void selectionOnlyIncludesItsPoliciesAndAllocatedAmounts() throws Exception {
        ReglementClient payment = payment(2);
        assertThat(service.policies(payment)).hasSize(2);
        try (PDDocument pdf = PDDocument.load(service.render(payment, "920260000000001", LocalDate.now(), Set.of("C:1")))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(text).contains("POLICE-1", "Total : 50,00 MAD", "CH-001", "200,00");
            assertThat(text).doesNotContain("POLICE-2", "100,00 MAD");
        }
    }

    @Test
    void selectionRejectsUnknownPoliciesAndKeepsRepeatedPolicyMovementsTogether() {
        ReglementClient payment = payment(2);
        assertThatThrownBy(() -> service.render(payment, "920260000000001", LocalDate.now(), Set.of("C:999")))
                .isInstanceOf(BadRequestException.class);
        var allocations = payment.getInstruments().get(0).getAffectations();
        allocations.get(1).getElementFacturable().setContrat(allocations.get(0).getElementFacturable().getContrat());
        assertThat(service.policies(payment)).singleElement().satisfies(option -> {
            assertThat(option.key()).isEqualTo("C:1");
            assertThat(option.montant()).isEqualByComparingTo("100.00");
        });
    }

    @Test
    void selectedAmountsCannotExceedTheirPaymentInstrument() {
        ReglementClient payment = payment(2);
        var instrument = payment.getInstruments().get(0);
        instrument.setMontant(new BigDecimal("50.00"));
        var unallocated = InstrumentReglementClient.builder().reglement(payment).mode(ModeReglementClient.CHEQUE)
                .statut(StatutInstrumentReglement.EN_ATTENTE).montant(new BigDecimal("50.00")).build();
        unallocated.setId(2L);
        payment.getInstruments().add(unallocated);
        assertThatThrownBy(() -> service.render(payment, "920260000000001", LocalDate.now(), Set.of("C:1")))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void documentLevelAllocationsRemainOneIndivisibleSelection() throws Exception {
        ReglementClient payment = payment(2);
        var instrument = payment.getInstruments().get(0);
        DocumentClient document = DocumentClient.builder().agence(payment.getAgence()).numero("DOC-1").build();
        document.setId(10L);
        for (var allocation : instrument.getAffectations()) {
            ElementFacturable element = allocation.getElementFacturable();
            document.getLignes().add(LigneDocumentClient.builder().document(document).elementFacturable(element)
                    .ordre(document.getLignes().size()).numeroPolice(element.getContrat().getNumeroPolice())
                    .primeNette(element.getPrimeNette()).taxes(element.getTaxe()).accessoires(element.getAccessoire())
                    .montantTtc(element.getPrimeTotale()).build());
        }
        var allocation = instrument.getAffectations().get(0);
        allocation.setElementFacturable(null);
        allocation.setDocumentClient(document);
        allocation.setMontant(new BigDecimal("100.00"));
        instrument.getAffectations().remove(1);
        assertThat(service.policies(payment)).singleElement().satisfies(option -> {
            assertThat(option.key()).isEqualTo("D:10");
            assertThat(option.montant()).isEqualByComparingTo("100.00");
        });
        assertThatThrownBy(() -> service.render(payment, "920260000000001", LocalDate.now(), Set.of("C:1")))
                .isInstanceOf(BadRequestException.class);
        try (PDDocument pdf = PDDocument.load(service.render(payment, "920260000000001", LocalDate.now(), Set.of("D:10")))) {
            assertThat(new PDFTextStripper().getText(pdf)).contains("POLICE-1", "POLICE-2");
        }
    }

    @Test
    void longReceiptRetainsLastPolicyAndTotalsAcrossPages() throws Exception {
        try (PDDocument pdf = PDDocument.load(service.render(payment(60), "2026000060", LocalDate.now()))) {
            assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
            assertThat(new PDFTextStripper().getText(pdf)).contains("POLICE-60", "3 000,00 MAD");
        }
    }

    @Test
    void rejectedValuesCannotBeIssuedAsPaidPremiums() {
        ReglementClient payment = payment(1);
        payment.getInstruments().get(0).setStatut(StatutInstrumentReglement.REJETE);
        assertThatThrownBy(() -> service.render(payment, "2026000001", LocalDate.now())).isInstanceOf(BadRequestException.class);
    }

    @Test
    void assistanceRetainsItsOwnPolicyReferenceEvenOnTheSameContract() throws Exception {
        ReglementClient payment = payment(2);
        var allocations = payment.getInstruments().get(0).getAffectations();
        ElementFacturable assisted = allocations.get(1).getElementFacturable();
        assisted.setContrat(allocations.get(0).getElementFacturable().getContrat());
        assisted.setNature(NatureElementFacturable.ASSISTANCE);
        assisted.setLibelle("Assistance");
        when(assistance.findByElementFacturableIds(anyCollection())).thenReturn(List.of(AssistanceContrat.builder()
                .elementFacturable(assisted).numeroPoliceContrat("ASSIST-001")
                .compagnieAssistance(CompagnieAssistance.builder().nom("Assistance partner").build()).build()));
        try (PDDocument pdf = PDDocument.load(service.render(payment, "2026000001", LocalDate.now()))) {
            assertThat(new PDFTextStripper().getText(pdf)).contains("POLICE-1", "ASSIST-001", "Assistance partner");
        }
    }

    private ReglementClient payment(int policyCount) {
        Agence agency = Agence.builder().nom("Cabinet test").ville("Agadir").build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).numero("REG-001").payeurNom("Client test")
                .dateReglement(LocalDate.of(2026, 10, 31)).montantTotal(new BigDecimal("50.00").multiply(BigDecimal.valueOf(policyCount))).build();
        InstrumentReglementClient cheque = InstrumentReglementClient.builder().reglement(payment).mode(ModeReglementClient.CHEQUE)
                .statut(StatutInstrumentReglement.EN_ATTENTE).montant(payment.getMontantTotal()).referenceInstrument("CH-001").build();
        cheque.setId(1L);
        payment.getInstruments().add(cheque);
        for (int n = 1; n <= policyCount; n++) {
            Contrat contract = Contrat.builder().numeroPolice("POLICE-" + n).build();
            contract.setId((long) n);
            ElementFacturable element = ElementFacturable.builder().agence(agency).contrat(contract).libelle("Prime assurance")
                    .dateDebut(LocalDate.of(2026, 10, 1)).dateFin(LocalDate.of(2027, 9, 30))
                    .primeNette(new BigDecimal("160.00")).taxe(new BigDecimal("30.00"))
                    .taxeParafiscale(BigDecimal.ZERO).accessoire(new BigDecimal("10.00")).cnpac(BigDecimal.ZERO)
                    .primeTotale(new BigDecimal("200.00")).build();
            element.setId((long) n);
            AffectationReglementClient allocation = AffectationReglementClient.builder().instrument(cheque).elementFacturable(element)
                    .montant(new BigDecimal("50.00")).statut(StatutAffectationReglement.EN_ATTENTE).build();
            allocation.setId((long) n);
            cheque.getAffectations().add(allocation);
        }
        return payment;
    }
}
