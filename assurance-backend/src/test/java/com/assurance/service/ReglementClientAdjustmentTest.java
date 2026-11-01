package com.assurance.service;

import com.assurance.dto.request.CreerReglementClientRequest;
import com.assurance.dto.response.CreanceClientPageResponse;
import com.assurance.dto.response.SourceDocumentClientResponse;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.Agence;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.Quittance;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AffectationReglementClientRepository;
import com.assurance.repository.EcartReglementClientRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.LigneDocumentClientRepository;
import com.assurance.repository.QuittanceRepository;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReglementClientAdjustmentTest {
    @Mock private AffectationReglementClientRepository allocationRepository;
    @Mock private EcartReglementClientRepository ecartRepository;
    @Mock private QuittanceRepository quittanceRepository;
    @Mock private ElementFacturableRepository elementRepository;
    @Mock private LigneDocumentClientRepository documentLineRepository;
    @Mock private ParametreApplicationService parametreApplicationService;
    @InjectMocks private ReglementClientService service;

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
        assertThat(service.fullySettledElementIds(7L, List.of(1L))).containsExactly(1L);
    }

    @Test
    void receiptEligibilityRejectsPendingAndPartialBalances() {
        when(elementRepository.findClientDocumentSources(7L, List.of(1L))).thenReturn(List.of(element()));
        amounts(StatutAffectationReglement.EN_ATTENTE, "320.00", "9.00");
        assertThat(service.fullySettledElementIds(7L, List.of(1L))).isEmpty();
        amounts(StatutAffectationReglement.CONFIRMEE, "319.00", "9.00");
        assertThat(service.fullySettledElementIds(7L, List.of(1L))).isEmpty();
    }

    @Test
    void missingOrForeignAgencySourcesAreNeverEligible() {
        assertThat(service.fullySettledElementIds(8L, List.of(1L))).isEmpty();
    }

    @Test
    void receiptEligibilityIncludesConfirmedParentInvoicePaymentsButNotPendingOnes() {
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
        assertThat(service.fullySettledElementIds(7L, List.of(1L))).isEmpty();
        when(allocationRepository.sumParentByDocumentIds(List.of(10L))).thenReturn(Collections.singletonList(
                new Object[]{10L, StatutAffectationReglement.CONFIRMEE, new BigDecimal("320.00")}));
        assertThat(service.fullySettledElementIds(7L, List.of(1L))).containsExactly(1L);
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
