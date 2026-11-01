package com.assurance.service;

import com.assurance.entity.*;
import com.assurance.enums.*;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AssistanceContratRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
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
    private final ReglementClientService payments = mock(ReglementClientService.class);
    private final QuittancePrimePdfService service = new QuittancePrimePdfService(
            mock(AgencyLogoStorageService.class), assistance, payments);

    @Test
    void settledReceiptHasCoverageDatesAndRequestedColumnsWithoutAnAllocatedAmountColumn() throws Exception {
        ReglementClient payment = payment(2);
        try (PDDocument pdf = PDDocument.load(service.render(payment, "2026000001", LocalDate.of(2026, 10, 31)))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(pdf.getNumberOfPages()).isEqualTo(1);
            assertThat(text).contains("QUITTANCE DE PRIME", "2026000001", "POLICE-1", "POLICE-2", "200,00");
            assertThat(text).contains("SOUSCRIPTEUR", "Souscripteur test", "Adresse", "Ville", "Intermédiaire", "N° quittance", "Date d'émission",
                    "CATÉGORIE", "N° POLICE", "Mode de règlement", "Chèque", "CH-001", "01/10/2026", "30/09/2027");
            assertThat(text).contains("CATÉGORIE N° POLICE DU AU PRIME NETTE TAXES ACC. TTC", "TOTAL", "400,00");
            assertThat(text).doesNotContain("BRANCHE / MOUVEMENT", "Prime assurance", "Total de la sélection", "Montants en MAD");
            assertThat(text).doesNotContain("MONTANT RÉGLÉ", "TOTAL AFFECTÉ", "sous réserve d'encaissement", "Dont encaissé", "Dont acompte non affecté", "MONTANT (MAD)");
            assertThat(text).doesNotContain("0,25%", "TVA", "FICHE DE RÈGLEMENT CLIENT");
            assertThat(text).doesNotContain("Payeur", "Réf. règlement", "Date du règlement", "Reçu de règlement émis par le cabinet",
                    "Les primes des mouvements", "Ce document ne vaut", "Assuré :");
        }
    }

    @Test
    void singlePolicyAndPeriodAppearOnlyInTheHeaderWithACenteredTitle() throws Exception {
        try (PDDocument pdf = PDDocument.load(service.render(payment(1), "2026000001", LocalDate.now()))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(text).contains("N° police : POLICE-1", "Période de garantie : du 01/10/2026 au 30/09/2027",
                    "CATÉGORIE PRIME NETTE TAXES ACC. TTC", "Rue du client", "Agadir");
            assertThat(text).doesNotContain("N° POLICE DU AU");
            assertThat(text.split("POLICE-1", -1)).hasSize(2);
            float[] titleCenter = {Float.NaN};
            float[] left = {Float.NaN};
            float[] right = {Float.NaN};
            PDFTextStripper positions = new PDFTextStripper() {
                @Override
                protected void writeString(String content, List<TextPosition> glyphs) throws java.io.IOException {
                    if (!glyphs.isEmpty()) {
                        if (content.contains("QUITTANCE DE PRIME")) {
                            TextPosition last = glyphs.get(glyphs.size() - 1);
                            titleCenter[0] = (glyphs.get(0).getXDirAdj() + last.getXDirAdj() + last.getWidthDirAdj()) / 2;
                        }
                        if (content.contains("N° quittance")) left[0] = glyphs.get(0).getXDirAdj();
                        if (content.contains("SOUSCRIPTEUR")) right[0] = glyphs.get(0).getXDirAdj();
                    }
                    super.writeString(content, glyphs);
                }
            };
            positions.getText(pdf);
            float pageCenter = pdf.getPage(0).getMediaBox().getWidth() / 2;
            assertThat(titleCenter[0]).isCloseTo(pageCenter, within(2.0f));
            assertThat(left[0]).isLessThan(pageCenter);
            assertThat(right[0]).isGreaterThan(pageCenter);
        }
    }

    @Test
    void differentPeriodsOnTheSamePolicyStayInTheTable() throws Exception {
        ReglementClient payment = payment(2);
        var allocations = payment.getInstruments().get(0).getAffectations();
        allocations.get(1).getElementFacturable().setContrat(allocations.get(0).getElementFacturable().getContrat());
        allocations.get(1).getElementFacturable().setDateDebut(LocalDate.of(2026, 11, 1));
        try (PDDocument pdf = PDDocument.load(service.render(payment, "1", LocalDate.now()))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(text).contains("CATÉGORIE N° POLICE DU AU", "01/10/2026", "01/11/2026");
            assertThat(text).doesNotContain("Période de garantie");
        }
    }

    @Test
    void distinctInsuredIsShownButThePayerIsNeverInventedAsSubscriber() throws Exception {
        ReglementClient payment = payment(1);
        Contrat contract = payment.getInstruments().get(0).getAffectations().get(0).getElementFacturable().getContrat();
        Client owner = Client.builder().nom("Propriétaire distinct").build();
        owner.setId(99L);
        contract.getClients().stream().filter(link -> link.getRole() == RoleClientContrat.PROPRIETAIRE)
                .forEach(link -> link.setClient(owner));
        try (PDDocument pdf = PDDocument.load(service.render(payment, "1", LocalDate.now()))) {
            assertThat(new PDFTextStripper().getText(pdf)).contains("Souscripteur test", "Assuré : Propriétaire distinct")
                    .doesNotContain("Client test");
        }
        contract.getClients().clear();
        try (PDDocument pdf = PDDocument.load(service.render(payment, "1", LocalDate.now()))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(text).contains("SOUSCRIPTEUR", "Nom : -").doesNotContain("Client test", "Propriétaire distinct");
        }
    }

    @Test
    void severalSubscribersRetainTheirOwnNamesAddressesAndPolicyAssociations() throws Exception {
        ReglementClient payment = payment(2);
        Contrat second = payment.getInstruments().get(0).getAffectations().get(1).getElementFacturable().getContrat();
        Client other = Client.builder().nom("Autre souscripteur").adresse("Rue du second client")
                .ville(Ville.builder().nom("Rabat").build()).build();
        other.setId(12L);
        second.getClients().forEach(link -> link.setClient(other));
        try (PDDocument pdf = PDDocument.load(service.render(payment, "1", LocalDate.now()))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(text).contains("SOUSCRIPTEURS", "Souscripteur test", "Autre souscripteur", "Rue du client",
                    "Rue du second client", "Agadir", "Rabat", "Police(s) : POLICE-1", "Police(s) : POLICE-2");
            assertThat(text).doesNotContain("Assuré :");
        }
    }

    @Test
    void selectionOnlyIncludesItsPoliciesAndAllocatedAmounts() throws Exception {
        ReglementClient payment = payment(2);
        assertThat(service.policies(payment)).hasSize(2);
        try (PDDocument pdf = PDDocument.load(service.render(payment, "920260000000001", LocalDate.now(), Set.of("C:1")))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(text).contains("POLICE-1", "CH-001", "200,00 MAD");
            assertThat(text).doesNotContain("POLICE-2", "400,00 MAD");
        }
    }

    @Test
    void selectionRejectsUnknownPoliciesAndKeepsRepeatedPolicyMovementsTogether() {
        ReglementClient payment = payment(2);
        assertThatThrownBy(() -> service.render(payment, "920260000000001", LocalDate.now(), Set.of("C:999")))
                .isInstanceOf(BadRequestException.class);
        var allocations = payment.getInstruments().get(0).getAffectations();
        allocations.get(1).getElementFacturable().setContrat(allocations.get(0).getElementFacturable().getContrat());
        allocations.get(0).getElementFacturable().setMouvementContrat(MouvementContrat.builder()
                .typeMouvement(TypeMouvementContrat.builder().libelle("Affaire nouvelle").build()).build());
        allocations.get(1).getElementFacturable().setMouvementContrat(MouvementContrat.builder()
                .typeMouvement(TypeMouvementContrat.builder().libelle("Extension garanties").build()).build());
        assertThat(service.policies(payment)).singleElement().satisfies(option -> {
            assertThat(option.key()).isEqualTo("C:1");
            assertThat(option.montant()).isEqualByComparingTo("400.00");
            assertThat(option.eligible()).isTrue();
            assertThat(option.mouvements()).extracting(QuittancePrimePdfService.MovementOption::libelle)
                    .containsExactly("Affaire nouvelle", "Extension garanties");
            assertThat(option.mouvements()).extracting(QuittancePrimePdfService.MovementOption::elementFacturableId)
                    .containsExactly(1L, 2L);
            assertThat(option.mouvements()).allSatisfy(movement -> {
                assertThat(movement.montant()).isEqualByComparingTo("200.00");
                assertThat(movement.statut()).isEqualTo("REGLEE");
                assertThat(movement.dateDebut()).isEqualTo(LocalDate.of(2026, 10, 1));
            });
        });
    }

    @Test
    void selectedAmountsCannotExceedTheirPaymentInstrument() {
        ReglementClient payment = payment(2);
        payment.setMontantTotal(new BigDecimal("100.00"));
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
        allocation.setMontant(new BigDecimal("400.00"));
        instrument.getAffectations().remove(1);
        assertThat(service.policies(payment)).singleElement().satisfies(option -> {
            assertThat(option.key()).isEqualTo("D:10");
            assertThat(option.montant()).isEqualByComparingTo("400.00");
            assertThat(option.mouvements()).hasSize(2);
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
            assertThat(new PDFTextStripper().getText(pdf)).contains("POLICE-60", "12 000,00 MAD");
        }
    }

    @Test
    void rejectedValuesCannotBeIssuedAsPaidPremiums() {
        ReglementClient payment = payment(1);
        payment.getInstruments().get(0).setStatut(StatutInstrumentReglement.REJETE);
        assertThatThrownBy(() -> service.render(payment, "2026000001", LocalDate.now())).isInstanceOf(BadRequestException.class);
    }

    @Test
    void pendingChequeAndUnconfirmedAllocationCannotBeIssued() {
        ReglementClient payment = payment(1);
        payment.getInstruments().get(0).setStatut(StatutInstrumentReglement.REMIS_EN_BANQUE);
        assertThat(service.policies(payment).get(0).eligible()).isFalse();
        assertThat(service.policies(payment).get(0).mouvements().get(0).statut()).isEqualTo("EN_ATTENTE_ENCAISSEMENT");
        assertThatThrownBy(() -> service.render(payment, "1", LocalDate.now())).isInstanceOf(BadRequestException.class);
        payment.getInstruments().get(0).setStatut(StatutInstrumentReglement.CONFIRME);
        payment.getInstruments().get(0).getAffectations().get(0).setStatut(StatutAffectationReglement.EN_ATTENTE);
        assertThatThrownBy(() -> service.render(payment, "1", LocalDate.now())).isInstanceOf(BadRequestException.class);
    }

    @Test
    void partialMovementCannotBeIssuedEvenWithAConfirmedInstrument() {
        ReglementClient payment = payment(1);
        when(payments.fullySettledElementIds(org.mockito.ArgumentMatchers.eq(7L), anyCollection())).thenReturn(Set.of());
        assertThat(service.policies(payment).get(0).eligible()).isFalse();
        assertThat(service.policies(payment).get(0).mouvements().get(0).statut()).isEqualTo("NON_SOLDEE");
        assertThatThrownBy(() -> service.render(payment, "1", LocalDate.now())).isInstanceOf(BadRequestException.class);
    }

    @Test
    void aSettledPolicyCanBeSelectedWithoutIncludingAnotherPendingPolicy() throws Exception {
        ReglementClient payment = payment(2);
        var confirmed = payment.getInstruments().get(0);
        confirmed.setMontant(new BigDecimal("200.00"));
        var allocation = confirmed.getAffectations().remove(1);
        var pending = InstrumentReglementClient.builder().reglement(payment).mode(ModeReglementClient.CHEQUE)
                .statut(StatutInstrumentReglement.EN_ATTENTE).montant(new BigDecimal("200.00")).build();
        pending.setId(2L);
        allocation.setInstrument(pending);
        allocation.setStatut(StatutAffectationReglement.EN_ATTENTE);
        pending.getAffectations().add(allocation);
        payment.getInstruments().add(pending);
        assertThatThrownBy(() -> service.render(payment, "1", LocalDate.now())).isInstanceOf(BadRequestException.class);
        try (PDDocument pdf = PDDocument.load(service.render(payment, "1", LocalDate.now(), Set.of("C:1")))) {
            assertThat(new PDFTextStripper().getText(pdf)).contains("POLICE-1").doesNotContain("POLICE-2");
        }
    }

    @Test
    void fullySettledInstalmentsShowFullPremiumButOnlyTheCurrentPaymentsActualModeAmount() throws Exception {
        ReglementClient payment = payment(1);
        payment.setMontantTotal(new BigDecimal("50.00"));
        payment.getInstruments().get(0).setMontant(new BigDecimal("50.00"));
        payment.getInstruments().get(0).getAffectations().get(0).setMontant(new BigDecimal("50.00"));
        try (PDDocument pdf = PDDocument.load(service.render(payment, "1", LocalDate.now()))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(text).contains("TOTAL 200,00", "50,00 MAD");
            assertThat(text).doesNotContain("MONTANT RÉGLÉ", "sous réserve");
        }
    }

    @Test
    void forgivenBalanceDoesNotAddAPdfSectionOrInflateTheInstrumentAmount() throws Exception {
        ReglementClient payment = payment(1);
        payment.setMontantTotal(new BigDecimal("191.00"));
        payment.getInstruments().get(0).setMontant(new BigDecimal("191.00"));
        payment.getInstruments().get(0).getAffectations().get(0).setMontant(new BigDecimal("191.00"));
        try (PDDocument pdf = PDDocument.load(service.render(payment, "1", LocalDate.now()))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(text).contains("TOTAL 200,00", "191,00 MAD");
            assertThat(text).doesNotContain("Écart", "écart", "MONTANT RÉGLÉ");
        }
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
                .dateReglement(LocalDate.of(2026, 10, 31)).montantTotal(new BigDecimal("200.00").multiply(BigDecimal.valueOf(policyCount))).build();
        InstrumentReglementClient cheque = InstrumentReglementClient.builder().reglement(payment).mode(ModeReglementClient.CHEQUE)
                .statut(StatutInstrumentReglement.CONFIRME).montant(payment.getMontantTotal()).referenceInstrument("CH-001").build();
        cheque.setId(1L);
        payment.getInstruments().add(cheque);
        Client subscriber = Client.builder().nom("Souscripteur test").adresse("Rue du client")
                .ville(Ville.builder().nom("Agadir").build()).build();
        subscriber.setId(11L);
        for (int n = 1; n <= policyCount; n++) {
            Contrat contract = Contrat.builder().numeroPolice("POLICE-" + n).build();
            contract.setId((long) n);
            contract.getClients().add(ContratClient.builder().contrat(contract).client(subscriber)
                    .role(RoleClientContrat.SOUSCRIPTEUR).principalPourRole(true).build());
            contract.getClients().add(ContratClient.builder().contrat(contract).client(subscriber)
                    .role(RoleClientContrat.PROPRIETAIRE).principalPourRole(true).build());
            ElementFacturable element = ElementFacturable.builder().agence(agency).contrat(contract).libelle("Prime assurance")
                    .dateDebut(LocalDate.of(2026, 10, 1)).dateFin(LocalDate.of(2027, 9, 30))
                    .primeNette(new BigDecimal("160.00")).taxe(new BigDecimal("30.00"))
                    .taxeParafiscale(BigDecimal.ZERO).accessoire(new BigDecimal("10.00")).cnpac(BigDecimal.ZERO)
                    .primeTotale(new BigDecimal("200.00")).build();
            element.setId((long) n);
            AffectationReglementClient allocation = AffectationReglementClient.builder().instrument(cheque).elementFacturable(element)
                    .montant(new BigDecimal("200.00")).statut(StatutAffectationReglement.CONFIRMEE).build();
            allocation.setId((long) n);
            cheque.getAffectations().add(allocation);
        }
        when(payments.fullySettledElementIds(org.mockito.ArgumentMatchers.eq(7L), anyCollection()))
                .thenAnswer(call -> Set.copyOf((java.util.Collection<Long>) call.getArgument(1)));
        return payment;
    }
}
