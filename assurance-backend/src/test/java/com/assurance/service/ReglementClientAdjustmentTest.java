package com.assurance.service;

import com.assurance.dto.request.CreerReglementClientRequest;
import com.assurance.dto.response.CreanceClientPageResponse;
import com.assurance.dto.response.SourceDocumentClientResponse;
import com.assurance.dto.response.ReglementClientResponse;
import com.assurance.entity.ReglementClient;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.AffectationReglementClient;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.Agence;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.Quittance;
import com.assurance.entity.Contrat;
import com.assurance.entity.AssistanceContrat;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AffectationReglementClientRepository;
import com.assurance.repository.EcartReglementClientRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.LigneDocumentClientRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.ContratClientRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ReglementClientAdjustmentTest {
    @Mock private AffectationReglementClientRepository allocationRepository;
    @Mock private EcartReglementClientRepository ecartRepository;
    @Mock private QuittanceRepository quittanceRepository;
    @Mock private ElementFacturableRepository elementRepository;
    @Mock private LigneDocumentClientRepository documentLineRepository;
    @Mock private ParametreApplicationService parametreApplicationService;
    @Mock private DocumentClientService documentClientService;
    @Mock private AssistanceContratRepository historyAssistanceRepository;
    @Mock private ContratClientRepository historyClientRepository;
    @InjectMocks private ReglementClientService service;
    @InjectMocks private DocumentClientService paymentHistoryReader;

    @BeforeEach
    void manager() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "manager", "", List.of(new SimpleGrantedAuthority("PERM_reglement-client:manage"))));
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void paymentHistoryLoadsPaidQuittancesWithoutApplyingUnpaidEligibility() {
        var source = historyElement(62L, NatureElementFacturable.CONTRAT);
        var paid = Quittance.builder().elementFacturable(source).globale(true).alternative(false).payee(true)
                .numeroQuittance("Q-62").build();
        paid.setId(10L);
        when(elementRepository.findByAgenceIdAndIdIn(7L, List.of(62L))).thenReturn(List.of(source));
        when(quittanceRepository.findGlobalForPaymentHistory(7L, List.of(62L))).thenReturn(List.of(paid));

        var rows = paymentHistoryReader.findPaymentSourcesByIds(7L, List.of(62L));

        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.getElementFacturableId()).isEqualTo(62L);
            assertThat(row.getQuittanceId()).isEqualTo(10L);
            assertThat(row.getPolice()).isEqualTo("POL-62");
            assertThat(row.getMontantTtc()).isEqualByComparingTo("329.00");
        });
        assertThat(paid.getPayee()).isTrue();
        verify(quittanceRepository, never()).findGlobalByElementFacturableIds(any());
    }

    @Test
    void paymentHistoryKeepsInactiveAssistanceWithItsOwnContractReference() {
        var source = historyElement(85L, NatureElementFacturable.ASSISTANCE);
        var assistance = AssistanceContrat.builder().elementFacturable(source).actif(false)
                .numeroContratOuQuittance("ASS-85").produit("F4").build();
        assistance.setId(20L);
        when(elementRepository.findByAgenceIdAndIdIn(7L, List.of(85L))).thenReturn(List.of(source));
        when(historyAssistanceRepository.findForPaymentHistory(7L, List.of(85L))).thenReturn(List.of(assistance));

        var rows = paymentHistoryReader.findPaymentSourcesByIds(7L, List.of(85L));

        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.getPolice()).isEqualTo("ASS-85");
            assertThat(row.getMouvement()).isEqualTo("Assistance - F4");
        });
        assertThat(assistance.getActif()).isFalse();
        verify(historyAssistanceRepository, never()).findActiveByElementFacturableIds(any());
    }

    @Test
    void historicalMissingQuittanceDoesNotBlockReadingButStillBlocksNewDocumentEligibility() {
        var source = historyElement(85L, NatureElementFacturable.CONTRAT);
        source.setLibelle("Extension garanties");
        when(elementRepository.findByAgenceIdAndIdIn(7L, List.of(85L))).thenReturn(List.of(source));

        var rows = paymentHistoryReader.findPaymentSourcesByIds(7L, List.of(85L));

        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.getQuittanceId()).isNull();
            assertThat(row.getMouvement()).isEqualTo("Extension garanties");
        });
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
                paymentHistoryReader, "resolveSource", source, Map.of(), Map.of()))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("n'a pas de quittance valide");
    }

    @Test
    void paymentHistoryRejectsSourcesOutsideTheCurrentAgencyBeforeLoadingReferences() {
        assertThatThrownBy(() -> paymentHistoryReader.findPaymentSourcesByIds(7L, List.of(62L)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("introuvables");
        verify(elementRepository).findByAgenceIdAndIdIn(7L, List.of(62L));
        verifyNoInteractions(quittanceRepository, historyAssistanceRepository, historyClientRepository);
    }

    private ElementFacturable historyElement(Long id, NatureElementFacturable nature) {
        var contract = Contrat.builder().numeroPolice("POL-" + id).build();
        contract.setId(11L);
        var source = ElementFacturable.builder().contrat(contract).nature(nature)
                .primeTotale(new BigDecimal("329.00")).actif(false).build();
        source.setId(id);
        return source;
    }

    @Test
    void paymentDetailCountsEachPremiumOnceAndSeparatesPendingCashAndForgiveness() {
        var payment = detailPayment();
        var confirmed = detailInstrument(payment, StatutInstrumentReglement.CONFIRME, "200.00");
        var pending = detailInstrument(payment, StatutInstrumentReglement.REMIS_EN_BANQUE, "120.00");
        var rejected = detailInstrument(payment, StatutInstrumentReglement.REJETE, "999.00");
        confirmed.setAffectations(List.of(detailAllocation(confirmed, StatutAffectationReglement.CONFIRMEE, "200.00")));
        pending.setAffectations(List.of(detailAllocation(pending, StatutAffectationReglement.EN_ATTENTE, "120.00")));
        rejected.setAffectations(List.of(detailAllocation(rejected, StatutAffectationReglement.ANNULEE, "999.00")));
        payment.setInstruments(List.of(confirmed, pending, rejected));
        when(documentClientService.findPaymentSourcesByIds(eq(7L), any())).thenReturn(List.of(detailSource()));
        when(allocationRepository.sumByElementIds(any())).thenReturn(List.of(
                new Object[]{1L, StatutAffectationReglement.CONFIRMEE, new BigDecimal("200.00")},
                new Object[]{1L, StatutAffectationReglement.EN_ATTENTE, new BigDecimal("120.00")}));
        when(ecartRepository.sumByElementIds(eq(7L), any())).thenReturn(Collections.singletonList(
                new Object[]{1L, new BigDecimal("9.00")}));

        ReglementClientResponse.Detail detail = ReflectionTestUtils.invokeMethod(service, "paymentDetail", payment);

        assertThat(detail.getTotalEncaisse()).isEqualByComparingTo("200.00");
        assertThat(detail.getTotalEnAttente()).isEqualByComparingTo("120.00");
        assertThat(detail.getTotalQuittances()).isEqualByComparingTo("329.00");
        assertThat(detail.getSolde()).isZero();
        assertThat(detail.getProductions()).singleElement().satisfies(row -> {
            assertThat(row.getNumeroPolice()).isEqualTo("ASS-123");
            assertThat(row.getCompagnie()).isEqualTo("Assistance compagnie");
            assertThat(row.getAssure()).isEqualTo("Client assuré");
            assertThat(row.getMontantEncaisse()).isEqualByComparingTo("200.00");
            assertThat(row.getMontantEnAttente()).isEqualByComparingTo("120.00");
        });
    }

    @Test
    void cancelledPaymentNeverReportsItsInstrumentsAsCollected() {
        var payment = detailPayment();
        payment.setStatut(StatutReglementClient.ANNULE);
        var instrument = detailInstrument(payment, StatutInstrumentReglement.CONFIRME, "200.00");
        instrument.setAffectations(List.of(detailAllocation(instrument, StatutAffectationReglement.ANNULEE, "200.00")));
        payment.setInstruments(List.of(instrument));
        when(documentClientService.findPaymentSourcesByIds(eq(7L), any())).thenReturn(List.of(detailSource()));

        ReglementClientResponse.Detail detail = ReflectionTestUtils.invokeMethod(service, "paymentDetail", payment);

        assertThat(detail.getTotalEncaisse()).isZero();
        assertThat(detail.getTotalEnAttente()).isZero();
        assertThat(detail.getSolde()).isEqualByComparingTo("329.00");
        assertThat(detail.getProductions()).singleElement().satisfies(row -> assertThat(row.getMontantEncaisse()).isZero());
    }

    @Test
    void globalDocumentAndChildAllocationsDoNotDoubleCountDocumentPremiums() {
        var payment = detailPayment();
        var document = DocumentClient.builder().agence(payment.getAgence()).typeDocument(TypeDocumentClient.FACTURE)
                .numero("FAC-1").totalDocument(new BigDecimal("350.00")).build();
        document.setId(10L);
        document.getLignes().add(LigneDocumentClient.builder().elementFacturable(element()).ordre(1)
                .numeroPolice("POL-SNAPSHOT").compagnie("Compagnie snapshot")
                .dateOperation(LocalDate.of(2026, 1, 1)).dateEcheance(LocalDate.of(2026, 12, 31))
                .montantTtc(new BigDecimal("350.00")).build());
        var instrument = detailInstrument(payment, StatutInstrumentReglement.CONFIRME, "100.00");
        var parent = AffectationReglementClient.builder().instrument(instrument).documentClient(document)
                .statut(StatutAffectationReglement.CONFIRMEE).montant(new BigDecimal("50.00")).build();
        var child = detailAllocation(instrument, StatutAffectationReglement.CONFIRMEE, "50.00");
        child.setDocumentClient(document);
        instrument.setAffectations(List.of(parent, child));
        payment.setInstruments(List.of(instrument));
        when(documentClientService.findPaymentSourcesByIds(eq(7L), any())).thenReturn(List.of(detailSource()));
        when(allocationRepository.sumByElementIds(any())).thenReturn(Collections.singletonList(
                new Object[]{1L, StatutAffectationReglement.CONFIRMEE, new BigDecimal("50.00")}));
        when(allocationRepository.sumParentByDocumentIds(List.of(10L))).thenReturn(Collections.singletonList(
                new Object[]{10L, StatutAffectationReglement.CONFIRMEE, new BigDecimal("50.00")}));

        ReglementClientResponse.Detail detail = ReflectionTestUtils.invokeMethod(service, "paymentDetail", payment);

        assertThat(detail.getTotalQuittances()).isEqualByComparingTo("350.00");
        assertThat(detail.getSolde()).isEqualByComparingTo("250.00");
        assertThat(detail.getProductions()).singleElement().satisfies(row -> {
            assertThat(row.getNumeroPolice()).isEqualTo("POL-SNAPSHOT");
            assertThat(row.getCompagnie()).isEqualTo("Compagnie snapshot");
            assertThat(row.getDateDebut()).isEqualTo(LocalDate.of(2026, 1, 1));
            assertThat(row.getMontantEncaisse()).isEqualByComparingTo("100.00");
        });
    }

    private ReglementClient detailPayment() {
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        return ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
    }

    private InstrumentReglementClient detailInstrument(ReglementClient payment, StatutInstrumentReglement status, String amount) {
        return InstrumentReglementClient.builder().reglement(payment).statut(status).montant(new BigDecimal(amount)).build();
    }

    private AffectationReglementClient detailAllocation(InstrumentReglementClient instrument, StatutAffectationReglement status, String amount) {
        return AffectationReglementClient.builder().instrument(instrument).elementFacturable(element())
                .statut(status).montant(new BigDecimal(amount)).build();
    }

    private SourceDocumentClientResponse detailSource() {
        return SourceDocumentClientResponse.builder().elementFacturableId(1L).police("ASS-123")
                .compagnie("Assistance compagnie").assureNom("Client assuré")
                .montantTtc(new BigDecimal("329.00")).build();
    }

    @Test
    void confirmed320PlusAdjustment9Settles329WithoutReporting329Collected() {
        amounts(StatutAffectationReglement.CONFIRMEE, "320.00", "9.00");
        var result = receivable();
        assertThat(result.getMontantConfirme()).isEqualByComparingTo("320.00");
        assertThat(result.getSoldeOuvert()).isZero();
        assertThat(result.getStatut()).isEqualTo("PAYEE");
        assertThat(result.getSource().getMontantTtc()).isEqualByComparingTo("329.00");
    }

    @Test
    void pendingChequeIsCoveredButNotMarkedCollectedUntilConfirmation() {
        amounts(StatutAffectationReglement.EN_ATTENTE, "320.00", "9.00");
        var result = receivable();
        assertThat(result.getMontantConfirme()).isZero();
        assertThat(result.getMontantEnAttente()).isEqualByComparingTo("320.00");
        assertThat(result.getSoldeOuvert()).isZero();
        assertThat(result.getStatut()).isEqualTo("COUVERTE_EN_ATTENTE");
        Quittance receipt = Quittance.builder().elementFacturable(element()).build();
        when(quittanceRepository.findGlobalByElementFacturableIds(List.of(1L))).thenReturn(List.of(receipt));
        ReflectionTestUtils.invokeMethod(service, "recalculateQuittancePaymentFlags", 7L, List.of(1L));
        assertThat(receipt.getPayee()).isFalse();
    }

    @Test
    void cancellationExcludingPaymentAndAdjustmentRestoresTheFullBalance() {
        assertThat(receivable().getSoldeOuvert()).isEqualByComparingTo("329.00");
    }

    @Test
    void receiptEligibilityCountsConfirmedInstalmentsAndTheAuthorisedAdjustment() {
        when(elementRepository.findClientDocumentSources(7L, List.of(1L))).thenReturn(List.of(element()));
        when(allocationRepository.sumByElementIds(List.of(1L))).thenReturn(List.of(
                new Object[]{1L, StatutAffectationReglement.CONFIRMEE, new BigDecimal("200.00")},
                new Object[]{1L, StatutAffectationReglement.CONFIRMEE, new BigDecimal("120.00")}));
        when(ecartRepository.sumByElementIds(7L, List.of(1L))).thenReturn(Collections.singletonList(
                new Object[]{1L, new BigDecimal("9.00")}));
        var coverage = service.receiptCoverage(7L, List.of(1L));
        assertThat(coverage.covered()).containsExactly(1L);
        assertThat(coverage.collected()).containsExactly(1L);
    }

    @Test
    void receiptEligibilityAcceptsFullPendingCoverageButRejectsPartialBalances() {
        when(elementRepository.findClientDocumentSources(7L, List.of(1L))).thenReturn(List.of(element()));
        amounts(StatutAffectationReglement.EN_ATTENTE, "320.00", "9.00");
        var pending = service.receiptCoverage(7L, List.of(1L));
        assertThat(pending.covered()).containsExactly(1L);
        assertThat(pending.collected()).isEmpty();
        amounts(StatutAffectationReglement.CONFIRMEE, "319.00", "9.00");
        assertThat(service.receiptCoverage(7L, List.of(1L)).covered()).isEmpty();
    }

    @Test
    void missingOrForeignAgencySourcesAreNeverEligible() {
        assertThat(service.receiptCoverage(8L, List.of(1L)).covered()).isEmpty();
    }

    @Test
    void receiptCoverageIncludesParentInvoicePaymentsAndPreservesPendingCollection() {
        ElementFacturable element = element();
        Agence agency = new Agence();
        agency.setId(7L);
        DocumentClient invoice = DocumentClient.builder().agence(agency).typeDocument(TypeDocumentClient.FACTURE).build();
        invoice.setId(10L);
        LigneDocumentClient line = LigneDocumentClient.builder().document(invoice).elementFacturable(element)
                .ordre(0).montantTtc(new BigDecimal("329.00")).build();
        invoice.getLignes().add(line);
        when(elementRepository.findClientDocumentSources(7L, List.of(1L))).thenReturn(List.of(element));
        when(documentLineRepository.findIssuedDocumentsByElementIds(List.of(1L), StatutDocumentClient.EMIS))
                .thenReturn(List.of(line));
        when(ecartRepository.sumByElementIds(7L, List.of(1L))).thenReturn(Collections.singletonList(
                new Object[]{1L, new BigDecimal("9.00")}));
        when(allocationRepository.sumParentByDocumentIds(List.of(10L))).thenReturn(Collections.singletonList(
                new Object[]{10L, StatutAffectationReglement.EN_ATTENTE, new BigDecimal("320.00")}));
        var pending = service.receiptCoverage(7L, List.of(1L));
        assertThat(pending.covered()).containsExactly(1L);
        assertThat(pending.collected()).isEmpty();
        when(allocationRepository.sumParentByDocumentIds(List.of(10L))).thenReturn(Collections.singletonList(
                new Object[]{10L, StatutAffectationReglement.CONFIRMEE, new BigDecimal("320.00")}));
        assertThat(service.receiptCoverage(7L, List.of(1L)).collected()).containsExactly(1L);
    }

    @Test
    void grantsOnlyWithinConfiguredAgencyLimitAndOutstandingBalance() {
        when(parametreApplicationService.getDecimal(eq(7L), eq("REGLEMENT_CLIENT_ECART_MAX"), any()))
                .thenReturn(new BigDecimal("10.00"));
        validate(request("9.00"));
        assertThatThrownBy(() -> validate(request("10.00"))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void disabledLimitAndMissingPermissionCannotBeBypassedByPostingTheField() {
        assertThatThrownBy(() -> validate(request("9.00"))).isInstanceOf(BadRequestException.class);
        SecurityContextHolder.clearContext();
        assertThatThrownBy(() -> validate(request("9.00"))).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void refusesUnselectedSourceAndMissingReason() {
        var request = request("9.00");
        request.getEcarts().get(0).setElementFacturableId(99L);
        assertThatThrownBy(() -> validate(request)).isInstanceOf(BadRequestException.class);
        var noReason = request("9.00");
        noReason.getEcarts().get(0).setMotif(" ");
        assertThatThrownBy(() -> validate(noReason)).isInstanceOf(BadRequestException.class);
    }

    private void amounts(StatutAffectationReglement status, String payment, String adjustment) {
        when(allocationRepository.sumByElementIds(List.of(1L))).thenReturn(Collections.singletonList(
                new Object[]{1L, status, new BigDecimal(payment)}));
        when(ecartRepository.sumByElementIds(7L, List.of(1L))).thenReturn(Collections.singletonList(
                new Object[]{1L, new BigDecimal(adjustment)}));
    }

    private CreanceClientPageResponse.Ligne receivable() {
        Map<Long, ?> amounts = ReflectionTestUtils.invokeMethod(service, "loadAllocationAmounts", 7L, List.of(1L));
        Object current = amounts.get(1L);
        if (current == null) {
            Class<?> type = java.util.Arrays.stream(ReglementClientService.class.getDeclaredClasses())
                    .filter(candidate -> candidate.getSimpleName().equals("AllocationAmounts")).findFirst().orElseThrow();
            current = ReflectionTestUtils.invokeMethod(type, "empty");
        }
        return ReflectionTestUtils.invokeMethod(service, "toReceivable", SourceDocumentClientResponse.builder()
                .elementFacturableId(1L).montantTtc(new BigDecimal("329.00")).build(), current);
    }

    private void validate(CreerReglementClientRequest request) {
        ReflectionTestUtils.invokeMethod(service, "validateSettlementAdjustments", 7L, request,
                Map.of(1L, element()), Map.of(), Map.of(), Map.of(), Map.of(1L, new BigDecimal("320.00")), Map.of());
    }

    private CreerReglementClientRequest request(String amount) {
        var request = new CreerReglementClientRequest();
        var adjustment = new CreerReglementClientRequest.Ecart();
        adjustment.setElementFacturableId(1L);
        adjustment.setMontant(new BigDecimal(amount));
        adjustment.setMotif("Geste commercial autorisé");
        request.setEcarts(List.of(adjustment));
        return request;
    }

    private ElementFacturable element() {
        var element = ElementFacturable.builder().primeTotale(new BigDecimal("329.00")).build();
        element.setId(1L);
        return element;
    }
}
